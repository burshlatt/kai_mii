# Дедлайн

Личный список учебных заданий: регистрация, лента, просрочка, фильтр, правка. Интерфейс по концепции «Чернильница».

Эта папка закрывает три домашних задания сразу:

- задание 4 — фронтенд, адаптив, тесты, отчёт `development_report.md`;
- задание 5 — PostgreSQL, API, сессия, связка с интерфейсом, `backend_documentation.md`;
- задание 6 — CI, аудит, OAuth, Метрика, здоровье и логи, `integration_documentation.md` и `security_audit.md`.

## Запуск локально

Нужны Node.js 22 и PostgreSQL 16.

```bash
cp .env.example .env
# Поправьте DATABASE_URL и JWT_SECRET

cd backend
npm ci
npm run dev
```

Во втором терминале:

```bash
cd frontend
npm ci
npm run dev
```

Интерфейс: http://localhost:5173  
API через прокси Vite: http://localhost:5173/api/health

Демо-данные, только не в production:

```bash
cd backend && npm run seed
```

Почта `alina@example.com`, пароль `demo-pass-1`.

Проверки:

```bash
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix backend
npm run lint --prefix frontend
```

## Docker

```bash
# В .env задайте JWT_SECRET длиной от 16 символов
docker compose up --build
```

Сайт откроется на http://localhost:8080 . Nginx отдаёт статику и проксирует `/api` в контейнер API. База — сервис `db`. Сервис `monitor` каждые 30 секунд читает `/api/health` и пишет `health alert`, если ответ не 200 или база не `up`.

На машине, где собирался этот репозиторий, Docker не был установлен. Схема и API проверены на локальном PostgreSQL 16, порт 5433, пользователь `deadline`. Файл `docker-compose.yml` — путь для VPS.

## Выкладка

На push в `main` GitHub Actions собирает образы. Если в репозитории `DEPLOY_ENABLED` равен `true` и заданы секреты `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `scripts/remote-deploy.sh` копирует дерево в `/opt/deadline` и выполняет `docker compose up -d --build`. На сервере заранее лежит свой `.env`: скрипт его не перезаписывает. После подъёма тот же монитор один раз проверяет здоровье API.

## Переменные

Смысл переменных написан в `.env.example`. Файл `.env` не коммитится.

OAuth заработает после ключей Google и Яндекс ID. Redirect URI:

- `http://localhost:5173/api/auth/oauth/google/callback`
- `http://localhost:5173/api/auth/oauth/yandex/callback`

Локально колбэк идёт через прокси Vite, поэтому cookie сессии остаётся на порту 5173. В Docker `PUBLIC_API_ORIGIN` и `FRONTEND_ORIGIN` — это `http://localhost:8080`.

Номер Яндекс Метрики задаётся как `VITE_METRIKA_ID` на сборке фронтенда. Пустое значение скрипт не вставляет.
