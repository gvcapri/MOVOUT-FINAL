# 🧪 Guia de Testes de Regressão — Movout Backend

Scripts de teste criados para validar os bugs críticos identificados no diagnóstico do backend.
**Não requerem rodar o app mobile** — testam diretamente a API local via HTTP e WebSocket.

---

## 📋 Bugs Validados

| Arquivo de Teste | Ref. Diagnóstico | Bug Validado |
|---|---|---|
| `test_critico02_alto03_websocket_motorista.py` | CRÍTICO-02, ALTO-03 | Redis silencioso + frete_id=None derruba WS |
| `test_critico03_asyncio_event_loop.py` | CRÍTICO-03 | asyncio.get_event_loop() quebrado no Python 3.10+ |
| `test_critico07_tabelas_fantasma.py` | CRÍTICO-07 | SQLModel cria tabelas fantasma (sem sufixo 7) |
| `test_alto02_bloqueio_event_loop_chat.py` | ALTO-02 | Session síncrona bloqueia event loop no chat WS |
| `test_alto04_race_condition_conclusao.py` | ALTO-04 | Race condition na conclusão do frete (pagamento inconsistente) |
| `test_alto06_rota_detectar_objeto.py` | ALTO-06 | Rota /detectar-objeto sombreada pelas rotas dinâmicas (422) |
| `test_alto07_driver_id_incorreto.py` | ALTO-07 | driver.id retorna id_negociacao em vez de id_motorista |

---

## ⚡ Pré-requisitos

### 1. Backend rodando localmente

```powershell
# Na pasta Backend/
cd Backend
python main.py
# Ou: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

O servidor deve estar acessível em `http://localhost:8000`.

> **⚠️ IMPORTANTE:** O banco de dados (TiDB/MySQL) deve estar conectado e com dados de seed
> (ao menos um motorista e um cliente cadastrados). Os testes lêem dados reais do banco.

### 2. Instalar dependências de teste

```powershell
# Com o .venv ativado:
.venv\Scripts\activate

# Instalar dependências de teste
pip install -r tests/requirements-test.txt
```

---

## 🚀 Executar os Testes

### Rodar toda a suíte
```powershell
cd Backend
pytest tests/ -v --tb=short
```

### Rodar um arquivo específico
```powershell
# Apenas o teste da rota detectar-objeto (mais rápido, só HTTP)
pytest tests/test_alto06_rota_detectar_objeto.py -v

# Apenas testes WebSocket (precisam do servidor UP)
pytest tests/test_critico02_alto03_websocket_motorista.py -v
pytest tests/test_alto02_bloqueio_event_loop_chat.py -v
```

### Rodar com saída detalhada em caso de falha
```powershell
pytest tests/ -v --tb=long -s
```

### Apontar para outro host (ex: servidor de staging)
```powershell
$env:MOVOUT_TEST_BASE_URL = "http://192.168.1.100:8000"
pytest tests/ -v
```

---

## 🔍 Como Interpretar os Resultados

### `PASSED` ✅
O bug foi **corrigido** ou o comportamento esperado está funcionando.

### `FAILED` ❌
O bug está **presente**. A mensagem de erro explica exatamente qual é o problema
e, em muitos casos, indica a linha exata do código a corrigir.

### `XFAIL` ⚠️
Teste marcado como "falha esperada" — o bug existe e foi documentado.
Quando a correção for feita, o teste vai de `XFAIL` para `PASSED`.

### `SKIPPED` ⏭️
O teste foi pulado porque faltam dados de seed no banco (ex: sem motorista cadastrado).
Não indica bug — indica que o ambiente de teste está incompleto.

---

## 🐛 Detalhes dos Bugs por Teste

### CRÍTICO-02 + ALTO-03: WebSocket do Motorista
**Arquivo:** `test_critico02_alto03_websocket_motorista.py`

- **ALTO-03** → Envia payload sem `frete_id`. Espera que a conexão **caia** (bug confirmado)
  ou que o servidor responda com erro controlado (pós-correção).
- **CRÍTICO-02** → Envia payload completo. Mesmo que o Redis esteja DOWN, a conexão
  **não deve cair**. O erro de Redis deve ser logado, não silenciado.

