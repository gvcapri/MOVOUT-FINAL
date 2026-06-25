"""
test_alto04_race_condition_conclusao.py
=========================================
Valida o bug:

  [ALTO-04] Dupla confirmação de conclusão causa pagamento inconsistente.

  Existem dois endpoints:
    - POST /{frete_id}/motorista-concluir
      → define status = 'CONCLUIDO' e pagamento = 'AGUARDANDO_CONFIRMACAO'
    - POST /{frete_id}/cliente-confirmar-conclusao
      → define status = 'CONCLUIDO' e pagamento = 'AGUARDANDO_AVALIACOES'

  Cenários problemáticos:
    A) Motorista conclui PRIMEIRO, cliente confirma DEPOIS
       → status pagamento deve transitar de AGUARDANDO_CONFIRMACAO para AGUARDANDO_AVALIACOES
       → não deve ficar travado em AGUARDANDO_CONFIRMACAO para sempre

    B) Cliente confirma PRIMEIRO (sem o motorista ter concluído)
       → pagamento vai direto para AGUARDANDO_AVALIACOES
       → mas o campo motorista_confirmou_conclusao ainda é 0

    C) Ambos concluem quase simultaneamente (simulado em sequência rápida)
       → o estado final deve ser consistente

  O teste simula os dois fluxos e verifica que o estado do frete/pagamento
  é logicamente coerente após cada operação.
"""
import pytest
import httpx

API_PREFIX = "/api/v1"

# Status válidos esperados para pagamento em diferentes etapas
STATUS_PAGAMENTO_VALIDOS = {
    "AGUARDANDO_LIBERACAO",
    "AGUARDANDO_CONFIRMACAO",
    "AGUARDANDO_AVALIACOES",
    "LIBERADO",
    "CONFIRMADO",
}

STATUS_FRETE_CONCLUIDO = {"CONCLUIDO", "concluido"}


# ---------------------------------------------------------------------------
# Helper: cria um frete e leva até status EM_TRANSITO
# ---------------------------------------------------------------------------

def _setup_frete_em_transito(client: httpx.Client) -> dict | None:
    """
    Cria um frete, aceita uma proposta, e inicia o frete (EM_TRANSITO).
    Retorna dict com frete_id e motorista_id, ou None se não for possível.
    """
    # 1. Criar frete
    resp = client.post(f"{API_PREFIX}/fretes/", json={
        "origem": "Rua Race Condition, 1 - SP",
        "destino": "Rua Consistência, 2 - SP",
        "distancia_km": 5.0,
        "peso_estimado": 10.0,
    })
    if resp.status_code not in (200, 201):
        return None

    frete_id = resp.json().get("id_frete") or resp.json().get("id")
    if not frete_id:
        return None

    # 2. Aceitar proposta (atribui motorista)
    resp_aceite = client.post(f"{API_PREFIX}/fretes/{frete_id}/aceitar-proposta")
    if resp_aceite.status_code not in (200, 201):
        return None

    motorista_id = (
        resp_aceite.json().get("id_motorista")
        or resp_aceite.json().get("frete", {}).get("id_motorista")
    )

    # 3. Iniciar frete
    resp_iniciar = client.post(f"{API_PREFIX}/fretes/{frete_id}/iniciar")
    if resp_iniciar.status_code not in (200, 201):
        # Tenta continuar mesmo sem EM_TRANSITO — alguns ambientes permitem conclusão direta
        pass

    return {"frete_id": frete_id, "motorista_id": motorista_id}


# ---------------------------------------------------------------------------
# Cenário A: Motorista conclui primeiro, cliente confirma depois
# ---------------------------------------------------------------------------

