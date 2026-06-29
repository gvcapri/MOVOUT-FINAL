"""
test_b5_conclusao_status_flexivel.py
======================================
Valida a correcao do Bug B-5:

  [B-5] O endpoint /motorista-concluir exigia estritamente status EM_TRANSITO.
  Isso causava erro 400 em dois cenarios comuns do mundo real:
    - Motorista esqueceu de chamar /iniciar (frete ficou em ACEITO).
    - Cliente confirmou a conclusao antes do motorista (frete foi para CONCLUIDO).

  CORRECAO APLICADA (2026-06-28):
    A validacao de status foi flexibilizada para aceitar: ACEITO, EM_TRANSITO, CONCLUIDO.
    Alem disso, o UPDATE do pagamento para AGUARDANDO_CONFIRMACAO so ocorre se o
    pagamento ainda nao foi liberado -- evitando regressao de status.

  TESTES:
    Teste 1 -- "O Esquecimento":
      Frete ACEITO (sem /iniciar) -> motorista conclui -> deve retornar 200.

    Teste 2 -- "O Clique Duplo - Cliente Primeiro":
      Frete EM_TRANSITO -> cliente confirma (pagamento fica LIBERADO)
      -> motorista conclui -> deve retornar 200
      -> pagamento deve permanecer LIBERADO (nao regredir).
"""
import pytest
import httpx

API_PREFIX = "/api/v1"

STATUS_LIBERADO_VALIDOS = {"LIBERADO", "CONFIRMADO"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _criar_frete(client: httpx.Client, tag: str = "") -> int | None:
    """Cria um frete PENDENTE e retorna o id_frete, ou None."""
    resp = client.post(f"{API_PREFIX}/fretes/", json={
        "origem": f"Rua B5 {tag} Teste, 1 - SP",
        "destino": f"Av. B5 {tag} Destino, 99 - SP",
        "distancia_km": 6.0,
        "peso_estimado": 12.0,
        "tipo_veiculo": "CARRO",
        "prioridade": "hoje",
    })
    if resp.status_code not in (200, 201):
        print(f"\n[B-5] Falha ao criar frete ({tag}): {resp.status_code} -- {resp.text}")
        return None
    frete_data = resp.json()
    frete_id = frete_data.get("id_frete") or frete_data.get("id")
    print(f"\n[B-5] Frete criado ({tag}): id={frete_id}, status={frete_data.get('status')}")
    return frete_id


def _aceitar_frete(client: httpx.Client, frete_id: int) -> int | None:
    """Motorista aceita o frete. Retorna motorista_id ou None."""
    resp_m = client.get(f"{API_PREFIX}/motoristas/")
    motorista_id = None
    if resp_m.status_code == 200 and resp_m.json():
        motorista_id = resp_m.json()[0].get("id_motorista") or resp_m.json()[0].get("id")

    params = {"motorista_id": motorista_id} if motorista_id else {}
    resp = client.post(f"{API_PREFIX}/fretes/{frete_id}/motorista-aceitar", params=params)

    if resp.status_code not in (200, 201):
        # Fallback
        resp = client.post(f"{API_PREFIX}/fretes/{frete_id}/aceitar-proposta", params=params)

    if resp.status_code not in (200, 201):
        print(f"[B-5] Falha ao aceitar frete {frete_id}: {resp.status_code} -- {resp.text}")
        return None

    aceite = resp.json()
    motorista_id = (
        aceite.get("id_motorista")
        or aceite.get("motorista_id")
        or (aceite.get("frete") or {}).get("id_motorista")
        or motorista_id
    )
    print(f"[B-5] Frete {frete_id} aceito. Motorista: {motorista_id}")
    return motorista_id


# ---------------------------------------------------------------------------
# TESTE 1 -- "O Esquecimento": motorista conclui de ACEITO (sem /iniciar)
# ---------------------------------------------------------------------------

def test_b5_motorista_conclui_de_aceito_sem_iniciar(http_client):
    """
    [B-5] Teste 1 -- O Esquecimento.

    Frete em status ACEITO (motorista atribuido, mas /iniciar nunca chamado).
    O motorista chama /motorista-concluir diretamente.

    ANTES da correcao: retornava 400 "frete so pode ser concluido se EM_TRANSITO".
    APOS a correcao  : deve retornar 200 OK.
    """
    # Setup: criar frete e aceitar (sem /iniciar)
    frete_id = _criar_frete(http_client, tag="T1-Esquecimento")
    if frete_id is None:
        pytest.skip("[B-5] Nao foi possivel criar frete para Teste 1.")

    motorista_id = _aceitar_frete(http_client, frete_id)
    if motorista_id is None:
        pytest.skip("[B-5] Nao foi possivel aceitar frete para Teste 1.")

    # Confirmar que o frete esta em ACEITO (sem chamar /iniciar)
    resp_check = http_client.get(f"{API_PREFIX}/fretes/{frete_id}")
    if resp_check.status_code == 200:
        status_atual = resp_check.json().get("status", "")
        print(f"[B-5] Status antes de concluir: '{status_atual}' (esperado: aceito)")

    # Acao: motorista tenta concluir diretamente de ACEITO
    resp = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/motorista-concluir",
        params={"motorista_id": motorista_id},
    )

    print(
        f"[B-5] /motorista-concluir -> HTTP {resp.status_code}: "
        f"{resp.text[:250]}"
    )

    # Assert principal: deve ser 200, nao 400
    assert resp.status_code == 200, (
        f"\n[B-5] BUG B-5 AINDA PRESENTE -- Teste 1 (O Esquecimento)!\n"
        f"  Retornou HTTP {resp.status_code} ao tentar concluir um frete em status ACEITO.\n"
        f"  Esperado: 200 OK\n"
        f"  Resposta: {resp.text}\n"
        f"\n"
        f"  PISTA: Verifique a validacao de status em motorista_marcar_corrida_concluida()\n"
        f"  em fretes.py. A lista deve conter 'ACEITO', nao apenas 'EM_TRANSITO'.\n"
        f"  Linha aproximada: if status_atual not in ['ACEITO', 'EM_TRANSITO', 'CONCLUIDO']\n"
        f"\n"
        f"  Frete ID : {frete_id}\n"
        f"  Motorista: {motorista_id}"
    )

    # Verificar que o frete esta CONCLUIDO
    dados = resp.json()
    novo_status = str(dados.get("novo_status") or "").upper()
    assert novo_status in ("CONCLUIDO", ""), (
        f"[B-5] Status apos conclusao inesperado: '{novo_status}'. Esperado: CONCLUIDO."
    )

    print(
        f"\n[B-5] TESTE 1 PASSOU -- Motorista concluiu de ACEITO sem erro.\n"
        f"  Frete {frete_id} -> status '{novo_status}'"
    )


