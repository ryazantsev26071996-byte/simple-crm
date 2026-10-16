#!/usr/bin/env bash
set -euo pipefail

# Резервное копирование базы данных Supabase Simple CRM
#
# Способ 1 — автоматический (нужен supabase login + supabase link):
#   ./scripts/backup-db.sh
#
# Способ 2 — через явный URL (пароль из Supabase Dashboard → Project Settings → Database):
#   SUPABASE_DB_URL="postgresql://postgres:[ПАРОЛЬ]@db.tqtskuntdahnucuprbhs.supabase.co:5432/postgres" \
#   ./scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUPS_DIR="${SCRIPT_DIR}/../backups"
KEEP_LAST=8

EXCLUDE_SCHEMAS_SCHEMA="information_schema|pg_*|_analytics|_realtime|_supavisor|auth|etl|extensions|pgbouncer|realtime|storage|supabase_functions|supabase_migrations|cron|dbdev|graphql|graphql_public|net|pgmq|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault"
EXCLUDE_SCHEMAS_DATA="information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor"

# ── Проверка pg_dump ────────────────────────────────────────────────────────
PG_DUMP=""
for candidate in \
    /opt/homebrew/opt/libpq/bin/pg_dump \
    /usr/local/opt/libpq/bin/pg_dump \
    pg_dump \
    /usr/bin/pg_dump; do
  if [ -x "$candidate" ] || command -v "$candidate" &>/dev/null 2>&1; then
    PG_DUMP="$candidate"
    break
  fi
done

if [ -z "$PG_DUMP" ]; then
  echo ""
  echo "  pg_dump не найден. Установите клиентские инструменты PostgreSQL:"
  echo ""
  echo "    brew install libpq"
  echo "    echo 'export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\"' >> ~/.zshrc"
  echo "    source ~/.zshrc"
  echo ""
  exit 1
fi

# ── Строка подключения ──────────────────────────────────────────────────────
# Если задана SUPABASE_DB_URL — используем её (режим прямого подключения)
# Иначе получаем временные учётные данные через Supabase CLI

USE_ROLE_FLAG="--role postgres"   # нужен для cli_login_postgres
PGHOST_V="" PGPORT_V="" PGUSER_V="" PGPASS_V="" PGDB_V=""
CLI_URL=""

SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"

if [ -n "$SUPABASE_DB_URL" ]; then
  CLI_URL="$SUPABASE_DB_URL"
  # При прямом postgres-пользователе --role избыточен, но не вреден
elif command -v supabase &>/dev/null 2>&1; then
  echo "  Получаю учётные данные через supabase CLI..."
  DRYRUN="$(supabase db dump --linked --dry-run 2>&1)" || {
    echo "  Ошибка получения данных от CLI. Проверьте: supabase login && supabase link"
    exit 1
  }
  PGHOST_V="$(printf '%s' "$DRYRUN" | grep 'PGHOST='    | sed 's/.*PGHOST="\(.*\)"/\1/')"
  PGPORT_V="$(printf '%s' "$DRYRUN" | grep 'PGPORT='    | sed 's/.*PGPORT="\(.*\)"/\1/')"
  PGUSER_V="$(printf '%s' "$DRYRUN" | grep 'PGUSER='    | sed 's/.*PGUSER="\(.*\)"/\1/')"
  PGPASS_V="$(printf '%s' "$DRYRUN" | grep 'PGPASSWORD=' | sed 's/.*PGPASSWORD="\(.*\)"/\1/')"
  PGDB_V="$(printf '%s'   "$DRYRUN" | grep 'PGDATABASE=' | sed 's/.*PGDATABASE="\(.*\)"/\1/')"

  if [ -z "$PGHOST_V" ] || [ -z "$PGPASS_V" ]; then
    echo "  Не удалось получить данные через CLI. Запустите с явным URL:"
    echo "    SUPABASE_DB_URL=\"postgresql://postgres:[ПАРОЛЬ]@db.[REF].supabase.co:5432/postgres\" \\"
    echo "    ./scripts/backup-db.sh"
    exit 1
  fi
