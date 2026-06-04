import sys
import os
from pathlib import Path

# Adiciona o diretório do backend ao path para poder importar os módulos
# Isso permite que o script encontre a pasta 'app' mesmo sendo rodado de dentro de 'Backend' ou da raiz


''' Para executar o script, rode o comando: python verify_db.py se estiver na pasta backend
 ou python Backend/verify_db.py se estiver na raiz do projeto'''


backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

try:
    from app.db.database import test_connection
    print("--- Teste de Conexão com o Banco de Dados ---")
    print("Tentando conectar...")
    if test_connection():
        print("✅ CONEXÃO ESTABELECIDA COM SUCESSO!")
    else:
        print("❌ FALHA NA CONEXÃO. Verifique seu arquivo .env")
except ImportError:
    print("❌ Erro de Importação: Certifique-se de rodar o script a partir da raiz do projeto ou da pasta Backend.")
except Exception as e:
    print(f"❌ Erro inesperado: {e}")
