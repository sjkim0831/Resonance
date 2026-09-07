export const EMISSION_END_TO_END_PROCESS_CODE = "EMISSION_PROJECT";

export const EMISSION_INTERNAL_PROCESS_CODES = new Set<string>([
  "ORGANIZATIONAL_BOUNDARY",
  "ACTIVITY_DATA",
  "EMISSION_CALCULATION",
  "REPORT_CERTIFICATION",
  "REGULATORY_SUBMISSION",
]);

export function emissionPhaseLabel(stepCode: string, en: boolean) {
  const labels: Record<string, [string, string]> = {
    EMISSION_PROJECT_SETUP: ["착수", "Setup"],
    EMISSION_PROJECT_COLLECT: ["활동자료 수집", "Activity data"],
    EMISSION_PROJECT_CALCULATE: ["산정·검증", "Calculation & validation"],
    EMISSION_PROJECT_VALIDATE: ["산정·검증", "Calculation & validation"],
    EMISSION_PROJECT_CORRECT: ["산정·검증", "Calculation & validation"],
    EMISSION_PROJECT_APPROVE: ["승인", "Approval"],
    EMISSION_PROJECT_REPORT: ["보고·인증", "Reporting & certification"],
  };
  return labels[stepCode]?.[en ? 1 : 0] || (en ? "Work" : "업무");
}

export function parentEmissionStepCode(processCode: string) {
  const steps: Record<string, string> = {
    ORGANIZATIONAL_BOUNDARY: "EMISSION_PROJECT_SETUP",
    ACTIVITY_DATA: "EMISSION_PROJECT_COLLECT",
    EMISSION_CALCULATION: "EMISSION_PROJECT_CALCULATE",
    REPORT_CERTIFICATION: "EMISSION_PROJECT_REPORT",
    REGULATORY_SUBMISSION: "EMISSION_PROJECT_REPORT",
  };
  return steps[processCode] || "";
}

export function isCustomerVisibleEmissionProcess(processCode: string) {
  return !EMISSION_INTERNAL_PROCESS_CODES.has(processCode);
}
