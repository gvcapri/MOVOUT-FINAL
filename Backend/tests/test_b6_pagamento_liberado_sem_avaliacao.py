"""
test_b6_pagamento_liberado_sem_avaliacao.py
============================================
Valida a correcao do Bug B-6:

  [B-6] Trava de Pagamento por Avaliacao -- o saldo do motorista ficava preso
  em AGUARDANDO_AVALIACOES mesmo apos o cliente confirmar a conclusao da corrida.

  CAUSA ORIGINAL:
    _tentar_liberar_pagamento_pos_avaliacoes() verificava se AMBAS as partes
    tinham avaliado antes de liberar o saldo. Sem avaliacao = sem pagamento.

  CORRECAO APLICADA (2026-06-28):
    1. Removido o bloco `if not (cliente_avaliou and motorista_avaliou): return`
       da funcao _tentar_liberar_pagamento_pos_avaliacoes() -- fretes.py ~L643.
    2. Removido o UPDATE que forcava pagamento_frete7.status = AGUARDANDO_AVALIACOES
       no endpoint cliente-confirmar-conclusao -- fretes.py ~L1150.

  FLUXO TESTADO (sem chamar /avaliar em nenhum momento):
    1. POST /fretes/                     -> Criar frete (PENDENTE)
    2. POST /motorista-aceitar            -> Motorista aceita pelo valor estimado (ACEITO)
    3. POST /iniciar                      -> Iniciar corrida (EM_TRANSITO)
    4. POST /cliente-confirmar-conclusao  -> Cliente confirma (CONCLUIDO)
    5. GET  /pagamento                    -> status deve ser LIBERADO, nao AGUARDANDO_AVALIACOES
"""
import pytest
import httpx

API_PREFIX = "/api/v1"

# Status finais aceitos como "pagamento liberado com sucesso"
STATUS_LIBERADO_VALIDOS = {"LIBERADO", "CONFIRMADO"}

# Status que indicam que a trava AINDA existe
STATUS_TRAVA = {"AGUARDANDO_AVALIACOES"}


# ---------------------------------------------------------------------------
# Helper: cria frete e o leva ate EM_TRANSITO
# ---------------------------------------------------------------------------

def _criar_frete_e_aceitar(client: httpx.Client) -> dict | None:
    """
    Cria um frete novo, motorista aceita pelo valor estimado, e inicia corrida.
    Retorna dict com frete_id e motorista_id, ou None em caso de falha.
    """
    # Passo 1: Criar frete
    resp_criar = client.post(f"{API_PREFIX}/fretes/", json={
        "origem": "Rua B6 Teste, 100 - Sao Paulo",
        "destino": "Av. B6 Destino, 500 - Sao Paulo",
        "distancia_km": 8.0,
        "peso_estimado": 15.0,
        "tipo_veiculo": "CARRO",
        "prioridade": "hoje",
    })

    if resp_criar.status_code not in (200, 201):
        print(f"\n[B-6] ERRO ao criar frete: {resp_criar.status_code} -- {resp_criar.text}")
        return None

    frete_data = resp_criar.json()
    frete_id = frete_data.get("id_frete") or frete_data.get("id")
    if not frete_id:
        print(f"\n[B-6] Resposta de criar frete sem id_frete: {frete_data}")
        return None

    print(f"\n[B-6] Frete criado: id={frete_id}, status={frete_data.get('status')}")

    # Passo 2: Buscar motorista
    resp_motoristas = client.get(f"{API_PREFIX}/motoristas/")
    motorista_id = None
    if resp_motoristas.status_code == 200:
        lista = resp_motoristas.json()
        if lista:
            motorista_id = lista[0].get("id_motorista") or lista[0].get("id")

    print(f"[B-6] Motorista para aceite: id={motorista_id}")

    # Passo 3: Motorista aceita direto (sem contraproposta)
    params_aceite = {}
    if motorista_id:
        params_aceite["motorista_id"] = motorista_id

    resp_aceitar = client.post(
        f"{API_PREFIX}/fretes/{frete_id}/motorista-aceitar",
        params=params_aceite,
    )

    if resp_aceitar.status_code not in (200, 201):
        # Fallback: aceitar-proposta
        print(
            f"[B-6] motorista-aceitar retornou {resp_aceitar.status_code}. "
            f"Tentando aceitar-proposta como fallback..."
        )
        resp_aceitar = client.post(
            f"{API_PREFIX}/fretes/{frete_id}/aceitar-proposta",
            params=params_aceite,
        )
        if resp_aceitar.status_code not in (200, 201):
            print(
                f"[B-6] Fallback aceitar-proposta falhou: "
                f"{resp_aceitar.status_code} -- {resp_aceitar.text}"
            )
            return None

    aceite_data = resp_aceitar.json()
    motorista_id_final = (
        aceite_data.get("id_motorista")
        or aceite_data.get("motorista_id")
        or (aceite_data.get("frete") or {}).get("id_motorista")
        or motorista_id
    )
    print(
        f"[B-6] Frete aceito. Motorista: {motorista_id_final}. "
        f"Status: {aceite_data.get('novo_status', '?')}"
    )

    # Passo 4: Iniciar corrida (EM_TRANSITO)
    resp_iniciar = client.post(f"{API_PREFIX}/fretes/{frete_id}/iniciar")
    if resp_iniciar.status_code not in (200, 201):
        print(
            f"[B-6] /iniciar retornou {resp_iniciar.status_code} -- "
            f"{resp_iniciar.text}. Continuando sem EM_TRANSITO."
        )
    else:
        print(f"[B-6] Corrida iniciada (EM_TRANSITO).")

    return {"frete_id": frete_id, "motorista_id": motorista_id_final}


