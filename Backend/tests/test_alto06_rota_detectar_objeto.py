"""
test_alto06_rota_detectar_objeto.py
======================================
Valida o bug:

  [ALTO-06] `POST /fretes/detectar-objeto` é rota estática declarada APÓS
            rotas dinâmicas `POST /{frete_id}/...`.

            O FastAPI registra as rotas em ordem de declaração. Como
            `@router.post("/detectar-objeto")` aparece na linha 1155, DEPOIS
            de `@router.post("/{frete_id}/proposta")` na linha 773 e outras,
            o FastAPI tenta fazer match de "detectar-objeto" com o parâmetro
            dinâmico `frete_id` (que espera um int).

            Resultado: `POST /api/v1/fretes/detectar-objeto` retorna
            422 Unprocessable Entity em vez de funcionar.

Estratégia do teste:
  - Enviar POST /api/v1/fretes/detectar-objeto com um arquivo de imagem mínimo
  - Validar que o status retornado NÃO é 422 (o bug) e NÃO é 404
  - Aceita: 200 (sucesso), 500 (erro interno da IA), 400 (arquivo inválido)
  - REJEITA: 422 (rota sombreada pelo parâmetro dinâmico) e 404 (rota não encontrada)
"""
import io
import pytest

API_PREFIX = "/api/v1"

# Imagem PNG mínima válida (1x1 pixel, base64 decodificado)
MINIMAL_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82,
])


# ---------------------------------------------------------------------------
# Teste principal: rota não deve retornar 422
# ---------------------------------------------------------------------------

def test_alto06_detectar_objeto_nao_retorna_422(http_client):
    """
    ALTO-06: POST /fretes/detectar-objeto deve ser encontrado pelo FastAPI
    sem ser capturado pela rota dinâmica /{frete_id}.

    BUG ATUAL: 422 Unprocessable Entity pois 'detectar-objeto' não é um int
               válido para o parâmetro frete_id da rota dinâmica.

    COMPORTAMENTO ESPERADO PÓS-CORREÇÃO: 200, 500 (erro da IA) ou 400 (arquivo inválido).
    """
    files = {
        "file": ("test_image.png", io.BytesIO(MINIMAL_PNG), "image/png"),
    }

    resp = http_client.post(
        f"{API_PREFIX}/fretes/detectar-objeto",
        files=files,
    )

    # O bug mais óbvio: 422 significa que a rota dinâmica capturou o request
    if resp.status_code == 422:
        error_detail = resp.json().get("detail", [])
        # Verifica se o erro menciona frete_id (confirmação do bug)
        error_str = str(error_detail)
        if "frete_id" in error_str or "int" in error_str.lower():
            pytest.fail(
                f"[ALTO-06] BUG CONFIRMADO: POST /fretes/detectar-objeto retornou 422. "
                f"A rota estática '/detectar-objeto' está sendo capturada pela rota "
                f"dinâmica '/{{frete_id}}' porque foi declarada DEPOIS no código. "
                f"O FastAPI tentou converter 'detectar-objeto' para int (frete_id) e falhou. "
                f"Detalhe do erro: {error_detail}. "
                f"CORREÇÃO: mover @router.post('/detectar-objeto') para ANTES "
                f"das rotas @router.post('/{{frete_id}}/...')."
            )
        else:
            pytest.fail(
                f"[ALTO-06] Recebeu 422 com detalhe inesperado: {error_detail}"
            )

    # 404 também indica que a rota não foi encontrada
    assert resp.status_code != 404, (
        f"[ALTO-06] Rota POST /fretes/detectar-objeto retornou 404 — rota não registrada."
    )

    # Aceita: 200 (IA funcionou), 500 (IA indisponível), 400 (arquivo inválido), 415 (mime)
    assert resp.status_code in (200, 400, 415, 500), (
        f"[ALTO-06] Status inesperado: {resp.status_code} — {resp.text[:300]}"
    )


def test_alto06_detectar_objeto_retorna_status_logico(http_client):
    """
    ALTO-06 (parte 2): Após atingir a rota correta, a resposta deve ter
    estrutura lógica — status 'sucesso' e campo 'objeto', ou mensagem de erro
    estruturada.
    """
    files = {
        "file": ("imagem_caixa.jpg", io.BytesIO(MINIMAL_PNG), "image/jpeg"),
    }

    resp = http_client.post(
        f"{API_PREFIX}/fretes/detectar-objeto",
        files=files,
    )

    # Se o bug ALTO-06 estiver presente, falha aqui
    if resp.status_code == 422:
        detail = resp.json().get("detail", [])
        pytest.fail(
            f"[ALTO-06] BUG: 422 — Rota sombreada pela rota dinâmica. "
            f"Detalhes: {detail}"
        )

    if resp.status_code == 200:
        data = resp.json()
        assert "status" in data, (
            f"[ALTO-06] Resposta 200 sem campo 'status': {data}"
        )
        assert data["status"] == "sucesso", (
            f"[ALTO-06] Campo status != 'sucesso': {data['status']}"
        )
        # Deve ter o campo 'objeto' com a descrição da IA
        assert "objeto" in data, (
            f"[ALTO-06] Resposta 200 sem campo 'objeto': {data}"
        )

    elif resp.status_code == 500:
        # IA indisponível — erro estruturado esperado
        data = resp.json()
        assert "detail" in data, (
            f"[ALTO-06] Resposta 500 sem campo 'detail': {data}"
        )


def test_alto06_detectar_objeto_sem_frete_id(http_client):
    """
    ALTO-06 (parte 3): Chamada sem frete_id no query param.
    A rota deve funcionar normalmente — frete_id é opcional.
    """
    files = {
        "file": ("sem_frete.png", io.BytesIO(MINIMAL_PNG), "image/png"),
    }

    # Sem frete_id (não envia notificação WS, apenas detecta)
    resp = http_client.post(
        f"{API_PREFIX}/fretes/detectar-objeto",
        files=files,
    )

    assert resp.status_code != 422, (
        f"[ALTO-06] BUG: 422 mesmo sem frete_id. "
        f"Rota sombreada pela dinâmica: {resp.json()}"
    )

    assert resp.status_code in (200, 400, 415, 500), (
        f"[ALTO-06] Status inesperado sem frete_id: {resp.status_code} — {resp.text[:200]}"
    )


def test_alto06_detectar_objeto_com_frete_id_valido(http_client, seed_ids):
    """
    ALTO-06 (parte 4): Com frete_id real, a rota deve processar o arquivo
    e tentar enviar notificação WS. Mesmo que o WS falhe (bug CRÍTICO-03),
    o endpoint deve retornar 200.
    """
    frete_id = seed_ids.get("frete_id")
    if not frete_id:
        pytest.skip("[ALTO-06] Sem frete_id disponível para teste com frete real.")

    files = {
        "file": ("com_frete.png", io.BytesIO(MINIMAL_PNG), "image/png"),
    }

    resp = http_client.post(
        f"{API_PREFIX}/fretes/detectar-objeto",
        files=files,
        params={"frete_id": frete_id},
    )

    assert resp.status_code != 422, (
        f"[ALTO-06] BUG: 422 com frete_id={frete_id}. "
        f"Rota sombreada: {resp.json()}"
    )

    # Aceita 200 (IA funcionou) ou 500 (IA falhou mas endpoint respondeu)
    assert resp.status_code in (200, 400, 415, 500), (
        f"[ALTO-06] Status inesperado com frete_id={frete_id}: "
        f"{resp.status_code} — {resp.text[:200]}"
    )
