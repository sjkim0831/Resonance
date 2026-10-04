# CCUS 탄소배출 업무·화면 연계 설계 v2

2026-09-09 · 설계 초안 / 사용자 승인 대기 · 구현·배포·실제 업무 검증 완료 아님

## 1. 설계 근거와 범위

기준: CCUS_emission_work_order_20260909.json의 70개 항목, 메뉴/라우트 대조표, 연결 점검 B01~B08, 현재 대화의 사용자 요구. 제안요청서 원문 조항은 이번 설계에서 대조하지 않았으므로 RFP 적합성 확정본이 아니다. 법정 제출·보관 기간과 승인 의무도 임의로 확정하지 않는다.

|요구 ID|사용자 요구|적용|
|---|---|---|
|U01|전체 메뉴·숨은 화면 목록부터 작업|기존 번호 01~70 유지, 후보 경로도 삭제 금지|
|U02|등록은 프로젝트·사업장·기간 중심|03 등록 계약, 04 상세에서 후속 업무|
|U03|회사 사용자가 프로젝트 선택 후 업무 수행|조회와 입력/승인 권한 분리, 필요 시만 배정|
|U04|연계·기능·디자인·검증 누락 방지|공통 문맥·버전·상태·검증·5종 안내 동기화|

## 2. 실제 업무 순서

```text
프로젝트 목록
 ├─ 기존 프로젝트 선택 ─────────────────────┐
 └─ 새 프로젝트 → [사업장 없으면 원장 등록] → 프로젝트 등록
                                              ↓
                                        프로젝트 상세
                                              ↓
                       사업장·배출원·산정 범위/기준 확정
                                              ↓
                   직접 자료 입력 또는 자료 요청 → 담당자 입력
                                              ↓
                        품질검사 → 제출 → 접수/반려
                           ↑                  ↓
                           └── 보완 ←─────── 반려
                                              ↓
                           계수 매핑 → 산정 → 결과/근거
                                              ↓
                           검토 요청 → 승인 또는 반려
                              ↑                ↓
                           재검토 ← 재산정 ← 원자료 보완
                                              ↓ 승인
                                        확정·잠금
                                              ↓
                           보고서 → PDF·발급 원장 → 진위확인
                                              ↓
                          [해당할 때만 규제 제출·접수]
                                              ↓
                                    프로젝트 마감·차기 등록
```

기준정보 관리·업무 배정·내 업무·감사는 옆에서 지원하는 기능이다. 목록에 번호가 있다고 매번 모든 화면을 순서대로 통과시키지 않는다. LCI·제품 LCA·감축은 별도 선택 연계다.

## 3. 개발·검수 순서와 문턱

|순서|대상 번호|진입/완료 조건|
|---|---|---|
|1|01~04|프로젝트 선택·사업장 원장·최소 등록·상세 저장/재조회 연결|
|2|05~12|중복 경로 판정·관리자 운영·배출원/범위 버전|
|3|13~20|계수·단위·GWP·양식·검증 정책의 유효 버전 준비|
|4|21~36|자료→증빙→제출 스냅샷→접수/반려; 사업장 귀속 보존|
|5|37~43|계수 매핑·계산 근거→검토·확정; 사업장별 합계 검증|
|6|44~55|잠금 결과→보고서/PDF 원본→발급/진위→선택 제출|
|7|56~62|실제 결과 집계·마감·차기 복사·감사|
|8|63~70|선택 연계만 별도 검수; 본 업무 완료를 불필요하게 차단하지 않음|

## 4. 공통 화면·API 계약

- tenantId/createdBy/처리자는 서버 세션에서 결정한다. 클라이언트가 보낸 회사값으로 권한을 결정하지 않는다.
- 상세는 id 별칭을 지원하되 후속 업무는 projectId를 표준으로 사용한다. 사업장별 링크에는 siteId를 넣고 서버가 프로젝트 소속을 검사한다.
- 산정기간은 프로젝트에서 조회한다. 화면 URL의 기간값으로 계산 범위를 변경하지 않는다. 기간 변경은 영향을 받는 자료·결과를 먼저 제시한다.
- projectId 없는 업무 메뉴는 프로젝트 선택 화면을 제공하고 선택 후 원래 업무로 돌아간다. 빈 화면/임의 첫 프로젝트 선택 금지.
- 저장은 revision 기반 충돌 검사와 idempotencyKey를 사용한다. 성공 응답은 저장 ID·새 revision·처리 상태·안전한 nextAction을 반환한다. 실패 시 입력을 유지한다.
- nextAction은 actionCode/route/context를 가진다. returnTo는 내부 허용 경로만 받는다. 임의 외부 리다이렉트 금지.
- 등록은 사업장 1개 이상, 이름, 기간 필수. 보고연도는 필요 시 기간에서 파생하며 연도 경계 기간을 임의 차단하지 않는다. 보고 단위 제약은 적용 기준 화면에서 명시한다.
- 같은 회사의 해당 업무 조회 권한자에게 프로젝트 조회를 제공한다. 실제 입력/수정/승인은 각 기능 권한과 사업장 범위를 검사한다. 단순 공유만으로 승인을 허용하지 않는다.
- 업무 배정은 필요 시 사용한다. 특정 개인 미배정이어도 역할 권한으로 직접 업무 진행을 허용할지 서버 정책으로 명시하고, 기존 강제 배정 정책을 조용히 우회하지 않는다.

### 요청·응답 설계 예시 (목표 계약, 현재 API 보장 아님)

