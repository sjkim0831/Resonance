import { buildAdminApiPath, readJsonResponse, apiFetch } from "./core";

export type CommandPayload = {
  exitCode?: number;
  output?: string;
  status?: string;
};

export type OperationsInventoryPayload = {
  generatedAt?: string;
  runtime?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  installedPrograms?: Array<Record<string, unknown>>;
  kubernetes?: Record<string, CommandPayload>;
  logs?: Array<Record<string, string>>;
  aiHangar?: Array<Record<string, string>>;
  themes?: Array<Record<string, string>>;
  automation?: Array<Record<string, string>>;
};

export async function fetchOperationsInventory() {
  const response = await apiFetch(buildAdminApiPath("/system/operations/page-data"), {
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to load operations inventory: ${response.status}`);
  }
  return readJsonResponse<OperationsInventoryPayload>(response);
}
