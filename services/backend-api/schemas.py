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