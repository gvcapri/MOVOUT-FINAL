import requests

def test_login():
    url = "http://127.0.0.1:8000/api/v1/auth/login"
    payload = {
        "email": "fabricio@ufmt.br",
        "senha": "123456"
    }
    
    print(f"Testando login para {payload['email']} em {url}...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Resposta: {response.json()}")
    except Exception as e:
        print(f"Erro ao conectar: {e}")

if __name__ == "__main__":
    test_login()
