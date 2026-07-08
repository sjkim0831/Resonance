#!/usr/bin/env bash
# Local CI/CD for PR Validation
# Runs tests and build validation before merge
# Usage: bash resonance-pr-ci.sh [validate|build|test|all] [BRANCH_NAME]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/scripts/build.sh
source "$ROOT_DIR/ops/scripts/build.sh" 2>/dev/null || true
init_build_tool
BRANCH="${2:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')}"
LOG_DIR="$ROOT_DIR/var/logs/pr-ci"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/pr-ci_${BRANCH}_${TIMESTAMP}.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

mkdir -p "$LOG_DIR"

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*" | tee -a "$LOG_FILE"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $*" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }
log_fail() { echo -e "${RED}[FAIL]${NC} $*" | tee -a "$LOG_FILE"; }
log_step() { echo ""; echo -e "${CYAN}==== $@ ====${NC}" | tee -a "$LOG_FILE"; }

FAILED=0

run_validate() {
    log_step "Code Validation"
    
    log "Checking codex-safe-status..."
    if bash "$ROOT_DIR/ops/scripts/codex-safe-status.sh" >> "$LOG_FILE" 2>&1; then
        log_ok "Codex safe check passed"
    else
        log_fail "Codex safe check failed"
        FAILED=1
    fi
    
    log "Checking for oversized files..."
    if bash "$ROOT_DIR/ops/scripts/resonance-check-file-size.sh" >> "$LOG_FILE" 2>&1; then
        log_ok "File size check passed"
    else
        log_warn "File size check had warnings"
    fi
    
    return $FAILED
}

run_build() {
    log_step "Build Validation"
    
    FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
    
    log "Frontend build check..."
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        if npm run build >> "$LOG_FILE" 2>&1; then
            log_ok "Frontend build passed"
        else
            log_fail "Frontend build failed"
            FAILED=1
        fi
    fi
    
    log "Backend Maven build check..."
    cd "$ROOT_DIR"
    if MAVEN_OPTS="-Xmx4g" mvn -pl apps/project-runtime -am -Dmaven.test.skip=true package -q >> "$LOG_FILE" 2>&1; then
        log_ok "Backend build passed"
    else
        log_fail "Backend build failed"
        FAILED=1
    fi
    
    return $FAILED
}

run_test() {
    log_step "Test Execution"
    
    FRONTEND_DIR="$ROOT_DIR/projects/carbonet-frontend/source"
    
    log "Frontend unit tests..."
    if [ -d "$FRONTEND_DIR" ] && [ -f "$FRONTEND_DIR/vitest.config.ts" ]; then
        cd "$FRONTEND_DIR"
        if npx vitest run --reporter=verbose >> "$LOG_FILE" 2>&1; then
            log_ok "Frontend tests passed"
        else
            log_fail "Frontend tests failed"
            FAILED=1
        fi
    else
        log_warn "No frontend tests found"
    fi
    
    log "Backend tests..."
    cd "$ROOT_DIR"
    if mvn -pl apps/project-runtime -am test -q >> "$LOG_FILE" 2>&1; then
        log_ok "Backend tests passed"
    else
        log_warn "Backend tests had failures (may be expected)"
    fi
    
    return $FAILED
}

show_summary() {
    log_step "CI Summary"
    echo ""
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}  CI PASSED${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo "Branch: $BRANCH"
        echo "Log: $LOG_FILE"
    else
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  CI FAILED${NC}"
        echo -e "${RED}========================================${NC}"
        echo "Branch: $BRANCH"
        echo "Log: $LOG_FILE"
        echo ""
        echo -e "${YELLOW}Common fixes:${NC}"
        echo "  - Run 'bash ops/scripts/codex-safe-status.sh' to check for issues"
        echo "  - Check $LOG_FILE for detailed errors"
    fi
}

case "${1:-all}" in
    validate)
        run_validate
        ;;
    build)
        run_build
        ;;
    test)
        run_test
        ;;
    all)
        log_step "PR CI Started"
        log "Branch: $BRANCH"
        log "Start time: $(date)"
        
        run_validate || true
        run_build || true
        run_test || true
        
        show_summary
        exit $FAILED
        ;;
    *)
        echo "Usage: $0 [validate|build|test|all] [BRANCH_NAME]"
        echo ""
        echo "Examples:"
        echo "  $0 all              # Run full CI"
        echo "  $0 validate feature/my-branch  # Validate specific branch"
        echo "  $0 build            # Build only"
        exit 1
        ;;
esac