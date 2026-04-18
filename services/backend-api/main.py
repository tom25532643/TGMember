from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from schemas import (
    Member,
    MemberCreate,
    Group,
    GroupCreate,
    TagCreate,
    NoteCreate,
    MessageLog,
    MessageLogCreate,
    SendMessageRequest,
    SendMessageResponse,
)
import crud
import models
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/members", response_model=list[Member])
def get_members(db: Session = Depends(get_db)):
    return crud.list_members(db)


@app.get("/members/{member_id}", response_model=Member)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.post("/members", response_model=Member)
def create_member(payload: MemberCreate, db: Session = Depends(get_db)):
    return crud.create_member(db, name=payload.name, username=payload.username)


@app.get("/groups", response_model=list[Group])
def get_groups(db: Session = Depends(get_db)):
    return crud.list_groups(db)


@app.post("/groups", response_model=Group)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)):
    return crud.create_group(db, name=payload.name)


@app.get("/groups/{group_id}/members", response_model=list[Member])
def get_group_members(group_id: int, db: Session = Depends(get_db)):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return crud.list_group_members(db, group_id)


@app.post("/groups/{group_id}/members/{member_id}", response_model=list[Member])
def add_member_to_group(group_id: int, member_id: int, db: Session = Depends(get_db)):
    group = crud.get_group_by_id(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return crud.add_member_to_group(db, group_id, member_id)


@app.get("/members/{member_id}/tags", response_model=list[str])
def get_member_tags(member_id: int, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return crud.list_member_tags(db, member_id)


@app.post("/members/{member_id}/tags", response_model=list[str])
def add_member_tag(member_id: int, payload: TagCreate, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return crud.add_tag_to_member(db, member_id, payload.tag)


@app.get("/members/{member_id}/notes", response_model=list[str])
def get_member_notes(member_id: int, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return crud.list_member_notes(db, member_id)


@app.post("/members/{member_id}/notes", response_model=list[str])
def add_member_note(member_id: int, payload: NoteCreate, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return crud.add_note_to_member(db, member_id, payload.note)

@app.get("/members/{member_id}/message-logs", response_model=list[MessageLog])
def get_member_message_logs(member_id: int, db: Session = Depends(get_db)):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return crud.list_member_message_logs(db, member_id)


@app.post("/members/{member_id}/message-logs", response_model=MessageLog)
def create_member_message_log(
    member_id: int,
    payload: MessageLogCreate,
    db: Session = Depends(get_db),
):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return crud.create_message_log(
        db,
        member_id=member_id,
        direction=payload.direction,
        content=payload.content,
        status=payload.status,
    )

@app.post("/members/{member_id}/send-message", response_model=SendMessageResponse)
def send_message_to_member(
    member_id: int,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
):
    member = crud.get_member_by_id(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    try:
        response = requests.post(
            "http://127.0.0.1:8010/messages/send",
            json={
                "member_id": member_id,
                "content": payload.content,
            },
            timeout=5,
        )
        response.raise_for_status()

        result = response.json()

        crud.create_message_log(
            db=db,
            member_id=member_id,
            direction="outbound",
            content=payload.content,
            status="sent",
        )

        return result

    except requests.RequestException as error:
        crud.create_message_log(
            db=db,
            member_id=member_id,
            direction="outbound",
            content=payload.content,
            status="failed",
        )

        raise HTTPException(
            status_code=502,
            detail=f"Failed to call tdlib-service: {error}",
        )