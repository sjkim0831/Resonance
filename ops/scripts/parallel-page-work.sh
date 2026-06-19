#!/bin/bash
# 병렬 페이지 작업 스크립트
# 사용법: ./parallel-page-work.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
TASK_DIR="$SCRIPT_DIR/tasks"

mkdir -p "$LOG_DIR" "$TASK_DIR"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
echo_done() { echo -e "${GREEN}[DONE]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 작업 목록
TASKS=(
    "data_input:EmissionDataInput:7 sections expansion (Calendar, Factors, ScopeSummary, TrendChart, QualityMatrix, ValidationTracker, QuickExport)"
    "report_submit:EmissionReportSubmit:5 components (Hero, Steps, Scope1, Scope2, Guide)"
    "dashboard:EmissionDashboard:4 widgets (EmissionOverview, SiteDistribution, VerificationStatus, TrendAnalysis)"
)

# 병렬 실행
run_task() {
    local task_id=$1
    local component=$2
    local description=$3
    local log_file="$LOG_DIR/${task_id}.log"

    echo "[$task_id] Starting: $description"

    # Kilo를 백그라운드로 실행
    kilo <<TASK_EOF > "$log_file" 2>&1 &
TASK: $description

1. Review current $component implementation
2. Verify pageManifests.ts entries
3. Ensure build passes (npm run build)
4. Report findings

Exit when done.
TASK_EOF

    echo "[$task_id] Launched (PID: $!)"
}

# 메인 실행
echo_step "Starting parallel page work..."
echo "Tasks: ${#TASKS[@]}"
echo ""

for i in "${!TASKS[@]}"; do
    IFS=':' read -r task_id component description <<< "${TASKS[$i]}"
    run_task "$task_id" "$component" "$description" &
done

echo_done "All ${#TASKS[@]} tasks launched"
echo ""
echo "Waiting for completion..."
wait
echo ""
echo_done "All tasks completed!"
echo ""
echo "Logs: $LOG_DIR/"
ls -la "$LOG_DIR/" 2>/dev/null || echo "No logs yet"
