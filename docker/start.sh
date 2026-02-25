#!/usr/bin/env sh
set -e

if [ -z "${NUXT_STORAGE_LOCAL_ROOT:-}" ] && [ -n "${STORAGE_LOCAL_ROOT:-}" ]; then
  export NUXT_STORAGE_LOCAL_ROOT="$STORAGE_LOCAL_ROOT"
fi

# Default container envs (runtime overrides still take precedence).
: "${NUXT_STORAGE_LOCAL_ROOT:=/data/storage}"
: "${DATABASE_URL:=file:/data/db/app.db}"
: "${RUN_MIGRATIONS:=1}"
export NUXT_STORAGE_LOCAL_ROOT DATABASE_URL RUN_MIGRATIONS

if [ -z "${NUXT_STORAGE_PROVIDER:-}" ] && [ -n "${STORAGE_PROVIDER_DEFAULT:-}" ]; then
  export NUXT_STORAGE_PROVIDER="$STORAGE_PROVIDER_DEFAULT"
fi

if [ -z "${NUXT_ELEVENLABS_API_KEY:-}" ] && [ -n "${ELEVENLABS_API_KEY:-}" ]; then
  export NUXT_ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY"
fi

if [ -z "${NUXT_ELEVENLABS_WEBHOOK_SECRET:-}" ] && [ -n "${ELEVENLABS_WEBHOOK_SECRET:-}" ]; then
  export NUXT_ELEVENLABS_WEBHOOK_SECRET="$ELEVENLABS_WEBHOOK_SECRET"
fi

if [ -z "${NUXT_ELEVENLABS_WEBHOOK_ID:-}" ] && [ -n "${ELEVENLABS_WEBHOOK_ID:-}" ]; then
  export NUXT_ELEVENLABS_WEBHOOK_ID="$ELEVENLABS_WEBHOOK_ID"
fi

if [ -n "${NUXT_STORAGE_LOCAL_ROOT:-}" ]; then
  mkdir -p "$NUXT_STORAGE_LOCAL_ROOT"
fi

if [ -n "${DATABASE_URL:-}" ]; then
  case "$DATABASE_URL" in
    file:*)
      db_path="${DATABASE_URL#file:}"
      if [ -n "$db_path" ]; then
        mkdir -p "$(dirname "$db_path")"
      fi
      ;;
  esac
fi

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
fi

exec node .output/server/index.mjs
