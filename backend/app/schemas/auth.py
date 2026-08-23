"""Auth Schemas"""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)

    model_config = {"str_strip_whitespace": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    user_id: str
    username: str
    full_name: str
    roles: list[str]
    permissions: list[str]


class LoginHistoryResponse(BaseModel):
    last_login: str | None
    last_login_ip: str | None
