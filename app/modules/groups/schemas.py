from pydantic import BaseModel, ConfigDict


class TagResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class GroupCreate(BaseModel):
    name: str
    description: str | None = None
    tag_ids: list[int]


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    tags: list[TagResponse]

    model_config = ConfigDict(from_attributes=True)


class UserInGroup(BaseModel):
    id: int
    name: str
    email: str | None
    telegram_id: int | None

    model_config = ConfigDict(from_attributes=True)