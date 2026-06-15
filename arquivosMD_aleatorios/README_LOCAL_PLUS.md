# Movout Local Plus

Versão local com fluxo completo de teste:

- Cliente cria frete.
- Backend calcula preço por distância, peso e tipo de veículo.
- Motorista pode aceitar o valor do cliente ou enviar contraproposta.
- Contraproposta só vira aceite quando o cliente aceita.
- Motorista marca corrida concluída.
- Cliente confirma conclusão e libera pagamento.
- Pagamento entra na carteira do motorista.
- Cliente e motorista podem avaliar.
- Chat persiste em mensagem_chat7 por id_frete.
- FAQ/tira-dúvidas incluído no cliente e motorista.

## Rodar

Backend:
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

Frontend cliente:
```bash
cd Frontend
npm install
npx expo start -c
```

Frontend motorista:
```bash
cd "Frontend Motorista"
npm install
npx expo start -c
```
