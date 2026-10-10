#!/bin/bash
# Останавливает API и интерфейс, запущенные через ./start.sh
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
RUN="$ROOT/.run"

stop_group() {
  local pidfile="$1"
  local pid
  if [[ ! -f "$pidfile" ]]; then
    return
  fi
  pid="$(cat "$pidfile")"
  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill -- -"$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
    local i
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 0.2
    done
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 -- -"$pid" >/dev/null 2>&1 || kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "$pidfile"
}

stop_group "$RUN/api.pid"
stop_group "$RUN/web.pid"

if command -v docker >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  if [[ "${DEADLINE_DOCKER_GROUP:-}" != 1 ]] && getent group docker | awk -F: -v user="$USER" '$1=="docker"{n=split($4,members,","); for(i=1;i<=n;i++) if(members[i]==user) ok=1} END{exit ok?0:1}'; then
    exec sg docker -c "DEADLINE_DOCKER_GROUP=1 $(printf '%q' bash) $(printf '%q' "$ROOT/stop.sh")"
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if (cd "$ROOT/deadline" && docker compose ps -q) | grep -q .; then
    (cd "$ROOT/deadline" && docker compose down)
    echo "Контейнеры Docker остановлены."
  fi
fi

echo "API и интерфейс остановлены. Локальный PostgreSQL, если он был запущен, оставлен включённым."