# ---------------------------------------------------------------------------
# TESTE 2 -- "O Clique Duplo": cliente confirma primeiro, motorista depois
# ---------------------------------------------------------------------------

def test_b5_motorista_conclui_apos_cliente_confirmar(http_client):
    """
    [B-5] Teste 2 -- O Clique Duplo (Cliente Primeiro).

    Sequencia:
      1. Frete vai para EM_TRANSITO.
      2. Cliente confirma conclusao primeiro -> pagamento fica LIBERADO.
      3. Motorista chama /motorista-concluir (frete ja esta CONCLUIDO).

    ASSERTS:
      A) /motorista-concluir deve retornar 200 OK (nao 400).
      B) O status do pagamento deve permanecer LIBERADO (nao regredir para
         AGUARDANDO_CONFIRMACAO).
    """
    # Setup: criar frete, aceitar, iniciar
    frete_id = _criar_frete(http_client, tag="T2-CliqueDuplo")
    if frete_id is None:
        pytest.skip("[B-5] Nao foi possivel criar frete para Teste 2.")

    motorista_id = _aceitar_frete(http_client, frete_id)
    if motorista_id is None:
        pytest.skip("[B-5] Nao foi possivel aceitar frete para Teste 2.")

    resp_iniciar = http_client.post(f"{API_PREFIX}/fretes/{frete_id}/iniciar")
    if resp_iniciar.status_code not in (200, 201):
        print(f"[B-5] /iniciar retornou {resp_iniciar.status_code}. Continuando.")
    else:
        print(f"[B-5] Frete {frete_id} em EM_TRANSITO.")

    # Passo A: cliente confirma primeiro (pagamento deve ficar LIBERADO)
    resp_cliente = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/cliente-confirmar-conclusao",
        json={"observacao": "[TESTE B-5] Cliente confirmou primeiro."},
    )

    print(
        f"[B-5] /cliente-confirmar-conclusao -> HTTP {resp_cliente.status_code}: "
        f"{resp_cliente.text[:200]}"
    )

    if resp_cliente.status_code not in (200, 201):
        pytest.skip(
            f"[B-5] Nao foi possivel confirmar conclusao pelo cliente: "
            f"{resp_cliente.status_code} -- {resp_cliente.text}"
        )

    # Verificar pagamento apos cliente confirmar
    resp_pag_antes = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
    status_pag_antes = ""
    if resp_pag_antes.status_code == 200:
        status_pag_antes = str(resp_pag_antes.json().get("status") or "").upper()
        print(f"[B-5] Status pagamento APOS cliente confirmar: '{status_pag_antes}'")

    # Passo B: motorista chama /motorista-concluir (frete ja esta CONCLUIDO)
    resp_motorista = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/motorista-concluir",
        params={"motorista_id": motorista_id},
    )

    print(
        f"[B-5] /motorista-concluir -> HTTP {resp_motorista.status_code}: "
        f"{resp_motorista.text[:250]}"
    )

    # Assert A: deve ser 200 (nao 400)
    assert resp_motorista.status_code == 200, (
        f"\n[B-5] BUG B-5 AINDA PRESENTE -- Teste 2 (O Clique Duplo)!\n"
        f"  Retornou HTTP {resp_motorista.status_code} ao tentar concluir um frete\n"
        f"  que ja estava em status CONCLUIDO (cliente havia confirmado primeiro).\n"
        f"  Esperado: 200 OK\n"
        f"  Resposta: {resp_motorista.text}\n"
        f"\n"
        f"  PISTA: 'CONCLUIDO' deve estar na lista de status aceitos em\n"
        f"  motorista_marcar_corrida_concluida() -- fretes.py.\n"
        f"\n"
        f"  Frete ID : {frete_id}\n"
        f"  Motorista: {motorista_id}"
    )

    print(f"[B-5] Assert A passou -- /motorista-concluir retornou 200.")

    # Assert B: pagamento NAO deve regredir para AGUARDANDO_CONFIRMACAO
    resp_pag_depois = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
    assert resp_pag_depois.status_code == 200, (
        f"[B-5] GET /pagamento retornou {resp_pag_depois.status_code}."
    )

    status_pag_depois = str(resp_pag_depois.json().get("status") or "").upper()
    print(f"[B-5] Status pagamento APOS motorista concluir: '{status_pag_depois}'")

    assert status_pag_depois != "AGUARDANDO_CONFIRMACAO", (
        f"\n[B-5] BUG B-5 -- REGRESSAO DE STATUS DO PAGAMENTO!\n"
        f"  O pagamento estava '{status_pag_antes}' apos o cliente confirmar.\n"
        f"  Apos o motorista chamar /motorista-concluir, regrediu para AGUARDANDO_CONFIRMACAO.\n"
        f"\n"
        f"  PISTA: O UPDATE do pagamento em motorista_marcar_corrida_concluida() deve\n"
        f"  checar se o status atual ja e LIBERADO/CONFIRMADO antes de sobrescrever.\n"
        f"  Linha aproximada: if str(pagamento.get('status')).upper() not in LIBERADO_VALIDOS\n"
        f"\n"
        f"  Frete ID   : {frete_id}\n"
        f"  Pag. antes : '{status_pag_antes}'\n"
        f"  Pag. depois: '{status_pag_depois}'\n"
        f"  Payload    : {resp_pag_depois.json()}"
    )

    assert status_pag_depois in STATUS_LIBERADO_VALIDOS, (
        f"[B-5] Status de pagamento final inesperado: '{status_pag_depois}'. "
        f"Esperado: {STATUS_LIBERADO_VALIDOS}.\n"
        f"Payload: {resp_pag_depois.json()}"
    )

    print(
        f"\n[B-5] TESTE 2 PASSOU -- Clique duplo tratado corretamente.\n"
        f"  Pagamento permaneceu '{status_pag_depois}' apos motorista concluir.\n"
        f"  Frete {frete_id} | Motorista {motorista_id}"
    )
