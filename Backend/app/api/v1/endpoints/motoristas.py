from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import text
from sqlmodel import Session

from app.db.database import get_session

router = APIRouter()

class PerfilMotoristaUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    cnh: Optional[str] = None
    veiculo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    placa: Optional[str] = None



def _resolve_motorista_id(db: Session, identifier: int | None) -> int:
    if identifier:
        direct = db.execute(text("SELECT id_motorista FROM motorista7 WHERE id_motorista = :id LIMIT 1"), {"id": identifier}).scalar()
        if direct:
            return int(direct)
        by_person = db.execute(text("SELECT id_motorista FROM motorista7 WHERE id_pessoa = :id LIMIT 1"), {"id": identifier}).scalar()
        if by_person:
            return int(by_person)
    first = db.execute(text("SELECT id_motorista FROM motorista7 ORDER BY id_motorista ASC LIMIT 1")).scalar()
    if first:
        return int(first)
    raise HTTPException(status_code=404, detail="Motorista não encontrado")


@router.get("/")
def listar_motoristas(db: Session = Depends(get_session)):
    rows = db.execute(
        text(
            """
            SELECT m.id_motorista, m.id_pessoa, p.nome, p.email, m.avaliacao_media
            FROM motorista7 m
            JOIN pessoa7 p ON p.id_pessoa = m.id_pessoa
            ORDER BY m.id_motorista ASC
            """
        )
    ).fetchall()
    return [
        {
            "id": int(r._mapping["id_motorista"]),
            "id_motorista": int(r._mapping["id_motorista"]),
            "id_pessoa": int(r._mapping["id_pessoa"]),
            "nome": r._mapping["nome"],
            "email": r._mapping["email"],
            "avaliacao": float(r._mapping["avaliacao_media"] or 0),
            "status": "ATIVO",
        }
        for r in rows
    ]


