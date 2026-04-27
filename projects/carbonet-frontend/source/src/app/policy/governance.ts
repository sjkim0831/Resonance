export type GovernanceUserKind = "ADMIN" | "MEMBER" | "ANONYMOUS";
export type GovernanceMemberType = "E" | "P" | "C" | "G" | "";
export type GovernancePageType = "LIST" | "DETAIL" | "EDIT" | "CREATE" | "APPROVE" | "WORKSPACE";
export type GovernanceComponentType = "LIST" | "FORM_FIELD" | "COMBO" | "POPUP" | "TAB" | "ACTION_BAR" | "BUTTON" | "SUMMARY";
export type GovernanceTargetType = "SELF" | "MEMBER" | "ADMIN_ACCOUNT" | "COMPANY" | "DEPARTMENT" | "ROLE" | "COMMON_CODE" | "LIST";
export type GovernanceCardinality = "SINGLE" | "MULTI";
export type GovernanceActionType = "VIEW" | "SEARCH" | "CREATE" | "UPDATE" | "DELETE" | "EXECUTE" | "APPROVE" | "EXPORT";
export type GovernanceVisibility = "VISIBLE" | "HIDDEN";
export type GovernanceInteraction = "ENABLED" | "DISABLED" | "READONLY";
export type GovernanceScope = "GLOBAL" | "OWN_COMPANY" | "OWN_DEPT" | "SELF" | "TARGET_COMPANY_MATCH";
export type GovernanceRoleLayer = "BASE" | "GENERAL" | "DEPARTMENT" | "USER_OVERRIDE";

export type GovernanceActorContext = {
  authenticated: boolean;
  userId: string;
  actualUserId: string;
  userKind: GovernanceUserKind;
  memberType: GovernanceMemberType;
  authorCode: string;
  insttId: string;
  deptId?: string;
  master: boolean;
  baseRoleCodes?: string[];
  generalRoleCodes?: string[];
  departmentRoleCodes?: string[];
  userOverrideFeatureCodes?: string[];
};

export type GovernancePageContext = {
  pageId: string;
  menuCode?: string;
  routePath: string;
  domainCode: "admin" | "home";
  pageType: GovernancePageType;
};

export type GovernanceComponentContext = {
  componentId: string;
  instanceKey?: string;
  componentType: GovernanceComponentType;
  policyKey?: string;
  dataSourceKey?: string;
  designVariantId?: string;
  helpId?: string;
};

export type GovernanceTargetContext = {
  targetType: GovernanceTargetType;
  cardinality: GovernanceCardinality;
  targetId?: string;
  targetInsttId?: string;
  targetDeptId?: string;
  targetMemberType?: GovernanceMemberType;
  targetState?: string;
};

export type GovernanceRuntimeContext = {
  requestedInsttId?: string;
  requestedDeptId?: string;
  requestedMemberType?: GovernanceMemberType;
  requestedStatus?: string;
  searchKeyword?: string;
  selectedIds?: string[];
  queryParams?: Record<string, unknown>;
};

export type GovernanceDecision = {
  allowed: boolean;
  visibility: GovernanceVisibility;
  interaction: GovernanceInteraction;
  scope: GovernanceScope;
  resolvedInsttId?: string;
  resolvedDeptId?: string;
  resolvedMemberTypes?: GovernanceMemberType[];
  requiredFeatureCodes?: string[];
  contributingRoleLayers?: GovernanceRoleLayer[];
  reasonCodes?: string[];
};

export type GovernanceDecisionRequest = {
  actor: GovernanceActorContext;
  page: GovernancePageContext;
  component?: GovernanceComponentContext;
  target?: GovernanceTargetContext;
  action: GovernanceActionType;
  context?: GovernanceRuntimeContext;
};

export type GovernanceComponentRule = {
  allowAllScope?: boolean;
  requireActorInsttId?: boolean;
  allowedActorKinds?: GovernanceUserKind[];
  allowedMemberTypes?: GovernanceMemberType[];
  enforceOwnCompanyScope?: boolean;
  enforceTargetCompanyMatch?: boolean;
  restrictTargetCompanyOutput?: boolean;
  requiredFeatureCodes?: string[];
};

export interface GovernancePolicyEngine {
  evaluate(request: GovernanceDecisionRequest): GovernanceDecision;
}

export function createDefaultDeniedDecision(reasonCodes: string[] = []): GovernanceDecision {
  return {
    allowed: false,
    visibility: "HIDDEN",
    interaction: "DISABLED",
    scope: "SELF",
    reasonCodes
  };
}

export function evaluateDefaultGovernanceDecision(
  request: GovernanceDecisionRequest,
  rule: GovernanceComponentRule = {}
): GovernanceDecision {
  const actor = request.actor;
  const target = request.target;
  const runtime = request.context;
  const reasonCodes: string[] = [];
  const allowedActorKinds = rule.allowedActorKinds || [];
  const allowedMemberTypes = (rule.allowedMemberTypes || []).filter((value): value is GovernanceMemberType => !!value);

  if (allowedActorKinds.length > 0 && !allowedActorKinds.includes(actor.userKind)) {
    return createDefaultDeniedDecision(["ACTOR_KIND_NOT_ALLOWED"]);
  }
  if (allowedMemberTypes.length > 0 && !actor.master && !allowedMemberTypes.includes(actor.memberType)) {
    return createDefaultDeniedDecision(["ACTOR_MEMBER_TYPE_NOT_ALLOWED"]);
  }
  if ((rule.requireActorInsttId ?? true) && !actor.master && !actor.insttId) {
    return createDefaultDeniedDecision(["ACTOR_INSTT_ID_REQUIRED"]);
  }
  if (rule.enforceTargetCompanyMatch && !actor.master && target?.targetInsttId && actor.insttId && target.targetInsttId !== actor.insttId) {
    return createDefaultDeniedDecision(["TARGET_COMPANY_MISMATCH"]);
  }

  const resolvedInsttId = actor.master
    ? String(runtime?.requestedInsttId || target?.targetInsttId || "")
    : String(actor.insttId || "");
  if ((rule.enforceOwnCompanyScope ?? !rule.allowAllScope) && !actor.master && !resolvedInsttId) {
    return createDefaultDeniedDecision(["SCOPED_INSTT_ID_REQUIRED"]);
  }

  const resolvedMemberTypes = allowedMemberTypes.length > 0
    ? allowedMemberTypes
    : actor.memberType
      ? [actor.memberType]
      : [];

  if (rule.restrictTargetCompanyOutput && !actor.master && target?.targetInsttId && resolvedInsttId && target.targetInsttId !== resolvedInsttId) {
    return createDefaultDeniedDecision(["TARGET_OUTPUT_COMPANY_NOT_VISIBLE"]);
  }

  reasonCodes.push(actor.master || rule.allowAllScope ? "GLOBAL_ALLOWED" : "OWN_COMPANY_SCOPED");
  return {
    allowed: true,
    visibility: "VISIBLE",
    interaction: "ENABLED",
    scope: actor.master || rule.allowAllScope ? "GLOBAL" : "OWN_COMPANY",
    resolvedInsttId,
    resolvedMemberTypes,
    requiredFeatureCodes: rule.requiredFeatureCodes || [],
    reasonCodes
  };
}
