# Notification Service

Сервис массовой рассылки уведомлений через **Telegram** и **Email** с административным веб-интерфейсом.

Сотрудник входит в панель, ведёт список получателей (пользователи, теги, группы), создаёт шаблоны и кампании,
запускает рассылку и отслеживает доставку по каждому получателю. Отправка идёт асинхронно: через очередь,
с повторными попытками и защитой от дублей.

## Возможности

- Авторизация сотрудников по JWT.
- Пользователи с каналами Telegram/Email, теги, группы (пользователь входит в группу, если у него есть **хотя бы один** тег группы).
- Шаблоны сообщений с подстановками `{name}` и `{email}`.
- Кампании: аудитория (все / группа / выбранные пользователи), каналы, предпросмотр, запуск, статистика, история доставок.
- Надёжная доставка: Outbox-паттерн, повторные попытки с экспоненциальной задержкой, восстановление зависших задач.

## Архитектура

```
 React UI ──HTTP──► FastAPI ──► PostgreSQL
                      │            ▲   ▲
        запуск        │            │   │ статусы доставок и кампании
        кампании      ▼            │   │
        notifications + outbox_events (одна транзакция)
                      │            │   │
                      ▼            │   │
             Outbox Publisher ──► RabbitMQ ──► Celery Worker ──► Telegram Bot API
             (workers/outbox_publisher.py)    (telegram_queue,    SMTP
                                               email_queue)
             Recovery (раз в минуту): возвращает зависшие доставки в очередь
```

1. `POST /campaigns/{id}/launch` в одной транзакции создаёт записи `notifications` (по одной на пару пользователь × канал, только если канал доступен) и `outbox_events`.
2. **Outbox Publisher** забирает события со статусом `pending` и публикует задачи в RabbitMQ; при сбое брокера пробует снова с задержкой.
3. **Celery Worker** захватывает доставку атомарно (повторная задача не отправит сообщение дважды), отправляет через провайдера и обновляет статусы доставки и кампании.
4. При ошибке доставка возвращается в `pending` с задержкой `2^попытка` секунд (максимум 5 попыток), затем получает статус `failed`.
5. **Recovery** возвращает в очередь доставки, зависшие в `processing` дольше 5 минут. Гарантия доставки — «хотя бы один раз»: если сообщение ушло, а запись статуса не удалась, оно может быть отправлено повторно.

Структура репозитория:

| Путь | Назначение |
|---|---|
| `app/` | FastAPI: модули `auth`, `users`, `tags`, `groups`, `templates`, `campaigns`, `stats`, провайдеры Telegram/SMTP |
| `workers/` | Celery-приложение, обработка доставок, Outbox Publisher, Recovery |
| `migrations/` | миграции Alembic |
| `frontend/` | административный интерфейс (см. [frontend/README.md](frontend/README.md)) |
| `tests/` | автотесты pytest |

## Технологии

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic, python-jose + pwdlib (JWT, argon2)
- **Очереди:** RabbitMQ, Celery
- **БД:** PostgreSQL 17
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, TanStack Query, Axios
- **Инфраструктура:** Docker Compose
- **Тесты:** pytest

## Быстрый старт

Требуется Docker с Compose и (для интерфейса) Node.js ≥ 18.

```bash
# 1. Настройте окружение
cp .env.example .env        # если файла нет — создайте .env по таблице ниже

# 2. Запустите все сервисы
docker compose up -d

# 3. Примените миграции (при первом запуске и после обновлений)
docker compose exec api alembic upgrade head

# 4. Создайте сотрудника для входа
docker compose exec api python -m app.modules.auth.create_employee

# 5. Запустите интерфейс
cd frontend && npm install && npm run dev      # http://localhost:5173
```

Проверка: `curl http://localhost:8001/health` → `{"status":"ok"}`.

| Сервис | Адрес |
|---|---|
| API | http://localhost:8001 (Swagger: `/docs`) |
| Веб-интерфейс (dev) | http://localhost:5173 |
| RabbitMQ Management | http://localhost:15672 |
| PostgreSQL | localhost:5433 |

Контейнеры: `api`, `worker`, `outbox_publisher`, `recovery`, `postgres`, `rabbitmq`, `redis`.
Redis подключён, но в текущей версии кодом не используется.

## Настройка `.env`

Файл `.env` читается всеми контейнерами и **не должен попадать в Git** (он в `.gitignore`).
При изменении `.env` пересоздайте контейнеры: `docker compose up -d --force-recreate`.

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg://notification_user:<пароль>@postgres:5432/notification_db` |
| `REDIS_URL` | `redis://redis:6379/0` |
| `RABBITMQ_URL` | `amqp://guest:guest@rabbitmq:5672//` |
| `TELEGRAM_BOT_TOKEN` | токен бота от @BotFather |
| `SMTP_HOST`, `SMTP_PORT` | SMTP-сервер, например `smtp.gmail.com` и `587` |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | учётные данные SMTP (для Gmail — пароль приложения) |
| `SMTP_FROM_EMAIL` | адрес отправителя; многие провайдеры подменяют его на адрес учётной записи |
| `SMTP_USE_TLS` | `true` для STARTTLS |
| `JWT_SECRET_KEY` | длинная случайная строка, например `openssl rand -hex 32` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | время жизни токена, по умолчанию `60` |

Получатель Telegram должен хотя бы раз написать боту, иначе Telegram не даст отправить ему сообщение.

## Миграции

```bash
docker compose exec api alembic upgrade head                       # применить
docker compose exec api alembic current                            # текущая версия
docker compose exec api alembic revision --autogenerate -m "name"  # создать миграцию
```

Миграции не запускаются автоматически при старте контейнеров.

## Тесты

Тесты используют отдельную базу `<имя_БД>_test` (создаётся автоматически) и не затрагивают рабочие данные.
Реальные Telegram и SMTP не вызываются: провайдеры заменены моками, а сетевые вызовы блокируются.

```bash
docker compose exec api pip install -r requirements-dev.txt   # один раз после пересоздания контейнера
docker compose exec api pytest
```

Покрыто: авторизация, кампании и валидация, формирование доставок, Outbox, обработка доставок
(успех, ошибка, повторные попытки, восстановление), провайдеры, статистика.
Тесты запускаются в контейнере, потому что им нужен PostgreSQL из сети Compose.

## API

Все эндпоинты, кроме `POST /auth/login` и `GET /health`, требуют заголовок `Authorization: Bearer <token>`.
Полная схема — в Swagger (`/docs`).

| Группа | Эндпоинты |
|---|---|
| Auth | `POST /auth/login` (form-data), `GET /auth/me` |
| Users | `/users/` (CRUD; удаление деактивирует; `X-Total-Count` в списке) |
| Tags | `/tags/`, назначение и снятие тега: `/tags/{tag_id}/users/{user_id}` |
| Groups | `/groups/` (CRUD), `/groups/{id}/users` |
| Templates | `/templates/` (CRUD) |
| Campaigns | `/campaigns/`, `/{id}/preview`, `/{id}/launch`, `/{id}/stats`, `/{id}/deliveries?status=&channel=` |
| Stats | `GET /stats/overview` |

## Ограничения

- Поле `scheduled_at` у кампании — только отметка: автоматического запуска по дате нет, кампанию запускает сотрудник.
- Аудиторию и каналы кампании после создания менять нельзя; редактируются название, текст, шаблон и дата.
- Подстановки поддерживают только `{name}` и `{email}`.
- Профиль и пароль сотрудника через API не меняются; сотрудников создаёт администратор командой выше.
