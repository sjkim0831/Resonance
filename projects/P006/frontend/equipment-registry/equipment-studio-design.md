# P006 Equipment Studio

## 목적
멀티소스 증거를 바탕으로 실제 설비 인스턴스를 등록/수정하고, 승인된 공통 3D 자산이 있을 때 Product Planner의 저장 공정에 연결한다.

## 업무 단계
1. 설비 목록에서 기존 인스턴스를 선택하거나 신규 등록한다.
2. 실제 공정과 설비 종류, 코드, 이름, 제조사·모델, 역할, 확인 가능한 치수/설치/작업물/Port를 입력한다.
3. 사진·명판·매뉴얼·도면·치수·CAD/USD/GLB·동작 영상 자료를 파일 또는 원본 경로로 등록한다.
4. API는 각 파일을 증거 레코드로 보존하고 검토 전 `UNREVIEWED`로 표시한다. UI는 GLB 미리보기와 사진·영상 미리보기를 제공한다.
5. 기존 공통 Asset 매칭 등급은 후보 판정으로 별도 노출한다. 기존 원장 검토/승인 흐름으로 연결을 승인한다.
6. 연결된 공통 Asset에 실제 웹 GLB가 있을 때만 브라우저에 저장된 제품 계획/공정에 Asset ID, USD, GLB 경로를 써 넣는다.

## 자료 계약 및 API
- 업무 흐름: equipment-studio.html/js → `/projects/P006/registry-api/meta`, `/equipment`, `/equipment/{id}`, `/equipment/{id}/evidence`.
- 기존 스키마를 재사용한다: process, equipment_type, equipment_model, model_option, equipment_instance, evidence.
- 업데이트는 version 기반 PATCH이며, 검증된 모델 매핑은 기존 API가 자료 변경 시 무효화한다.
- 파일 업로드 제한은 증거 API의 파일당 5 MiB이다. 업로드되지 않는 대용량 원본은 경로 참조로 기록한다.
- 기존 설비 인스턴스/공통 Asset의 기존 검증 상태를 새 페이지에서 강제로 승격하지 않는다.
- Product Planner 연결 저장은 같은 브라우저의 `p006-product-plans-v1`에 있는 계획만 대상이며 revision을 올린다.
- 수정본 Pilot 흐름: `GEOMETRY` 증거 중 파일명이 `.glb`인 서버 저장 항목은 증거 API의 원본 바이트 조회 경로로 다시 가져와 카탈로그 원본과 좌/우 비교한다. 비교 통계는 GLTFLoader 파싱 결과의 Mesh/Triangle/Material/Animation 수이며 최대 치수는 시각 비교 편의를 위해 각각 정규화한다. 기하 품질 승인을 의미하지 않는다.
- Product Planner 초안 적용: 선택한 저장 계획·공정의 `equipmentModel`에 비공개 증거 GLB 경로, 설비 ID/이름, 설치 JSON, 작업물 Anchor JSON, evidence ID/SHA, `UNREVIEWED_DRAFT`를 기록한다. 계획은 동일 브라우저의 localStorage에 저장되며 revision을 증가시킨다. 공통 카탈로그 Asset·원본 파일·승인 상태는 변경하지 않는다. 공정 뷰어 URL 검증은 동일 출처 카탈로그 `.glb`와 `/registry-api/evidence/<id>`만 허용한다.
- 2026-09-29 업무 흐름 개편: 설비 준비 현황을 ①식별 ②근거 등록 ③3D 검토 ④공정 연결의 4단계로 표시한다. 단계 상태는 현재 설비와 실제 근거 레코드, 모델 미리보기, 연결 수용된 Asset 상태로 계산한다.
- 제조사·모델 직접 추가는 기존 관리자 API `POST /manufacturers`, `POST /models`를 사용한다. 명판에서 확인한 값을 공통 목록에 저장하고 현재 설비 모델 선택에 반영한다. 모델의 카탈로그 등록은 특정 실물 장비의 동일성·치수·동작·공정 적합성 승인이 아니다.
- 카탈로그 GLB 미리보기는 자산 ID 또는 이름을 입력해 조회한다. 표시 후 실제 Asset 연결 상태와 Mesh/Triangle/Material/Animation 수를 보여준다. N076 빠른 보기와 `?asset=N076` 경로는 참고용이며 저장 설비에 자동 연결하지 않는다.
- 공정에 모델을 적용하는 버튼은 `connected_asset_id`가 승인된 설비에만 제공한다. 추천/매칭 후보나 단순 카탈로그 미리보기는 공정에 연결하지 않는다.

