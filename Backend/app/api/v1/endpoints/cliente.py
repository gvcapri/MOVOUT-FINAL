from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy import text
from sqlmodel import Session

from app.db.database import get_session

router = APIRouter()

class CartaoClienteCreate(BaseModel):
    apelido: Optional[str] = None
    titular: Optional[str] = None
    bandeira: Optional[str] = None
    ultimos4: Optional[str] = None
    numero_cartao: Optional[str] = None
    mes_expiracao: Optional[int] = None
    ano_expiracao: Optional[int] = None
    principal: bool = False

class PerfilUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    cpf: Optional[str] = None
    telefone: Optional[str] = None
    cnh: Optional[str] = None



def _cliente_by_email(db: Session, email: str):
    return db.execute(
        text(
            """
            SELECT c.id_cliente, p.id_pessoa, p.nome, p.email, p.cpf, p.telefone
            FROM cliente7 c
            JOIN pessoa7 p ON p.id_pessoa = c.id_pessoa
            WHERE p.email = :email
            LIMIT 1
            """
        ),
        {"email": email},
    ).first()


@router.get("/me")
def obter_usuario(email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        # Também permite consultar motorista/pessoa por e-mail para perfil simples.
        pessoa = db.execute(
            text("SELECT id_pessoa, nome, email, cpf, telefone FROM pessoa7 WHERE email = :email LIMIT 1"),
            {"email": email},
        ).first()
        if not pessoa:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        p = pessoa._mapping
        return {
            "id_pessoa": int(p["id_pessoa"]),
            "nome": p["nome"],
            "email": p["email"],
            "cpf": p.get("cpf"),
            "telefone": p.get("telefone"),
        }
    m = row._mapping
    return {
        "id_cliente": int(m["id_cliente"]),
        "id_pessoa": int(m["id_pessoa"]),
        "nome": m["nome"],
        "email": m["email"],
        "cpf": m.get("cpf"),
        "telefone": m.get("telefone"),
    }


@router.get("/me/historico")
def obter_historico(email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])
    rows = db.execute(
        text(
            """
            SELECT
                f.id_frete, f.endereco_origem, f.endereco_destino,
                f.preco_estimado, f.preco_fechado, f.status,
                f.id_motorista, f.id_veiculo,
                pc.nome AS cliente_nome,
                pc.email AS cliente_email,
                pm.nome AS motorista_nome,
                pm.telefone AS motorista_telefone,
                m.avaliacao_media,
                v.tipo, v.marca, v.modelo, v.placa
            FROM frete7 f
            LEFT JOIN cliente7 c ON c.id_cliente = f.id_cliente
            LEFT JOIN pessoa7 pc ON pc.id_pessoa = c.id_pessoa
            LEFT JOIN motorista7 m ON m.id_motorista = f.id_motorista
            LEFT JOIN pessoa7 pm ON pm.id_pessoa = m.id_pessoa
            LEFT JOIN veiculo7 v ON v.id_veiculo = f.id_veiculo
            WHERE f.id_cliente = :id_cliente
            ORDER BY f.id_frete DESC
            """
        ),
        {"id_cliente": id_cliente},
    ).fetchall()

    historico = []
    for row in rows:
        m = row._mapping
        preco = m.get("preco_fechado") if m.get("preco_fechado") is not None else m.get("preco_estimado")
        status = str(m.get("status") or "PENDENTE").lower()
        motorista = m.get("motorista_nome") or "Não atribuído"
        historico.append(
            {
                "id": int(m["id_frete"]),
                "id_frete": int(m["id_frete"]),
                "date": f"Frete #{int(m['id_frete'])}",
                "origin": m.get("endereco_origem") or "Origem não informada",
                "dest": m.get("endereco_destino") or "Destino não informado",
                "price": f"R$ {float(preco or 0):.2f}".replace(".", ","),
                "status": status,
                "driver": motorista,
                "motorista_nome": motorista,
                "cliente_nome": m.get("cliente_nome") or "Cliente",
                "cliente_email": m.get("cliente_email"),
                "id_motorista": int(m["id_motorista"]) if m.get("id_motorista") else None,
                "chat_disponivel": status in {"aceito", "em_transito", "concluido"} or bool(m.get("id_motorista")),
                "motorista": {
                    "id": int(m["id_motorista"]) if m.get("id_motorista") else None,
                    "nome": motorista,
                    "telefone": m.get("motorista_telefone") or "",
                    "rating": float(m.get("avaliacao_media") or 4.8),
                    "veiculo": " ".join(str(x) for x in [m.get("marca"), m.get("modelo")] if x) or m.get("tipo") or "Veículo",
                    "placa": m.get("placa") or "N/A",
                } if m.get("id_motorista") else None,
            }
        )
    return historico


