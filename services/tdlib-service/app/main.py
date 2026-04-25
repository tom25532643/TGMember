import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_TITLE
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.ws import router as ws_router
import app.state as app_state
from app.state import session_manager
from app.routes import folder
from app.routes import group
from app.routes import supergroup
from app.state import ws_manager
from app.routes import files




app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def attach_ws_to_all_sessions():
    loop = asyncio.get_running_loop()

    for session in session_manager._sessions.values():
        session.attach_broadcast(
            user_broadcast_fn=ws_manager.broadcast_to_user,
            chat_broadcast_fn=ws_manager.broadcast_to_chat,
            loop=loop,
        )


@app.on_event("startup")
async def on_startup():
    result = session_manager.restore_all_sessions()
   
    await attach_ws_to_all_sessions()

    print(
        f"[RESTORE] found={result['found']} "
        f"restored={len(result['restored'])} "
        f"failed={len(result['failed'])}"
    )

@app.get('/health')
def health():
    return {'ok': True}

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(ws_router)
app.include_router(folder.router)
app.include_router(group.router)
app.include_router(supergroup.router)
app.include_router(files.router)