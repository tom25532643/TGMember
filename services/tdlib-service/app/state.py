from app.services.session import TdSessionManager
from app.ws.manager import WsConnectionManager

session_manager = TdSessionManager()
ws_manager = WsConnectionManager()
MAIN_EVENT_LOOP = None


def bind_session_helpers(session):
    if MAIN_EVENT_LOOP is not None:
        session.attach_broadcast(
            ws_manager.broadcast_to_user,
            MAIN_EVENT_LOOP,
            ws_manager.broadcast_to_chat,
        )