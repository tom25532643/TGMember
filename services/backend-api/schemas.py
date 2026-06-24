from datetime import datetime

from pydantic import BaseModel


class Member(BaseModel):
    id: int
    name: str
    username: str

    class Config:
        from_attributes = True


class MemberCreate(BaseModel):
    name: str
    username: str


class MemberLoginKeyUpdate(BaseModel):
    login_key: str


class Group(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class GroupCreate(BaseModel):
    name: str


class TagCreate(BaseModel):
    tag: str


class NoteCreate(BaseModel):
    note: str

class MessageLog(BaseModel):
    id: int
    member_id: int
    direction: str
    content: str
    status: str

    class Config:
        from_attributes = True


class MessageLogCreate(BaseModel):
    direction: str
    content: str
    status: str

class SendMessageRequest(BaseModel):
    content: str


class SendMessageResponse(BaseModel):
    status: str
    service: str
    action: str
    member_id: int
    content: str
    result: str

class TelegramMemberSyncItem(BaseModel):
    telegram_user_id: int
    display_name: str | None = None
    username: str | None = None


class TelegramMemberExpirationSyncRequest(BaseModel):
    owner_user_id: str
    chat_id: int
    members: list[TelegramMemberSyncItem]


class TelegramMemberExpirationUpdateRequest(BaseModel):
    expiration_date: str | None = None


class TelegramMemberExpiration(BaseModel):
    id: int
    owner_user_id: str
    chat_id: int
    telegram_user_id: int
    display_name: str | None = None
    username: str | None = None
    first_seen_at: datetime
    expiration_date: str | None = None

    class Config:
        from_attributes = True


