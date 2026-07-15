import { apiFetch, buildAdminApiPath, buildQueryString, readJsonResponse } from "./core";

export type AiDashboardPayload = { generatedAt?: string; modelCount?: string; ragChunkCount?: string; todayInferences?: string; avgLatency?: string; modelHealth?: Array<Record<string, string>>; gpuUsage?: string; gpuPercent?: string; vramUsage?: string; vramPercent?: string; cpuUsage?: string; cpuPercent?: string; memoryUsage?: string; memoryPercent?: string; recentActivity?: Array<Record<string, string>>; };
export type AiModelsPayload = { generatedAt?: string; models?: Array<Record<string, unknown>>; summary?: Record<string, unknown>; };
export type AiRagPayload = { generatedAt?: string; documents?: Array<Record<string, unknown>>; chunks?: Array<Record<string, unknown>>; vectordb?: Array<Record<string, unknown>>; verify?: Array<Record<string, unknown>>; summary?: Record<string, string>; };
export type KrdsCodeGenerationResult = { generationId: string; model: string; pipeline: string[]; retrievedSources: Array<Record<string, unknown>>; wcagStatus: "PASS" | "REJECTED"; violations: string[]; code: string; durationMs: number; message: string; };
export type AiTrainingPayload = { generatedAt?: string; datasets?: Array<Record<string, unknown>>; candidates?: Array<Record<string, unknown>>; lora?: Array<Record<string, unknown>>; jobs?: Array<Record<string, unknown>>; history?: Array<Record<string, unknown>>; summary?: Record<string, string>; };
export type AiAgentsPayload = { generatedAt?: string; agents?: Array<Record<string, unknown>>; tools?: Array<Record<string, unknown>>; workflows?: Array<Record<string, unknown>>; summary?: Record<string, unknown>; };
export type AiLogsPayload = { generatedAt?: string; conversations?: Array<Record<string, unknown>>; tasks?: Array<Record<string, unknown>>; errors?: Array<Record<string, unknown>>; toolCalls?: Array<Record<string, unknown>>; inferences?: Array<Record<string, unknown>>; summary?: Record<string, unknown>; };
export type AiQualityPayload = { generatedAt?: string; evaluations?: Array<Record<string, unknown>>; feedback?: Array<Record<string, unknown>>; hallucinationCases?: Array<Record<string, unknown>>; accuracyTrend?: Array<Record<string, unknown>>; abTests?: Array<Record<string, unknown>>; summary?: Record<string, unknown>; };
export type AiObservabilityPayload = { generatedAt?: string; traces?: Array<Record<string, unknown>>; prompts?: Array<Record<string, unknown>>; tokenUsage?: Array<Record<string, unknown>>; contextAnalyses?: Array<Record<string, unknown>>; failures?: Array<Record<string, unknown>>; summary?: Record<string, unknown>; };
export type CustomerRuntimeFinding = { findingId: string; path: string; httpStatus: number; state: string; remediation: string; automaticDeploy: boolean };
export type CustomerTraceSummary = { traceCount?: number; modelOutputCount?: number; sourceEvidenceCount?: number; httpPathCount?: number; httpSummary?: Record<string, number>; customerMaturity?: { score?: number; grade?: string }; deliveryReadiness?: { score?: number; grade?: string }; srRequestCount?: number; runtimeFindingCount?: number; runtimeFindings?: CustomerRuntimeFinding[]; approvalStateSummary?: Record<string, number>; };
export type CustomerTraceCandidate = { assetId?: string; routePath?: string; contract?: string; agreementCount?: number; confidence?: number; httpEvidence?: { httpStatus?: number; classification?: string; functionalVerification?: string } };
export type CustomerTraceRow = { useCaseId: string; traceId: string; title: string; domain: string; bindingStatus: string; pageCandidates?: CustomerTraceCandidate[]; apiCandidates?: CustomerTraceCandidate[]; srRequestIds?: string[]; };
export type CustomerTraceList = { items?: CustomerTraceRow[]; total?: number; offset?: number; limit?: number; };
export type CustomerTraceDetail = { binding: CustomerTraceRow; approval?: { state?: string; reviewer?: string; reviewedAt?: string; evidenceRefs?: string[]; comment?: string }; srRequests?: Array<{ requestId?: string; summary?: string; approvalStatus?: string; executeAutomatically?: boolean }> };

