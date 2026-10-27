from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.campaigns.models import Campaign
from app.modules.campaigns.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignPreview,
)
from app.modules.groups.models import Group
from app.modules.tags.models import Tag
from app.modules.templates.models import MessageTemplate
from app.modules.users.models import User


router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


def get_campaign_audience(campaign: Campaign, db: Session):
    """
    Возвращает пользователей, подходящих под аудиторию кампании.
    """

    statement = select(User).where(User.is_active.is_(True))

    if campaign.target_type == "group":
        statement = (
            statement
            .join(User.tags)
            .join(Tag.groups)
            .where(Group.id == campaign.group_id)
            .distinct()
        )

    elif campaign.target_type == "individual":
        statement = statement.where(
            User.id.in_(
                select(
                    CampaignUser.user_id
                ).where(
                    CampaignUser.campaign_id == campaign.id
                )
            )
        )

    statement = statement.order_by(User.id)

    return db.scalars(statement).all()


@router.post(
    "/",
    response_model=CampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
):
    message = data.message

    if data.template_id is not None:
        template = db.get(MessageTemplate, data.template_id)

        if template is None:
            raise HTTPException(
                status_code=404,
                detail="Template not found",
            )

        if message is None:
            message = template.content

    if data.target_type == "group":
        group = db.get(Group, data.group_id)

        if group is None:
            raise HTTPException(
                status_code=404,
                detail="Group not found",
            )

    selected_users = []

    if data.target_type == "individual":
        selected_users = db.scalars(
            select(User).where(
                User.id.in_(data.user_ids),
                User.is_active.is_(True),
            )
        ).all()

        if len(selected_users) != len(set(data.user_ids)):
            raise HTTPException(
                status_code=404,
                detail="One or more active users not found",
            )

    campaign = Campaign(
        title=data.title,
        message=message,
        template_id=data.template_id,
        target_type=data.target_type,
        group_id=data.group_id,
        channels=list(data.channels),
        scheduled_at=data.scheduled_at,
        status="scheduled" if data.scheduled_at else "draft",
        target_users=selected_users,
    )

    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return campaign


@router.get("/", response_model=list[CampaignResponse])
def get_campaigns(db: Session = Depends(get_db)):
    statement = select(Campaign).order_by(Campaign.id.desc())

    return db.scalars(statement).all()


@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    return campaign


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    if campaign.status not in {"draft", "scheduled"}:
        raise HTTPException(
            status_code=409,
            detail="Only draft or scheduled campaigns can be edited",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "template_id" in update_data and update_data["template_id"] is not None:
        template = db.get(MessageTemplate, update_data["template_id"])

        if template is None:
            raise HTTPException(
                status_code=404,
                detail="Template not found",
            )

        if "message" not in update_data:
            campaign.message = template.content

    for field, value in update_data.items():
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)

    return campaign


@router.get(
    "/{campaign_id}/preview",
    response_model=CampaignPreview,
)
def preview_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)

    if campaign is None:
        raise HTTPException(
            status_code=404,
            detail="Campaign not found",
        )

    users = get_campaign_audience(campaign, db)

    telegram_recipients = 0
    email_recipients = 0
    unavailable_recipients = 0

    for user in users:
        telegram_available = (
            user.telegram_available and user.telegram_id is not None
        )

        email_available = (
            user.email_available and user.email is not None
        )

        if "telegram" in campaign.channels and telegram_available:
            telegram_recipients += 1

        if "email" in campaign.channels and email_available:
            email_recipients += 1

        if (
            ("telegram" in campaign.channels and not telegram_available)
            and ("email" in campaign.channels and not email_available)
        ):
            unavailable_recipients += 1

        elif (
            len(campaign.channels) == 1
            and (
                ("telegram" in campaign.channels and not telegram_available)
                or ("email" in campaign.channels and not email_available)
            )
        ):
            unavailable_recipients += 1

    sample_message = None

    if users:
        sample_message = campaign.message.replace(
            "{name}",
            users[0].name,
        )

        if users[0].email:
            sample_message = sample_message.replace(
                "{email}",
                users[0].email,
            )

    return CampaignPreview(
        campaign_id=campaign.id,
        total_recipients=len(users),
        telegram_recipients=telegram_recipients,
        email_recipients=email_recipients,
        unavailable_recipients=unavailable_recipients,
        sample_message=sample_message,
    )