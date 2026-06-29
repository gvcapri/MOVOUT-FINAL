"""
test_critico07_tabelas_fantasma.py
====================================
Valida o bug:

  [CRÍTICO-07] Modelo SQLModel desacoplado do banco real.
               `SQLModel.metadata.create_all(engine)` cria tabelas fantasma
               (`motorista`, `pedidofrete`, `propostafrete`, `mensagemchat`)
               paralelas às tabelas reais (`motorista7`, `frete7`, etc.).

               Os dados persistidos via API vão para as tabelas REAIS (sufixo 7),
               porém o SQLModel aponta para as tabelas ERRADAS.

Estratégia do teste:
  1. Criar um novo frete via POST /api/v1/fretes/
  2. Buscar o frete pelo ID retornado via GET /api/v1/fretes/{id}
  3. Confirmar que os dados retornados batem com o que foi enviado
     (isso prova que o dado foi inserido em `frete7`, não em `pedidofrete`)
  4. Verificar via GET /api/v1/fretes/ (lista) que o frete aparece,
     confirmando que as queries da API lêem de `frete7` e não das tabelas fantasma.

  Como não temos acesso direto ao banco de dentro do pytest (sem credenciais
  hardcoded), validamos INDIRETAMENTE através da API: se a API conseguir
  criar e recuperar o registro com os dados corretos, as tabelas reais estão
  sendo usadas. Se o SQLModel criasse e lesse das tabelas fantasma, os dados
  nunca seriam retornados pelas queries SQL brutas que a API usa.
"""
import pytest

API_PREFIX = "/api/v1"

FRETE_PAYLOAD = {
    "origem": "Av. Brigadeiro Faria Lima, 100 - SP [TESTE-07]",
    "destino": "Rua Oscar Freire, 200 - SP [TESTE-07]",
    "distancia_km": 3.5,
    "peso_estimado": 15.0,
    "tipo_veiculo": "CARRO",
    "prioridade": "hoje",
}


# ---------------------------------------------------------------------------
# Teste principal: criar frete e validar persistência na tabela real
# ---------------------------------------------------------------------------

def test_critico07_frete_criado_aparece_na_listagem(http_client):
    """
    CRÍTICO-07: Cria um frete via API e confirma que ele foi inserido
    em frete7 (não em pedidofrete).

    A API usa SQL puro contra frete7. Se o SQLModel criasse a tabela fantasma
    e a API lesse dela, o dado não apareceria nas queries da API real.
    """
    # 1. Criar frete
    resp_create = http_client.post(f"{API_PREFIX}/fretes/", json=FRETE_PAYLOAD)
    assert resp_create.status_code in (200, 201), (
        f"[CRÍTICO-07] Falha ao criar frete: {resp_create.status_code} — {resp_create.text}"
    )

    data = resp_create.json()
    frete_id = data.get("id_frete") or data.get("id")
    assert frete_id is not None, (
        f"[CRÍTICO-07] Resposta de criação sem id_frete/id: {data}"
    )

    # 2. Buscar o frete pelo ID (prova que foi para frete7, não pedidofrete)
    resp_get = http_client.get(f"{API_PREFIX}/fretes/{frete_id}")
    assert resp_get.status_code == 200, (
        f"[CRÍTICO-07] BUG CONFIRMADO: Frete {frete_id} criado mas não encontrado via GET. "
        f"Provável causa: dado foi para tabela fantasma 'pedidofrete' e a API lê de 'frete7'. "
        f"Status: {resp_get.status_code} — {resp_get.text}"
    )

    frete_retornado = resp_get.json()

    # 3. Validar campos essenciais
    assert frete_retornado.get("id_frete") == frete_id or frete_retornado.get("id") == frete_id, (
        f"[CRÍTICO-07] ID retornado ({frete_retornado.get('id_frete')}) "
        f"não bate com ID criado ({frete_id})"
    )

    origem_retornada = frete_retornado.get("origem") or ""
    assert "TESTE-07" in origem_retornada, (
        f"[CRÍTICO-07] Campo 'origem' não contém o marcador de teste. "
        f"Dado pode ter ido para tabela errada. "
        f"Origem retornada: '{origem_retornada}'"
    )


def test_critico07_frete_aparece_na_lista_geral(http_client):
    """
    CRÍTICO-07 (parte 2): Cria um frete e verifica se ele aparece na
    listagem geral GET /fretes/. Confirma que INSERT e SELECT apontam
    para a mesma tabela (frete7).
    """
    resp_create = http_client.post(f"{API_PREFIX}/fretes/", json={
        **FRETE_PAYLOAD,
        "origem": "Rua Funcional, 999 - SP [TESTE-07-LISTA]",
    })
    assert resp_create.status_code in (200, 201), (
        f"[CRÍTICO-07] Falha ao criar frete para teste de listagem: {resp_create.text}"
    )

    frete_id = resp_create.json().get("id_frete") or resp_create.json().get("id")

    resp_list = http_client.get(f"{API_PREFIX}/fretes/")
    assert resp_list.status_code == 200, (
        f"[CRÍTICO-07] GET /fretes/ retornou {resp_list.status_code}"
    )

    fretes = resp_list.json()
    assert isinstance(fretes, list), (
        f"[CRÍTICO-07] GET /fretes/ não retornou lista: {type(fretes)}"
    )

    ids_retornados = [f.get("id_frete") or f.get("id") for f in fretes]
    assert frete_id in ids_retornados, (
        f"[CRÍTICO-07] BUG CONFIRMADO: Frete {frete_id} criado mas não aparece na listagem. "
        f"Possível causa: tabelas fantasma — INSERT vai para pedidofrete, "
        f"SELECT lê de frete7 (tabelas distintas). "
        f"IDs listados: {ids_retornados[:10]}"
    )


def test_critico07_status_inicial_e_pendente(http_client):
    """
    CRÍTICO-07 (parte 3): Valida que o status inicial do frete é 'aberto'/'PENDENTE',
    confirmando que o campo status foi gravado corretamente em frete7.
    """
    resp_create = http_client.post(f"{API_PREFIX}/fretes/", json={
        **FRETE_PAYLOAD,
        "origem": "Rua Status, 1 - SP [TESTE-07-STATUS]",
    })
    assert resp_create.status_code in (200, 201)

    data = resp_create.json()
    frete_id = data.get("id_frete") or data.get("id")

    resp_get = http_client.get(f"{API_PREFIX}/fretes/{frete_id}")
    assert resp_get.status_code == 200

    status = resp_get.json().get("status") or ""
    assert status.lower() in ("aberto", "pendente", "negociando"), (
        f"[CRÍTICO-07] Status inesperado após criação: '{status}'. "
        f"Esperado: 'aberto' ou 'pendente'. "
        f"Se o status vier vazio, o dado pode ter sido gravado em tabela fantasma."
    )
