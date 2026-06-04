# Movout - correções solicitadas

Esta versão foi atualizada para trabalhar com as tabelas novas no TiDB e manter fallback local.

## Principais ajustes

- Cadastro de motorista: aceita campos de CNH (`cnh`, `numero_cnh`, `categoria_cnh`, `validade_cnh`, `uf_cnh`) sem quebrar quando a tabela tiver variações de coluna.
- Cartões do cliente: adicionados endpoints para listar, salvar e remover cartão, sem gravar CVV e sem depender do número completo no banco.
- Cálculo do frete: usa `tarifa_veiculo7` e `tarifa_prioridade7`.
  - 20 minutos: mais caro.
  - Hoje: intermediário.
  - Agendado: mais barato.
  - Carro: menor custo.
  - Van: médio.
  - Caminhão: maior custo.
- Perfil do cliente: endpoint `/api/v1/cliente/me/perfil` retorna nome, e-mail, fretes concluídos e avaliação média recebida dos motoristas.
- Detalhes do frete: payload inclui método de pagamento, prioridade, veículo solicitado e detalhamento de valores.
- Avaliação: usa `avaliacao_frete7` e impede avaliar o mesmo frete mais de uma vez pelo mesmo tipo de avaliador.
- Conclusão de corrida: cliente ou motorista podem marcar o frete como concluído; depois a avaliação duplicada é bloqueada.
- EAS/APK: `pix_logo.png` foi normalizado e a tela passou a usar ícone textual para PIX, evitando erro de compilação Android.

## Arquivo SQL

O script de banco está em:

`Backend/database/migracao_movout_tibd.sql`

## Teste rápido

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
