
from datetime import datetime, timezone

from sqlalchemy import select

from app.infrastructure.database import SessionLocal
from app.modules.notifications.models import Notification

from workers.celery_app import celery_app
from workers.notification_processor import process_notification


@celery_app.task(
    bind=True,
    name="workers.telegram_tasks.send_telegram_notification",
    max_retries=4,
    acks_late=True,
    reject_on_worker_lost=True,
)
def send_telegram_notification(self, notification_id: int):
    try:
        process_notification(
            notification_id,
            expected_channel="telegram",
        )

    except Exception as exc:
        with SessionLocal() as db:
            notification = db.scalar(
                select(Notification).where(
                    Notification.id == notification_id
                )
            )

            if (
                notification is not None
                and notification.status == "pending"
                and notification.next_retry_at is not None
            ):
                delay = (
                    notification.next_retry_at
                    - datetime.now(timezone.utc)
                ).total_seconds()

                raise self.retry(
                    exc=exc,
                    countdown=max(1, delay),
                )

        raise
