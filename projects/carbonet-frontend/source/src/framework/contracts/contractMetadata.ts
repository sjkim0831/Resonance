import type { FrameworkBuilderProfiles } from "./builderContract";
import type { FrameworkAuthorityTier } from "./authorityContract";

export type FrameworkAuthorityDefaults = {
  allowedScopePolicies: string[];
  tierOrder: FrameworkAuthorityTier[];
};

export type FrameworkContractMetadata = {
  frameworkId: string;
  frameworkName: string;
  contractVersion: string;
  authorityPolicyId: string;
  builderProfiles: FrameworkBuilderProfiles;
  authorityDefaults: FrameworkAuthorityDefaults;
};
