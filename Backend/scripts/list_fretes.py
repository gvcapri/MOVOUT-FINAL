"""
Script para listar todos os fretes cadastrados no backend.
Uso: python scripts/list_fretes.py
"""
import requests

API = "http://localhost:8000/api/v1/fretes/"

try:
    resp = requests.get(API)
    fretes = resp.json()

    if not fretes:
        print("Nenhum frete cadastrado no momento.")
    else:
        print(f"Total de fretes: {len(fretes)}\n")
        print("-" * 80)
        for f in fretes:
            print(f"ID:         {f.get('id')}")
            print(f"Descricao:  {f.get('descricao')}")
            print(f"Peso:       {f.get('peso_estimado')} kg")
            print(f"Origem:     {f.get('origem', '—')}")
            print(f"Destino:    {f.get('destino', '—')}")
            print(f"Veiculo:    {f.get('tipo_veiculo', '—')}")
            print(f"Objeto IA:  {f.get('objeto_ia', '—')}")
            print(f"Prioridade: {f.get('prioridade', '—')}")
            print(f"Fragil:     {f.get('fragil', False)}")
            print(f"Status:     {f.get('status')}")
            propostas = f.get('propostas', [])
            print(f"Propostas:  {len(propostas)}")
            for p in propostas:
                print(f"   -> {p['nome_motorista']}: R${p['valor']:.2f} ({p['tempo_estimado']})")
            print("-" * 80)

except requests.ConnectionError:
    print("ERRO: Backend nao esta rodando. Execute 'python main.py' primeiro.")
