# 원료별 기여도 화면 설계 (H1030304)

- 주소: `/lca/material-contribution-analysis?projectId={projectId}`. 레거시 `/emission/lca?menu=H1030304`는 projectId를 보존해 전용 화면으로 이동합니다.
- 목적: 저장된 LCIA 실행 결과를 원료·보조재별로 검토하고 투입 인벤토리와 근거를 추적합니다.
- 사용자: 제품 LCA 수행자 및 해당 프로젝트 조회 권한이 있는 역할. 서버 API의 로그인/접근 정책을 따릅니다.
- 읽기 API: `GET /home/api/emission-projects?page=1&size=100`; `GET /admin/api/admin/lca-workspaces/LCA_PRODUCT_PROCESS`; `GET /admin/api/admin/lca-workspaces/LCA_MATERIAL_MAPPING`; `GET /admin/api/admin/lca-workspaces/LCA_IMPACT_ASSESSMENT`.
- 결과 필드: materialId/materialCode/flowId, materialName/flowName, processName, quantity/amount 및 단위, categoryName/impactCategory, contributionValue/characterizedValue, resultUnit/impactUnit, contributionPercent/sharePercent, LCI 버전, evidenceRef/sourceRef/datasetName.
- 화면: 프로젝트와 LCIA 버전 선택, 범주 필터, 원료 검색, 원료별 결과표, 선택 원료 상세, 인벤토리 연결, JSON 근거 내보내기, 계산 원칙과 QA 기준.
- 무결성: 기여량과 비율은 저장된 LCIA 데이터만 표시합니다. 투입량만 존재할 때 환경영향량이나 기여율을 계산하지 않습니다. API가 원료별 결과를 반환하지 않으면 빈 상태에 연결 필요를 명시합니다.
- QA: projectId URL 보존, 프로젝트별 LCIA 버전 분리, 범주 필터, 원료 상세-인벤토리 연결, 결과 없는 상태, API 실패 상태, 새로고침, 다운로드 JSON 구조 확인.
- 한계: 이 작업은 조회 화면입니다. 원료 인벤토리와 LCIA 결과의 프로젝트 단위 서버 권한, 데이터 생성·재산정 파이프라인은 기존 API 계약을 따르며 별도 쓰기 기능은 추가하지 않았습니다.
