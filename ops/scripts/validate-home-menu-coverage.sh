#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-carbonet-prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"

primary_pod=""
while IFS= read -r pod; do
  [[ -n "$pod" ]] || continue
  recovery="$(kubectl -n "$NAMESPACE" exec "$pod" -c patroni -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
    'select pg_is_in_recovery();' 2>/dev/null || true)"
  if [[ "$recovery" == "f" ]]; then
    primary_pod="$pod"
    break
  fi
done < <(kubectl -n "$NAMESPACE" get pods -o name | sed 's#pod/##' | grep '^postgres-patroni-' || true)

if [[ -z "$primary_pod" ]]; then
  echo "[home-menu-coverage] PostgreSQL primary could not be located" >&2
  exit 1
fi

result="$(kubectl -n "$NAMESPACE" exec -i "$primary_pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F '|' <<'SQL'
WITH expected(root_code, middle_count, leaf_count) AS (
  VALUES ('H103',4,22),('H104',4,19),('H105',3,15),
         ('H106',4,17),('H107',3,16),('H108',3,11)
)
SELECT e.root_code,
       count(*) FILTER (WHERE length(m.menu_code)=6 AND m.use_at='Y' AND m.expsr_at='Y') AS visible_middle,
       e.middle_count,
       count(*) FILTER (WHERE length(m.menu_code)=8 AND m.use_at='Y' AND m.expsr_at='Y') AS visible_leaf,
       e.leaf_count,
       count(*) FILTER (WHERE length(m.menu_code) IN (6,8) AND m.use_at='Y' AND m.expsr_at='Y'
                         AND (m.menu_url IS NULL OR btrim(m.menu_url) IN ('','#'))) AS invalid_urls
FROM expected e
LEFT JOIN comtnmenuinfo m ON m.menu_code LIKE e.root_code || '%'
GROUP BY e.root_code,e.middle_count,e.leaf_count
ORDER BY e.root_code;
SQL
)"

printf '%s\n' "$result"
row_count="$(awk -F'|' 'NF==6 { count++ } END { print count+0 }' <<<"$result")"
if [[ "$row_count" -ne 6 ]]; then
  echo "[home-menu-coverage] expected six customer menu domains, received $row_count" >&2
  exit 1
fi
if awk -F'|' 'NF==6 && (($2+0)!=($3+0) || ($4+0)!=($5+0) || ($6+0)>0) { bad=1 } END { exit bad ? 0 : 1 }' <<<"$result"; then
  echo "[home-menu-coverage] incomplete hierarchy or invalid route detected" >&2
  exit 1
fi

echo "[home-menu-coverage] customer menu hierarchy verified"
