#!/usr/bin/env bash
set -euo pipefail
TESTDIR=$(cd "$(dirname "$0")" && pwd)
PSQL=(sudo -n -u postgres psql -h /opt/Resonance/runtime/postgresql16/socket -p 35433 -d carbonet -v ON_ERROR_STOP=1)
before=$("${PSQL[@]}" -Atc 'SELECT COALESCE(sum(request_count),0) FROM telemetry_technical_minute')
node "$TESTDIR/verify-rollup-requests.cjs"
after=$("${PSQL[@]}" -Atc 'SELECT COALESCE(sum(request_count),0) FROM telemetry_technical_minute')
delta=$((after-before))
echo "aggregateCountBefore=$before aggregateCountAfter=$after observedIncrease=$delta"
test "$delta" -ge 20
"${PSQL[@]}" -f "$TESTDIR/verify-rollup-db.sql"
