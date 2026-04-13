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