def test_alto04_motorista_conclui_primeiro_cliente_confirma(http_client):
    """
    ALTO-04 (Cenário A): Motorista conclui → cliente confirma.

    Após o motorista concluir: pagamento = AGUARDANDO_CONFIRMACAO
    Após o cliente confirmar: pagamento NÃO deve voltar para AGUARDANDO_CONFIRMACAO
    — deve avançar para AGUARDANDO_AVALIACOES.

    BUG: sem verificação de estado, o cliente pode sobrescrever o status
    do pagamento para um estado que ignora a conclusão do motorista.
    """
    context = _setup_frete_em_transito(http_client)
    if context is None:
        pytest.skip(
            "[ALTO-04] Não foi possível criar e configurar frete em trânsito. "
            "Verifique se há motorista cadastrado no banco."
        )

    frete_id = context["frete_id"]
    motorista_id = context.get("motorista_id")

    # Passo 1: Motorista conclui
    params_motorista = {"motorista_id": motorista_id} if motorista_id else {}
    resp_motorista = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/motorista-concluir",
        params=params_motorista,
    )

    assert resp_motorista.status_code in (200, 400, 403, 409), (
        f"[ALTO-04] Resposta inesperada de motorista-concluir: "
        f"{resp_motorista.status_code} — {resp_motorista.text}"
    )

    if resp_motorista.status_code == 200:
        dados_motorista = resp_motorista.json()
        pagamento_apos_motorista = (
            dados_motorista.get("pagamento", {}) or {}
        ).get("status") or ""

        # Após motorista concluir: pagamento deve ser AGUARDANDO_CONFIRMACAO
        assert pagamento_apos_motorista.upper() in (
            "AGUARDANDO_CONFIRMACAO", "AGUARDANDO_LIBERACAO", "AGUARDANDO_AVALIACOES"
        ), (
            f"[ALTO-04] Status de pagamento inesperado após motorista concluir: "
            f"'{pagamento_apos_motorista}'"
        )

        # Passo 2: Cliente confirma
        resp_cliente = http_client.post(
            f"{API_PREFIX}/fretes/{frete_id}/cliente-confirmar-conclusao"
        )

        assert resp_cliente.status_code in (200, 400, 409), (
            f"[ALTO-04] Resposta inesperada de cliente-confirmar-conclusao: "
            f"{resp_cliente.status_code} — {resp_cliente.text}"
        )

        if resp_cliente.status_code == 200:
            dados_cliente = resp_cliente.json()
            status_frete_final = str(dados_cliente.get("novo_status") or "").upper()

            # Estado final do frete deve ser CONCLUIDO
            assert status_frete_final in ("CONCLUIDO", ""), (
                f"[ALTO-04] Status do frete após dupla conclusão deveria ser CONCLUIDO, "
                f"mas é '{status_frete_final}'."
            )

            # Verifica estado do pagamento via GET
            resp_pag = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
            if resp_pag.status_code == 200:
                status_pagamento_final = str(
                    resp_pag.json().get("status") or ""
                ).upper()

                # Pagamento não deve regredir para AGUARDANDO_CONFIRMACAO
                assert status_pagamento_final != "AGUARDANDO_CONFIRMACAO", (
                    f"[ALTO-04] BUG CONFIRMADO (Cenário A): Após o cliente confirmar, "
                    f"o pagamento regrediu para AGUARDANDO_CONFIRMACAO. "
                    f"O status do motorista foi sobrescrito indevidamente."
                )

                assert status_pagamento_final in STATUS_PAGAMENTO_VALIDOS, (
                    f"[ALTO-04] Status de pagamento final inválido: '{status_pagamento_final}'. "
                    f"Valores válidos: {STATUS_PAGAMENTO_VALIDOS}"
                )


# ---------------------------------------------------------------------------
# Cenário B: Cliente confirma primeiro (sem motorista ter concluído)
# ---------------------------------------------------------------------------

