export type LayoutZone = "header" | "sidebar" | "content" | "footer" | "actions";

export type GovernanceAxis =
  | "COMPANY"
  | "ADMIN_ACCOUNT"
  | "MEMBER_ACCOUNT"
  | "MEMBER_TYPE"
  | "COMMON_CODE"
  | "MENU"
  | "PAGE"
  | "FUNCTION"
  | "ROLE";

export type GovernanceRoleCategory = "GENERAL" | "TYPE" | "DEPARTMENT" | "ADMIN" | "MEMBER";

export type ComponentGovernanceManifest = {
  ownerAxes?: GovernanceAxis[];
  targetAxes?: GovernanceAxis[];
  requiredRoleCategories?: GovernanceRoleCategory[];
  commonCodeGroups?: string[];
  featureCodes?: string[];
  allowAllScope?: boolean;
  requireActorInsttId?: boolean;
  allowedActorKinds?: Array<"ADMIN" | "MEMBER" | "ANONYMOUS">;
  allowedMemberTypes?: Array<"E" | "P" | "C" | "G">;
  enforceOwnCompanyScope?: boolean;
  enforceTargetCompanyMatch?: boolean;
  restrictTargetCompanyOutput?: boolean;
  listPolicyKey?: string;
  actionPolicyKey?: string;
};

export type PageComponentManifest = {
  componentId: string;
  instanceKey: string;
  layoutZone: LayoutZone;
  propsSummary?: string[];
  conditionalRuleSummary?: string;
  governance?: ComponentGovernanceManifest;
};

export type PageManifest = {
  pageId: string;
  routePath: string;
  menuCode?: string;
  domainCode: "admin" | "platform" | "join" | "home";
  layoutVersion: string;
  designTokenVersion: string;
  governance?: ComponentGovernanceManifest;
  components: PageComponentManifest[];
};
