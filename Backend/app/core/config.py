"""
Configurações da aplicação carregadas do ambiente (.env).
"""
import os
from pathlib import Path

# Raiz do Backend (pasta que contém main.py e .env)
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_env_path = _BACKEND_ROOT / ".env"
if not _env_path.exists():
    _env_path = _BACKEND_ROOT / "app" / ".env"


def _load_env_manual():
    """Carrega .env manualmente (confiável no Windows, evita BOM/encoding)."""
    if not _env_path.exists():
        return
    with open(_env_path, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key, value = key.strip(), value.strip().strip("'\"")
                if key:
                    os.environ[key] = value


# Garante que Backend/.env seja carregado (prioridade sobre dotenv)
_load_env_manual()
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=True)
except Exception:
    pass

# Banco de dados
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "movout_db")
DATABASE_URL_ENV = os.getenv("DATABASE_URL") #variavel de ambiente


