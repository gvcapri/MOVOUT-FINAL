from __future__ import annotations
import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from app.db.database import engine, get_session
from app.services.ai_service import detectar_objeto as call_ai_service
from app.websockets.manager import manager

router = APIRouter()


class PropostaFreteCreate(BaseModel):
    motorista_id: Optional[int] = None
    nome_motorista: Optional[str] = None
    valor: float
    tempo_estimado: Optional[str] = "30 min"
    rating: float = 4.8


class ContrapropostaCliente(BaseModel):
    valor: float
    motorista_id: Optional[int] = None
    id_negociacao: Optional[int] = None


class FreteCreate(BaseModel):
    # Formato enviado pelo frontend do cliente
    id: Optional[int] = None
    descricao: Optional[str] = None
    peso_estimado: Optional[float] = 50.0
    status: Optional[str] = "aberto"
    origem: Optional[str] = None
    destino: Optional[str] = None
    origem_lat: Optional[float] = None
    origem_lng: Optional[float] = None
    destino_lat: Optional[float] = None
    destino_lng: Optional[float] = None
    distancia_km: Optional[float] = None
    tipo_veiculo: Optional[str] = None
    objeto_ia: Optional[str] = None
    prioridade: Optional[str] = "today"
    prioridade_entrega: Optional[str] = None
    data_agendada: Optional[str] = None
    fragil: bool = False
    metodo_pagamento: Optional[dict[str, Any]] = None
    id_cartao_cliente: Optional[int] = None

    # Campos opcionais novos. Se o frontend enviar, usamos; se não, usamos fallback seguro.
    cliente_email: Optional[str] = None
    email: Optional[str] = None
    id_cliente: Optional[int] = None
    id_pessoa: Optional[int] = None


class OperacaoPagamento(BaseModel):
    observacao: Optional[str] = None


class AvaliacaoCreate(BaseModel):
    tipo_avaliador: str = "CLIENTE"
    tipo_avaliado: str = "MOTORISTA"
    nota: int
    comentario: Optional[str] = None
    motorista_id: Optional[int] = None


def _scalar(db: Session, sql: str, params: Optional[dict[str, Any]] = None) -> Any:
    return db.execute(text(sql), params or {}).scalar()


def _rows(db: Session, sql: str, params: Optional[dict[str, Any]] = None):
    return db.execute(text(sql), params or {}).fetchall()


