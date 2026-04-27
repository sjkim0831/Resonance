import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type {
  GovernanceActorContext,
  GovernanceComponentContext,
  GovernanceMemberType,
  GovernancePageContext,
  GovernancePageType,
  GovernanceRuntimeContext,
  GovernanceTargetContext
} from "./governance";
import type { PageComponentManifest, PageManifest } from "../../platform/screen-registry/types";

function normalizeMemberType(authorCode: string, capabilityCodes: string[]): GovernanceMemberType {
  const normalizedAuthorCode = String(authorCode || "").toUpperCase();
  const normalizedCapabilities = capabilityCodes.map((value) => String(value || "").toUpperCase());
  if (normalizedCapabilities.includes("MEMBER_TYPE_E") || normalizedAuthorCode.includes("EMITTER")) {
    return "E";
  }
  if (normalizedCapabilities.includes("MEMBER_TYPE_P") || normalizedAuthorCode.includes("PERFORMER")) {
    return "P";
  }
  if (normalizedCapabilities.includes("MEMBER_TYPE_C") || normalizedAuthorCode.includes("CENTER")) {
    return "C";
  }
  if (normalizedCapabilities.includes("MEMBER_TYPE_G") || normalizedAuthorCode.includes("GOV")) {
    return "G";
  }
  return "";
}

function resolveUserKind(session: FrontendSession): GovernanceActorContext["userKind"] {
  if (!session.authenticated) {
    return "ANONYMOUS";
  }
  const authorCode = String(session.authorCode || "").toUpperCase();
  if (authorCode.includes("SYSTEM")
    || authorCode.includes("OPERATION")
    || authorCode.includes("CS_ADMIN")
    || authorCode === "ROLE_ADMIN") {
    return "ADMIN";
  }
  return "MEMBER";
}

function resolveMaster(session: FrontendSession): boolean {
  return String(session.userId || "").toLowerCase() === "webmaster"
    || String(session.authorCode || "").toUpperCase() === "ROLE_SYSTEM_MASTER";
}

export function buildActorContext(session: FrontendSession): GovernanceActorContext {
  const normalizedAuthorCode = String(session.authorCode || "");
  return {
    authenticated: session.authenticated,
    userId: session.userId || "",
    actualUserId: session.actualUserId || "",
    userKind: resolveUserKind(session),
    memberType: normalizeMemberType(session.authorCode, session.capabilityCodes || []),
    authorCode: normalizedAuthorCode,
    insttId: session.insttId || "",
    master: resolveMaster(session),
    baseRoleCodes: normalizedAuthorCode ? [normalizedAuthorCode] : [],
    generalRoleCodes: [],
    departmentRoleCodes: [],
    userOverrideFeatureCodes: []
  };
}

export function buildPageContext(manifest: PageManifest, pageType: GovernancePageType): GovernancePageContext {
  return {
    pageId: manifest.pageId,
    menuCode: manifest.menuCode,
    routePath: manifest.routePath,
    domainCode: manifest.domainCode === "home" ? "home" : "admin",
    pageType
  };
}

export function buildComponentContext(component: PageComponentManifest): GovernanceComponentContext {
  return {
    componentId: component.componentId,
    instanceKey: component.instanceKey,
    componentType: inferComponentType(component.componentId),
    policyKey: component.governance?.actionPolicyKey || component.governance?.listPolicyKey,
    dataSourceKey: component.governance?.listPolicyKey,
    helpId: component.instanceKey
  };
}

function inferComponentType(componentId: string): GovernanceComponentContext["componentType"] {
  const normalized = String(componentId || "").toLowerCase();
  if (normalized.includes("table") || normalized.includes("list")) {
    return "LIST";
  }
  if (normalized.includes("search") || normalized.includes("form")) {
    return "FORM_FIELD";
  }
  if (normalized.includes("select") || normalized.includes("combo")) {
    return "COMBO";
  }
  if (normalized.includes("popup") || normalized.includes("modal")) {
    return "POPUP";
  }
  if (normalized.includes("tab")) {
    return "TAB";
  }
  if (normalized.includes("action")) {
    return "ACTION_BAR";
  }
  if (normalized.includes("button")) {
    return "BUTTON";
  }
  return "SUMMARY";
}

export function createListRuntimeContext(queryParams?: Record<string, unknown>): GovernanceRuntimeContext {
  return {
    requestedInsttId: String(queryParams?.insttId || queryParams?.instt_id || ""),
    requestedMemberType: (String(queryParams?.memberType || queryParams?.membershipType || "") || "") as GovernanceMemberType,
    requestedStatus: String(queryParams?.status || queryParams?.sbscrbSttus || ""),
    searchKeyword: String(queryParams?.searchKeyword || ""),
    queryParams
  };
}

export function createTargetContext(values: Partial<GovernanceTargetContext>): GovernanceTargetContext {
  return {
    targetType: values.targetType || "LIST",
    cardinality: values.cardinality || "SINGLE",
    targetId: values.targetId,
    targetInsttId: values.targetInsttId,
    targetDeptId: values.targetDeptId,
    targetMemberType: values.targetMemberType,
    targetState: values.targetState
  };
}
