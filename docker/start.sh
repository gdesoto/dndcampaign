#!/usr/bin/env sh
set -e

if [ -n "${STORAGE_LOCAL_ROOT:-}" ]; then
  mkdir -p "$STORAGE_LOCAL_ROOT"
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
