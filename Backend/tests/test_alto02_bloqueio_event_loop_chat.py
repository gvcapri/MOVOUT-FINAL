"""
test_alto02_bloqueio_event_loop_chat.py
=========================================
Valida o bug:

  [ALTO-02] `_salvar_mensagem` em WebSocket de chat abre Session síncrona
            dentro de contexto assíncrono, bloqueando o event loop.

            Código problemático em websockets.py:
                def _salvar_mensagem(...):
                    def work():
                        with Session(engine) as session:  # ← síncrono
                            ...
                    return _execute_with_retry(work)

            Chamado dentro de `async def websocket_chat(...)` via `await` implícito.
            Como Session usa pymysql (síncrono), cada INSERT de mensagem bloqueia
            o event loop de forma síncrona.

Estratégia do teste:
  - Conectar 2 clientes WebSocket no mesmo chat
  - Enviar mensagens concorrentes de ambos os clientes em paralelo
  - Medir o tempo de resposta: se o event loop estiver bloqueado, o segundo
    cliente vai esperar o primeiro terminar (latência aditiva)
  - Validar que TODOS os clientes recebem as mensagens dos outros
    (broadcast correto mesmo com sessão síncrona)

  O teste NÃO faz assertion hard sobre latência (variável por ambiente),
  mas registra um aviso se a latência for suspeita de bloqueio.
"""
import json
import time
import asyncio
import pytest
import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

pytestmark = pytest.mark.asyncio

CHAT_MSG_COUNT = 5  # mensagens por cliente
CHAT_TIMEOUT = 20.0  # segundos máximos para o teste completo


def _chat_url(ws_base_url: str, frete_id: int) -> str:
    return f"{ws_base_url}/api/v1/ws/chat/{frete_id}"


async def _send_messages_and_collect(
    ws_url: str,
    sender_name: str,
    messages_to_send: list[str],
    results: dict,
):
    """
    Conecta ao WS de chat, envia as mensagens e coleta todas as mensagens
    recebidas (incluindo as do outro cliente via broadcast).
    """
    received = []
    send_times = []
    recv_times = []

    try:
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            results[sender_name + "_connected"] = True

            for msg_text in messages_to_send:
                payload = json.dumps({
                    "text": msg_text,
                    "sender": "user" if "cliente" in sender_name else "driver",
                })
                t0 = time.monotonic()
                await ws.send(payload)
                send_times.append(t0)

                # Aguarda o echo/broadcast da mensagem enviada
                try:
                    echo = await asyncio.wait_for(ws.recv(), timeout=8.0)
                    recv_times.append(time.monotonic())
                    received.append(json.loads(echo))
                except asyncio.TimeoutError:
                    results[sender_name + "_timeout"] = True
                    break
                except (ConnectionClosedError, ConnectionClosedOK):
                    results[sender_name + "_connection_closed"] = True
                    break

            results[sender_name + "_received"] = received
            results[sender_name + "_send_times"] = send_times
            results[sender_name + "_recv_times"] = recv_times

    except Exception as exc:
        results[sender_name + "_error"] = str(exc)


