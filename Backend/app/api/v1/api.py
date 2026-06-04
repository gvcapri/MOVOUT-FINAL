from fastapi import APIRouter
from app.api.v1.endpoints import auth, motoristas, fretes, websockets, cliente

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(motoristas.router, prefix="/motoristas", tags=["Motoristas"])
api_router.include_router(fretes.router, prefix="/fretes", tags=["Fretes"])
api_router.include_router(websockets.router, prefix="/ws", tags=["Websockets"])
api_router.include_router(cliente.router, prefix="/cliente", tags=["Clientes"])
