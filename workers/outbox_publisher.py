
import logging
import time

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.infrastructure.database import SessionLocal
from app.modules.outbox.models import OutboxEvent

from workers.celery_app import celery_app


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)


BATCH_SIZE = 100
POLL_INTERVAL = 2

TASKS = {
    "telegram": (
        "workers.telegram_tasks.send_telegram_notification",
        "telegram_queue",
    ),
    "email": (
        "workers.email_tasks.send_email_notification",
        "email_queue",
    ),
}


def publish_event(event: OutboxEvent) -> None:
    """Публикует одно Outbox-событие в RabbitMQ."""

    if event.event_type != "notification.created":
        raise ValueError(
            f"Unsupported event type: {event.event_type}"
        )

    payload = event.payload

    notification_id = payload.get("notification_id")
    channel = payload.get("channel")

    if not notification_id:
        raise ValueError("notification_id is missing")

    if channel not in TASKS:
        raise ValueError(f"Unsupported channel: {channel}")

    task_name, queue_name = TASKS[channel]

    celery_app.send_task(
        task_name,
        args=[notification_id],
        queue=queue_name,
    )


def publish_batch() -> int:
    """
    Забирает пакет событий из Outbox
    и пытается опубликовать их в RabbitMQ.
    """

    now = datetime.now(timezone.utc)

    with SessionLocal() as db:
        statement = (
            select(OutboxEvent)
            .where(
                OutboxEvent.status == "pending",
                OutboxEvent.available_at <= now,
            )
            .order_by(OutboxEvent.created_at)
            .limit(BATCH_SIZE)
            .with_for_update(skip_locked=True)
        )

        events = db.scalars(statement).all()

        if not events:
            return 0

        published_count = 0

        for event in events:
            try:
                publish_event(event)

                event.status = "published"
                event.published_at = datetime.now(timezone.utc)
                event.error_message = None

                published_count += 1

                logger.info(
                    "Published outbox event id=%s",
                    event.id,
                )

            except Exception as exc:
                event.attempts += 1

                delay = min(2 ** event.attempts, 300)

                event.available_at = (
                    datetime.now(timezone.utc)
                    + timedelta(seconds=delay)
                )

                event.error_message = str(exc)[:2000]

                logger.exception(
                    "Failed to publish outbox event id=%s",
                    event.id,
                )

        db.commit()

        return published_count


def run_publisher() -> None:
    """Бесконечный цикл работы Publisher."""

    logger.info("Outbox Publisher started")

    while True:
        try:
            published_count = publish_batch()

            if published_count:
                logger.info(
                    "Published %s events",
                    published_count,
                )

            else:
                time.sleep(POLL_INTERVAL)

        except Exception:
            logger.exception("Outbox Publisher error")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run_publisher()
