from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.modules.outbox.models import OutboxEvent
from workers.outbox_publisher import publish_batch


def add_event(db, payload=None, event_type="notification.created", **kwargs):
    event = OutboxEvent(
        event_type=event_type,
        payload=payload if payload is not None else {"notification_id": 1, "channel": "telegram"},
        **kwargs,
    )
    db.add(event)
    db.commit()
    return event


def test_publishes_pending_events_to_correct_queues(db):
    add_event(db, {"notification_id": 10, "channel": "telegram"})
    add_event(db, {"notification_id": 11, "channel": "email"})

    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        published = publish_batch()

    assert published == 2
    send_task.assert_any_call(
        "workers.telegram_tasks.send_telegram_notification", args=[10], queue="telegram_queue"
    )
    send_task.assert_any_call(
        "workers.email_tasks.send_email_notification", args=[11], queue="email_queue"
    )
    db.expire_all()
    events = db.query(OutboxEvent).all()
    assert all(e.status == "published" and e.published_at is not None for e in events)


def test_nothing_to_publish(db):
    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        assert publish_batch() == 0

    send_task.assert_not_called()


def test_published_events_are_not_published_again(db):
    add_event(db, status="published")

    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        assert publish_batch() == 0

    send_task.assert_not_called()


def test_future_events_wait_for_available_at(db):
    add_event(db, available_at=datetime.now(timezone.utc) + timedelta(hours=1))

    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        assert publish_batch() == 0

    send_task.assert_not_called()


def test_broker_failure_keeps_event_pending_with_backoff(db):
    event = add_event(db)
    before = datetime.now(timezone.utc)

    with patch("workers.outbox_publisher.celery_app.send_task", side_effect=ConnectionError("rabbit down")):
        published = publish_batch()

    assert published == 0
    db.expire_all()
    event = db.get(OutboxEvent, event.id)
    assert event.status == "pending"
    assert event.attempts == 1
    assert "rabbit down" in event.error_message
    assert event.available_at >= before + timedelta(seconds=1)  # 2**1 с


def test_unsupported_event_is_not_published(db):
    event = add_event(db, event_type="something.else")

    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        publish_batch()

    send_task.assert_not_called()
    db.expire_all()
    event = db.get(OutboxEvent, event.id)
    assert event.status == "pending" and event.attempts == 1


def test_bad_event_does_not_block_good_ones(db):
    add_event(db, {"notification_id": 1, "channel": "sms"})
    add_event(db, {"notification_id": 2, "channel": "email"})

    with patch("workers.outbox_publisher.celery_app.send_task") as send_task:
        published = publish_batch()

    assert published == 1
    send_task.assert_called_once()
