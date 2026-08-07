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

export type ScreenWorkContext = {
  linked: boolean;
  routePath: string;
  pageId: string;
  source: "server" | "catalog" | "url" | "unlinked";
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
  const normalized = normalizeScreenRoute(pathname);
  return ![
    "/login/",
    "/admin/login/",
    "/signin/",
    "/join/",
    "/find/",
    "/error/",
    "/admin/emission/survey-report-print",
    "/admin/emission/survey-report-lca-summary"
  ].some((prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix));
}
