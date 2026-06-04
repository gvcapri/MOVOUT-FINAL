import requests
import json

# Configuração
BASE_URL = "http://localhost:8000/api/v1"

def test_profile_endpoint():
    print("--- Testando Endpoint de Perfil ---")
    
    # 1. Tentar buscar perfil de um motorista inexistente
    resp = requests.get(f"{BASE_URL}/motoristas/9999/perfil")
    if resp.status_code == 404:
        print("[OK] Motorista inexistente retorna 404.")
    else:
        print(f"[FALHA] Esperava 404 para motorista inexistente, mas recebi {resp.status_code}")

    # 2. Listar motoristas para pegar um ID válido (se houver)
    resp = requests.get(f"{BASE_URL}/motoristas/")
    if resp.status_code == 200:
        motoristas = resp.json()
        if motoristas:
            m_id = motoristas[0].get('id_motorista')
            print(f"Testando com motorista ID: {m_id}")
            
            # 3. Buscar perfil real
            resp_p = requests.get(f"{BASE_URL}/motoristas/{m_id}/perfil")
            if resp_p.status_code == 200:
                data = resp_p.json()
                print("[OK] Perfil retornado com sucesso:")
                print(json.dumps(data, indent=2))
                
                # Validar campos
                expected_fields = ["nome", "cpf", "total_fretes", "saldo_carteira"]
                for field in expected_fields:
                    if field in data:
                        print(f"  - Campo '{field}' presente.")
                    else:
                        print(f"  - [FALHA] Campo '{field}' ausente!")
            else:
                print(f"[FALHA] Erro ao buscar perfil: {resp_p.status_code}")
        else:
            print("[INFO] Nenhum motorista no banco para testar perfil real.")
    else:
        print(f"[FALHA] Erro ao listar motoristas: {resp.status_code}")

if __name__ == "__main__":
    try:
        test_profile_endpoint()
    except Exception as e:
        print(f"Erro ao executar teste: {e}")
