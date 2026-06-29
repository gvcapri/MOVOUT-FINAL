"""
conftest.py — Configuração central do pytest para os testes de regressão do Movout Backend.

COMO USAR:
  1. Inicie o servidor localmente:
       cd Backend && python main.py
  2. Em outro terminal, execute:
       pytest tests/ -v --tb=short
"""
import os
import pytest
import httpx

# ---------------------------------------------------------------------------
# Configuração do host da API
# ---------------------------------------------------------------------------
BASE_URL = os.getenv("MOVOUT_TEST_BASE_URL", "http://localhost:8000")
WS_BASE_URL = BASE_URL.replace("http://", "ws://").replace("https://", "wss://")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def ws_base_url() -> str:
    return WS_BASE_URL


@pytest.fixture(scope="session")
def http_client():
    """
    Cliente HTTP síncrono com timeout de 15 s.
    Escopo 'session' → uma única instância para toda a suíte.
    """
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        yield client


# ---------------------------------------------------------------------------
# Seed helpers — retornam IDs reais presentes no banco de testes
# ---------------------------------------------------------------------------

def _get_first_frete_id(client: httpx.Client) -> int | None:
    """Retorna o ID do primeiro frete disponível (PENDENTE), ou None."""
    resp = client.get("/api/v1/fretes/")
    if resp.status_code == 200:
        fretes = resp.json()
        if fretes:
            return fretes[0].get("id_frete") or fretes[0].get("id")
    return None


def _get_first_motorista_id(client: httpx.Client) -> int | None:
    """Retorna o ID do primeiro motorista cadastrado."""
    resp = client.get("/api/v1/motoristas/")
    if resp.status_code == 200:
        motoristas = resp.json()
        if motoristas:
            return motoristas[0].get("id_motorista") or motoristas[0].get("id")
    return None


@pytest.fixture(scope="session")
def seed_ids(http_client):
    """
    Fixture que cria um frete de teste e retorna um dict com IDs para uso nos testes.
    O frete é criado com dados mínimos. Se já existir um frete PENDENTE, reutiliza.
    """
    # Tenta reutilizar um frete existente
    frete_id = _get_first_frete_id(http_client)
    motorista_id = _get_first_motorista_id(http_client)

    if frete_id is None:
        # Cria um frete de teste
        resp = http_client.post("/api/v1/fretes/", json={
            "origem": "Rua Teste, 1 - São Paulo",
            "destino": "Av. Paulista, 1000 - São Paulo",
            "distancia_km": 5.0,
            "peso_estimado": 10.0,
            "tipo_veiculo": "CARRO",
            "prioridade": "hoje",
        })
        assert resp.status_code in (200, 201), (
            f"Não foi possível criar frete seed: {resp.status_code} — {resp.text}"
        )
        frete_id = resp.json().get("id_frete") or resp.json().get("id")

    return {
        "frete_id": frete_id,
        "motorista_id": motorista_id,
    }
