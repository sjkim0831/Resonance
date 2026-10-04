#!/usr/bin/env bash
set -euo pipefail
ROOT=${ROOT:-/opt/Resonance}
TESTDIR=$(cd "$(dirname "$0")" && pwd)
BASE=$ROOT/modules/resonance-common/carbonet-common-core
R=$ROOT/runtime/host-data/dev-runtime/certificate-verification/backend/runtime
M=$ROOT/runtime/host-data/build-repositories/maven-local/repository
L=$M/org/projectlombok/lombok/1.18.34/lombok-1.18.34.jar
OUT=$(mktemp -d /tmp/ccus-idempotency-test.XXXXXX)
trap 'rm -rf -- "$OUT"' EXIT
CP="$R/BOOT-INF/classes:$R/BOOT-INF/lib/*:$L"
javac -encoding UTF-8 -cp "$CP" -processorpath "$L" -d "$OUT" \
 "$BASE/src/main/java/egovframework/com/common/trace/TraceContext.java" \
 "$BASE/src/main/java/egovframework/com/common/filter/RequestExecutionLoggingFilter.java" \
 "$BASE/src/main/java/egovframework/com/config/filter/FilterConfig.java" \
 "$BASE/src/main/java/egovframework/com/common/trace/FrontendTelemetryEvent.java" \
 "$BASE/src/main/java/egovframework/com/common/mapper/ObservabilityMapper.java" \
 "$BASE/src/main/java/egovframework/com/common/trace/TraceEventService.java" \
 "$BASE/src/main/java/egovframework/com/common/web/TelemetryController.java"
CP="$OUT:$CP:$M/org/mockito/mockito-core/4.11.0/mockito-core-4.11.0.jar"
for dep in byte-buddy byte-buddy-agent objenesis; do CP="$CP:$(find "$M" -name "$dep-*.jar" | sort -V | tail -1)"; done
javac -encoding UTF-8 -cp "$CP" -d "$OUT" "$TESTDIR/TelemetryIdempotencyRegression.java"
javac -encoding UTF-8 -cp "$CP" -d "$OUT" "$TESTDIR/SessionLedgerRegression.java"
java -cp "$CP" SessionLedgerRegression
java -cp "$CP" TelemetryIdempotencyRegression "$BASE/src/main/resources/egovframework/mapper/com/common/ObservabilityMapper.xml"
NODE_PATH="$ROOT/projects/carbonet-frontend/source/node_modules" node "$TESTDIR/telemetry-transport-regression.cjs" "$ROOT/projects/carbonet-frontend/source/src/platform/telemetry/useTelemetryTransport.ts"
