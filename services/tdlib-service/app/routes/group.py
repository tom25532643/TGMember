from fastapi import APIRouter, HTTPException
from app.state import session_manager
from pydantic import BaseModel
from typing import Optional, List
import requests

class SendGroupRequest(BaseModel):
    text: str
    exclude_types: Optional[List[str]] = None
    retry_failed: bool = True

class GetGroupPreviewRequest(BaseModel):
    exclude_types: Optional[List[str]] = None

router = APIRouter(prefix='/groups', tags=['groups'])

BACKEND_API_BASE = 'http://127.0.0.1:8001'

def get_group_members_from_backend(group_id: int):
    """從 backend-api 獲取群組成員列表"""
    try:
        resp = requests.get(f'{BACKEND_API_BASE}/groups/{group_id}/members')
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f'Error getting group members: {e}')
        return []


@router.post('/{user_id}/{group_id}/preview')
def preview_group_send(user_id: str, group_id: int, body: Optional[GetGroupPreviewRequest] = None):
    """
    預覽群組發送：獲取群組成員列表，然後預覽每個會員的所有 folders
    """
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    # 從 backend-api 獲取群組成員列表
    group_members = get_group_members_from_backend(group_id)
    if not group_members:
        return {
            'ok': True,
            'data': {
                'total': 0,
                'included': 0,
                'excluded': 0,
                'chats': [],
                'excluded_chats': [],
                'note': '群組沒有會員或無法獲取會員列表'
            }
        }

    exclude_types = (body.exclude_types if body else None) or []

    all_chats = []
    total = 0

    # 對每個群組成員預覽 folders
    for member in group_members:
        member_user_id = str(member['id'])  # 假設 member 有 id 欄位
        try:
            # 獲取該會員的 session
            member_session = session_manager.get(member_user_id)
            if not member_session:
                print(f'No session for member {member_user_id}')
                continue

            # 獲取該會員的所有 folders
            folders = member_session.get_folders()

            for folder in folders:
                folder_id = folder['id']
                try:
                    folder_chats = member_session.get_folder_chats_preview(folder_id, exclude_types)
                    chats = folder_chats.get('chats', [])
                    # 為每個 chat 添加會員資訊
                    for chat in chats:
                        chat['member_id'] = member['id']
                        chat['member_name'] = member.get('name', f'Member {member["id"]}')
                    all_chats.extend(chats)
                    total += folder_chats.get('total', 0)
                except Exception as e:
                    print(f'Error previewing folder {folder_id} for member {member_user_id}: {e}')
                    continue
        except Exception as e:
            print(f'Error processing member {member_user_id}: {e}')
            continue

    # 簡單的去重（基於 chat_id）
    seen_chat_ids = set()
    unique_chats = []
    for chat in all_chats:
        chat_id = chat.get('chat_id')
        if chat_id not in seen_chat_ids:
            seen_chat_ids.add(chat_id)
            unique_chats.append(chat)

    return {
        'ok': True,
        'data': {
            'total': len(unique_chats),
            'included': len(unique_chats),
            'excluded': 0,
            'chats': unique_chats,
            'excluded_chats': [],
            'note': f'預覽了 {len(group_members)} 個群組成員的 folders'
        }
    }


@router.post('/{user_id}/{group_id}/send')
def send_group(user_id: str, group_id: int, body: SendGroupRequest):
    """
    群組發送：獲取群組成員列表，然後對每個會員的所有 folders 發送訊息
    """
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail='text required')

    # 從 backend-api 獲取群組成員列表
    group_members = get_group_members_from_backend(group_id)
    if not group_members:
        return {
            'ok': True,
            'data': {
                'total': 0,
                'success': 0,
                'failed': 0,
                'results': [],
                'note': '群組沒有會員或無法獲取會員列表'
            }
        }

    exclude_types = body.exclude_types or []
    retry_failed = body.retry_failed

    all_results = []
    total_sent = 0
    success_count = 0
    failed_count = 0

    # 對每個群組成員發送
    for member in group_members:
        member_user_id = str(member['id'])  # 假設 member 有 id 欄位
        try:
            # 獲取該會員的 session
            member_session = session_manager.get(member_user_id)
            if not member_session:
                print(f'No session for member {member_user_id}')
                all_results.append({
                    'member_id': member['id'],
                    'member_name': member.get('name', f'Member {member["id"]}'),
                    'ok': False,
                    'error': 'No session found for this member'
                })
                failed_count += 1
                continue

            # 獲取該會員的所有 folders
            folders = member_session.get_folders()

            member_results = []
            member_total = 0
            member_success = 0
            member_failed = 0

            for folder in folders:
                folder_id = folder['id']
                try:
                    result = member_session.send_to_folder(
                        folder_id,
                        text,
                        exclude_types=exclude_types,
                        retry_failed=retry_failed
                    )
                    folder_results = result.get('results', [])
                    # 為每個結果添加會員和 folder 資訊
                    for r in folder_results:
                        r['member_id'] = member['id']
                        r['member_name'] = member.get('name', f'Member {member["id"]}')
                        r['folder_id'] = folder_id
                        r['folder_name'] = folder.get('name', f'Folder {folder_id}')

                    member_results.extend(folder_results)
                    member_total += result.get('total', 0)
                    member_success += result.get('success', 0)
                    member_failed += result.get('failed', 0)
                except Exception as e:
                    print(f'Error sending to folder {folder_id} for member {member_user_id}: {e}')
                    member_failed += 1
                    continue

            all_results.extend(member_results)
            total_sent += member_total
            success_count += member_success
            failed_count += member_failed

        except Exception as e:
            print(f'Error processing member {member_user_id}: {e}')
            all_results.append({
                'member_id': member['id'],
                'member_name': member.get('name', f'Member {member["id"]}'),
                'ok': False,
                'error': str(e)
            })
            failed_count += 1
            continue

    return {
        'ok': True,
        'data': {
            'total': total_sent,
            'success': success_count,
            'failed': failed_count,
            'results': all_results,
            'note': f'對 {len(group_members)} 個群組成員發送完成'
        }
    }