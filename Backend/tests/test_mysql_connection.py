"""
Teste de conexão com o MySQL.
Execute a partir da raiz do Backend: python tests/test_mysql_connection.py
Ou da raiz do repositório: python Backend/tests/test_mysql_connection.py
"""
import os
import sys
from pathlib import Path

# Raiz do Backend (pasta que contém main.py e .env)
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

# Carrega .env manualmente da pasta Backend (evita "using password: NO" no Windows)
_env_file = _ROOT / ".env"
if _env_file.exists():
    with open(_env_file, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip().strip('"\'')
                if key:
                    os.environ[key] = value
else:
    print(f"[Aviso] Arquivo .env não encontrado em: {_env_file}")
    print("        Crie a partir de .env.example e defina DB_PASSWORD.\n")

from app.db.database import test_connection, engine


def main():
    print("=" * 50)
    print("TESTE DE CONEXÃO COM MYSQL")
    print("=" * 50)
    print()

    db_url = str(engine.url).split("@")
    if len(db_url) > 1:
        print(f"Tentando conectar em: {db_url[1]}")
    else:
        print(f"Tentando conectar em: {engine.url}")
    print()

    if test_connection():
        print("[OK] SUCESSO! Conexao com MySQL estabelecida!")
        print()
        print("Você pode agora rodar o servidor com:")
        print("  python -m uvicorn main:app --reload")
    else:
        print("[ERRO] Nao foi possivel conectar ao MySQL.")
        print()
        senha_definida = "sim" if os.environ.get("DB_PASSWORD") else "não"
        print(f"  .env usado: {_env_file}")
        print(f"  DB_PASSWORD definido no ambiente: {senha_definida}")
        print()
        print("Verifique:")
        print("  1. Se o MySQL está rodando (serviço MySQL80 deve estar ativo)")
        print("  2. Se no .env a linha DB_PASSWORD= é a mesma senha do usuário root no MySQL")
        print("  3. Se o banco 'movout_db' existe (no MySQL Shell: \\sql depois SHOW DATABASES;)")
        print("  4. Se no MySQL você definiu senha para root, ela deve estar em DB_PASSWORD no .env")
        print()
        print("Consulte: GUIA_MYSQL.md (modo SQL: digite \\sql após conectar)")


if __name__ == "__main__":
    main()
