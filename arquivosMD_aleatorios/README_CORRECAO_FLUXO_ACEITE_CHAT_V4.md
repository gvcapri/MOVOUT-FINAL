# Correção v4 — fluxo de aceite, atribuição de motorista, histórico e chat

Esta versão corrige o fluxo completo no backend, mantendo o frontend e a localização sem alterações estruturais.

## Fluxo corrigido

1. Cliente cria frete em `frete7`.
2. Motorista vê apenas fretes realmente disponíveis (`PENDENTE`, expostos ao front como `aberto`).
3. Motorista envia proposta em `/api/v1/fretes/{id_frete}/proposta`.
4. Frete passa para `NEGOCIANDO`, exposto ao front como `negociando`, deixando de aparecer como novo frete disponível no app do motorista.
5. Cliente aceita a proposta em `/api/v1/fretes/{id_frete}/aceitar-proposta?motorista_id=...`.
6. Backend atualiza obrigatoriamente:
   - `frete7.status = 'ACEITO'`
   - `frete7.id_motorista = motorista aceito`
   - `frete7.id_veiculo = veículo do motorista`
   - `frete7.preco_fechado = preco_proposto`
   - `negociacao7.status = 'ACEITA'` para a proposta aceita
   - `negociacao7.status = 'RECUSADA'` para as demais propostas do mesmo frete
7. Histórico do cliente passa a exibir o motorista atribuído.
8. Histórico do motorista busca fretes diretamente por `frete7.id_motorista`.
9. Chat continua usando `mensagem_chat7` por `id_frete`, com persistência real no banco.

## Arquivos principais alterados

- `Backend/app/api/v1/endpoints/fretes.py`
- `Backend/app/api/v1/endpoints/motoristas.py`
- `Backend/app/api/v1/endpoints/cliente.py`

## Rotas críticas para teste

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/fretes/ID_FRETE/propostas" -UseBasicParsing | Select-Object -ExpandProperty Content
```

```powershell
$body = @{
  motorista_id = 1
  nome_motorista = "Joao Carlos Silva"
  valor = 45.50
  tempo_estimado = "30 min"
  rating = 4.8
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://127.0.0.1:8000/api/v1/fretes/ID_FRETE/proposta" `
  -Method POST `
  -ContentType "application/json; charset=utf-8" `
  -Body $body `
  -UseBasicParsing | Select-Object -ExpandProperty Content
```

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/fretes/ID_FRETE/aceitar-proposta?motorista_id=1" -Method POST -UseBasicParsing | Select-Object -ExpandProperty Content
```

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/motoristas/1/historico" -UseBasicParsing | Select-Object -ExpandProperty Content
```

## SQL para confirmar no banco

```sql
SELECT
  f.id_frete,
  f.status,
  f.id_motorista,
  f.id_veiculo,
  f.preco_fechado,
  p.nome AS motorista
FROM frete7 f
LEFT JOIN motorista7 m ON m.id_motorista = f.id_motorista
LEFT JOIN pessoa7 p ON p.id_pessoa = m.id_pessoa
ORDER BY f.id_frete DESC;
```

```sql
SELECT *
FROM negociacao7
ORDER BY id_negociacao DESC;
```

```sql
SELECT *
FROM mensagem_chat7
WHERE id_frete = ID_FRETE
ORDER BY criada_em ASC;
```
