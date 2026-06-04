import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_register():
    print("--- Testando Cadastro (POST /auth/register) ---")
    payload = {
        "nome": "Motorista Teste",
        "email": "teste_reg@email.com",
        "senha": "123",
        "cpf": "12345678901",
        "tipo": "motorista",
        "veiculo": "Caminhão",
        "marca": "Volvo",
        "placa": "ABC-1234"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload)
        print(f"Status Code: {resp.status_code}")
        print("Resposta:")
        print(json.dumps(resp.json(), indent=2))
    except Exception as e:
        print(f"Erro na requisição: {e}")

if __name__ == "__main__":
    test_register()
