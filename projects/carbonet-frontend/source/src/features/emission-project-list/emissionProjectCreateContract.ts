import { assertFiveLayerContract, type FiveLayerScreenContract } from "../contract-runtime/fiveLayerContract";

const option = (value: string, labelKo: string, labelEn: string) => ({ value, labelKo, labelEn });
export const EMISSION_PROJECT_CREATE_CONTRACT = assertFiveLayerContract({
  version: "1.0",
  screen: { contractId: "EMISSION_PROJECT_CREATE_V1", route: "/emission/project/create", nameKo: "배출량 프로젝트 등록", nameEn: "New Emission Project", purposeKo: "조직 경계, 산정 기준, 담당자와 일정을 확정해 배출량 업무를 시작합니다.", purposeEn: "Define the organizational boundary, methodology, owners and schedule." },
  dataSchema: { fields: [
    { code: "organizationBoundary", nameKo: "조직 경계", nameEn: "Organization boundary", type: "SELECT", section: "methodology", required: true, options: [option("OPERATIONAL_CONTROL", "운영 통제", "Operational control"), option("FINANCIAL_CONTROL", "재무 통제", "Financial control"), option("EQUITY_SHARE", "지분 할당", "Equity share")] },
    { code: "emissionStandard", nameKo: "적용 표준", nameEn: "Emission standard", type: "SELECT", section: "methodology", required: true, options: [option("ISO_14064_1", "ISO 14064-1", "ISO 14064-1"), option("GHG_PROTOCOL", "GHG Protocol", "GHG Protocol"), option("K_ETS", "배출권거래제 명세서 기준", "K-ETS")] },
    { code: "methodologyVersion", nameKo: "방법론 버전", nameEn: "Methodology version", type: "TEXT", section: "methodology", required: true, validation: { maxLength: 40 } },
    { code: "verificationLevel", nameKo: "검증 수준", nameEn: "Verification level", type: "SELECT", section: "methodology", required: true, options: [option("LIMITED", "제한적 보증", "Limited assurance"), option("REASONABLE", "합리적 보증", "Reasonable assurance")] },
    { code: "collectionCycle", nameKo: "자료 수집 주기", nameEn: "Collection cycle", type: "SELECT", section: "methodology", required: true, options: [option("MONTHLY", "월간", "Monthly"), option("QUARTERLY", "분기", "Quarterly"), option("ANNUAL", "연간", "Annual")] },
    { code: "materialityThreshold", nameKo: "중요성 기준 (%)", nameEn: "Materiality threshold (%)", type: "NUMBER", section: "methodology", required: true, helpKo: "누락 및 검증 발견사항의 중요도 판정 기준입니다.", helpEn: "Used to prioritize omissions and verification findings.", validation: { min: 0, max: 100, step: 1 } },
    { code: "owner", nameKo: "프로젝트 총괄 책임자", nameEn: "Project accountable manager", type: "SELECT", section: "ownership", required: true, helpKo: "프로젝트 범위·담당자·마감·최종 보고를 책임합니다.", helpEn: "Owns project scope, assignments, deadlines, and final reporting.", optionSource: { code: "COMPANY_MANAGER_ACCOUNTS", actorCode: "COMPANY_MANAGER", emptyLabelKo: "같은 회사의 기업관리자 선택", emptyLabelEn: "Select a company manager" } },
    { code: "dueDate", nameKo: "마감일", nameEn: "Due date", type: "DATE", section: "ownership", required: true },
    { code: "dataOwner", nameKo: "사업장 자료 담당자", nameEn: "Site data owner", type: "SELECT", section: "actors", required: true, helpKo: "선택 사업장의 원천 활동자료 입력·증빙 제출", helpEn: "Collects and submits source activity data", optionSource: { code: "SITE_DATA_OWNER_ACCOUNTS", actorCode: "SITE_DATA_OWNER", emptyLabelKo: "자격이 있는 계정 선택", emptyLabelEn: "Select an eligible account" } },
    { code: "calculator", nameKo: "배출량 산정 담당자", nameEn: "Emission calculator", type: "SELECT", section: "actors", required: true, helpKo: "배출계수 매핑·단위 환산·배출량 산정", helpEn: "Maps factors and runs calculations", optionSource: { code: "CALCULATOR_ACCOUNTS", actorCode: "CALCULATOR", emptyLabelKo: "자격이 있는 계정 선택", emptyLabelEn: "Select an eligible account" } },
    { code: "verifier", nameKo: "검증 담당자", nameEn: "Verifier", type: "SELECT", section: "actors", required: true, helpKo: "산정 결과·증빙 검증 및 보완 요청", helpEn: "Verifies results and requests corrections", optionSource: { code: "VERIFIER_ACCOUNTS", actorCode: "VERIFIER", emptyLabelKo: "자격이 있는 계정 선택", emptyLabelEn: "Select an eligible account" } },
    { code: "approver", nameKo: "승인 담당자", nameEn: "Approver", type: "SELECT", section: "actors", required: true, helpKo: "검증 완료 산정 결과의 최종 승인", helpEn: "Approves the verified calculation", optionSource: { code: "APPROVER_ACCOUNTS", actorCode: "APPROVER", emptyLabelKo: "자격이 있는 계정 선택", emptyLabelEn: "Select an eligible account" } },
  ] },
  uiSchema: { sections: [
    { code: "methodology", order: 3, nameKo: "조직 경계·산정 기준", nameEn: "Boundary and methodology", descriptionKo: "승인된 산정 결과가 기준정보 변경에 영향을 받지 않도록 프로젝트 생성 시점의 값으로 버전 고정합니다.", descriptionEn: "These values are versioned with the project so later standard changes do not alter approved calculations.", columns: 2 },
    { code: "ownership", order: 4, nameKo: "총괄 책임자·일정", nameEn: "Owner and schedule", columns: 2 },
    { code: "actors", order: 5, nameKo: "단계별 담당자 배정", nameEn: "Actor assignment", descriptionKo: "프로세스 단계별 책임 계정을 지정합니다. 이 배정을 기준으로 권한과 내 업무가 자동 생성됩니다.", descriptionEn: "Assign the accountable user for each process step. Permissions and My Tasks are generated from these assignments.", columns: 2 },
  ], responsive: { mobileColumns: 1, tabletColumns: 2, desktopColumns: 2 }, accessibility: { requiredMarker: true, errorSummary: true, labelStrategy: "explicit" } },
  actionSchema: { commands: [{ code: "CREATE", method: "POST", path: "/home/api/emission-projects" }] },
  processSchema: { processCode: "EMISSION_PROJECT", stepCode: "EMISSION_PROJECT_SETUP", states: ["DRAFT", "RUNNING"], entryCondition: "기업, 사업장 및 필수 액터 준비 완료", exitCondition: "프로젝트와 단계별 담당자 배정 저장 완료" },
  permissionSchema: { actorCodes: ["COMPANY_MANAGER"], actions: ["READ", "CREATE"] },
} satisfies FiveLayerScreenContract);
