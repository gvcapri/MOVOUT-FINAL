MUDANCAS FEITAS NA SPRINT 3 (S3)

Documento que resume todas as alteracoes feitas no projeto Movout durante a Sprint 3.

============================================================================================

PARTE 1 - BACKEND (PYTHON/FASTAPI)

O servico de IA (app/services/ai_service.py) foi alterado de async para sync usando a biblioteca requests
para evitar travamentos. Foi colocado um timeout de 10 segundos. Se a API do HuggingFace falhar, o sistema
retorna a mensagem: Nao foi possivel confirmar o objeto via IA.

O endpoint de deteccao de objeto (fretes.py) foi refatorado para ser sincrono, permitindo que o FastAPI
o execute em um thread pool separado. A integracao com WebSockets foi restaurada para notificar o motorista
quando a IA confirmar o objeto.

O modelo PedidoFrete foi expandido com os seguintes campos novos: origem, destino, tipo_veiculo, objeto_ia,
prioridade e fragil. Esses campos sao opcionais e o sistema continua funcionando sem eles.

Foi criado o modelo PropostaFrete para representar as ofertas que os motoristas enviam para os clientes.

PARTE 2 - BANCO DE DADOS (MYSQL / SQLMODEL)

A arquitetura mock em memoria foi totalmente removida do modulo de fretes.

O arquivo models.py agora possui as tabelas REAIS mapeadas via SQLModel:
- PedidoFrete: Armazena todas as informacoes do frete criado pelo cliente.
- PropostaFrete: Tabela nova que armazena os precos enviados pelos motoristas (com chave estrangeira para PedidoFrete).

O arquivo fretes.py foi refatorado para usar injecao de dependencia (get_session) que grava,
atualiza e busca as informacoes direto no seu banco de dados MySQL hospedado no Railway.

Agora, se voce reiniciar o servidor, as regras de negocio continuam. Quando um cliente
criar um frete ou um motorista fizer uma proposta, ficara salvo de forma permanente!

============================================================================================

PARTE 3 - NOVOS ENDPOINTS DO BACKEND


GET /fretes/
Lista todos os fretes cadastrados no sistema.

POST /fretes/
Cria um novo frete com todos os dados (descricao, peso, origem, destino, veiculo, prioridade, fragil).

GET /fretes/{id}
Retorna os detalhes de um frete especifico pelo ID.

POST /fretes/{id}/proposta
O motorista envia uma proposta para um frete. Precisa enviar: motorista_id, nome_motorista, valor,
tempo_estimado.

GET /fretes/{id}/propostas
Lista todas as propostas que os motoristas enviaram para um frete.

POST /fretes/{id}/aceitar-proposta
O cliente aceita uma proposta de um motorista especifico. O status do frete muda para aceito.

POST /fretes/{id}/cancelar
Tanto o cliente quanto o motorista podem cancelar um frete. O status muda para cancelado.

============================================================================================

PARTE 3 - FRONTEND CLIENTE (PASTA Frontend)

App.js
Modificado para suportar passagem de parametros entre telas (freightId). Quando o usuario navega
para a tela de negociacao, o ID do frete e passado junto.

RequestFreight.js
Ao escolher um veiculo, o app agora cria um frete REAL no backend com todos os dados preenchidos
(origem, destino, peso, veiculo, objeto detectado pela IA, prioridade e se e fragil). Depois navega
para a tela de negociacao.

Negotiation.js
Substituida a tela estatica por um sistema dinamico. Quando o usuario cria um frete, aparece
a mensagem Aguardando propostas enquanto nenhum motorista responde. O sistema faz uma busca
automatica a cada 5 segundos (polling) para verificar se chegaram propostas novas. Quando um
motorista envia uma proposta, o card dele aparece automaticamente. O usuario pode aceitar a
proposta clicando no botao. Tambem foi adicionado um botao vermelho de Cancelar Frete.

============================================================================================

PARTE 4 - FRONTEND MOTORISTA (PASTA Frontend Motorista)

