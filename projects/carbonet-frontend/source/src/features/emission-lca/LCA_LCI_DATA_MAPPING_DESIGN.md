# LCA 데이터 매핑 화면 설계

작성일: 2026-10-01  
업무 ID: `LCA_LCI_DATA_MAPPING` · 메뉴 코드 `H1030206`  
전용 URL: `/lca/data-mapping?projectId={projectId}`  
기존 메뉴 URL: `/emission/lca?menu=H1030206&projectId={projectId}` → 전용 화면으로 이동

## 목적

프로젝트 인벤토리의 투입·산출 흐름을 실제 저장된 LCI 데이터셋 후보와 연결해, 이후 산정에서 사용할 버전과 근거를 추적한다. 이 업무는 “가장 비슷한 명칭 고르기”가 아니라 기준흐름·단위·공정기술·지역·기준연도·시스템 경계가 연구 목적에 맞는지 확인하는 기술 검토다. 검색 후보와 미승인 검토안은 계산에 사용하지 않는다.

## 절차·완료 기준

| 순서 | 단계 | 액터 | 입력 | 완료 조건 |
|---:|---|---|---|---|
| 1 | 프로젝트·인벤토리 버전 확인 | LCA 담당자 | 접근 가능한 projectId, 입력 버전 | 선택 ID가 URL·저장자료와 일치 |
| 2 | 미매핑 대상 확인 | LCA 데이터 담당자 | 원료·에너지·운송·제품·폐기물 행 | 전체 대상 수와 미매핑 수 산출 |
| 3 | 저장 LCI 후보 검색 | LCA 데이터 스튜어드 | 흐름명·유형·단위·지역 조건 | 출처가 있는 실제 데이터셋 후보 반환 |
| 4 | 후보 기술 적합성 검토 | LCA 전문가 | 기준흐름·기술·지역·연도·단위·데이터 품질 | 적합·부적합 및 검토 의견 기록 |
| 5 | 단위·대표성 검토 | LCA 방법론 검토자 | 기능 단위, 환산식, 지역·기간 차이 | 환산 근거와 대표성 차이 승인을 받음 |
| 6 | 프로젝트 매핑 저장·버전 발행 | LCA 데이터 스튜어드 / 승인자 | target row ID, dataset 불변 ID·버전, 근거 | 서버 권한·버전 충돌 검사 후 불변 매핑 버전 생성 |
| 7 | 산정으로 인계 | LCA 산정 담당자 | 확정 매핑 및 인벤토리 스냅샷 ID | 계산은 확정된 동일 버전만 사용 |

## 화면 기능

- 상단 프로젝트 선택 및 URL 동기화, 인벤토리·매핑 현황 조회.
- 왼쪽은 공정 인벤토리 대상, 오른쪽은 LCI 후보 검색·비교와 선정 근거 입력.
- 검색 조건: 물질/기능흐름, 지역, 기준 단위. 후보 열: 데이터셋 ID, 참조 제품/기능흐름, 공정, 지역, 기준연도, 단위, 지표·점수, 출처.
- 후보 선택은 임시 검토 상태로만 표시한다. 지역·기준연도 대표성, 단위 환산식, 선택 근거가 확인되어야 저장·확정 가능하다.
- 기존 저장 매핑은 프로젝트 ID와 인벤토리 행 ID로 조회한다. 매핑된 후보의 데이터 버전을 보존하고 변경 비교를 제공한다.
- 임의 점수·배출계수·CO₂e를 만들지 않는다. 검색 추천은 승인 대체가 아니다.
- 이전 메뉴는 H1030205 폐기물·배출물, 인벤토리 확인 링크는 H1030201 메뉴.

## 데이터·권한 설계