## 고품질 모델 기준
- 사진은 외형 참조, 매뉴얼/도면은 규격 근거, 영상은 동작 근거, CAD/USD/GLB는 기하 자료로 분리한다.
- 자료 부재는 UNKNOWN으로 둔다. 자동 형상 재구성 또는 보이지 않는 부분의 추측을 실물 일치로 처리하지 않는다.
- EXACT/CLOSE/REFERENCE는 자산 매칭 등급이다. 정밀도 점수, 제조사 동일성, 설치 실물, 동작, 공정 적합성, READY/REAL을 의미하지 않는다.
- 3D 실제 제작은 CAD/사진/치수 검토와 수작업 보정 후 이루어진다. 이 화면은 멀티소스 수집/검토/실행 연결 화면이며 텍스트만으로 CAD를 자동 생성하지 않는다.
- USD 변환과 웹 GLB 표현은 별도 버전/경로로 취급한다. 기존 공통 Asset을 업체별 복제하지 않는다.
- 2026-09-29 N076 조사: 원본 카탈로그 USD 참조(1,655 B), 카탈로그 렌더(640×480), 웹 GLB(34,276 B)를 확인했다. GLB는 Node 66, Mesh 21, Triangle 392, Material 0, Animation 0이며 실제 설치 장비/동작과의 일치는 미검증이다. N076 이름의 매뉴얼·현장 사진·동작 영상·STEP은 검색 범위에서 찾지 못했다. 현재 자동차 계획은 차체 패널 성형에 E096 소형 프레스를 사용하며 N076 연결은 없다.
- N076를 실제 설비와 공정에 연결하기 전에 제조사/모델 또는 현장 ID, 실물 자료, 검증 치수/정격힘, E096 대체 또는 별도 배정 결정을 확인한다. 자세한 증거와 한계는 `n076-readiness.md` 및 `n076-readiness.json`을 참조한다.

