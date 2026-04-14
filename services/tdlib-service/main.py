from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI()


class SendMessageRequest(BaseModel):
    member_id: int
    content: str


class SyncMembersRequest(BaseModel):
    group_id: int


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "tdlib-service",
        "mode": "mock",
    }


@app.post("/messages/send")
def send_message(payload: SendMessageRequest):
    return {
        "status": "accepted",
        "service": "tdlib-service",
        "action": "send_message",
        "member_id": payload.member_id,
        "content": payload.content,
        "result": "mocked",
    }


@app.post("/sync/members")
def sync_members(payload: SyncMembersRequest):
    return {
        "status": "accepted",
        "service": "tdlib-service",
        "action": "sync_members",
        "group_id": payload.group_id,
        "members_synced": 0,
        "result": "mocked",
    }