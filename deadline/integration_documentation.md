# CI, интеграции, мониторинг и логи

## CI

Файл `.github/workflows/ci.yml` в корне репозитория. GitHub не читает workflow из `deadline/.github`: каталог должен лежать рядом с `dz1` и `deadline`, иначе вкладка Actions пустая.

На push и pull request:

- backend: PostgreSQL 16 сервисом, `npm ci`, типы, Prettier, тесты, сборка, `npm audit --audit-level=high`;
- frontend: те же шаги без базы.

На push в `main`, после зелёных проверок, job `images` выполняет `docker compose build`. В этом шаге задан `JWT_SECRET`: без него compose останавливается на строке `${JWT_SECRET:?...}` ещё до сборки.

Деплой на этой же ветке делает `scripts/remote-deploy.sh`, если переменная репозитория `DEPLOY_ENABLED` равна `true` и заданы секреты `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. Скрипт копирует дерево в `/opt/deadline` на сервере (без `.env`, `.git` и `node_modules`) и там выполняет `docker compose up -d --build`. Образы в реестр не публикуются, поэтому на сервере собирается только что приехавшее дерево, а не `docker compose pull`. Файл `.env` на сервере уже должен лежать: секреты из GitHub в репозиторий не попадают. После подъёма контейнер API один раз запускает `node dist/monitor-cli.js --once` на `http://127.0.0.1:3001/api/health`.

Те же проверки, что в job backend и frontend, включая `npm audit --audit-level=high`, локально повторяет `sh scripts/ci.sh`. Шаги `npm ci` и `docker compose` в workflow идут из `deadline/backend`, `deadline/frontend` и `deadline`, потому что корень git — это весь учебный репозиторий, а не только приложение.

Конфигурацию workflow сначала набросал агент по требованиям «линт, тесты, сборка, аудит, образы на main». В файл попал сервис Postgres с healthcheck, потому что интеграционный тест без базы бессмысленен.

## OAuth 2

Провайдеры: Google и Яндекс ID. Код в `backend/src/oauth.ts` и маршрутах `app.ts`.

Как включить:

1. В кабинете провайдера создать приложение.
2. Redirect URI указать так, как его видит браузер: локально `http://localhost:5173/api/auth/oauth/<provider>/callback`, за nginx — origin сайта с тем же путём.
3. Положить client id и secret в `.env`. Не в код.
4. Открыть вход и нажать кнопку.

Поток: cookie `deadline_oauth_state` на 10 минут, сверка `state` постоянным временем, обмен code, профиль, поиск по паре провайдер+subject. Занятая паролем почта не привязывается сама.

Проверено без ключей: `GET /api/auth/oauth/google/start` отвечает 302 на `/login?error=oauth_unavailable`. Этот кейс есть в `backend/tests/api.test.ts`.

Успешный вход, повторный вход тем же subject, отмена, пустой code, битый state, занятая почта и отказ провайдера на обмен code прогнаны в `backend/tests/oauth.test.ts`. Тест подставляет свои client id и secret и отвечает на HTTP провайдера сам: Google `oauth2.googleapis.com/token` и `userinfo`, Яндекс `oauth.yandex.ru/token` и `login.yandex.ru/info`. После колбэка `GET /api/auth/me` отдаёт почту и имя из профиля. Боевых ключей в `.env` нет, поэтому браузер до кабинета Google или Яндекса в этом прогоне не доходил. Код обмена и создание сессии проверены на том же маршруте, который откроет браузер, когда ключи появятся.

Фронтенд ходит на `/api/auth/oauth/yandex/start` и `/api/auth/oauth/google/start` обычной ссылкой, не XHR, чтобы редирект провайдера вёл браузер.

## Аналитика

Яндекс Метрика. Номер — `VITE_METRIKA_ID` на сборке. Пусто: компонент `Metrika` ничего не вставляет, `track` и `trackPage` выходят сразу. Номер `0` или нечисло тоже не включается.

