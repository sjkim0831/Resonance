#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
STORAGE_ROOT="${CARBONET_POSTGRES_STORAGE_ROOT:-/opt/resonance-data/postgresql}"
DATA_ROOT="$STORAGE_ROOT/patroni"
BACKUP_ROOT="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
DEPLOY_TIMER="${CARBONET_DEPLOY_TIMER:-carbonet-auto-deploy.timer}"

fail() {
  echo "[postgres-storage-guard] CRITICAL: $*" >&2
  systemctl stop "$DEPLOY_TIMER" 2>/dev/null || true
  exit 1
}

latest_valid_backup() {
  local pattern="$1" min_size="$2" candidate
  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    if gzip -t "$candidate" 2>/dev/null; then
      printf '%s\n' "$candidate"
      return 0
    fi
    echo "[postgres-storage-guard] WARN: skipping incomplete backup: $candidate" >&2
  done < <(find "$BACKUP_ROOT" -maxdepth 1 -type f -name "$pattern" -mmin -1440 -size "$min_size" \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-)
  return 1
}

[[ "$STORAGE_ROOT" == /opt/resonance-data/postgresql ]] || fail "unexpected storage root: $STORAGE_ROOT"
[[ -d "$DATA_ROOT" ]] || fail "Patroni data root is missing"

for boundary in "$STORAGE_ROOT" "$DATA_ROOT"; do
  owner="$(stat -c '%U:%G' "$boundary")"
  mode="$(stat -c '%a' "$boundary")"
  attrs="$(lsattr -d "$boundary" | awk '{print $1}')"
  [[ "$owner" == "root:root" ]] || fail "$boundary owner is $owner"
  [[ "$mode" == "755" ]] || fail "$boundary mode is $mode"
  [[ "$attrs" == *i* ]] || fail "$boundary is not immutable"
done

# Lock the two pod-specific mount boundaries. Keep pgroot itself mutable so
# Patroni can legitimately remove/recreate its data directory during a replica
# reinitialization, while broad cleanup cannot unlink the pod storage roots.
locked_ancestors=0
while IFS= read -r boundary; do
  attrs="$(lsattr -d "$boundary" | awk '{print $1}')"
  [[ "$attrs" == *i* ]] || fail "$boundary is not immutable"
  locked_ancestors=$((locked_ancestors + 1))
done < <(find "$DATA_ROOT" -mindepth 1 -maxdepth 1 -type d -print)
[[ "$locked_ancestors" -ge 3 ]] || fail "expected Patroni pod boundary locks are missing ($locked_ancestors/3)"

ready_members=0
while IFS= read -r pod; do
  [[ -n "$pod" ]] || continue
  marker="/home/postgres/pgdata/${pod}/pgroot/data/PG_VERSION"
  kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- test -s "$marker" \
    || fail "PostgreSQL control marker is missing on $pod"
  ready="$(kubectl -n "$NAMESPACE" get pod "$pod" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null || true)"
  [[ "$ready" == "true" ]] && ready_members=$((ready_members + 1))
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ "$ready_members" -ge 2 ]] || fail "Patroni quorum is not ready ($ready_members/3)"

latest_data_backup="$(latest_valid_backup 'carbonet-*.sql.gz' '+1M' || true)"
latest_role_backup="$(latest_valid_backup 'postgres-roles-*.sql.gz' '+100c' || true)"
[[ -n "$latest_data_backup" ]] || fail "no valid data backup from the last 24 hours"
[[ -n "$latest_role_backup" ]] || fail "no valid role backup from the last 24 hours"

# A failed guard deliberately pauses deployments. Once every storage boundary,
# quorum marker, and backup check is healthy again, recover the timer as well.
# Without this self-healing step a transient storage incident leaves automatic
# deployment disabled indefinitely even though the database is safe again.
if ! systemctl is-active --quiet "$DEPLOY_TIMER"; then
  systemctl start "$DEPLOY_TIMER" 2>/dev/null \
    || echo "[postgres-storage-guard] WARN: could not restart $DEPLOY_TIMER" >&2
fi

echo "[postgres-storage-guard] OK: boundaries, quorum, control markers, and backups verified"