## 화면/QA
- 중앙 편집: 설비 식별·제원/기능 입력과 멀티소스 추가.
- 왼쪽: 설비 검색/선택, 매칭 등급.
- 오른쪽: GLB/파일 미리보기, 형상·치수·동작·Port 검토상태, 공정 연결.
- 화면 상단: 선택 설비의 4단계 준비 상태와 현재 다음 입력 한 가지를 표시한다.
- 우측 3D: Asset ID/이름 검색, 3D 모델 통계, 연결/미연결 표시. 미리보기는 장비 실물 검증으로 승격하지 않는다.
- 시각 검수: 1440px+ 3열, 760px 이하 단일 열. 키보드 포커스, 파일 유형/상태 텍스트를 제공.
- 수정 GLB 비교: 설비 선택 → 카탈로그 원본 ID 입력/불러오기 → 저장 증거 목록의 `원본과 비교` → 좌 원본·우 수정본 통계/화면 비교 → Product Planner 저장 계획/공정 선택 → `미검토 수정본 초안 적용` → 공정 화면에서 GLB 표시 확인.
- 경로/단위, JSON 객체, 파일 크기, 자료 종류 검증은 클라이언트와 기존 API에서 수행.
- 수동 QA: 목록 열기→신규 작성/저장→자료 여러 개 등록→새로고침 조회→기존 버전 수정→자산 연결 여부에 따라 Product Planner 반영 버튼 확인.
- 2026-09-28 검증: P006 local backend를 활성화된 systemd 서비스로 복구했다. 기존 QA 계정 harness로 backend transaction QA 30/30 통과.
- Equipment Studio 브라우저 API 흐름 11/11 통과: 독립 QA 계층 생성 → 설비 생성 → MANUAL 경로 및 작은 합성 텍스트 파일 업로드 → SHA-256 메타데이터 확인 → 관리번호 수정 → 새로고침 후 설비/자료 2건 복원 → 브라우저 JS 오류 없음. 실행 시간 2.78초.
- 테스트 계층/설비 1건과 합성 업로드 파일 1개는 경로·SHA-256·공유 여부 확인 후 삭제했다. 남은 QA DB 업무 데이터 0건. 스크린샷과 결과 JSON은 `equipment-studio-browser-qa.png`, `equipment-studio-browser-qa.json`에 둔다. 캡처는 업로드 복원 검증 순간의 QA 전용 fixture 상태임을 보고서에 표시한다.
- 검증 파일은 합성 텍스트이지 실제 매뉴얼/설비 증거가 아니다. 실제 장비와 실자료 기반 품질·모델 매칭 검증은 다음 업무다.
- 2026-09-29 실제 화면 시각 QA: `equipment-studio.html?asset=N076` 별도 브라우저에서 4단계 흐름, N076 미리보기, 저장 전 등록 폼, 근거 입력, 공정 연결 안내를 확인했다. N076 GLB 로드 후 브라우저 런타임 기준 Mesh 21 / Triangle 392 / Material 2 / Animation 0으로 표시된다. 정적 인벤토리의 이전 Material 수치와 런타임 값이 다르므로 둘을 혼합하지 않고, 화면에는 실제 로드 결과를 표기한다. 스크린샷은 `equipment-studio-flow-qa.png`, 관측 JSON은 `equipment-studio-flow-qa.json`에 둔다.
- N076 미리보기 캡처는 카탈로그 GLB 표시만 입증한다. 실제 등록·자료 저장·공정 연결은 아래 별도 쓰기 QA에서 시험용 데이터로 검증했다.
- 수정 GLB 초안 적용 검증 주의: `.glb` 증거 바이트를 실제 수정 GLB로 업로드해야 원본 대 수정본 화면 비교가 성립한다. 좌/우 크기 정규화는 화면 표시만을 위한 것이며 치수 차이, 설치 적합성, 외형 정확성, 애니메이션/기능 유지를 통과 처리하지 않는다. 연결은 localStorage 기반 계획이라 같은 브라우저 프로필 안에서 확인한다.
- 2026-09-29 수정 GLB Pilot 배포: 비교 화면/증거 GLB 재조회/저장 계획의 미검토 초안 적용/공정 로더 경로 검증을 구현했다. 정적 경로 6개 HTTP 200, 두 JavaScript `node --check` 통과, 별도 브라우저 페이지 오류 0건, 비교 버튼과 변경된 안내 문구 노출을 확인했다. 캡처는 `equipment-studio-revision-qa.png`, 계측은 `equipment-studio-revision-qa.json`이다. 이번 별도 브라우저 점검에는 설비 레지스트리 데이터가 제공되지 않아 실제 GLB 증거 업로드·동일 설비 전후 비교·Product Planner 런타임 연결은 실행하지 않았으며 성공으로 세지 않는다.
- 2026-09-29 저장·연결 브라우저 QA 13/13 통과: 독립 QA 계층/설비 작성 → 자료 경로와 합성 파일 업로드/SHA 복원 → 설비 수정/새로고침 복원 → 기준 형상 `REFERENCE_MATCH` 수용 → 저장 계획의 시험 공정에 실제 카탈로그 GLB 경로 연결 → 화면 새로고침 후 확인. Product Planner 데이터는 같은 브라우저의 localStorage에 저장된다. `E005` 연결은 QA 전용 가상 설비에 대한 기준 형상 연결이며 실물/공정 승인으로 해석하지 않는다. QA 고객·설비 1건과 합성 파일 1개는 검증 후 삭제했고 DB 잔여 행 0건이다. 결과는 `qa-run-20260929/equipment-studio-browser-qa.json`, 화면은 `qa-run-20260929/equipment-studio-browser-qa.png`에 있다.

## 범위 및 다음 업무
- 설비 instance/evidence 생성·수정은 기존 P006 API가 영속한다.
- 새 자산 생성은 기존 `NO_MATCH` 심사 경로와 공통 라이브러리 관리자 API에서만 한다. 현재 페이지가 새 GLB를 자동 등록하거나 approval/asset readiness를 올리지 않는다.
- 다음 바위: 대표 설비 1개의 원본 Asset ID와 별도 수정 GLB(5 MiB 이하), 저장 계획의 동일 공정을 사용해 업로드→새로고침 복원→좌/우 비교→미검토 초안 적용→공정 3D 표시/실패 처리를 실제 값으로 확인한다. 확인 전 초안은 승인 자산이 아니다.
- 3D 원본이 준비되면 GLB/USD를 공통 카탈로그에 심사 등록하고, 공정에서 불러와 실물 기준과 외형/가동부/Port를 승인한다.
- 원씽: 검증 근거의 출처를 보존해 실제 설비 인스턴스와 공정이 같은 승인된 공통 모델을 참조하게 한다.
- QA 자료: `equipment-studio-qa.json`은 요약 결과, `equipment-studio-backend-qa.json`은 backend 30개 세부 결과, `equipment-studio-browser-qa.json`은 브라우저 단계별 결과, `equipment-studio-browser-qa.png`는 실제 검증 화면이다.
- N076 자료 준비도: `n076-readiness.md`는 사람이 읽는 자산 출처/품질 판정, `n076-readiness.json`은 측정된 메타데이터와 미확인 항목이다.
