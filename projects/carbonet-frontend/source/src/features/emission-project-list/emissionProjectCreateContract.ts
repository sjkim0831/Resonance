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
  ] },
  uiSchema: { sections: [{ code: "methodology", order: 3, nameKo: "조직 경계·산정 기준", nameEn: "Boundary and methodology", descriptionKo: "승인된 산정 결과가 기준정보 변경에 영향을 받지 않도록 프로젝트 생성 시점의 값으로 버전 고정합니다.", descriptionEn: "These values are versioned with the project so later standard changes do not alter approved calculations.", columns: 2 }], responsive: { mobileColumns: 1, tabletColumns: 2, desktopColumns: 2 }, accessibility: { requiredMarker: true, errorSummary: true, labelStrategy: "explicit" } },
  actionSchema: { commands: [{ code: "CREATE", method: "POST", path: "/home/api/emission-projects" }] },
  processSchema: { processCode: "EMISSION_PROJECT", stepCode: "EMISSION_PROJECT_SETUP", states: ["DRAFT", "RUNNING"], entryCondition: "기업, 사업장 및 필수 액터 준비 완료", exitCondition: "프로젝트와 단계별 담당자 배정 저장 완료" },
  permissionSchema: { actorCodes: ["COMPANY_MANAGER"], actions: ["READ", "CREATE"] },
} satisfies FiveLayerScreenContract);