```json
{"request":{"name":"2026년 배출량","siteIds":[101,102],"periodStart":"2026-01-01","periodEnd":"2026-12-31","description":"","idempotencyKey":"uuid"},"response":{"projectId":"generated","revision":1,"status":"REGISTERED","nextAction":{"route":"/emission/project/detail","context":{"projectId":"generated"}}}}
```

현재 사업장 이름 기반 입력은 기존 호환 어댑터를 두고 ID 기준으로 전환한다. 기존 API 엔드포인트를 우선 재사용하되 필수조건·권한·DB 스키마를 함께 변경/검증한다. 문서의 목표 계약을 곧바로 현재 구현으로 표시하지 않는다.

## 5. 데이터/버전 설계

|개체|보존 값|불변/변경 원칙|
|---|---|---|
|Project|tenantId, name, siteIds, period, description, createdBy, revision|기본정보 변경 시 영향 분석|
|ProjectSite/Source|siteId, sourceId, 유효기간, 포함/제외, Scope|명칭이 아닌 ID 연결|
|BoundaryVersion|사업장/배출원·Scope·기준·제외 사유|계산에 사용한 버전 불변|
|ActivityRevision|project/site/source ID, 기간, 수량, 단위, 증빙, revision|수정은 새 revision|
|SubmissionSnapshot|원자료 revision, site/source/Scope/명칭, 증빙 해시|제출 당시 값을 보존; 현재 원장으로 덮어쓰기 금지|
|FactorMapping|activity snapshot, factorVersion, GWP/환산 버전, 근거|단위 차원 검증|
|CalculationSnapshot|입력 버전·사업장·Scope·계수·계산식·배출량·해시|합계=항목별 결과 합; 변경 시 새 run|
|Approval/Lock|대상 계산 버전, 의견, 실제 승인자, 잠금 해시|버전 바뀌면 재검토|
|Report/Certificate|lockedResultId, templateVersion, 원본 bytes, SHA256, 상태|발급 원본 불변; 취소는 상태/이력|
|Audit/Outbox|actor, action, target/version, 결과, correlationId|민감 원문/비밀정보 제외; 보관 정책 별도|

### 기존 데이터 변경 시 주의

사업장 없는 과거 제출·계산 데이터를 현재 자료와 이름만으로 추정 매핑하지 않는다. 확실한 연결만 이관하고 나머지는 귀속 확인 필요로 분리한다. 이관 전 백업·리허설·건수/합계 대조를 수행한다.

## 6. B01~B08 해결 설계

|문제|설계 조치|검증|
|---|---|---|
|B01 등록 필수조건|등록과 산정 준비 분리; 담당자/Scope는 등록 필수 아님|최소 등록 성공·범위 없는 계산 실패|
|B02 결과 SQL|accepted 입력 DTO/CTE가 snapshot siteId를 명시적으로 투영|빈 결과·실제 결과 조회 모두 SQL 성공|
|B03 스냅샷 귀속|제출·계산 snapshot에 site/source/Scope·버전 보존|원자료 수정 후 과거 결과 불변|
|B04 중복검사|site/source/period/항목/측정구분 기준; 파일 중복은 별도|A/B사업장 동일월 전력 허용·동일원본 재저장 차단|
|B05 완료 링크|단일 라우트 레지스트리에서 nextAction 생성|완료 클릭 후 동일 projectId 유지|
|B06 미산정 표시|NOT_CALCULATED/LOADING/ERROR/CALCULATED 구분|실제0과 미산정이 다른 표시|
|B07 유령 경로|09→04, 50→49 통합 후보; 승인 전 삭제 금지|메뉴·직접 URL·안내 링크 동기화|
|B08 사업장 인계|siteId 수신·소속 검사·필터·뒤로가기 유지|다사업장 왕복 및 다른 회사 siteId 거절|

## 7. 화면별 상세 계약 (번호 유지)

### 01. 배출량 프로젝트 목록

