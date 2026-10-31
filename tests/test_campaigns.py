import pytest

from app.modules.groups.models import Group
from app.modules.tags.models import Tag
from app.modules.templates.models import MessageTemplate


def test_create_draft_campaign(create_campaign):
    campaign = create_campaign()

    assert campaign["status"] == "draft"
    assert campaign["channels"] == ["telegram", "email"]
    assert campaign["message"] == "Hello, {name}!"


def test_create_with_scheduled_at_is_scheduled(create_campaign):
    campaign = create_campaign(scheduled_at="2030-01-01T10:00:00Z")

    assert campaign["status"] == "scheduled"


def test_template_content_used_when_message_missing(create_campaign, db):
    template = MessageTemplate(name="Welcome", content="Hi {name} from template")
    db.add(template)
    db.commit()

    campaign = create_campaign(message=None, template_id=template.id)

    assert campaign["message"] == "Hi {name} from template"
    assert campaign["template_id"] == template.id


@pytest.mark.parametrize(
    "overrides",
    [
        {"message": None},  # ни message, ни template_id
        {"target_type": "group"},  # нет group_id
        {"target_type": "all", "group_id": 1},  # group_id не для all
        {"target_type": "individual"},  # нет user_ids
        {"target_type": "all", "user_ids": [1]},  # user_ids не для all
        {"channels": []},
        {"channels": ["telegram", "telegram"]},
        {"channels": ["sms"]},
        {"title": ""},
    ],
)
def test_create_validation_errors(client, auth_headers, overrides):
    body = {
        "title": "T",
        "message": "m",
        "target_type": "all",
        "channels": ["email"],
    }
    body.update(overrides)

    response = client.post("/campaigns/", json=body, headers=auth_headers)

    assert response.status_code == 422


def test_create_with_missing_references_returns_404(client, auth_headers, create_campaign, make_user):
    body = {"title": "T", "message": "m", "channels": ["email"]}

    for extra in (
        {"target_type": "all", "template_id": 999},
        {"target_type": "group", "group_id": 999},
        {"target_type": "individual", "user_ids": [999]},
    ):
        response = client.post("/campaigns/", json={**body, **extra}, headers=auth_headers)
        assert response.status_code == 404, extra


def test_individual_campaign_rejects_inactive_user(client, auth_headers, make_user):
    inactive = make_user(is_active=False)

    response = client.post(
        "/campaigns/",
        json={"title": "T", "message": "m", "target_type": "individual",
              "user_ids": [inactive.id], "channels": ["email"]},
        headers=auth_headers,
    )

    assert response.status_code == 404


def test_get_and_list_campaigns(client, auth_headers, create_campaign):
    first = create_campaign(title="First")
    second = create_campaign(title="Second")

    listing = client.get("/campaigns/", headers=auth_headers).json()

    assert [c["id"] for c in listing] == [second["id"], first["id"]]  # новые первыми
    assert client.get(f"/campaigns/{first['id']}", headers=auth_headers).json()["title"] == "First"
    assert client.get("/campaigns/999", headers=auth_headers).status_code == 404


def test_update_draft_campaign(client, auth_headers, create_campaign):
    campaign = create_campaign()

    response = client.patch(
        f"/campaigns/{campaign['id']}",
        json={"title": "Renamed", "message": "New text"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"
    assert response.json()["message"] == "New text"


def test_update_only_allowed_for_draft_or_scheduled(client, auth_headers, create_campaign, make_user):
    make_user()
    campaign = create_campaign()
    client.post(f"/campaigns/{campaign['id']}/launch", headers=auth_headers)

    response = client.patch(f"/campaigns/{campaign['id']}", json={"title": "x"}, headers=auth_headers)

    assert response.status_code == 409


def test_preview_counts_and_sample_message(client, auth_headers, create_campaign, make_user):
    both = make_user(name="Both")
    make_user(name="TgOnly", email=None, email_available=False)
    make_user(name="Nothing", email_available=False, telegram_available=False)
    make_user(name="Inactive", is_active=False)
    campaign = create_campaign(message="Hi {name} <{email}>")

    preview = client.get(f"/campaigns/{campaign['id']}/preview", headers=auth_headers).json()

    assert preview["total_recipients"] == 3  # неактивный исключён
    assert preview["telegram_recipients"] == 2
    assert preview["email_recipients"] == 1
    assert preview["unavailable_recipients"] == 1
    assert preview["sample_message"] == f"Hi {both.name} <{both.email}>"


def test_preview_single_channel_unavailable(client, auth_headers, create_campaign, make_user):
    make_user(telegram_available=False)
    campaign = create_campaign(channels=["telegram"])

    preview = client.get(f"/campaigns/{campaign['id']}/preview", headers=auth_headers).json()

    assert preview["telegram_recipients"] == 0
    assert preview["unavailable_recipients"] == 1


def test_preview_empty_audience_has_no_sample(client, auth_headers, create_campaign):
    campaign = create_campaign()

    preview = client.get(f"/campaigns/{campaign['id']}/preview", headers=auth_headers).json()

    assert preview["total_recipients"] == 0
    assert preview["sample_message"] is None


def test_group_audience_is_or_over_tags(client, auth_headers, create_campaign, make_user, db):
    vip, news, other = Tag(name="vip"), Tag(name="news"), Tag(name="other")
    db.add_all([vip, news, other])
    group = Group(name="G", tags=[vip, news])
    db.add(group)
    only_vip, only_news, both, none, other_tag = (make_user() for _ in range(5))
    only_vip.tags = [vip]
    only_news.tags = [news]
    both.tags = [vip, news]
    other_tag.tags = [other]
    db.commit()
    campaign = create_campaign(target_type="group", group_id=group.id)

    preview = client.get(f"/campaigns/{campaign['id']}/preview", headers=auth_headers).json()

    assert preview["total_recipients"] == 3  # дубликаты (both) не удваиваются
