# Notification Service — Admin UI

React + TypeScript + Vite + Tailwind CSS 4 + React Router + TanStack Query + Axios + Lucide.

## Запуск

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Backend должен работать на `http://localhost:8001` (`docker compose up`).
В dev-режиме запросы `/api/*` проксируются Vite на backend (в FastAPI не настроен CORS).
Другой адрес backend: `VITE_PROXY_TARGET=http://host:port npm run dev`.

Сотрудника для входа создаёт администратор:

```bash
docker compose exec api python -m app.modules.auth.create_employee
```

Сборка: `npm run build` (папка `dist/`). Для production нужен reverse proxy,
который отдаёт `dist/` и проксирует `/api/` на backend (либо включите CORS в FastAPI
и задайте `VITE_API_URL=https://api.example.com` при сборке).

Требуется Node.js ≥ 18 (проверено на 20.12; Vite 6).

## Структура `src/`

`api/` — axios-клиент (Bearer-токен, обработка 401) и все endpoint-ы · `types/` — типы по Pydantic-схемам ·
`hooks/` — React Query хуки и `useAuth` · `layouts/` — sidebar/topbar и защита маршрутов ·
`components/ui/` — дизайн-система · `pages/` — страницы · `utils/` — форматирование, ошибки, подписи.

## Изменения backend (минимальные, аддитивные)

- `GET /users/` и остальные ответы пользователя теперь содержат `tags: [{id, name}]`.
- `PATCH /groups/{id}` (name, description, tag_ids) и `DELETE /groups/{id}`.
- `GET /campaigns/{id}/deliveries` принимает фильтры `status` и `channel`.
- Новый `GET /stats/overview` (для Dashboard).

## Ограничения API, отражённые в UI

- Нет автозапуска по `scheduled_at` — это только отметка, кампанию запускают вручную.
- Аудиторию и каналы кампании после создания менять нельзя (PATCH принимает title/message/template_id/scheduled_at).
- Список пользователей отдаёт только активных; «удаление» — деактивация.
- Профиль сотрудника только для чтения (нет endpoint-а для изменения).
