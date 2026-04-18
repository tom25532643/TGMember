from fastapi import APIRouter, HTTPException
from app.state import session_manager
from pydantic import BaseModel

class SendMembersRequest(BaseModel):
    text: str
    max_count: int = 50

router = APIRouter(prefix='/supergroups', tags=['supergroups'])


@router.get('/{user_id}')
def list_supergroups(user_id: str):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    return {
        'ok': True,
        'data': session.get_supergroups()
    }


@router.get('/{user_id}/{chat_id}/members')
def get_members(user_id: str, chat_id: int):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        data = session.get_supergroup_members_preview(chat_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        'ok': True,
        'data': data
    }

@router.get('/{user_id}/{chat_id}/members/all')
def get_all_members(user_id: str, chat_id: int, max_pages: int = 10):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        data = session.get_all_supergroup_members(chat_id=chat_id, max_pages=max_pages)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        'ok': True,
        'data': data
    }

@router.post('/{user_id}/{chat_id}/send')
def send_to_members(user_id: str, chat_id: int, body: SendMembersRequest):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    try:
        result = session.send_to_members(
            chat_id=chat_id,
            text=body.text,
            max_count=body.max_count
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "ok": True,
        "data": result
    }