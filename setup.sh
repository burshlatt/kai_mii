#!/bin/bash
# Ставит Docker, создаёт deadline/.env и записывает JWT_SECRET длиной от 16 символов.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
EXAMPLE="$ROOT/deadline/.env.example"
ENV_FILE="$ROOT/deadline/.env"
PLACEHOLDER="replace-with-a-long-random-string"

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "Docker уже установлен"
    return
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Автоустановка рассчитана на Ubuntu и Debian. Поставьте Docker Engine и плагин compose вручную, затем запустите ./setup.sh ещё раз." >&2
    exit 1
  fi
  echo "Устанавливаю Docker"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2
  sudo systemctl enable --now docker
  local target="${SUDO_USER:-$USER}"
  if [[ "$target" != "root" ]]; then
    sudo usermod -aG docker "$target"
    echo "Пользователь $target добавлен в группу docker. ./start.sh подхватит её в этом же терминале."
  fi
}

write_env() {
  if [[ ! -f "$EXAMPLE" ]]; then
    echo "Нет файла $EXAMPLE" >&2
    exit 1
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "Скопирован deadline/.env.example в deadline/.env"
  else
    echo "deadline/.env уже есть, остальные переменные не трогаю"
  fi

  local current=""
  if grep -q '^JWT_SECRET=' "$ENV_FILE"; then
    current="$(grep -E '^JWT_SECRET=' "$ENV_FILE" | head -n 1 | cut -d= -f2-)"
  fi
  if [[ -n "$current" && "$current" != "$PLACEHOLDER" && ${#current} -ge 16 ]]; then
    echo "JWT_SECRET уже задан, длина ${#current}"
    return
  fi

  local secret
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -hex 24)"
  else
    secret="$(od -An -tx1 -N 24 /dev/urandom | tr -d ' \n')"
  fi
  if [[ ${#secret} -lt 16 ]]; then
    echo "Не удалось собрать JWT_SECRET длиннее 16 символов" >&2
    exit 1
  fi
  if grep -q '^JWT_SECRET=' "$ENV_FILE"; then
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${secret}/" "$ENV_FILE"
  else
    printf '\nJWT_SECRET=%s\n' "$secret" >>"$ENV_FILE"
  fi
  echo "JWT_SECRET записан в deadline/.env, длина ${#secret}"
}

install_docker
write_env
echo "Дальше из корня репозитория: ./start.sh"
