from fastapi import APIRouter, HTTPException
from app.state import session_manager
from pydantic import BaseModel
from typing import Optional, List

class SendFolderRequest(BaseModel):
    text: str
    exclude_types: Optional[List[str]] = None
    retry_failed: bool = True

class GetFolderChatsPreviewRequest(BaseModel):
    exclude_types: Optional[List[str]] = None

router = APIRouter(prefix='/folders', tags=['folders'])


@router.get('/{user_id}')
def get_folders(user_id: str):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    return {'ok': True, 'data': session.get_folders()}


@router.get('/{user_id}/{folder_id}/chats')
def get_folder_chats(user_id: str, folder_id: int):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    return {
        'ok': True,
        'data': session.get_folder_chats(folder_id)
    }


@router.post('/{user_id}/{folder_id}/preview')
def preview_folder_send(user_id: str, folder_id: int, body: Optional[GetFolderChatsPreviewRequest] = None):
    """
    預覽將要發送的 chats，支援過濾特定 type。
    
    exclude_types 範例: ['chatTypeChannel', 'chatTypeBasicGroup', 'chatTypeSupergroup']
    """
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    exclude_types = (body.exclude_types if body else None) or []
    return {
        'ok': True,
        'data': session.get_folder_chats_preview(folder_id, exclude_types)
    }


@router.post('/{user_id}/{folder_id}/send')
def send_folder(user_id: str, folder_id: int, body: SendFolderRequest):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail='text required')

    return {
        'ok': True,
        'data': session.send_to_folder(
            folder_id,
            text,
            exclude_types=body.exclude_types,
            retry_failed=body.retry_failed
        )
    }