def _columns(db: Session, table_name: str) -> set[str]:
    rows = _rows(
        db,
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
        """,
        {"table_name": table_name},
    )
    return {str(r[0]) for r in rows}


def _table_exists(db: Session, table_name: str) -> bool:
    return bool(
        _scalar(
            db,
            """
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table_name
            """,
            {"table_name": table_name},
        )
    )


def _has_column(db: Session, table_name: str, column_name: str) -> bool:
    return column_name in _columns(db, table_name)


def _status_front(status_db: Optional[str]) -> str:
    value = str(status_db or "PENDENTE").upper()
    return {
        "PENDENTE": "aberto",
        "NEGOCIANDO": "negociando",
        "ACEITO": "aceito",
        "EM_TRANSITO": "em andamento",
        "AGUARDANDO_CONFIRMACAO": "aguardando confirmação",
        "AGUARDANDO_PAGAMENTO": "aguardando pagamento",
        "PAGAMENTO_LIBERADO": "pagamento liberado",
        "CONCLUIDO": "concluido",
        "CANCELADO": "cancelado",
    }.get(value, value.lower())


def _status_db(status_front: Optional[str]) -> str:
    value = str(status_front or "aberto").strip().lower()
    return {
        "aberto": "PENDENTE",
        "pendente": "PENDENTE",
        "negociando": "NEGOCIANDO",
        "aceito": "ACEITO",
        "em andamento": "EM_TRANSITO",
        "em_andamento": "EM_TRANSITO",
        "aguardando confirmação": "AGUARDANDO_CONFIRMACAO",
        "aguardando_confirmacao": "AGUARDANDO_CONFIRMACAO",
        "aguardando pagamento": "AGUARDANDO_PAGAMENTO",
        "pagamento liberado": "PAGAMENTO_LIBERADO",
        "concluido": "CONCLUIDO",
        "cancelado": "CANCELADO",
    }.get(value, "PENDENTE")


def _money(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def _normalizar_tipo_veiculo(tipo_veiculo: Optional[str]) -> str:
    tipo = str(tipo_veiculo or "CARRO").strip().upper()
    if "CAMIN" in tipo or "TRUCK" in tipo:
        return "CAMINHAO"
    if "VAN" in tipo or "FURG" in tipo:
        return "VAN"
    return "CARRO"


def _normalizar_prioridade(prioridade: Optional[str]) -> str:
    valor = str(prioridade or "HOJE").strip().upper()
    if valor in {"URGENT", "URGENTE", "20", "20_MIN", "20_MINUTOS"}:
        return "20_MINUTOS"
    if valor in {"SCHEDULE", "AGENDAR", "AGENDADO", "DATA"}:
        return "AGENDADO"
    return "HOJE"


def _metodo_pagamento_info(metodo: Optional[dict[str, Any]], id_cartao_cliente: Optional[int] = None) -> tuple[Optional[int], str, str]:
    if not metodo:
        return id_cartao_cliente, "PIX", "PIX"
    tipo = str(metodo.get("tipo") or metodo.get("type") or "PIX").upper()
    label = str(metodo.get("label") or metodo.get("apelido") or tipo)
    cartao_id = metodo.get("id_cartao") or metodo.get("id") or id_cartao_cliente
    try:
        cartao_id = int(cartao_id) if cartao_id and str(cartao_id).isdigit() else id_cartao_cliente
    except Exception:
        cartao_id = id_cartao_cliente
    if tipo in {"CREDIT", "CREDITO", "CRÉDITO"}:
        tipo = "CARTAO_CREDITO"
    elif tipo in {"DEBIT", "DEBITO", "DÉBITO"}:
        tipo = "CARTAO_DEBITO"
    elif tipo == "PIX":
        tipo = "PIX"
    return cartao_id, tipo, label[:120]


def _tarifa_veiculo(db: Session, tipo: str) -> dict[str, float]:
    defaults = {
        "CARRO": {"valor_base": 12.0, "valor_por_km": 2.20, "valor_por_kg": 0.10, "multiplicador": 1.00},
        "VAN": {"valor_base": 20.0, "valor_por_km": 3.20, "valor_por_kg": 0.16, "multiplicador": 1.35},
        "CAMINHAO": {"valor_base": 35.0, "valor_por_km": 5.00, "valor_por_kg": 0.24, "multiplicador": 1.85},
    }
    base = defaults.get(tipo, defaults["CARRO"]).copy()
    if _table_exists(db, "tarifa_veiculo7"):
        row = db.execute(text("""
            SELECT valor_base, valor_por_km, valor_por_kg, multiplicador
            FROM tarifa_veiculo7
            WHERE tipo_veiculo = :tipo AND ativo = 1
            LIMIT 1
        """), {"tipo": tipo}).first()
        if row:
            m = row._mapping
            base = {k: _money(m.get(k), base[k]) for k in base}
    return base


def _tarifa_prioridade(db: Session, prioridade: str) -> dict[str, float]:
    defaults = {
        "20_MINUTOS": {"multiplicador": 1.35, "taxa_fixa": 10.0},
        "HOJE": {"multiplicador": 1.15, "taxa_fixa": 5.0},
        "AGENDADO": {"multiplicador": 1.00, "taxa_fixa": 0.0},
    }
    base = defaults.get(prioridade, defaults["HOJE"]).copy()
    if _table_exists(db, "tarifa_prioridade7"):
        row = db.execute(text("""
            SELECT multiplicador, taxa_fixa
            FROM tarifa_prioridade7
            WHERE prioridade = :prioridade AND ativo = 1
            LIMIT 1
        """), {"prioridade": prioridade}).first()
        if row:
            m = row._mapping
            base = {k: _money(m.get(k), base[k]) for k in base}
    return base


def _calcular_preco_detalhado(db: Session, distancia_km: float, peso_kg: float, tipo_veiculo: Optional[str], prioridade: Optional[str], fragil: bool = False) -> dict[str, Any]:
    distancia = max(float(distancia_km or 0), 0)
    peso = max(float(peso_kg or 0), 0.01)
    tipo_norm = _normalizar_tipo_veiculo(tipo_veiculo)
    prioridade_norm = _normalizar_prioridade(prioridade)
    tv = _tarifa_veiculo(db, tipo_norm)
    tp = _tarifa_prioridade(db, prioridade_norm)
    valor_base = tv["valor_base"]
    valor_distancia = distancia * tv["valor_por_km"]
    valor_peso = peso * tv["valor_por_kg"]
    subtotal_veiculo = (valor_base + valor_distancia + valor_peso) * tv["multiplicador"]
    adicional_fragil = 12.0 if fragil else 0.0
    valor_prioridade = subtotal_veiculo * (tp["multiplicador"] - 1.0) + tp["taxa_fixa"]
    total = max(20.0, subtotal_veiculo + adicional_fragil + valor_prioridade)
    return {
        "tipo_veiculo": tipo_norm,
        "prioridade": prioridade_norm,
        "valor_base": round(valor_base, 2),
        "valor_distancia": round(valor_distancia, 2),
        "valor_peso": round(valor_peso, 2),
        "valor_veiculo": round(subtotal_veiculo, 2),
        "valor_prioridade": round(valor_prioridade, 2),
        "valor_total_calculado": round(total, 2),
        "preco_estimado": round(total, 2),
    }


def _calcular_preco_frete(distancia_km: float, peso_kg: float, tipo_veiculo: Optional[str] = None, fragil: bool = False) -> float:
    # Fallback antigo preservado para compatibilidade.
    distancia = max(float(distancia_km or 0), 0)
    peso = max(float(peso_kg or 0), 0.01)
    tipo = _normalizar_tipo_veiculo(tipo_veiculo)
    fator = {"CARRO": 1.0, "VAN": 1.35, "CAMINHAO": 1.85}.get(tipo, 1.0)
    return round(max(20.0, 12.0 + distancia * 2.2 * fator + peso * 0.10 * fator + (12.0 if fragil else 0.0)), 2)


def _cliente_id(db: Session, dados: Optional[FreteCreate] = None) -> int:
    if dados and dados.id_cliente:
        found = _scalar(db, "SELECT id_cliente FROM cliente7 WHERE id_cliente = :id LIMIT 1", {"id": dados.id_cliente})
        if found:
            return int(found)

    if dados and dados.id_pessoa:
        found = _scalar(db, "SELECT id_cliente FROM cliente7 WHERE id_pessoa = :id LIMIT 1", {"id": dados.id_pessoa})
        if found:
            return int(found)

    email = None
    if dados:
        email = dados.cliente_email or dados.email
    if email:
        found = _scalar(
            db,
            """
            SELECT c.id_cliente
            FROM cliente7 c
            JOIN pessoa7 p ON p.id_pessoa = c.id_pessoa
            WHERE p.email = :email
            LIMIT 1
            """,
            {"email": email},
        )
        if found:
            return int(found)

    found = _scalar(db, "SELECT id_cliente FROM cliente7 ORDER BY id_cliente ASC LIMIT 1")
    if not found:
        raise HTTPException(status_code=400, detail="Nenhum cliente cadastrado em cliente7.")
    return int(found)


def _resolve_motorista_id(db: Session, identifier: Optional[int]) -> int:
    if identifier:
        found = _scalar(db, "SELECT id_motorista FROM motorista7 WHERE id_motorista = :id LIMIT 1", {"id": identifier})
        if found:
            return int(found)
        found = _scalar(db, "SELECT id_motorista FROM motorista7 WHERE id_pessoa = :id LIMIT 1", {"id": identifier})
        if found:
            return int(found)

    found = _scalar(db, "SELECT id_motorista FROM motorista7 ORDER BY id_motorista ASC LIMIT 1")
    if found:
        return int(found)
    raise HTTPException(status_code=400, detail="Nenhum motorista cadastrado em motorista7.")


def _veiculo_motorista(db: Session, motorista_id: int) -> Optional[int]:
    if not _table_exists(db, "veiculo7"):
        return None
    order_sql = "id_veiculo ASC"
    if _has_column(db, "veiculo7", "status"):
        order_sql = "CASE WHEN status = 'DISPONIVEL' THEN 0 ELSE 1 END, id_veiculo ASC"
    found = _scalar(
        db,
        f"""
        SELECT id_veiculo
        FROM veiculo7
        WHERE id_motorista = :motorista_id
        ORDER BY {order_sql}
        LIMIT 1
        """,
        {"motorista_id": motorista_id},
    )
    return int(found) if found else None


def _frete_exists(db: Session, frete_id: int) -> bool:
    return bool(_scalar(db, "SELECT COUNT(*) FROM frete7 WHERE id_frete = :id", {"id": frete_id}))


def _frete_row(db: Session, frete_id: int):
    return db.execute(
        text(
            """
            SELECT
                f.id_frete, f.id_cliente, f.id_motorista, f.id_veiculo,
                f.endereco_origem, f.latitude_origem, f.longitude_origem,
                f.endereco_destino, f.latitude_destino, f.longitude_destino,
                f.distancia_km, f.peso_total_kg, f.volume_carga_total,
                f.preco_estimado, f.preco_fechado, f.status,
                f.id_cartao_cliente, f.metodo_pagamento, f.pagamento_descricao,
                f.prioridade_entrega, f.data_agendada, f.tipo_veiculo_solicitado,
                f.peso_estimado_kg, f.valor_base, f.valor_distancia, f.valor_peso,
                f.valor_veiculo, f.valor_prioridade, f.valor_total_calculado,
                f.cliente_confirmou_conclusao, f.motorista_confirmou_conclusao, f.concluido_em,
                pm.nome AS motorista_nome,
                pm.telefone AS motorista_telefone,
                m.avaliacao_media AS motorista_avaliacao,
                v.tipo AS veiculo_tipo,
                v.marca AS veiculo_marca,
                v.modelo AS veiculo_modelo,
                v.placa AS veiculo_placa,
                pc.nome AS cliente_nome,
                pc.email AS cliente_email
            FROM frete7 f
            JOIN cliente7 c ON c.id_cliente = f.id_cliente
            JOIN pessoa7 pc ON pc.id_pessoa = c.id_pessoa
            LEFT JOIN motorista7 m ON m.id_motorista = f.id_motorista
            LEFT JOIN pessoa7 pm ON pm.id_pessoa = m.id_pessoa
            LEFT JOIN veiculo7 v ON v.id_veiculo = f.id_veiculo
            WHERE f.id_frete = :id
            LIMIT 1
            """
        ),
        {"id": frete_id},
    ).first()


def _vehicle_label(m: dict[str, Any]) -> str:
    parts = [m.get("veiculo_marca"), m.get("veiculo_modelo")]
    label = " ".join(str(x) for x in parts if x)
    return label or m.get("veiculo_tipo") or "Veículo"


def _proposal_rows(db: Session, frete_id: int) -> list[dict[str, Any]]:
    if not _table_exists(db, "negociacao7"):
        return []
    rows = _rows(
        db,
        """
        SELECT
            n.id_negociacao, n.id_frete, n.id_motorista, n.id_veiculo,
            n.preco_proposto, n.status,
            COALESCE(n.preco_original, n.preco_proposto) AS preco_original,
            p.nome AS nome_motorista,
            m.avaliacao_media,
            v.tipo, v.marca, v.modelo, v.placa
        FROM negociacao7 n
        JOIN motorista7 m ON m.id_motorista = n.id_motorista
        JOIN pessoa7 p ON p.id_pessoa = m.id_pessoa
        LEFT JOIN veiculo7 v ON v.id_veiculo = n.id_veiculo
        WHERE n.id_frete = :frete_id
          AND n.status IN ('PENDENTE', 'ACEITA')
        ORDER BY n.id_negociacao ASC
        """,
        {"frete_id": frete_id},
    )
    result = []
    for row in rows:
        m = row._mapping
        result.append(
            {
                "id": int(m["id_negociacao"]),
                "id_negociacao": int(m["id_negociacao"]),
                "frete_id": int(m["id_frete"]),
                "motorista_id": int(m["id_motorista"]),
                "id_motorista": int(m["id_motorista"]),
                "nome_motorista": m.get("nome_motorista") or "Motorista",
                "valor": _money(m.get("preco_proposto")),
                "valor_original": _money(m.get("preco_original")),
                "tempo_estimado": "30 min",
                "rating": _money(m.get("avaliacao_media"), 4.8),
                "status": m.get("status") or "PENDENTE",
                "veiculo": " ".join(str(x) for x in [m.get("marca"), m.get("modelo")] if x) or m.get("tipo") or "Veículo",
                "placa": m.get("placa") or "N/A",
            }
        )
    return result


def _frete_payload(row: Any, propostas: Optional[list[dict[str, Any]]] = None) -> dict[str, Any]:
    m = row._mapping if hasattr(row, "_mapping") else row
    status = _status_front(m.get("status"))
    motorista_id = m.get("id_motorista")
    motorista_nome = m.get("motorista_nome")
    motorista_payload = None
    if motorista_id:
        motorista_payload = {
            "id": int(motorista_id),
            "id_motorista": int(motorista_id),
            "nome": motorista_nome or "Motorista",
            "name": motorista_nome or "Motorista",
            "rating": _money(m.get("motorista_avaliacao"), 4.8),
            "nota": _money(m.get("motorista_avaliacao"), 4.8),
            "vehicle": _vehicle_label(m),
            "veiculo": _vehicle_label(m),
            "plate": m.get("veiculo_placa") or "N/A",
            "placa": m.get("veiculo_placa") or "N/A",
            "telefone": m.get("motorista_telefone") or "",
            "foto": "https://randomuser.me/api/portraits/men/32.jpg",
        }
    return {
        "id": int(m["id_frete"]),
        "id_frete": int(m["id_frete"]),
        "descricao": f"Frete #{int(m['id_frete'])}",
        "peso_estimado": _money(m.get("peso_total_kg")),
        "status": status,
        "origem": m.get("endereco_origem") or "Origem não informada",
        "destino": m.get("endereco_destino") or "Destino não informado",
        "origem_lat": _money(m.get("latitude_origem")),
        "origem_lng": _money(m.get("longitude_origem")),
        "destino_lat": _money(m.get("latitude_destino")),
        "destino_lng": _money(m.get("longitude_destino")),
        "distancia_km": _money(m.get("distancia_km")),
        "tipo_veiculo": m.get("tipo_veiculo_solicitado") or m.get("veiculo_tipo") or "Veículo",
        "objeto_ia": None,
        "prioridade": m.get("prioridade_entrega") or "HOJE",
        "prioridade_entrega": m.get("prioridade_entrega") or "HOJE",
        "data_agendada": str(m.get("data_agendada") or "") or None,
        "fragil": False,
        "metodo_pagamento": m.get("metodo_pagamento") or "PIX",
        "pagamento_descricao": m.get("pagamento_descricao") or "PIX",
        "id_cartao_cliente": int(m.get("id_cartao_cliente")) if m.get("id_cartao_cliente") else None,
        "valor_base": _money(m.get("valor_base")),
        "valor_distancia": _money(m.get("valor_distancia")),
        "valor_peso": _money(m.get("valor_peso")),
        "valor_veiculo": _money(m.get("valor_veiculo")),
        "valor_prioridade": _money(m.get("valor_prioridade")),
        "valor_total_calculado": _money(m.get("valor_total_calculado")),
        "cliente_confirmou_conclusao": bool(m.get("cliente_confirmou_conclusao")),
        "motorista_confirmou_conclusao": bool(m.get("motorista_confirmou_conclusao")),
        "concluido_em": str(m.get("concluido_em") or "") or None,
        "preco_estimado": _money(m.get("preco_estimado")),
        "preco_fechado": _money(m.get("preco_fechado")) if m.get("preco_fechado") is not None else None,
        "id_motorista": int(motorista_id) if motorista_id else None,
        "motorista_id": int(motorista_id) if motorista_id else None,
        "id_veiculo": int(m.get("id_veiculo")) if m.get("id_veiculo") else None,
        "motorista_nome": motorista_nome or "Não atribuído",
        "driver": motorista_nome or "Não atribuído",
        "motorista": motorista_payload,
        "cliente_nome": m.get("cliente_nome"),
        "cliente_email": m.get("cliente_email"),
        "propostas": propostas if propostas is not None else [],
    }


def _update_legacy_if_exists(db: Session, table: str, id_col: str, id_value: int, values: dict[str, Any]) -> None:
    if not _table_exists(db, table):
        return
    cols = _columns(db, table)
    if id_col not in cols:
        return
    sets = []
    params = {"id_value": id_value}
    for key, value in values.items():
        if key in cols:
            sets.append(f"{key} = :{key}")
            params[key] = value
    if not sets:
        return
    db.execute(text(f"UPDATE {table} SET {', '.join(sets)} WHERE {id_col} = :id_value"), params)


def _insert_negociacao(db: Session, frete_id: int, motorista_id: int, veiculo_id: Optional[int], valor: float, frete_map: dict[str, Any], status: str = "PENDENTE") -> int:
    cols = _columns(db, "negociacao7")
    if not cols:
        raise HTTPException(status_code=500, detail="Tabela negociacao7 não existe.")
    values = {
        "id_frete": frete_id,
        "id_motorista": motorista_id,
        "id_veiculo": veiculo_id,
        "preco_proposto": valor,
        "preco_original": valor,
        "distancia_km": _money(frete_map.get("distancia_km")),
        "volume_carga": max(_money(frete_map.get("volume_carga_total")), 0.0001),
        "peso_carga": max(_money(frete_map.get("peso_total_kg")), 0.01),
        "status": status,
        "observacoes": "Proposta gerada pelo app Movout",
    }
    insert_cols = [c for c in ["id_frete", "id_motorista", "id_veiculo", "preco_proposto", "preco_original", "distancia_km", "volume_carga", "peso_carga", "status", "observacoes"] if c in cols]
    required = {"id_frete", "id_motorista", "id_veiculo", "preco_proposto"}
    missing = required - set(insert_cols)
    if missing:
        raise HTTPException(status_code=500, detail=f"negociacao7 sem colunas obrigatórias: {', '.join(sorted(missing))}")
    if "id_veiculo" in insert_cols and veiculo_id is None:
        raise HTTPException(status_code=400, detail="Motorista não possui veículo cadastrado em veiculo7.")
    sql = f"INSERT INTO negociacao7 ({', '.join(insert_cols)}) VALUES ({', '.join(':' + c for c in insert_cols)})"
    result = db.execute(text(sql), {c: values[c] for c in insert_cols})
    return int(getattr(result, "lastrowid", None) or _scalar(db, "SELECT LAST_INSERT_ID()") or 0)





def _atribuir_motorista_ao_frete(db: Session, frete_id: int, motorista_id: int, veiculo_id: Optional[int], preco_final: float, id_negociacao: Optional[int] = None) -> dict[str, Any]:
    if not veiculo_id:
        veiculo_id = _veiculo_motorista(db, motorista_id)
    if not veiculo_id:
        raise HTTPException(status_code=400, detail="Motorista aceito não possui veículo cadastrado em veiculo7.")
    if _table_exists(db, "negociacao7"):
        if id_negociacao:
            db.execute(
                text("""
                UPDATE negociacao7
                SET status = CASE WHEN id_negociacao = :id_negociacao THEN 'ACEITA' ELSE 'RECUSADA' END
                WHERE id_frete = :frete_id AND status IN ('PENDENTE', 'ACEITA')
                """),
                {"id_negociacao": id_negociacao, "frete_id": frete_id},
            )
        else:
            db.execute(
                text("UPDATE negociacao7 SET status = 'RECUSADA' WHERE id_frete = :frete_id AND status = 'PENDENTE'"),
                {"frete_id": frete_id},
            )
    db.execute(
        text("""
        UPDATE frete7
        SET status = 'ACEITO', id_motorista = :id_motorista, id_veiculo = :id_veiculo, preco_fechado = :preco_fechado
        WHERE id_frete = :frete_id
        """),
        {"id_motorista": motorista_id, "id_veiculo": veiculo_id, "preco_fechado": preco_final, "frete_id": frete_id},
    )
    return {"frete_id": frete_id, "motorista_id": motorista_id, "id_veiculo": veiculo_id, "preco_fechado": preco_final}


def _ensure_pagamento(db: Session, frete_id: int) -> dict[str, Any]:
    row = _frete_row(db, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    fm = row._mapping
    valor = _money(fm.get("preco_fechado"), _money(fm.get("preco_estimado"), 0.0))
    id_cliente = fm.get("id_cliente")
    id_motorista = fm.get("id_motorista")
    if not id_motorista:
        raise HTTPException(status_code=400, detail="Frete ainda não possui motorista atribuído.")
    existing = db.execute(text("SELECT * FROM pagamento_frete7 WHERE id_frete = :id LIMIT 1"), {"id": frete_id}).first()
    if not existing:
        db.execute(text("""
            INSERT INTO pagamento_frete7 (id_frete, id_cliente, id_motorista, valor, status)
            VALUES (:id_frete, :id_cliente, :id_motorista, :valor, 'AGUARDANDO_LIBERACAO')
        """), {"id_frete": frete_id, "id_cliente": id_cliente, "id_motorista": id_motorista, "valor": valor})
        db.commit()
        existing = db.execute(text("SELECT * FROM pagamento_frete7 WHERE id_frete = :id LIMIT 1"), {"id": frete_id}).first()
    return dict(existing._mapping)


def _pagamento_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id_pagamento": int(row.get("id_pagamento")),
        "id_frete": int(row.get("id_frete")),
        "id_cliente": int(row["id_cliente"]) if row.get("id_cliente") else None,
        "id_motorista": int(row["id_motorista"]) if row.get("id_motorista") else None,
        "valor": float(row.get("valor") or 0),
        "status": row.get("status"),
        "criado_em": str(row.get("criado_em") or ""),
        "liberado_em": str(row.get("liberado_em") or ""),
        "confirmado_em": str(row.get("confirmado_em") or ""),
        "observacao": row.get("observacao"),
    }


def _pessoa_cliente(db: Session, frete_id: int) -> Optional[int]:
    return _scalar(db, """
        SELECT c.id_pessoa
        FROM frete7 f JOIN cliente7 c ON c.id_cliente = f.id_cliente
        WHERE f.id_frete = :id
        LIMIT 1
    """, {"id": frete_id})


def _pessoa_motorista(db: Session, motorista_id: Optional[int]) -> Optional[int]:
    if not motorista_id:
        return None
    return _scalar(db, "SELECT id_pessoa FROM motorista7 WHERE id_motorista = :id LIMIT 1", {"id": motorista_id})


def _avaliacoes_status(db: Session, frete_id: int) -> dict[str, bool]:
    tabela = "avaliacao_frete7" if _table_exists(db, "avaliacao_frete7") else "avaliacao7" if _table_exists(db, "avaliacao7") else None
    if not tabela:
        return {"cliente_avaliou": False, "motorista_avaliou": False}
    cliente_avaliou = bool(_scalar(db, f"SELECT COUNT(*) FROM {tabela} WHERE id_frete = :id AND tipo_avaliador = 'CLIENTE'", {"id": frete_id}))
    motorista_avaliou = bool(_scalar(db, f"SELECT COUNT(*) FROM {tabela} WHERE id_frete = :id AND tipo_avaliador = 'MOTORISTA'", {"id": frete_id}))
    return {"cliente_avaliou": cliente_avaliou, "motorista_avaliou": motorista_avaliou}


def _tentar_liberar_pagamento_pos_avaliacoes(db: Session, frete_id: int) -> dict[str, Any]:
    row = _frete_row(db, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    
    fm = row._mapping
    if not fm.get("id_motorista"):
        return {"liberado": False, "motivo": "Frete sem motorista atribuído."}
    
    avaliacao_status = _avaliacoes_status(db, frete_id)
    
    # A TRAVA DAS AVALIAÇÕES FOI REMOVIDA DAQUI
    
    pagamento = _ensure_pagamento(db, frete_id)
    if str(pagamento.get("status") or "").upper() in {"LIBERADO", "CONFIRMADO"}:
        return {"liberado": True, "motivo": "Pagamento já liberado.", "pagamento": _pagamento_payload(pagamento), **avaliacao_status}
    
    valor = float(pagamento.get("valor") or fm.get("preco_fechado") or fm.get("preco_estimado") or 0)
    id_motorista = int(fm.get("id_motorista"))
    
    db.execute(text("UPDATE frete7 SET status = 'CONCLUIDO' WHERE id_frete = :id"), {"id": frete_id})
    db.execute(text("""
        UPDATE pagamento_frete7
        SET status = 'LIBERADO', liberado_em = CURRENT_TIMESTAMP,
            observacao = 'Pagamento liberado automaticamente na conclusão da corrida.'
        WHERE id_frete = :id
    """), {"id": frete_id})
    
    db.execute(text("""
        INSERT INTO carteira_motorista7 (id_motorista, saldo_disponivel, saldo_pendente)
        VALUES (:id_motorista, :valor, 0)
        ON DUPLICATE KEY UPDATE saldo_disponivel = saldo_disponivel + :valor
    """), {"id_motorista": id_motorista, "valor": valor})
    
    pagamento = _ensure_pagamento(db, frete_id)
    return {"liberado": True, "valor": valor, "pagamento": _pagamento_payload(pagamento), **avaliacao_status}
@router.get("/calcular-preco")
def calcular_preco(
    distancia_km: float = Query(0.0),
    peso_kg: float = Query(50.0),
    prioridade: Optional[str] = Query("today"),
    fragil: bool = Query(False),
    session: Session = Depends(get_session),
):
    """Calcula o preco estimado sem criar o frete. Util para exibir na tela de solicitacao."""
    veiculos = ["CARRO", "VAN", "CAMINHAO"]
    resultado = {}
    for v in veiculos:
        calc = _calcular_preco_detalhado(session, distancia_km, peso_kg, v, prioridade, fragil)
        resultado[v.lower()] = {
            "tipo_veiculo": v,
            "preco_estimado": calc["preco_estimado"],
            "valor_base": calc["valor_base"],
            "valor_distancia": calc["valor_distancia"],
            "valor_peso": calc["valor_peso"],
            "valor_prioridade": calc["valor_prioridade"],
        }
    return resultado


@router.post("/")

def criar_frete(dados: FreteCreate, session: Session = Depends(get_session)):
    id_cliente = _cliente_id(session, dados)
    origem = (dados.origem or "Origem não informada")[:255]
    destino = (dados.destino or "Destino não informado")[:255]
    distancia = max(_money(dados.distancia_km), 0.0)
    peso = max(_money(dados.peso_estimado, 50.0), 0.01)
    volume = 0.0001
    prioridade = dados.prioridade_entrega or dados.prioridade
    calc = _calcular_preco_detalhado(session, distancia, peso, dados.tipo_veiculo, prioridade, dados.fragil)
    preco_estimado = calc["preco_estimado"]
    id_cartao, metodo_pgto, pgto_desc = _metodo_pagamento_info(dados.metodo_pagamento, dados.id_cartao_cliente)

    try:
        result = session.execute(
            text(
                """
                INSERT INTO frete7
                    (id_cliente, id_motorista, id_veiculo,
                     endereco_origem, latitude_origem, longitude_origem,
                     endereco_destino, latitude_destino, longitude_destino,
                     distancia_km, peso_total_kg, volume_carga_total,
                     preco_estimado, preco_fechado, status,
                     id_cartao_cliente, metodo_pagamento, pagamento_descricao,
                     prioridade_entrega, data_agendada, tipo_veiculo_solicitado,
                     peso_estimado_kg, valor_base, valor_distancia, valor_peso,
                     valor_veiculo, valor_prioridade, valor_total_calculado)
                VALUES
                    (:id_cliente, NULL, NULL,
                     :origem, :origem_lat, :origem_lng,
                     :destino, :destino_lat, :destino_lng,
                     :distancia, :peso, :volume,
                     :preco_estimado, NULL, 'PENDENTE',
                     :id_cartao_cliente, :metodo_pagamento, :pagamento_descricao,
                     :prioridade_entrega, :data_agendada, :tipo_veiculo_solicitado,
                     :peso_estimado_kg, :valor_base, :valor_distancia, :valor_peso,
                     :valor_veiculo, :valor_prioridade, :valor_total_calculado)
                """
            ),
            {
                "id_cliente": id_cliente,
                "origem": origem,
                "origem_lat": dados.origem_lat or 0,
                "origem_lng": dados.origem_lng or 0,
                "destino": destino,
                "destino_lat": dados.destino_lat or 0,
                "destino_lng": dados.destino_lng or 0,
                "distancia": distancia,
                "peso": peso,
                "volume": volume,
                "preco_estimado": preco_estimado,
                "id_cartao_cliente": id_cartao,
                "metodo_pagamento": metodo_pgto,
                "pagamento_descricao": pgto_desc,
                "prioridade_entrega": calc["prioridade"],
                "data_agendada": dados.data_agendada,
                "tipo_veiculo_solicitado": calc["tipo_veiculo"],
                "peso_estimado_kg": peso,
                "valor_base": calc["valor_base"],
                "valor_distancia": calc["valor_distancia"],
                "valor_peso": calc["valor_peso"],
                "valor_veiculo": calc["valor_veiculo"],
                "valor_prioridade": calc["valor_prioridade"],
                "valor_total_calculado": calc["valor_total_calculado"],
            },
        )
        session.commit()
        new_id = int(getattr(result, "lastrowid", None) or _scalar(session, "SELECT LAST_INSERT_ID()"))
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao criar frete: {exc}") from exc

    row = _frete_row(session, new_id)
    return _frete_payload(row, [])


@router.get("/")
def listar_fretes(status: Optional[str] = Query(None), session: Session = Depends(get_session)):
    """Lista fretes para o motorista. Por padrão retorna apenas PENDENTE como disponível."""
    where = "f.status = 'PENDENTE'" if status is None else "1=1"
    rows = _rows(
        session,
        f"""
        SELECT
            f.id_frete, f.id_cliente, f.id_motorista, f.id_veiculo,
            f.endereco_origem, f.latitude_origem, f.longitude_origem,
            f.endereco_destino, f.latitude_destino, f.longitude_destino,
            f.distancia_km, f.peso_total_kg, f.volume_carga_total,
            f.preco_estimado, f.preco_fechado, f.status,
            pm.nome AS motorista_nome, pm.telefone AS motorista_telefone,
            m.avaliacao_media AS motorista_avaliacao,
            v.tipo AS veiculo_tipo, v.marca AS veiculo_marca, v.modelo AS veiculo_modelo, v.placa AS veiculo_placa,
            pc.nome AS cliente_nome, pc.email AS cliente_email
        FROM frete7 f
        JOIN cliente7 c ON c.id_cliente = f.id_cliente
        JOIN pessoa7 pc ON pc.id_pessoa = c.id_pessoa
        LEFT JOIN motorista7 m ON m.id_motorista = f.id_motorista
        LEFT JOIN pessoa7 pm ON pm.id_pessoa = m.id_pessoa
        LEFT JOIN veiculo7 v ON v.id_veiculo = f.id_veiculo
        WHERE {where}
        ORDER BY f.id_frete DESC
        """,
    )
    return [_frete_payload(row, []) for row in rows]


@router.get("/{frete_id}")
def obter_frete(frete_id: int, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    return _frete_payload(row, _proposal_rows(session, frete_id))


@router.post("/{frete_id}/proposta")
def enviar_proposta(frete_id: int, dados: PropostaFreteCreate, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    fm = row._mapping
    status = str(fm.get("status") or "").upper()
    if status in {"ACEITO", "EM_TRANSITO", "CONCLUIDO"}:
        raise HTTPException(status_code=409, detail="Frete já foi aceito e não recebe novas propostas.")

    motorista_id = _resolve_motorista_id(session, dados.motorista_id)
    veiculo_id = _veiculo_motorista(session, motorista_id)

    try:
        if _table_exists(session, "negociacao7"):
            session.execute(
                text(
                    """
                    UPDATE negociacao7 
                    SET status = 'CANCELADA' 
                    WHERE id_frete = :frete_id 
                      AND id_motorista = :motorista_id 
                      AND status = 'PENDENTE'
                    """
                ),
                {"frete_id": frete_id, "motorista_id": motorista_id},
            )
        id_negociacao = _insert_negociacao(session, frete_id, motorista_id, veiculo_id, float(dados.valor), fm, "PENDENTE")
        session.execute(text("UPDATE frete7 SET status = 'NEGOCIANDO' WHERE id_frete = :id AND status = 'PENDENTE'"), {"id": frete_id})
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao enviar proposta: {exc}") from exc

    return {
        "status": "proposta_enviada",
        "id_negociacao": id_negociacao,
        "frete_id": frete_id,
        "motorista_id": motorista_id,
        "id_veiculo": veiculo_id,
        "propostas_atuais": len(_proposal_rows(session, frete_id)),
    }




@router.post("/{frete_id}/motorista-aceitar")
def motorista_aceitar_valor_cliente(frete_id: int, motorista_id: Optional[int] = None, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    fm = row._mapping
    status = str(fm.get("status") or "PENDENTE").upper()
    if status in {"ACEITO", "EM_TRANSITO", "AGUARDANDO_CONFIRMACAO", "CONCLUIDO"}:
        raise HTTPException(status_code=409, detail="Frete já não está disponível para aceite direto.")
    motorista_final = _resolve_motorista_id(session, motorista_id)
    veiculo_final = _veiculo_motorista(session, motorista_final)
    preco_final = _money(fm.get("preco_estimado"), 20.0)
    try:
        id_neg = None
        if _table_exists(session, "negociacao7"):
            id_neg = _insert_negociacao(session, frete_id, motorista_final, veiculo_final, preco_final, fm, "ACEITA")
        payload = _atribuir_motorista_ao_frete(session, frete_id, motorista_final, veiculo_final, preco_final, id_neg)
        session.commit()
        # --- DISPARO DE WEBSOCKET (CORREÇÃO B-3) ---
        ws_payload = {
            "tipo": "FRETE_ACEITO", 
            "frete_id": frete_id, 
            "frete": payload, 
            "motorista": payload.get("motorista")
        }
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.send_location(frete_id, ws_payload))
        except RuntimeError:
            asyncio.run(manager.send_location(frete_id, ws_payload))
        # ------------------------------------------
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao aceitar frete: {exc}") from exc
    row = _frete_row(session, frete_id)
    return {"status": "frete_aceito_pelo_motorista", "novo_status": "aceito", **payload, "frete": _frete_payload(row, _proposal_rows(session, frete_id))}

@router.get("/{frete_id}/propostas")
def listar_propostas(frete_id: int, session: Session = Depends(get_session)):
    if not _frete_exists(session, frete_id):
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    return _proposal_rows(session, frete_id)


@router.post("/{frete_id}/aceitar-proposta")
def aceitar_proposta(frete_id: int, motorista_id: Optional[int] = None, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")

    requested_motorista = _resolve_motorista_id(session, motorista_id)

    proposta = db_proposta = None
    if _table_exists(session, "negociacao7"):
        db_proposta = session.execute(
            text(
                """
                SELECT id_negociacao, id_motorista, id_veiculo, preco_proposto
                FROM negociacao7
                WHERE id_frete = :frete_id
                  AND id_motorista = :motorista_id
                  AND status IN ('PENDENTE', 'ACEITA')
                ORDER BY id_negociacao DESC
                LIMIT 1
                """
            ),
            {"frete_id": frete_id, "motorista_id": requested_motorista},
        ).first()
        if not db_proposta:
            db_proposta = session.execute(
                text(
                    """
                    SELECT id_negociacao, id_motorista, id_veiculo, preco_proposto
                    FROM negociacao7
                    WHERE id_frete = :frete_id
                      AND status IN ('PENDENTE', 'ACEITA')
                    ORDER BY id_negociacao DESC
                    LIMIT 1
                    """
                ),
                {"frete_id": frete_id},
            ).first()

    if db_proposta:
        proposta = db_proposta._mapping
        motorista_final = int(proposta["id_motorista"])
        veiculo_final = int(proposta["id_veiculo"]) if proposta.get("id_veiculo") else _veiculo_motorista(session, motorista_final)
        preco_final = _money(proposta.get("preco_proposto"), _money(row._mapping.get("preco_estimado")))
        id_negociacao = int(proposta["id_negociacao"])
    else:
        motorista_final = requested_motorista
        veiculo_final = _veiculo_motorista(session, motorista_final)
        preco_final = _money(row._mapping.get("preco_estimado"), 20.0)
        id_negociacao = None
        if _table_exists(session, "negociacao7"):
            id_negociacao = _insert_negociacao(session, frete_id, motorista_final, veiculo_final, preco_final, row._mapping, "ACEITA")

    if not veiculo_final:
        raise HTTPException(status_code=400, detail="Motorista aceito não possui veículo cadastrado em veiculo7.")

    try:
        if _table_exists(session, "negociacao7"):
            session.execute(
                text(
                    """
                    UPDATE negociacao7
                    SET status = CASE WHEN id_negociacao = :id_negociacao THEN 'ACEITA' ELSE 'RECUSADA' END
                    WHERE id_frete = :frete_id
                      AND status IN ('PENDENTE', 'ACEITA')
                    """
                ),
                {"id_negociacao": id_negociacao, "frete_id": frete_id},
            )
        session.execute(
            text(
                """
                UPDATE frete7
                SET status = 'ACEITO',
                    id_motorista = :id_motorista,
                    id_veiculo = :id_veiculo,
                    preco_fechado = :preco_fechado
                WHERE id_frete = :frete_id
                """
            ),
            {
                "id_motorista": motorista_final,
                "id_veiculo": veiculo_final,
                "preco_fechado": preco_final,
                "frete_id": frete_id,
            },
        )
        _update_legacy_if_exists(session, "pedidofrete", "id", frete_id, {"status": "aceito", "motorista_id": motorista_final, "preco_fechado": preco_final, "preco": preco_final})
        _update_legacy_if_exists(session, "propostafrete", "frete_id", frete_id, {"status": "aceita"})
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao aceitar proposta: {exc}") from exc

    confirmed = _frete_row(session, frete_id)
    payload = _frete_payload(confirmed, _proposal_rows(session, frete_id))
    if payload.get("status") != "aceito" or int(payload.get("id_motorista") or 0) != motorista_final:
        raise HTTPException(status_code=500, detail="Falha ao atribuir motorista ao frete.")

    try:
        import asyncio
        ws_payload = {"tipo": "FRETE_ACEITO", "frete_id": frete_id, "frete": payload, "motorista": payload.get("motorista")}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.send_location(frete_id, ws_payload))
        except RuntimeError:
            asyncio.run(manager.send_location(frete_id, ws_payload))
    except Exception:
        pass

    return {
        "status": "sucesso",
        "frete_id": frete_id,
        "novo_status": "aceito",
        "id_motorista": motorista_final,
        "id_veiculo": veiculo_final,
        "preco_fechado": preco_final,
        "motorista": payload.get("motorista"),
        "frete": payload,
    }



# @router.post("/{frete_id}/contraproposta")
# def cliente_contraproposta(frete_id: int, dados: ContrapropostaCliente, session: Session = Depends(get_session)):
#     """Cliente envia uma contraproposta ao motorista."""
#     row = _frete_row(session, frete_id)
#     if not row:
#         raise HTTPException(status_code=404, detail="Frete não encontrado")
#     fm = row._mapping
#     status = str(fm.get("status") or "").upper()
#     if status in {"ACEITO", "EM_TRANSITO", "CONCLUIDO", "CANCELADO"}:
#         raise HTTPException(status_code=409, detail="Frete não está em negociação.")
#     if dados.valor <= 0:
#         raise HTTPException(status_code=400, detail="Valor da contraproposta deve ser maior que zero.")
#     try:
#         # Atualiza o preço estimado do frete com o valor da contraproposta do cliente
#         session.execute(
#             text("UPDATE frete7 SET preco_estimado = :valor, status = 'NEGOCIANDO' WHERE id_frete = :id"),
#             {"valor": dados.valor, "id": frete_id},
#         )
#         # Atualiza a negociação pendente se existir
#         if _table_exists(session, "negociacao7"):
#             if dados.id_negociacao:
#                 session.execute(
#                     text("""
#                     UPDATE negociacao7
#                     SET preco_proposto = :valor, status = 'PENDENTE'
#                     WHERE id_negociacao = :id_neg AND id_frete = :id_frete
#                     """),
#                     {"valor": dados.valor, "id_neg": dados.id_negociacao, "id_frete": frete_id},
#                 )
#             else:
#                 # Cria nova entrada de contraproposta
#                 motorista_id = dados.motorista_id or fm.get("id_motorista")
#                 if motorista_id:
#                     veiculo_id = _veiculo_motorista(session, int(motorista_id))
#                     _insert_negociacao(session, frete_id, int(motorista_id), veiculo_id, dados.valor, fm, "PENDENTE")
#         session.commit()
#     except HTTPException:
#         session.rollback()
#         raise
#     except Exception as exc:
#         session.rollback()
#         raise HTTPException(status_code=500, detail=f"Erro ao enviar contraproposta: {exc}") from exc

#     # Notifica o motorista via WebSocket
#     try:
#         import asyncio
#         ws_payload = {"tipo": "CONTRAPROPOSTA_CLIENTE", "frete_id": frete_id, "valor": dados.valor}
#         try:
#             loop = asyncio.get_running_loop()
#             loop.create_task(manager.send_location(frete_id, ws_payload))
#         except RuntimeError:
#             asyncio.run(manager.send_location(frete_id, ws_payload))
#     except Exception:
#         pass

#     row = _frete_row(session, frete_id)
#     return {
#         "status": "contraproposta_enviada",
#         "frete_id": frete_id,
#         "novo_valor_estimado": dados.valor,
#         "frete": _frete_payload(row, _proposal_rows(session, frete_id)),
#     }


@router.post("/{frete_id}/contraproposta")
def cliente_contraproposta(frete_id: int, dados: ContrapropostaCliente, session: Session = Depends(get_session)):
    """Cliente envia uma contraproposta ao motorista."""
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    
    fm = row._mapping
    status = str(fm.get("status") or "").upper()
    
    if status in {"ACEITO", "EM_TRANSITO", "CONCLUIDO", "CANCELADO"}:
        raise HTTPException(status_code=409, detail="Frete não está em negociação.")
    if dados.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor da contraproposta deve ser maior que zero.")
    
    try:
        # CORREÇÃO B-2: Atualiza APENAS o status. O preco_estimado original fica intacto!
        session.execute(
            text("UPDATE frete7 SET status = 'NEGOCIANDO' WHERE id_frete = :id"),
            {"id": frete_id},
        )
        
        # Atualiza a negociação pendente se existir (aqui sim o valor da contraproposta é salvo)
        if _table_exists(session, "negociacao7"):
            if dados.id_negociacao:
                session.execute(
                    text("""
                    UPDATE negociacao7
                    SET preco_proposto = :valor, status = 'PENDENTE'
                    WHERE id_negociacao = :id_neg AND id_frete = :id_frete
                    """),
                    {"valor": dados.valor, "id_neg": dados.id_negociacao, "id_frete": frete_id},
                )
            else:
                # Cria nova entrada de contraproposta
                motorista_id = dados.motorista_id or fm.get("id_motorista")
                if motorista_id:
                    veiculo_id = _veiculo_motorista(session, int(motorista_id))
                    _insert_negociacao(session, frete_id, int(motorista_id), veiculo_id, dados.valor, fm, "PENDENTE")
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao enviar contraproposta: {exc}") from exc

    # Notifica o motorista via WebSocket
    try:
        import asyncio
        ws_payload = {"tipo": "CONTRAPROPOSTA_CLIENTE", "frete_id": frete_id, "valor": dados.valor}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.send_location(frete_id, ws_payload))
        except RuntimeError:
            asyncio.run(manager.send_location(frete_id, ws_payload))
    except Exception:
        pass

    row = _frete_row(session, frete_id)
    return {
        "status": "contraproposta_enviada",
        "frete_id": frete_id,
        "valor_contraproposta": dados.valor,
        "frete": _frete_payload(row, _proposal_rows(session, frete_id)),
    }

