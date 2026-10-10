#!/bin/bash
# Поднимает PostgreSQL, демо-данные, API и интерфейс «Дедлайна».
# Остановка: Ctrl+C или ./stop.sh
set -euo pipefail
set -m

ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"
PGDATA="$ROOT/deadline/.pgdata"
API_PID=""
WEB_PID=""
STOPPED=0

mkdir -p "$RUN"

add_node_path() {
  if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return
  fi
  local dir
  for dir in "$HOME"/.local/node-v*/bin "$HOME"/.local/node/bin; do
    if [[ -x "$dir/npm" ]]; then
      export PATH="$dir:$PATH"
      return
    fi
  done
  echo "Node.js не найден. Ожидался каталог $HOME/.local/node-v22*/bin" >&2
  exit 1
}

pg_ctl_bin() {
  if [[ -x /usr/lib/postgresql/16/bin/pg_ctl ]]; then
    echo /usr/lib/postgresql/16/bin/pg_ctl
    return
  fi
  if command -v pg_ctl >/dev/null 2>&1; then
    command -v pg_ctl
    return
  fi
  echo "pg_ctl не найден" >&2
  exit 1
}

start_db() {
  local ctl
  ctl="$(pg_ctl_bin)"
  if [[ ! -d "$PGDATA" ]]; then
    echo "Нет кластера PostgreSQL: $PGDATA" >&2
    exit 1
  fi
  if "$ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "PostgreSQL уже запущен"
    return
  fi
  echo "Запускаю PostgreSQL"
  if ! "$ctl" -D "$PGDATA" -l "$PGDATA/server.log" start; then
    echo "Не удалось запустить PostgreSQL. Конец лога:" >&2
    tail -n 30 "$PGDATA/server.log" >&2 || true
    exit 1
  fi
}

ensure_deps() {
  local dir
  for dir in backend frontend; do
    if [[ ! -d "$ROOT/deadline/$dir/node_modules" ]]; then
      echo "Ставлю зависимости $dir"
      (cd "$ROOT/deadline/$dir" && npm ci)
    fi
  done
}

port_open() {
  curl -fsS --max-time 2 "$1" >/dev/null 2>&1
}

kill_group() {
  local pid="$1"
  if [[ -z "$pid" ]]; then
    return
  fi
  kill -- -"$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
}

cleanup() {
  if [[ "$STOPPED" -eq 1 ]]; then
    return
  fi
  STOPPED=1
  echo
  echo "Останавливаю API и интерфейс"
  kill_group "$API_PID"
  kill_group "$WEB_PID"
  rm -f "$RUN/api.pid" "$RUN/web.pid"
}

wait_http() {
  local url="$1"
  local name="$2"
  local i
  for i in $(seq 1 60); do
    if port_open "$url"; then
      return 0
    fi
    sleep 0.5
  done
  echo "$name не ответил: $url" >&2
  return 1
}

ensure_docker_access() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if [[ "${DEADLINE_DOCKER_GROUP:-}" == 1 ]]; then
    echo "Нет доступа к /var/run/docker.sock" >&2
    exit 1
  fi
  if getent group docker | awk -F: -v user="$USER" '$1=="docker"{n=split($4,members,","); for(i=1;i<=n;i++) if(members[i]==user) ok=1} END{exit ok?0:1}'; then
    echo "Текущий терминал ещё не в группе docker. Продолжаю в этой группе."
    exec sg docker -c "DEADLINE_DOCKER_GROUP=1 $(printf '%q' bash) $(printf '%q' "$ROOT/start.sh")"
  fi
  echo "Нет доступа к Docker. Запустите ./setup.sh" >&2
  exit 1
}

start_with_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Локального PostgreSQL нет, и команда docker не найдена." >&2
    echo "Запустите ./setup.sh, затем снова ./start.sh. База поднимется в контейнере, сайт будет на http://localhost:8080" >&2
    exit 1
  fi
  ensure_docker_access
  if [[ ! -f "$ROOT/deadline/.env" ]]; then
    echo "Нет deadline/.env. Запустите ./setup.sh" >&2
    exit 1
  fi
  echo "Локального PostgreSQL нет. Запускаю Docker: база будет в контейнере."
  echo "Интерфейс: http://localhost:8080"
  echo "Вход: bulat@mail.ru"
  echo "Пароль: 12345"
  echo "Остановка: Ctrl+C или ./stop.sh"
  (cd "$ROOT/deadline" && docker compose up --build)
}

if [[ ! -d "$PGDATA" ]]; then
  start_with_docker
  exit 0
fi

add_node_path

if port_open http://127.0.0.1:3001/api/health || port_open http://127.0.0.1:5173/; then
  echo "Порт 3001 или 5173 уже занят. Остановите прошлый запуск: ./stop.sh" >&2
  exit 1
fi

start_db
ensure_deps

echo "Заполняю демо-данные"
(cd "$ROOT/deadline/backend" && npm run seed)

echo "Запускаю API"
(
  cd "$ROOT/deadline/backend"
  npm run dev
) >"$RUN/api.log" 2>&1 &
API_PID=$!
echo "$API_PID" >"$RUN/api.pid"

echo "Запускаю интерфейс"
(
  cd "$ROOT/deadline/frontend"
  npm run dev
) >"$RUN/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >"$RUN/web.pid"

trap cleanup INT TERM

if ! wait_http http://127.0.0.1:3001/api/health "API"; then
  tail -n 40 "$RUN/api.log" >&2 || true
  cleanup
  exit 1
fi
if ! wait_http http://127.0.0.1:5173/ "Интерфейс"; then
  tail -n 40 "$RUN/web.log" >&2 || true
  cleanup
  exit 1
fi

cat <<'EOF'

Дедлайн запущен.
Интерфейс: http://localhost:5173
Проверка API: http://localhost:5173/api/health
Вход: bulat@mail.ru
Пароль: 12345

Остановка: Ctrl+C или ./stop.sh в другом терминале.
Логи: .run/api.log и .run/web.log
EOF

wait "$API_PID" "$WEB_PID" || true
cleanup
