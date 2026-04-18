from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.state import session_manager

router = APIRouter(prefix='/groups', tags=['groups'])

class SendTelegramGroupRequest(BaseModel):
    text: str


@router.get('/{user_id}')
def list_groups(user_id: str):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    return {
        'ok': True,
        'data': session.get_group_chats()
    }


@router.post('/{user_id}/{chat_id}/send')
def send_group_message(user_id: str, chat_id: int, body: SendTelegramGroupRequest):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail='text required')

    result = session.send_text(chat_id=chat_id, text=text)

    return {
        'ok': True,
        'data': result
    }