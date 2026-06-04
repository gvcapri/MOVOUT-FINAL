import sys
from pathlib import Path
from sqlalchemy import text
from sqlmodel import Session

'''Para rodar esse script basta: python Backend/scripts/check_users.py ou mudar
de acordo com o diretório que estiver'''

# Adiciona o diretório do backend ao path
backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app.db.database import engine

def list_users():
    print("--- Buscando Usuários no Banco de Dados ---")
    try:
        with Session(engine) as session:
            # Query para buscar pessoa e seus papéis (Cliente/Motorista)
            statement = text("""
                SELECT p.nome, p.email, p.cpf, 
                       c.id_cliente, m.id_motorista
                FROM pessoa7 p
                LEFT JOIN cliente7 c ON p.id_pessoa = c.id_pessoa
                LEFT JOIN motorista7 m ON p.id_pessoa = m.id_pessoa
            """)
            results = session.exec(statement).all()
            
            if not results:
                print("⚠️ Nenhuma pessoa encontrada na tabela 'pessoa7'.")
                return

            print(f"Total de usuários encontrados: {len(results)}")
            print("-" * 50)
            for row in results:
                roles = []
                if row.id_cliente: roles.append("Cliente")
                if row.id_motorista: roles.append("Motorista")
                tipo = ", ".join(roles) if roles else "Apenas Pessoa"
                
                print(f"Nome: {row.nome}")
                print(f"Email: {row.email}")
                print(f"CPF: {row.cpf}")
                print(f"Tipo: {tipo}")
                print("-" * 50)
                
    except Exception as e:
        print(f"❌ Erro ao acessar os dados: {e}")

if __name__ == "__main__":
    list_users()