@router.post("/{frete_id}/cancelar")
def cancelar_frete(frete_id: int, session: Session = Depends(get_session)):
    if not _frete_exists(session, frete_id):
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    session.execute(text("UPDATE frete7 SET status = 'CANCELADO' WHERE id_frete = :id"), {"id": frete_id})
    session.commit()

    # Notifica o motorista via WebSocket
    try:
        import asyncio
        ws_payload = {"tipo": "FRETE_CANCELADO", "frete_id": frete_id}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.send_location(frete_id, ws_payload))
        except RuntimeError:
            asyncio.run(manager.send_location(frete_id, ws_payload))
    except Exception:
        pass

    return {"status": "cancelado", "frete_id": frete_id, "novo_status": "cancelado"}

# @router.post("/{frete_id}/motorista-desistir")
# def motorista_desistir(frete_id: int, session: Session = Depends(get_session)):
#     row = _frete_row(session, frete_id)
#     if not row:
#         raise HTTPException(status_code=404, detail="Frete não encontrado")
    
#     # Limpa dados do motorista no frete e volta para PENDENTE
#     session.execute(
#         text(
#             """
#             UPDATE frete7 
#             SET status = 'PENDENTE', 
#                 id_motorista = NULL, 
#                 id_veiculo = NULL, 
#                 preco_fechado = NULL,
#                 motorista_confirmou_conclusao = 0,
#                 cliente_confirmou_conclusao = 0,
#                 concluido_em = NULL
#             WHERE id_frete = :id
#             """
#         ),
#         {"id": frete_id},
#     )
    
