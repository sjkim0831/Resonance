#!/usr/bin/env bash
set -euo pipefail
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DB="${POSTGRES_DB:-carbonet}"
USER_NAME="${POSTGRES_ADMIN_USER:-postgres}"
leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then leader="$pod"; break; fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[e4b-assets] writable PostgreSQL leader not found" >&2; exit 1; }
read -r duplicates broken selectable pages classified <<<"$(kubectl -n "$NAMESPACE" exec "$leader" -c patroni -- psql -h 127.0.0.1 -U "$USER_NAME" -d "$DB" -At -F ' ' -c "
SELECT
 (SELECT count(*) FROM framework_asset_canonical_map m JOIN framework_unified_asset a ON a.asset_id=m.duplicate_asset_id WHERE a.active_yn='Y'),
 (SELECT count(*) FROM framework_unified_asset_relation r LEFT JOIN framework_unified_asset s ON s.asset_id=r.source_asset_id LEFT JOIN framework_unified_asset t ON t.asset_id=r.target_asset_id WHERE r.active_yn='Y' AND (s.active_yn<>'Y' OR t.active_yn<>'Y')),
 (SELECT count(*) FROM framework_e4b_selectable_asset),
 (SELECT count(*) FROM framework_e4b_selectable_asset WHERE asset_type='PAGE'),
 (SELECT count(*) FROM framework_e4b_page_development_queue);" )"
[[ "$duplicates" == "0" ]] || { echo "[e4b-assets] active duplicates remain: $duplicates" >&2; exit 2; }
[[ "$broken" == "0" ]] || { echo "[e4b-assets] active relations reference inactive assets: $broken" >&2; exit 3; }
[[ "$pages" == "$classified" ]] || { echo "[e4b-assets] page classification mismatch: $pages/$classified" >&2; exit 4; }
echo "[e4b-assets] PASS selectable=$selectable pages=$pages active-duplicates=0 broken-relations=0"
