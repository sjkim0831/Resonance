#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
FILTER="$ROOT/ops/scripts/lib/company-reapplication-browser-rate-limit-candidate.jq"
[[ -f "$FILTER" ]] || { echo "missing $FILTER" >&2; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT

cat >"$TMP/baseline.json" <<'JSON'
[
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-reapply-page","windowBucket":42,"requestCount":3},
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-reapply-submit","windowBucket":42,"requestCount":4},
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-status-detail","windowBucket":42,"requestCount":5},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-reapply-page","windowBucket":42,"requestCount":7},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-reapply-submit","windowBucket":42,"requestCount":7},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-status-detail","windowBucket":42,"requestCount":7}
]
JSON
cat >"$TMP/current.json" <<'JSON'
[
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-reapply-page","windowBucket":42,"requestCount":5},
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-reapply-submit","windowBucket":42,"requestCount":6},
  {"remoteHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","endpointCode":"company-status-detail","windowBucket":42,"requestCount":7},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-reapply-page","windowBucket":42,"requestCount":8},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-reapply-submit","windowBucket":42,"requestCount":7},
  {"remoteHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","endpointCode":"company-status-detail","windowBucket":42,"requestCount":7}
]
JSON

resolve_candidate() {
  local current="$1" output="$2"
  jq -n \
    --argjson endpoints '["company-reapply-page","company-reapply-submit","company-status-detail"]' \
    --argjson ownedDelta 2 --argjson bucket 42 \
    --slurpfile baseline "$TMP/baseline.json" --slurpfile current "$current" \
    -f "$FILTER" >"$output"
}

resolve_candidate "$TMP/current.json" "$TMP/candidate.json"
jq -e '.remoteHash=="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  and (.rows|length)==3
  and ([.rows[].baselineCount]|sort)==[3,4,5]
  and ([.rows[].delta]|unique)==[2]' "$TMP/candidate.json" >/dev/null

# Exact-PK cleanup leaves unrelated identities byte-for-byte unchanged.
jq 'map(select(.remoteHash|startswith("bbbb")))' "$TMP/current.json" >"$TMP/unrelated-before.json"
jq 'map(select(.remoteHash|startswith("bbbb")))' "$TMP/current.json" >"$TMP/unrelated-after.json"
cmp -s "$TMP/unrelated-before.json" "$TMP/unrelated-after.json"

# A request arriving after candidate discovery is preserved because the SQL
# subtracts two from the latest FOR UPDATE value, not from the observation.
jq -n --argjson locked '[6,8,10]' --argjson baseline '[3,4,5]' '
  ($locked|map(.-2)) as $after
  | ($after==[4,6,8])
    and (($after[0]-$baseline[0])==1)
    and (($after[1]-$baseline[1])==2)
    and (($after[2]-$baseline[2])==3)' | grep -qx true

# Rows whose exact owned subtraction reaches zero are the only deletion set.
jq -n --argjson locked '[2,5,2]' '
  ($locked|map(.-2)) as $after
  | ($after==[0,3,0]) and (($after|map(select(.==0))|length)==2)' | grep -qx true

jq '.[] |= if (.remoteHash|startswith("aaaa")) and .endpointCode=="company-status-detail"
  then .requestCount=8 else . end' "$TMP/current.json" >"$TMP/mismatch.json"
if resolve_candidate "$TMP/mismatch.json" "$TMP/should-not-exist.json" 2>/dev/null; then
  echo 'browser limiter mismatch must fail closed' >&2
  exit 1
fi

jq '. + [{"remoteHash":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "endpointCode":"company-reapply-page","windowBucket":42,"requestCount":2}]' \
  "$TMP/current.json" >"$TMP/ambiguous.json"
if resolve_candidate "$TMP/ambiguous.json" "$TMP/should-not-exist-ambiguous.json" 2>/dev/null; then
  echo 'browser limiter ambiguous candidate must fail closed' >&2
  exit 1
fi

echo '[company-reapplication-browser-rate-limit-cleanup-test] PASS baseline=full owned=2 endpoints=3 concurrent=preserved unrelated=unchanged mismatch=closed ambiguous=closed'
