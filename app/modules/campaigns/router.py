from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.campaigns import constants as campaign_status
from app.modules.campaigns.models import Campaign
from app.modules.campaigns.schemas import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignPreview,
    CampaignStats,
    DeliveriesPage,
    LaunchResult,
)
from app.modules.campaigns.service import (
    build_campaign_preview,
    launch_campaign_deliveries,
)
from app.modules.groups.models import Group
from app.modules.notifications import constants as delivery_status
from app.modules.notifications.models import Notification
from app.modules.templates.models import MessageTemplate
from app.modules.users.models import User


router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


def get_campaign_or_404(db: Session, campaign_id: int) -> Campaign:
    campaign = db.get(Campaign, campaign_id)

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    return campaign


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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if message is None:
            message = template.content

    if data.target_type == "group":
        group = db.get(Group, data.group_id)

        if group is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
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
                status_code=status.HTTP_404_NOT_FOUND,
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
        status=(
            campaign_status.SCHEDULED
            if data.scheduled_at
            else campaign_status.DRAFT
        ),
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
    return get_campaign_or_404(db, campaign_id)


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate,
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)

    if campaign.status not in campaign_status.EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft or scheduled campaigns can be edited",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "template_id" in update_data and update_data["template_id"] is not None:
        template = db.get(MessageTemplate, update_data["template_id"])

        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found",
            )

        if "message" not in update_data:
            campaign.message = template.content

    for field, value in update_data.items():
        setattr(campaign, field, value)

    db.commit()
    db.refresh(campaign)

    return campaign


@router.get("/{campaign_id}/preview", response_model=CampaignPreview)
def preview_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)

    return build_campaign_preview(campaign, db)


@router.post("/{campaign_id}/launch", response_model=LaunchResult)
def launch_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    campaign = db.scalar(
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .with_for_update()
    )

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    if campaign.status not in campaign_status.EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Campaign cannot be launched from status: {campaign.status}",
        )

    try:
        result = launch_campaign_deliveries(campaign, db)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return result


@router.get("/{campaign_id}/stats", response_model=CampaignStats)
def get_campaign_stats(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    campaign = get_campaign_or_404(db, campaign_id)

    status_rows = db.execute(
        select(Notification.status, func.count(Notification.id))
        .where(Notification.campaign_id == campaign_id)
        .group_by(Notification.status)
    ).all()
    counts = dict(status_rows)

    channel_rows = db.execute(
        select(Notification.channel, func.count(Notification.id))
        .where(Notification.campaign_id == campaign_id)
        .group_by(Notification.channel)
    ).all()

    return {
        "campaign_id": campaign_id,
        "campaign_status": campaign.status,
        "total": sum(counts.values()),
        "queued": counts.get(delivery_status.PENDING, 0),
        "in_progress": counts.get(delivery_status.PROCESSING, 0),
        "sent": counts.get(delivery_status.SENT, 0),
        "failed": counts.get(delivery_status.FAILED, 0),
        "canceled": counts.get(delivery_status.CANCELED, 0),
        "channels": dict(channel_rows),
    }


@router.get("/{campaign_id}/deliveries", response_model=DeliveriesPage)
def get_campaign_deliveries(
    campaign_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    delivery_status_filter: str | None = Query(default=None, alias="status"),
    channel: str | None = Query(default=None),
):
    get_campaign_or_404(db, campaign_id)

    filters = [Notification.campaign_id == campaign_id]

    if delivery_status_filter:
        filters.append(Notification.status == delivery_status_filter)

    if channel:
        filters.append(Notification.channel == channel)

    total = db.scalar(
        select(func.count(Notification.id)).where(*filters)
    )

    rows = db.execute(
        select(Notification, User.name, User.email)
        .join(User, User.id == Notification.user_id)
        .where(*filters)
        .order_by(Notification.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return {
        "campaign_id": campaign_id,
        "total": total or 0,
        "limit": limit,
        "offset": offset,
        "deliveries": [
            {
                "notification_id": notification.id,
                "user_id": notification.user_id,
                "user_name": user_name,
                "user_email": user_email,
                "channel": notification.channel,
                "status": notification.status,
                "attempts": notification.attempts,
                "error_message": notification.error_message,
                "sent_at": notification.sent_at,
                "created_at": notification.created_at,
            }
            for notification, user_name, user_email in rows
        ],
    }
