#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LIMIT="${1:-20}"
[[ "$LIMIT" =~ ^[0-9]+$ ]] && (( LIMIT > 0 && LIMIT <= 200 )) || {
  echo "usage: $0 [limit:1-200]" >&2
  exit 2
}

source "$ROOT/ops/scripts/lib/carbonet-postgres-query.sh"
carbonet_postgres_query_init

SQL=$(cat <<SQL
select concat_ws('|',
  process_code,
  coalesce(completion_score,0)::text,
  concat(coalesce(passed_tests,0),'/',coalesce(test_count,0)),
  concat(coalesce(completed_tasks,0),'/',coalesce(required_tasks,0)),
  concat(coalesce(verified_artifacts,0),'/',coalesce(required_artifacts,0)),
  concat(coalesce(ready_screens,0),'/',coalesce(screen_contracts,0)),
  coalesce(next_action,'')
)
from framework_process_delivery_queue
where coalesce(next_action,'') <> 'COMPLETE'
   or coalesce(completion_score,0) < 100
order by
  case when coalesce(passed_tests,0) < coalesce(test_count,0) then 0 else 1 end,
  coalesce(completion_score,0),
  coalesce(required_tasks,0) - coalesce(completed_tasks,0) desc,
  process_code
limit $LIMIT
SQL
)

RESULT="$(carbonet_postgres_query "$SQL")"
if [[ -z "$RESULT" ]]; then
  echo "[professional-process-selector] COMPLETE incomplete=0"
  exit 0
fi

COUNT="$(wc -l <<<"$RESULT" | tr -d ' ')"
echo "process|score|tests|tasks|artifacts|screens|next_action"
printf '%s\n' "$RESULT"
echo "[professional-process-selector] READY incomplete_shown=$COUNT selected=$(head -n1 <<<"$RESULT" | cut -d'|' -f1)"
