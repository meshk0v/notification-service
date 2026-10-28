
import httpx

from app.infrastructure.config import settings


class TelegramDeliveryError(Exception):
    pass


def send_telegram_message(
    telegram_id: int,
    message: str,
) -> None:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise TelegramDeliveryError(
            "TELEGRAM_BOT_TOKEN is not configured"
        )

    url = (
        "https://api.telegram.org/"
        f"bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    )

    response = httpx.post(
        url,
        json={
            "chat_id": telegram_id,
            "text": message,
        },
        timeout=15,
    )

    try:
        data = response.json()
    except ValueError:
        raise TelegramDeliveryError(
            f"Invalid Telegram response: HTTP {response.status_code}"
        )

    if response.status_code >= 400 or not data.get("ok"):
        description = data.get(
            "description",
            f"HTTP {response.status_code}",
        )
        raise TelegramDeliveryError(description)
