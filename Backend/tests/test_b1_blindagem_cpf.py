"""
test_b1_blindagem_cpf.py
==========================
Valida a correcao do Bug B-1:

  [B-1] O endpoint PUT /motoristas/{id}/perfil aceitava e persistia a chave
  cpf no banco de dados, permitindo a alteracao de um dado imutavel.

  CORRECAO APLICADA (2026-06-28):
    1. Removido cpf do schema PerfilMotoristaUpdate (motoristas.py, ~L14).
    2. Removido "cpf" da lista de colunas iteradas no UPDATE (motoristas.py, L175).

  FLUXO TESTADO:
    1. GET /motoristas/{id}/perfil  -> Captura o CPF original do banco.
    2. PUT /motoristas/{id}/perfil  -> Envia nome novo + cpf malicioso.
    3. Assert A: HTTP 200 (API nao quebra, apenas ignora o campo cpf).
    4. GET /motoristas/{id}/perfil  -> Busca o perfil atualizado.
    5. Assert B: nome foi atualizado com sucesso.
    6. Assert C: CPF no banco permanece igual ao original (nao foi sobrescrito).
"""
import pytest
import httpx

API_PREFIX = "/api/v1"

CPF_MALICIOSO = "999.999.999-99"
NOME_ATUALIZADO = "Motorista B1 Teste Blindagem"


# ---------------------------------------------------------------------------
# Helper: obtem o primeiro motorista disponivel
# ---------------------------------------------------------------------------

def _get_motorista(client: httpx.Client) -> dict | None:
    """Retorna o dict do primeiro motorista cadastrado, ou None."""
    resp = client.get(f"{API_PREFIX}/motoristas/")
    if resp.status_code != 200 or not resp.json():
        return None
    return resp.json()[0]


def _get_perfil(client: httpx.Client, motorista_id: int) -> dict | None:
    """Retorna o perfil completo do motorista via GET, ou None."""
    resp = client.get(f"{API_PREFIX}/motoristas/{motorista_id}/perfil")
    if resp.status_code != 200:
        return None
    return resp.json()


# ---------------------------------------------------------------------------
# TESTE PRINCIPAL -- Bug B-1
# ---------------------------------------------------------------------------

