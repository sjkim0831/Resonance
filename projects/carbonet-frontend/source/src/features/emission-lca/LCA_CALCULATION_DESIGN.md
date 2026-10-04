# LCI 산정 화면 설계 — H1030301

## 업무 목적과 경계

- URL: `/lca/calculation?projectId={프로젝트ID}`; 메뉴 별칭: `/emission/lca?menu=H1030301&projectId={프로젝트ID}`
- 주 액터: LCA 수행자. 프로젝트 조회 권한과 각 작업공간 조회 권한은 서버 응답으로 확인한다.
- 목적: 선택 프로젝트의 공정별 인벤토리와 LCI 연결을 검토하고, 저장 결과·실행 버전을 조회해 다음 업무로 넘긴다.
- 업무 탭은 `산정 대상`, `검증`, `산정 결과`, `실행 이력·버전`으로 나눈다. LCIA 영향평가와 기여도 분석은 후속 업무다.

## 데이터 흐름

1. 프로젝트 목록: `GET /home/api/emission-projects?page=1&size=100`
2. 저장 공정, 시스템 범위, 활동자료, 매핑:
   - `GET /admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS`
   - `GET /admin/api/admin/lca-workspaces/LCA_SCOPE`
   - `GET /admin/api/admin/lca-workspaces/LCA_DATA_COLLECTION`
   - `GET /admin/api/admin/lca-workspaces/LCA_MATERIAL_MAPPING`
3. 화면은 각 레코드의 `payload.projectId`를 프로젝트 ID와 비교하고 해당 레코드의 버전과 상태를 보여준다.
4. 입력 인벤토리는 저장된 materials/materialEntries, energyEntries, transportEntries, productOutputEntries, wasteEmissionEntries에서만 구성한다.
5. 매핑 ID가 인벤토리 행 ID와 일치할 때만 연결된 항목으로 표시한다. 목록 갯수만으로 매핑 완료를 추정하지 않는다.
6. `LCA_CALCULATION_RESULT`는 동일 프로젝트 ID의 저장 결과만 조회한다. 결과 행은 resultTable/lciResults/results에서 읽는다.
7. 입력 사본 다운로드는 프로젝트 ID, 작업공간 버전, 저장 인벤토리의 JSON 사본을 만든다. 서버 결과를 만들거나 저장하지 않는다.

## 사전 검사

- 프로젝트를 선택하기 전에는 통계·경고를 표시하지 않고 선택 안내를 제공한다.
- 선택 후에는 인벤토리 검토를 기본 탭으로, 선행 확인은 별도 검증 탭으로 제공한다.
- 결과와 실행 이력 탭은 서버 저장본만 보이며 빈 결과를 0으로 표시하지 않는다.
- 실제 승인 상태만 승인으로 간주하고 알 수 없는 상태는 검토 상태로 남긴다.
- 값이 없는 결과는 0으로 표시하지 않고 미조회/미제공으로 표시한다.
- 화면 편집 입력을 계산 자료로 섞지 않는다.
- 공동제품·부산물이 저장되어 있으면 배분 방법 또는 배분 제외 근거 누락을 별도 검사한다.

## 현재 구현 한계와 API 요구

프론트엔드 API 계약에서 프로젝트별 LCI 실행·결과 조회·결과 저장 엔드포인트를 발견하지 못했다. 기존 Ecoinvent 데이터 조회와 전역 한국어 매핑 저장 API는 제품 LCA 실행 결과 API가 아니다. 실행 엔진이 반환하지 않은 수치나 배출계수를 만들지 않도록 실행 버튼은 잠겨 있다.

실행을 열려면 서버가 다음 계약을 제공해야 한다.

- 실행 입력: `projectId`, `inventoryVersion`, `mappingVersion`, `scopeVersion`, `methodVersion`, idempotency key.
- 서버 검증: 인증 액터의 프로젝트 범위, 작업공간 버전 일치, 필수 매핑·단위·증빙·배분 규칙.
- 응답: 실행 ID, 고정된 입력 해시, LCI 흐름 결과, 계산 규칙·데이터셋 버전, 오류/경고, 감사 이벤트.
- 조회와 저장은 동일한 프로젝트 경계 및 결과 버전을 사용하고 재시도는 멱등이어야 한다.

## QA 행렬

| ID | 확인 | 기대값 |
|---|---|---|
| LC-01 | 프로젝트 없이 접근 | 결과값을 만들지 않고 프로젝트 선택 안내 |
| LC-02 | 프로젝트 직접 URL 접근/새로고침 | URL projectId 유지, 해당 프로젝트 자료만 조회 |
| LC-03 | 프로젝트 변경 | URL 갱신, 새 프로젝트 작업공간 자료로 화면 변경 |
| LC-04 | 입력 자료 없음 | 빈 상태 안내, 임의의 0 산정값 없음 |
| LC-05 | 일부 매핑 | 정확히 연결된 인벤토리 ID만 매핑으로 표시 |
| LC-06 | 버전 표시 | 프로젝트별 입력·매핑·결과 작업공간의 서버 version만 노출 |
| LC-07 | 검증 탭 | 저장 자료 기준 체크와 관련 페이지 링크 표시 |
| LC-08 | 스냅샷 내보내기 | JSON에 산정 입력 사본임을 표시하고 결과값은 포함하지 않음 |
| LC-09 | 무권한/만료 세션 | 서버 오류를 보여주고 로컬 자료로 대체하지 않음 |
| LC-10 | 계산 실행 | 서버 실행 기능 확인 전 비활성 상태 유지 |
| LC-11 | 공동제품·부산물 포함 | 배분 방법 또는 배분 제외 근거 누락을 표시 |
| LC-12 | 프로젝트 미선택 | 수치·경고 대신 프로젝트 선택 안내만 표시 |
| LC-13 | 저장 결과·버전 | 같은 프로젝트 결과 행, 실행 ID, 입력 해시만 표시 |

## 롤백

변경 전 route family, page manifest, legacy redirect, 기존 매핑 페이지, LCA design JSON은 `/opt/Resonance/.codex-backup/lca-h1030301-<UTC timestamp>/`에 보관한다. 신규 산정 페이지와 본 문서를 제거하고 백업된 다섯 파일을 원래 경로에 복원한다. 빌드 없이 Vite HMR을 사용한다.

## 배포·확인 기록

- 범위: 개발 서버 `/opt/Resonance/projects/carbonet-frontend/source`, Vite HMR; 별도 빌드·운영 배포 없음.
- 2026-10-01 UI 보강: 공정별 인벤토리를 기본 작업 탭으로 두고 검증·저장 산정 결과·버전 이력을 분리했다. 프로젝트 미선택 상태에서는 진행 수치와 자료 경고를 숨기고 선택 안내를 보인다.
- 계산 실행은 여전히 비활성 상태다. 사용자 안내는 서버 계산 기능 연결 상태로 표현하고, 저장 결과는 `LCA_CALCULATION_RESULT` 프로젝트별 최신 버전과 이력만 조회한다.
- 시각/비용: 작업 시작 2026-10-01 (Asia/Seoul); 외부 유료 API 사용 없음($0).
- 검증 표시는 route/module/TypeScript 및 HTTP 전달 확인과 로그인된 업무 흐름 검수를 구분한다.
- 상태: 프론트 산정 준비 화면 PARTIAL. 실제 산정과 권한을 포함한 저장은 서버 API가 없어서 완료 아님.
