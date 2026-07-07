export type FrameworkAuthorityTier =
  | "MASTER"
  | "SYSTEM"
  | "GENERAL_ADMIN"
  | "OPERATION"
  | "GENERAL_MEMBER"
  | "COMPANY"
  | "DEPARTMENT"
  | "USER"
  | "CUSTOM";

export type FrameworkAuthorityActorType = "ADMIN" | "MEMBER";

export type FrameworkAuthorityRoleContract = {
  roleKey: string;
  authorCode: string;
  label: string;
  description: string;
  tier: FrameworkAuthorityTier;
  actorType: FrameworkAuthorityActorType;
  scopePolicy: string;
  hierarchyLevel: number;
  inherits: string[];
  featureCodes: string[];
  builtIn: boolean;
  builderReady: boolean;
};

export type FrameworkAuthorityOption = {
  code: string;
  name: string;
};

export type FrameworkAuthorityText = {
  title: string;
  description: string;
};

export type FrameworkAuthorityContract = {
  policyId: string;
  frameworkId: string;
  contractVersion: string;
  generatedAt: string;
  authorityRoles: FrameworkAuthorityRoleContract[];
  roleCategoryOptions: FrameworkAuthorityOption[];
  assignmentAuthorities: FrameworkAuthorityText[];
  roleCategories: FrameworkAuthorityText[];
  allowedScopePolicies: string[];
  tierOrder: FrameworkAuthorityTier[];
};
