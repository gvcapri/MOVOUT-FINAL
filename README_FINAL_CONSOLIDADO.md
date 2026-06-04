# Movout - Versão Final Consolidada

Esta versão foi montada usando o `Movout_repositorio_02` como base principal e incorporando apenas os pontos funcionais das outras versões.

## O que foi consolidado

- Base estrutural e visual preservada do `Movout_repositorio_02`.
- Frontend do cliente preservado com telas de histórico, negociação, frete aceito e chat.
- Frontend do motorista preservado com telas de fretes disponíveis, histórico, negociação, detalhes e chat.
- Backend corrigido para trabalhar com o banco atual (`movout7`).
- Chat em tempo real com WebSocket persistindo em `mensagem_chat7`.
- Histórico do chat carregado do banco por `id_frete`.
- Fluxo de proposta e aceite corrigido usando `frete7`, `negociacao7`, `motorista7`, `veiculo7` e `pessoa7`.
- Ao aceitar uma proposta, o motorista é atribuído ao frete no banco:
  - `frete7.id_motorista`
  - `frete7.id_veiculo`
  - `frete7.preco_fechado`
  - `frete7.status = ACEITO`
- Fretes aceitos deixam de aparecer como disponíveis para outros motoristas.
- Fretes aceitos aparecem no histórico do motorista.
- Histórico do cliente mostra o motorista atribuído.
- A parte de localização/mapa foi preservada.

## Como rodar o backend

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Invoke-WebRequest -Uri "https://letsencrypt.org/certs/isrgrootx1.pem" -OutFile "isrgrootx1.pem"
Copy-Item .env.example .env
notepad .env
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

No `.env`, coloque a conexão real do TiDB/MySQL.

## Como rodar o frontend do cliente

Antes, ajuste o IP em:

```text
Frontend/src/api/config.js
```

Depois:

```powershell
cd Frontend
npm install
npx expo start -c
```

## Como rodar o frontend do motorista

Antes, ajuste o IP em:

```text
Frontend Motorista/src/api/config.js
```

Depois:

```powershell
cd "Frontend Motorista"
npm install
npx expo start -c
```

## Testes principais

### API online

```powershell
Invoke-WebRequest -Uri "http://SEU_IP:8000/" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Histórico do cliente

```powershell
Invoke-WebRequest -Uri "http://SEU_IP:8000/api/v1/cliente/me/historico?email=EMAIL_DO_CLIENTE" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Histórico do chat

```powershell
Invoke-WebRequest -Uri "http://SEU_IP:8000/api/v1/ws/chat/ID_FRETE/historico?role=user" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Histórico do motorista

```powershell
Invoke-WebRequest -Uri "http://SEU_IP:8000/api/v1/motoristas/1/historico" -UseBasicParsing | Select-Object -ExpandProperty Content
```

## Observações

- O arquivo `.env` não deve ser enviado ao GitHub.
- O certificado `isrgrootx1.pem` deve ser baixado localmente em cada computador.
- Se o celular não acessar a API, libere a porta 8000 no firewall do Windows.