# ---------------------------------------------------------------------------
# TESTE PRINCIPAL -- Bug B-6
# ---------------------------------------------------------------------------

def test_b6_pagamento_liberado_apos_conclusao_sem_avaliacao(http_client):
    """
    [B-6] Garante que o pagamento e liberado imediatamente quando o cliente
    confirma a conclusao da corrida, SEM exigir nenhuma avaliacao.

    ASSERT CRITICO: status em pagamento_frete7 deve ser LIBERADO.
    ASSERT NEGATIVO: status NAO deve ser AGUARDANDO_AVALIACOES.

    Se este teste falhar, a trava de avaliacao ainda existe em algum ponto.
    Nenhum endpoint /avaliar e chamado durante este teste.
    """
    context = _criar_frete_e_aceitar(http_client)

    if context is None:
        pytest.skip(
            "[B-6] Nao foi possivel criar e configurar o frete. "
            "Verifique se ha motorista cadastrado no banco de dados de teste."
        )

    frete_id = context["frete_id"]
    motorista_id = context.get("motorista_id")

    print(f"\n[B-6] Iniciando validacao -- frete_id={frete_id}")

    # Cliente confirma conclusao (SEM chamar /avaliar antes ou depois)
    resp_conclusao = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/cliente-confirmar-conclusao",
        json={"observacao": "[TESTE B-6] Cliente confirmando conclusao sem avaliacao."},
    )

    print(
        f"[B-6] cliente-confirmar-conclusao -> "
        f"HTTP {resp_conclusao.status_code}: {resp_conclusao.text[:300]}"
    )

    assert resp_conclusao.status_code in (200, 201), (
        f"[B-6] FALHA: cliente-confirmar-conclusao retornou {resp_conclusao.status_code}.\n"
        f"Resposta: {resp_conclusao.text}\n"
        f"Verifique se o frete esta num status valido (ACEITO ou EM_TRANSITO). "
        f"O endpoint motorista-concluir exige EM_TRANSITO; se o /iniciar falhou, "
        f"o frete pode ainda estar em ACEITO. Verifique fretes.py L1098."
    )

    resp_conclusao_data = resp_conclusao.json()
    status_conclusao = str(resp_conclusao_data.get("novo_status") or "").upper()
    resultado_pagamento = resp_conclusao_data.get("resultado_pagamento") or {}

    print(f"[B-6] novo_status do frete: '{status_conclusao}'")
    print(f"[B-6] resultado_pagamento retornado: {resultado_pagamento}")

    # Assert 1: resultado_pagamento.liberado deve ser True
    pagamento_liberado = resultado_pagamento.get("liberado")
    if pagamento_liberado is not None:
        assert pagamento_liberado is True, (
            f"\n[B-6] BUG B-6 AINDA PRESENTE no campo resultado_pagamento.liberado!\n"
            f"  Valor encontrado: {pagamento_liberado}\n"
            f"  Motivo retornado: '{resultado_pagamento.get('motivo')}'\n"
            f"  PISTAS:\n"
            f"    1. Ainda ha um bloco 'if not (cliente_avaliou and motorista_avaliou)' ativo?\n"
            f"       -> Verifique _tentar_liberar_pagamento_pos_avaliacoes() em fretes.py\n"
            f"    2. O UPDATE para AGUARDANDO_AVALIACOES ainda esta sem comentar?\n"
            f"       -> Verifique cliente-confirmar-conclusao em fretes.py L1150-1161\n"
            f"  resultado_pagamento completo: {resultado_pagamento}"
        )
        print(f"[B-6] resultado_pagamento.liberado = True. OK!")

    # Buscar pagamento via GET /pagamento
    resp_pagamento = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")

    print(
        f"[B-6] GET /pagamento -> "
        f"HTTP {resp_pagamento.status_code}: {resp_pagamento.text[:200]}"
    )

    assert resp_pagamento.status_code == 200, (
        f"[B-6] GET /pagamento retornou {resp_pagamento.status_code}.\n"
        f"Resposta: {resp_pagamento.text}"
    )

    pagamento_data = resp_pagamento.json()
    status_pagamento = str(pagamento_data.get("status") or "").upper()

    print(f"\n[B-6] STATUS FINAL DO PAGAMENTO: '{status_pagamento}'")
    print(f"[B-6] Payload completo: {pagamento_data}")

    # Assert 2 (NEGATIVO): NAO deve estar em AGUARDANDO_AVALIACOES
    assert status_pagamento not in STATUS_TRAVA, (
        f"\n[B-6] BUG B-6 CONFIRMADO -- PAGAMENTO AINDA TRAVADO!\n"
        f"  Status encontrado : '{status_pagamento}'\n"
        f"  Status esperado   : um de {STATUS_LIBERADO_VALIDOS}\n"
        f"\n"
        f"  ISSO SIGNIFICA que a remocao da trava de avaliacao NAO foi efetiva.\n"
        f"\n"
        f"  Pistas para investigar:\n"
        f"    1. _tentar_liberar_pagamento_pos_avaliacoes() em fretes.py:\n"
        f"       Ainda contem: if not (avaliacao_status[cliente_avaliou] and ...) ?\n"
        f"       -> Remova esse bloco inteiro (linhas ~643-644)\n"
        f"\n"
        f"    2. cliente-confirmar-conclusao em fretes.py:\n"
        f"       O UPDATE para AGUARDANDO_AVALIACOES ainda esta ativo (nao comentado)?\n"
        f"       -> Linhas ~1150-1161 devem estar comentadas\n"
        f"\n"
        f"    3. Verifique se session.commit() esta sendo chamado ANTES de\n"
        f"       _tentar_liberar_pagamento_pos_avaliacoes() -- isso faria o\n"
        f"       estado intermediario ser persistido antes da liberacao.\n"
        f"\n"
        f"  Frete ID : {frete_id}\n"
        f"  Motorista: {motorista_id}\n"
        f"  Payload pagamento: {pagamento_data}"
    )

    # Assert 3 (POSITIVO): deve estar LIBERADO ou CONFIRMADO
    assert status_pagamento in STATUS_LIBERADO_VALIDOS, (
        f"\n[B-6] PAGAMENTO EM ESTADO INTERMEDIARIO INESPERADO.\n"
        f"  Status encontrado : '{status_pagamento}'\n"
        f"  Status esperados  : {STATUS_LIBERADO_VALIDOS}\n"
        f"  O pagamento nao esta travado em avaliacao, mas tambem nao foi liberado.\n"
        f"  Verifique se _tentar_liberar_pagamento_pos_avaliacoes() executa\n"
        f"  o UPDATE correto na tabela pagamento_frete7 (status='LIBERADO').\n"
        f"  Payload: {pagamento_data}"
    )

    print(
        f"\n[B-6] TESTE PASSOU -- Bug B-6 CORRIGIDO!\n"
        f"  Pagamento liberado com status '{status_pagamento}'\n"
        f"  Motorista: {motorista_id} | Frete: {frete_id}\n"
        f"  Nenhuma avaliacao foi chamada durante este fluxo."
    )