@router.get("/me/negociacao_ativa")
def obter_negociacao_ativa(email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])

    proposta = db.execute(
        text(
            """
            SELECT n.id_negociacao, n.id_frete, n.id_motorista, n.preco_proposto,
                   f.distancia_km, f.volume_carga_total,
                   m.avaliacao_media,
                   p.nome AS motorista_nome,
                   v.marca, v.modelo, v.placa, v.tipo
            FROM negociacao7 n
            JOIN frete7 f ON f.id_frete = n.id_frete
            JOIN motorista7 m ON m.id_motorista = n.id_motorista
            JOIN pessoa7 p ON p.id_pessoa = m.id_pessoa
            LEFT JOIN veiculo7 v ON v.id_veiculo = n.id_veiculo
            WHERE f.id_cliente = :id_cliente
              AND n.status = 'PENDENTE'
            ORDER BY n.id_negociacao DESC
            LIMIT 1
            """
        ),
        {"id_cliente": id_cliente},
    ).first()

    if not proposta:
        raise HTTPException(status_code=404, detail="Nenhuma negociação pendente")

    m = proposta._mapping
    preco = float(m.get("preco_proposto") or 0)
    distancia = float(m.get("distancia_km") or 10)
    tempo = int(distancia * 2 + 10)
    return {
        "id_negociacao": int(m["id_negociacao"]),
        "id_frete": int(m["id_frete"]),
        "driver": {
            "id": int(m["id_motorista"]),  # alterado aqui de m["id_negociacao"] para m["id_motorista"]
            "rawId": None,
            "name": m.get("motorista_nome") or "Motorista",
            "rating": float(m.get("avaliacao_media") or 4.8),
            "trips": 12,
            "vehicle": " ".join(str(x) for x in [m.get("marca"), m.get("modelo")] if x) or m.get("tipo") or "Veículo",
            "plate": m.get("placa") or "N/A",
            "photo": "https://randomuser.me/api/portraits/men/32.jpg",
            "price": f"R$ {preco:.2f}".replace(".", ","),
            "rawPrice": preco,
            "time": f"{tempo} min",
            "suggestedPrice": f"R$ {(preco * 0.9):.2f}".replace(".", ","),
        },
    }


@router.put("/me")
def atualizar_perfil(email_atual: str, dados: PerfilUpdate, db: Session = Depends(get_session)):
    row = db.execute(text("SELECT id_pessoa FROM pessoa7 WHERE email = :email LIMIT 1"), {"email": email_atual}).first()
    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    id_pessoa = int(row[0])
    updates = []
    params = {"id_pessoa": id_pessoa}
    for col in ["nome", "email", "cpf", "telefone"]:
        value = getattr(dados, col, None)
        if value is not None and str(value).strip() != "":
            updates.append(f"{col} = :{col}")
            params[col] = value
    if updates:
        db.execute(text(f"UPDATE pessoa7 SET {', '.join(updates)} WHERE id_pessoa = :id_pessoa"), params)
        db.commit()
    pessoa = db.execute(text("SELECT id_pessoa, nome, email, cpf, telefone FROM pessoa7 WHERE id_pessoa = :id"), {"id": id_pessoa}).first()._mapping
    return {"status": "perfil_atualizado", "usuario": dict(pessoa)}


def _table_exists(db: Session, table_name: str) -> bool:
    return bool(db.execute(text("""
        SELECT COUNT(*) FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
    """), {"table": table_name}).scalar())


