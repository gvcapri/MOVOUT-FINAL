import sys
from pathlib import Path
from sqlalchemy import text
from sqlmodel import Session

'''Para rodar esse script basta: python .\Backend\scripts\list_tables.py ou mudar
de acordo com o diretório que estiver'''

# Adiciona o diretório do backend ao path
backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app.db.database import engine

def list_tables():
    print("--- Listando Tabelas no Banco de Dados ---")
    try:
        with Session(engine) as session:
            # Query para listar todas as tabelas
            statement = text("SHOW TABLES")
            results = session.exec(statement).all()
            
            if not results:
                print("⚠️ Nenhuma tabela encontrada no banco de dados.")
                return

            print(f"Total de tabelas encontradas: {len(results)}")
            print("-" * 40)
            for row in results:
                print(f"Tabela: {row[0]}")
                
    except Exception as e:
        print(f"❌ Erro ao listar tabelas: {e}")

if __name__ == "__main__":
    list_tables()
