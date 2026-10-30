from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.campaigns.models import Campaign
from app.modules.notifications.models import Notification
from app.modules.users.models import User


router = APIRouter(prefix="/stats", tags=["Stats"])


@router.get("/overview")
def get_overview(
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    total_users = db.scalar(
        select(func.count(User.id)).where(User.is_active.is_(True))
    )
    total_campaigns = db.scalar(select(func.count(Campaign.id)))

    status_rows = db.execute(
        select(Notification.status, func.count(Notification.id))
        .group_by(Notification.status)
    ).all()
    by_status = {name: count for name, count in status_rows}

    channel_rows = db.execute(
        select(
            Notification.channel,
            Notification.status,
            func.count(Notification.id),
        )
        .group_by(Notification.channel, Notification.status)
    ).all()
    by_channel: dict[str, dict[str, int]] = {}
    for channel, notification_status, count in channel_rows:
        by_channel.setdefault(channel, {})[notification_status] = count

    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date_trunc("day", Notification.sent_at)
    daily_rows = db.execute(
        select(day, Notification.channel, func.count(Notification.id))
        .where(
            Notification.status == "sent",
            Notification.sent_at >= since,
        )
        .group_by(day, Notification.channel)
        .order_by(day)
    ).all()
    daily = [
        {"date": d.date().isoformat(), "channel": channel, "sent": count}
        for d, channel, count in daily_rows
    ]

    error_rows = db.execute(
        select(Notification, User.name, Campaign.title)
        .join(User, User.id == Notification.user_id)
        .join(Campaign, Campaign.id == Notification.campaign_id)
        .where(Notification.status == "failed")
        .order_by(Notification.updated_at.desc())
        .limit(10)
    ).all()
    recent_errors = [
        {
            "notification_id": n.id,
            "campaign_id": n.campaign_id,
            "campaign_title": title,
            "user_name": user_name,
            "channel": n.channel,
            "attempts": n.attempts,
            "error_message": n.error_message,
            "updated_at": n.updated_at,
        }
        for n, user_name, title in error_rows
    ]

    return {
        "total_users": total_users or 0,
        "total_campaigns": total_campaigns or 0,
        "deliveries": {
            "total": sum(by_status.values()),
            "sent": by_status.get("sent", 0),
            "failed": by_status.get("failed", 0),
            "pending": by_status.get("pending", 0)
            + by_status.get("processing", 0),
        },
        "by_channel": by_channel,
        "daily_sent": daily,
        "recent_errors": recent_errors,
    }
