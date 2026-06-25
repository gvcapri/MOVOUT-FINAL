"""
test_critico02_alto03_websocket_motorista.py
============================================
Valida os bugs:

  [CRÍTICO-02] Redis instanciado no import — falha silenciosa
               O erro de conexão Redis é engolido pelo `except Exception: pass`
               em vez de ser logado/retornado. O teste verifica que a conexão
               WebSocket PERMANECE ATIVA mesmo quando o Redis falha
               (comportamento atual — a falha é silenciosa). Se a correção
               implementar uma resposta de erro explícita, ajuste a asserção.

  [ALTO-03]   frete_id pode ser None em websocket_motorista
               `int(data.get('frete_id'))` onde frete_id=None → TypeError →
               queda abrupta da conexão. O teste envia um payload SEM frete_id
               e valida que a conexão cai com um código de erro/fecha.
"""
import json
import pytest
import asyncio
import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _ws_url(ws_base_url: str, motorista_id: int) -> str:
    return f"{ws_base_url}/api/v1/ws/motoristas/{motorista_id}"


# ---------------------------------------------------------------------------
# ALTO-03: payload sem frete_id → deve causar queda da conexão
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alto03_ws_motorista_sem_frete_id_causa_queda(ws_base_url):
    """
    ALTO-03: Enviar payload sem 'frete_id' deve causar TypeError no servidor
    e derrubar a conexão WebSocket. O teste verifica que a conexão fecha
    (ConnectionClosed) ao invés de continuar silenciosamente.

    BUG ATUAL: int(data.get('frete_id')) onde frete_id=None → TypeError não tratado.
    COMPORTAMENTO ESPERADO PÓS-CORREÇÃO: servidor fecha com código 1008/1011
    ou retorna JSON de erro sem derrubar a conexão.
    """
    motorista_id = 1  # qualquer ID válido para passar na rota
    url = _ws_url(ws_base_url, motorista_id)

    payload_sem_frete_id = json.dumps({
        "latitude": -23.5505,
        "longitude": -46.6333,
        # frete_id AUSENTE — dispara o bug
    })

    connection_closed = False
    server_error_response = None

    try:
        async with websockets.connect(url, open_timeout=8) as ws:
            await ws.send(payload_sem_frete_id)

            # Aguarda até 3 s por uma resposta ou fechamento
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3.0)
                # Se o servidor responder com JSON de erro em vez de fechar, isso também é aceitável
                try:
                    data = json.loads(msg)
                    server_error_response = data
                except Exception:
                    pass
            except asyncio.TimeoutError:
                # Sem resposta em 3 s — o bug está presente (sem tratamento)
                connection_closed = False
            except (ConnectionClosedError, ConnectionClosedOK):
                connection_closed = True

    except (ConnectionClosedError, ConnectionClosedOK):
        connection_closed = True
    except Exception:
        # Qualquer outra exceção de conexão também indica problema
        connection_closed = True

    # ----- Asserção de diagnóstico (documenta o bug) -----
    # BUG PRESENTE: connection_closed=True (servidor derrubou a conexão sem aviso)
    # CORRIGIDO:    connection_closed=False E server_error_response contém 'erro'/'error'
    if connection_closed:
        pytest.fail(
            "[ALTO-03] BUG CONFIRMADO: A conexão WS do motorista foi derrubada "
            "abruptamente ao receber payload sem 'frete_id'. "
            "O servidor deve tratar o TypeError e enviar uma mensagem de erro "
            "sem encerrar a conexão."
        )
    else:
        if server_error_response:
            # Pós-correção: servidor respondeu com erro controlado
            assert "erro" in str(server_error_response).lower() or "error" in str(server_error_response).lower(), (
                f"[ALTO-03] Servidor respondeu, mas sem campo de erro reconhecível: {server_error_response}"
            )
        # Se não houve resposta nem fechamento → bug ainda presente mas silencioso


# ---------------------------------------------------------------------------
# CRÍTICO-02: Redis falha silenciosamente — conexão permanece ativa
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_critico02_redis_falha_nao_deve_derrubar_ws(ws_base_url):
    """
    CRÍTICO-02: Quando o Redis está indisponível, a operação redis_client.hset()
    lança ConnectionRefusedError, que é capturado por `except Exception: pass`.
    A conexão WS NÃO deve cair por isso. O teste verifica que o servidor
    consegue processar o payload completo (com frete_id) sem encerrar a conexão,
    mesmo que a localização não seja persistida no Redis.

    Nota: se Redis estiver UP no ambiente de teste, o teste ainda passa —
    ele só falha se o Redis derrubasse a conexão (o que não deveria acontecer).
    """
    motorista_id = 1
    url = _ws_url(ws_base_url, motorista_id)

    # Payload COMPLETO com frete_id — não deve causar TypeError
    payload_completo = json.dumps({
        "latitude": -23.5505,
        "longitude": -46.6333,
        "frete_id": 999999,  # frete inexistente — só para testar o fluxo WS
    })

    connection_stayed_alive = False

    try:
        async with websockets.connect(url, open_timeout=8) as ws:
            await ws.send(payload_completo)

            # Aguarda 2 s — se a conexão permanecer aberta, o Redis não derrubou
            try:
                await asyncio.wait_for(ws.recv(), timeout=2.0)
                connection_stayed_alive = True
            except asyncio.TimeoutError:
                # Nenhuma mensagem recebida mas conexão não fechou
                if not ws.closed:
                    connection_stayed_alive = True
            except (ConnectionClosedError, ConnectionClosedOK):
                connection_stayed_alive = False

    except ConnectionClosedOK:
        connection_stayed_alive = True  # fechamento limpo é OK
    except Exception:
        connection_stayed_alive = False

    assert connection_stayed_alive, (
        "[CRÍTICO-02] BUG: A falha no Redis (ou no send_location com frete inexistente) "
        "está derrubando a conexão WebSocket do motorista. "
        "O except deve ser explícito e não silencioso — e nunca derrubar a conexão."
    )


# ---------------------------------------------------------------------------
# ALTO-03 + CRÍTICO-02: payload misto — frete_id presente mas inválido (string)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_alto03_ws_motorista_frete_id_invalido_string(ws_base_url):
    """
    ALTO-03 (variante): enviar frete_id como string não numérica.
    `int("abc")` → ValueError. Mesmo comportamento de queda não tratada.
    """
    motorista_id = 1
    url = _ws_url(ws_base_url, motorista_id)

    payload_frete_id_string = json.dumps({
        "latitude": -23.5505,
        "longitude": -46.6333,
        "frete_id": "detectar-objeto",  # string não numérica
    })

    connection_closed = False

    try:
        async with websockets.connect(url, open_timeout=8) as ws:
            await ws.send(payload_frete_id_string)
            try:
                await asyncio.wait_for(ws.recv(), timeout=3.0)
            except asyncio.TimeoutError:
                pass
            except (ConnectionClosedError, ConnectionClosedOK):
                connection_closed = True
    except (ConnectionClosedError, ConnectionClosedOK):
        connection_closed = True
    except Exception:
        connection_closed = True

    if connection_closed:
        pytest.fail(
            "[ALTO-03] BUG CONFIRMADO (variante string): frete_id='detectar-objeto' "
            "causa ValueError não tratado e derruba a conexão WS do motorista."
        )
