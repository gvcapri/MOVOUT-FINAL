# Movout Local Completo

Versão local de teste com backend e frontends padronizados.

## Incluído
- Frete com `id_frete` único em `frete7`.
- Propostas em `negociacao7`.
- Aceite com atribuição de motorista e veículo no banco.
- Chat cliente/motorista em tempo real usando `mensagem_chat7`.
- Histórico do cliente e motorista.
- Liberação de pagamento pelo cliente.
- Confirmação de pagamento pelo motorista.
- Carteira do motorista.
- Avaliação cliente/motorista.
- Edição de perfil básica para cliente e motorista.

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
cd Frontend
npm install
npx expo start -c
```

## Rodar motorista
```bash
cd "Frontend Motorista"
npm install
npx expo start -c
```