const AI_API_BASE = "/admin/ai";

async function fetchAiData<T>(endpoint: string, filters?: Record<string, string | undefined>): Promise<T> {
  const query = buildQueryString(filters || {});
  const response = await apiFetch(buildAdminApiPath(AI_API_BASE + "/" + endpoint + query), {
    credentials: "include", cache: "no-store",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
  if (!response.ok) throw new Error("Failed to load " + endpoint + ": " + response.status);
  return readJsonResponse<T>(response);
}

export function fetchAiDashboard() { return fetchAiData<AiDashboardPayload>("dashboard/page-data"); }
export function fetchAiModels(f?: { status?: string; provider?: string }) { return fetchAiData<AiModelsPayload>("models/page-data", f as Record<string, string | undefined>); }
export function fetchAiTraining(f?: { status?: string; type?: string }) { return fetchAiData<AiTrainingPayload>("training/page-data", f as Record<string, string | undefined>); }
export function fetchAiRag(f?: { status?: string; source?: string }) { return fetchAiData<AiRagPayload>("rag/page-data", f as Record<string, string | undefined>); }
export async function generateKrdsCode(payload: { prompt: string; target: "REACT_TSX" | "HTML" | "SECTION" | "COMPONENT" }) {
  const response = await apiFetch(buildAdminApiPath(AI_API_BASE + "/rag/krds-code"), {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("KRDS code generation failed: " + response.status);
  return readJsonResponse<KrdsCodeGenerationResult>(response);
}
export function fetchAiAgents(f?: { status?: string }) { return fetchAiData<AiAgentsPayload>("agents/page-data", f as Record<string, string | undefined>); }
export function fetchAiLogs(f?: { logType?: string; level?: string; from?: string; to?: string }) { return fetchAiData<AiLogsPayload>("logs/page-data", f as Record<string, string | undefined>); }
export function fetchAiQuality(f?: { period?: string; modelId?: string }) { return fetchAiData<AiQualityPayload>("quality/page-data", f as Record<string, string | undefined>); }
export function fetchAiObservability(f?: { traceId?: string; modelId?: string }) { return fetchAiData<AiObservabilityPayload>("observability/page-data", f as Record<string, string | undefined>); }

async function fetchCustomerTraceData<T>(endpoint: string, filters?: Record<string, string | undefined>): Promise<T> {
  const query = buildQueryString(filters || {});
  const response = await apiFetch(buildAdminApiPath(`/api/platform/customer-trace/${endpoint}${query}`), {
    credentials: "include", cache: "no-store", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
  if (!response.ok) throw new Error(`Failed to load customer trace ${endpoint}: ${response.status}`);
  return readJsonResponse<T>(response);
}
export function fetchCustomerTraceSummary() { return fetchCustomerTraceData<CustomerTraceSummary>("summary"); }
export function fetchCustomerTraces(f?: { domain?: string; query?: string; offset?: string; limit?: string }) { return fetchCustomerTraceData<CustomerTraceList>("traces", f as Record<string, string | undefined>); }
export function fetchCustomerTrace(useCaseId: string) { return fetchCustomerTraceData<CustomerTraceDetail>("trace", { useCaseId }); }
export async function updateCustomerTraceApproval(payload: { useCaseId: string; state: string; evidenceRefs: string[]; comment: string }) {
  const response = await apiFetch(buildAdminApiPath("/api/platform/customer-trace/approval"), {
    method: "POST", credentials: "include", cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Failed to update customer trace approval: ${response.status}`);
  return readJsonResponse<Record<string, unknown>>(response);
}
