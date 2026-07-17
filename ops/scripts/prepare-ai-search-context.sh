#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
REFERENCE_ROOT="${REFERENCE_ROOT:-/opt/reference}"
INDEX_ROOT="${AI_SEARCH_INDEX_ROOT:-$ROOT_DIR/var/ai-search-index}"
PROCESS_CODE="${1:?process code is required}"
STEP_CODE="${2:?step code is required}"
JOB_TYPE="${3:?job type is required}"
TARGET_PATH="${4:-}"
COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD)"
INDEX_VERSION="2"
KEY="$(printf '%s' "$INDEX_VERSION|$COMMIT|$PROCESS_CODE|$STEP_CODE|$JOB_TYPE|$TARGET_PATH" | sha256sum | cut -d' ' -f1)"
CACHE="$INDEX_ROOT/$KEY.context"
mkdir -p "$INDEX_ROOT"

if [ -s "$CACHE" ]; then
  printf '%s\n' "$CACHE"
  exit 0
fi

INDEX_BUILDER="${AI_PROJECT_INDEX_BUILDER:-$ROOT_DIR/ops/scripts/build-ai-project-index.sh}"
SNAPSHOT="$(ROOT_DIR="$ROOT_DIR" REFERENCE_ROOT="$REFERENCE_ROOT" AI_SEARCH_INDEX_ROOT="$INDEX_ROOT" bash "$INDEX_BUILDER")"
TERMS="$(printf '%s %s %s' "$PROCESS_CODE" "$STEP_CODE" "$TARGET_PATH" \
  | tr '[:upper:]/_.-' '[:lower:]    ' | tr ' ' '\n' \
  | awk 'length($0)>=4 && $0 !~ /^(projects|project|carbonet|frontend|source|features|feature|modules|module|admin|page|data|input|management|migration)$/' \
  | sort -u | paste -sd'|' -)"
TMP="$CACHE.tmp.$$"
{
  printf 'commit=%s\nprocess=%s\nstep=%s\ntype=%s\ntarget=%s\n' "$COMMIT" "$PROCESS_CODE" "$STEP_CODE" "$JOB_TYPE" "$TARGET_PATH"
  printf '\n[priority model]\n'
  printf 'Prefer end-to-end user value: authentication/tenant boundary -> project/task -> input/evidence -> quality -> submit/review -> calculate/report.\n'
  printf 'Reject thin-page completion: require actor action, state transition, permission, validation/error recovery, API/DB contract, responsive UI, and acceptance evidence.\n'
  printf '\n[indexed repository candidates: priority domain layer path]\n'
  if [ -n "$TERMS" ]; then
    grep -E -i "$TERMS" "$SNAPSHOT/repository.tsv" \
      | awk -F '\t' -v terms="$TERMS" 'BEGIN{n=split(terms,t,"|")} {s=tolower($0);h=0;for(i=1;i<=n;i++)if(index(s,t[i]))h++;print h "\t" $0}' \
      | sort -t $'\t' -k1,1nr -k2,2nr | head -n 100 | cut -f2- || true
  fi
  if [ -n "$TARGET_PATH" ] && [ -e "$ROOT_DIR/$TARGET_PATH" ]; then
    printf '%s\n' "$TARGET_PATH"
  fi
  printf '\n[indexed menu and route candidates]\n'
  if [ -n "$TERMS" ]; then
    grep -E -i "$TERMS" "$SNAPSHOT/routes.txt" \
      | awk -v terms="$TERMS" 'BEGIN{n=split(terms,t,"|")} {s=tolower($0);h=0;for(i=1;i<=n;i++)if(index(s,t[i]))h++;print h "\t" $0}' \
      | sort -t $'\t' -k1,1nr | head -n 80 | cut -f2- || true
  fi
  printf '\n[reference candidates]\n'
  if [ -n "$TERMS" ]; then
    grep -E -i "$TERMS" "$SNAPSHOT/references.txt" | head -n 80 || true
  fi
  printf '\n[required completeness check]\n'
  printf 'Before implementation identify: upstream screen, downstream screen, actor, project/tenant scope, happy path, empty/loading/error states, mobile behavior, backend endpoint, persisted state, and executable test.\n'
} | awk '!seen[$0]++' >"$TMP"
mv "$TMP" "$CACHE"
printf '%s\n' "$CACHE"
