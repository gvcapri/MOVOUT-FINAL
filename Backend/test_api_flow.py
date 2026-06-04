import requests
import json
import time
import sys

# Cores para o terminal
GREEN = "\033[92m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"

BASE_URL = "http://127.0.0.1:8000/api/v1"

def print_step(message):
    print(f"\n{CYAN}{'='*50}{RESET}")
    print(f"{CYAN}🚀 {message}{RESET}")
    print(f"{CYAN}{'='*50}{RESET}")

def test_flow():
    print(f"{YELLOW}Iniciando simulação de fluxo da API Movout...{RESET}")
    
    # 1. Criar Motorista
    print_step("CRIANDO MOTORISTA")
    motorista_data = {
        "nome": "Carlos Silva (Simulado)",
        "tipo_veiculo": "Caminhão Baú",
        "capacidade_kg": 5000,
        "disponivel": True
    }
    try:
        response = requests.post(f"{BASE_URL}/motoristas/", json=motorista_data)
        if response.status_code == 200:
            print(f"{GREEN}✅ Motorista criado com sucesso!{RESET}")
            print(f"Dados: {json.dumps(response.json(), indent=2)}")
            motorista_id = response.json().get("id")
        else:
            print(f"{RED}❌ Erro ao criar motorista: {response.status_code}{RESET}")
            print(response.text)
            return
    except requests.exceptions.ConnectionError:
        print(f"{RED}❌ Erro de conexão! O servidor está rodando em {BASE_URL}?{RESET}")
        return

    # 2. Listar Motoristas
    print_step("LISTANDO MOTORISTAS REGISTRADOS")
    response = requests.get(f"{BASE_URL}/motoristas/")
    print(f"Status: {response.status_code}")
    motoristas = response.json()
    print(f"Total de motoristas encontrados: {len(motoristas)}")
    # Mostra os últimos 3
    for m in motoristas[-3:]:
        print(f"- {m['nome']} (ID: {m['id']}) - Disponível: {m['disponivel']}")

    # 3. Criar Frete
    print_step("CRIANDO PEDIDO DE FRETE")
    frete_data = {
        "descricao": "Mudança Completa Residencial (Simulação)",
        "peso_estimado": 3000,
        "status": "aberto"
    }
    response = requests.post(f"{BASE_URL}/fretes/", json=frete_data)
    if response.status_code == 200:
        print(f"{GREEN}✅ Frete criado com sucesso!{RESET}")
        print(f"Dados: {json.dumps(response.json(), indent=2)}")
        frete_id = response.json().get("id")
    else:
        print(f"{RED}❌ Erro ao criar frete: {response.status_code}{RESET}")
        print(response.text)
        return

    # 4. Tentar Match
    print_step("BUSCANDO MATCH (FRETE <-> MOTORISTA)")
    print(f"Tentando encontrar motorista para o Frete ID: {frete_id} com peso {frete_data['peso_estimado']}kg...")
    
    # Pequena pausa para dar tempo de ver no terminal do servidor
    time.sleep(1)
    
    response = requests.post(f"{BASE_URL}/fretes/{frete_id}/match")
    
    if response.status_code == 200:
        match_data = response.json()
        if "mensagem" in match_data and match_data["mensagem"] == "Nenhum motorista disponível":
             print(f"{YELLOW}⚠️  Nenhum motorista disponível no momento.{RESET}")
        else:
            print(f"{GREEN}✅ MATCH ENCONTRADO!{RESET}")
            print(f"Frete: {match_data['frete']['descricao']} (Status: {match_data['frete']['status']})")
            print(f"Motorista Selecionado: {match_data['motorista']['nome']} (ID: {match_data['motorista']['id']})")
    else:
        print(f"{RED}❌ Erro no endpoint de match: {response.status_code}{RESET}")
        print(response.text)

if __name__ == "__main__":
    test_flow()
