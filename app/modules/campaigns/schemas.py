from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Channel = Literal["telegram", "email"]
TargetType = Literal["all", "group", "individual"]


class CampaignCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)

    message: str | None = None

    template_id: int | None = None

    target_type: TargetType

    group_id: int | None = None

    user_ids: list[int] = Field(default_factory=list)

    channels: list[Channel] = Field(min_length=1)

    scheduled_at: datetime | None = None

    @model_validator(mode="after")
    def validate_campaign(self):
        if not self.message and not self.template_id:
            raise ValueError(
                "Either message or template_id must be provided"
            )

        if self.target_type == "group" and self.group_id is None:
            raise ValueError("group_id is required for group targeting")

        if self.target_type != "group" and self.group_id is not None:
            raise ValueError("group_id is only allowed for group targeting")

        if self.target_type == "individual" and not self.user_ids:
            raise ValueError("user_ids are required for individual targeting")

        if self.target_type != "individual" and self.user_ids:
            raise ValueError("user_ids are only allowed for individual targeting")

        if len(self.channels) != len(set(self.channels)):
            raise ValueError("Duplicate channels are not allowed")

        return self


class CampaignUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    message: str | None = None
    template_id: int | None = None
    scheduled_at: datetime | None = None


class CampaignResponse(BaseModel):
    id: int
    title: str
    message: str
    template_id: int | None
    target_type: str
    group_id: int | None
    channels: list[str]
    status: str
    scheduled_at: datetime | None
    started_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CampaignPreview(BaseModel):
    campaign_id: int
    total_recipients: int
    telegram_recipients: int
    email_recipients: int
    unavailable_recipients: int
    sample_message: str | None