
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select, update

from app.infrastructure.database import SessionLocal
from app.modules.notifications.models import Notification

def claim_notification(notification_id: int) -> bool:
    """
    Атомарно захватывает уведомление для обработки.

    True  — текущий Worker получил право на обработку.
    False — уведомление уже обрабатывается или завершено.
    """

    with SessionLocal() as db:
        statement = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.status == "pending",
                or_(
                    Notification.next_retry_at.is_(None),
                    Notification.next_retry_at <= func.now(),
                ),
            )
            .values(
                status="processing",
                attempts=Notification.attempts + 1,
                processing_started_at=func.now(),
                updated_at=func.now(),
            )
            .returning(Notification.id)
        )

        claimed_id = db.scalar(statement)
        db.commit()

        return claimed_id is not None


def mark_notification_sent(notification_id: int) -> None:
    """Отмечает доставку как успешно отправленную."""

    with SessionLocal() as db:
        statement = (
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.status == "processing",
            )
            .values(
                status="sent",
                sent_at=datetime.now(timezone.utc),
                error_message=None,
                next_retry_at=None,
                updated_at=func.now(),
                processing_started_at=None,
            )
        )

        db.execute(statement)
        db.commit()


def mark_notification_failed(
    notification_id: int,
    error: str,
) -> None:
    """
    Регистрирует ошибку.
    Если попытки остались — возвращает уведомление в pending.
    Иначе переводит в failed.
    """

    with SessionLocal() as db:
        notification = db.scalar(
            select(Notification)
            .where(
                Notification.id == notification_id,
                Notification.status == "processing",
            )
            .with_for_update()
        )

        if notification is None:
            return

        notification.error_message = error[:2000]
        notification.processing_started_at = None

        if notification.attempts >= notification.max_attempts:
            notification.status = "failed"
            notification.next_retry_at = None
        else:
            delay = min(2 ** notification.attempts, 300)

            notification.status = "pending"
            notification.next_retry_at = (
                datetime.now(timezone.utc)
                + timedelta(seconds=delay)
            )

        db.commit()
