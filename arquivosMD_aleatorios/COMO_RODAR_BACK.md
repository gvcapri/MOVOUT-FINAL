Passo 1: Navegar até a pasta do Backend
Abra o PowerShell e entre no diretório do projeto. Substitua o caminho abaixo caso a pasta esteja em outro local:

# APÓS MUDAR O IP, RODE:

# 1. 
cd Backend

Passo 2: Criar e ativar o Ambiente Virtual (.venv)
Para isolar as dependências do projeto e evitar conflitos com o sistema global:


# 2. { Cria o ambiente virtual chamado .venv 
python -m venv .venv
# }
# 3. { Ativa o ambiente virtual no PowerShell 
.\.venv\Scripts\Activate.ps1
# }
Nota: Após a ativação, o prefixo (.venv) deve aparecer no início da linha de comando do seu terminal.

Passo 3: Instalar as Dependências do Python
Com o ambiente virtual ativo, instale todas as bibliotecas necessárias listadas no projeto (incluindo FastAPI, Uvicorn, SQLModel e PyMySQL):

# 4. {
pip install -r requirements.txt
# }
Passo 4: Baixar o Certificado SSL (isrgrootx1.pem)
Como o banco de dados exige uma conexão criptografada (SSL), você precisa baixar o certificado oficial da Let's Encrypt direto para a raiz da pasta Backend:

# 5. { ele vai criar um arquivo isrgrootx1.pem na raiz do projeto
Invoke-WebRequest -Uri "https://letsencrypt.org/certs/isrgrootx1.pem" -OutFile "isrgrootx1.pem"
# }
Passo 5: Criar o Arquivo de Configuração (.env)
Copie e cole este bloco inteiro no seu terminal. Ele criará o arquivo .env configurado com a string de conexão exata do banco de dados na nuvem, apontando para o certificado que você acabou de baixar:

# 6. {copia e cola isso tudo no terminal
@"
DATABASE_URL=mysql+pymysql://3oHxWreigEQPkmB.root:4R1KiaFlcRmCtqkY@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/movout7?charset=utf8mb4&ssl_ca=isrgrootx1.pem
"@ | Set-Content -Encoding UTF8 .env
# }

Passo 6: Iniciar o Servidor do Backend
Agora que tudo está configurado, você pode rodar a aplicação através do arquivo principal:

# 7. {ele vai criar a aplicação na porta 8000, e vai ficar rodando até vc fechar o terminal com ctr+c
python main.py
# }
(Se preferir o comando manual do uvicorn, você também pode usar: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload)


## Rodar motorista
```bash
cd "Frontend Motorista"
npm install
npx expo start -c
```
## Rodar cliente
```bash
cd Frontend
npm install
npx expo start -c
```