#     # Cancela negociação ativa
#     if _table_exists(session, "negociacao7"):
#         session.execute(
#             text("UPDATE negociacao7 SET status = 'CANCELADA' WHERE id_frete = :id AND status = 'ACEITA'"),
#             {"id": frete_id},
#         )
        
#     session.commit()

#     # Notifica o cliente via WebSocket
#     try:
#         import asyncio
#         ws_payload = {"tipo": "MOTORISTA_DESISTIU", "frete_id": frete_id}
#         try:
#             loop = asyncio.get_running_loop()
#             loop.create_task(manager.send_location(frete_id, ws_payload))
#         except RuntimeError:
#             asyncio.run(manager.send_location(frete_id, ws_payload))
#     except Exception:
#         pass

#     return {"status": "motorista_desistiu", "frete_id": frete_id, "novo_status": "PENDENTE"}

@router.post("/{frete_id}/motorista-desistir")
def motorista_desistir(frete_id: int, motorista_id: Optional[int] = None, session: Session = Depends(get_session)):
    """Motorista abandona a corrida após ter aceitado, voltando o frete para PENDENTE e limpando todo o histórico da negociação ativa."""
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")

    fm = row._mapping
    status_atual = str(fm.get("status") or "").upper()

    if status_atual not in ['ACEITO', 'EM_TRANSITO']:
        raise HTTPException(
            status_code=400, 
            detail=f"Não é possível desistir de um frete no status atual: {status_atual}"
        )

    motorista_db = fm.get("id_motorista")
    if motorista_db and motorista_id and str(motorista_db) != str(motorista_id):
        raise HTTPException(status_code=403, detail="Este frete está atribuído a outro motorista.")

    try:
        # Reset completo de todos os campos de conclusão e amarração
        session.execute(
            text("""
                UPDATE frete7 
                SET status = 'PENDENTE', 
                    id_motorista = NULL, 
                    id_veiculo = NULL, 
                    preco_fechado = NULL,
                    motorista_confirmou_conclusao = 0,
                    cliente_confirmou_conclusao = 0,
                    concluido_em = NULL
                WHERE id_frete = :id
            """),
            {"id": frete_id},
        )
        
        # Cancela qualquer negociação que estava amarrada a esse aceite
        if _table_exists(session, "negociacao7"):
            session.execute(
                text("UPDATE negociacao7 SET status = 'CANCELADA' WHERE id_frete = :id_frete AND status = 'ACEITA'"),
                {"id_frete": frete_id}
            )
            
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao registrar desistência: {exc}") from exc

    try:
        import asyncio
        ws_payload = {"tipo": "MOTORISTA_DESISTIU", "frete_id": frete_id}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.send_location(frete_id, ws_payload))
        except RuntimeError:
            asyncio.run(manager.send_location(frete_id, ws_payload))
    except Exception:
        pass

    return {
        "status": "desistencia_concluida", 
        "frete_id": frete_id, 
        "novo_status": "PENDENTE"
    }

