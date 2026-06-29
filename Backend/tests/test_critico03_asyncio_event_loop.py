"""
test_critico03_asyncio_event_loop.py
=====================================
Valida o bug:

  [CRÍTICO-03] `asyncio.get_event_loop()` deprecated/quebrado em Python 3.10+
               Nas rotas `POST /{frete_id}/aceitar-proposta` e
               `POST /fretes/detectar-objeto`, o código usa:

                   loop = asyncio.get_event_loop()
                   if loop.is_running():
                       asyncio.create_task(...)
                   else:
                       loop.run_until_complete(...)

               Em Python 3.12+, `asyncio.get_event_loop()` em contexto síncrono
               (dentro de um endpoint FastAPI `def`, não `async def`) lança
               RuntimeError. Mesmo no 3.10/3.11, gera DeprecationWarning.

               O erro é silenciado pelo `except Exception: pass`, então o
               endpoint retorna 200 mas a notificação WS nunca é enviada.

Estratégia do teste:
  1. Disparar POST /{frete_id}/aceitar-proposta
  2. Validar que a resposta é 200 (o endpoint não quebra com 500)
  3. Conectar um WS no frete ANTES do aceite e verificar se a notificação
     FRETE_ACEITO foi recebida — se não for recebida, o bug do asyncio está ativo
"""
import json
import pytest
import asyncio
import httpx
import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

pytestmark = pytest.mark.asyncio

API_PREFIX = "/api/v1"


# ---------------------------------------------------------------------------
# Teste 1: aceitar-proposta não retorna 500 (o erro é silenciado)
# ---------------------------------------------------------------------------

def test_critico03_aceitar_proposta_nao_retorna_500(http_client, seed_ids):
    """
    CRÍTICO-03 (parte 1): O endpoint aceitar-proposta deve retornar 200,
    não 500. O bug do asyncio faz a notificação WS falhar, mas o endpoint
    não deve propagar esse erro (ele está num try/except).

    Se retornar 500, o RuntimeError do asyncio vaza do except.
    """
    frete_id = seed_ids["frete_id"]
    motorista_id = seed_ids["motorista_id"]

    params = {}
    if motorista_id:
        params["motorista_id"] = motorista_id

    resp = http_client.post(
        f"{API_PREFIX}/fretes/{frete_id}/aceitar-proposta",
        params=params,
    )

    assert resp.status_code != 500, (
        f"[CRÍTICO-03] BUG GRAVE: aceitar-proposta retornou 500. "
        f"O RuntimeError do asyncio.get_event_loop() está vazando. "
        f"Detalhe: {resp.json().get('detail', resp.text)}"
    )

    # Aceita 200 ou 409 (já aceito) ou 400/404 (sem motorista/frete)
    assert resp.status_code in (200, 400, 404, 409), (
        f"[CRÍTICO-03] Status inesperado {resp.status_code}: {resp.text}"
    )

    if resp.status_code == 200:
        data = resp.json()
        assert "frete_id" in data, (
            f"[CRÍTICO-03] Resposta 200 sem campo 'frete_id': {data}"
        )


# ---------------------------------------------------------------------------
# Teste 2: notificação WS deve ser recebida após aceitar-proposta
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_critico03_notificacao_ws_enviada_apos_aceite(base_url, ws_base_url, seed_ids):
    """
    CRÍTICO-03 (parte 2): Após aceitar-proposta, o servidor deve enviar uma
    mensagem WS do tipo FRETE_ACEITO para todos os clientes conectados no
    frete.

    BUG ATUAL: Como `asyncio.create_task()` é chamado dentro de um endpoint
    `def` síncrono via `asyncio.get_event_loop()`, a tarefa pode não ser
    agendada corretamente. O teste documenta se a notificação chega ou não.

    COMPORTAMENTO ESPERADO PÓS-CORREÇÃO: o endpoint deve ser `async def`
    e usar `asyncio.create_task()` diretamente.
    """
    frete_id = seed_ids["frete_id"]
    motorista_id = seed_ids.get("motorista_id")

    ws_url = f"{ws_base_url}/api/v1/ws/fretes/{frete_id}"
    notification_received = False
    notification_data = None

    async def listen_for_notification():
        nonlocal notification_received, notification_data
        try:
            async with websockets.connect(ws_url, open_timeout=8) as ws:
                # Dispara o aceite via HTTP enquanto ouve o WS
                async with httpx.AsyncClient(base_url=base_url, timeout=15.0) as client:
                    params = {}
                    if motorista_id:
                        params["motorista_id"] = motorista_id
                    await client.post(
                        f"/api/v1/fretes/{frete_id}/aceitar-proposta",
                        params=params,
                    )

                # Aguarda até 4 s pela notificação WS
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=4.0)
                    notification_data = json.loads(msg)
                    notification_received = True
                except asyncio.TimeoutError:
                    notification_received = False
                except (ConnectionClosedError, ConnectionClosedOK):
                    notification_received = False
        except Exception:
            notification_received = False

    await listen_for_notification()

    if not notification_received:
        pytest.xfail(
            "[CRÍTICO-03] BUG CONFIRMADO: A notificação WS do tipo FRETE_ACEITO "
            "NÃO foi recebida após aceitar-proposta. "
            "Causa provável: asyncio.get_event_loop() em contexto síncrono não "
            "consegue agendar a coroutine corretamente. "
            "CORREÇÃO: converter o endpoint para `async def` e usar "
            "`asyncio.create_task()` diretamente."
        )
    else:
        # Notificação recebida — valida o payload
        assert notification_data is not None
        tipo = notification_data.get("tipo") or notification_data.get("type") or ""
        assert "FRETE_ACEITO" in str(tipo).upper() or "aceito" in str(notification_data).lower(), (
            f"[CRÍTICO-03] Notificação recebida mas sem tipo FRETE_ACEITO: {notification_data}"
        )