@router.get("/me/perfil")
def obter_perfil_cliente(email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])
    if _table_exists(db, "vw_cliente_perfil7"):
        v = db.execute(text("SELECT * FROM vw_cliente_perfil7 WHERE id_cliente = :id LIMIT 1"), {"id": id_cliente}).first()
        if v:
            m = v._mapping
            return {
                "id_cliente": int(m["id_cliente"]),
                "id_pessoa": int(m["id_pessoa"]),
                "nome": m.get("nome"),
                "email": m.get("email"),
                "fretes_concluidos": int(m.get("fretes_concluidos") or 0),
                "avaliacao_media_cliente": float(m.get("avaliacao_media_cliente") or 0),
            }
    m = row._mapping
    stats = db.execute(text("""
        SELECT
            COUNT(CASE WHEN LOWER(f.status) IN ('concluido', 'concluído', 'finalizado') THEN 1 END) AS fretes_concluidos,
            COALESCE(ROUND(AVG(CASE WHEN a.tipo_avaliador = 'MOTORISTA' THEN a.nota END), 2), 0) AS avaliacao_media_cliente
        FROM frete7 f
        LEFT JOIN avaliacao_frete7 a ON a.id_frete = f.id_frete
            AND a.id_avaliado_pessoa = :id_pessoa
            AND a.tipo_avaliador = 'MOTORISTA'
        WHERE f.id_cliente = :id_cliente
    """), {"id_cliente": id_cliente, "id_pessoa": int(m["id_pessoa"])}).first()._mapping
    return {
        "id_cliente": id_cliente,
        "id_pessoa": int(m["id_pessoa"]),
        "nome": m.get("nome"),
        "email": m.get("email"),
        "fretes_concluidos": int(stats.get("fretes_concluidos") or 0),
        "avaliacao_media_cliente": float(stats.get("avaliacao_media_cliente") or 0),
    }


@router.get("/me/cartoes")
def listar_cartoes_cliente(email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])
    if not _table_exists(db, "cartao_cliente7"):
        return []
    rows = db.execute(text("""
        SELECT id_cartao, apelido, titular, bandeira, ultimos4, mes_expiracao, ano_expiracao, principal, ativo
        FROM cartao_cliente7
        WHERE id_cliente = :id AND ativo = 1
        ORDER BY principal DESC, id_cartao DESC
    """), {"id": id_cliente}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/me/cartoes")
def salvar_cartao_cliente(email: str, dados: CartaoClienteCreate, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])
    numero = ''.join(ch for ch in str(dados.numero_cartao or '') if ch.isdigit())
    ultimos4 = (dados.ultimos4 or numero[-4:] if numero else dados.ultimos4 or '').strip()[-4:]
    if len(ultimos4) != 4 or not ultimos4.isdigit():
        raise HTTPException(status_code=400, detail="Cartão inválido: informe ao menos os últimos 4 dígitos.")
    bandeira = dados.bandeira or ("Visa" if numero.startswith('4') else "Mastercard" if numero.startswith(('5','2')) else "Cartão")
    if dados.principal:
        db.execute(text("UPDATE cartao_cliente7 SET principal = 0 WHERE id_cliente = :id"), {"id": id_cliente})
    result = db.execute(text("""
        INSERT INTO cartao_cliente7
            (id_cliente, apelido, titular, bandeira, ultimos4, mes_expiracao, ano_expiracao, token_pagamento, principal, ativo)
        VALUES
            (:id_cliente, :apelido, :titular, :bandeira, :ultimos4, :mes, :ano, :token, :principal, 1)
    """), {
        "id_cliente": id_cliente,
        "apelido": dados.apelido or f"{bandeira} •••• {ultimos4}",
        "titular": dados.titular,
        "bandeira": bandeira,
        "ultimos4": ultimos4,
        "mes": dados.mes_expiracao,
        "ano": dados.ano_expiracao,
        "token": f"tok_movout_{id_cliente}_{ultimos4}",
        "principal": 1 if dados.principal else 0,
    })
    db.commit()
    return {"status": "cartao_salvo", "id_cartao": int(getattr(result, "lastrowid", None) or db.execute(text("SELECT LAST_INSERT_ID()")).scalar() or 0)}


@router.delete("/me/cartoes/{id_cartao}")
def remover_cartao_cliente(id_cartao: int, email: str, db: Session = Depends(get_session)):
    row = _cliente_by_email(db, email)
    if not row:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    id_cliente = int(row._mapping["id_cliente"])
    db.execute(text("UPDATE cartao_cliente7 SET ativo = 0 WHERE id_cartao = :id_cartao AND id_cliente = :id_cliente"), {"id_cartao": id_cartao, "id_cliente": id_cliente})
    db.commit()
    return {"status": "cartao_removido", "id_cartao": id_cartao}