@router.post("/{frete_id}/motorista-cancelar-proposta")
def motorista_cancelar_proposta(frete_id: int, motorista_id: int, session: Session = Depends(get_session)):
    if _table_exists(session, "negociacao7"):
        session.execute(
            text(
                """
                UPDATE negociacao7 
                SET status = 'CANCELADA' 
                WHERE id_frete = :frete_id 
                  AND id_motorista = :motorista_id 
                  AND status = 'PENDENTE'
                """
            ),
            {"frete_id": frete_id, "motorista_id": motorista_id},
        )
        session.commit()

        # Notifica o cliente via WebSocket para atualizar a lista
        try:
            import asyncio
            ws_payload = {"tipo": "PROPOSTA_MOTORISTA_CANCELADA", "frete_id": frete_id, "motorista_id": motorista_id}
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.send_location(frete_id, ws_payload))
            except RuntimeError:
                asyncio.run(manager.send_location(frete_id, ws_payload))
        except Exception:
            pass

    return {"status": "proposta_cancelada"}


@router.post("/{frete_id}/match")
def match_frete(frete_id: int, session: Session = Depends(get_session)):
    motorista_id = _resolve_motorista_id(session, None)
    return aceitar_proposta(frete_id, motorista_id, session)



@router.post("/{frete_id}/iniciar")
def iniciar_frete(frete_id: int, session: Session = Depends(get_session)):
    if not _frete_exists(session, frete_id):
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    session.execute(text("UPDATE frete7 SET status = 'EM_TRANSITO' WHERE id_frete = :id AND id_motorista IS NOT NULL"), {"id": frete_id})
    session.commit()
    return {"status": "em_transito", "frete_id": frete_id}


