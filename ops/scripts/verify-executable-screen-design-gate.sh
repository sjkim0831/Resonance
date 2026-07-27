#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -X -v ON_ERROR_STOP=1 -At)

read -r total designs duplicates bad_pass bad_sequence < <(
  "${PSQL[@]}" -F ' ' <<'SQL'
SELECT
  (SELECT count(*) FROM framework_executable_screen_design_gate),
  (SELECT count(*) FROM framework_page_design),
  (SELECT count(*) FROM (
     SELECT page_design_id FROM framework_executable_screen_design_gate
     GROUP BY page_design_id HAVING count(*)<>1
   ) x),
  (SELECT count(*) FROM framework_executable_screen_design_gate
   WHERE design_ready AND cardinality(blocker_codes)<>0),
  (SELECT count(*) FROM (
     SELECT global_sequence FROM framework_vertical_screen_design_map
     GROUP BY global_sequence HAVING count(*)<>1
   ) x);
SQL
)

[[ "$total" = "$designs" ]] || {
  echo "FAIL gate/page-design cardinality mismatch: gate=$total designs=$designs" >&2
  exit 1
}
[[ "$duplicates" = "0" ]] || { echo "FAIL duplicate gate identities=$duplicates" >&2; exit 1; }
[[ "$bad_pass" = "0" ]] || { echo "FAIL passing rows with blockers=$bad_pass" >&2; exit 1; }
[[ "$bad_sequence" = "0" ]] || { echo "FAIL duplicate vertical sequence=$bad_sequence" >&2; exit 1; }

"${PSQL[@]}" <<'SQL'
SELECT executable_status||'='||count(*)
FROM framework_executable_screen_design_gate
GROUP BY executable_status ORDER BY executable_status;
SELECT blocker||'='||count(*)
FROM framework_executable_screen_design_gate g,unnest(g.blocker_codes) blocker
GROUP BY blocker ORDER BY count(*) DESC,blocker;
SQL

echo "PASS executable screen design gate: screens=$total"
