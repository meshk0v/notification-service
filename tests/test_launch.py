from sqlalchemy import select

from app.modules.groups.models import Group
from app.modules.notifications.models import Notification
from app.modules.outbox.models import OutboxEvent
from app.modules.campaigns.models import Campaign
from app.modules.tags.models import Tag


def launch(client, auth_headers, campaign_id):
    return client.post(f"/campaigns/{campaign_id}/launch", headers=auth_headers)


def test_launch_creates_deliveries_and_outbox_events(client, auth_headers, create_campaign, make_user, db):
    user = make_user()
    campaign = create_campaign()

    response = launch(client, auth_headers, campaign["id"])

    assert response.status_code == 200
    assert response.json() == {
        "campaign_id": campaign["id"],
        "status": "processing",
        "recipients_found": 1,
        "deliveries_created": 2,
        "outbox_events_created": 2,
    }

    notifications = db.scalars(select(Notification).order_by(Notification.id)).all()
    assert {(n.user_id, n.channel, n.status, n.attempts, n.max_attempts) for n in notifications} == {
        (user.id, "telegram", "pending", 0, 5),
        (user.id, "email", "pending", 0, 5),
    }

    events = db.scalars(select(OutboxEvent)).all()
    assert len(events) == 2
    assert {e.payload["notification_id"] for e in events} == {n.id for n in notifications}
    assert all(e.event_type == "notification.created" and e.status == "pending" for e in events)
    assert db.get(Campaign, campaign["id"]).status == "processing"


def test_launch_skips_unavailable_channels_and_inactive_users(client, auth_headers, create_campaign, make_user, db):
    make_user(name="Full")
    make_user(name="TgOnly", email_available=False)
    make_user(name="NoTgId", telegram_id=None)
    make_user(name="Inactive", is_active=False)
    campaign = create_campaign()

    result = launch(client, auth_headers, campaign["id"]).json()

    # Full: 2, TgOnly: 1 (telegram), NoTgId: 1 (email), Inactive: 0
    assert result["recipients_found"] == 3
    assert result["deliveries_created"] == 4
    assert db.query(Notification).count() == 4
    assert db.query(OutboxEvent).count() == 4


def test_launch_respects_selected_channels(client, auth_headers, create_campaign, make_user, db):
    make_user()
    campaign = create_campaign(channels=["email"])

    launch(client, auth_headers, campaign["id"])

    assert [n.channel for n in db.scalars(select(Notification)).all()] == ["email"]


def test_launch_individual_audience_only_selected(client, auth_headers, create_campaign, make_user, db):
    chosen = make_user(name="Chosen")
    make_user(name="Other")
    campaign = create_campaign(target_type="individual", user_ids=[chosen.id])

    launch(client, auth_headers, campaign["id"])

    assert {n.user_id for n in db.scalars(select(Notification)).all()} == {chosen.id}


def test_launch_group_audience(client, auth_headers, create_campaign, make_user, db):
    tag = Tag(name="vip")
    db.add(tag)
    group = Group(name="VIP", tags=[tag])
    db.add(group)
    member, outsider = make_user(), make_user()
    member.tags = [tag]
    db.commit()
    campaign = create_campaign(target_type="group", group_id=group.id)

    launch(client, auth_headers, campaign["id"])

    assert {n.user_id for n in db.scalars(select(Notification)).all()} == {member.id}
    assert outsider.id not in {n.user_id for n in db.scalars(select(Notification)).all()}


def test_launch_twice_is_rejected(client, auth_headers, create_campaign, make_user, db):
    make_user()
    campaign = create_campaign()
    launch(client, auth_headers, campaign["id"])

    second = launch(client, auth_headers, campaign["id"])

    assert second.status_code == 409
    assert db.query(Notification).count() == 2


def test_relaunch_does_not_duplicate_deliveries(client, auth_headers, create_campaign, make_user, db):
    """Уникальность (campaign, user, channel) защищает от дублей даже при сбросе статуса."""
    make_user()
    campaign = create_campaign()
    launch(client, auth_headers, campaign["id"])
    db.get(Campaign, campaign["id"]).status = "draft"
    db.commit()

    result = launch(client, auth_headers, campaign["id"]).json()

    assert result["deliveries_created"] == 0
    assert result["outbox_events_created"] == 0
    assert db.query(Notification).count() == 2


def test_launch_without_recipients_creates_nothing(client, auth_headers, create_campaign, db):
    campaign = create_campaign()

    result = launch(client, auth_headers, campaign["id"]).json()

    assert result["deliveries_created"] == 0
    assert db.query(OutboxEvent).count() == 0


def test_launch_unknown_campaign(client, auth_headers):
    assert launch(client, auth_headers, 999).status_code == 404
