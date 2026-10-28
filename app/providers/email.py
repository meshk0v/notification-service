
import smtplib

from email.message import EmailMessage

from app.infrastructure.config import settings


class EmailDeliveryError(Exception):
    pass


def send_email_message(
    recipient: str,
    subject: str,
    message: str,
) -> None:
    required_settings = [
        settings.SMTP_HOST,
        settings.SMTP_USERNAME,
        settings.SMTP_PASSWORD,
        settings.SMTP_FROM_EMAIL,
    ]

    if not all(required_settings):
        raise EmailDeliveryError(
            "SMTP settings are not fully configured"
        )

    email = EmailMessage()
    email["Subject"] = subject
    email["From"] = settings.SMTP_FROM_EMAIL
    email["To"] = recipient
    email.set_content(message)

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()

            smtp.login(
                settings.SMTP_USERNAME,
                settings.SMTP_PASSWORD,
            )

            smtp.send_message(email)

    except (smtplib.SMTPException, OSError) as exc:
        raise EmailDeliveryError(str(exc)) from exc
