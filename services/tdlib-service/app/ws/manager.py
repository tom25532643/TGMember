import threading
from fastapi import WebSocket


class WsConnectionManager:
    def __init__(self):
        # user_id -> chat_id -> [WebSocket, ...]
        self._connections: dict[str, dict[str, list[WebSocket]]] = {}
        self._lock = threading.Lock()

    async def connect(self, user_id: str, websocket: WebSocket, chat_id: str | None = None):
        await websocket.accept()

        room = chat_id or "__all__"

        with self._lock:
            self._connections.setdefault(user_id, {})
            self._connections[user_id].setdefault(room, []).append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket, chat_id: str | None = None) -> None:
        room = chat_id or "__all__"

        with self._lock:
            user_rooms = self._connections.get(user_id, {})
            conns = user_rooms.get(room, [])

            if websocket in conns:
                conns.remove(websocket)

            if not conns and room in user_rooms:
                del user_rooms[room]

            if not user_rooms and user_id in self._connections:
                del self._connections[user_id]

    async def broadcast_to_user(self, user_id: str, message: dict) -> None:
        """
        廣播給該 user 的所有 websocket，包括：
        - 全域 user room (__all__)
        - 各 chat room
        """
        with self._lock:
            user_rooms = self._connections.get(user_id, {})
            all_conns: list[tuple[str, WebSocket]] = []

            for room, conns in user_rooms.items():
                for ws in conns:
                    all_conns.append((room, ws))

        dead: list[tuple[str, WebSocket]] = []

        for room, ws in all_conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append((room, ws))

        if dead:
            with self._lock:
                user_rooms = self._connections.get(user_id, {})

                for room, ws in dead:
                    conns = user_rooms.get(room, [])
                    if ws in conns:
                        conns.remove(ws)
                    if not conns and room in user_rooms:
                        del user_rooms[room]

                if not user_rooms and user_id in self._connections:
                    del self._connections[user_id]

    async def broadcast_to_chat(self, user_id: str, chat_id: str, message: dict) -> None:
        """
        只廣播給指定 user + chat_id room
        """
        with self._lock:
            user_rooms = self._connections.get(user_id, {})
            conns = list(user_rooms.get(chat_id, []))

        dead: list[WebSocket] = []

        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        if dead:
            with self._lock:
                user_rooms = self._connections.get(user_id, {})
                conns = user_rooms.get(chat_id, [])

                for ws in dead:
                    if ws in conns:
                        conns.remove(ws)

                if not conns and chat_id in user_rooms:
                    del user_rooms[chat_id]

                if not user_rooms and user_id in self._connections:
                    del self._connections[user_id]