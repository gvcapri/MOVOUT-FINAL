# 🗄️ Guia Completo: Configurar MySQL no Windows

Este guia vai te ajudar passo a passo a configurar o MySQL e conectar com o projeto Movout.

---

## ⚠️ IMPORTANTE: Modo SQL no MySQL Shell

Após conectar com `\connect root@localhost`, o **MySQL Shell abre em modo JavaScript** (o prompt mostra `JS >`).  
Comandos como `CREATE DATABASE`, `SHOW DATABASES` e `USE movout_db` **só funcionam em modo SQL**.

**Sempre que conectar, digite primeiro:**

```text
\sql
```

O prompt deve mudar para algo como `MySQL localhost:33060+ ssl SQL >`. A partir daí você pode usar todos os comandos SQL normalmente.

---

## 📋 Pré-requisitos

- ✅ MySQL instalado (você já tem!)
- ✅ MySQL Shell aberto (você já está com ele aberto!)

---

## 🚀 Passo 1: Verificar se o MySQL está rodando

Antes de tudo, precisamos garantir que o serviço MySQL está ativo no Windows.

### Opção A: Via Interface Gráfica
1. Pressione `Win + R`
2. Digite `services.msc` e pressione Enter
3. Procure por **MySQL80** (ou MySQL, dependendo da versão)
4. Verifique se o status está como **"Em execução"**
5. Se não estiver, clique com botão direito → **Iniciar**

### Opção B: Via PowerShell (Terminal)
Abra um novo terminal PowerShell e execute:

```powershell
Get-Service -Name MySQL*
```

Se o status não estiver como "Running", inicie com:

```powershell
Start-Service MySQL80
```

---

## 🔐 Passo 2: Configurar a senha do root (se necessário)

Se você acabou de instalar o MySQL, pode ser que não tenha senha configurada ainda. Vamos verificar:

### No MySQL Shell que você já tem aberto:

1. **Conecte-se ao servidor local:**
   ```text
   \connect root@localhost
   ```
   Se pedir senha e você não tiver, apenas pressione Enter.

2. **Troque para o modo SQL** (obrigatório para os próximos comandos):
   ```text
   \sql
   ```

3. **Se conseguir conectar, verifique se precisa criar senha:**
   ```sql
   SELECT user, host FROM mysql.user WHERE user='root';
   ```

4. **Se quiser definir uma senha (recomendado):**
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'sua_senha_aqui';
   FLUSH PRIVILEGES;
   ```
   
   ⚠️ **IMPORTANTE:** Anote essa senha! Você vai precisar dela no arquivo `.env`

---

## 🗃️ Passo 3: Criar o banco de dados

Agora vamos criar o banco de dados `movout_db` e todas as tabelas.

### No MySQL Shell:

1. **Conecte e mude para modo SQL:**
   ```text
   \connect root@localhost
   \sql
   ```

2. **Execute o script SQL** (escolha uma opção):

   - **Opção A – Caminho com aspas** (se o caminho tiver espaços, como em "Fabricio Costa"):
     ```text
     \source "C:/Users/Fabricio Costa/Desktop/FABRICIO/UFMT/setimo/MovoutCursor/Movout-repo/Backend/database/schema.sql"
     ```
   - **Opção B – Copiar e colar:** abra o arquivo `Backend/database/schema.sql` no editor, copie todo o conteúdo e cole no MySQL Shell (no modo SQL).
   - **Opção C – Criar banco e usar depois:** se `\source` der erro, crie o banco manualmente:
     ```sql
     CREATE DATABASE IF NOT EXISTS movout_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
     USE movout_db;
     ```
     Depois execute no MySQL Shell cada bloco do `schema.sql` (criação de tabelas) copiando e colando.

3. **Verifique se o banco foi criado:**
   ```sql
   SHOW DATABASES;
   ```
   Você deve ver `movout_db` na lista.

4. **Verifique se as tabelas foram criadas:**
   ```sql
   USE movout_db;
   SHOW TABLES;
   ```
   Você deve ver várias tabelas como `pessoa7`, `cliente7`, `motorista7`, etc.

---

## ⚙️ Passo 4: Criar o arquivo .env

O arquivo `.env` armazena as configurações de conexão com o banco de dados.

1. **Copie o arquivo de exemplo** (na pasta Backend):
   ```powershell
   cd "C:\Users\Fabricio Costa\Desktop\FABRICIO\UFMT\setimo\MovoutCursor\Movout-repo\Backend"
   Copy-Item .env.example .env
   ```
   Se não existir `.env.example`, use o arquivo `env.template` como base.

2. **Edite o arquivo `.env`** e configure suas credenciais:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=sua_senha_aqui
   DB_NAME=movout_db
   ```
   
   ⚠️ **Substitua `sua_senha_aqui` pela senha que você definiu no Passo 2!**
   
   Se você não definiu senha, deixe `DB_PASSWORD=` vazio.
   
   **Nota:** O Backend usa a porta **3306** (protocolo clássico). O MySQL Shell pode mostrar 33060 (X Protocol); para os scripts Python use sempre a porta configurada no `.env` (3306).

