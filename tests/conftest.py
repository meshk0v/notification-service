"""
Тесты работают с отдельной PostgreSQL-базой (<имя рабочей БД>_test) и
никогда не обращаются к рабочим данным. Реальные Telegram и SMTP
заблокированы: любой неподмененный вызов провайдера роняет тест.

Запуск (из контейнера, где есть PostgreSQL по сети compose):
    docker compose exec api pip install -r requirements-dev.txt
    docker compose exec api pytest
"""

import os
from urllib.parse import urlparse

# --- должно выполниться ДО импорта приложения: engine создаётся при импорте ---
_base_url = os.environ["DATABASE_URL"]
_base_name = urlparse(_base_url.replace("+psycopg", "")).path.lstrip("/")
TEST_DB_NAME = _base_name if _base_name.endswith("_test") else f"{_base_name}_test"
TEST_DATABASE_URL = _base_url.rsplit("/", 1)[0] + "/" + TEST_DB_NAME
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.infrastructure.database import Base, SessionLocal, engine
from app.infrastructure.security import hash_password
from app.main import app as fastapi_app
from app.modules.auth.models import Employee
from app.modules.users.models import User

# регистрируем все модели в Base.metadata
import app.modules.campaigns.models  # noqa: F401
import app.modules.groups.models  # noqa: F401
import app.modules.notifications.models  # noqa: F401
import app.modules.outbox.models  # noqa: F401
import app.modules.tags.models  # noqa: F401
import app.modules.templates.models  # noqa: F401

assert engine.url.database == TEST_DB_NAME, "тесты должны идти в тестовую БД"
assert TEST_DB_NAME.endswith("_test")

EMPLOYEE_USERNAME = "tester"
EMPLOYEE_PASSWORD = "tester-password-1"


def _ensure_test_database() -> None:
    admin_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")

    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"),
            {"n": TEST_DB_NAME},
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))

    admin.dispose()


@pytest.fixture(scope="session", autouse=True)
def _schema():
    _ensure_test_database()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables(_schema):
    tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)

    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))

    yield


@pytest.fixture(autouse=True)
def providers(monkeypatch):
    """
    Подменяет Telegram и SMTP. Возвращает (telegram_mock, email_mock).

    Так же блокирует сетевые вызовы на уровне httpx/smtplib, чтобы
    случайно не отправить настоящее сообщение.
    """
    from unittest.mock import MagicMock

    telegram = MagicMock(name="send_telegram_message")
    email = MagicMock(name="send_email_message")

    monkeypatch.setattr(
        "workers.notification_processor.send_telegram_message", telegram
    )
    monkeypatch.setattr(
        "workers.notification_processor.send_email_message", email
    )

    def _blocked(*args, **kwargs):
        raise AssertionError("Реальная сеть в тестах запрещена")

    monkeypatch.setattr("httpx.post", _blocked)
    monkeypatch.setattr("smtplib.SMTP", _blocked)

    return telegram, email


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(fastapi_app) as c:
        yield c


@pytest.fixture
def employee(db):
    emp = Employee(
        username=EMPLOYEE_USERNAME,
        password_hash=hash_password(EMPLOYEE_PASSWORD),
    )
    db.add(emp)
    db.commit()
    return emp


@pytest.fixture
def auth_headers(client, employee):
    response = client.post(
        "/auth/login",
        data={"username": EMPLOYEE_USERNAME, "password": EMPLOYEE_PASSWORD},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def make_user(db):
    counter = {"n": 0}

    def factory(
        name: str = "User",
        email: str | None = "auto",
        telegram_id: int | None = -1,
        email_available: bool = True,
        telegram_available: bool = True,
        is_active: bool = True,
    ) -> User:
        counter["n"] += 1
        n = counter["n"]

        user = User(
            name=f"{name} {n}",
            email=f"user{n}@test.local" if email == "auto" else email,
            telegram_id=(100_000 + n) if telegram_id == -1 else telegram_id,
            email_available=email_available,
            telegram_available=telegram_available,
            is_active=is_active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return factory


@pytest.fixture
def create_campaign(client, auth_headers):
    def factory(**overrides):
        body = {
            "title": "Test campaign",
            "message": "Hello, {name}!",
            "target_type": "all",
            "channels": ["telegram", "email"],
        }
        body.update(overrides)
        response = client.post("/campaigns/", json=body, headers=auth_headers)
        assert response.status_code == 201, response.text
        return response.json()

    return factory
