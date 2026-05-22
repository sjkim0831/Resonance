import { apiFetch, buildAdminApiPath, buildQueryString, readJsonResponse } from "./core";

export type HermesWorkflowPayload = {
  generatedAt?: string;
  isEn?: boolean;
  filters?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  tasks?: Array<Record<string, unknown>>;
  selectedTaskId?: string;
  steps?: Array<Record<string, unknown>>;
  interpretations?: Array<Record<string, unknown>>;
  executions?: Array<Record<string, unknown>>;
  verifications?: Array<Record<string, unknown>>;
  modelDecisions?: Array<Record<string, unknown>>;
  failurePatterns?: Array<Record<string, unknown>>;
  stageTemplates?: Array<Record<string, unknown>>;
  message?: string;
};

export async function fetchHermesWorkflowPage(filters?: { status?: string; taskType?: string; keyword?: string }) {
  const query = buildQueryString({
    status: filters?.status,
    taskType: filters?.taskType,
    keyword: filters?.keyword
  });
  const response = await apiFetch(buildAdminApiPath(`/system/hermes-workflow/page-data${query}`), {
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load Hermes workflow page: ${response.status}`);
  }
  return readJsonResponse<HermesWorkflowPayload>(response);
}
