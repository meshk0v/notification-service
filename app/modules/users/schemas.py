from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    name: str
    email: str | None = None
    telegram_id: int | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    telegram_id: int | None = None
    email_available: bool | None = None
    telegram_available: bool | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str | None
    telegram_id: int | None
    email_available: bool
    telegram_available: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)