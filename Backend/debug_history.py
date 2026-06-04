from sqlalchemy import text
from app.db.database import engine
from sqlmodel import Session

def debug_history(motorista_id):
    db = Session(engine)
    try:
        print(f"--- Debugando Histórico para Motorista {motorista_id} ---")
        
        # 1. Buscar histórico no esquema legado
        q_legado = text("""
            SELECT 
                id_frete as id, 
                descricao, 
                peso_estimado, 
                status, 
                origem, 
                destino, 
                preco_fechado as preco
            FROM frete7
            WHERE id_motorista = :motorista_id
        """)
        print("Executando query legado...")
        res_legado = db.exec(q_legado, params={"motorista_id": motorista_id}).fetchall()
        print(f"Legado: {len(res_legado)} registros")

        # 2. Buscar histórico no esquema novo
        q_novo = text("""
            SELECT 
                p.id, 
                p.descricao, 
                p.peso_estimado, 
                p.status, 
                p.origem, 
                p.destino, 
                pf.valor as preco
            FROM propostafrete pf
            JOIN pedidofrete p ON pf.frete_id = p.id
            WHERE pf.motorista_id = :motorista_id
        """)
        print("Executando query novo...")
        res_novo = db.exec(q_novo, params={"motorista_id": motorista_id}).fetchall()
        print(f"Novo: {len(res_novo)} registros")

        # Unificar e formatar
        historico = []
        for r in (res_legado + res_novo):
            m = r._mapping
            print(f"Processando registro: {m['id']}")
            historico.append({
                "id": m["id"],
                "descricao": m["descricao"],
                "peso_estimado": float(m["peso_estimado"]) if m["peso_estimado"] is not None else 0.0,
                "status": m["status"],
                "origem": m["origem"] if m["origem"] else "Não informado",
                "destino": m["destino"] if m["destino"] else "Não informado",
                "preco": float(m["preco"]) if m["preco"] is not None else 0.0
            })
        
        print("Sucesso!")
        print(historico)
        
    except Exception as e:
        import traceback
        print("ERRO DETALHADO:")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_history(1)
