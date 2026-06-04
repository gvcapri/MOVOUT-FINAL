from sqlalchemy import text
from app.db.database import engine

def diagnose():
    with engine.connect() as conn:
        print("--- Tabelas no Banco ---")
        res = conn.execute(text("SHOW TABLES"))
        for row in res:
            print(row[0])
            
        print("\n--- Conteúdo de pessoa7 ---")
        res = conn.execute(text("SELECT id_pessoa, nome, email FROM pessoa7 LIMIT 5"))
        for row in res:
            print(row)
            
        print("\n--- Conteúdo de motorista7 ---")
        res = conn.execute(text("SELECT id_motorista, id_pessoa, data_inicio FROM motorista7 LIMIT 5"))
        for row in res:
            print(row)
            
        print("\n--- Conteúdo de frete7 ---")
        res = conn.execute(text("SELECT id_frete, id_motorista, status FROM frete7 LIMIT 5"))
        for row in res:
            print(row)

if __name__ == "__main__":
    diagnose()
