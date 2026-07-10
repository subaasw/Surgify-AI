"""Per-session WebSocket connection manager with broadcast + cleanup."""
import asyncio
from datetime import datetime, timezone

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(session_id, set()).add(ws)

    async def disconnect(self, session_id: str, ws: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(session_id)
            if conns:
                conns.discard(ws)
                if not conns:
                    self._connections.pop(session_id, None)

    def has_listeners(self, session_id: str) -> bool:
        return bool(self._connections.get(session_id))

    async def broadcast(self, session_id: str, message_type: str, payload: dict) -> None:
        envelope = {
            "type": message_type,
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(session_id, ())):
            try:
                await ws.send_json(envelope)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(session_id, ws)


manager = WebSocketManager()


def broadcast_soon(session_id: str, message_type: str, payload: dict) -> None:
    """Fire-and-forget broadcast from sync (request-handler) code."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(manager.broadcast(session_id, message_type, payload))
