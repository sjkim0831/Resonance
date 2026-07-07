import { apiFetch, buildAdminApiPath, readJsonResponse } from "../../lib/api/core";
import { getFrameworkContractMetadata } from "../contractMetadata";
import type { FrameworkAuthorityContract } from "../contracts";

export async function fetchFrameworkAuthorityContract(): Promise<FrameworkAuthorityContract> {
  const response = await apiFetch(buildAdminApiPath("/api/admin/framework/authority-contract"), {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(`Failed to load framework authority contract: ${response.status}`);
  }
  const contract = await readJsonResponse<FrameworkAuthorityContract>(response);
  return normalizeFrameworkAuthorityContract(contract);
}

export function normalizeFrameworkAuthorityContract(contract: FrameworkAuthorityContract): FrameworkAuthorityContract {
  const metadata = getFrameworkContractMetadata();
  return {
    ...contract,
    policyId: contract.policyId || metadata.authorityPolicyId,
    frameworkId: contract.frameworkId || metadata.frameworkId,
    contractVersion: contract.contractVersion || metadata.contractVersion,
    allowedScopePolicies:
      contract.allowedScopePolicies.length > 0
        ? contract.allowedScopePolicies
        : metadata.authorityDefaults.allowedScopePolicies,
    tierOrder:
      contract.tierOrder.length > 0
        ? contract.tierOrder
        : metadata.authorityDefaults.tierOrder
  };
}
