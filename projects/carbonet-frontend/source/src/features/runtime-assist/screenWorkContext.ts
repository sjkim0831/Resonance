export type ScreenWorkflowContext = {
  workTypeCode?: string;
  workTypeName?: string;
  processCode: string;
  processName?: string;
  stepCode: string;
  stepName?: string;
  stepOrder?: number;
  actorCode?: string;
  actorName?: string;
  workPurpose?: string;
  completionRule?: string;
  inputContract?: string;
  outputContract?: string;
  userPath?: string;
  adminPath?: string;
  automationStatus?: string;
};

export type ScreenWorkContextCandidate = ScreenWorkflowContext & {
  audience?: string;
  entryMode?: string;
};

export type ScreenWorkflowClassification =
  | "EXECUTABLE"
  | "INFORMATIONAL"
  | "EXCLUDED"
  | "REVIEW_REQUIRED";

export type ScreenWorkContext = {
  linked: boolean;
  routePath: string;
  pageId: string;
  source: "server" | "catalog" | "url" | "unlinked";
  classification: ScreenWorkflowClassification;
  reasonCode?: string;
  reasonText?: string;
  accessRestricted?: boolean;
  reviewStatus?: string;
  selectionRequired?: boolean;
  candidateCount?: number;
  identity?: {
    canonicalRoutePath?: string;
    routeKey?: string;
    screenResourceId?: string;
    menuCode?: string;
    audience?: string;
    projectId?: string;
  };
  workflow?: ScreenWorkflowContext | null;
  candidates?: ScreenWorkContextCandidate[];
};

export function localScreenWorkflowClassification(pathname: string): ScreenWorkflowClassification {
  const normalized = normalizeScreenRoute(pathname);
  return [
    "/login/",
    "/admin/login/",
    "/signin/",
    "/find/",
    "/password/",
    "/error/",
    "/home/certificate-verify",
    "/admin/emission/survey-report-print",
    "/admin/emission/survey-report-lca-summary"
  ].some((prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix))
    ? "EXCLUDED"
    : "REVIEW_REQUIRED";
}

export function isPublicWorkflowRoute(pathname: string) {
  const normalized = normalizeScreenRoute(pathname);
  return normalized === "/join" || normalized.startsWith("/join/");
}

export function normalizeScreenRoute(value: string) {
  if (!value) return "/";
  try {
    const parsed = new URL(value, window.location.origin);
    const localizedPath = /^\/en$/i.test(parsed.pathname) ? "/" : parsed.pathname.replace(/^\/en(?=\/)/i, "");
    const pathname = localizedPath === "/" ? "/" : localizedPath.replace(/\/+$/, "");
    return pathname || "/";
  } catch {
    const rawPath = value.split(/[?#]/, 1)[0];
    const localizedPath = /^\/en$/i.test(rawPath) ? "/" : rawPath.replace(/^\/en(?=\/)/i, "");
    const pathname = localizedPath === "/" ? "/" : localizedPath.replace(/\/+$/, "");
    return pathname || "/";
  }
}

export function isWorkflowAssistRoute(pathname: string) {
  return localScreenWorkflowClassification(pathname) !== "EXCLUDED";
}
