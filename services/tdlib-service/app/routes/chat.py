from fastapi import APIRouter, HTTPException

from app.core.errors import TdLibError
from app.schemas import SendMessageRequest
from app.state import session_manager

router = APIRouter(tags=['chat'])


@router.get('/chats/{user_id}')
def get_chats(user_id: str, limit: int = 50):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        return {'ok': True, 'data': session.get_chats(limit=limit)}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})


@router.get('/messages/{user_id}/{chat_id}')
def get_messages(user_id: str, chat_id: int, limit: int = 50):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        return {'ok': True, 'data': session.get_messages(chat_id=chat_id, limit=limit)}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})


@router.post('/send')
def send_message(req: SendMessageRequest):
    session = session_manager.get(req.user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        return {'ok': True, 'data': session.send_text(chat_id=req.chat_id, text=req.text)}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})
