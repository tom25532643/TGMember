from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.state import ws_manager

router = APIRouter(tags=['ws'])


@router.websocket('/ws/{user_id}')
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await ws_manager.connect(user_id, websocket)
    try:
        await websocket.send_json({'event': 'connected', 'user_id': user_id})
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({'event': 'pong', 'message': data})
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)

@router.websocket('/ws/{user_id}/{chat_id}')
async def websocket_chat_endpoint(websocket: WebSocket, user_id: str, chat_id: str):
    await ws_manager.connect(user_id, websocket, chat_id=chat_id)
    try:
        await websocket.send_json({
            'event': 'connected',
            'user_id': user_id,
            'chat_id': chat_id,
        })
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                'event': 'pong',
                'message': data,
                'chat_id': chat_id,
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket, chat_id=chat_id)
    except Exception:
        ws_manager.disconnect(user_id, websocket, chat_id=chat_id)
