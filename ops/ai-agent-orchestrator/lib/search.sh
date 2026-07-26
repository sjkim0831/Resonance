#!/bin/bash
# search.sh - rg search lib with cache, TTL, exclusions
# Usage: source search.sh && search_exec "query" [dir] [opts]

SEARCH_LIB_VERSION="1.0"
SEARCH_CACHE_DIR="${SEARCH_CACHE_DIR:-/tmp/agent-search-cache}"
SEARCH_TTL="${SEARCH_TTL:-3600}"
SEARCH_MAX="${SEARCH_MAX:-100}"

mkdir -p "$SEARCH_CACHE_DIR" 2>/dev/null || true

_search_hash() { printf '%s' "$1" | sha256sum | cut -d' ' -f1; }

_search_hit() {
  local key="${1:-}"
  local cache_file="${SEARCH_CACHE_DIR}/${key}"
  if [[ ! -f "$cache_file" ]]; then return 1; fi
  local age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
  if [[ $age -ge $SEARCH_TTL ]]; then rm -f "$cache_file"; return 1; fi
  cat "$cache_file"; return 0
}

_search_set() {
  local key="${1:-}"
  local cache_file="${SEARCH_CACHE_DIR}/${key}"
  local tmpfile="${cache_file}.tmp.$$"
  cat > "$tmpfile" && mv -f "$tmpfile" "$cache_file"
}

search_exec() {
  local query="${1:-}" dir="${2:-.}"
  local dry_run=false show_help=false
  local max_results=$SEARCH_MAX exclude_std=true
  shift; [[ -n "$query" ]] && shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run) dry_run=true; shift;;
      --help|-h) show_help=true; shift;;
      --max) max_results="$2"; shift 2;;
      --no-exclude) exclude_std=false; shift;;
      *) shift;;
    esac
  done
  if $show_help; then
    cat <<EOF
search_exec "query" [dir]

  --dry-run     show rg cmd only
  --help/-h    this help
  --max N      max results (default $SEARCH_MAX)
  --no-exclude skip standard exclusions

Env: SEARCH_CACHE_DIR SEARCH_TTL SEARCH_MAX
EOF
    return 0
  fi
  local key=$(_search_hash "${query}:${dir}")
  if ! $dry_run && _search_hit "$key" 2>/dev/null; then return 0; fi
  local rg_cmd=(rg -SM --vimgrep -m "$max_results")
  if $exclude_std; then
    rg_cmd+=(-g '!.git/*' -g '!node_modules/*' -g '!vendor/*' -g '!target/*' -g '!build/*' -g '!dist/*' -g '!coverage/*')
  fi
  rg_cmd+=("$query" "$dir")
  if $dry_run; then echo "rg ${rg_cmd[*]}"; return 0; fi
  local start_ms=$(date +%s%3N)
  local output; output=$("${rg_cmd[@]}" 2>/dev/null) || true
  local elapsed_ms=$(($(date +%s%3N) - start_ms))
  _search_set "$key" <<< "$output"
  echo "$output"
  echo "Elapsed: ${elapsed_ms}ms" >&2
}