- 화면: [/emission/project_list](http://172.16.1.232/emission/project_list)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 프로젝트명·사업장·산정기간·상태, 검색/필터; 생성자와 현재 처리상태 표시
- 기능: 조회·선택·신규 등록; 미산정은 0이 아닌 미산정
- 저장: 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: projectId는 선택 후 확보
- 다음: 03, 04
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 02. 사업장·배출원 원장

- 화면: [/admin/emission/site-management](http://172.16.1.232/admin/emission/site-management)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 사업장 코드·명칭·회사·주소·활성 상태·유효기간; 시설/배출원 연결
- 기능: 신규 등록·수정·비활성화; 참조 중 사업장 물리 삭제 금지
- 저장: 사업장 원장 revision
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사 ID는 세션에서 결정
- 다음: 03, 11
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 03. 프로젝트 등록

- 화면: [/emission/project/create](http://172.16.1.232/emission/project/create)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 프로젝트명(필수), 회사(자동), 참여 사업장 그리드(1개 이상), 산정 시작·종료일(필수), 설명(선택)
- 기능: 검색·복수 선택·저장·취소; 등록 시 담당자·결재자·Scope·목표·마감일 필수 없음
- 저장: 프로젝트 + 사업장 관계 + 생성 이력 원자 저장
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 중복요청 키·활성 사업장·기간; 서버가 생성자 기록
- 다음: 04
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 04. 프로젝트 상세

- 화면: [/emission/project/detail](http://172.16.1.232/emission/project/detail)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 기본정보·참여 사업장 표·사업장별 입력/검토/산정 현황·관련 업무·이력
- 기능: 사업장 선택→관련 업무; 미산정/오류/실제0 구분; 수정은 권한자만
- 저장: 편집 저장 시 projectRevision 검사
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: projectId; 사업장별 진입 시 siteId
- 다음: 11, 22, 37, 38, 45, 57
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 05. 프로세스 진행

- 화면: [/emission/project/progress](http://172.16.1.232/emission/project/progress)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 인증 회사, 접근 권한, 프로젝트명, 활성 사업장 목록, 산정기간
- 기능: 단계 현황·다음 업무; 상세와 중복 통합 여부 확인
- 저장: 프로젝트·사업장 준비 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사·사업장 소속 일치, 사업장 1개 이상, 시작일≤종료일
- 다음: 04
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 06. 프로젝트 포트폴리오

- 화면: [/emission/project-portfolio](http://172.16.1.232/emission/project-portfolio)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 인증 회사, 접근 권한, 프로젝트명, 활성 사업장 목록, 산정기간
- 기능: 여러 프로젝트 비교; 목록과 기능 차이 확인
- 저장: 프로젝트·사업장 준비 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사·사업장 소속 일치, 사업장 1개 이상, 시작일≤종료일
- 다음: 01, 04
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 07. 관리자 프로젝트 운영

- 화면: [/admin/emission/project-operations](http://172.16.1.232/admin/emission/project-operations)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 인증 회사, 접근 권한, 프로젝트명, 활성 사업장 목록, 산정기간
- 기능: 전체 회사 운영·제출·지연·승인 현황; menuCode별 기능 구분 검증
- 저장: 프로젝트·사업장 준비 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사·사업장 소속 일치, 사업장 1개 이상, 시작일≤종료일
- 다음: 04, 35, 55
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 08. 프로젝트 사전 설정

- 화면: [/admin/emission/project-prerequisites](http://172.16.1.232/admin/emission/project-prerequisites)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 인증 회사, 접근 권한, 프로젝트명, 활성 사업장 목록, 산정기간
- 기능: 회사·사업장 준비 상태; 담당자 미지정만으로 등록 차단하지 않도록 검토
- 저장: 프로젝트·사업장 준비 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사·사업장 소속 일치, 사업장 1개 이상, 시작일≤종료일
- 다음: 02, 03
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전

### 09. 프로젝트 설정 후보

- 화면: [/emission/project/settings](http://172.16.1.232/emission/project/settings)
- 역할: 회사 내 프로젝트 조회/관리 권한자
- 표시/입력: 인증 회사, 접근 권한, 프로젝트명, 활성 사업장 목록, 산정기간
- 기능: DB 화면 등록만 확인; 전용 소스 경로 미발견, 상세 편집으로 통합 우선 검토
- 저장: 프로젝트·사업장 준비 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: projectId, projectRevision, siteIds, periodStart, periodEnd
- 선행/검증: 회사·사업장 소속 일치, 사업장 1개 이상, 시작일≤종료일
- 다음: 04
- 상태: DRAFT → REGISTERED; 설계 초안·구현 검증 전
- 통합 후보: 4번. 기존 URL은 안전한 호환 이동, 삭제는 컨펌 후.

### 10. 배출 정의 관리

- 화면: [/admin/emission/definition-studio](http://172.16.1.232/admin/emission/definition-studio)
- 역할: 배출원·경계 설정 권한자 / 필요 시 검토자
- 표시/입력: projectId, siteId, 배출시설/배출원, 포함/제외 사유, Scope, 조직경계, 기준 버전
- 기능: 시설·배출원·연료·에너지·물질·Scope·단위 기준; menuCode별 하위 기능 점검
- 저장: 사업장 배출원·산정 범위 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: boundaryVersionId, sourceIds, scopeSet, methodologyVersionId
- 선행/검증: 참여 사업장별 배출원 누락 확인, 제외 사유, 적용 기준 확정
- 다음: 11, 13
- 상태: BOUNDARY_DRAFT → BOUNDARY_READY; 설계 초안·구현 검증 전

### 11. 조직경계·사업장별 범위 설정

- 화면: [/emission/organizational-boundary](http://172.16.1.232/emission/organizational-boundary)
- 역할: 배출원·경계 설정 권한자 / 필요 시 검토자
- 표시/입력: 사업장·시설·배출원, Scope 분류, 포함 여부·제외 사유, 조직경계 기준·적용 방법
- 기능: 임시저장·전체 사업장 누락 검사·범위 확정; 변경 시 영향 안내
- 저장: 불변 boundaryVersion + 배출원 관계
- 출력: boundaryVersionId, sourceIds, scopeSet, methodologyVersionId
- 선행/검증: 등록 완료; 기존 자료/계산에 영향이 있으면 새 버전
- 다음: 21, 22
- 상태: BOUNDARY_DRAFT → BOUNDARY_READY; 설계 초안·구현 검증 전

### 12. 조직경계 검토

- 화면: [/admin/emission/organizational-boundary](http://172.16.1.232/admin/emission/organizational-boundary)
- 역할: 배출원·경계 설정 권한자 / 필요 시 검토자
- 표시/입력: projectId, siteId, 배출시설/배출원, 포함/제외 사유, Scope, 조직경계, 기준 버전
- 기능: 경계·통합 기준 검토; 사용자 설정과 동일 프로젝트 연결
- 저장: 사업장 배출원·산정 범위 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: boundaryVersionId, sourceIds, scopeSet, methodologyVersionId
- 선행/검증: 참여 사업장별 배출원 누락 확인, 제외 사유, 적용 기준 확정
- 다음: 11, 21, 22
- 상태: BOUNDARY_DRAFT → BOUNDARY_READY; 설계 초안·구현 검증 전

### 13. 배출계수 관리

- 화면: [/admin/emission/factor-management](http://172.16.1.232/admin/emission/factor-management)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 계수·단위·적용연도·출처·유효기간 관리
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 37
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 14. ecoinvent 계수 관리

- 화면: [/admin/emission/ecoinvent](http://172.16.1.232/admin/emission/ecoinvent)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 필요한 경우 외부 계수 검색·선택·버전 확인
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 13, 37
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 15. 산정식 관리

- 화면: [/admin/emission/calculation-rule](http://172.16.1.232/admin/emission/calculation-rule)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 계수·활동량·단위 환산 계산 규칙 관리
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 37
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 16. GWP 값 관리

- 화면: [/admin/emission/gwp-values](http://172.16.1.232/admin/emission/gwp-values)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 가스별 적용 기준·버전 관리
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 37
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 17. 배출 변수 관리

- 화면: [/admin/emission/management](http://172.16.1.232/admin/emission/management)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 변수·사업장·프로젝트 연결; 현황 메뉴와 주소 혼용 점검
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 10, 37
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 18. 입력 양식 관리

- 화면: [/admin/emission/input-template](http://172.16.1.232/admin/emission/input-template)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 입력 항목·필수값·단위·파일 양식
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 22, 24
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 19. 검증 규칙 관리

- 화면: [/admin/emission/validation-rule](http://172.16.1.232/admin/emission/validation-rule)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 누락·중복·기간·단위·이상치 검사
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 33
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 20. 승인·알림 정책

- 화면: [/admin/emission/approval-workflow](http://172.16.1.232/admin/emission/approval-workflow)
- 역할: 기준정보 관리 권한자
- 표시/입력: 계수 값·단위·출처·유효기간, 가스별 GWP, 환산식, 입력/검증/승인 규칙
- 기능: 결재·반려·완료 조건; 실제 승인 작업과 설정 구분
- 저장: 계산 전 공통 기준 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: factorVersionId, gwpVersionId, ruleSetVersionId, templateVersionId
- 선행/검증: 중복 유효기간·단위 차원·규칙 검증; 사용 중 버전 불변
- 다음: 42
- 상태: DRAFT → PUBLISHED → RETIRED; 설계 초안·구현 검증 전

### 21. 자료 제출 요청

- 화면: [/emission/data-request](http://172.16.1.232/emission/data-request)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: 선택 사업장·배출원·자료기간·요청 항목·증빙·수신자·마감일
- 기능: 요청할 때만 수신자 지정; 직접 입력 시 이 화면 생략
- 저장: requestId + 수신자 관계 + 알림 outbox
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 수신자의 회사·사업장 업무 권한
- 다음: 22, 24, 32
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 22. 활동자료 관리

- 화면: [/emission/activity-data](http://172.16.1.232/emission/activity-data)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: 사업장·배출원·자료명·분류·기간·활동량·단위·증빙·버전·검토 상태
- 기능: 입력·임시저장·재조회·수정·제출; 사업장별 필터 유지
- 저장: activity revision; 제출은 snapshot
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: projectId/siteId/sourceId와 확정 범위; 값 0과 공란 구분
- 다음: 24, 25, 33
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 23. 활동자료 입력 기존 경로

- 화면: [/emission/data_input](http://172.16.1.232/emission/data_input)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 활동자료 관리와 중복 여부 확인; 무조건 새 화면 생성 금지
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 22
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전
- 통합 후보: 22번. 기존 URL은 안전한 호환 이동, 삭제는 컨펌 후.

### 24. 엑셀 업로드·원본 열 매핑

- 화면: [/emission/excel-upload](http://172.16.1.232/emission/excel-upload)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: 사업장·파일·시트·헤더·원본 열 매핑·5행 미리보기·오류행
- 기능: 1파일1사업장; XLSX 첫 시트/첫 행 헤더·5MB/2000행을 현재 지원으로 명시; 오류 시 전체 취소
- 저장: importId·원본·열 매핑·활동자료 원자 저장
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 서버 소속 검증, 동일 사업장/배출원/기간 중복 기준
- 다음: 22, 33
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 25. 증빙 자료함

- 화면: [/emission/evidence](http://172.16.1.232/emission/evidence)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 자료행과 증빙 연결·조회·버전
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 22, 33
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 26. 관리자 증빙 관리

- 화면: [/admin/emission/evidence-management](http://172.16.1.232/admin/emission/evidence-management)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 증빙 누락·접근권한·보관 관리
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 25, 35
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 27. 외부 데이터 연계

- 화면: [/emission/external-data](http://172.16.1.232/emission/external-data)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 선택적으로 외부 자료 수집·중복 방지·오류 확인
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 22, 33
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 28. 외부 시스템 연계 관리

- 화면: [/admin/emission/system-link](http://172.16.1.232/admin/emission/system-link)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 연계 설정·자격정보 보호·연계 실패 재처리
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 27
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 29. 내 업무

- 화면: [/emission/my-tasks](http://172.16.1.232/emission/my-tasks)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 권한과 배정에 맞는 업무 조회·프로젝트 선택
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 31
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 30. 프로젝트 업무 배정

- 화면: [/emission/work-assignment](http://172.16.1.232/emission/work-assignment)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: 프로젝트·선택 업무·담당자·필요 시 결재자·마감일·인계 메모
- 기능: 필요한 업무 인계 시만 배정; 공유 조회권한과 별도
- 저장: assignment revision + 알림 + 이력
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 배정받는 계정의 권한/활성 상태·충돌 정책
- 다음: 29, 31
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 31. 공통 업무 실행

- 화면: [/work/execution](http://172.16.1.232/work/execution)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 업무 ID·프로젝트·사업장·액터 유지
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 04
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 32. 마감·지연 현황

- 화면: [/emission/deadline-status](http://172.16.1.232/emission/deadline-status)
- 역할: 회사/사업장 자료 입력 권한자; 요청 수신자는 필요 시 지정
- 표시/입력: projectId, siteId, sourceId, 산정기간 내 자료기간, 활동량, 단위, 증빙
- 기능: 요청된 업무의 제출 기한·지연 확인
- 저장: 활동자료 수집 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: activityId, activityRevision, evidenceIds, importId, submissionId
- 선행/검증: 회사·사업장·배출원 소속, 기간, 숫자·단위·증빙 검사
- 다음: 21, 29
- 상태: DRAFT → SUBMITTED → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 33. 데이터 검증

- 화면: [/emission/data-validation](http://172.16.1.232/emission/data-validation)
- 역할: 자료 검토 권한자
- 표시/입력: 제출 버전·규칙 버전·오류행·사업장·차단/경고 구분
- 기능: 검사·원자료 이동·재검사·접수/반려
- 저장: qualityRun·issues·접수 이벤트
- 출력: qualityRunId, acceptedSubmissionIds, correctionIds
- 선행/검증: 사업장 구분 중복 검사; 미검사/실패를 PASS로 표시 금지
- 다음: 22, 35, 37
- 상태: CHECKING → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 34. 검증·보정 공통 화면

- 화면: [/emission/validate](http://172.16.1.232/emission/validate)
- 역할: 자료 검토 권한자
- 표시/입력: submissionId, 제출 스냅샷, qualityRuleVersionId, 지적사항
- 기능: 자료 검토와 산정결과 검증 단계 구분; 승인 탭 포함
- 저장: 자료 품질·보완 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: qualityRunId, acceptedSubmissionIds, correctionIds
- 선행/검증: 차단 오류 해소, 접수/반려 근거 기록
- 다음: 36, 42
- 상태: CHECKING → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 35. 관리자 검증

- 화면: [/admin/emission/validate](http://172.16.1.232/admin/emission/validate)
- 역할: 자료 검토 권한자
- 표시/입력: submissionId, 제출 스냅샷, qualityRuleVersionId, 지적사항
- 기능: 검증 대기·보완 요청·독립 검토
- 저장: 자료 품질·보완 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: qualityRunId, acceptedSubmissionIds, correctionIds
- 선행/검증: 차단 오류 해소, 접수/반려 근거 기록
- 다음: 36, 37
- 상태: CHECKING → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 36. 보완·재산정

- 화면: [/emission/correction](http://172.16.1.232/emission/correction)
- 역할: 자료 검토 권한자
- 표시/입력: 반려 원인·대상 자료·사업장·이전 버전·보완 근거
- 기능: 원자료 수정→새 제출→접수→새 계산→재검토
- 저장: 새 버전 및 correction 연결; 승인본 덮어쓰기 금지
- 출력: qualityRunId, acceptedSubmissionIds, correctionIds
- 선행/검증: 변경 영향과 해소한 지적사항 추적
- 다음: 22, 33, 37
- 상태: CHECKING → ACCEPTED 또는 RETURNED; 설계 초안·구현 검증 전

### 37. 배출량 산정·계수 매핑

- 화면: [/emission/calculation](http://172.16.1.232/emission/calculation)
- 역할: 산정 권한자
- 표시/입력: 사업장/Scope·배출원·접수 자료·계수·GWP·단위·방법·미매핑 건수
- 기능: 매핑·검증·계산; 실행 실패 상세; 재실행 중복 방지
- 저장: calculationRun 및 item snapshot 원자 저장
- 출력: calculationId, calculationVersion, inputHash, 사업장/Scope별 결과와 항목별 근거
- 선행/검증: siteId·Scope·원자료/계수 버전 스냅샷에 필수 보존
- 다음: 38
- 상태: READY → CALCULATING → CALCULATED 또는 FAILED; 설계 초안·구현 검증 전

### 38. 산정 결과

- 화면: [/emission/calculation-results](http://172.16.1.232/emission/calculation-results)
- 역할: 산정 권한자
- 표시/입력: 사업장/Scope별 합계·항목별 활동량×계수×환산/GWP 근거·출처·버전·비교
- 기능: 근거 펼치기·원자료 보기·비교·검토 요청
- 저장: 조회만; 검토 요청은 별도 명령
- 출력: calculationId, calculationVersion, inputHash, 사업장/Scope별 결과와 항목별 근거
- 선행/검증: 지정 calculationId로 조회; 최신 버전 자동 대체 금지
- 다음: 36, 42
- 상태: READY → CALCULATING → CALCULATED 또는 FAILED; 설계 초안·구현 검증 전

### 39. 결과 조회 기존 경로

- 화면: [/emission/result](http://172.16.1.232/emission/result)
- 역할: 산정 권한자
- 표시/입력: 접수된 submissionIds, boundaryVersionId, 계수/GWP/환산 버전, 배출원 매핑
- 기능: 산정 결과 화면과 역할·중복 확인
- 저장: 산정·결과 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: calculationId, calculationVersion, inputHash, 사업장/Scope별 결과와 항목별 근거
- 선행/검증: 미매핑·단위 불일치·범위 누락 차단, 입력 버전 일치
- 다음: 38
- 상태: READY → CALCULATING → CALCULATED 또는 FAILED; 설계 초안·구현 검증 전
- 통합 후보: 38번. 기존 URL은 안전한 호환 이동, 삭제는 컨펌 후.

### 40. 관리자 산정 결과 목록

- 화면: [/admin/emission/result_list](http://172.16.1.232/admin/emission/result_list)
- 역할: 산정 권한자
- 표시/입력: 접수된 submissionIds, boundaryVersionId, 계수/GWP/환산 버전, 배출원 매핑
- 기능: 프로젝트·버전별 결과 검색
- 저장: 산정·결과 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: calculationId, calculationVersion, inputHash, 사업장/Scope별 결과와 항목별 근거
- 선행/검증: 미매핑·단위 불일치·범위 누락 차단, 입력 버전 일치
- 다음: 41
- 상태: READY → CALCULATING → CALCULATED 또는 FAILED; 설계 초안·구현 검증 전

### 41. 관리자 결과 상세

- 화면: [/admin/emission/result_detail](http://172.16.1.232/admin/emission/result_detail)
- 역할: 산정 권한자
- 표시/입력: 접수된 submissionIds, boundaryVersionId, 계수/GWP/환산 버전, 배출원 매핑
- 기능: 계산 근거·버전·오류·검증 결과; 결과 ID 필요
- 저장: 산정·결과 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: calculationId, calculationVersion, inputHash, 사업장/Scope별 결과와 항목별 근거
- 선행/검증: 미매핑·단위 불일치·범위 누락 차단, 입력 버전 일치
- 다음: 38, 42
- 상태: READY → CALCULATING → CALCULATED 또는 FAILED; 설계 초안·구현 검증 전

### 42. 검토·승인

- 화면: [/emission/review-approval](http://172.16.1.232/emission/review-approval)
- 역할: 검토·결재 권한자; 결재 요청 시 지정
- 표시/입력: 제출 계산 버전·근거·지적사항·검토 의견·결재자
- 기능: 승인·반려; 적용 규칙에 따라 작성자/승인자 분리
- 저장: review/approval event
- 출력: reviewId, approvalId, lockedResultId, lockHash
- 선행/검증: 서버에서 대상 버전·권한·상태 재검사
- 다음: 36, 43
- 상태: IN_REVIEW → APPROVED → LOCKED 또는 RETURNED; 설계 초안·구현 검증 전

### 43. 배출량 확정

- 화면: [/emission/finalization](http://172.16.1.232/emission/finalization)
- 역할: 검토·결재 권한자; 결재 요청 시 지정
- 표시/입력: 승인 결과·사업장 합계·승인 이력·잠금 상태
- 기능: 확정·변경 승인 요청; 삭제/직접 덮어쓰기 금지
- 저장: lockedResult + hash
- 출력: reviewId, approvalId, lockedResultId, lockHash
- 선행/검증: 승인한 동일 버전만 잠금
- 다음: 45
- 상태: IN_REVIEW → APPROVED → LOCKED 또는 RETURNED; 설계 초안·구현 검증 전

### 44. 보고서 양식 관리

- 화면: [/admin/emission/report-template](http://172.16.1.232/admin/emission/report-template)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 보고 대상·필수 항목·버전 설정
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 45
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 45. 보고서 작성

- 화면: [/emission/report-write](http://172.16.1.232/emission/report-write)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: 잠금 결과·보고 대상·양식 버전·표지/사업장/기간·검증/승인 정보
- 기능: 작성·미리보기·발급 요청; 수기 수정은 계산 결과를 변경하지 않음
- 저장: report draft revision
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 원본의 결과 버전/기간/사업장과 일치
- 다음: 48, 51
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 46. 보고서 작성 기존 경로

- 화면: [/emission/report_submit](http://172.16.1.232/emission/report_submit)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 작성·발급 주 화면과 중복 통합 여부 확인
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 45
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전
- 통합 후보: 45번. 기존 URL은 안전한 호환 이동, 삭제는 컨펌 후.

### 47. 관리자 보고서

- 화면: [/admin/emission/survey-report](http://172.16.1.232/admin/emission/survey-report)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 기존 설문 리포트와 기업 배출 보고서 용도 구분
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 45, 48
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 48. PDF 출력·발급

- 화면: [/admin/emission/survey-report-print](http://172.16.1.232/admin/emission/survey-report-print)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: reportId·잠금 결과·템플릿 버전·발급 ID·발급시각
- 기능: PDF 발급·실패 단계 표시·동일요청 재시도
- 저장: PDF 원본·SHA256·발급 원장 원자 확정
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: PDF 생성만 성공해도 원장 미저장이면 성공 표시 금지
- 다음: 49, 51, 52
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 49. 보고서·인증서 발급 관리

- 화면: [/admin/emission/report-certificates](http://172.16.1.232/admin/emission/report-certificates)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 발급·재발급·취소·원본 연결
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 51, 52
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 50. 인증서 관리 후보

- 화면: [/admin/emission/certificates](http://172.16.1.232/admin/emission/certificates)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: DB 등록만 확인; 실제 라우트 확인 전 완료 처리 금지
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 49
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전
- 통합 후보: 49번. 기존 URL은 안전한 호환 이동, 삭제는 컨펌 후.

### 51. 보고서·인증서 다운로드

- 화면: [/emission/report-download](http://172.16.1.232/emission/report-download)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 권한 검사·발급 원본 다운로드
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 52, 54
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 52. 공개 진위 확인

- 화면: [/home/certificate-verify](http://172.16.1.232/home/certificate-verify)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: PDF 업로드 또는 인증 식별자·검증 근거·발급/취소 상태
- 기능: 서버 원본 대조·일치/불일치/확인불가 구분
- 저장: 정책상 최소 접근 로그만
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 로그인 없이 공개 허용, 원장에 없는 문서를 진본으로 표시 금지
- 다음: 화면 목적에 맞는 원래 업무 복귀 또는 I 단계; 상세 nextAction 계약 확정 필요
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 53. 관리자 리포트 진위 확인

- 화면: [/admin/emission/survey-report-verify](http://172.16.1.232/admin/emission/survey-report-verify)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 공개 진위확인과 판정 일치
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 49, 52
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 54. 규제기관 제출

- 화면: [/emission/report-submission](http://172.16.1.232/emission/report-submission)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: 제출 대상·유형·발급 문서·담당 기관·접수번호·접수증·상태
- 기능: 대상 업무에 한해 제출/결과 기록·반려 후 재제출
- 저장: 제출 버전·증빙·접수 이벤트
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 실제 외부 API 연계 여부 명시; 수동 기록을 자동 접수로 표현 금지
- 다음: 55, 57
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 55. 관리자 규제 제출 현황

- 화면: [/admin/emission/regulatory-submissions](http://172.16.1.232/admin/emission/regulatory-submissions)
- 역할: 보고·발급 권한자 / 공개 진위확인은 비로그인 허용
- 표시/입력: lockedResultId, 보고서 양식 버전, 발급 정보, 필요 시 제출기관/제출 유형
- 기능: 제출 상태·오류·재제출·접수 이력
- 저장: 보고·발급·선택적 제출 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: reportId, certificateId, 원본 PDF 해시, submissionReceiptId
- 선행/검증: 잠금 결과와 원본 일치, 발급 중복 방지, 제출 적용 여부 확인
- 다음: 54, 57
- 상태: REPORT_DRAFT → ISSUED → 선택적 SUBMITTED/RECEIVED; 설계 초안·구현 검증 전

### 56. 배출 현황 대시보드

- 화면: [/emission/index](http://172.16.1.232/emission/index)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 실제 산정 결과의 기간·사업장별 집계; 미산정과 0 구분
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 01, 38
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 57. 프로젝트 완료

- 화면: [/emission/project-completion](http://172.16.1.232/emission/project-completion)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 적용 업무·미완료 항목·결과/발급/접수 상태·차기 기간
- 기능: 마감·차기 복사; 이전 활동량/승인 결과 자동 복사 금지
- 저장: close event 또는 새 projectId
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 사업장·기준값은 재검증; 미적용 규제 제출로 마감 차단 금지
- 다음: 01, 03
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 58. 관리자 프로젝트 완료 관리

- 화면: [/admin/emission/project-completion](http://172.16.1.232/admin/emission/project-completion)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 마감·해제·차기 복사 검토
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 57
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 59. 다운로드·공유 이력

- 화면: [/mypage/download-history](http://172.16.1.232/mypage/download-history)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 보고서 접근·공유 기록
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 51
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 60. 관리자 보고서 접근 이력

- 화면: [/admin/emission/report-access-history](http://172.16.1.232/admin/emission/report-access-history)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 다운로드·공유·접근 감사
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 49, 51
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 61. 데이터 변경 이력

- 화면: [/admin/emission/data_history](http://172.16.1.232/admin/emission/data_history)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 원자료·계수·결과 변경자·변경 전후 연결
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 22, 38
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 62. 감사 로그

- 화면: [/admin/emission/audit-log](http://172.16.1.232/admin/emission/audit-log)
- 역할: 조회 권한자 / 마감·감사 권한자
- 표시/입력: 프로젝트·결과·발급·업무 상태 및 필터 기간
- 기능: 프로젝트·업무·실패 추적 및 보관 정책
- 저장: 마감·현황·감사 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 현황 조회, closeEventId, 차기 projectId, 접근/변경 이력
- 선행/검증: 필수 적용 업무 완료, 미해결 오류 없음, 불변 원본 보존
- 다음: 04
- 상태: OPEN → CLOSED; 재개 시 승인된 변경 이력; 설계 초안·구현 검증 전

### 63. LCI DB 조회

- 화면: [/emission/lci](http://172.16.1.232/emission/lci)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 필요한 계수 선택 시만 연계; 프로젝트 등록의 선행 필수 아님
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 13, 37
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 64. LCI 분류 관리

- 화면: [/admin/emission/lci-classification](http://172.16.1.232/admin/emission/lci-classification)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: LCA 연계용 기준 분류
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 63, 66
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 65. LCA 분석

- 화면: [/emission/lca](http://172.16.1.232/emission/lca)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 제품 LCA 별도 업무; 기업 배출량 산정과 구분
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 68
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 66. 설문·제품 데이터 관리

- 화면: [/admin/emission/survey-admin](http://172.16.1.232/admin/emission/survey-admin)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 제품·공정·LCA 업무와 기업 배출량 업무 구분
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 67, 65
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 67. 설문 업로드 데이터

- 화면: [/admin/emission/survey-admin-data](http://172.16.1.232/admin/emission/survey-admin-data)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 원본 데이터셋·제품/공정 매핑; 활동자료 업로드와 역할 구분
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 66, 65
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 68. LCA 요약보고서 출력

- 화면: [/admin/emission/survey-report-lca-summary](http://172.16.1.232/admin/emission/survey-report-lca-summary)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 제품 LCA용 선택 연계
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 65
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 69. 감축 시나리오

- 화면: [/emission/reduction](http://172.16.1.232/emission/reduction)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 확정 배출량을 활용하는 별도 감축 업무
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 70
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

### 70. 감축 전략 시뮬레이션

- 화면: [/emission/simulate](http://172.16.1.232/emission/simulate)
- 역할: 해당 연계 업무 권한자
- 표시/입력: 확정된 결과/계수 참조, 제품·공정·감축 분석의 별도 식별자
- 기능: 시나리오 분석; 배출량 산정 필수 단계 아님
- 저장: 선택 연계 영역의 권한별 명령; 조회 조작은 쓰기 없음
- 출력: 연계 참조 ID, 별도 LCA/감축 결과
- 선행/검증: 기업 배출량과 제품 LCA를 합산/혼동하지 않음, 별도 권한 검사
- 다음: 69
- 상태: 별도 업무 상태 사용; 설계 초안·구현 검증 전

## 8. KRDS 공통 화면 구조와 5종 안내

흰 배경·동일 폭·브레드크럼브→제목/설명→프로젝트·사업장 문맥→주요 목록/폼→저장/다음 업무 순서. 표준 버튼 크기·필수 표시·필드별 오류·키보드 포커스를 공통 컴포넌트로 둔다. 화면별 대형 숫자 카드 남발 금지.

- 목록: 작은 검색 도구모음·건수·표·빈/오류 상태.
- 폼: 관련 항목을 묶고 저장 전 변경 요약. 사업장 그리드는 선택 유지.
- 결과: 사업장/Scope 합계와 계산 근거를 표로 제공; 펼침 상세로 원자료 추적.
- 도움말=입력 의미/예시, 화면설계=계약/버전, QA=검증 상태, 길잡이=현재 화면 작업, 전체업무보기=업무 흐름/선택 분기. 같은 설계 ID에서 생성하며 인증정보/내부 비밀은 노출하지 않는다.

## 9. 자동생성/검증 계획

설계 JSON에 화면 ID·필드·권한·operationCode·상태·nextAction·testCase를 등록 → JSON Schema 검증 → KRDS 공통 컴포넌트/JSON Form 생성 → 기존 API 어댑터 계약 검사 → 후보 환경에서 페이지/프로세스 검사 → 사용자 컨펌 후 적용. 현재 생성기가 이 문서를 모두 실행 가능 코드로 변환한다는 뜻은 아니며 어댑터·스키마 구현이 필요하다.

무빌드 적용은 지원되는 메타데이터 변경에 한정한다. DB 스냅샷/권한/Java 계약 변경을 UI 설정만으로 해결한 것처럼 처리하지 않는다. 배포 시간 목표는 측정 후 보고하며 1분 이내를 검증 없이 보장하지 않는다.

### 최소 프로세스 테스트

1. 같은 회사 A/B사업장을 등록·선택하고 프로젝트 최소 항목 저장/재조회. 다른 회사 사업장 거절.
2. A/B에 동일월 전력 항목 입력: 서로 중복 아님. 같은 파일 재요청은 중복 저장 없음.
3. 제출 당시 사업장·값·증빙 보존. 현재 원자료 수정해도 제출본 불변.
4. 계수·단위·기간 누락은 계산 차단. 정상 입력은 사업장별 합계와 전체 합계 일치.
5. 결과 조회 SQL 정상. 지정 버전 그대로 조회, 미산정은 0과 구분.
6. 권한 없는 승인 거절. 반려→보완→재산정→재검토→동일 버전 잠금.
7. PDF·발급 원장·해시 일치; 실패한 발급은 성공 표시 없음. 변조/취소/미등록은 구분.
8. 선택적 규제 제출 미적용은 마감 허용. 완료 링크·차기 등록 정상.

각 테스트는 계정·액터·화면·입력·API 결과·DB 재조회·다음 화면·스크린샷을 기록한다. 지금은 전부 실행 전이다.

## 10. 사용자 확인 항목 전체

다음은 구현 전 정책 확인 목록이며, 기본 제안으로 설계를 작성했다.

|항목|기본 제안|미확정 영향|
|---|---|---|
|조회 공개 범위|같은 회사의 탄소배출 조회 권한자|모든 직원 공개는 아님|
|미배정 업무 수행|역할+사업장 권한 있으면 직접 진행, 인계 때만 개인 배정|현재 강제 배정 정책 변경 필요|
|프로젝트 기간|시작≤종료; 연도 경계 허용 후 보고기준으로 분할|현행 단일 보고연도 제약 검토|
|검토/결재|설정된 업무에서만 요청 시 결재자 지정|독립 검증/자기승인 금지 적용 기준 확인|
|마감|적용되는 필수 업무만 완료 검사|규제 제출 자동 필수 금지|
|보관/백업|원본·승인본은 보존, 임시자료는 정책별 정리|정확한 기간·저장한도는 별도 결정|
|통합 후보|09→04,23→22,39→38,46→45,50→49|삭제 전 사용자 확인|

원씽: 프로젝트·사업장·버전이 전 과정에서 동일하게 연결되는 계약부터 완성한다. 다음 작업은 설계 검토 후 01 목록→02 사업장→03 등록→04 상세의 단일 흐름이다.
