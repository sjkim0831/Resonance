import type { FrameworkBuilderContract } from "../contracts";
import { apiFetch, buildAdminApiPath, readJsonResponse } from "../../lib/api/core";

export async function fetchFrameworkBuilderContract(): Promise<FrameworkBuilderContract> {
  const response = await apiFetch(buildAdminApiPath("/api/admin/framework/builder-contract"), {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to load framework builder contract: ${response.status}`);
  }
  return readJsonResponse<FrameworkBuilderContract>(response);
}
