from pydantic import BaseModel


class StartAuthRequest(BaseModel):
    user_id: str


class SubmitPhoneRequest(BaseModel):
    user_id: str
    phone_number: str


class SubmitCodeRequest(BaseModel):
    user_id: str
    code: str


class SubmitPasswordRequest(BaseModel):
    user_id: str
    password: str


class SendMessageRequest(BaseModel):
    user_id: str
    chat_id: int
    text: str
