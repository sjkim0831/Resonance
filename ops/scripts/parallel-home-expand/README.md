# Homepage 57 Pages Parallel Expansion

## 개요
57개 홈 페이지에 최대 기능/섹션을 추가하는 작업을 4개 배치로 순차 처리.
**16개 API 키를 각 배치마다 재사용** (1개 배치 = 16개 키 × 1회씩 사용)

## 처리 흐름
```
Batch 1 (16키 × 1회 = 16개 페이지)
    ↓
Batch 2 (16키 × 1회 = 16개 페이지)
    ↓
Batch 3 (16키 × 1회 = 16개 페이지)
    ↓
Batch 4 (9키 × 1회 = 9개 페이지)
```

## Batch 구성

### Batch 1 (16개) - 배출량 & 모니터링
| # | pageId | 경로 |
|---|--------|------|
| 1 | emission-dashboard | /emission/dashboard |
| 2 | emission-reduction | /emission/reduction |
| 3 | emission-lci | /emission/lci |
| 4 | emission-report-submit | /emission/report_submit |
| 5 | emission-lca | /emission/lca |
| 6 | emission-simulate | /emission/simulate |
| 7 | monitoring-dashboard | /monitoring/dashboard |
| 8 | monitoring-realtime | /monitoring/realtime |
| 9 | monitoring-alerts | /monitoring/alerts |
| 10 | monitoring-statistics | /monitoring/statistics |
| 11 | monitoring-share | /monitoring/share |
| 12 | monitoring-reduction-trend | /monitoring/reduction_trend |
| 13 | monitoring-track | /monitoring/track |
| 14 | monitoring-export | /monitoring/export |
| 15 | co2-production-list | /co2/production_list |
| 16 | co2-demand-list | /co2/demand_list |

### Batch 2 (16개) - CO2 & 거래 & 결제
| # | pageId | 경로 |
|---|--------|------|
| 1 | co2-integrity | /co2/integrity |
| 2 | co2-credit | /co2/credit |
| 3 | co2-analysis | /co2/analysis |
| 4 | co2-search | /co2/search |
| 5 | trade-list | /trade/list |
| 6 | trade-market | /trade/market |
| 7 | trade-report | /trade/report |
| 8 | trade-buy-request | /trade/buy_request |
| 9 | trade-complete | /trade/complete |
| 10 | trade-auto-order | /trade/auto_order |
| 11 | trade-sell | /trade/sell |
| 12 | trade-price-alert | /trade/price_alert |
| 13 | payment-pay | /payment/pay |
| 14 | payment-virtual-account | /payment/virtual_account |
| 15 | payment-refund | /payment/refund |
| 16 | payment-refund-account | /payment/refund_account |

### Batch 3 (16개) - 인증서 & 교육
| # | pageId | 경로 |
|---|--------|------|
| 1 | payment-notify | /payment/notify |
| 2 | certificate-list | /certificate/list |
| 3 | certificate-apply | /certificate/apply |
| 4 | certificate-report-list | /certificate/report_list |
| 5 | certificate-report-form | /certificate/report_form |
| 6 | certificate-report-edit | /certificate/report_edit |
| 7 | payment-history | /payment/history |
| 8 | payment-receipt | /payment/receipt |
| 9 | edu-course-list | /edu/course_list |
| 10 | edu-my-course | /edu/my_course |
| 11 | edu-progress | /edu/progress |
| 12 | edu-content | /edu/content |
| 13 | edu-course-detail | /edu/course_detail |
| 14 | edu-apply | /edu/apply |
| 15 | edu-survey | /edu/survey |
| 16 | edu-certificate | /edu/certificate |

### Batch 4 (9개) - 마이페이지 & 지원
| # | pageId | 경로 |
|---|--------|------|
| 1 | mypage | /mypage/profile |
| 2 | mypage-email | /mypage/email |
| 3 | mypage-notification | /mypage/notification |
| 4 | mypage-company | /mypage/company |
| 5 | my-inquiry | /mtn/my_inquiry |
| 6 | mtn-status | /mtn/status |
| 7 | support-faq | /support/faq |
| 8 | support-inquiry | /support/inquiry |
| 9 | download-list | /support/download_list |

## 사용법

### 방법 1: 한번에 57개 전체 실행 (순차)
```bash
cd /opt/Resonance
bash ops/scripts/parallel-home-expand/run-all.sh \
  <KEY_1> <KEY_2> ... <KEY_16>
```
**예상 시간: ~2-3시간 (57개 페이지 순차)**

### 방법 2: 4개 터미널에서 동시 실행 (병렬)
```bash
# 터미널 1
bash ops/scripts/parallel-home-expand/batch1.sh <KEY_1> ... <KEY_16>

# 터미널 2
bash ops/scripts/parallel-home-expand/batch2.sh <KEY_1> ... <KEY_16>

# 터미널 3
bash ops/scripts/parallel-home-expand/batch3.sh <KEY_1> ... <KEY_16>

# 터미널 4
bash ops/scripts/parallel-home-expand/batch4.sh <KEY_1> ... <KEY_9>
```
**예상 시간: ~30-45분 (4배치 동시)**

## 작업 내용 (각 페이지마다)
1. 페이지 디렉토리 분석
2. 기존 MigrationPage.tsx 읽기
3. 최대 15개 섹션 추가:
   - StatsWidget (통계 위젯)
   - TrendChart (추이 차트)
   - RecentAlerts (최근 알림)
   - QuickActions (빠른 작업)
   - DataTable (데이터 테이블)
   - Calendar (캘린더)
   - ExportPanel (내보내기)
   - 등등...
4. components/ 및 types/ 디렉토리 생성
5. pageManifests.ts 업데이트
6. TypeScript 빌드 확인

## 완료 후 작업
```bash
# 1. 빌드 확인
cd /opt/Resonance/projects/carbonet-frontend/source && npm run build

# 2. 배포
cd /opt/Resonance && sudo bash ops/scripts/resonance-k8s-build-deploy-80.sh --hot-reload
```

## 로그 및 결과
- Batch 1: `/tmp/batch1-work/`
- Batch 2: `/tmp/batch2-work/`
- Batch 3: `/tmp/batch3-work/`
- Batch 4: `/tmp/batch4-work/`

## 참고
- 이미 완료된 페이지 (emission-data-input, emission-project_list, emission-validate, emission-home-validate)는 건너뜀
- 각 세션은 독립적으로 API 키 사용
- 토큰/CPU 부하가 16개로 분산됨
