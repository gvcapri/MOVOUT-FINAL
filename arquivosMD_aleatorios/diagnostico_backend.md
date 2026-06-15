# 🔍 Diagnóstico Completo do Backend — Movout API

> **Data da análise:** 14/06/2026  
> **Versão:** FastAPI + SQLModel + MySQL (TiDB Cloud)  
> **Arquivos analisados:** `main.py`, `database.py`, `config.py`, `auth.py`, `fretes.py`, `motoristas.py`, `cliente.py`, `websockets.py`, `ai_service.py`, `manager.py`, `models.py`, `redis.py`

---

## 📋 Sumário de Severidade

| Severidade | Qtd | Descrição Resumida |
|---|---|---|
| 🔴 **CRÍTICO** | 9 | Erros que quebram funcionalidade ou comprometem segurança |
| 🟠 **ALTO** | 8 | Problemas sérios que causam bugs ou comportamento inesperado |
| 🟡 **MÉDIO** | 10 | Avisos, má prática e inconsistências lógicas |
| 🔵 **BAIXO** | 6 | Código morto, duplicações e melhorias de qualidade |

---

## 🔴 ERROS CRÍTICOS

---

### [CRÍTICO-01] Token de autenticação hardcoded — `auth.py` linha 93

**Arquivo:** [`auth.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/auth.py#L91-L103)

```python
return {
    "status": "sucesso",
    "token": "token-temporario-real",  # ← PROBLEMA CRÍTICO
    ...
}
```

**Problema:** O endpoint `/api/v1/auth/login` retorna a string literal `"token-temporario-real"` como token de autenticação. Isso significa que **qualquer usuário que faça login recebe o mesmo token**, e a API não possui qualquer camada real de autenticação/autorização.

**Impacto:**
- Qualquer pessoa pode forjar requisições passando `"token-temporario-real"` como token.
- Nenhuma rota protege recursos por identidade do usuário autenticado — não há middleware de JWT.
- `PyJWT` está no `requirements.txt` mas **nunca é usado em nenhum arquivo**.

---

### [CRÍTICO-02] Redis instanciado no import — falha silenciosa em produção — `redis.py` linha 4

**Arquivo:** [`redis.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/core/redis.py)

```python
redis_client = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)
```

**Problema:** O cliente Redis é instanciado no momento do import do módulo. Se Redis não estiver rodando (caso do TiDB Cloud / deploy em qualquer ambiente sem Redis local), isso não lança exceção imediatamente, mas **qualquer operação `redis_client.hset()` ou `redis_client.expire()` falha com `ConnectionRefusedError`**.

Em `websockets.py`, o uso está dentro de um `try/except` genérico que **silencia o erro**:

```python
try:
    redis_client.hset(chave, mapping=...)
    redis_client.expire(chave, 30)
except Exception:
    pass  # ← erro engolido silenciosamente
```

**Impacto:** A funcionalidade de localização do motorista em tempo real **nunca persiste localização** no ambiente atual (sem Redis). Não há nenhum fallback ou log do estado da conexão Redis.

---

### [CRÍTICO-03] `asyncio.get_event_loop()` deprecated em Python 3.10+ — `fretes.py` linhas 939 e 1167

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L936-L945)

```python
loop = asyncio.get_event_loop()
if loop.is_running():
    asyncio.create_task(manager.send_location(frete_id, ws_payload))
else:
    loop.run_until_complete(manager.send_location(frete_id, ws_payload))
```

**Problema:** `asyncio.get_event_loop()` em contexto síncrono gera `DeprecationWarning` em Python 3.10 e **lança `RuntimeError` em Python 3.12+** quando não há loop ativo na thread. O padrão correto em FastAPI é usar `asyncio.create_task()` diretamente ou expor o endpoint como `async def`. Ocorre em dois lugares: nas linhas ~939 (aceitar proposta) e ~1167 (detectar objeto).

**Impacto:** Em Python 3.12+, o envio de notificação WebSocket após aceite do frete e após detecção de objeto **quebra com RuntimeError**, silenciando a notificação ou levantando erro 500.

---

### [CRÍTICO-04] Race condition no `manager.disconnect()` — `manager.py` linha 15

