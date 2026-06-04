from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Any
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from app.core.redis import redis_client
from app.websockets.manager import manager
from app.db.database import get_session, engine

logger = logging.getLogger("uvicorn.error")
router = APIRouter()

chat_connections: Dict[int, List[WebSocket]] = {}


@router.websocket('/fretes/{frete_id}')
async def websocket_localizacao(websocket: WebSocket, frete_id: int):
    await manager.connect(frete_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(frete_id, websocket)


@router.websocket('/motoristas/{motorista_id}')
async def websocket_motorista(websocket: WebSocket, motorista_id: int):
    await websocket.accept()
    logger.info(f"Motorista {motorista_id} conectado para localização")
    try:
        while True:
            data = await websocket.receive_json()
            latitude = data.get('latitude')
            longitude = data.get('longitude')
            frete_id = int(data.get('frete_id'))
            chave = f'motorista:{motorista_id}:localizacao'
            try:
                redis_client.hset(chave, mapping={'latitude': latitude, 'longitude': longitude})
                redis_client.expire(chave, 30)
            except Exception:
                pass
            await manager.send_location(frete_id, {
                'motorista_id': motorista_id,
                'latitude': latitude,
                'longitude': longitude,
            })
    except WebSocketDisconnect:
        logger.info(f"Motorista {motorista_id} desconectado da localização")


def _execute_with_retry(fn):
    try:
        return fn()
    except OperationalError:
        engine.dispose()
        return fn()


def _resolve_remetente(session: Session, frete_id: int, sender: str) -> tuple[int, str]:
    sender_norm = str(sender or "user").lower()
    frete = session.execute(
        text("SELECT id_cliente, id_motorista FROM frete7 WHERE id_frete = :id LIMIT 1"),
        {"id": frete_id},
    ).first()
    if not frete:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    f = frete._mapping

    if sender_norm in {"driver", "motorista"}:
        id_motorista = f.get("id_motorista")
        if not id_motorista:
            # Durante negociação, antes do aceite, usa o motorista da proposta mais recente.
            proposta = session.execute(
                text(
                    """
                    SELECT id_motorista
                    FROM negociacao7
                    WHERE id_frete = :frete_id
                    ORDER BY id_negociacao DESC
                    LIMIT 1
                    """
                ),
                {"frete_id": frete_id},
            ).first()
            if proposta:
                id_motorista = proposta[0]
        if not id_motorista:
            id_motorista = session.execute(text("SELECT id_motorista FROM motorista7 ORDER BY id_motorista ASC LIMIT 1")).scalar()
        id_pessoa = session.execute(
            text("SELECT id_pessoa FROM motorista7 WHERE id_motorista = :id LIMIT 1"),
            {"id": id_motorista},
        ).scalar()
        if not id_pessoa:
            raise HTTPException(status_code=400, detail="Motorista remetente não encontrado")
        return int(id_pessoa), "MOTORISTA"

    id_pessoa = session.execute(
        text("SELECT id_pessoa FROM cliente7 WHERE id_cliente = :id LIMIT 1"),
        {"id": f.get("id_cliente")},
    ).scalar()
    if not id_pessoa:
        raise HTTPException(status_code=400, detail="Cliente remetente não encontrado")
    return int(id_pessoa), "CLIENTE"


def _format_msg(row: Any) -> dict[str, Any]:
    m = row._mapping if hasattr(row, "_mapping") else row
    tipo = str(m.get("tipo_remetente") or "CLIENTE").upper()
    criada = m.get("criada_em")
    if hasattr(criada, "strftime"):
        time_str = criada.strftime("%H:%M")
        iso = criada.isoformat()
    else:
        time_str = str(criada or "")[:16]
        iso = str(criada or "")
    return {
        "id": str(m.get("id_mensagem")),
        "id_mensagem": int(m.get("id_mensagem")),
        "id_frete": int(m.get("id_frete")),
        "id_remetente_pessoa": int(m.get("id_remetente_pessoa")),
        "tipo_remetente": tipo,
        "text": m.get("conteudo") or "",
        "conteudo": m.get("conteudo") or "",
        "sender": "driver" if tipo == "MOTORISTA" else "user",
        "time": time_str,
        "criada_em": iso,
        "lida": bool(m.get("lida")),
    }


def _buscar_historico(session: Session, frete_id: int) -> list[dict[str, Any]]:
    rows = session.execute(
        text(
            """
            SELECT id_mensagem, id_frete, id_remetente_pessoa, tipo_remetente, conteudo, lida, criada_em
            FROM mensagem_chat7
            WHERE id_frete = :frete_id
            ORDER BY criada_em ASC, id_mensagem ASC
            """
        ),
        {"frete_id": frete_id},
    ).fetchall()
    return [_format_msg(row) for row in rows]


def _salvar_mensagem(frete_id: int, sender: str, text_value: str) -> dict[str, Any]:
    def work():
        with Session(engine) as session:
            id_pessoa, tipo = _resolve_remetente(session, frete_id, sender)
            result = session.execute(
                text(
                    """
                    INSERT INTO mensagem_chat7 (id_frete, id_remetente_pessoa, tipo_remetente, conteudo, lida)
                    VALUES (:id_frete, :id_remetente_pessoa, :tipo_remetente, :conteudo, 0)
                    """
                ),
                {
                    "id_frete": frete_id,
                    "id_remetente_pessoa": id_pessoa,
                    "tipo_remetente": tipo,
                    "conteudo": text_value,
                },
            )
            session.commit()
            msg_id = getattr(result, "lastrowid", None) or session.execute(text("SELECT LAST_INSERT_ID()")).scalar()
            row = session.execute(
                text(
                    """
                    SELECT id_mensagem, id_frete, id_remetente_pessoa, tipo_remetente, conteudo, lida, criada_em
                    FROM mensagem_chat7
                    WHERE id_mensagem = :id
                    """
                ),
                {"id": msg_id},
            ).first()
            return _format_msg(row)
    return _execute_with_retry(work)


@router.websocket('/chat/{frete_id}')
async def websocket_chat(websocket: WebSocket, frete_id: int):
    await websocket.accept()
    chat_connections.setdefault(frete_id, []).append(websocket)
    logger.info(f"Chat conectado no frete {frete_id}. Total: {len(chat_connections.get(frete_id, []))}")
    try:
        while True:
            data = await websocket.receive_json()
            text_value = str(data.get("text") or data.get("conteudo") or "").strip()
            if not text_value:
                continue
            sender = data.get("sender") or "user"
            try:
                msg = _salvar_mensagem(frete_id, sender, text_value)
                for ws in list(chat_connections.get(frete_id, [])):
                    try:
                        await ws.send_json(msg)
                    except Exception:
                        pass
            except Exception as exc:
                logger.error(f"Erro ao persistir mensagem do chat: {exc}")
                try:
                    await websocket.send_json({"type": "error", "detail": str(exc)})
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        if frete_id in chat_connections and websocket in chat_connections[frete_id]:
            chat_connections[frete_id].remove(websocket)


@router.get('/chat/{frete_id}/historico')
def obter_historico_chat(
    frete_id: int,
    role: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    session: Session = Depends(get_session),
):
    exists = session.execute(text("SELECT COUNT(*) FROM frete7 WHERE id_frete = :id"), {"id": frete_id}).scalar()
    if not exists:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    return _buscar_historico(session, frete_id)


@router.get('/chat/{frete_id}/history')
def obter_historico_chat_alias(frete_id: int, session: Session = Depends(get_session)):
    return _buscar_historico(session, frete_id)
