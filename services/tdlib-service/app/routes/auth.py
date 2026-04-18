import time
from fastapi import APIRouter, HTTPException

from app.core.errors import TdLibError
from app.schemas import StartAuthRequest, SubmitCodeRequest, SubmitPasswordRequest, SubmitPhoneRequest
from app.state import bind_session_helpers, session_manager

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/start')
def auth_start(req: StartAuthRequest):
    try:
        session = session_manager.get_or_create(req.user_id)
        bind_session_helpers(session)
        session.start()
        time.sleep(1.0)

        state = session.get_state()
        if state['auth_state'] == 'authorizationStateWaitTdlibParameters':
            session.set_tdlib_parameters()
            time.sleep(1.0)
            state = session.get_state()

        return {'ok': True, 'message': 'Auth session started', 'data': state}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post('/phone')
def auth_phone(req: SubmitPhoneRequest):
    session = session_manager.get(req.user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found. Call /auth/start first.')

    try:
        session.submit_phone(req.phone_number)
        time.sleep(1.0)
        return {'ok': True, 'message': 'Phone number submitted', 'data': session.get_state()}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post('/code')
def auth_code(req: SubmitCodeRequest):
    session = session_manager.get(req.user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found. Call /auth/start first.')

    try:
        session.submit_code(req.code)
        time.sleep(1.0)
        return {'ok': True, 'message': 'Code submitted', 'data': session.get_state()}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post('/password')
def auth_password(req: SubmitPasswordRequest):
    session = session_manager.get(req.user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found. Call /auth/start first.')

    try:
        session.submit_password(req.password)
        time.sleep(1.0)
        return {'ok': True, 'message': 'Password submitted', 'data': session.get_state()}
    except TdLibError as exc:
        raise HTTPException(status_code=400, detail={'code': exc.code, 'message': exc.message})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get('/state/{user_id}')
def auth_state(user_id: str):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')
    return {'ok': True, 'data': session.get_state()}


@router.post('/close/{user_id}')
def auth_close(user_id: str):
    session = session_manager.get(user_id)
    if not session:
        raise HTTPException(status_code=404, detail='Session not found')

    session_manager.remove(user_id)
    return {'ok': True, 'message': f'Session {user_id} closed'}
