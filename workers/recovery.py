
import logging

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.infrastructure.database import SessionLocal
from app.modules.notifications.models import Notification
from app.modules.outbox.models import OutboxEvent

logger = logging.getLogger(__name__)

# Наши HTTP-провайдеры имеют таймауты 15–20 секунд.
# Если обработка висит более 5 минут, считаем её зависшей.
PROCESSING_TIMEOUT_MINUTES = 5



def recover_stuck_notifications() -> int:
    now = datetime.now(timezone.utc)
    timeout = now - timedelta(
        minutes=PROCESSING_TIMEOUT_MINUTES
    )

    with SessionLocal() as db:
        statement = (
            update(Notification)
            .where(
                Notification.status == "processing",
                Notification.processing_started_at < timeout,
            )
            .values(
                status="pending",
                processing_started_at=None,
                next_retry_at=now,
                error_message="Worker processing timeout; recovered",
            )
            .returning(
                Notification.id,
                Notification.channel,
            )
        )

        recovered_notifications = db.execute(statement).all()

        for notification_id, channel in recovered_notifications:
            event = OutboxEvent(
                event_type="notification.created",
                payload={
                    "notification_id": notification_id,
                    "channel": channel,
                },
            )
            db.add(event)

        db.commit()

        if recovered_notifications:
            logger.warning(
                "Recovered %s stuck notifications",
                len(recovered_notifications),
            )

        return len(recovered_notifications)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    count = recover_stuck_notifications()
    print(f"Recovered notifications: {count}")
