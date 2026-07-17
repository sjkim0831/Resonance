#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POSTGRES_POD="${POSTGRES_POD:-postgres-patroni-0}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-patroni}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"

result="$({
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F '|' -c \
      "select root_code,active_count,exposed_count,invalid_url_count from framework_admin_menu_integrity order by root_code;"
} 2>&1)" || {
  printf '%s\n' "$result" >&2
  echo "[menu-coverage] failed to query administrator menu integrity" >&2
  exit 1
}

printf '%s\n' "$result"

if awk -F'|' 'NF == 4 && ($4 + 0) > 0 { failed=1 } END { exit failed ? 0 : 1 }' <<<"$result"; then
  echo "[menu-coverage] active administrator menu nodes with invalid URLs detected" >&2
  exit 1
fi

if awk -F'|' 'NF == 4 && ($2 + 0) > 0 && ($3 + 0) == 0 { failed=1 } END { exit failed ? 0 : 1 }' <<<"$result"; then
  echo "[menu-coverage] an active administrator domain has no exposed nodes" >&2
  exit 1
fi

echo "[menu-coverage] administrator menu coverage verified"

