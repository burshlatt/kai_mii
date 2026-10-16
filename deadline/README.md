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

Почта `bulat@mail.ru`, пароль `12345`. Имя в списке: Каримов Булат.

Проверки:

```bash
npm test --prefix backend
npm test --prefix frontend
npm run lint --prefix backend
npm run lint --prefix frontend
```

## Docker

```bash
# Из корня репозитория: Docker, копия .env и JWT_SECRET
./setup.sh

cd deadline
docker compose up --build
```

Сайт откроется на http://localhost:8080 . Nginx отдаёт статику и проксирует `/api` в контейнер API. База — сервис `db`, отдельный PostgreSQL на машине не нужен. Одноразовый сервис `seed` создаёт пользователя `bulat@mail.ru` с паролем `12345`. Сервис `monitor` каждые 30 секунд читает `/api/health` и пишет `health alert`, если ответ не 200 или база не `up`.

На машине, где собирался этот репозиторий, Docker не был установлен, поэтому проверка шла на локальном PostgreSQL 16, порт 5433. Если каталога `deadline/.pgdata` нет, `./start.sh` из корня репозитория сам вызывает `docker compose up --build`.

## Vercel

Сайт и API публикуются одним проектом. Корень репозитория — корень проекта на Vercel: там лежат `vercel.json` и `api/[[...path]].ts`. Сборка кладёт статику Vite в `deadline/frontend/dist`, а запросы `/api/*` принимает одна функция. Браузер ходит на тот же домен, поэтому cookie сессии остаются `SameSite=Lax`. На Vercel у них ещё стоит флаг `Secure`. Хост превью берётся из `VERCEL_URL`, production-домен — из `VERCEL_PROJECT_PRODUCTION_URL`, так что сессия не уезжает на `localhost`.

База на Vercel не поднимается. Нужен внешний PostgreSQL, например Neon или Supabase. В строку `DATABASE_URL` подставьте выданный адрес. Для удалённого хоста клиент сам включает TLS.

В настройках проекта задайте переменные:

- `DATABASE_URL` — внешний Postgres;
- `JWT_SECRET` — не короче 16 символов;
- `CRON_SECRET` — не короче 16 символов;
- `COOKIE_SECURE=true`;
- `FRONTEND_ORIGIN` и `PUBLIC_API_ORIGIN` — `https://<проект>.vercel.app` (после первого деплоя подставьте точный адрес и пересоберите);
- ключи Google и Яндекс, если нужен OAuth. Redirect URI: `https://<проект>.vercel.app/api/auth/oauth/google/callback` и то же для `yandex`. На превью-адресах OAuth заработает только если этот адрес тоже указан в кабинете провайдера;
- `VITE_METRIKA_ID` до сборки, если нужна Метрика. Пустое значение скрипт не вставляет.

Схема применяется на первом запросе к функции. Повтор безопасен: `CREATE TABLE IF NOT EXISTS` и общая блокировка `pg_advisory_lock`. Тот же шаг можно выполнить до открытия сайта:

```bash
DATABASE_URL='postgresql://...' npm run migrate --prefix deadline/backend
```

Демо-пользователь на Vercel сам не создаётся. Его добавляют отдельно, не из контейнера `seed`:

```bash
DATABASE_URL='postgresql://...' JWT_SECRET='...' SEED_DEMO=1 NODE_ENV=production npm run seed --prefix deadline/backend
```

Почта `bulat@mail.ru`, пароль `12345`.

`GET /api/health` по-прежнему отвечает, жива ли база. Раз в сутки в 08:00 UTC Vercel Cron вызывает `GET /api/cron/health` и прикладывает `Authorization: Bearer <CRON_SECRET>`. В лог пишется `health ok` или `health alert`. На тарифе Hobby cron чаще раза в день поставить нельзя, поэтому интервал в 30 секунд остаётся у контейнера `monitor` в Docker. Для более частой проверки снаружи опрашивайте `/api/health`.

Пул в функции один на экземпляр (`max: 1`), чтобы параллельные холодные старты не занимали все соединения Postgres. Лимит попыток входа считается в памяти экземпляра: на нескольких копиях функции он не общий.

Docker Compose, локальный `npm run dev` и выкладка по SSH не меняются.

Автодеплой на Vercel делает тот же workflow `.github/workflows/ci.yml`, после проверок бэкенда и фронтенда. Включите его переменной репозитория `VERCEL_DEPLOY_ENABLED=true` и секретами `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Push в `main` публикует production, pull request из этого репозитория — превью. Адрес деплоя пишется в summary шага. Повторный запуск той же ветки отменяет предыдущий.

Проект на Vercel создайте один раз и отключите у него свой Git-деплой, иначе каждый push соберётся дважды. `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET` и остальные переменные задаются в проекте Vercel: `vercel pull` забирает их на сборку. Идентификаторы лежат в Project Settings → General (Project ID) и в настройках команды (Team ID). Токен создаётся в Account → Tokens.

## Выкладка

На push в `main` GitHub Actions собирает образы. Если в репозитории `DEPLOY_ENABLED` равен `true` и заданы секреты `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `scripts/remote-deploy.sh` копирует дерево в `/opt/deadline` и выполняет `docker compose up -d --build`. На сервере заранее лежит свой `.env`: скрипт его не перезаписывает. После подъёма тот же монитор один раз проверяет здоровье API.

Тот же push выкладывает сайт на Vercel, если включён `VERCEL_DEPLOY_ENABLED`. Условия и секреты описаны в разделе Vercel.

## Переменные

Смысл переменных написан в `.env.example`. Файл `.env` не коммитится.

OAuth заработает после ключей Google и Яндекс ID. Redirect URI:

- `http://localhost:5173/api/auth/oauth/google/callback`
- `http://localhost:5173/api/auth/oauth/yandex/callback`

Локально колбэк идёт через прокси Vite, поэтому cookie сессии остаётся на порту 5173. В Docker `PUBLIC_API_ORIGIN` и `FRONTEND_ORIGIN` — это `http://localhost:8080`.

Номер Яндекс Метрики задаётся как `VITE_METRIKA_ID` на сборке фронтенда. Пустое значение скрипт не вставляет.
