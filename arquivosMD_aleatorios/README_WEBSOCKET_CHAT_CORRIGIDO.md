# Correção do WebSocket e persistência do chat

Este projeto foi ajustado para usar o banco atual `movout7` na parte de chat e liberação de conversa.

## Principais mudanças

- O WebSocket `/api/v1/ws/chat/{frete_id}` agora salva mensagens em `mensagem_chat7`.
- O histórico `/api/v1/ws/chat/{frete_id}/historico` agora lê de `mensagem_chat7`.
- A mensagem do cliente é gravada como `tipo_remetente = CLIENTE` e usa `cliente7.id_pessoa`.
- A mensagem do motorista é gravada como `tipo_remetente = MOTORISTA` e usa `motorista7.id_pessoa`.
- A rota de aceite de proposta atualiza `frete7` para `status = ACEITO`, grava `id_motorista`, `id_veiculo` e `preco_fechado`.
- As rotas `/fretes`, `/fretes/{id}/proposta`, `/fretes/{id}/propostas` e `/fretes/{id}/aceitar-proposta` foram adaptadas para o esquema atual `frete7/negociacao7`, sem exigir alteração no frontend.
- A rota `/cliente/me/historico` foi corrigida para não depender da coluna inexistente `frete7.data_criacao`.

## Tabelas usadas no chat

- `frete7`
- `cliente7`
- `motorista7`
- `pessoa7`
- `negociacao7`
- `mensagem_chat7`

## Teste rápido

Com o backend rodando:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/ws/chat/214954/historico?role=user" -UseBasicParsing | Select-Object -ExpandProperty Content
```

No banco:

```sql
SELECT *
FROM mensagem_chat7
WHERE id_frete = 214954
ORDER BY criada_em ASC;
```
