export type TraceContext = {
  traceId: string;
  requestId: string;
  pageId: string;
  locale: "ko" | "en";
  startedAt: number;
};

const TRACE_STORAGE_KEY = "carbonet.trace.id";

let currentContext: TraceContext | null = null;

function randomId(prefix: string): string {
  const source = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${source.slice(0, 16)}`;
}

function readStoredTraceId(): string {
  try {
    return window.sessionStorage.getItem(TRACE_STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

function writeStoredTraceId(traceId: string) {
  try {
    window.sessionStorage.setItem(TRACE_STORAGE_KEY, traceId);
  } catch {
    // Ignore storage failures and keep an in-memory context.
  }
}

export function initializeTraceContext(pageId: string, locale: "ko" | "en"): TraceContext {
  const existingTraceId = currentContext?.traceId || readStoredTraceId();
  const traceId = existingTraceId || randomId("tr");
  writeStoredTraceId(traceId);
  currentContext = {
    traceId,
    requestId: randomId("req"),
    pageId,
    locale,
    startedAt: Date.now()
  };
  return currentContext;
}

export function updateCurrentPage(pageId: string, locale: "ko" | "en"): TraceContext {
  const base = currentContext || initializeTraceContext(pageId, locale);
  currentContext = {
    ...base,
    requestId: randomId("req"),
    pageId,
    locale
  };
  return currentContext;
}

export function getTraceContext(): TraceContext {
  if (currentContext) {
    return currentContext;
  }
  return initializeTraceContext("unknown-page", "ko");
}
