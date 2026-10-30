from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.modules.campaigns import constants as campaign_status
from app.modules.campaigns.models import Campaign, campaign_users
from app.modules.campaigns.schemas import CampaignPreview
from app.modules.groups.models import Group
from app.modules.notifications import constants as delivery_status
from app.modules.notifications.models import Notification
from app.modules.outbox.models import OutboxEvent
from app.modules.tags.models import Tag
from app.modules.users.models import User


def get_campaign_audience(campaign: Campaign, db: Session) -> list[User]:
    """
    Возвращает активных пользователей, подходящих под аудиторию кампании.
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
                    campaign_users.c.user_id
                ).where(
                    campaign_users.c.campaign_id == campaign.id
                )
            )
        )

    return db.scalars(statement.order_by(User.id)).all()


def is_channel_available(user: User, channel: str) -> bool:
    """Можно ли отправить пользователю сообщение по этому каналу."""

    if channel == "telegram":
        return user.telegram_available and user.telegram_id is not None

    if channel == "email":
        return user.email_available and user.email is not None

    return False


def build_campaign_preview(campaign: Campaign, db: Session) -> CampaignPreview:
    users = get_campaign_audience(campaign, db)

    telegram_recipients = 0
    email_recipients = 0
    unavailable_recipients = 0

    for user in users:
        available = [
            channel
            for channel in campaign.channels
            if is_channel_available(user, channel)
        ]

        telegram_recipients += "telegram" in available
        email_recipients += "email" in available

        # недоступен, если ни по одному из выбранных каналов отправить нельзя
        if not available:
            unavailable_recipients += 1

    sample_message = None

    if users:
        sample_message = campaign.message.replace("{name}", users[0].name)

        if users[0].email:
            sample_message = sample_message.replace("{email}", users[0].email)

    return CampaignPreview(
        campaign_id=campaign.id,
        total_recipients=len(users),
        telegram_recipients=telegram_recipients,
        email_recipients=email_recipients,
        unavailable_recipients=unavailable_recipients,
        sample_message=sample_message,
    )


def launch_campaign_deliveries(campaign: Campaign, db: Session) -> dict:
    """
    Создаёт доставки и outbox-события, переводит кампанию в processing.

    Коммит выполняет вызывающий код.
    """

    users = get_campaign_audience(campaign, db)

    notification_rows = [
        {
            "campaign_id": campaign.id,
            "user_id": user.id,
            "channel": channel,
            "status": delivery_status.PENDING,
            "attempts": 0,
            "max_attempts": delivery_status.DEFAULT_MAX_ATTEMPTS,
        }
        for user in users
        for channel in campaign.channels
        if is_channel_available(user, channel)
    ]

    created_notifications = []

    if notification_rows:
        created_notifications = (
            db.execute(
                pg_insert(Notification)
                .values(notification_rows)
                .on_conflict_do_nothing(
                    constraint="uq_notification_campaign_user_channel"
                )
                .returning(Notification.id, Notification.channel)
            )
            .mappings()
            .all()
        )

    outbox_rows = [
        {
            "event_type": "notification.created",
            "payload": {
                "notification_id": notification["id"],
                "channel": notification["channel"],
            },
            "status": "pending",
        }
        for notification in created_notifications
    ]

    if outbox_rows:
        db.execute(pg_insert(OutboxEvent).values(outbox_rows))

    campaign.status = campaign_status.PROCESSING

    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "recipients_found": len(users),
        "deliveries_created": len(created_notifications),
        "outbox_events_created": len(outbox_rows),
    }


def refresh_campaign_status(db, campaign_id: int) -> None:
    """
    Пересчитывает статус кампании по состоянию её доставок.

    Вызывается внутри транзакции, которая изменяет доставку.
    """

    campaign = db.scalar(
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .with_for_update()
    )

    if campaign is None:
        return

    statuses = db.scalars(
        select(Notification.status).where(
            Notification.campaign_id == campaign_id
        )
    ).all()

    if not statuses:
        campaign.status = campaign_status.NO_RECIPIENTS
        return

    if any(s not in delivery_status.TERMINAL_STATUSES for s in statuses):
        campaign.status = campaign_status.PROCESSING
        return

    sent_count = statuses.count(delivery_status.SENT)
    failed_count = statuses.count(delivery_status.FAILED)

    if sent_count == len(statuses):
        campaign.status = campaign_status.COMPLETED

    elif failed_count == len(statuses):
        campaign.status = campaign_status.FAILED

    else:
        campaign.status = campaign_status.PARTIALLY_COMPLETED
