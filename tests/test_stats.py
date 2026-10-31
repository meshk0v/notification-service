from datetime import datetime, timezone

from app.modules.campaigns.models import Campaign
from app.modules.notifications.models import Notification


def add_campaign(db, title="C", status="processing"):
    campaign = Campaign(title=title, message="m", target_type="all", channels=["telegram", "email"], status=status)
    db.add(campaign)
    db.commit()
    return campaign


def add_notification(db, campaign, user, channel, status, error=None, sent_at=None):
    n = Notification(campaign_id=campaign.id, user_id=user.id, channel=channel, status=status,
                     error_message=error, sent_at=sent_at, attempts=1)
    db.add(n)
    db.commit()
    return n


def test_campaign_stats_counts(client, auth_headers, db, make_user):
    user = make_user()
    campaign = add_campaign(db)
    add_notification(db, campaign, user, "telegram", "sent")
    add_notification(db, campaign, user, "email", "failed", error="boom")
    other = make_user()
    add_notification(db, campaign, other, "telegram", "pending")
    add_notification(db, campaign, other, "email", "processing")

    stats = client.get(f"/campaigns/{campaign.id}/stats", headers=auth_headers).json()

    assert stats["total"] == 4
    assert (stats["sent"], stats["failed"], stats["queued"], stats["in_progress"], stats["canceled"]) == (1, 1, 1, 1, 0)
    assert stats["channels"] == {"telegram": 2, "email": 2}
    assert stats["campaign_status"] == "processing"


def test_campaign_stats_empty_and_missing(client, auth_headers, db):
    campaign = add_campaign(db, status="draft")

    stats = client.get(f"/campaigns/{campaign.id}/stats", headers=auth_headers).json()

    assert stats["total"] == 0 and stats["channels"] == {}
    assert client.get("/campaigns/999/stats", headers=auth_headers).status_code == 404


def test_deliveries_history_filters_and_pagination(client, auth_headers, db, make_user):
    user = make_user(name="Anna")
    campaign = add_campaign(db)
    add_notification(db, campaign, user, "telegram", "sent", sent_at=datetime.now(timezone.utc))
    add_notification(db, campaign, user, "email", "failed", error="SMTP down")
    base = f"/campaigns/{campaign.id}/deliveries"

    everything = client.get(base, headers=auth_headers).json()
    failed = client.get(base, params={"status": "failed"}, headers=auth_headers).json()
    telegram = client.get(base, params={"channel": "telegram"}, headers=auth_headers).json()
    page = client.get(base, params={"limit": 1, "offset": 1}, headers=auth_headers).json()

    assert everything["total"] == 2
    assert failed["total"] == 1
    assert failed["deliveries"][0]["error_message"] == "SMTP down"
    assert failed["deliveries"][0]["user_name"] == user.name
    assert telegram["deliveries"][0]["channel"] == "telegram"
    assert page["total"] == 2 and len(page["deliveries"]) == 1
    assert client.get(base, params={"limit": 0}, headers=auth_headers).status_code == 422


def test_overview_totals_channels_and_errors(client, auth_headers, db, make_user):
    user = make_user()
    campaign = add_campaign(db, title="Spring")
    add_notification(db, campaign, user, "telegram", "sent", sent_at=datetime.now(timezone.utc))
    add_notification(db, campaign, user, "email", "failed", error="mailbox full")
    add_notification(db, add_campaign(db, title="Other"), user, "email", "pending")

    overview = client.get("/stats/overview", headers=auth_headers).json()

    assert overview["total_users"] == 1
    assert overview["total_campaigns"] == 2
    assert overview["deliveries"] == {"total": 3, "sent": 1, "failed": 1, "pending": 1}
    assert overview["by_channel"]["telegram"] == {"sent": 1}
    assert overview["by_channel"]["email"] == {"failed": 1, "pending": 1}
    assert [d["channel"] for d in overview["daily_sent"]] == ["telegram"]
    assert overview["recent_errors"][0]["error_message"] == "mailbox full"
    assert overview["recent_errors"][0]["campaign_title"] == "Spring"


def test_overview_empty(client, auth_headers):
    overview = client.get("/stats/overview", headers=auth_headers).json()

    assert overview["deliveries"]["total"] == 0
    assert overview["daily_sent"] == [] and overview["recent_errors"] == []