requiscoes.js
Todas as chamadas de API foram atualizadas para apontar para os endpoints corretos do backend
Python (/fretes/ ao inves de /freights/available). A funcao submitProposal foi expandida para
aceitar motoristaId, nomeMotorista, valor e tempo.

Home.js
Os cards de frete agora sao buscados do backend usando axios (GET /fretes/) com polling de 5 segundos.
Mostra os dados reais: descricao, peso, origem, destino e tags (Urgente, Fragil, IA Confirmou).
Quando nenhum frete esta disponivel, mostra a mensagem Nenhum frete disponivel no momento.

Negotiation.js
Reescrito por completo. Agora ao clicar em um card na Home, o motorista ve os detalhes completos
do frete (descricao, peso, origem, destino, veiculo, resultado da IA, status). Tem um formulario
para o motorista digitar o valor da proposta e escolher o tempo estimado (15 min, 30 min, 45 min, 1h).
Ao enviar, a proposta aparece automaticamente no app do cliente. Tambem tem botao de cancelar.

History.js
Agora busca os fretes com status aceito, cancelado ou em andamento do backend via axios.
Mostra os cards com os dados reais de cada frete concluido.

RideDetail.js
Reescrito para buscar os detalhes de um frete especifico do backend via axios. Mostra todas as
informacoes: descricao, peso, objeto detectado pela IA, origem, destino, prioridade, status,
lista de propostas e se o objeto e fragil. Removida a dependencia de WebSocket.

Profile.js
Adicionados estados para buscar estatisticas do backend. O numero de fretes realizados agora
e dinamico (vem do endpoint GET /fretes/).

ChatList.js
Adicionados estados React (useState) para a lista de conversas. Preparado para integracao
com o backend quando o endpoint de chat for criado.

ChatDetail.js
Adicionados estados para mensagens e input de texto. O botao Enviar agora funciona e
adiciona a mensagem na lista localmente.

Chat.js
Adicionados estados para mensagens e input de texto. O botao Enviar funciona localmente.

============================================================================================

PARTE 5 - INFRAESTRUTURA E SCRIPTS

O script update_ip.ps1 foi atualizado para gerenciar a variavel WS_BASE_URL alem do API_BASE_URL.
Isso garante que tanto HTTP quanto WebSockets funcionem em redes locais dinamicas.

Foi instalado python-multipart no backend para suporte a upload de arquivos.
Foi atualizado o expo-linking no frontend para resolver conflitos de navegacao.
Foram adicionados logs detalhados em todo o fluxo para facilitar manutencoes futuras.

O import do RideDetail.js foi corrigido (o caminho para config.js estava errado).

============================================================================================

COMO EXECUTAR TUDO NA SUA MÁQUINA PASSO A PASSO

Se seu IP nao for fixo ou nao for o meu kk, entao siga esses passos
na ordem:

PASSO 1 - ATUALIZAR O IP
Abra o PowerShell e navegue ate a pasta Mudar_o_IP. Execute o script:

    cd Mudar_o_IP
    .\update_ip.ps1

Ele vai detectar seu IP atual e atualizar os arquivos config.js dos dois frontends automaticamente.

PASSO 2 - SUBIR O SERVIDOR BACKEND
Abra um terminal NOVO. Navegue ate a pasta Backend, ative o venv e execute:

    cd Backend
    .\venv\Scripts\activate
    python main.py

Espere aparecer a mensagem: Uvicorn running on http://0.0.0.0:8000

PASSO 3 - SUBIR O FRONTEND DO CLIENTE
Abra um terminal NOVO. Navegue ate a pasta Frontend e execute:

    cd Frontend
    npx expo start

Escaneie o QR code com o Expo Go no celular do cliente.

PASSO 4 - SUBIR O FRONTEND DO MOTORISTA
Abra um terminal NOVO. Navegue ate a pasta Frontend Motorista e execute:

    cd "Frontend Motorista"
    npx expo start

Se perguntar para usar outra porta, aceite. Escaneie o QR code com o Expo Go no celular
do motorista.

IMPORTANTE: O celular e o computador precisam estar na MESMA rede Wi-Fi para funcionar.
Se der erro de Network Request Failed, execute o script update_ip.ps1 novamente.

============================================================================================
