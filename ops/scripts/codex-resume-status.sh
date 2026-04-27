#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ACTIVE_DIR="$ROOT_DIR/docs/ai/60-operations/session-orchestration/active"

print_status_or_none() {
  if [[ $# -eq 0 ]]; then
    echo "(none)"
    return
  fi

  if git -C "$ROOT_DIR" status --short -- "$@" | grep -q .; then
    git -C "$ROOT_DIR" status --short -- "$@"
  else
    echo "(none)"
  fi
}

echo "== Carbonet Resume Status =="
echo "repo: $ROOT_DIR"
echo

echo "== Resume First =="
echo "1. Read docs/ai/60-operations/session-orchestration/active/ACTIVE_INDEX.md"
echo "2. Run bash ops/scripts/codex-admin-status.sh"
echo "3. Reopen the matching request folder"
echo "4. Stay inside the lane allowedPaths before editing"
echo

echo "== Active Request Folders =="
if find "$ACTIVE_DIR" -mindepth 1 -maxdepth 1 -type d | grep -q .; then
  find "$ACTIVE_DIR" -mindepth 1 -maxdepth 1 -type d | sort | sed "s|$ROOT_DIR/||"
else
  echo "(none)"
fi
echo

STATUS_DOC="$ROOT_DIR/docs/operations/admin-screen-implementation-status.md"
if [[ -f "$STATUS_DOC" ]]; then
  echo "== Remaining Route Scope =="
  awk '
    /^Scope:/ ||
    /^- 배출\/인증:/ ||
    /^- 거래:/ ||
    /^- 콘텐츠:/ ||
    /^- remaining admin routes total:/ ||
    /^- done:/ ||
    /^- in_progress:/ ||
    /^- not_started:/ { print }
  ' "$STATUS_DOC"
  echo
fi

echo "== Key Source Files In Play =="
print_status_or_none \
  .codex/skills/carbonet-ai-session-orchestrator/SKILL.md \
  docs/operations/account-relogin-continuity-playbook.md \
  docs/ai/60-operations/session-orchestration \
  data/full-stack-management/registry.json \
  frontend/src/app \
  frontend/src/features \
  frontend/src/lib \
  src/main/java \
  src/main/resources/egovframework/mapper \
  docs/sql
echo

echo "== Shared Conflict Watch =="
print_status_or_none \
  frontend/src/app/routes \
  frontend/src/lib/navigation \
  frontend/src/lib/api \
  src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml \
  ops/scripts/start-18000.sh
echo

echo "== Generated Runtime Asset Summary =="
generated_count="$(git -C "$ROOT_DIR" status --short -- src/main/resources/static/react-app | wc -l | tr -d ' ')"
echo "entries: $generated_count"
if [[ "$generated_count" != "0" ]]; then
  echo "source owner should remain the verification lane"
  echo "sample:"
  git -C "$ROOT_DIR" status --short -- src/main/resources/static/react-app | sed -n '1,12p'
fi
echo

echo "== Working Tree Counts =="
git -C "$ROOT_DIR" status --short | awk '
  BEGIN { modified=0; added=0; deleted=0; untracked=0 }
  {
    x=substr($0,1,1); y=substr($0,2,1);
    if (x=="?" && y=="?") { untracked++; next }
    if (x=="M" || y=="M") modified++;
    if (x=="A" || y=="A") added++;
    if (x=="D" || y=="D") deleted++;
  }
  END {
    printf "modified=%d added=%d deleted=%d untracked=%d\n", modified, added, deleted, untracked
  }'
echo

echo "== Full Working Tree =="
git -C "$ROOT_DIR" status --short
echo

for request_dir in "$ACTIVE_DIR"/*; do
  [[ -d "$request_dir" ]] || continue
  request_name="$(basename "$request_dir")"
  echo "== $request_name =="
  for file in README.md session-plan.md current-worktree.md handoff-latest.md; do
    path="$request_dir/$file"
    if [[ -f "$path" ]]; then
      echo "-- $file"
      sed -n '1,40p' "$path"
    else
      echo "-- $file missing"
    fi
    echo
  done
done