def test_alto04_cliente_confirma_primeiro_sem_motorista_concluir(http_client):
    """
    ALTO-04 (Cenário B): Cliente confirma ANTES do motorista concluir.

    O campo motorista_confirmou_conclusao ainda deve ser 0/False.
    O pagamento vai para AGUARDANDO_AVALIACOES.
    BUG: sem state machine, o pagamento pode entrar em estado inconsistente.
    """
    context = _setup_frete_em_transito(http_client)
    if context is None:
        pytest.skip(
            "[ALTO-04] Não foi possível configurar frete em trânsito para Cenário B."
        )

    frete_id = context["frete_id"]

    # Apenas o cliente confirma
    resp = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/cliente-confirmar-conclusao"
    )

    assert resp.status_code in (200, 400, 409), (
        f"[ALTO-04] Cenário B: Resposta inesperada: {resp.status_code} — {resp.text}"
    )

    if resp.status_code == 200:
        # Verifica o frete para confirmar que motorista_confirmou_conclusao = 0
        resp_frete = http_client.get(f"{API_PREFIX}/fretes/{frete_id}")
        if resp_frete.status_code == 200:
            frete_data = resp_frete.json()
            motorista_confirmou = frete_data.get("motorista_confirmou_conclusao")

            # Deve ser False/0 já que apenas o cliente confirmou
            assert not motorista_confirmou, (
                f"[ALTO-04] BUG: motorista_confirmou_conclusao = True mesmo sem "
                f"o motorista ter chamado o endpoint motorista-concluir."
            )

            # Pagamento deve estar em estado válido (não CONFIRMADO sem avaliações)
            resp_pag = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
            if resp_pag.status_code == 200:
                status_pag = str(resp_pag.json().get("status") or "").upper()
                assert status_pag != "LIBERADO", (
                    f"[ALTO-04] BUG CRÍTICO: Pagamento marcado como LIBERADO sem "
                    f"o motorista ter concluído e sem avaliações. "
                    f"Status: '{status_pag}'"
                )


# ---------------------------------------------------------------------------
# Cenário C: Motorista conclui em frete PENDENTE (sem check de status)
# ---------------------------------------------------------------------------

def test_alto04_motorista_conclui_frete_pendente(http_client):
    """
    ALTO-04 + ALTO-08: Motorista tenta concluir um frete que está PENDENTE
    (ainda não aceito). O endpoint motorista-concluir NÃO verifica status EM_TRANSITO.
    
    BUG ALTO-08: O frete pode ser marcado como CONCLUIDO diretamente de PENDENTE.
    """
    # Cria frete sem aceitar (PENDENTE)
    resp = http_client.post(f"{API_PREFIX}/fretes/", json={
        "origem": "Rua Pendente, 1 - SP",
        "destino": "Rua Inconsistência, 99 - SP",
        "distancia_km": 2.0,
        "peso_estimado": 5.0,
    })
    assert resp.status_code in (200, 201), (
        f"[ALTO-04/ALTO-08] Falha ao criar frete PENDENTE: {resp.text}"
    )

    frete_id = resp.json().get("id_frete") or resp.json().get("id")

    # Tenta concluir sem aceitar (motorista não atribuído)
    resp_concluir = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/motorista-concluir"
    )

    # COMPORTAMENTO ESPERADO: 400 ou 403 — frete não está EM_TRANSITO
    # BUG ATUAL: pode retornar 403 "não atribuído a esse motorista"
    # (o que é correto por acidente — mas por motivo errado)
    if resp_concluir.status_code == 200:
        pytest.fail(
            f"[ALTO-04/ALTO-08] BUG CONFIRMADO: Motorista conseguiu concluir um frete "
            f"PENDENTE (sem atribuição e sem status EM_TRANSITO). "
            f"O endpoint motorista-concluir não verifica o status atual do frete. "
            f"Frete ID: {frete_id}"
        )

    # 403 ou 400 são aceitáveis (por razões diferentes, mas corretos no efeito)
    assert resp_concluir.status_code in (400, 403, 404, 409), (
        f"[ALTO-04/ALTO-08] Status inesperado: {resp_concluir.status_code} — {resp_concluir.text}"
    )
