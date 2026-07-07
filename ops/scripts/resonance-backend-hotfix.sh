#!/bin/bash
# Backend Hotfix Script - 코어 모듈 수정 후 빠른 배포
# 사용법: bash ops/scripts/resonance-backend-hotfix.sh <module-name>
# 예시: bash ops/scripts/resonance-backend-hotfix.sh carbonet-common-core

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${DEPLOYMENT:-carbonet-runtime}"

MODULE="${1:-}"
if [[ -z "$MODULE" ]]; then
    echo "사용법: $0 <module-name>"
    echo "  예시: $0 carbonet-common-core"
    echo "  가능한 모듈:"
    ls -d "$ROOT_DIR"/modules/resonance-*/carbonet-* 2>/dev/null | xargs -I{} basename {}
    exit 1
fi

# 모듈 경로 찾기
MODULE_PATH=""
for dir in "$ROOT_DIR"/modules/resonance-*/"$MODULE" "$ROOT_DIR"/modules/resonance-*-ops/*/"$MODULE"; do
    if [[ -d "$dir" ]]; then
        MODULE_PATH="$dir"
        break
    fi
done

if [[ -z "$MODULE_PATH" ]]; then
    log_warn "모듈을 찾을 수 없습니다: $MODULE"
    exit 1
fi

log "모듈 경로: $MODULE_PATH"

# JAR 파일명 결정 (artifactId 기반)
ARTIFACT_ID=$(grep -E "<artifactId>.*</artifactId>" "$MODULE_PATH/pom.xml" 2>/dev/null | head -1 | sed 's/.*<artifactId>\(.*\)<\/artifactId>.*/\1/')
VERSION=$(grep -E "<version>.*</version>" "$MODULE_PATH/pom.xml" 2>/dev/null | head -1 | sed 's/.*<version>\(.*\)<\/version>.*/\1/')
JAR_FILE="${ARTIFACT_ID}-${VERSION}.jar"

log "JAR 파일: $JAR_FILE"

# 1. 모듈 빌드
log "모듈 빌드 중..."
cd "$ROOT_DIR"
if ! mvn -pl "$MODULE_PATH" -am -Dmaven.test.skip=true package -q 2>&1; then
    log_warn "Maven 빌드 실패 - 전체 빌드 시도..."
    mvn -Dmaven.test.skip=true package -q 2>&1 | tail -10
fi

# 2. 빌드 결과 확인
BUILD_JAR=""
for ext in "" ".jar"; do
    candidate="$MODULE_PATH/target/${JAR_FILE}${ext}"
    if [[ -f "$candidate" ]]; then
        BUILD_JAR="$candidate"
        break
    fi
done

if [[ -z "$BUILD_JAR" ]]; then
    #jar 파일명이 다를 수 있음 - target에서 찾기
    BUILD_JAR=$(find "$MODULE_PATH/target" -name "*.jar" -type f | grep -v "original\|test" | head -1)
fi

if [[ -z "$BUILD_JAR" || ! -f "$BUILD_JAR" ]]; then
    log_warn "빌드 JAR을 찾을 수 없습니다"
    exit 1
fi

log_ok "빌드 완료: $(basename "$BUILD_JAR")"

# 3. image-context-sdui/lib/ 에 카피
TARGET_LIB="$ROOT_DIR/var/releases/P003/image-context-sdui/lib"
mkdir -p "$TARGET_LIB"
cp "$BUILD_JAR" "$TARGET_LIB/"

# 4. 현재 running pod의 lib 디렉토리에 직접 카피 (핫패치)
POD=$(kubectl -n "$NAMESPACE" get pod -l app=carbonet-runtime -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [[ -n "$POD" ]]; then
    log "Pod에 핫패치 적용: $POD"
    kubectl -n "$NAMESPACE" exec "$POD" -- mkdir -p /tmp/hotfix-lib
    kubectl -n "$NAMESPACE" exec "$POD" -- rm -f "/tmp/hotfix-lib/$(basename "$BUILD_JAR")"
    kubectl cp "$BUILD_JAR" "$NAMESPACE/$POD:/tmp/hotfix-lib/$(basename "$BUILD_JAR")"
    kubectl -n "$NAMESPACE" exec "$POD" -- sh -c "cp /tmp/hotfix-lib/$(basename "$BUILD_JAR") /app/lib/$(basename "$BUILD_JAR")"
    log_ok "핫패치 적용 완료"
else
    log_warn "실행 중인 Pod를 찾을 수 없음 - lib에만 카피됨"
fi

# 5. 상태 요약
echo ""
log_ok "=== 핫패치 완료 ==="
echo "  모듈: $MODULE"
echo "  JAR: $(basename "$BUILD_JAR")"
echo "  lib 경로: $TARGET_LIB/"
echo "  Pod: ${POD:-N/A}"