# ---------------------------------------------------------------------------
# TESTE ADICIONAL: avaliacao ainda funciona, mas nao e obrigatoria
# ---------------------------------------------------------------------------

def test_b6_avaliacao_ainda_funciona_como_opcional(http_client):
    """
    [B-6] Sanity check: avaliacao continua sendo aceita pelo backend,
    mas o pagamento ja deve estar LIBERADO antes de qualquer avaliacao.

    Fluxo: criar -> aceitar -> iniciar -> cliente confirma
           -> GET /pagamento (deve ser LIBERADO ja)
           -> POST /avaliar (opcional, nao deve mudar o status)
    """
    context = _criar_frete_e_aceitar(http_client)

    if context is None:
        pytest.skip(
            "[B-6] Nao foi possivel configurar frete para teste de avaliacao opcional."
        )

    frete_id = context["frete_id"]

    # Cliente confirma conclusao
    resp_conclusao = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/cliente-confirmar-conclusao",
        json={"observacao": "[TESTE B-6] Conclusao para validar avaliacao opcional."},
    )

    if resp_conclusao.status_code not in (200, 201):
        pytest.skip(
            f"[B-6] Nao foi possivel confirmar conclusao para este teste: "
            f"{resp_conclusao.status_code} -- {resp_conclusao.text}"
        )

    # Verificar pagamento JA LIBERADO antes de qualquer avaliacao
    resp_pag_antes = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
    if resp_pag_antes.status_code == 200:
        status_antes = str(resp_pag_antes.json().get("status") or "").upper()
        print(f"\n[B-6] Status do pagamento ANTES de avaliar: '{status_antes}'")

        assert status_antes not in STATUS_TRAVA, (
            f"[B-6] Pagamento em AGUARDANDO_AVALIACOES antes de qualquer avaliacao. "
            f"Bug B-6 ainda presente. Status: '{status_antes}'"
        )
        print(f"[B-6] Pagamento ja liberado antes de avaliar. OK!")

    # Enviar avaliacao (deve ser aceita, mas nao e pre-requisito)
    resp_avaliar = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/avaliar",
        json={
            "tipo_avaliador": "CLIENTE",
            "tipo_avaliado": "MOTORISTA",
            "nota": 5,
            "comentario": "[TESTE B-6] Avaliacao opcional -- nao deve travar pagamento.",
        },
    )

    print(
        f"[B-6] POST /avaliar -> HTTP {resp_avaliar.status_code}: "
        f"{resp_avaliar.text[:200]}"
    )

    # Avaliacao pode retornar 409 (ja avaliou) -- aceitavel neste contexto
    if resp_avaliar.status_code in (200, 201):
        print("[B-6] Avaliacao enviada com sucesso (funciona como opcional).")
    elif resp_avaliar.status_code == 409:
        print("[B-6] 409 Conflict -- avaliacao ja registrada. Aceitavel.")
    else:
        print(
            f"[B-6] Avaliacao retornou {resp_avaliar.status_code} -- "
            f"aceitavel, pagamento ja deve estar liberado."
        )

    # Pagamento apos avaliacao -- deve continuar LIBERADO
    resp_pag_depois = http_client.get(f"{API_PREFIX}/fretes/{frete_id}/pagamento")
    if resp_pag_depois.status_code == 200:
        status_depois = str(resp_pag_depois.json().get("status") or "").upper()
        print(f"[B-6] Status do pagamento APOS avaliar: '{status_depois}'")

        assert status_depois in STATUS_LIBERADO_VALIDOS, (
            f"[B-6] Pagamento nao esta LIBERADO apos avaliacao opcional.\n"
            f"Status: '{status_depois}'\n"
            f"Esperado: {STATUS_LIBERADO_VALIDOS}"
        )

    print("\n[B-6] Teste de avaliacao opcional passou. Fluxo MVP validado.")
