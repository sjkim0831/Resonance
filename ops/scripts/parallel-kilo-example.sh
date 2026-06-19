#!/bin/bash
# 병렬 Kilo 실행 예제
# 방법 1: 간단한 백그라운드 실행

echo "=== 방법 1: 백그라운드 실행 ==="

# 각 터미널에서 실행할 명령을 &로 백그라운드 실행
kilo "Work on /emission/data_input - add 5 more sections" &
kilo "Work on /emission/report_submit - improve validation flow" &
kilo "Work on /monitoring/dashboard - add realtime widgets" &

wait  # 모두 완료까지 대기

echo ""
echo "=== 방법 2: xargs 병렬 실행 ==="

# 태스크 목록 파일
cat > /tmp/kilo-tasks.txt << 'TASKS'
Work on /emission/data_input
Work on /emission/report_submit
Work on /monitoring/dashboard
TASKS

# 3개 코어에서 병렬 실행
# cat /tmp/kilo-tasks.txt | xargs -P3 -I{} kilo "{}"

echo ""
echo "=== 방법 3:GNU parallel (설치 필요시) ==="
# seq 1 3 | parallel -j3 "kilo 'Task {}'"
