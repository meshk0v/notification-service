import pytest

from tests.conftest import EMPLOYEE_PASSWORD, EMPLOYEE_USERNAME


def login(client, username=EMPLOYEE_USERNAME, password=EMPLOYEE_PASSWORD):
    return client.post("/auth/login", data={"username": username, "password": password})


def test_login_success_returns_bearer_token(client, employee):
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_wrong_password(client, employee):
    assert login(client, password="wrong").status_code == 401


def test_login_unknown_user(client):
    assert login(client, username="nobody").status_code == 401


def test_login_inactive_employee_rejected(client, employee, db):
    employee.is_active = False
    db.commit()

    assert login(client).status_code == 401


def test_me_returns_current_employee(client, auth_headers):
    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["username"] == EMPLOYEE_USERNAME
    assert "password_hash" not in response.json()


def test_me_with_garbage_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})

    assert response.status_code == 401


def test_token_of_deactivated_employee_rejected(client, auth_headers, employee, db):
    employee.is_active = False
    db.commit()

    assert client.get("/auth/me", headers=auth_headers).status_code == 401


@pytest.mark.parametrize(
    "path",
    ["/users/", "/tags/", "/groups/", "/templates/", "/campaigns/", "/stats/overview", "/auth/me"],
)
def test_protected_routes_require_token(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize(
    "path",
    ["/users/", "/tags/", "/groups/", "/templates/", "/campaigns/", "/stats/overview"],
)
def test_protected_routes_accept_valid_token(client, auth_headers, path):
    assert client.get(path, headers=auth_headers).status_code == 200


def test_post_without_token_creates_nothing(client, db):
    from app.modules.users.models import User

    response = client.post("/users/", json={"name": "Ghost", "email": "ghost@test.local"})

    assert response.status_code == 401
    assert db.query(User).count() == 0


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok"}
