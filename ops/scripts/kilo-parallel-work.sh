#!/bin/bash
#==============================================================================
# Kilo 병렬 작업 스크립트
# 사용법: ./kilo-parallel-work.sh [작업그룹] [병렬수]
# 예시: ./kilo-parallel-work.sh emission 8
#==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs/kilo-parallel-$(date +%Y%m%d_%H%M%S)"
TASK_LIST="$SCRIPT_DIR/task-list.txt"

mkdir -p "$LOG_DIR"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_step() { echo -e "${BLUE}[STEP]${NC} $1"; }
echo_done() { echo -e "${GREEN}[DONE]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 기본값
MAX_PARALLEL=${2:-4}
GROUP=${1:-all}

# 작업 그룹 정의
declare -A TASKS

# Group 1: 배출량 관리
TASKS[emission_01]="/emission/data_input:데이터 입력:12개 섹션 완료"
TASKS[emission_02]="/emission/project_list:배출량 관리"
TASKS[emission_03]="/emission/dashboard:탄소 배출량 대시보드"
TASKS[emission_04]="/emission/report_submit:배출량 보고서 작성"
TASKS[emission_05]="/emission/reduction:감축 시나리오"
TASKS[emission_06]="/emission/lca:LCA 분석"
TASKS[emission_07]="/emission/lci:LCI DB 조회"
TASKS[emission_08]="/emission/simulate:시뮬레이션"
TASKS[emission_09]="/emission/validate:산정 검증"

# Group 2: 모니터링
TASKS[monitoring_01]="/monitoring/dashboard:통합 대시보드"
TASKS[monitoring_02]="/monitoring/realtime:실시간 모니터링"
TASKS[monitoring_03]="/monitoring/alerts:경보 현황"
TASKS[monitoring_04]="/monitoring/statistics:ESG 보고서"
TASKS[monitoring_05]="/monitoring/share:이해관계자 공유"
TASKS[monitoring_06]="/monitoring/reduction_trend:성과 추이 분석"
TASKS[monitoring_07]="/monitoring/track:추적 리포트"
TASKS[monitoring_08]="/monitoring/export:분석 리포트 내보내기"

# Group 3: CO2
TASKS[co2_01]="/co2/production_list:생산 정보"
TASKS[co2_02]="/co2/demand_list:수요 정보"
TASKS[co2_03]="/co2/integrity:무결성 추적"
TASKS[co2_04]="/co2/credit:탄소 크레딧"
TASKS[co2_05]="/co2/analysis:품질 지표"
TASKS[co2_06]="/co2/search:MRV 정보"

# Group 4: 교육
TASKS[edu_01]="/edu/course_list:교육과정 목록"
TASKS[edu_02]="/edu/my_course:나의 교육"
TASKS[edu_03]="/edu/progress:진도 관리"
TASKS[edu_04]="/edu/content:자격 연계"
TASKS[edu_05]="/edu/course_detail:과정 상세"
TASKS[edu_06]="/edu/apply:교육 신청"
TASKS[edu_07]="/edu/survey:설문조사"
TASKS[edu_08]="/edu/certificate:수료증"

# Group 5: 회원
TASKS[member_01]="/mypage/profile:마이페이지"
TASKS[member_02]="/join/step1:회원가입 위저드"
TASKS[member_03]="/support/faq:FAQ"
TASKS[member_04]="/support/inquiry:문의 내역"
TASKS[member_05]="/support/notice_list:공지사항"

# Group 6: 거래/결제
TASKS[trade_01]="/trade/list:거래 목록"
TASKS[trade_02]="/trade/market:거래 시장"
TASKS[trade_03]="/trade/buy_request:구매 요청"
TASKS[trade_04]="/trade/complete:체결 현황"
TASKS[trade_05]="/trade/sell:판매 등록"
TASKS[trade_06]="/payment/pay:결제 요청"
TASKS[trade_07]="/payment/history:결제 내역"
TASKS[trade_08]="/certificate/list:인증서 목록"

# 작업 목록 생성
echo_step "작업 목록 생성 중..."
> "$TASK_LIST"

for key in "${!TASKS[@]}"; do
    echo "$key:${TASKS[$key]}" >> "$TASK_LIST"
done

TOTAL_TASKS=$(wc -l < "$TASK_LIST")
echo_done "총 ${TOTAL_TASKS}개 작업 준비됨"
echo ""
echo "Log directory: $LOG_DIR"
echo "Task list: $TASK_LIST"
echo "Max parallel: $MAX_PARALLEL"
echo ""

# 실제 사용법 안내
echo "=========================================="
echo "현재 스크립트 상태: 템플릿"
echo "=========================================="
echo ""
echo "병렬 실행을 위해 다음 중 하나를 선택:"
echo ""
echo "1. 다중 터미널 수동 실행 (권장)"
echo "   터미널 1: kilo 'Work on /emission/data_input'"
echo "   터미널 2: kilo 'Work on /emission/project_list'"
echo "   ..."
echo ""
echo "2. 단일 에이전트로 순차 작업"
echo "   kilo를 통해 하나씩 작업 진행"
echo ""
echo "3. 스크립트 수정 후 자동 실행"
echo "   kilo를 백그라운드로 실행하도록 수정 필요"
echo ""
echo "=========================================="
echo ""
echo "현재 나(에이전트)가 처리할 수 있는 작업:"
echo ""
echo "1. 특정 페이지 분석 및 구현"
echo "2. 공통 컴포넌트 생성"
echo "3. pageManifests.ts 업데이트"
echo "4. 빌드 검증"
echo ""
echo "작업할 페이지를指定해 주세요."