С номером вставляется загрузчик `https://mc.yandex.ru/metrika/tag.js`, вызывается `ym(id, 'init', ...)`, на смене маршрута уходит `hit`, на вход, регистрацию и изменения задания — `reachGoal`. Тест `frontend/src/test/analytics.test.ts` с номером `123456` проверяет адрес загрузчика, `init`, `hit` на `/assignments/new` и цель `assignment_created`. В `.env` номер пустой, поэтому в кабинет Метрики этот прогон ничего не отправлял: вызов `ym`, который ушёл бы в кабинет, зафиксирован в тесте.

События: `login`, `register`, `assignment_created`, `assignment_updated`, `assignment_deleted`.

Платежи не подключались. В продукте нет оплаты, шаг задания необязательный. Обязательные две интеграции — OAuth и аналитика.

## Мониторинг

`GET /api/health` без авторизации. Поле `db` равно `up`, если прошёл `SELECT 1`, иначе 503 и `down`.

В `docker-compose.yml` у API есть healthcheck на этот адрес. Сервис `monitor` — тот же образ, команда `node dist/monitor-cli.js`. Каждые 30 секунд он читает `http://api:3001/api/health`. Живой ответ пишется как `health ok` с `"alert":false`. Сеть, статус не 200 или `db` не `up` пишутся уровнем error как `health alert` с `"alert":true`. Это тревога в том же JSON-потоке, что и логи API (`docker compose logs monitor`). Правило решения лежит в `backend/src/monitor.ts` и покрыто `backend/tests/monitor.test.ts`: 200 и `db: up` — тишина, 503, `db: down` при 200 и обрыв соединения — тревога.

Ручной разовый прогон: `npm run monitor --prefix backend -- --once` при заданном `HEALTH_URL`. После деплоя тот же `--once` выполняется внутри контейнера API.

Живой API ответил `{"status":"ok","db":"up","uptimeSeconds":0}`, монитор вышел с кодом 0:

```text
{"level":30,"time":1791657244179,"pid":21612,"hostname":"bulat-ubuntu-24","alert":false,"url":"http://127.0.0.1:3001/api/health","ok":true,"status":200,"db":"up","reason":"ok","msg":"health ok"}
```

Закрытый порт `127.0.0.1:9` дал код 1 и тревогу:

```text
{"level":50,"time":1791657244254,"pid":21623,"hostname":"bulat-ubuntu-24","alert":true,"url":"http://127.0.0.1:9/api/health","ok":false,"status":null,"db":null,"reason":"fetch failed","msg":"health alert"}
```

Публичного адреса нет, отдельный UptimeRobot не заводился. Когда хост появится, внешняя проверка смотрит на тот же `/api/health` и тревожится на статус не 200. Критерий уже тот, что в мониторе.

## Логи

Сервер пишет JSON в stdout. Уровни pino: info для обычного запроса, warn для ожидаемых 4xx, error для 5xx и падения healthcheck. Тело запроса в лог не кладётся. Поля `password`, `token`, `cookie`, `authorization` в redact.

Централизованный сбор на одной машине — это stdout контейнера (`docker compose logs api`). Для нескольких машин тот же JSON забирает агент хостинга. Отдельный SaaS логов не подключался.

Промпт для разбора:

```text
Role: дежурный по API «Дедлайна».
Task: по фрагменту JSON-логов найди сбои.
Context: level 30 — обычный запрос, 40 — предупреждение, 50 — ошибка. Путь и статус важнее текста. Секреты не цитируй.
Format: список. Для каждой строки: клиентская это ошибка или серверная, что проверить первым.
```

На реальном фрагменте из прогона (логин 200, сводка 200, затем 401 на `/api/auth/me`) вывод такой: серверных ошибок нет. 401 — гость открыл интерфейс без cookie. Первым делом ничего чинить не нужно, если рядом нет всплеска 500.

## Оптимизация

Список заданий одного студента читается одним запросом с индексом по `(user_id, due_at)`. Отдельный поиск не нужен. Сводка — один `count filter`, не обход в приложении. Лимит тела JSON — 100 КБ, чтобы случайный большой комментарий не раздувал процесс.
