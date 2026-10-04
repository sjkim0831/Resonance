import { assertFiveLayerContract, type FiveLayerScreenContract } from "../contract-runtime/fiveLayerContract";

const option = (value: string, labelKo: string, labelEn: string) => ({ value, labelKo, labelEn });
export const EMISSION_PROJECT_CREATE_CONTRACT = assertFiveLayerContract({
  version: "1.0",
  screen: { contractId: "EMISSION_PROJECT_CREATE_V1", route: "/emission/project/create", nameKo: "배출량 프로젝트 등록", nameEn: "New Emission Project", purposeKo: "프로젝트 기간, 사업장, 산정 범위와 기준을 등록해 배출량 업무를 시작합니다.", purposeEn: "Define the project period, sites, emissions scope, and criteria." },
  dataSchema: { fields: [
    { code: "name", nameKo: "프로젝트명", nameEn: "Project name", type: "TEXT", section: "basic", required: true, validation: { maxLength: 200 } },
    { code: "sites", nameKo: "참여 사업장", nameEn: "Participating sites", type: "MULTI_CHECKBOX", section: "basic", required: true, optionSource: { code: "ACTIVE_SITES", emptyLabelKo: "등록 사업장 선택", emptyLabelEn: "Select a registered site" } },
    { code: "reportingYear", nameKo: "보고연도", nameEn: "Reporting year", type: "NUMBER", section: "basic", required: true, validation: { min: 2000, max: 2100, step: 1 } },
    { code: "description", nameKo: "설명", nameEn: "Description", type: "TEXT", section: "basic", required: false, validation: { maxLength: 2000 } },
    { code: "dueDate", nameKo: "업무 마감일", nameEn: "Due date", type: "DATE", section: "schedule", required: true },
    { code: "scopes", nameKo: "산정 Scope", nameEn: "Calculation scopes", type: "MULTI_CHECKBOX", section: "scope", required: true, options: [option("Scope 1", "Scope 1", "Scope 1"), option("Scope 2", "Scope 2", "Scope 2"), option("Scope 3", "Scope 3", "Scope 3")] },
    { code: "periodStart", nameKo: "산정 시작일", nameEn: "Start date", type: "DATE", section: "scope", required: true },
    { code: "periodEnd", nameKo: "산정 종료일", nameEn: "End date", type: "DATE", section: "scope", required: true },
    { code: "organizationBoundary", nameKo: "조직 경계", nameEn: "Organization boundary", type: "SELECT", section: "methodology", required: true, options: [option("OPERATIONAL_CONTROL", "운영 통제", "Operational control"), option("FINANCIAL_CONTROL", "재무 통제", "Financial control"), option("EQUITY_SHARE", "지분 할당", "Equity share")] },
    { code: "emissionStandard", nameKo: "적용 표준", nameEn: "Emission standard", type: "SELECT", section: "methodology", required: true, options: [option("ISO_14064_1", "ISO 14064-1", "ISO 14064-1"), option("GHG_PROTOCOL", "GHG Protocol", "GHG Protocol"), option("K_ETS", "배출권거래제 명세서 기준", "K-ETS")] },
    { code: "methodologyVersion", nameKo: "방법론 버전", nameEn: "Methodology version", type: "TEXT", section: "methodology", required: true, validation: { maxLength: 40 } },
    { code: "verificationLevel", nameKo: "검증 수준", nameEn: "Verification level", type: "SELECT", section: "methodology", required: true, options: [option("LIMITED", "제한적 보증", "Limited assurance"), option("REASONABLE", "합리적 보증", "Reasonable assurance")] },
    { code: "collectionCycle", nameKo: "자료 수집 주기", nameEn: "Collection cycle", type: "SELECT", section: "methodology", required: true, options: [option("MONTHLY", "월간", "Monthly"), option("QUARTERLY", "분기", "Quarterly"), option("ANNUAL", "연간", "Annual")] },
    { code: "materialityThreshold", nameKo: "중요성 기준 (%)", nameEn: "Materiality threshold (%)", type: "NUMBER", section: "methodology", required: true, helpKo: "누락 및 검증 발견사항의 중요도 판정 기준입니다.", helpEn: "Used to prioritize omissions and verification findings.", validation: { min: 0, max: 100, step: 1 } },
  ] },
  uiSchema: { sections: [
    { code: "basic", order: 1, nameKo: "프로젝트 기본정보", nameEn: "Project information", columns: 2 },
    { code: "organization", order: 2, nameKo: "조직·사업장", nameEn: "Organization and sites", columns: 2 },
    { code: "scope", order: 3, nameKo: "산정 범위·기준", nameEn: "Calculation scope and criteria", descriptionKo: "조직 경계·표준·방법론·검증 수준·수집 주기·중요성 기준은 프로젝트 생성 시점 값으로 고정합니다.", descriptionEn: "Boundary, standard, methodology, assurance, collection cycle and materiality are fixed with the project.", columns: 2 },
    { code: "schedule", order: 4, nameKo: "자료 제출 일정", nameEn: "Data collection schedule", columns: 2 },
  ], responsive: { mobileColumns: 1, tabletColumns: 2, desktopColumns: 2 }, accessibility: { requiredMarker: true, errorSummary: true, labelStrategy: "explicit" } },
  actionSchema: { commands: [{ code: "CREATE", method: "POST", path: "/home/api/emission-project-drafts" }] },
  processSchema: { processCode: "EMISSION_PROJECT", stepCode: "EMISSION_PROJECT_SETUP", states: ["RUNNING"], entryCondition: "회사 등록 권한 및 사용 가능한 사업장", exitCondition: "프로젝트 설정 저장 후 상세 화면으로 이동" },
  permissionSchema: { actorCodes: ["COMPANY_MANAGER"], actions: ["READ", "CREATE"] },
} satisfies FiveLayerScreenContract);
