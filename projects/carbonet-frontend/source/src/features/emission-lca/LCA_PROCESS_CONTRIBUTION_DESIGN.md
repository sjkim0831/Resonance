# 공정별 기여도 화면 설계 (H1030303)

## 목적
- 주소: `/lca/process-contribution-analysis?projectId={projectId}`. 기존 `/emission/lca?menu=H1030303`는 프로젝트 ID를 보존해 전용 화면으로 이동합니다.
- 선택한 LCIA 결과에서 공정별 영향값·기여율과 원본 입력 근거를 검토합니다.
- 서버 저장값만 표시합니다. 브라우저에서 영향값이나 기여율을 추정하지 않습니다.

## 업무 흐름
1. 권한이 있는 프로젝트를 선택합니다.
2. 프로젝트의 LCIA 결과 버전을 선택하고 해당 결과가 참조한 입력 LCI 버전을 확인합니다.
3. 영향범주를 선택하고 공정명·ID로 결과를 찾습니다.
4. 공정별 영향값, 단위, 서버가 저장한 기여율 및 증빙 참조를 비교합니다.
5. 공정 상세에서 공정 정의의 투입·산출 흐름을 확인하고, JSON 검토자료를 내보냅니다.

## 데이터 계약
- 조회: `/home/api/emission-projects`, `/admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS`, `/admin/api/admin/lca-workspaces/LCA_IMPACT_ASSESSMENT`.
- 공정 정의는 `LCA_PRODUCT_PROCESS.payload.projectId`와 프로젝트를 연결하고 `payload.processes[]`의 `processId`, `sequence`, `name`, `inputName`, `outputName`을 사용합니다.
- LCIA 공정 결과는 `processContributions[]`, `processContributionResults[]`, `processResults[]`, `processBreakdown[]`, `processImpactResults[]`, `contributions[]` 또는 범주별 결과 안의 공정 결과 배열에서 읽습니다.
- 결과 행은 공정 식별자/명, 영향범주, 지표, 기여값, 단위, 기여율, 근거 참조, LCI 버전을 사용합니다. 입력 속성은 서버의 저장 스키마 확인과 함께 확정해야 합니다.
- 공정별 결과가 없을 때 공정 정의는 참고 목록으로 표시하고 기여도 표는 미산출 상태를 설명합니다. 합계·비율·샘플은 생성하지 않습니다.

## 제한 및 완료 조건
- 현재 계산 서비스가 공정별 상세값을 생성·저장하는지 미확인입니다. 실제 결과 데이터가 없으면 화면 구조와 기존 데이터 검토만 가능하며 공정 기여 분석 업무는 미완료입니다.
- 계산 API는 입력 LCI workspace/version, LCIA method/dataset version, category, process ID, contribution value/unit/share, evidence reference, run ID/hash를 저장해야 합니다.
- 추가로 필요한 검증은 로그인 상태에서 메뉴 이동·새로고침, 프로젝트 범위 권한, 다중 LCIA/LCI 버전 고정, 범주별 결과 필터, 공정 상세 추적, 내보내기입니다.
