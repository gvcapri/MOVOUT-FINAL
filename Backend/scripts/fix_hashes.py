import sys
from pathlib import Path
from sqlalchemy import text
from sqlmodel import Session

# Adiciona o diretório do backend ao path
backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app.db.database import engine

def fix_hashes():
    # Novo hash válido para '123456'
    valid_hash = "$2b$12$QFv1xQfksgieQam0foC.d.OjzOIMRzIwf8lBseOC//B7zYkTpmK1a"
    
    print(f"Atualizando todos os usuários com o hash válido de '123456'...")
    try:
        with Session(engine) as session:
            statement = text("UPDATE pessoa7 SET senha_hash = :hash")
            session.exec(statement, params={"hash": valid_hash})
            session.commit()
            print("✅ Hashes atualizados com sucesso!")
                
    except Exception as e:
        print(f"❌ Erro ao atualizar hashes: {e}")

if __name__ == "__main__":
    fix_hashes()
