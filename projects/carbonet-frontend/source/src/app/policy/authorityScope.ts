import type { FrontendSession } from "../../lib/api/adminShellTypes";
import { logGovernanceScope } from "./debug";

export type AuthorityAction =
  | "view"
  | "query"
  | "export"
  | "create"
  | "update"
  | "delete"
  | "execute"
  | "approve";

type AuthorityFeatureRowLike = {
  featureCode?: string;
  featureNm?: string;
  featureNmEn?: string;
  featureDc?: string;
};

type ResolveAuthorityScopeOptions = {
  scopeName: string;
  routePath: string;
  session?: FrontendSession | null;
  menuCode?: string;
  requiredViewFeatureCode?: string;
  featureCodes?: readonly string[];
  featureRows?: readonly AuthorityFeatureRowLike[];
  actionFeatureOverrides?: Partial<Record<AuthorityAction, string>>;
};

type AuthorityFeatureCatalog = Partial<Record<AuthorityAction, string>>;

const ACTION_MATCHERS: Record<Exclude<AuthorityAction, "view">, string[]> = {
  query: ["query", "search", "list", "lookup", "read"],
  export: ["export", "download", "excel", "csv"],
  create: ["create", "register", "add", "insert"],
  update: ["update", "edit", "modify", "save"],
  delete: ["delete", "remove"],
  execute: ["execute", "publish", "apply", "refresh", "rebuild", "run", "restore", "repair", "rollback"],
  approve: ["approve", "approval", "confirm", "review"]
};

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function normalizeFeatureRows(featureRows: readonly AuthorityFeatureRowLike[] = []) {
  return featureRows
    .map((row) => ({
      featureCode: String(row.featureCode || "").trim(),
      text: [
        String(row.featureCode || ""),
        String(row.featureNm || ""),
        String(row.featureNmEn || ""),
        String(row.featureDc || "")
      ].join(" ").toLowerCase()
    }))
    .filter((row) => row.featureCode);
}

function buildDefaultFeatureCode(menuCode: string | undefined, action: AuthorityAction) {
  const normalizedMenuCode = String(menuCode || "").trim().toUpperCase();
  if (!normalizedMenuCode) {
    return "";
  }
  if (action === "view" || action === "query") {
    return `${normalizedMenuCode}_VIEW`;
  }
  return `${normalizedMenuCode}_${action.toUpperCase()}`;
}

function resolveFeatureCodeFromRows(
  action: Exclude<AuthorityAction, "view">,
  normalizedRows: Array<{ featureCode: string; text: string }>
) {
  const keywords = ACTION_MATCHERS[action];
  return normalizedRows.find((row) => keywords.some((keyword) => row.text.includes(keyword)))?.featureCode || "";
}

function resolveActionFeatureCatalog({
  menuCode,
  requiredViewFeatureCode,
  featureCodes = [],
  featureRows = [],
  actionFeatureOverrides = {}
}: Omit<ResolveAuthorityScopeOptions, "scopeName" | "routePath" | "session">) {
  const normalizedRows = normalizeFeatureRows(featureRows);
  const normalizedFeatureCodes = featureCodes.map((featureCode) => String(featureCode || "").trim()).filter(Boolean);
  const fallbackViewFeatureCode = String(requiredViewFeatureCode || "").trim() || buildDefaultFeatureCode(menuCode, "view");
  const catalog: AuthorityFeatureCatalog = {
    view: actionFeatureOverrides.view || fallbackViewFeatureCode,
    query: actionFeatureOverrides.query || fallbackViewFeatureCode
  };

  (["export", "create", "update", "delete", "execute", "approve"] as const).forEach((action) => {
    const explicitFeatureCode = String(actionFeatureOverrides[action] || "").trim();
    if (explicitFeatureCode) {
      catalog[action] = explicitFeatureCode;
      return;
    }
    const featureCodeFromRows = resolveFeatureCodeFromRows(action, normalizedRows);
    if (featureCodeFromRows) {
      catalog[action] = featureCodeFromRows;
      return;
    }
    const conventionFeatureCode = buildDefaultFeatureCode(menuCode, action);
    if (conventionFeatureCode && normalizedFeatureCodes.includes(conventionFeatureCode)) {
      catalog[action] = conventionFeatureCode;
      return;
    }
    catalog[action] = conventionFeatureCode;
  });

  return catalog;
}

function buildAuthorityReason(action: AuthorityAction, featureCode: string, en: boolean) {
  const labels: Record<AuthorityAction, string> = {
    view: en ? "view this page" : "이 페이지 조회",
    query: en ? "query this page" : "이 페이지 조회/검색",
    export: en ? "export from this page" : "이 페이지 내보내기",
    create: en ? "create on this page" : "이 페이지 생성 작업",
    update: en ? "update on this page" : "이 페이지 수정 작업",
    delete: en ? "delete on this page" : "이 페이지 삭제 작업",
    execute: en ? "execute this action" : "이 실행 작업",
    approve: en ? "approve this action" : "이 승인 작업"
  };
  if (!featureCode) {
    return en
      ? `You do not have authority to ${labels[action]}.`
      : `${labels[action]} 권한이 없습니다.`;
  }
  return en
    ? `You need ${featureCode} permission to ${labels[action]}.`
    : `${labels[action]}을(를) 수행하려면 ${featureCode} 권한이 필요합니다.`;
}

export function resolveAuthorityScope(options: ResolveAuthorityScopeOptions) {
  const sessionFeatureCodes = options.session?.featureCodes || [];
  const sessionFeatureSet = new Set(sessionFeatureCodes.map(normalizeToken));
  const actionFeatureCatalog = resolveActionFeatureCatalog(options);
  const requiredViewFeatureCode = String(actionFeatureCatalog.view || "").trim();
  const entryAllowed = !requiredViewFeatureCode || sessionFeatureSet.has(normalizeToken(requiredViewFeatureCode));

  function allowsAction(action: AuthorityAction) {
    const featureCode = String(actionFeatureCatalog[action] || "").trim();
    if (!featureCode) {
      return entryAllowed;
    }
    return sessionFeatureSet.has(normalizeToken(featureCode));
  }

  function getActionFeatureCode(action: AuthorityAction) {
    return String(actionFeatureCatalog[action] || "").trim();
  }

  function getActionReason(action: AuthorityAction, en: boolean) {
    return buildAuthorityReason(action, getActionFeatureCode(action), en);
  }

  function logAuthorityDenied(action: AuthorityAction, payload: Record<string, unknown> = {}) {
    logGovernanceScope("ACTION", `${options.scopeName}-authority-denied`, {
      route: options.routePath,
      action,
      result: "DENIED",
      requiredViewFeatureCode,
      requiredActionFeatureCode: getActionFeatureCode(action),
      sessionFeatureCodes,
      ...payload
    });
  }

  function logAuthorityGranted(action: AuthorityAction, payload: Record<string, unknown> = {}) {
    logGovernanceScope("ACTION", `${options.scopeName}-authority-granted`, {
      route: options.routePath,
      action,
      result: "ALLOWED",
      requiredViewFeatureCode,
      requiredActionFeatureCode: getActionFeatureCode(action),
      sessionFeatureCodes,
      ...payload
    });
  }

  return {
    requiredViewFeatureCode,
    sessionFeatureCodes,
    entryAllowed,
    allowsAction,
    getActionFeatureCode,
    getActionReason,
    logAuthorityDenied,
    logAuthorityGranted
  };
}