def test_b1_cpf_nao_pode_ser_alterado_via_put(http_client):
    """
    [B-1] Garante que o campo cpf e imune a atualizacoes via PUT /perfil.

    O endpoint deve:
      - Aceitar a requisicao (HTTP 200) mesmo com cpf no payload.
      - Atualizar campos permitidos (ex: nome).
      - IGNORAR silenciosamente o campo cpf enviado.
      - Manter o CPF original intacto no banco.

    Se este teste falhar no Assert C, o campo cpf ainda esta sendo processado
    pela query UPDATE e a blindagem nao foi efetiva.
    """
    # Passo 1: Obter motorista e seu CPF original
    motorista = _get_motorista(http_client)
    if motorista is None:
        pytest.skip(
            "[B-1] Nao ha motoristas cadastrados no banco de dados de teste."
        )

    motorista_id = motorista.get("id_motorista") or motorista.get("id")
    if not motorista_id:
        pytest.skip("[B-1] Nao foi possivel obter id_motorista da lista.")

    print(f"\n[B-1] Motorista selecionado: id={motorista_id}")

    # Passo 2: GET /perfil para capturar o CPF original
    perfil_antes = _get_perfil(http_client, motorista_id)
    if perfil_antes is None:
        pytest.skip(
            f"[B-1] Nao foi possivel obter o perfil do motorista {motorista_id}."
        )

    cpf_original = perfil_antes.get("cpf") or ""
    nome_original = perfil_antes.get("nome") or ""

    print(f"[B-1] CPF original  : '{cpf_original}'")
    print(f"[B-1] Nome original : '{nome_original}'")

    # Passo 3: PUT com nome novo + cpf malicioso no payload
    payload = {
        "nome": NOME_ATUALIZADO,
        "cpf": CPF_MALICIOSO,       # Este campo deve ser ignorado pela API
    }

    print(f"[B-1] Enviando PUT com payload: {payload}")

    resp_put = http_client.put(
        f"{API_PREFIX}/motoristas/{motorista_id}/perfil",
        json=payload,
    )

    print(
        f"[B-1] PUT /perfil -> HTTP {resp_put.status_code}: "
        f"{resp_put.text[:300]}"
    )

    # Assert A: API deve aceitar (200), nao quebrar
    assert resp_put.status_code == 200, (
        f"\n[B-1] FALHA no Assert A: PUT /perfil retornou {resp_put.status_code}.\n"
        f"Esperado: 200 OK\n"
        f"Resposta: {resp_put.text}\n"
        f"A API deve aceitar o payload mesmo com o campo cpf presente,\n"
        f"simplesmente ignorando-o (sem retornar erro de validacao)."
    )

    print(f"[B-1] Assert A passou -- HTTP 200 OK.")

    # Passo 4: GET /perfil para verificar o estado apos o PUT
    perfil_depois = _get_perfil(http_client, motorista_id)
    assert perfil_depois is not None, (
        f"[B-1] Nao foi possivel obter o perfil apos o PUT."
    )

    cpf_depois = perfil_depois.get("cpf") or ""
    nome_depois = perfil_depois.get("nome") or ""

    print(f"[B-1] Nome apos PUT : '{nome_depois}'")
    print(f"[B-1] CPF apos PUT  : '{cpf_depois}'")

    # Assert B: nome deve ter sido atualizado
    assert nome_depois == NOME_ATUALIZADO, (
        f"\n[B-1] FALHA no Assert B: Nome nao foi atualizado.\n"
        f"  Esperado: '{NOME_ATUALIZADO}'\n"
        f"  Encontrado: '{nome_depois}'\n"
        f"  O PUT deve atualizar campos permitidos normalmente.\n"
        f"  Verifique se a lista de colunas em motoristas.py inclui 'nome'."
    )

    print(f"[B-1] Assert B passou -- Nome atualizado corretamente.")

    # Assert C: CPF deve ser IDENTICO ao original (nao pode ter sido sobrescrito)
    assert cpf_depois == cpf_original, (
        f"\n[B-1] BUG B-1 AINDA PRESENTE -- CPF FOI ALTERADO!\n"
        f"  CPF original  : '{cpf_original}'\n"
        f"  CPF enviado   : '{CPF_MALICIOSO}'\n"
        f"  CPF no banco  : '{cpf_depois}'\n"
        f"\n"
        f"  O campo cpf ainda esta sendo processado pela query UPDATE.\n"
        f"  PISTAS:\n"
        f"    1. O schema PerfilMotoristaUpdate ainda tem 'cpf' sem comentar?\n"
        f"       -> motoristas.py, classe PerfilMotoristaUpdate, ~L14\n"
        f"       -> A linha deve ser: # cpf: Optional[str] = None\n"
        f"\n"
        f"    2. A lista de colunas do loop for ainda contem 'cpf'?\n"
        f"       -> motoristas.py, funcao atualizar_perfil_motorista, ~L175\n"
        f"       -> Deve ser: for col in [\"nome\", \"email\", \"telefone\"]\n"
        f"\n"
        f"  Motorista ID: {motorista_id}"
    )

    print(
        f"\n[B-1] TESTE PASSOU -- Bug B-1 CORRIGIDO!\n"
        f"  Nome atualizado : '{nome_depois}'\n"
        f"  CPF permaneceu  : '{cpf_depois}' (original preservado)\n"
        f"  CPF rejeitado   : '{CPF_MALICIOSO}' (ignorado silenciosamente)\n"
        f"  Motorista ID    : {motorista_id}"
    )

    # Cleanup: restaura o nome original para nao sujar o banco
    http_client.put(
        f"{API_PREFIX}/motoristas/{motorista_id}/perfil",
        json={"nome": nome_original},
    )
    print(f"[B-1] Cleanup: nome restaurado para '{nome_original}'.")
