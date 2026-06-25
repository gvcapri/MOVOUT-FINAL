"""
test_alto07_driver_id_incorreto.py
=====================================
Valida o bug:

  [ALTO-07] `obter_negociacao_ativa` retorna `id_negociacao` no campo `driver.id`
            em vez de `id_motorista`.

            Código problemático em cliente.py linha 181:
                "driver": {
                    "id": int(m["id_negociacao"]),  # ← DEVERIA ser id_motorista!
                    ...
                }

            O frontend usa `driver.id` para identificar o motorista (ex: abrir chat,
            aceitar proposta, etc.). Receber o ID da negociação no lugar causa
            bugs em toda a operação pós-proposta.

Estratégia do teste:
  1. Criar um frete e enviar uma proposta (para criar uma negociação)
  2. Chamar GET /api/v1/cliente/me/negociacao_ativa com o email do cliente
  3. Comparar driver.id com id_negociacao e id_motorista da resposta
  4. Confirmar que driver.id == id_motorista (não id_negociacao)
"""
import pytest

API_PREFIX = "/api/v1"


def _get_first_cliente_email(client) -> str | None:
    """Retorna o email do primeiro cliente no banco via GET /cliente/me (sem email)."""
    # Não temos login real — tenta buscar via /auth/register ou usa email de seed
    # Tenta via endpoint de motoristas para obter pessoas
    return None


def _setup_negociacao_ativa(client, cliente_email: str, motorista_id: int | None) -> dict | None:
    """
    Cria um frete para o cliente e envia uma proposta de um motorista,
    criando assim uma negociação PENDENTE.
    Retorna {'frete_id', 'id_negociacao', 'id_motorista'} ou None.
    """
    # Criar frete
    payload_frete = {
        "origem": "Rua Bug Driver ID, 1 - SP",
        "destino": "Rua Correção, 99 - SP",
        "distancia_km": 4.0,
        "peso_estimado": 8.0,
        "email": cliente_email,
        "cliente_email": cliente_email,
    }
    resp_frete = client.post(f"{API_PREFIX}/fretes/", json=payload_frete)
    if resp_frete.status_code not in (200, 201):
        return None

    frete_id = resp_frete.json().get("id_frete") or resp_frete.json().get("id")
    if not frete_id:
        return None

    # Enviar proposta do motorista
    if not motorista_id:
        return None

    resp_proposta = client.post(
        f"{API_PREFIX}/fretes/{frete_id}/proposta",
        json={"motorista_id": motorista_id, "valor": 45.00},
    )
    if resp_proposta.status_code not in (200, 201):
        return None

    id_negociacao = resp_proposta.json().get("id_negociacao")
    return {
        "frete_id": frete_id,
        "id_negociacao": id_negociacao,
        "id_motorista": motorista_id,
    }


# ---------------------------------------------------------------------------
# Teste principal: driver.id deve ser id_motorista, não id_negociacao
# ---------------------------------------------------------------------------