**Arquivo:** [`manager.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/websockets/manager.py#L14-L15)

```python
def disconnect(self, frete_id: int, websocket: WebSocket):
    self.active_connections[frete_id].remove(websocket)  # ← KeyError se chave não existir
```

**Problema:**
1. Se `frete_id` não existe no dict (cliente desconectou antes de ser adicionado, ou já foi removido), lança `KeyError` não tratado.
2. Se `websocket` não está na lista (desconexão dupla), lança `ValueError` não tratado.
3. Não há proteção contra concorrência (`asyncio` é single-thread, mas `chat_connections` e `active_connections` são dicts separados — mesmos fretes podem ter clientes em ambos).

---

### [CRÍTICO-05] Ausência total de autenticação nas rotas — Todas as rotas

**Problema:** Nenhuma rota da API exige token/sessão. Qualquer endpoint pode ser chamado por qualquer pessoa sem autenticação:

- `DELETE /api/v1/cliente/me/cartoes/{id_cartao}` — qualquer um pode deletar cartões de qualquer cliente passando um email na query.
- `POST /api/v1/fretes/{frete_id}/cancelar` — qualquer um pode cancelar qualquer frete.
- `POST /api/v1/fretes/{frete_id}/avaliar` — avaliações podem ser forjadas.
- `PUT /api/v1/motoristas/{motorista_id}/perfil` — qualquer um pode alterar o perfil de qualquer motorista.

**Impacto:** **Toda a API está completamente aberta**. Não há `Depends(get_current_user)` ou equivalente em nenhum endpoint.

---

### [CRÍTICO-06] SQL Injection potencial em `_update_legacy_if_exists` — `fretes.py` linhas 497-505

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L491-L505)

```python
sets.append(f"{key} = :{key}")  # ← key vem de dict externo
# ...
db.execute(text(f"UPDATE {table} SET {', '.join(sets)} WHERE {id_col} = :id_value"), params)
```

E em `database.py` linhas 242-244:

```python
conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
```

**Problema:** Os nomes de coluna (`key`/`col`) e nomes de tabela (`table`) são interpolados diretamente na query SQL sem sanitização. Se um atacante conseguir controlar esses valores (ex: via dicts de configuração corrompidos ou future refactoring), há risco de SQL injection nos ALTER TABLE e UPDATE dinâmicos.

---

### [CRÍTICO-07] Modelo SQLModel desacoplado do banco real — `models.py`

**Arquivo:** [`models.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/models/models.py)

**Problema:** Os modelos SQLModel definem tabelas com nomes diferentes do banco real:

| Modelo SQLModel | Tabela no banco real |
|---|---|
| `Motorista` | `motorista7` |
| `PedidoFrete` | `pedidofrete` |
| `PropostaFrete` | `propostafrete` |
| `MensagemChat` | `mensagemchat` (não existe — é `mensagem_chat7`) |

Os modelos são importados em `create_db_and_tables()` para registrar no metadata, **mas criam tabelas com nomes errados** (sem sufixo `7`). O relacionamento `PropostaFrete.frete_id` aponta para `pedidofrete.id` — mas toda a lógica real usa `frete7.id_frete`.

**Impacto:** `SQLModel.metadata.create_all(engine)` cria tabelas fantasma (`motorista`, `pedidofrete`, `propostafrete`, `mensagemchat`) paralelas às tabelas reais. Os dados nunca chegam nessas tabelas.

---

### [CRÍTICO-08] `_ensure_pedidofrete_columns` emite erro visível no startup — `database.py` linha 91-92

**Confirmado no log de execução:**
```
Aviso ao ajustar schema pedidofrete: (pymysql.err.OperationalError) (1060, "Duplicate column name 'origem_lat'")
```

**Problema:** A função `_ensure_pedidofrete_columns` **não verifica antes de adicionar colunas** — ela tenta fazer `ALTER TABLE` para todas as colunas base sem checar se já existem (`base_statements` não passa pelo filtro `existing_names`). O `MODIFY COLUMN` nas linhas 66-67 está dentro do bloco que roda antes do check de colunas existentes para os `ADD COLUMN`. Além disso, o erro de coluna duplicada é capturado e ignorado, mas a transação inteira falha silenciosamente.

---

