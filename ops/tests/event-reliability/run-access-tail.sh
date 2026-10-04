#!/usr/bin/env bash
set -euo pipefail
ROOT=/opt/Resonance
BASE=$ROOT/modules/resonance-common/carbonet-common-core/src/main/java
R=$ROOT/runtime/host-data/dev-runtime/certificate-verification/backend/runtime
M=$ROOT/runtime/host-data/build-repositories/maven-local/repository
L=$M/org/projectlombok/lombok/1.18.34/lombok-1.18.34.jar
OUT=$(mktemp -d /tmp/ccus-access-tail.XXXXXX)
trap 'rm -rf -- "$OUT"' EXIT
CP="$R/BOOT-INF/classes:$R/BOOT-INF/lib/*:$L:$M/org/mockito/mockito-core/4.11.0/mockito-core-4.11.0.jar"
for dep in byte-buddy byte-buddy-agent objenesis;do CP="$CP:$(find "$M" -name "$dep-*.jar" | sort -V | tail -1)";done
HERE=$(cd "$(dirname "$0")" && pwd)
SOURCE=${SOURCE:-$BASE/egovframework/com/platform/observability/service/AdminAccessHistoryPageService.java}
javac -encoding UTF-8 -cp "$CP" -processorpath "$L" -d "$OUT" "$SOURCE" "$BASE/egovframework/com/common/logging/FileRequestExecutionLogService.java" "$HERE/AccessHistoryTailRegression.java"
java -cp "$OUT:$CP" egovframework.com.common.logging.AccessHistoryTailRegression "$@"
if [ -n "${CLASS_OUT:-}" ];then mkdir -p "$CLASS_OUT";cp "$OUT/egovframework/com/platform/observability/service/AdminAccessHistoryPageService.class" "$CLASS_OUT/";fi
