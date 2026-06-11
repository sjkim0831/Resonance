import { apiFetch, buildAdminApiPath, buildQueryString, readJsonResponse } from "./core";

export type HermesStatusPayload = {
  generatedAt?: string;
  version?: string;
  activeSessions?: number;
  gatewayStatus?: string;
  gatewayPlatforms?: Array<{ name: string; status: string }>;
  hermesHome?: string;
};

export type HermesModelsPayload = {
  generatedAt?: string;
  models?: Array<Record<string, unknown>>;
  availableModels?: Array<Record<string, unknown>>;
  summary?: Record<string, string>;
};

export type HermesSessionsPayload = {
  generatedAt?: string;
  sessions?: Array<Record<string, unknown>>;
  recentSessions?: Array<Record<string, unknown>>;
  summary?: Record<string, string>;
};

export type HermesLogsPayload = {
  generatedAt?: string;
  logs?: string[];
  summary?: Record<string, string>;
};

export type HermesSkillsPayload = {
  generatedAt?: string;
  skills?: Array<Record<string, unknown>>;
  summary?: Record<string, string>;
};

const HERMES_API_BASE = "/admin/ai/hermes";

function fetchHermesData<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const query = params ? buildQueryString(params as Record<string, string | undefined>) : "";
  const response = apiFetch(buildAdminApiPath(HERMES_API_BASE + "/" + endpoint + query), {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
  return response.then(readJsonResponse<T>);
}

export function fetchHermesStatus() {
  return fetchHermesData<HermesStatusPayload>("status");
}

export function fetchHermesModels() {
  return fetchHermesData<HermesModelsPayload>("models");
}

export function fetchHermesSessions(limit = 20, offset = 0) {
  return fetchHermesData<HermesSessionsPayload>("sessions", { limit, offset });
}

export function fetchHermesLogs(component?: string, lines = 100) {
  return fetchHermesData<HermesLogsPayload>("logs", { component, lines });
}

export function fetchHermesSkills() {
  return fetchHermesData<HermesSkillsPayload>("skills");
}

export async function pullHermesModel(modelName: string): Promise<{ result: string }> {
  const response = await apiFetch(buildAdminApiPath(HERMES_API_BASE + "/models/pull"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify({ modelName })
  });
  return readJsonResponse<{ result: string }>(response);
}

export async function deleteHermesModel(modelName: string): Promise<{ result: string }> {
  const response = await apiFetch(buildAdminApiPath(HERMES_API_BASE + "/models/delete"), {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify({ modelName })
  });
  return readJsonResponse<{ result: string }>(response);
}