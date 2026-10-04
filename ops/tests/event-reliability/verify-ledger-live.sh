#!/usr/bin/env bash
set -euo pipefail
TESTDIR=$(cd "$(dirname "$0")" && pwd)
PSQL=(sudo -n -u postgres psql -h /opt/Resonance/runtime/postgresql16/socket -p 35433 -d carbonet -v ON_ERROR_STOP=1)
before=$("${PSQL[@]}" -Atc 'SELECT COALESCE(sum(request_count),0) FROM telemetry_technical_minute')
node "$TESTDIR/verify-ledger-requests.cjs"
after=$("${PSQL[@]}" -Atc 'SELECT COALESCE(sum(request_count),0) FROM telemetry_technical_minute')
echo "aggregateBefore=$before aggregateAfter=$after increase=$((after-before))"
test "$((after-before))" -ge 20
"${PSQL[@]}" -f "$TESTDIR/verify-ledger-db.sql"
