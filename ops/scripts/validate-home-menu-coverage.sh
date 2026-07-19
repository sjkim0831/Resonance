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
  VALUES ('H103',4,22),('H104',4,19),('H105',3,12),
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

empty_sections="$(kubectl -n "$NAMESPACE" exec "$primary_pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "select count(*) from comtnmenuinfo middle where middle.menu_code ~ '^H10[3-8][0-9]{2}$' and middle.use_at='Y' and middle.expsr_at='Y' and not exists (select 1 from comtnmenuinfo leaf where leaf.menu_code like middle.menu_code || '__' and length(leaf.menu_code)=8 and leaf.use_at='Y' and leaf.expsr_at='Y');")"
if [[ "$empty_sections" -ne 0 ]]; then
  echo "[home-menu-coverage] $empty_sections exposed sections have no menu items" >&2
  exit 1
fi

lca_routes="$(kubectl -n "$NAMESPACE" exec "$primary_pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "select count(*)||'|'||count(distinct menu_url)||'|'||count(*) filter(where menu_url <> '/emission/lca?menu='||menu_code) from comtnmenuinfo where menu_code like 'H103____' and length(menu_code)=8 and use_at='Y' and expsr_at='Y';")"
if [[ "$lca_routes" != "22|22|0" ]]; then
  echo "[home-menu-coverage] Product LCA menus are not uniquely workspace-bound: $lca_routes" >&2
  exit 1
fi

lca_design="$(kubectl -n "$NAMESPACE" exec "$primary_pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "select count(distinct b.menu_code) filter(where b.menu_code like 'H103%')||'|'||(select count(*) from framework_process_professional_scenario where process_code='LCA_EXECUTION' and case_status='READY') from framework_process_menu_binding b where b.process_code in ('LCA_EXECUTION','REDUCTION_EXECUTION');")"
if [[ "${lca_design%%|*}" -lt 27 || "${lca_design##*|}" -lt 5 ]]; then
  echo "[home-menu-coverage] Product LCA actor/process/test coverage is incomplete: $lca_design" >&2
  exit 1
fi

route_root="projects/carbonet-frontend/source/src/app/routes/families"
while IFS= read -r menu_url; do
  route_path="${menu_url%%\?*}"
  if ! grep -RqsF "koPath: \"$route_path\"" "$route_root"; then
    echo "[home-menu-coverage] visible customer menu has no registered route: $menu_url" >&2
    exit 1
  fi
done < <(kubectl -n "$NAMESPACE" exec "$primary_pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc \
  "select distinct menu_url from comtnmenuinfo where menu_code ~ '^H10[1-8][0-9]{4}$' and use_at='Y' and expsr_at='Y' order by 1;")

echo "[home-menu-coverage] customer menu hierarchy verified"