def test_alto07_driver_id_e_motorista_nao_negociacao(http_client, seed_ids):
    """
    ALTO-07: GET /cliente/me/negociacao_ativa deve retornar driver.id com
    o ID REAL do motorista, não com o ID da negociação.

    BUG ATUAL: driver.id = id_negociacao (ERRADO)
    ESPERADO:  driver.id = id_motorista (CORRETO)
    """
    motorista_id = seed_ids.get("motorista_id")
    if not motorista_id:
        pytest.skip(
            "[ALTO-07] Sem motorista cadastrado no banco — impossível criar negociação."
        )

    # Descobre o email de um cliente real para usar na requisição
    # Tenta pegar via listagem de fretes
    resp_fretes = http_client.get(f"{API_PREFIX}/fretes/")
    cliente_email = None
    if resp_fretes.status_code == 200:
        fretes = resp_fretes.json()
        for f in fretes:
            email = f.get("cliente_email")
            if email:
                cliente_email = email
                break

    if not cliente_email:
        pytest.skip(
            "[ALTO-07] Nenhum cliente com email encontrado nos fretes. "
            "Impossível testar negociacao_ativa sem email real."
        )

    # Cria uma negociação
    ctx = _setup_negociacao_ativa(http_client, cliente_email, motorista_id)
    if not ctx:
        pytest.skip(
            f"[ALTO-07] Não foi possível criar negociação com email={cliente_email}, "
            f"motorista_id={motorista_id}."
        )

    id_negociacao = ctx["id_negociacao"]

    # Chama o endpoint com problema
    resp = http_client.get(
        f"{API_PREFIX}/cliente/me/negociacao_ativa",
        params={"email": cliente_email},
    )

    if resp.status_code == 404:
        pytest.skip(
            f"[ALTO-07] Nenhuma negociação ativa retornada para email={cliente_email}. "
            f"A negociação criada pode não estar com status=PENDENTE."
        )

    assert resp.status_code == 200, (
        f"[ALTO-07] GET negociacao_ativa retornou {resp.status_code}: {resp.text}"
    )

    data = resp.json()
    assert "driver" in data, (
        f"[ALTO-07] Resposta sem campo 'driver': {data}"
    )

    driver = data["driver"]
    driver_id = driver.get("id")
    id_negociacao_retornado = data.get("id_negociacao")

    # ===== ASSERÇÃO CENTRAL =====
    # BUG: driver.id == id_negociacao
    # CORRETO: driver.id == id_motorista
    if driver_id == id_negociacao_retornado:
        pytest.fail(
            f"[ALTO-07] BUG CONFIRMADO: driver.id ({driver_id}) == id_negociacao "
            f"({id_negociacao_retornado}). "
            f"O campo driver.id está retornando o ID da NEGOCIAÇÃO em vez do "
            f"ID do MOTORISTA. "
            f"Linha culpada em cliente.py: \"id\": int(m[\"id_negociacao\"]). "
            f"CORREÇÃO: substituir por int(m[\"id_motorista\"])."
        )

    assert driver_id == motorista_id, (
        f"[ALTO-07] driver.id ({driver_id}) deveria ser id_motorista ({motorista_id}). "
        f"Valor atual: {driver_id}"
    )


# ---------------------------------------------------------------------------
# Teste de estrutura do payload (independente do bug de ID)
# ---------------------------------------------------------------------------

def test_alto07_negociacao_ativa_estrutura_completa(http_client, seed_ids):
    """
    ALTO-07 (parte 2): Valida a estrutura completa do payload de negociação ativa.
    Todos os campos obrigatórios devem estar presentes e com tipos corretos.
    """
    motorista_id = seed_ids.get("motorista_id")

    # Tenta obter qualquer email de cliente
    resp_fretes = http_client.get(f"{API_PREFIX}/fretes/")
    cliente_email = None
    if resp_fretes.status_code == 200:
        for f in resp_fretes.json():
            if f.get("cliente_email"):
                cliente_email = f["cliente_email"]
                break

    if not cliente_email:
        pytest.skip("[ALTO-07] Sem email de cliente disponível para teste de estrutura.")

    resp = http_client.get(
        f"{API_PREFIX}/cliente/me/negociacao_ativa",
        params={"email": cliente_email},
    )

    if resp.status_code == 404:
        pytest.skip("[ALTO-07] Sem negociação ativa — skip de estrutura.")

    if resp.status_code != 200:
        pytest.skip(f"[ALTO-07] Status {resp.status_code} — skip de estrutura.")

    data = resp.json()

    # Campos obrigatórios no root
    campos_root = ["id_negociacao", "id_frete", "driver"]
    for campo in campos_root:
        assert campo in data, (
            f"[ALTO-07] Campo obrigatório '{campo}' ausente no payload: {data}"
        )

    # Campos obrigatórios em driver
    driver = data["driver"]
    campos_driver = ["id", "name", "rating", "price"]
    for campo in campos_driver:
        assert campo in driver, (
            f"[ALTO-07] Campo obrigatório 'driver.{campo}' ausente: {driver}"
        )

    # id deve ser um inteiro positivo
    assert isinstance(driver["id"], int) and driver["id"] > 0, (
        f"[ALTO-07] driver.id deve ser inteiro positivo, mas é: {driver['id']}"
    )

    # id_negociacao e driver.id devem ser DIFERENTES (validação central do bug)
    if driver["id"] == data["id_negociacao"]:
        pytest.fail(
            f"[ALTO-07] driver.id ({driver['id']}) == id_negociacao ({data['id_negociacao']}). "
            f"BUG CONFIRMADO: o ID da negociação está sendo usado como ID do motorista."
        )