@router.post("/{frete_id}/chegou-destino")
def chegou_destino(frete_id: int, dados: OperacaoPagamento = OperacaoPagamento(), session: Session = Depends(get_session)):
    pagamento = _ensure_pagamento(session, frete_id)
    session.execute(text("UPDATE pagamento_frete7 SET status = 'AGUARDANDO_LIBERACAO', observacao = :obs WHERE id_frete = :id"), {"id": frete_id, "obs": dados.observacao or "Motorista informou chegada ao destino"})
    session.commit()
    pagamento = _ensure_pagamento(session, frete_id)
    return {"status": "aguardando_liberacao_cliente", "frete_id": frete_id, "pagamento": _pagamento_payload(pagamento)}


@router.post("/{frete_id}/motorista-concluir")
def motorista_marcar_corrida_concluida(frete_id: int, motorista_id: Optional[int] = None, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    
    fm = row._mapping
    
    # --- BLOCO DE VERIFICAÇÃO DE STATUS FLEXIBILIZADO (B-5) ---
    # Aceita se esqueceu de iniciar (ACEITO), se está rodando (EM_TRANSITO) 
    # ou se a outra ponta já apertou concluir antes (CONCLUIDO).
    status_atual = fm.get("status")
    if status_atual not in ['ACEITO', 'EM_TRANSITO', 'CONCLUIDO']:
        raise HTTPException(
            status_code=400, 
            detail=f"Operação inválida. O frete não pode ser concluído no status atual: {status_atual}"
        )
    # -----------------------------------------------------------

    motorista_final = _resolve_motorista_id(session, motorista_id or fm.get("id_motorista"))
    if not fm.get("id_motorista") or int(fm.get("id_motorista")) != motorista_final:
        raise HTTPException(status_code=403, detail="Este frete não está atribuído a esse motorista.")
    
    try:
        session.execute(
            text("UPDATE frete7 SET status = 'CONCLUIDO', motorista_confirmou_conclusao = 1, concluido_em = COALESCE(concluido_em, CURRENT_TIMESTAMP) WHERE id_frete = :id"),
            {"id": frete_id},
        )
        pagamento = _ensure_pagamento(session, frete_id)
        
        # Só marcamos como aguardando confirmação se o pagamento ainda não foi liberado
        if str(pagamento.get("status") or "").upper() not in {"LIBERADO", "CONFIRMADO"}:
            session.execute(
                text("UPDATE pagamento_frete7 SET status = 'AGUARDANDO_CONFIRMACAO', observacao = :obs WHERE id_frete = :id"),
                {"id": frete_id, "obs": "Motorista informou que a corrida foi concluída."},
            )
            
        session.commit()

        # Notifica o cliente via WebSocket sobre a conclusão
        try:
            import asyncio
            ws_payload = {"tipo": "FRETE_CONCLUIDO", "status": "concluido", "frete_id": frete_id}
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.send_location(frete_id, ws_payload))
            except RuntimeError:
                asyncio.run(manager.send_location(frete_id, ws_payload))
        except Exception:
            pass
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao marcar corrida concluída: {exc}") from exc
        
    return {"status": "concluido_pelo_motorista", "novo_status": "concluido", "frete_id": frete_id, "pagamento": _ensure_pagamento(session, frete_id)}