@router.get("/{motorista_id}/perfil")
def obter_perfil_motorista(motorista_id: int, db: Session = Depends(get_session)):
    motorista_id = _resolve_motorista_id(db, motorista_id)
    row = db.execute(
        text(
            """
            SELECT p.nome, p.cpf, p.telefone, p.email,
                   m.id_motorista, m.data_inicio, m.avaliacao_media,
                   v.tipo, v.marca, v.modelo, v.placa
            FROM motorista7 m
            JOIN pessoa7 p ON p.id_pessoa = m.id_pessoa
            LEFT JOIN veiculo7 v ON v.id_motorista = m.id_motorista
            WHERE m.id_motorista = :motorista_id
            ORDER BY v.id_veiculo ASC
            LIMIT 1
            """
        ),
        {"motorista_id": motorista_id},
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    m = row._mapping

    stats = db.execute(
        text(
            """
            SELECT COUNT(*) AS total, SUM(IFNULL(preco_fechado, preco_estimado)) AS saldo
            FROM frete7
            WHERE id_motorista = :motorista_id
              AND status IN ('ACEITO', 'EM_TRANSITO', 'AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_LIBERADO', 'CONCLUIDO')
            """
        ),
        {"motorista_id": motorista_id},
    ).first()._mapping

    return {
        "nome": m.get("nome"),
        "email": m.get("email"),
        "cpf": m.get("cpf"),
        "telefone": m.get("telefone"),
        "id_motorista": motorista_id,
        "data_inicio": m.get("data_inicio").strftime("%m/%Y") if m.get("data_inicio") else "Não informado",
        "avaliacao": float(m.get("avaliacao_media") or 0),
        "total_fretes": int(stats.get("total") or 0),
        "saldo_carteira": float(stats.get("saldo") or 0),
        "veiculo": " ".join(str(x) for x in [m.get("marca"), m.get("modelo")] if x) or m.get("tipo") or "Veículo",
        "placa": m.get("placa") or "N/A",
    }


@router.get("/{motorista_id}/historico")
def obter_historico_motorista(motorista_id: int, db: Session = Depends(get_session)):
    motorista_id = _resolve_motorista_id(db, motorista_id)
    rows = db.execute(
        text(
            """
            SELECT
                f.id_frete, f.endereco_origem, f.endereco_destino,
                f.peso_total_kg, f.preco_estimado, f.preco_fechado,
                f.status, f.id_motorista, f.id_veiculo,
                v.tipo, v.marca, v.modelo, v.placa,
                pc.nome AS cliente_nome
            FROM frete7 f
            JOIN cliente7 c ON c.id_cliente = f.id_cliente
            JOIN pessoa7 pc ON pc.id_pessoa = c.id_pessoa
            LEFT JOIN veiculo7 v ON v.id_veiculo = f.id_veiculo
            WHERE f.id_motorista = :motorista_id
              AND f.status IN ('ACEITO', 'EM_TRANSITO', 'AGUARDANDO_CONFIRMACAO', 'PAGAMENTO_LIBERADO', 'CONCLUIDO')
            ORDER BY f.id_frete DESC
            """
        ),
        {"motorista_id": motorista_id},
    ).fetchall()

    historico = []
    for row in rows:
        m = row._mapping
        preco = m.get("preco_fechado") if m.get("preco_fechado") is not None else m.get("preco_estimado")
        historico.append(
            {
                "id": int(m["id_frete"]),
                "id_frete": int(m["id_frete"]),
                "descricao": f"Frete #{int(m['id_frete'])}",
                "peso_estimado": float(m.get("peso_total_kg") or 0),
                "status": str(m.get("status") or "").lower(),
                "origem": m.get("endereco_origem") or "Não informado",
                "destino": m.get("endereco_destino") or "Não informado",
                "preco": float(preco or 0),
                "cliente": m.get("cliente_nome") or "Cliente",
                "cliente_nome": m.get("cliente_nome") or "Cliente",
                "veiculo": " ".join(str(x) for x in [m.get("marca"), m.get("modelo")] if x) or m.get("tipo") or "Veículo",
                "placa": m.get("placa") or "N/A",
            }
        )
    return historico


@router.get("/{motorista_id}/chats")
def listar_chats_motorista(motorista_id: int, db: Session = Depends(get_session)):
    # Usa os próprios fretes atribuídos ao motorista como lista de conversas.
    return obter_historico_motorista(motorista_id, db)


@router.put("/{motorista_id}/perfil")
def atualizar_perfil_motorista(motorista_id: int, dados: PerfilMotoristaUpdate, db: Session = Depends(get_session)):
    motorista_id = _resolve_motorista_id(db, motorista_id)
    pessoa_id = db.execute(text("SELECT id_pessoa FROM motorista7 WHERE id_motorista = :id LIMIT 1"), {"id": motorista_id}).scalar()
    if not pessoa_id:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    updates = []
    params = {"id_pessoa": pessoa_id}
    for col in ["nome", "email", "cpf", "telefone"]:
        value = getattr(dados, col, None)
        if value is not None and str(value).strip() != "":
            updates.append(f"{col} = :{col}")
            params[col] = value
    if updates:
        db.execute(text(f"UPDATE pessoa7 SET {', '.join(updates)} WHERE id_pessoa = :id_pessoa"), params)
    veiculo_id = db.execute(text("SELECT id_veiculo FROM veiculo7 WHERE id_motorista = :id ORDER BY id_veiculo ASC LIMIT 1"), {"id": motorista_id}).scalar()
    if veiculo_id:
        v_updates = []
        v_params = {"id_veiculo": veiculo_id}
        mapping = {"veiculo": "tipo", "marca": "marca", "modelo": "modelo", "placa": "placa"}
        for attr, col in mapping.items():
            value = getattr(dados, attr, None)
            if value is not None and str(value).strip() != "":
                v_updates.append(f"{col} = :{col}")
                v_params[col] = value
        if v_updates:
            db.execute(text(f"UPDATE veiculo7 SET {', '.join(v_updates)} WHERE id_veiculo = :id_veiculo"), v_params)
    db.commit()
    return {"status": "perfil_motorista_atualizado", "perfil": obter_perfil_motorista(motorista_id, db)}

@router.get("/{motorista_id}/carteira")
def obter_carteira_motorista(motorista_id: int, db: Session = Depends(get_session)):
    motorista_id = _resolve_motorista_id(db, motorista_id)
    row = db.execute(text("SELECT saldo_disponivel, saldo_pendente FROM carteira_motorista7 WHERE id_motorista = :id"), {"id": motorista_id}).first()
    if not row:
        return {"id_motorista": motorista_id, "saldo_disponivel": 0.0, "saldo_pendente": 0.0}
    m = row._mapping
    return {"id_motorista": motorista_id, "saldo_disponivel": float(m.get("saldo_disponivel") or 0), "saldo_pendente": float(m.get("saldo_pendente") or 0)}
