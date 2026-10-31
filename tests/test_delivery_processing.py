from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from celery.exceptions import Retry
from sqlalchemy import update

from app.modules.campaigns.models import Campaign
from app.modules.notifications.models import Notification
from app.modules.outbox.models import OutboxEvent
from app.providers.telegram import TelegramDeliveryError
from workers import email_tasks, telegram_tasks
from workers.idempotency import claim_notification
from workers.notification_processor import process_notification
from workers.recovery import recover_stuck_notifications
from app.modules.campaigns.service import refresh_campaign_status


@pytest.fixture
def setup(db, make_user):
    """Кампания с одной доставкой; возвращает (user, campaign, notification)."""

    def factory(channel="telegram", message="Hi {name} <{email}>", status="processing", **user_kwargs):
        user = make_user(**user_kwargs)
        campaign = Campaign(title="Spring sale", message=message, target_type="all",
                            channels=[channel], status="processing")
        db.add(campaign)
        db.commit()
        notification = Notification(campaign_id=campaign.id, user_id=user.id, channel=channel)
        db.add(notification)
        db.commit()
        return user, campaign, notification

    return factory


def reload(db, model, pk):
    db.expire_all()
    return db.get(model, pk)


def make_retry_due(db, notification_id):
    db.execute(update(Notification).where(Notification.id == notification_id)
               .values(next_retry_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    db.commit()


# ---------- успешная отправка ----------

def test_telegram_success(setup, providers, db):
    telegram, email = providers
    user, campaign, n = setup("telegram")

    process_notification(n.id, "telegram")

    telegram.assert_called_once_with(telegram_id=user.telegram_id, message=f"Hi {user.name} <{user.email}>")
    email.assert_not_called()
    n = reload(db, Notification, n.id)
    assert (n.status, n.attempts, n.error_message) == ("sent", 1, None)
    assert n.sent_at is not None
    assert reload(db, Campaign, campaign.id).status == "completed"


def test_email_success(setup, providers, db):
    telegram, email = providers
    user, campaign, n = setup("email")

    process_notification(n.id, "email")

    email.assert_called_once_with(recipient=user.email, subject="Spring sale",
                                  message=f"Hi {user.name} <{user.email}>")
    telegram.assert_not_called()
    assert reload(db, Notification, n.id).status == "sent"


def test_sent_notification_is_not_sent_twice(setup, providers, db):
    telegram, _ = providers
    _, _, n = setup("telegram")
    process_notification(n.id, "telegram")

    process_notification(n.id, "telegram")  # повторная доставка той же задачи

    telegram.assert_called_once()
    assert reload(db, Notification, n.id).attempts == 1


# ---------- ошибка отправки и повторные попытки ----------

def test_failure_schedules_retry(setup, providers, db):
    telegram, _ = providers
    telegram.side_effect = TelegramDeliveryError("chat not found")
    _, campaign, n = setup("telegram")
    before = datetime.now(timezone.utc)

    with pytest.raises(TelegramDeliveryError):
        process_notification(n.id, "telegram")

    n = reload(db, Notification, n.id)
    assert n.status == "pending"
    assert n.attempts == 1
    assert n.error_message == "chat not found"
    assert n.next_retry_at >= before + timedelta(seconds=1)  # backoff 2**1 с
    assert reload(db, Campaign, campaign.id).status == "processing"


def test_retry_is_not_claimed_before_due_time(setup, providers, db):
    telegram, _ = providers
    telegram.side_effect = TelegramDeliveryError("temporary")
    _, _, n = setup("telegram")
    with pytest.raises(TelegramDeliveryError):
        process_notification(n.id, "telegram")
    telegram.reset_mock()

    process_notification(n.id, "telegram")  # слишком рано

    telegram.assert_not_called()
    assert reload(db, Notification, n.id).attempts == 1


def test_success_after_retry(setup, providers, db):
    telegram, _ = providers
    telegram.side_effect = [TelegramDeliveryError("temporary"), None]
    _, campaign, n = setup("telegram")
    with pytest.raises(TelegramDeliveryError):
        process_notification(n.id, "telegram")
    make_retry_due(db, n.id)

    process_notification(n.id, "telegram")

    n = reload(db, Notification, n.id)
    assert (n.status, n.attempts, n.error_message) == ("sent", 2, None)
    assert reload(db, Campaign, campaign.id).status == "completed"


def test_gives_up_after_max_attempts(setup, providers, db):
    telegram, _ = providers
    telegram.side_effect = TelegramDeliveryError("always fails")
    _, campaign, n = setup("telegram")

    for attempt in range(1, 6):
        with pytest.raises(TelegramDeliveryError):
            process_notification(n.id, "telegram")
        n_now = reload(db, Notification, n.id)
        assert n_now.attempts == attempt
        if attempt < 5:
            assert n_now.status == "pending"
            make_retry_due(db, n.id)

    n = reload(db, Notification, n.id)
    assert n.status == "failed"
    assert n.next_retry_at is None
    assert telegram.call_count == 5
    assert reload(db, Campaign, campaign.id).status == "failed"

    process_notification(n.id, "telegram")  # финальный статус больше не обрабатывается
    assert telegram.call_count == 5


@pytest.mark.parametrize("user_kwargs", [
    {"telegram_available": False},
    {"telegram_id": None},
    {"is_active": False},
])
def test_unavailable_recipient_is_not_sent(setup, providers, db, user_kwargs):
    telegram, _ = providers
    _, _, n = setup("telegram", **user_kwargs)

    with pytest.raises(ValueError):
        process_notification(n.id, "telegram")

    telegram.assert_not_called()
    assert reload(db, Notification, n.id).error_message


def test_channel_mismatch_is_rejected(setup, providers, db):
    telegram, email = providers
    _, _, n = setup("telegram")

    with pytest.raises(ValueError, match="channel"):
        process_notification(n.id, "email")

    telegram.assert_not_called()
    email.assert_not_called()


# ---------- статус кампании ----------

def test_campaign_partially_completed(setup, providers, db, make_user):
    telegram, _ = providers
    _, campaign, first = setup("telegram")
    second = Notification(campaign_id=campaign.id, user_id=make_user().id, channel="telegram", max_attempts=1)
    db.add(second)
    db.commit()
    telegram.side_effect = [None, TelegramDeliveryError("nope")]

    process_notification(first.id, "telegram")
    with pytest.raises(TelegramDeliveryError):
        process_notification(second.id, "telegram")

    assert reload(db, Notification, second.id).status == "failed"
    assert reload(db, Campaign, campaign.id).status == "partially_completed"


@pytest.mark.parametrize("cancelled", ["cancelled", "canceled"])
def test_cancelled_deliveries_do_not_block_campaign(setup, db, make_user, cancelled):
    _, campaign, sent = setup("telegram")
    db.execute(update(Notification).where(Notification.id == sent.id).values(status="sent"))
    db.add(Notification(campaign_id=campaign.id, user_id=make_user().id, channel="email", status=cancelled))
    db.commit()

    refresh_campaign_status(db, campaign.id)
    db.commit()

    assert reload(db, Campaign, campaign.id).status == "partially_completed"


def test_all_cancelled_campaign_is_not_stuck_in_processing(setup, db):
    _, campaign, n = setup("telegram")
    db.execute(update(Notification).where(Notification.id == n.id).values(status="cancelled"))
    db.commit()

    refresh_campaign_status(db, campaign.id)
    db.commit()

    assert reload(db, Campaign, campaign.id).status != "processing"


def test_pending_delivery_keeps_campaign_processing(setup, db, make_user):
    _, campaign, n = setup("telegram")
    db.execute(update(Notification).where(Notification.id == n.id).values(status="cancelled"))
    db.add(Notification(campaign_id=campaign.id, user_id=make_user().id, channel="email", status="pending"))
    db.commit()

    refresh_campaign_status(db, campaign.id)
    db.commit()

    assert reload(db, Campaign, campaign.id).status == "processing"


# ---------- claim и recovery ----------

def test_claim_is_exclusive(setup, db):
    _, _, n = setup("telegram")

    assert claim_notification(n.id) is True
    assert claim_notification(n.id) is False
    assert reload(db, Notification, n.id).attempts == 1


def test_recovery_requeues_stuck_processing(setup, db):
    _, _, n = setup("telegram")
    db.execute(update(Notification).where(Notification.id == n.id).values(
        status="processing", processing_started_at=datetime.now(timezone.utc) - timedelta(minutes=10)))
    db.commit()

    assert recover_stuck_notifications() == 1

    n = reload(db, Notification, n.id)
    assert n.status == "pending" and n.processing_started_at is None
    event = db.query(OutboxEvent).one()
    assert event.payload == {"notification_id": n.id, "channel": "telegram"}


def test_recovery_ignores_fresh_processing(setup, db):
    _, _, n = setup("telegram")
    db.execute(update(Notification).where(Notification.id == n.id).values(
        status="processing", processing_started_at=datetime.now(timezone.utc)))
    db.commit()

    assert recover_stuck_notifications() == 0


# ---------- Celery-задачи: повтор через self.retry ----------

@pytest.mark.parametrize("task,channel", [
    (telegram_tasks.send_telegram_notification, "telegram"),
    (email_tasks.send_email_notification, "email"),
])
def test_task_retries_when_attempts_remain(setup, db, task, channel):
    _, _, n = setup(channel)
    db.execute(update(Notification).where(Notification.id == n.id).values(
        status="pending", attempts=1, next_retry_at=datetime.now(timezone.utc) + timedelta(seconds=30)))
    db.commit()
    module = telegram_tasks if channel == "telegram" else email_tasks

    with patch.object(module, "process_notification", side_effect=RuntimeError("boom")), \
            patch.object(task, "retry", side_effect=Retry()) as retry:
        with pytest.raises(Retry):
            task.run(n.id)

    assert retry.call_args.kwargs["countdown"] == pytest.approx(30, abs=2)


def test_task_does_not_retry_after_final_failure(setup, db):
    _, _, n = setup("telegram")
    db.execute(update(Notification).where(Notification.id == n.id).values(status="failed", attempts=5))
    db.commit()
    task = telegram_tasks.send_telegram_notification

    with patch.object(telegram_tasks, "process_notification", side_effect=RuntimeError("boom")), \
            patch.object(task, "retry") as retry:
        with pytest.raises(RuntimeError, match="boom"):
            task.run(n.id)

    retry.assert_not_called()


def test_task_success_calls_processor_once(setup):
    _, _, n = setup("email")
    with patch.object(email_tasks, "process_notification") as processor:
        email_tasks.send_email_notification.run(n.id)

    processor.assert_called_once_with(n.id, expected_channel="email")