**Correção esperada no código:**
```python
# Em websockets.py linha 41 — ANTES (bug):
frete_id = int(data.get('frete_id'))  # TypeError se None

# DEPOIS (correto):
raw = data.get('frete_id')
if raw is None:
    await websocket.send_json({"erro": "frete_id obrigatório"})
    continue
frete_id = int(raw)
```

---

### CRÍTICO-03: asyncio.get_event_loop() em Python 3.12+
**Arquivo:** `test_critico03_asyncio_event_loop.py`

- **Parte 1** → Verifica que `aceitar-proposta` NÃO retorna 500.
- **Parte 2** → Verifica que a notificação WS é enviada. Usa `pytest.xfail` se não for
  (bug presente mas não 500).

**Correção esperada:**
```python
# ANTES (bug):
loop = asyncio.get_event_loop()
if loop.is_running():
    asyncio.create_task(...)

# DEPOIS (correto — tornar o endpoint async def):
async def aceitar_proposta(...):
    ...
    asyncio.create_task(manager.send_location(frete_id, ws_payload))
```

---

### CRÍTICO-07: Tabelas Fantasma do SQLModel
**Arquivo:** `test_critico07_tabelas_fantasma.py`

- Cria fretes via API e verifica que eles aparecem na listagem e podem ser
  recuperados pelo ID. Se o dado for para tabela fantasma (`pedidofrete`),
  as queries SQL brutas que lêem de `frete7` não encontrarão o registro.

**Correção esperada em `models.py`:**
```python
class Motorista(SQLModel, table=True):
    __tablename__ = "motorista7"  # ← adicionar

class PedidoFrete(SQLModel, table=True):
    __tablename__ = "frete7"  # ← adicionar
```

---

### ALTO-02: Bloqueio do Event Loop no Chat
**Arquivo:** `test_alto02_bloqueio_event_loop_chat.py`

- Conecta 2 clientes no chat e envia mensagens concorrentes.
- Mede latência total — se for muito alta, indica bloqueio serial.
- Valida estrutura das mensagens retornadas.

---

### ALTO-04: Race Condition na Conclusão
**Arquivo:** `test_alto04_race_condition_conclusao.py`

- **Cenário A**: Motorista conclui → cliente confirma → valida que pagamento não regride.
- **Cenário B**: Cliente confirma antes do motorista → valida `motorista_confirmou_conclusao=0`.
- **Cenário C**: Motorista tenta concluir frete PENDENTE → espera 400/403.

---

### ALTO-06: Rota Detectar-Objeto Sombreada
**Arquivo:** `test_alto06_rota_detectar_objeto.py`

- **Teste crítico**: `POST /fretes/detectar-objeto` deve retornar **qualquer coisa exceto 422**.
- 422 = bug confirmado (rota capturada pelo parâmetro dinâmico `{frete_id}`).

**Correção:** mover a declaração de `@router.post("/detectar-objeto")` para
**antes** de qualquer `@router.post("/{frete_id}/...")` no arquivo `fretes.py`.

---

### ALTO-07: driver.id Incorreto na Negociação Ativa
**Arquivo:** `test_alto07_driver_id_incorreto.py`

- Cria negociação e chama `GET /cliente/me/negociacao_ativa`.
- Verifica que `driver.id != id_negociacao` e `driver.id == id_motorista`.

**Correção em `cliente.py` linha 181:**
```python
# ANTES (bug):
"id": int(m["id_negociacao"]),

# DEPOIS (correto):
"id": int(m["id_motorista"]),
```

---

## 📂 Estrutura dos Arquivos

```
Backend/
├── pytest.ini                        ← configuração global do pytest
└── tests/
    ├── __init__.py
    ├── conftest.py                   ← fixtures compartilhadas (http_client, seed_ids)
    ├── requirements-test.txt         ← dependências de teste
    ├── test_critico02_alto03_websocket_motorista.py
    ├── test_critico03_asyncio_event_loop.py
    ├── test_critico07_tabelas_fantasma.py
    ├── test_alto02_bloqueio_event_loop_chat.py
    ├── test_alto04_race_condition_conclusao.py
    ├── test_alto06_rota_detectar_objeto.py
    └── test_alto07_driver_id_incorreto.py
```
