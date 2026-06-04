import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.v1.api import api_router
from app.db.database import create_db_and_tables

app = FastAPI(title="Movout API")

# Mount Static Files
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "app" / "static", html=True), name="static")

# TODO: Configurar CORS corretamente para produção
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def raiz():
    return {"mensagem": "API Movout está online e modularizada!"}

if __name__ == "__main__":
    # Permite rodar o servidor apenas com 'python main.py'
    # O host 0.0.0.0 permite conexões externas (celular no Wi-Fi)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)