else
  echo ""
  echo "  Supabase CLI не найден и SUPABASE_DB_URL не задан."
  echo "  Укажите URL вручную:"
  echo ""
  echo -n "  DB URL (ввод скрыт): "
  read -rs CLI_URL
  echo ""
  [ -z "$CLI_URL" ] && echo "  URL не введён. Выход." && exit 1
fi

# ── Временная папка ─────────────────────────────────────────────────────────
STAMP="$(date '+%Y-%m-%d_%H-%M')"
TMP_DIR="${BACKUPS_DIR}/${STAMP}"
ARCHIVE="${BACKUPS_DIR}/crm-${STAMP}.sql.gz"
mkdir -p "$TMP_DIR"

run_pgdump() {
  local MODE="$1"; shift
  if [ -n "$CLI_URL" ]; then
    "$PG_DUMP" $USE_ROLE_FLAG "$@" "$CLI_URL"
  else
    PGPASSWORD="$PGPASS_V" "$PG_DUMP" \
      --host="$PGHOST_V" --port="$PGPORT_V" \
      --username="$PGUSER_V" --dbname="$PGDB_V" \
      --no-password \
      $USE_ROLE_FLAG "$@"
  fi
}

# ── Дамп схемы ─────────────────────────────────────────────────────────────
echo "  Дамп схемы..."
run_pgdump schema \
  --schema-only \
  --quote-all-identifier \
  --exclude-schema "$EXCLUDE_SCHEMAS_SCHEMA" \
  > "${TMP_DIR}/schema.sql" 2>/tmp/pgdump_err.txt || {
    cat /tmp/pgdump_err.txt
    rm -rf "$TMP_DIR"
    echo "  Ошибка дампа схемы. См. сообщение выше."
    exit 1
  }

# ── Дамп данных ────────────────────────────────────────────────────────────
echo "  Дамп данных..."
{
  echo "SET session_replication_role = replica;"
  run_pgdump data \
    --data-only \
    --quote-all-identifier \
    --exclude-schema "$EXCLUDE_SCHEMAS_DATA" \
    --exclude-table "auth.schema_migrations" \
    --exclude-table "storage.migrations" \
    --exclude-table "supabase_functions.migrations" \
    --schema "*" \
    --column-inserts --rows-per-insert 100000
  echo "RESET ALL;"
} > "${TMP_DIR}/data.sql" 2>/tmp/pgdump_err.txt || {
    cat /tmp/pgdump_err.txt
    rm -rf "$TMP_DIR"
    echo "  Ошибка дампа данных. См. сообщение выше."
    exit 1
  }

# ── Архивирование ───────────────────────────────────────────────────────────
cat "${TMP_DIR}/schema.sql" "${TMP_DIR}/data.sql" | gzip > "$ARCHIVE"
rm -rf "$TMP_DIR"

# ── Статистика ─────────────────────────────────────────────────────────────
SIZE="$(du -sh "$ARCHIVE" | cut -f1)"
echo ""
echo "  Готово: $(basename "$ARCHIVE")  ($SIZE)"

for TABLE in clients comments schedule work_schedule; do
  # Each data row is on its own line starting with tab+( inside the INSERT block
  COUNT="$(gunzip -c "$ARCHIVE" 2>/dev/null \
    | awk "/INSERT INTO \"public\"\\.\"${TABLE}\"/{found=1} found && /^\t\(/{c++} found && /;$/{found=0} END{print c+0}")"
  [ "${COUNT:-0}" -gt 0 ] && echo "    ${TABLE}: ${COUNT} строк"
done

# ── Ротация ─────────────────────────────────────────────────────────────────
ARCHIVES=()
while IFS= read -r -d '' f; do
  ARCHIVES+=("$f")
done < <(find "$BACKUPS_DIR" -maxdepth 1 -name "crm-*.sql.gz" -print0 | sort -z)

TOTAL="${#ARCHIVES[@]}"
if [ "$TOTAL" -gt "$KEEP_LAST" ]; then
  DEL=$(( TOTAL - KEEP_LAST ))
  for (( i=0; i<DEL; i++ )); do
    rm -f "${ARCHIVES[$i]}"
    echo "  Удалена старая копия: $(basename "${ARCHIVES[$i]}")"
  done
fi

echo ""
