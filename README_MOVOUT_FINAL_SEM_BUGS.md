# Movout - Versão final consolidada

Esta versão usa o `Movout_repositorio_02` como base principal e substitui a lógica de frete/aceite/chat por uma implementação consolidada no banco atual `movout7`.

## Principais correções

- `frete7` é a fonte oficial de fretes.
- Cada novo pedido cria um `id_frete` único por `AUTO_INCREMENT`.
- O motorista envia proposta em `negociacao7`.
- Quando o cliente aceita, o backend grava obrigatoriamente em `frete7`:
  - `id_motorista`
  - `id_veiculo`
  - `preco_fechado`
  - `status = ACEITO`
- O frete aceito deixa de aparecer como disponível.
- O histórico do motorista busca fretes por `frete7.id_motorista`.
- O histórico do cliente mostra o motorista atribuído.
- O chat usa sempre `mensagem_chat7`, separado por `id_frete`.
- O cliente recebeu botão de Chat no Histórico.
- A lista de conversas do motorista agora vem do backend, não de dados mockados.
- Login do motorista usa `/auth/login` e retorna `id_motorista` real.

## Rotas principais

- `POST /api/v1/fretes/` cria frete único.
- `GET /api/v1/fretes/` lista fretes pendentes para motorista.
- `GET /api/v1/fretes/{id}` retorna frete com motorista/propostas.
- `POST /api/v1/fretes/{id}/proposta` cria proposta.
- `POST /api/v1/fretes/{id}/aceitar-proposta?motorista_id=1` aceita e atribui motorista.
- `GET /api/v1/cliente/me/historico?email=...` histórico do cliente.
- `GET /api/v1/motoristas/{id}/historico` histórico do motorista.
- `GET /api/v1/motoristas/{id}/chats` conversas do motorista.
- `WS /api/v1/ws/chat/{id_frete}` chat em tempo real.
- `GET /api/v1/ws/chat/{id_frete}/historico` histórico do chat.

## Rodar backend

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
curl -o isrgrootx1.pem https://letsencrypt.org/certs/isrgrootx1.pem
cp .env.example .env
nano .env
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Rodar frontend cliente

```bash
cd Frontend
npm install
npx expo start -c
```

## Rodar frontend motorista

```bash
cd "Frontend Motorista"
npm install
npx expo start -c
```

## Importante

Atualize `BASE_IP` nos dois arquivos:

- `Frontend/src/api/config.js`
- `Frontend Motorista/src/api/config.js`

para o IP da máquina que está rodando o backend.
