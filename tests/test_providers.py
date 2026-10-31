import smtplib
from unittest.mock import MagicMock, patch

import pytest

from app.infrastructure.config import settings
from app.providers.email import EmailDeliveryError, send_email_message
from app.providers.telegram import TelegramDeliveryError, send_telegram_message


def response(status=200, body=None, json_error=False):
    r = MagicMock(status_code=status)
    if json_error:
        r.json.side_effect = ValueError("not json")
    else:
        r.json.return_value = body if body is not None else {"ok": True}
    return r


@pytest.fixture
def telegram_token(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", "TEST-TOKEN")


@pytest.fixture
def smtp_settings(monkeypatch):
    for name, value in {"SMTP_HOST": "smtp.test", "SMTP_PORT": 587, "SMTP_USERNAME": "user",
                        "SMTP_PASSWORD": "pass", "SMTP_FROM_EMAIL": "from@test.local",
                        "SMTP_USE_TLS": True}.items():
        monkeypatch.setattr(settings, name, value)


# ---------- Telegram ----------

def test_telegram_sends_expected_request(telegram_token):
    with patch("httpx.post", return_value=response()) as post:
        send_telegram_message(telegram_id=42, message="hello")

    post.assert_called_once()
    assert post.call_args.args[0] == "https://api.telegram.org/botTEST-TOKEN/sendMessage"
    assert post.call_args.kwargs["json"] == {"chat_id": 42, "text": "hello"}


def test_telegram_api_error_raises(telegram_token):
    with patch("httpx.post", return_value=response(400, {"ok": False, "description": "chat not found"})):
        with pytest.raises(TelegramDeliveryError, match="chat not found"):
            send_telegram_message(1, "x")


def test_telegram_invalid_json_raises(telegram_token):
    with patch("httpx.post", return_value=response(502, json_error=True)):
        with pytest.raises(TelegramDeliveryError, match="502"):
            send_telegram_message(1, "x")


def test_telegram_requires_token(monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_BOT_TOKEN", None)

    with pytest.raises(TelegramDeliveryError, match="not configured"):
        send_telegram_message(1, "x")


# ---------- SMTP ----------

def test_email_sends_message_via_smtp(smtp_settings):
    with patch("smtplib.SMTP") as smtp_cls:
        send_email_message("to@test.local", "Subject", "Body")

    smtp_cls.assert_called_once_with("smtp.test", 587, timeout=20)
    smtp = smtp_cls.return_value.__enter__.return_value
    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("user", "pass")
    sent = smtp.send_message.call_args.args[0]
    assert (sent["To"], sent["From"], sent["Subject"]) == ("to@test.local", "from@test.local", "Subject")
    assert sent.get_content().strip() == "Body"


def test_email_skips_starttls_when_disabled(smtp_settings, monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USE_TLS", False)

    with patch("smtplib.SMTP") as smtp_cls:
        send_email_message("to@test.local", "S", "B")

    smtp_cls.return_value.__enter__.return_value.starttls.assert_not_called()


@pytest.mark.parametrize("error", [smtplib.SMTPAuthenticationError(535, b"bad"), OSError("network down")])
def test_email_smtp_errors_are_wrapped(smtp_settings, error):
    with patch("smtplib.SMTP", side_effect=error):
        with pytest.raises(EmailDeliveryError):
            send_email_message("to@test.local", "S", "B")


def test_email_requires_settings(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_HOST", None)

    with pytest.raises(EmailDeliveryError, match="not fully configured"):
        send_email_message("to@test.local", "S", "B")


def test_real_network_is_blocked_in_tests():
    """Страховка: автофикстура не даёт тестам обратиться к реальным Telegram/SMTP."""
    import httpx

    with pytest.raises(AssertionError, match="запрещена"):
        httpx.post("https://api.telegram.org/botX/sendMessage")
    with pytest.raises(AssertionError, match="запрещена"):
        smtplib.SMTP("smtp.gmail.com", 587)
