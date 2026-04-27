import { publishTelemetryEvent } from "./events";
import { getTraceContext } from "./traceContext";

export type TracedFetchOptions = RequestInit & {
  apiId?: string;
  actionId?: string;
};

type FrontendScopeSnapshot = {
  authenticated?: boolean;
  userId?: string;
  authorCode?: string;
  insttId?: string;
};

type MissingInsttWarningDetail = {
  url: string;
  method: string;
  reason: string;
};

const FRONTEND_SESSION_URL = "/api/frontend/session";
const INSTT_WARNING_EVENT = "carbonet:missing-instt-id-warning";
let scopeSnapshotCache: FrontendScopeSnapshot | null = null;
let scopeSnapshotPromise: Promise<FrontendScopeSnapshot | null> | null = null;

function normalizeUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof URL) {
      return input;
    }
    if (typeof input === "string") {
      return new URL(input, window.location.origin);
    }
    return new URL(input.url, window.location.origin);
  } catch {
    return null;
  }
}

function isSameOriginApiRequest(url: URL | null): boolean {
  if (!url || url.origin !== window.location.origin) {
    return false;
  }
  return url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/admin/api/")
    || url.pathname.startsWith("/en/admin/api/")
    || url.pathname.endsWith("/page-data");
}

function hasInsttIdInSearch(url: URL | null): boolean {
  if (!url) {
    return false;
  }
  return Array.from(url.searchParams.keys()).some((key) => key.toLowerCase() === "insttid" || key.toLowerCase() === "instt_id");
}

function hasInsttIdInBody(body: BodyInit | null | undefined): boolean {
  if (!body) {
    return false;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return Array.from(body.keys()).some((key) => key.toLowerCase() === "insttid" || key.toLowerCase() === "instt_id");
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return Array.from(body.keys()).some((key) => key.toLowerCase() === "insttid" || key.toLowerCase() === "instt_id");
  }
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      return Object.keys(parsed || {}).some((key) => key.toLowerCase() === "insttid" || key.toLowerCase() === "instt_id");
    } catch {
      return /(^|[&{",])\s*instt(_id|Id)\s*[:=]/i.test(body);
    }
  }
  return false;
}

function hasInsttIdInRequest(input: RequestInfo | URL, init?: TracedFetchOptions): boolean {
  const url = normalizeUrl(input);
  if (hasInsttIdInSearch(url)) {
    return true;
  }

  if (input instanceof Request && hasInsttIdInBody(input.body as BodyInit | null | undefined)) {
    return true;
  }

  return hasInsttIdInBody(init?.body as BodyInit | null | undefined);
}

function isMasterScope(scope: FrontendScopeSnapshot | null): boolean {
  const normalizedAuthorCode = String(scope?.authorCode || "").trim().toUpperCase();
  const normalizedUserId = String(scope?.userId || "").trim().toLowerCase();
  return normalizedAuthorCode === "ROLE_SYSTEM_MASTER" || normalizedUserId === "webmaster";
}

async function resolveFrontendScopeSnapshot(): Promise<FrontendScopeSnapshot | null> {
  if (scopeSnapshotCache) {
    return scopeSnapshotCache;
  }
  if (!scopeSnapshotPromise) {
    scopeSnapshotPromise = globalThis.fetch(FRONTEND_SESSION_URL, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        const snapshot = await response.json() as FrontendScopeSnapshot;
        scopeSnapshotCache = snapshot;
        return snapshot;
      })
      .catch(() => null)
      .finally(() => {
        scopeSnapshotPromise = null;
      });
  }
  return scopeSnapshotPromise;
}

function dispatchMissingInsttWarning(detail: MissingInsttWarningDetail) {
  window.dispatchEvent(new CustomEvent<MissingInsttWarningDetail>(INSTT_WARNING_EVENT, { detail }));
}

async function warnIfMissingInsttId(input: RequestInfo | URL, init?: TracedFetchOptions) {
  const url = normalizeUrl(input);
  if (!isSameOriginApiRequest(url) || hasInsttIdInRequest(input, init)) {
    return;
  }

  const scope = await resolveFrontendScopeSnapshot();
  if (!scope?.authenticated || isMasterScope(scope) || String(scope.insttId || "").trim()) {
    return;
  }

  dispatchMissingInsttWarning({
    url: url ? `${url.pathname}${url.search}` : String(input),
    method: (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase(),
    reason: "NON_MASTER_WITHOUT_INSTT_ID"
  });
}

export function getMissingInsttWarningEventName() {
  return INSTT_WARNING_EVENT;
}

export async function tracedFetch(input: RequestInfo | URL, init?: TracedFetchOptions): Promise<Response> {
  const startedAt = Date.now();
  const trace = getTraceContext();
  const headers = new Headers(init?.headers || {});
  headers.set("X-Trace-Id", trace.traceId);
  headers.set("X-Request-Id", trace.requestId);
  headers.set("X-Page-Id", trace.pageId);
  if (init?.actionId) {
    headers.set("X-Action-Id", init.actionId);
  }
  if (init?.apiId) {
    headers.set("X-Api-Id", init.apiId);
  }

  const url = typeof input === "string" ? input : input.toString();
  publishTelemetryEvent({
    type: "api_request",
    apiId: init?.apiId,
    actionId: init?.actionId,
    payloadSummary: {
      method: (init?.method || "GET").toUpperCase(),
      url
    }
  });

  try {
    await warnIfMissingInsttId(input, init);
    const response = await globalThis.fetch(input, { ...init, headers });
    publishTelemetryEvent({
      type: "api_response",
      apiId: init?.apiId,
      actionId: init?.actionId,
      result: response.ok ? "SUCCESS" : "HTTP_ERROR",
      durationMs: Date.now() - startedAt,
      payloadSummary: {
        status: response.status,
        url
      }
    });
    return response;
  } catch (error) {
    publishTelemetryEvent({
      type: "api_response",
      apiId: init?.apiId,
      actionId: init?.actionId,
      result: "NETWORK_ERROR",
      durationMs: Date.now() - startedAt,
      payloadSummary: {
        url,
        message: error instanceof Error ? error.message : "unknown"
      }
    });
    throw error;
  }
}
