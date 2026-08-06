#!/usr/bin/env bash
set -euo pipefail

# Shared low-latency PostgreSQL query adapter for deployment validators.
# It prefers the HA NodePort selected by Patroni and falls back to kubectl exec
# when the host client or Secret is unavailable. Password material is retained
# only in the current process environment and is never printed or persisted.

carbonet_postgres_find_leader() {
  CARBONET_PG_MODE="kubectl"
  CARBONET_PG_LEADER=""
  while IFS= read -r pod; do
    if [[ "$(kubectl -n "$CARBONET_PG_NAMESPACE" exec "$pod" \
      -c "$CARBONET_PG_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$CARBONET_PG_USER" \
        -d "$CARBONET_PG_DATABASE" -Atqc \
        'select pg_is_in_recovery()' 2>/dev/null || true)" == f ]]; then
      CARBONET_PG_LEADER="$pod"
      return 0
    fi
  done < <(
    kubectl -n "$CARBONET_PG_NAMESPACE" get pods \
      -l app=postgres-patroni -o name 2>/dev/null | sed 's#^pod/##'
  )

  echo '[postgres-query] PostgreSQL leader is unavailable' >&2
  return 1
}

carbonet_postgres_query_init() {
  CARBONET_PG_NAMESPACE="${CARBONET_PG_NAMESPACE:-carbonet-prod}"
  CARBONET_PG_DATABASE="${POSTGRES_DB:-carbonet}"
  CARBONET_PG_USER="${POSTGRES_ADMIN_USER:-postgres}"
  CARBONET_PG_HOST="${CARBONET_PG_HOST:-127.0.0.1}"
  CARBONET_PG_PORT="${CARBONET_PG_PORT:-31432}"
  CARBONET_PG_SECRET="${CARBONET_PG_SECRET:-postgres-ha-secrets}"
  CARBONET_PG_SECRET_KEY="${CARBONET_PG_SECRET_KEY:-postgres-password}"
  CARBONET_PG_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
  CARBONET_PG_MODE="kubectl"
  CARBONET_PG_PASSWORD="${CARBONET_PG_PASSWORD:-}"
  CARBONET_PG_LEADER=""

  if command -v psql >/dev/null 2>&1; then
    if [[ -z "$CARBONET_PG_PASSWORD" ]]; then
      CARBONET_PG_PASSWORD="$(
        kubectl -n "$CARBONET_PG_NAMESPACE" get secret "$CARBONET_PG_SECRET" \
          -o "jsonpath={.data.${CARBONET_PG_SECRET_KEY}}" 2>/dev/null |
          base64 -d 2>/dev/null || true
      )"
    fi
    if [[ -n "$CARBONET_PG_PASSWORD" ]] && \
       [[ "${CARBONET_PG_DEFER_WRITABLE_CHECK:-false}" == "true" ]]; then
      # A caller may fold the writable-primary assertion into its own atomic
      # transaction. This removes a complete TLS/session round trip without
      # weakening the guard. The caller must invoke carbonet_postgres_find_leader
      # only for connection or explicit replica-guard failures.
      CARBONET_PG_MODE="direct"
      return 0
    fi
    if [[ -n "$CARBONET_PG_PASSWORD" ]] && \
       PGPASSWORD="$CARBONET_PG_PASSWORD" \
         psql -w -X -qAt \
           -h "$CARBONET_PG_HOST" -p "$CARBONET_PG_PORT" \
           -U "$CARBONET_PG_USER" -d "$CARBONET_PG_DATABASE" \
           -c 'select not pg_is_in_recovery()' 2>/dev/null |
         grep -qx t; then
      CARBONET_PG_MODE="direct"
      return 0
    fi
  fi
  carbonet_postgres_find_leader
}

carbonet_postgres_query() {
  local sql="${1:?SQL is required}"
  if [[ "$CARBONET_PG_MODE" == direct ]]; then
    PGPASSWORD="$CARBONET_PG_PASSWORD" \
      psql -w -X -qAt \
        -h "$CARBONET_PG_HOST" -p "$CARBONET_PG_PORT" \
        -U "$CARBONET_PG_USER" -d "$CARBONET_PG_DATABASE" \
        -c "$sql"
    return
  fi
  kubectl -n "$CARBONET_PG_NAMESPACE" exec "$CARBONET_PG_LEADER" \
    -c "$CARBONET_PG_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$CARBONET_PG_USER" \
      -d "$CARBONET_PG_DATABASE" -Atqc "$sql"
}
