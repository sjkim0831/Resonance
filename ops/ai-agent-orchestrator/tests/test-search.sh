#!/bin/bash
# test-search.sh - Tests for search.sh and agent-search

set -euo pipefail

LIB="ops/ai-agent-orchestrator/lib/search.sh"
BIN="ops/ai-agent-orchestrator/bin/agent-search"
export SEARCH_CACHE_DIR=$(mktemp -d)
export SEARCH_TTL=60
export SEARCH_MAX=50

source "$LIB"
chmod +x "$BIN"

pass=0; fail=0
ok() { echo "[PASS] $1"; ((++pass)); }
err() { echo "[FAIL] $1"; ((++fail)); }

echo "=== search.sh tests ==="

# sha256
sha256sum --help > /dev/null 2>&1 && ok "sha256sum available" || err "sha256sum missing"

# cache key determinism
k1=$(_search_hash "foo:bar"); k2=$(_search_hash "foo:bar")
[[ "$k1" == "$k2" ]] && ok "cache key deterministic" || err "cache key deterministic"

# cache set/get
echo "data" | _search_set "t$$"
_search_hit "t$$" | grep -q "data" && ok "cache set/get" || err "cache set/get"

# TTL expiry
sleep 1
export SEARCH_TTL=1
_search_set "ttl$$"
sleep 2
! _search_hit "ttl$$" > /dev/null 2>&1 && ok "TTL expiry" || err "TTL expiry"
export SEARCH_TTL=60

# help
search_exec "" "." --help | grep -q "search_exec" && ok "help works" || err "help works"

# dry-run
search_exec "test" "." --dry-run | grep -q "rg.*test" && ok "dry-run" || err "dry-run"

# search (rg available?)
rg --version > /dev/null 2>&1 && ok "rg available" || err "rg missing"

# max results
out=$(search_exec "class" "." -m 5 2>&1 | grep -v Elapsed)
[[ $(echo "$out" | wc -l) -le 6 ]] && ok "max results" || err "max results"

# binary
$BIN --help | grep -q "search_exec" && ok "binary --help" || err "binary --help"

# clear cache
$BIN --clear-cache > /dev/null && ok "clear-cache" || err "clear-cache"

# atomic write (no .tmp left)
echo "x" | _search_set "atomic$$"
ls "${SEARCH_CACHE_DIR}/atomic$$.tmp"* 2>/dev/null && err "atomic write" || ok "atomic write"

echo ""
echo "Results: $pass passed, $fail failed"
rm -rf "$SEARCH_CACHE_DIR"
exit $((fail > 0 ? 1 : 0))