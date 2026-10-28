
import logging

from sqlalchemy import select

from app.infrastructure.database import SessionLocal
from app.modules.notifications.models import Notification
from app.modules.users.models import User
from app.modules.campaigns.models import Campaign

from app.providers.telegram import send_telegram_message
from app.providers.email import send_email_message

from workers.idempotency import (
    claim_notification,
    mark_notification_sent,
    mark_notification_failed,
)


logger = logging.getLogger(__name__)


def personalize_message(message: str, user: User) -> str:
    return (
        message
        .replace("{name}", user.name or "")
        .replace("{email}", user.email or "")
    )


def process_notification(
    notification_id: int,
    expected_channel: str,
) -> None:
    # 1. Атомарно захватываем доставку
    if not claim_notification(notification_id):
        logger.info(
            "Notification %s was already claimed or completed",
            notification_id,
        )
        return

    try:
        # 2. Получаем данные из PostgreSQL
        with SessionLocal() as db:
            result = db.execute(
                select(Notification, User, Campaign)
                .join(
                    User,
                    User.id == Notification.user_id,
                )
                .join(
                    Campaign,
                    Campaign.id == Notification.campaign_id,
                )
                .where(Notification.id == notification_id)
            ).first()

            if result is None:
                raise ValueError(
                    f"Notification {notification_id} not found"
                )

            notification, user, campaign = result

            if notification.channel != expected_channel:
                raise ValueError(
                    "Notification channel does not match task channel"
                )

            if not user.is_active:
                raise ValueError("User is inactive")

            message = personalize_message(
                campaign.message,
                user,
            )

            # Копируем необходимые данные до закрытия сессии
            channel = notification.channel
            telegram_id = user.telegram_id
            email = user.email
            email_available = user.email_available
            telegram_available = user.telegram_available
            campaign_title = campaign.title

        # 3. Отправляем через нужный канал
        if channel == "telegram":
            if not telegram_available or telegram_id is None:
                raise ValueError("Telegram channel is unavailable")

            send_telegram_message(
                telegram_id=telegram_id,
                message=message,
            )

        elif channel == "email":
            if not email_available or not email:
                raise ValueError("Email channel is unavailable")

            send_email_message(
                recipient=email,
                subject=campaign_title,
                message=message,
            )

        else:
            raise ValueError(f"Unsupported channel: {channel}")

        # 4. Сохраняем успешную отправку
        mark_notification_sent(notification_id)

        logger.info(
            "Notification %s sent via %s",
            notification_id,
            channel,
        )

    except Exception as exc:
        # 5. Сохраняем ошибку и планируем повтор
        mark_notification_failed(
            notification_id,
            str(exc),
        )

        logger.exception(
            "Notification %s delivery failed",
            notification_id,
        )

        raise