@router.post("/{frete_id}/cliente-confirmar-conclusao")
def cliente_confirmar_conclusao(frete_id: int, dados: OperacaoPagamento = OperacaoPagamento(), session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    
    fm = row._mapping

    # --- VERIFICAÇÃO DE STATUS FLEXÍVEL (B-5 Aplicado ao Cliente) ---
    status_atual = fm.get("status")
    if status_atual not in ['ACEITO', 'EM_TRANSITO', 'CONCLUIDO']:
        raise HTTPException(
            status_code=400, 
            detail=f"Operação inválida. O frete não pode ser concluído no status atual: {status_atual}"
        )
    # ----------------------------------------------------------------

    if not fm.get("id_motorista"):
        raise HTTPException(status_code=400, detail="Frete sem motorista atribuído.")
    
    try:
        _ensure_pagamento(session, frete_id)
        
        session.execute(text("""
            UPDATE frete7
            SET status = 'CONCLUIDO', 
                cliente_confirmou_conclusao = 1, 
                concluido_em = COALESCE(concluido_em, CURRENT_TIMESTAMP)
            WHERE id_frete = :id
        """), {"id": frete_id})
        
        resultado = _tentar_liberar_pagamento_pos_avaliacoes(session, frete_id)
        session.commit()
        
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao confirmar conclusão: {exc}") from exc
        
    return {
        "status": "concluido", 
        "novo_status": "concluido", 
        "frete_id": frete_id, 
        "resultado_pagamento": resultado
    }

    
@router.get("/{frete_id}/pagamento")
def obter_pagamento(frete_id: int, session: Session = Depends(get_session)):
    pagamento = _ensure_pagamento(session, frete_id)
    return _pagamento_payload(pagamento)


@router.post("/{frete_id}/liberar-pagamento")
def liberar_pagamento(frete_id: int, dados: OperacaoPagamento = OperacaoPagamento(), session: Session = Depends(get_session)):
    # Nesta versão de teste, o pagamento só é liberado quando cliente e motorista avaliarem.
    try:
        _ensure_pagamento(session, frete_id)
        resultado = _tentar_liberar_pagamento_pos_avaliacoes(session, frete_id)
        if not resultado.get("liberado"):
            session.execute(text("UPDATE pagamento_frete7 SET status = 'AGUARDANDO_AVALIACOES', observacao = :obs WHERE id_frete = :id"), {
                "id": frete_id,
                "obs": dados.observacao or "Aguardando avaliação do cliente e do motorista para liberar o pagamento.",
            })
        session.commit()
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao liberar pagamento: {exc}") from exc
    pagamento = _ensure_pagamento(session, frete_id)
    return {"status": "pagamento_liberado" if resultado.get("liberado") else "aguardando_avaliacoes", "frete_id": frete_id, "resultado_pagamento": resultado, "pagamento": _pagamento_payload(pagamento)}

@router.post("/{frete_id}/confirmar-pagamento")
def confirmar_pagamento(frete_id: int, session: Session = Depends(get_session)):
    pagamento = _ensure_pagamento(session, frete_id)
    session.execute(text("UPDATE pagamento_frete7 SET status = 'CONFIRMADO', confirmado_em = CURRENT_TIMESTAMP WHERE id_frete = :id"), {"id": frete_id})
    session.commit()
    pagamento = _ensure_pagamento(session, frete_id)
    return {"status": "pagamento_confirmado", "frete_id": frete_id, "pagamento": _pagamento_payload(pagamento)}


@router.post("/{frete_id}/avaliar")
def avaliar_frete(frete_id: int, dados: AvaliacaoCreate, session: Session = Depends(get_session)):
    row = _frete_row(session, frete_id)
    if not row:
        raise HTTPException(status_code=404, detail="Frete não encontrado")
    nota = max(1, min(5, int(dados.nota)))
    fm = row._mapping
    tipo_avaliador = str(dados.tipo_avaliador or "CLIENTE").upper()
    tipo_avaliado = str(dados.tipo_avaliado or ("MOTORISTA" if tipo_avaliador == "CLIENTE" else "CLIENTE")).upper()
    if tipo_avaliador not in {"CLIENTE", "MOTORISTA"}:
        raise HTTPException(status_code=400, detail="tipo_avaliador deve ser CLIENTE ou MOTORISTA")
    if tipo_avaliado not in {"CLIENTE", "MOTORISTA"}:
        raise HTTPException(status_code=400, detail="tipo_avaliado deve ser CLIENTE ou MOTORISTA")
    avaliador_pessoa = _pessoa_cliente(session, frete_id) if tipo_avaliador == "CLIENTE" else _pessoa_motorista(session, dados.motorista_id or fm.get("id_motorista"))
    avaliado_pessoa = _pessoa_cliente(session, frete_id) if tipo_avaliado == "CLIENTE" else _pessoa_motorista(session, dados.motorista_id or fm.get("id_motorista"))
    if not avaliador_pessoa or not avaliado_pessoa:
        raise HTTPException(status_code=400, detail="Não foi possível identificar avaliador ou avaliado.")
    try:
        tabela = "avaliacao_frete7" if _table_exists(session, "avaliacao_frete7") else "avaliacao7"
        ja_avaliou = _scalar(session, f"SELECT COUNT(*) FROM {tabela} WHERE id_frete = :id AND tipo_avaliador = :tipo", {"id": frete_id, "tipo": tipo_avaliador})
        if ja_avaliou:
            raise HTTPException(status_code=409, detail="Este usuário já avaliou este frete. Só é permitido avaliar uma vez.")
        if tabela == "avaliacao_frete7":
            session.execute(text("""
                INSERT INTO avaliacao_frete7
                    (id_frete, tipo_avaliador, id_avaliador_pessoa, id_avaliado_pessoa, nota, comentario)
                VALUES
                    (:id_frete, :tipo_avaliador, :id_avaliador_pessoa, :id_avaliado_pessoa, :nota, :comentario)
            """), {
                "id_frete": frete_id,
                "tipo_avaliador": tipo_avaliador,
                "id_avaliador_pessoa": avaliador_pessoa,
                "id_avaliado_pessoa": avaliado_pessoa,
                "nota": nota,
                "comentario": dados.comentario or "",
            })
        else:
            session.execute(text("""
                INSERT INTO avaliacao7
                    (id_frete, id_avaliador_pessoa, tipo_avaliador, id_avaliado_pessoa, tipo_avaliado, nota, comentario)
                VALUES
                    (:id_frete, :id_avaliador_pessoa, :tipo_avaliador, :id_avaliado_pessoa, :tipo_avaliado, :nota, :comentario)
            """), {
                "id_frete": frete_id,
                "id_avaliador_pessoa": avaliador_pessoa,
                "tipo_avaliador": tipo_avaliador,
                "id_avaliado_pessoa": avaliado_pessoa,
                "tipo_avaliado": tipo_avaliado,
                "nota": nota,
                "comentario": dados.comentario or "",
            })
        if tipo_avaliado == "MOTORISTA" and fm.get("id_motorista"):
            tabela_media = "avaliacao_frete7" if _table_exists(session, "avaliacao_frete7") else "avaliacao7"
            session.execute(text(f"""
                UPDATE motorista7 m
                SET avaliacao_media = (
                    SELECT ROUND(AVG(nota), 2)
                    FROM {tabela_media} a
                    JOIN pessoa7 p ON p.id_pessoa = a.id_avaliado_pessoa
                    JOIN motorista7 mx ON mx.id_pessoa = p.id_pessoa
                    WHERE mx.id_motorista = :id_motorista
                )
                WHERE m.id_motorista = :id_motorista
            """), {"id_motorista": fm.get("id_motorista")})
        resultado_pagamento = _tentar_liberar_pagamento_pos_avaliacoes(session, frete_id)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao salvar avaliação: {exc}") from exc
    return {"status": "avaliacao_salva", "frete_id": frete_id, "nota": nota, "resultado_pagamento": resultado_pagamento}

@router.post("/detectar-objeto")
def post_detectar_objeto(file: UploadFile = File(...), frete_id: Optional[int] = None):
    import asyncio
    import logging

    logger = logging.getLogger("uvicorn.error")
    logger.info(f"--- [ENDPOINT] Recebida solicitação de detecção (frete_id: {frete_id}) ---")
    try:
        objeto_identificado = call_ai_service(file)
        if frete_id:
            try:
                payload = {"tipo": "DETECCAO_OBJETO", "objeto": objeto_identificado}
                try:
                    loop = asyncio.get_running_loop()
                    loop.create_task(manager.send_location(frete_id, payload))
                except RuntimeError:
                    asyncio.run(manager.send_location(frete_id, payload))
            except Exception as ws_err:
                logger.error(f"Erro ao enviar WebSocket: {ws_err}")
        return {"status": "sucesso", "objeto": objeto_identificado}
    except Exception as exc:
        logger.error(f"--- [ENDPOINT] Erro: {str(exc)} ---")
        raise HTTPException(status_code=500, detail=str(exc))
