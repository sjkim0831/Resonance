# 전체 페이지 병렬 작업 Plan

## 목적
- 관리자/비관리자 페이지 구분 없이 전체 시스템 페이지 중 상세 작업이 안 된 페이지 파악
- 백엔드까지 포함하여 병렬 작업 진행
- 메뉴 자동 등록 포함

---

## 시스템 전체 페이지 현황

### Family별 라우트 수

| Family | 경로 수 | 위치 |
|--------|---------|------|
| adminSystemFamily | 81 | `/admin/system/*` |
| adminMemberFamily | 22 | `/admin/member/*` |
| emissionMonitoringFamily | 41 | `/emission/*`, `/monitoring/*`, `/co2/*` |
| homeExperienceFamily | 28 | `/edu/*`, `/join/*`, `/mypage/*`, `/mtn/*`, `/support/*` |
| tradePaymentFamily | 29 | `/trade/*`, `/payment/*`, `/certificate/*` |
| contentSupportFamily | 18 | `/admin/content/*`, `/support/*` |
| appOwnedFamily | 14 | `/home`, `/signin/*`, `/join/*` |
| aiManagementFamily | 8 | `/admin/ai/*` |
| **총합** | **241** | |

---

## 작업 방식

### 병렬 처리 방법
1. **터미널별 분할**: 각 에이전트를 서로 다른 터미널에서 실행
2. **xargs -P**: `seq 1 N | xargs -P{N} -I{} kilo "task {}"`
3. **GNU parallel**: `parallel -j{N} kilo ::: tasks`

### 필요 도구 설치
```bash
# GNU parallel 설치 (없을 경우)
sudo apt-get install -y parallel

# 또는 xargs 사용 (기본 내장)
seq 1 16 | xargs -P16 -I{} echo "Task {}"
```

---

## 페이지 분류

### Group 1: 배출량 관리 (emissionMonitoringFamily)
| ID | 경로 | 이름 | 구현 상태 |
|----|------|------|-----------|
| 1 | `/emission/data_input` | 데이터 입력 | ✅ 12개 섹션 완료 |
| 2 | `/emission/project_list` | 배출량 관리 | 확인 필요 |
| 3 | `/emission/dashboard` | 탄소 배출량 대시보드 | 확인 필요 |
| 4 | `/emission/report_submit` | 배출량 보고서 작성 | 확인 필요 |
| 5 | `/emission/reduction` | 감축 시나리오 | 확인 필요 |
| 6 | `/emission/lca` | LCA 분석 | 확인 필요 |
| 7 | `/emission/lci` | LCI DB 조회 | 확인 필요 |
| 8 | `/emission/simulate` | 시뮬레이션 | 확인 필요 |
| 9 | `/emission/validate` | 산정 검증 | 확인 필요 |
| 10 | `/monitoring/dashboard` | 통합 대시보드 | 확인 필요 |
| 11 | `/monitoring/realtime` | 실시간 모니터링 | 확인 필요 |
| 12 | `/monitoring/alerts` | 경보 현황 | 확인 필요 |
| 13 | `/monitoring/statistics` | ESG 보고서 | 확인 필요 |
| 14 | `/monitoring/share` | 이해관계자 공유 | 확인 필요 |
| 15 | `/monitoring/reduction_trend` | 성과 추이 분석 | 확인 필요 |
| 16 | `/monitoring/track` | 추적 리포트 | 확인 필요 |
| 17 | `/monitoring/export` | 분석 리포트 내보내기 | 확인 필요 |
| 18 | `/co2/production_list` | 생산 정보 | 확인 필요 |
| 19 | `/co2/demand_list` | 수요 정보 | 확인 필요 |
| 20 | `/co2/integrity` | 무결성 추적 | 확인 필요 |
| 21 | `/co2/credit` | 탄소 크레딧 | 확인 필요 |
| 22 | `/co2/analysis` | 품질 지표 | 확인 필요 |
| 23 | `/co2/search` | MRV 정보 | 확인 필요 |

