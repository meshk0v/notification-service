
import logging

from celery import Celery
from kombu import Queue

from app.infrastructure.config import settings


celery_app = Celery(
    "notification_service",
    broker=settings.RABBITMQ_URL,
    include=[
        "workers.telegram_tasks",
        "workers.email_tasks",
    ],
)

celery_app.conf.update(
    # Формат сообщений
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Время
    timezone="UTC",
    enable_utc=True,

    # Очереди
    task_queues=(
        Queue("telegram_queue"),
        Queue("email_queue"),
    ),

    # Маршрутизация задач
    task_routes={
        "workers.telegram_tasks.send_telegram_notification": {
            "queue": "telegram_queue",
        },
        "workers.email_tasks.send_email_notification": {
            "queue": "email_queue",
        },
    },

    # Подтверждение публикации RabbitMQ
    broker_transport_options={
        "confirm_publish": True,
    },

    # Повторные попытки публикации при ошибках
    task_publish_retry=True,
    task_publish_retry_policy={
        "max_retries": 3,
        "interval_start": 1,
        "interval_step": 2,
        "interval_max": 5,
    },

    # Сохранять сообщения в очереди при перезапуске RabbitMQ
    task_default_delivery_mode=2,
)

celery_app.conf.worker_enable_remote_control=False

# httpx пишет полный URL запроса на INFO, а в нём токен Telegram-бота
logging.getLogger("httpx").setLevel(logging.WARNING)
