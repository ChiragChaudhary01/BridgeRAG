from pydantic import BaseModel

class ChatRequest(BaseModel):
    title: str
    message: str
