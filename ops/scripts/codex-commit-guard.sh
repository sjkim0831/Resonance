#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

MAX_FILE_MB="${CODEX_GIT_MAX_FILE_MB:-95}"
MAX_FILE_BYTES=$((MAX_FILE_MB * 1024 * 1024))
SECRET_REGEX='(ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9]{20,})'
DANGEROUS_PATH_REGEX='(^|/)(data/ai-runtime|var/ai-runtime|vector_db|vectors?|embeddings?)/|\.((sqlite3?)|db|db-wal|db-shm|faiss|hnsw|ann|index)$'

mapfile -d '' STAGED_PATHS < <(git diff --cached --name-only -z --diff-filter=ACMR)
if [[ "${#STAGED_PATHS[@]}" -eq 0 ]]; then
  exit 0
fi

fail=0
source_count=0
artifact_count=0

say_block() {
  printf 'codex-commit-guard: %s\n' "$*" >&2
}

for path in "${STAGED_PATHS[@]}"; do
  lower_path="$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')"

  if [[ "$path" == projects/carbonet-frontend/source/src/* ]]; then
    source_count=$((source_count + 1))
  fi
  if [[ "$path" == *src/main/resources/static/react-app/* ]]; then
    artifact_count=$((artifact_count + 1))
  fi

  if [[ "$lower_path" =~ $DANGEROUS_PATH_REGEX ]]; then
    say_block "blocked vector/db/runtime artifact: $path"
    fail=1
  fi

  size="$(git cat-file -s ":$path" 2>/dev/null || printf '0')"
  if [[ "$size" =~ ^[0-9]+$ ]] && (( size > MAX_FILE_BYTES )); then
    say_block "blocked oversized file (${size} bytes > ${MAX_FILE_MB}MB): $path"
    fail=1
  fi

  if [[ "$size" =~ ^[0-9]+$ ]] && (( size > 0 && size <= 5242880 )); then
    if git show ":$path" 2>/dev/null | LC_ALL=C grep -E -q "$SECRET_REGEX"; then
      say_block "blocked possible secret token in staged file: $path"
      fail=1
    fi
  fi
done

if (( source_count > 0 && artifact_count > 0 )) && [[ "${CODEX_ALLOW_MIXED_BUILD_COMMIT:-false}" != "true" ]]; then
  say_block "blocked mixed source + frontend build artifact commit"
  say_block "commit source first, then build artifacts separately; or set CODEX_ALLOW_MIXED_BUILD_COMMIT=true intentionally"
  fail=1
fi

if (( fail != 0 )); then
  say_block "commit rejected before it can reach GitHub"
  say_block "use git rm --cached <path> to remove files from the commit while keeping them on disk"
  exit 1
fi