### [CRÍTICO-09] Lógica de `_cliente_id` com fallback incorreto — `fretes.py` linha 292

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L292-L295)

```python
found = _scalar(db, "SELECT id_cliente FROM cliente7 ORDER BY id_cliente ASC LIMIT 1")
if not found:
    raise HTTPException(...)
return int(found)
```

**Problema:** Se `id_cliente`, `id_pessoa`, e `email` não são fornecidos — ou não encontram match — a função retorna **o primeiro cliente cadastrado no banco**. Isso significa que fretes criados sem identificação correta do cliente são **atribuídos ao cliente de ID mais baixo**, corrompendo dados silenciosamente.

O mesmo padrão ocorre em `_resolve_motorista_id` (linha 307).

---

## 🟠 ERROS ALTOS

---

### [ALTO-01] `on_event("startup")` deprecated — `main.py` linha 24

**Arquivo:** [`main.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/main.py#L24-L26)

```python
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
```

**Problema:** `on_event` foi depreciado no FastAPI. O aviso aparece toda vez que o servidor sobe:
```
on_event is deprecated, use lifespan event handlers instead.
```

O padrão correto é usar `lifespan` com `asynccontextmanager`.

---

### [ALTO-02] `_salvar_mensagem` em WebSocket abre nova Session — não usa a session da request — `websockets.py` linha 154

**Arquivo:** [`websockets.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/websockets.py#L152-L183)

```python
def _salvar_mensagem(frete_id: int, sender: str, text_value: str) -> dict[str, Any]:
    def work():
        with Session(engine) as session:  # ← cria sessão própria
```

**Problema:** `_salvar_mensagem` é chamado dentro de um handler WebSocket `async def`. Ele cria uma nova `Session` síncrona via `engine` dentro de um contexto assíncrono. Como o WebSocket usa `async/await` e o banco é operado de forma síncrona (pymysql), isso bloqueia o event loop enquanto a query executa.

---

### [ALTO-03] `frete_id` pode ser `None` em `websocket_motorista` — `websockets.py` linha 41

**Arquivo:** [`websockets.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/websockets.py#L41)

```python
frete_id = int(data.get('frete_id'))  # ← TypeError se frete_id for None
```

**Problema:** Se o cliente WebSocket enviar um JSON sem o campo `frete_id`, `data.get('frete_id')` retorna `None`, e `int(None)` lança `TypeError`. Esse erro não é tratado e causa a queda da conexão WebSocket do motorista sem mensagem de erro útil.

---

### [ALTO-04] Dupla confirmação de conclusão causa pagamento inconsistente — `fretes.py` linhas 995-1018 e 1021-1046

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py)

**Problema:** Existem dois endpoints de conclusão:
- `POST /{frete_id}/motorista-concluir` → define `status = 'CONCLUIDO'` e `pagamento = 'AGUARDANDO_CONFIRMACAO'`
- `POST /{frete_id}/cliente-confirmar-conclusao` → também define `status = 'CONCLUIDO'`

**Se o motorista concluir primeiro e depois o cliente confirmar**, o status do pagamento é sobrescrito de `'AGUARDANDO_CONFIRMACAO'` para `'AGUARDANDO_AVALIACOES'`. **Se apenas o motorista concluir sem o cliente confirmar**, o pagamento fica em `'AGUARDANDO_CONFIRMACAO'` e nunca é liberado. Não há verificação de fluxo de estado obrigatório.

---

### [ALTO-05] `obter_perfil_cliente` falha silenciosamente se `avaliacao_frete7` não existe — `cliente.py` linha 248

**Arquivo:** [`cliente.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/cliente.py#L243-L260)

```python
stats = db.execute(text("""
    ...
    LEFT JOIN avaliacao_frete7 a ON ...  # ← tabela pode não existir
    WHERE f.id_cliente = :id_cliente
"""), ...).first()._mapping
```

**Problema:** A query faz JOIN com `avaliacao_frete7` diretamente, sem verificar se a tabela existe. A função `_table_exists` existe no arquivo mas **não é usada aqui**. Se a view `vw_cliente_perfil7` não existir e `avaliacao_frete7` também não existir, o endpoint retorna erro 500.

---

### [ALTO-06] `POST /fretes/detectar-objeto` é rota estática após rotas dinâmicas — `fretes.py` linha 1155

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L1155)

```python
@router.post("/{frete_id}/proposta")    # linha 773 — dinâmica
@router.post("/{frete_id}/aceitar-proposta")  # linha 837 — dinâmica
# ...mais rotas dinâmicas...
@router.post("/detectar-objeto")        # linha 1155 — ESTÁTICA após dinâmicas
```

**Problema:** O FastAPI registra as rotas na ordem de declaração. A rota `POST /detectar-objeto` está **após** rotas `POST /{frete_id}/...`. O FastAPI tentará fazer match de `/detectar-objeto` com `/{frete_id}` (onde `frete_id = "detectar-objeto"`), o que falhará com erro 422 pois `"detectar-objeto"` não é um `int`. A rota **está quebrada por ordem de registro**.

> [!CAUTION]
> Esta é a rota mais diretamente quebrada — `POST /api/v1/fretes/detectar-objeto` retorna **422 Unprocessable Entity** em vez de funcionar corretamente.

---

### [ALTO-07] `obter_negociacao_ativa` retorna `id_negociacao` no campo `driver.id` — `cliente.py` linha 181

**Arquivo:** [`cliente.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/cliente.py#L180-L194)

```python
"driver": {
    "id": int(m["id_negociacao"]),  # ← deveria ser id_motorista!
    "rawId": None,
```

**Problema:** O campo `driver.id` está sendo preenchido com `id_negociacao` em vez de `id_motorista`. O frontend que usar esse campo para identificar o motorista receberá o ID errado, o que pode causar bugs no aceite de proposta e no chat.

---

### [ALTO-08] `motorista-concluir` não verifica status do frete antes de concluir — `fretes.py` linha 995

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L995-L1018)

**Problema:** O endpoint `POST /{frete_id}/motorista-concluir` não verifica se o frete está em status `EM_TRANSITO` antes de marcar como concluído. Qualquer frete — mesmo em status `PENDENTE` ou `CANCELADO` — pode ser marcado como concluído por qualquer motorista que conheça o `frete_id`.

---

## 🟡 WARNINGS / PROBLEMAS MÉDIOS

---

### [MÉDIO-01] CORS com `allow_origins=["*"]` e `allow_credentials=True` é inválido — `main.py` linha 18

**Arquivo:** [`main.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/main.py#L16-L22)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,  # ← inválido com allow_origins=["*"]
    ...
)
```

**Problema:** De acordo com a especificação CORS, **não é permitido usar `allow_credentials=True` com `allow_origins=["*"]`**. Browsers modernos bloqueiam isso com erro:  
`"The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'"`

O comentário `# TODO: Configurar CORS corretamente para produção` indica ciência do problema, mas está causando falhas reais agora.

---

### [MÉDIO-02] `_table_columns` usa `db.exec()` em vez de `db.execute()` — `auth.py` linha 52

**Arquivo:** [`auth.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/auth.py#L51-L57)

```python
def _table_columns(db: Session, table: str) -> set[str]:
    rows = db.exec(text(...), params={"table": table}).fetchall()
```

**Problema:** `db.exec()` é o método SQLModel que retorna modelos tipados. Para queries SQL brutas com `text()`, o correto é `db.execute()`. No `fretes.py`, o mesmo padrão usa `db.execute()` corretamente. Misturar os dois pode causar comportamento inconsistente dependendo da versão do SQLModel.

---

### [MÉDIO-03] `carteira_motorista7` recebe colunas CNH que não fazem sentido — `database.py` linha 228

**Arquivo:** [`database.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/db/database.py#L228-L230)

```python
'carteira_motorista7': {
    'numero_cnh': 'VARCHAR(20) NULL', 'categoria_cnh': 'VARCHAR(5) NULL',
    'validade_cnh': 'DATE NULL', 'uf_cnh': 'VARCHAR(2) NULL',
    'cnh_verificada': 'TINYINT DEFAULT 0', 'situacao_cnh': "VARCHAR(30) DEFAULT 'PENDENTE'",
},
```

**Problema:** A tabela `carteira_motorista7` é uma carteira financeira (saldo disponível/pendente). Adicionar colunas de CNH nela é logicamente incorreto — esses dados pertencem a `motorista7`. Isso indica uma duplicação de dados e possível inconsistência.

---

### [MÉDIO-04] `if "carteira_motorista7" in {"carteira_motorista7"}:` — lógica morta — `auth.py` linha 171

**Arquivo:** [`auth.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/auth.py#L171)

```python
if "carteira_motorista7" in {"carteira_motorista7"}:
```

**Problema:** Essa condição é sempre `True` (verificando se uma string está em um set com ela mesma). É provável que isso fosse uma verificação dinâmica da existência da tabela que foi simplificada de forma errada. O bloco sempre executa.

---

### [MÉDIO-05] `_calcular_preco_frete` definida mas nunca usada — `fretes.py` linha 254

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L254-L260)

```python
def _calcular_preco_frete(distancia_km: float, peso_kg: float, tipo_veiculo: Optional[str] = None, fragil: bool = False) -> float:
    # Fallback antigo preservado para compatibilidade.
```

**Problema:** Função não é chamada em lugar nenhum. Código morto que aumenta a confusão de manutenção.

---

### [MÉDIO-06] Endpoint `GET /fretes/` com SQL injection via `status` query param — `fretes.py` linha 738

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L735-L762)

```python
where = "f.status = 'PENDENTE'" if status is None else "1=1"
```

**Problema:** Quando `status` é fornecido, a cláusula WHERE vira `1=1` (retorna tudo). A intenção era filtrar por status específico, mas o filtro nunca é aplicado. O parâmetro `status` da query é completamente ignorado quando não é `None`.

---

### [MÉDIO-07] Frete sem lat/lng grava `0.0` em vez de `NULL` — `fretes.py` linha 701

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L701-L706)

```python
"origem_lat": dados.origem_lat or 0,
"origem_lng": dados.origem_lng or 0,
"destino_lat": dados.destino_lat or 0,
"destino_lng": dados.destino_lng or 0,
```

**Problema:** Coordenadas `0.0` correspondem a um ponto real no oceano Atlântico (lat=0, lng=0). Fretes sem localização informada terão coordenadas `(0, 0)` gravadas, o que pode causar cálculos incorretos de distância e problemas em mapas.

---

### [MÉDIO-08] `asyncpg` e `psycopg2-binary` no requirements mas nunca usados — `requirements.txt`

**Problema:** O projeto usa MySQL (TiDB) com `pymysql`. Os drivers `asyncpg` (PostgreSQL async) e `psycopg2-binary` (PostgreSQL sync) estão no `requirements.txt` mas não são referenciados em nenhum arquivo Python. São dependências desnecessárias que aumentam o tamanho do ambiente.

---

### [MÉDIO-09] `firebaseconfig.py` e `redisconfig.py` são arquivos vazios — `app/db/`

**Arquivos:** [`firebaseconfig.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/db/firebaseconfig.py), [`redisconfig.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/db/redisconfig.py)

**Problema:** Ambos os arquivos existem mas são completamente vazios (0 bytes). Criam confusão sobre se Firebase/Redis estão integrados. `redis.py` em `app/core/` é o que realmente inicializa o Redis.

---

### [MÉDIO-10] `saldo_carteira` calculado de forma incorreta em `motoristas.py` — linha 90

**Arquivo:** [`motoristas.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/motoristas.py#L87-L97)

```python
stats = db.execute(text("""
    SELECT COUNT(*) AS total, SUM(IFNULL(preco_fechado, preco_estimado)) AS saldo
    FROM frete7
    WHERE id_motorista = :motorista_id
      AND status IN ('ACEITO', 'EM_TRANSITO', ...)
"""), ...).first()._mapping
```

**Problema:** O saldo da carteira do motorista é calculado somando `preco_fechado` de todos os fretes, incluindo os que ainda estão em `ACEITO` e `EM_TRANSITO` (não concluídos). Isso mostra um saldo inflado com fretes que ainda não foram pagos. O correto seria usar a tabela `carteira_motorista7` ou filtrar apenas fretes com pagamento confirmado.

---

## 🔵 PROBLEMAS BAIXOS / QUALIDADE

---

### [BAIXO-01] `package-lock.json` no diretório Backend Python — raiz do backend

**Arquivo:** `package-lock.json` (86 bytes)

**Problema:** Um `package-lock.json` (arquivo do Node.js/npm) está na raiz do projeto Python. Indica que houve uma operação `npm` executada no diretório errado. Não causa problemas funcionais, mas gera confusão.

---

### [BAIXO-02] `debug_history.py`, `diagnose_db.py`, `test_*.py` — scripts de teste no diretório raiz

**Arquivos:** `debug_history.py`, `diagnose_db.py`, `test_api_flow.py`, `test_profile_api.py`, `test_register_api.py`

**Problema:** Múltiplos scripts de debug e teste estão na raiz do backend, fora do diretório `tests/`. Isso polui o namespace do projeto. O diretório `tests/` existe mas parece subutilizado.

---

### [BAIXO-03] `_resolve_motorista_id` duplicada em dois arquivos — `fretes.py` e `motoristas.py`

**Arquivos:** [`fretes.py` linha 298](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L298) e [`motoristas.py` linha 24](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/motoristas.py#L24)

**Problema:** A função `_resolve_motorista_id` está implementada duas vezes com lógica idêntica. Deveria ser extraída para um módulo utilitário compartilhado.

---

### [BAIXO-04] `foto` do motorista hardcoded com URL externa — `fretes.py` linha 444

**Arquivo:** [`fretes.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/api/v1/endpoints/fretes.py#L444)

```python
"foto": "https://randomuser.me/api/portraits/men/32.jpg",
```

**Problema:** A foto do motorista é sempre a mesma imagem de um terceiro (randomuser.me). Se o serviço externo ficar fora do ar, todas as fotos de motoristas quebram. O mesmo valor hardcoded aparece em `cliente.py` linha 188.

---

### [BAIXO-05] Modelos `Motorista`, `PedidoFrete` em `models.py` não têm `__tablename__` — `models.py`

**Arquivo:** [`models.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/models/models.py)

**Problema:** Os modelos SQLModel com `table=True` usam nomes padrão derivados do nome da classe (ex: `Motorista` → tabela `motorista`). Como o banco usa `motorista7`, `frete7`, etc., os modelos criam tabelas paralelas fantasma em vez de mapear para as tabelas existentes.

---

### [BAIXO-06] `DB_NAME` não é usado em `_ensure_movout_aux_tables` — `database.py` linha 238

**Arquivo:** [`database.py`](file:///c:/Users/fabri/Movout/MOVOUT-FINAL/Backend/app/db/database.py#L238)

```python
conn.execute(text("... WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"), ...)
```

**Nota:** Aqui usa `DATABASE()` (função SQL) — correto.  
Mas em `_ensure_pedidofrete_columns` linha 83:

```python
"WHERE TABLE_SCHEMA = :db_name AND TABLE_NAME = 'pedidofrete'"
```

Usa `DB_NAME` (variável Python) — também correto, mas **inconsistente** com o resto do código. Se `DB_NAME` não corresponder ao banco ativo (ex: TiDB com nome diferente), a verificação de colunas existentes falha e os `ADD COLUMN` são tentados mesmo que já existam.

---

## 🗺️ Mapa Completo das Rotas

### Rotas HTTP

| Método | Rota | Status | Observação |
|---|---|---|---|
| GET | `/` | ✅ OK | Rota raiz |
| POST | `/api/v1/auth/login` | ⚠️ PARCIAL | Token hardcoded — sem JWT real |
| POST | `/api/v1/auth/register` | ✅ OK | Funciona mas sem validação de email |
| GET | `/api/v1/motoristas/` | ✅ OK | |
| GET | `/api/v1/motoristas/{id}/perfil` | ✅ OK | |
| GET | `/api/v1/motoristas/{id}/historico` | ✅ OK | |
| GET | `/api/v1/motoristas/{id}/chats` | ✅ OK | Alias de historico |
| PUT | `/api/v1/motoristas/{id}/perfil` | ⚠️ PARCIAL | Sem autenticação |
| GET | `/api/v1/motoristas/{id}/carteira` | ⚠️ PARCIAL | Saldo incorreto |
| POST | `/api/v1/fretes/` | ✅ OK | Fallback perigoso de cliente |
| GET | `/api/v1/fretes/` | ⚠️ PARCIAL | Filtro por status não funciona |
| GET | `/api/v1/fretes/{id}` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/proposta` | ✅ OK | |
| GET | `/api/v1/fretes/{id}/propostas` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/aceitar-proposta` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/motorista-aceitar` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/cancelar` | ✅ OK | Sem autenticação |
| POST | `/api/v1/fretes/{id}/match` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/iniciar` | ⚠️ PARCIAL | Sem check de status anterior |
| POST | `/api/v1/fretes/{id}/chegou-destino` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/motorista-concluir` | ⚠️ PARCIAL | Sem check de status EM_TRANSITO |
| POST | `/api/v1/fretes/{id}/cliente-confirmar-conclusao` | ⚠️ PARCIAL | Fluxo duplo inconsistente |
| GET | `/api/v1/fretes/{id}/pagamento` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/liberar-pagamento` | ⚠️ PARCIAL | Só libera se ambos avaliaram |
| POST | `/api/v1/fretes/{id}/confirmar-pagamento` | ✅ OK | |
| POST | `/api/v1/fretes/{id}/avaliar` | ✅ OK | |
| **POST** | **`/api/v1/fretes/detectar-objeto`** | **🔴 QUEBRADA** | **Conflito com `/{frete_id}` — retorna 422** |
| GET | `/api/v1/cliente/me` | ✅ OK | Email via query param |
| GET | `/api/v1/cliente/me/historico` | ✅ OK | |
| GET | `/api/v1/cliente/me/negociacao_ativa` | ⚠️ PARCIAL | `driver.id` errado |
| PUT | `/api/v1/cliente/me` | ✅ OK | Sem autenticação |
| GET | `/api/v1/cliente/me/perfil` | ⚠️ PARCIAL | JOIN sem check de existência |
| GET | `/api/v1/cliente/me/cartoes` | ✅ OK | |
| POST | `/api/v1/cliente/me/cartoes` | ✅ OK | |
| DELETE | `/api/v1/cliente/me/cartoes/{id}` | ✅ OK | Sem autenticação |

### Rotas WebSocket

| Protocolo | Rota | Status | Observação |
|---|---|---|---|
| WS | `/api/v1/ws/fretes/{frete_id}` | ✅ OK | Localização em tempo real |
| WS | `/api/v1/ws/motoristas/{motorista_id}` | ⚠️ PARCIAL | `frete_id=None` quebra |
| WS | `/api/v1/ws/chat/{frete_id}` | ✅ OK | Chat funciona |
| GET | `/api/v1/ws/chat/{frete_id}/historico` | ✅ OK | |
| GET | `/api/v1/ws/chat/{frete_id}/history` | ✅ OK | Alias |

---

## 📌 Prioridade de Correção Recomendada

```
URGENTE (produção bloqueada):
  1. [CRÍTICO-01] Implementar JWT real
  2. [ALTO-06]   Mover /detectar-objeto para antes das rotas dinâmicas
  3. [CRÍTICO-05] Adicionar autenticação nas rotas

IMPORTANTE (bugs funcionais):
  4. [CRÍTICO-03] Corrigir uso de asyncio.get_event_loop()
  5. [CRÍTICO-04] Proteger manager.disconnect() de KeyError/ValueError
  6. [ALTO-03]   Proteger frete_id=None no WebSocket do motorista
  7. [MÉDIO-01]  Corrigir CORS (credentials + wildcard inválido)
  8. [CRÍTICO-09] Corrigir fallback de _cliente_id

MÉDIO PRAZO (consistência de dados):
  9.  [CRÍTICO-07] Corrigir modelos SQLModel (tablename)
  10. [ALTO-07]   Corrigir driver.id em negociacao_ativa
  11. [MÉDIO-07]  Gravar NULL em vez de 0.0 para coordenadas
  12. [MÉDIO-06]  Corrigir filtro de status em GET /fretes/

LIMPEZA:
  13. [BAIXO-01]  Remover package-lock.json
  14. [MÉDIO-08]  Remover asyncpg e psycopg2 do requirements
  15. [MÉDIO-09]  Remover arquivos vazios ou preenchê-los
  16. [BAIXO-03]  Extrair _resolve_motorista_id para utilitário
```