@pytest.mark.asyncio
async def test_alto02_dois_clientes_chat_concorrente(ws_base_url, seed_ids):
    """
    ALTO-02: Dois clientes WebSocket de chat enviam mensagens concorrentemente.

    Verifica:
    1. Ambos os clientes conseguem conectar
    2. Cada cliente recebe ao menos 1 mensagem de volta (broadcast funcionando)
    3. O tempo total não indica bloqueio serial excessivo
    """
    frete_id = seed_ids["frete_id"]
    ws_url = _chat_url(ws_base_url, frete_id)

    results = {}
    messages_cliente = [f"Msg-Cliente-{i}" for i in range(1, CHAT_MSG_COUNT + 1)]
    messages_motorista = [f"Msg-Motorista-{i}" for i in range(1, CHAT_MSG_COUNT + 1)]

    t_start = time.monotonic()

    # Roda os dois clientes em paralelo
    await asyncio.gather(
        _send_messages_and_collect(ws_url, "cliente", messages_cliente, results),
        _send_messages_and_collect(ws_url, "motorista", messages_motorista, results),
    )

    t_total = time.monotonic() - t_start

    # --- Validações ---

    # 1. Ambos conectaram
    assert results.get("cliente_connected"), (
        "[ALTO-02] Cliente WS não conseguiu conectar ao chat."
    )
    assert results.get("motorista_connected"), (
        "[ALTO-02] Motorista WS não conseguiu conectar ao chat."
    )

    # 2. Nenhum timeout
    assert not results.get("cliente_timeout"), (
        "[ALTO-02] BUG SUSPEITO: Cliente WS entrou em timeout aguardando resposta do chat. "
        "Provável bloqueio do event loop pela Session síncrona."
    )
    assert not results.get("motorista_timeout"), (
        "[ALTO-02] BUG SUSPEITO: Motorista WS entrou em timeout aguardando resposta do chat. "
        "Provável bloqueio do event loop pela Session síncrona."
    )

    # 3. Nenhum erro de conexão
    assert not results.get("cliente_error"), (
        f"[ALTO-02] Erro no cliente WS: {results.get('cliente_error')}"
    )
    assert not results.get("motorista_error"), (
        f"[ALTO-02] Erro no motorista WS: {results.get('motorista_error')}"
    )

    # 4. Mensagens recebidas
    cliente_received = results.get("cliente_received", [])
    motorista_received = results.get("motorista_received", [])

    assert len(cliente_received) > 0, (
        "[ALTO-02] Cliente não recebeu nenhuma mensagem de volta."
    )
    assert len(motorista_received) > 0, (
        "[ALTO-02] Motorista não recebeu nenhuma mensagem de volta."
    )

    # 5. Aviso de latência (não-bloqueante, apenas informativo)
    # Sem bloqueio: todas as mensagens em paralelo devem completar em ~N*latência_db
    # Com bloqueio: latência ≈ N_total * latência_individual (serial)
    msgs_totais = CHAT_MSG_COUNT * 2
    latencia_media = t_total / msgs_totais if msgs_totais > 0 else 0

    if latencia_media > 3.0:
        pytest.warns(
            UserWarning,
            match="ALTO-02",
        )
        import warnings
        warnings.warn(
            f"[ALTO-02] AVISO DE PERFORMANCE: Latência média por mensagem = "
            f"{latencia_media:.2f}s (total: {t_total:.2f}s para {msgs_totais} msgs). "
            f"Valor acima de 3s sugere bloqueio do event loop pela Session síncrona "
            f"em _salvar_mensagem. Considere usar run_in_executor() ou AsyncSession.",
            UserWarning,
            stacklevel=2,
        )


@pytest.mark.asyncio
async def test_alto02_mensagens_tem_campos_obrigatorios(ws_base_url, seed_ids):
    """
    ALTO-02 (parte 2): Valida que as mensagens retornadas pelo WS de chat
    têm a estrutura correta (id_mensagem, conteudo, tipo_remetente, etc.).
    Uma Session síncrona que falha silenciosamente retornaria estrutura incorreta.
    """
    frete_id = seed_ids["frete_id"]
    ws_url = _chat_url(ws_base_url, frete_id)

    received_msg = None

    try:
        async with websockets.connect(ws_url, open_timeout=10) as ws:
            payload = json.dumps({"text": "Teste estrutura ALTO-02", "sender": "user"})
            await ws.send(payload)

            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=8.0)
                received_msg = json.loads(raw)
            except asyncio.TimeoutError:
                pytest.fail(
                    "[ALTO-02] Timeout ao aguardar resposta do chat. "
                    "Possível bloqueio do event loop."
                )
    except Exception as exc:
        pytest.fail(f"[ALTO-02] Falha na conexão WS do chat: {exc}")

    assert received_msg is not None, "[ALTO-02] Nenhuma mensagem retornada pelo chat WS."

    campos_obrigatorios = ["id_mensagem", "conteudo", "tipo_remetente", "sender", "criada_em"]
    campos_ausentes = [c for c in campos_obrigatorios if c not in received_msg]

    assert not campos_ausentes, (
        f"[ALTO-02] Mensagem do chat sem campos obrigatórios: {campos_ausentes}. "
        f"Mensagem recebida: {received_msg}"
    )
