#!/usr/bin/env bash
set -euo pipefail
ROOT=${ROOT:-/opt/Resonance}
TESTDIR=$(cd "$(dirname "$0")" && pwd)
R=$ROOT/runtime/host-data/dev-runtime/certificate-verification/backend/runtime
M=$ROOT/runtime/host-data/build-repositories/maven-local/repository
L=$M/org/projectlombok/lombok/1.18.34/lombok-1.18.34.jar
OUT=$(mktemp -d /tmp/ccus-event-regression.XXXXXX)
trap 'rm -rf -- "$OUT"' EXIT
CP="$R/BOOT-INF/classes:$R/BOOT-INF/lib/*"
javac -encoding UTF-8 -cp "$CP:$L" -processorpath "$L" -d "$OUT" "$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/home/web/FrontendErrorReportController.java"
TESTCP="$OUT:$CP:$M/org/mockito/mockito-core/4.11.0/mockito-core-4.11.0.jar"
for dependency in byte-buddy byte-buddy-agent objenesis; do
  path=$(find "$M" -name "$dependency-*.jar" | sort -V | tail -1)
  TESTCP="$TESTCP:$path"
done
javac -encoding UTF-8 -cp "$TESTCP" -d "$OUT" "$TESTDIR/FrontendErrorReportRegression.java"
java -cp "$TESTCP" FrontendErrorReportRegression
NODE_PATH="$ROOT/projects/carbonet-frontend/source/node_modules" node "$TESTDIR/telemetry-transport-regression.cjs" "$ROOT/projects/carbonet-frontend/source/src/platform/telemetry/useTelemetryTransport.ts"
