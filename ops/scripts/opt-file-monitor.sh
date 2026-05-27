#!/bin/bash
# /opt 폴더 파일 변경 모니터링 유틸
# 사용법: ./opt-file-monitor.sh [interval] [project-filter]

INTERVAL=${1:-5}
FILTER=${2:-""}

echo "=========================================="
echo "/opt 폴더 변경 모니터링 시작"
echo "Interval: ${INTERVAL}초"
echo "Filter: ${FILTER:-전체}"
echo "Ctrl+C로 종료"
echo "=========================================="

if command -v inotifywait &> /dev/null; then
    # inotifywait 사용 (실시간)
    INCLUDE_PATTERNS="*.java *.tsx *.ts *.xml *.yaml *.yml *.properties *.sql *.sh *.md"
    find /opt/Resonance -type d \( -name node_modules -o -name target -o -name .git -o -name dist \) -prune -o -type f \( -name "*.java" -o -name "*.tsx" -o -name "*.ts" -o -name "*.xml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.properties" -o -name "*.sql" -o -name "*.sh" -o -name "*.md" \) -print0 | xargs -0 -I {} inotifywait -e modify,create,delete {} 2>/dev/null &
    INOTIFY_PID=$!
    trap "kill $INOTIFY_PID 2>/dev/null" EXIT
    wait
else
    # watch + find 사용 (5초마다 갱신)
    while true; do
        clear
        echo "=========================================="
        echo "/opt 폴더 변경 모니터링 ($(date '+%Y-%m-%d %H:%M:%S'))"
        echo "=========================================="
        echo ""
        echo ">>> 최근 수정된 파일 (1일 이내) <<<"
        if [ -n "$FILTER" ]; then
            find /opt/Resonance -type f \( -name "*$FILTER*" \) -mtime -1 ! -path "*/.git/*" ! -path "*/node_modules/*" ! -path "*/target/*" 2>/dev/null | xargs -r ls -lart 2>/dev/null | tail -20
        else
            find /opt/Resonance -type f -mtime -1 ! -path "*/.git/*" ! -path "*/node_modules/*" ! -path "*/target/*" 2>/dev/null | xargs -r ls -lart 2>/dev/null | tail -20
        fi
        echo ""
        echo ">>> Git 수정 내역 (7일) <<<"
        cd /opt/Resonance && git log --oneline --since="7 days ago" | head -10
        sleep $INTERVAL
    done
fi