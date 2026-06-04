from typing import Dict, List

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, frete_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(frete_id, []).append(websocket)

    def disconnect(self, frete_id: int, websocket: WebSocket):
        self.active_connections[frete_id].remove(websocket)

    async def send_location(self, frete_id: int, message: dict):
        for ws in self.active_connections.get(frete_id, []):
            await ws.send_json(message)

manager = ConnectionManager()
