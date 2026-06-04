# Movout Final Corrigido V2

Versão consolidada com foco em estabilidade do fluxo principal do Movout.

## Base
- Frontend e estrutura principal preservados.
- Localização/mapa preservados.
- Backend de fretes/chat consolidado para usar `frete7`, `negociacao7` e `mensagem_chat7`.

## Fluxo corrigido
1. Cliente cria frete em `frete7` com status `PENDENTE`.
2. Motorista vê somente fretes disponíveis.
3. Motorista envia proposta em `negociacao7`.
4. Frete passa para `NEGOCIANDO`.
5. Cliente aceita proposta.
6. Backend atualiza `frete7.id_motorista`, `frete7.id_veiculo`, `frete7.preco_fechado` e `frete7.status = ACEITO`.
7. Frete aceito sai da lista de disponíveis.
8. Cliente e motorista acessam o chat pelo mesmo `id_frete`.
9. Mensagens salvam em `mensagem_chat7`.

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

## Rodar cliente
```bash
./scripts/rodar_cliente.sh
```

## Rodar motorista
```bash
./scripts/rodar_motorista.sh
```

## Observação
O arquivo `.env`, `.venv`, `node_modules`, `.expo` e certificados `.pem` não devem ser enviados ao GitHub.