---

## ✅ Passo 5: Testar a conexão

Agora vamos verificar se tudo está funcionando!

1. **Certifique-se de estar na pasta Backend:**
   ```powershell
   cd "C:\Users\Fabricio Costa\Desktop\FABRICIO\UFMT\setimo\MovoutCursor\Movout-repo\Backend"
   ```

2. **Ative o ambiente virtual (se ainda não ativou):**

   python -m venv venv

   ```powershell
   .\venv\Scripts\activate
   ```

3. **Instale as dependências (se ainda não instalou):**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Execute o script de teste:**
   ```powershell
   python tests/test_mysql_connection.py
   ```

5. **Se aparecer "✅ SUCESSO!", você está pronto!** 🎉

---

## 🐛 Solução de Problemas

### Erro: "Expected ; but found DATABASE" ou "Expected ; but found databases"
O MySQL Shell está em **modo JavaScript** (prompt `JS >`). Comandos como `CREATE DATABASE` e `SHOW databases` são SQL, não JavaScript.  
**Solução:** Digite `\sql` e pressione Enter. O prompt deve mudar para `SQL >`. Depois execute o comando de novo.

### Erro: "Failed to open file 'C:/Users/...' (No such file or directory)" ao usar \source
- Caminhos com **espaços** (ex.: "Fabricio Costa") devem estar entre **aspas**: `\source "C:/Users/Fabricio Costa/.../schema.sql"`.
- Confirme que o caminho está correto e que o arquivo existe.

### Erro: "Can't connect to MySQL server"
- ✅ Verifique se o serviço MySQL está rodando (Passo 1)
- ✅ Verifique se a porta 3306 está correta no `.env`

### Erro: "Access denied for user 'root'@'localhost'" ou "(using password: NO)"
- **Você conecta no MySQL Shell sem digitar senha (só Enter)?**  
  Então o root **não tem senha**. No `.env` deixe: **`DB_PASSWORD=`** (vazio, sem nada depois do `=`).
- **Você digita uma senha ao conectar no MySQL Shell?**  
  Então no `.env` use **exatamente a mesma senha**: **`DB_PASSWORD=suasenha`** (a mesma que você digita no Shell).
- **(using password: NO)** = o programa não está enviando senha. Confira:
  - O arquivo `.env` está **na pasta Backend** (mesma pasta do `main.py`).
  - A linha é **`DB_PASSWORD=valor`** sem aspas: `DB_PASSWORD=admin123`, não `DB_PASSWORD="admin123"`.
  - Salve o `.env` em UTF-8 (no Notepad: Salvar como → Codificação: UTF-8).

### Erro: "Unknown database 'movout_db'"
- ✅ Execute o script `schema.sql` no MySQL Shell (Passo 3)

### Erro: "ModuleNotFoundError: No module named 'pymysql'"
- ✅ Execute: `pip install pymysql`

---

## 📝 Comandos Úteis do MySQL Shell

Sempre que abrir o Shell e conectar, use `\sql` antes de comandos SQL:

```text
\connect root@localhost
\sql
```

Depois você pode usar:

```sql
SHOW DATABASES;
USE movout_db;
SHOW TABLES;
DESCRIBE pessoa7;
```

Para sair:

```text
\quit
```

---

## 🎯 Próximos Passos

Após conectar com sucesso:

1. ✅ Você pode rodar o servidor: `python -m uvicorn main:app --reload`
2. ✅ Acessar o Swagger: http://127.0.0.1:8000/docs
3. ✅ (Opcional) Popular com dados de teste: Execute `seed.sql` no MySQL Shell

---

**Precisa de ajuda?** Verifique os logs de erro e compare com as soluções acima! 🚀
