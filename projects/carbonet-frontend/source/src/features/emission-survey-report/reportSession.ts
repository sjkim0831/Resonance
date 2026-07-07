export const EMISSION_SURVEY_REPORT_SESSION_KEY = "carbonet:emission-survey-report";
export const EMISSION_SURVEY_OUTPUT_SECTION_CODE = "OUTPUT_PRODUCTS";

export type EmissionSurveyReportRow = {
  rowId: string;
  sectionCode: string;
  sectionLabel: string;
  majorCode: string;
  group: string;
  materialName: string;
  amount: number;
  amountText: string;
  originalAmount: number;
  originalAmountText: string;
  unit: string;
  emissionFactor: number;
  emissionFactorText: string;
  totalEmission: number;
  sourceMode: string;
  note: string;
  calculated: boolean;
  warning: string;
};

export type EmissionSurveyReportSectionSummary = {
  sectionCode: string;
  sectionLabel: string;
  majorCode: string;
  rowCount: number;
  calculatedRowCount: number;
  totalEmission: number;
  sharePercent: number;
  sourceMode: string;
};

export type EmissionSurveyScenarioCard = {
  label: string;
  totalEmission: number;
  deltaPercent: number;
  tone: "current" | "conservative" | "optimized";
  description: string;
};

export type EmissionSurveyAlertItem = {
  title: string;
  description: string;
  tone: "warning" | "info";
};

export type EmissionSurveyNormalizationSummary = {
  outputQuantityTotal: number;
  factor: number;
  applied: boolean;
};

export type EmissionSurveyReportPayload = {
  generatedAt: string;
  productName: string;
  pageTitle: string;
  classification: {
    majorLabel: string;
    middleLabel: string;
    smallLabel: string;
  };
  calculationScope: {
    categoryName: string;
    tierLabel: string;
    factorCount: number;
  };
  summary: {
    totalEmission: number;
    rowCount: number;
    calculatedRowCount: number;
    warningCount: number;
    dataConfidence: number;
    topContributorLabel: string;
    topContributorSharePercent: number;
  };
  normalization: EmissionSurveyNormalizationSummary;
  sectionSummaries: EmissionSurveyReportSectionSummary[];
  rows: EmissionSurveyReportRow[];
  scenarios: EmissionSurveyScenarioCard[];
  alerts: EmissionSurveyAlertItem[];
};

export function saveEmissionSurveyReportSession(payload: EmissionSurveyReportPayload) {
  window.sessionStorage.setItem(EMISSION_SURVEY_REPORT_SESSION_KEY, JSON.stringify(payload));
}

export function loadEmissionSurveyReportSession(): EmissionSurveyReportPayload | null {
  const raw = window.sessionStorage.getItem(EMISSION_SURVEY_REPORT_SESSION_KEY) || "";
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as EmissionSurveyReportPayload;
  } catch {
    return null;
  }
}
