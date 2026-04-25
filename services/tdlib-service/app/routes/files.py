from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.state import session_manager

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{user_id}/{file_id}")
def get_file(user_id: str, file_id: int):
    session = session_manager.get_or_create(user_id)

    try:
        file_obj = session.download_file(file_id)
        print("downloadFile result:", file_obj)
    except Exception as e:
        print("downloadFile error:", e)
        raise HTTPException(status_code=500, detail=str(e))

    local = file_obj.get("local") or {}
    path = local.get("path")

    if not path:
        raise HTTPException(status_code=404, detail="file path empty")

    if not Path(path).exists():
        raise HTTPException(status_code=404, detail=f"file not found: {path}")

    return FileResponse(path)