### Group 2: 교육/회원 (homeExperienceFamily)
| ID | 경로 | 이름 |
|----|------|------|
| 24 | `/edu/course_list` | 교육과정 목록 |
| 25 | `/edu/my_course` | 나의 교육 |
| 26 | `/edu/progress` | 진도 관리 |
| 27 | `/edu/content` | 자격 연계 |
| 28 | `/edu/course_detail` | 과정 상세 |
| 29 | `/edu/apply` | 교육 신청 |
| 30 | `/edu/survey` | 설문조사 |
| 31 | `/edu/certificate` | 수료증 |
| 32 | `/join/step1-5` | 회원가입 위저드 |
| 33 | `/join/company*` | 회원사 등록 |
| 34 | `/mypage/*` | 마이페이지 (8개) |
| 35 | `/mtn/*` | 운영 (3개) |
| 36 | `/support/faq` | FAQ |
| 37 | `/support/inquiry` | 문의 내역 |
| 38 | `/support/notice_list` | 공지사항 |
| 39 | `/support/download_list` | 자료실 |

### Group 3: 거래/결제 (tradePaymentFamily)
| ID | 경로 | 이름 |
|----|------|------|
| 40 | `/trade/list` | 거래 목록 |
| 41 | `/trade/market` | 거래 시장 |
| 42 | `/trade/report` | 거래 리포트 |
| 43 | `/trade/buy_request` | 구매 요청 |
| 44 | `/trade/complete` | 체결 현황 |
| 45 | `/trade/auto_order` | 자동 매칭 |
| 46 | `/trade/sell` | 판매 등록 |
| 47 | `/trade/price_alert` | 가격 알림 |
| 48 | `/payment/pay` | 결제 요청 |
| 49 | `/payment/virtual_account` | 가상계좌 |
| 50 | `/payment/refund` | 결제 환불 |
| 51 | `/payment/refund_account` | 환불 계좌 |
| 52 | `/payment/notify` | 세금계산서 |
| 53 | `/payment/history` | 결제 내역 |
| 54 | `/payment/receipt` | 영수증 관리 |
| 55 | `/certificate/list` | 인증서 목록 |
| 56 | `/certificate/apply` | 인증서 신청 |
| 57 | `/certificate/report_list` | 보고서 및 인증서 목록 |
| 58 | `/certificate/report_form` | 보고서 작성 |
| 59 | `/certificate/report_edit` | 보고서 수정 |

### Group 4: 관리자 페이지 (adminSystemFamily + adminMemberFamily + aiManagementFamily)
| ID | 경로 | 이름 |
|----|------|------|
| 60 | `/admin/system/*` | 시스템 관리 (41개) |
| 61 | `/admin/member/*` | 회원 관리 (16개) |
| 62 | `/admin/content/*` | 콘텐츠 관리 (12개) |
| 63 | `/admin/ai/*` | AI 관리 (8개) |
| 64 | `/admin/emission/*` | 배출 관리 (14개) |
| 65 | `/admin/certificate/*` | 인증서 관리 (8개) |
| 66 | `/admin/trade/*` | 거래 관리 (4개) |
| 67 | `/admin/payment/*` | 결제 관리 (4개) |
| 68 | `/admin/external/*` | 외부 연동 (5개) |

---

## 작업 진행 방법

### Phase 1: 사전 준비 (Plan Mode → Execution Mode 전환 필요)
1. GNU parallel 설치
2. 모든 페이지 구현 상태 조사
3. 작업分组 구성

### Phase 2: 병렬 실행
```bash
# 예시: 16개 터미널에서 동시 실행
./run-parallel-work.sh --max-parallel=16 --groups=emission,trade,edu,admin
```

### Phase 3: 각 페이지 작업 내용
각 페이지마다:
1. **프론트엔드**: 컴포넌트 파일 확인/생성
2. **pageManifests.ts**: 컴포넌트 엔트리 확인/추가
3. **백엔드**: Controller, Service, Repository 확인/생성
4. **메뉴**: Bootstrap 클래스 확인/생성
5. **빌드**: `npm run build` 검증

---

## 현재 상태

| 항목 | 상태 |
|------|------|
| Plan Mode | ✅ 활성화됨 (읽기 전용) |
| 전체 라우트 수 | 241개 |
| 피처 디렉토리 | 222개 |
| 병렬 실행 가능? | ✅ 스크립트 준비됨 |
| 실제 실행 | ❌ Plan Mode 해제 후 가능 |

---

## 다음 단계

1. **Plan Mode 해제** (사용자가 직접 실행 모드로 전환)
2. **도구 설치**: `sudo apt-get install -y parallel`
3. **병렬 스크립트 실행**
4. **완료 후 통보**

---

## 스크립트 위치
- `/opt/Resonance/ops/scripts/parallel-page-work.sh` (템플릿)
- `/opt/Resonance/ops/scripts/parallel-kilo-example.sh` (예제)