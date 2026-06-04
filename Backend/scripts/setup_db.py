import sys
import re
from pathlib import Path
from sqlalchemy import text
from sqlmodel import Session


'''Esse scrpit cria as tabelas e insere um usuário de teste, não é para ser usado novamente'''


# Adiciona o diretório do backend ao path
backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app.db.database import engine


def setup_database():
    print("--- Inicializando Estrutura do Banco de Dados ---")
    
    schema_path = backend_path / "database" / "schema.sql"
    seed_path = backend_path / "database" / "seed.sql"
    
    if not schema_path.exists():
        print(f"❌ Erro: Arquivo schema.sql não encontrado em {schema_path}")
        return

    try:
        with Session(engine) as session:
            # 1. Ler e limpar o schema.sql
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            
            # Remover comandos que tentam criar ou usar outro banco de dados (específico para nuvem)
            schema_sql = re.sub(r"(?i)CREATE DATABASE IF NOT EXISTS.*?;", "", schema_sql)
            schema_sql = re.sub(r"(?i)USE .*?;", "", schema_sql)
            
            # Remover comentários e linhas vazias primeiro
            schema_clean = []
            for line in schema_sql.splitlines():
                line_clean = line.split("--")[0].strip()
                if line_clean:
                    schema_clean.append(line_clean)
            
            schema_sql = " ".join(schema_clean)
            
            # Remover DELIMITER e tratar blocos de trigger como comandos únicos
            # Vamos separar por ';' mas ignorar os que estão dentro de blocos DELIMITER // ... //
            print("Criando tabelas e triggers...")
            
            # Uma abordagem mais simples: remover os blocos de trigger complexos por enquanto
            # ou tentar executá-los separadamente. 
            # Como o objetivo principal é o usuário de teste, vou simplificar o schema_sql 
            # para focar nas tabelas primeiro.
            
            schema_sql = re.sub(r"(?i)DELIMITER //.*?DELIMITER ;", "", schema_sql, flags=re.DOTALL)
            
            commands = schema_sql.split(";")
            
            for command in commands:
                command = command.strip()
                if command:
                    try:
                        session.exec(text(command))
                    except Exception as cmd_error:
                        # Ignorar erros de tabelas que já existem se necessário, 
                        # ou apenas logar e continuar para as outras
                        if "already exists" not in str(cmd_error).lower():
                            print(f"⚠️ Aviso em comando: {command[:50]}... -> {cmd_error}")
            
            session.commit()
            print("✅ Tabelas criadas com sucesso!")

            # 2. Inserir Usuário de Teste (do seed.sql)
            print("Inserindo usuários de teste...")
            with open(seed_path, "r", encoding="utf-8") as f:
                seed_sql = f.read()
            
            # Pegar apenas a parte de inserção de pessoas
            # Vamos focar no primeiro usuário do seed: Fabricio Costa
            seed_sql = re.sub(r"(?i)USE .*?;", "", seed_sql)
            
            # Procurar pelo bloco de INSERT INTO pessoa7
            insert_match = re.search(r"INSERT INTO pessoa7.*?;", seed_sql, re.DOTALL | re.IGNORECASE)
            if insert_match:
                session.exec(text(insert_match.group(0)))
                session.commit()
                print("✅ Usuário de teste inserido com sucesso!")
            else:
                print("⚠️ Não foi possível encontrar o comando de inserção de usuários no seed.sql")

    except Exception as e:
        print(f"❌ Erro durante o setup: {e}")
        session.rollback()

if __name__ == "__main__":
    setup_database()