- 조회 후보: `/home/api/emission-projects?page=1&size=100`, `/admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION`, `/admin/api/admin/lca-workspaces/LCA_MATERIAL_MAPPING`, `/admin/api/admin/emission/ecoinvent/datasets`.
- 프로젝트 저장 스키마 제안: `{ projectId, inventoryVersion, mappings: [{ targetRowId, datasetId, datasetVersion, referenceFlow, referenceUnit, geography, referenceYear, unitConversion, rationale, status, reviewedBy }] }`.
- `/admin/api/admin/emission/ecoinvent/mappings` 기존 저장 계약은 `{ koreanName, datasetId, sortOrder, memo }`이며 프로젝트 ID, 대상 인벤토리 행, 버전/권한 범위가 없다. 이것을 프로젝트 매핑에 재사용하면 전역 명칭 매핑과 프로젝트별 기술 승인이 섞이므로 사용하지 않는다.
- 기존 generic LCA workspace 쓰기는 프로젝트 배정·액터 권한·버전 동시성 확인이 확인되지 않았다. 그래서 화면은 실제 후보를 검색하고 검토안을 작성하지만, 프로젝트 매핑 저장은 비활성화한다.
- 저장 API는 LCA_DATA_STEWARD의 프로젝트 접근, LCA_SPECIALIST의 기술검토, LCA_METHOD_REVIEWER의 방법론 승인, dataset 사용권한/버전, inventoryVersion, 대상행 소유 프로젝트를 서버에서 확인해야 한다.

## QA 체크리스트

| ID | 확인 내용 | 기대 결과 |
|---|---|---|
| M01 | `/lca/data-mapping?projectId=...` 직접 진입·새로고침 | 매핑 페이지가 열리고 선택 프로젝트 유지 |
| M02 | H1030206 구 메뉴 진입 | projectId 보존하고 전용 페이지로 이동 |
| M03 | H1030205 다음 단계 선택 | 같은 프로젝트로 이동 |
| M04 | 프로젝트 인벤토리 데이터 없음 | 빈 상태를 안내하고 가짜 행을 만들지 않음 |
| M05 | LCI 검색 | DB 후보만 표시, 후보 미존재/401 오류 명시 |
| M06 | 단위 불일치 | 변환식 입력 전 검토 완료 불가 |
| M07 | 지역·기준연도 차이 | 차이와 적용 근거 입력 필요 |
| M08 | 근거 누락 | 매핑 확정 불가 |
| M09 | 프로젝트 저장 | 현재는 버튼 잠금, 쓰기 요청 0건 |
| M10 | 권한 없는 타 프로젝트 접근 | 서버에서 401/403, 자료 유출 없음 |
| M11 | 확정 매핑 산정 인계 | 동일 inventoryVersion·datasetVersion 확인 |

## 반영·복구 및 진행상태

- 개발 Vite 소스에 반영한다. DB 변경 및 운영 배포는 이 화면 작업 범위가 아니다.
- 변경 전 서버 스냅샷은 `/opt/Resonance/.codex-backup/lca-h1030206-20261001`에 둔다.
- 복구 시 route family, page manifest, LCA alias page, H1030205 다음 링크, LCA 설계 JSON을 백업본으로 복원하고 신규 `LcaLciDataMappingPage.tsx`를 제거한다.
- 상태 `PARTIAL`: 검색·비교·검토안 UI는 사용 가능하나 프로젝트 단위 저장/승인 API와 인증된 업무 E2E가 미확인이다. 화면을 전체 완료로 간주하지 않는다.

## 반영 검증 기록

- 2026-10-01 개발 소스에 route definition, lazy loader, KRDS page manifest, H1030206 legacy redirect, H1030205 다음 단계 링크, LCA 화면 설계 인덱스를 반영했다.
- `npx tsc --noEmit --pretty false`: 통과.
- Vite route shell HTTP 200 (1,010 bytes), 신규 화면 TSX 모듈 HTTP 200 (최종 102,238 bytes), 프로젝트/인벤토리/저장 매핑 버전 표시 포함.
- 브라우저의 legacy URL 접근 결과 `/signin/loginView`로 이동. 비로그인 ecoinvent 후보 조회 API와 LCA 매핑 workspace API는 각각 HTTP 401(56 bytes).
- 인증된 UI 시각 검수, 프로젝트 데이터 로딩, 실제 후보 검색, 역할별 접근 제어와 저장 후 새로고침 검증은 미실시. 저장 버튼은 잠겨 있고 쓰기 요청은 전송하지 않았다.
- DB/API 계약 변경 0건, 개발 서버 HMR 반영만 수행, 빌드·운영 배포 0회. 백업 `/opt/Resonance/.codex-backup/lca-h1030206-20261001` 크기 420,436 bytes, `/opt` 여유 공간 약 1.3 TiB.
- 작업 시간 약 10분, 외부 비용 $0. 라우트/정적 코드 검증 신뢰도 95%, 인증된 업무 완결성 확인은 45%.
