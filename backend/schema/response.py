from typing import Any, Optional
from pydantic import BaseModel

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None
    error: Optional[str] = None

def success_response(message: str, data: Any = None) -> APIResponse:
    return APIResponse(
        success=True,
        message=message,
        data=data,
        error=None
    )

def error_response(message: str, error_details: Optional[str] = None) -> APIResponse:
    return APIResponse(
        success=False,
        message=message,
        data=None,
        error=error_details
    )