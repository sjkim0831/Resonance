type AiPrimitive = string | number | boolean | null | undefined;

type AiRuntimeEvent = {
  eventId: string;
  occurredAt: string;
  eventType: string;
  route: string;
  title: string;
  target?: AiElementSummary;
  payload?: Record<string, unknown>;
};

type AiElementSummary = {
  tag: string;
  id?: string;
  name?: string;
  role?: string;
  type?: string;
  text?: string;
  value?: AiPrimitive;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  href?: string;
  dataset?: Record<string, string>;
};

type AiScreenContextSnapshot = {
  version: string;
  application: string;
  capturedAt: string;
  page: {
    url: string;
    path: string;
    title: string;
    language: string;
  };
  activeElement?: AiElementSummary;
  visibleElements: AiElementSummary[];
  recentEvents: AiRuntimeEvent[];
};

type OpenTaskPopupConfig = {
  url: string;
  taskId?: string;
  processId?: string;
  processInstanceId?: string;
  stepId?: string;
  screenId?: string;
  actionId?: string;
  intent?: string;
  windowFeatures?: string;
};

declare global {
  interface Window {
    __AI_SCREEN_CONTEXT__?: Record<string, unknown>;
    __AI_CONTEXT_RUNTIME__?: {
      collect: () => AiScreenContextSnapshot;
      export: () => string;
      copy: () => Promise<AiScreenContextSnapshot>;
      recordIntent: (eventType: string, payload?: Record<string, unknown>) => AiRuntimeEvent;
      getRecentEvents: () => AiRuntimeEvent[];
      openTaskPopup: (config: OpenTaskPopupConfig) => Window | null;
    };
    openTaskPopup?: (config: OpenTaskPopupConfig) => Window | null;
    __CARBONET_AI_CONTEXT_INSTALLED__?: boolean;
    __CARBONET_AI_CONTEXT_FETCH_WRAPPED__?: boolean;
  }
}

const AI_CONTEXT_VERSION = "2026-08-04.1";
const EVENT_LIMIT = 50;
const SESSION_EVENTS_KEY = "carbonet.aiContext.recentEvents";
const LATEST_INTENT_KEY = "latestUserIntent";
const SENSITIVE_KEY_PATTERN = /authorization|cookie|token|password|passwd|secret|session|resident|ssn|card|accountNo|jumin/i;

let recentEvents: AiRuntimeEvent[] = [];

function safeText(value: string | null | undefined, limit = 120) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function isSensitiveKey(key: string) {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function sanitizeValue(value: unknown, keyHint = ""): unknown {
  if (isSensitiveKey(keyHint)) {
    return "[MASKED]";
  }
  if (typeof value === "string") {
    if (/bearer\s+[a-z0-9._-]+/i.test(value) || value.length > 300) {
      return value.slice(0, 40) + "...";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, keyHint));
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).slice(0, 50).forEach(([key, item]) => {
      output[key] = sanitizeValue(item, key);
    });
    return output;
  }
  return value;
}

function loadEvents() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_EVENTS_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      recentEvents = parsed.slice(-EVENT_LIMIT);
    }
  } catch {
    recentEvents = [];
  }
}

function persistEvents() {
  try {
    window.sessionStorage.setItem(SESSION_EVENTS_KEY, JSON.stringify(recentEvents.slice(-EVENT_LIMIT)));
  } catch {
    // Session storage can be disabled; runtime collection should still work.
  }
}

function makeEventId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `ai_evt_${Date.now().toString(36)}_${randomPart}`;
}

function collectDataset(element: Element) {
  const keys = [
    "processId",
    "stepId",
    "taskId",
    "actionId",
    "actionType",
    "entityType",
    "entityId",
    "businessTerm",
    "requiredFor",
    "nextState",
    "screenId"
  ];
  const dataset: Record<string, string> = {};
  keys.forEach((key) => {
    const value = (element as HTMLElement).dataset?.[key];
    if (value) {
      dataset[key] = value;
    }
  });
  return Object.keys(dataset).length ? dataset : undefined;
}

function isVisible(element: Element) {
  const htmlElement = element as HTMLElement;
  if (!htmlElement || htmlElement.hidden) {
    return false;
  }
  const style = window.getComputedStyle(htmlElement);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }
  const rect = htmlElement.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function summarizeElement(element: Element | null): AiElementSummary | undefined {
  if (!element) {
    return undefined;
  }
  const htmlElement = element as HTMLElement;
  const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const tag = element.tagName.toLowerCase();
  const dataset = collectDataset(element);
  const summary: AiElementSummary = {
    tag,
    id: htmlElement.id || undefined,
    name: input.name || element.getAttribute("name") || undefined,
    role: element.getAttribute("role") || undefined,
    type: (input as HTMLInputElement).type || undefined,
    text: safeText(htmlElement.innerText || element.textContent || element.getAttribute("aria-label"), 160) || undefined,
    required: Boolean((input as HTMLInputElement).required),
    disabled: Boolean((input as HTMLInputElement).disabled || element.getAttribute("aria-disabled") === "true"),
    ariaLabel: element.getAttribute("aria-label") || undefined,
    href: element instanceof HTMLAnchorElement ? element.href : undefined,
    dataset
  };
  if ("value" in input && tag !== "button") {
    summary.value = sanitizeValue(input.value, summary.name || summary.id || summary.type || "") as AiPrimitive;
  }
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined && value !== "")) as AiElementSummary;
}

function collectVisibleContext(application: string): AiScreenContextSnapshot {
  const selector = [
    "h1",
    "h2",
    "h3",
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[role]",
    "[data-process-id]",
    "[data-step-id]",
    "[data-task-id]",
    "[data-action-id]"
  ].join(",");
  const elements = Array.from(document.querySelectorAll(selector))
    .filter(isVisible)
    .slice(0, 240)
    .map((element) => summarizeElement(element))
    .filter(Boolean) as AiElementSummary[];

  return {
    version: AI_CONTEXT_VERSION,
    application,
    capturedAt: new Date().toISOString(),
    page: {
      url: window.location.href,
      path: `${window.location.pathname}${window.location.search}`,
      title: document.title || safeText(document.querySelector("h1")?.textContent, 80),
      language: document.documentElement.lang || "ko"
    },
    activeElement: summarizeElement(document.activeElement),
    visibleElements: elements,
    recentEvents: recentEvents.slice(-EVENT_LIMIT)
  };
}

function recordIntent(eventType: string, payload: Record<string, unknown> = {}) {
  const event: AiRuntimeEvent = {
    eventId: makeEventId(),
    occurredAt: new Date().toISOString(),
    eventType,
    route: `${window.location.pathname}${window.location.search}`,
    title: document.title || "",
    target: payload.target instanceof Element ? summarizeElement(payload.target) : undefined,
    payload: sanitizeValue(
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "target"))
    ) as Record<string, unknown>
  };
  recentEvents = [...recentEvents, event].slice(-EVENT_LIMIT);
  persistEvents();
  try {
    window.sessionStorage.setItem(LATEST_INTENT_KEY, JSON.stringify(event));
  } catch {
    // ignore
  }
  if (eventType === "POPUP_OPENED" || eventType === "COMMAND") {
    console.groupCollapsed(`[TASK] ${event.payload?.["taskId"] || eventType} @ ${event.occurredAt}`);
    console.log(event);
    console.groupEnd();
  }
  return event;
}

function installDomEventCapture() {
  const toEvent = (eventType: string) => (event: Event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    recordIntent(eventType, { target });
  };
  document.addEventListener("click", toEvent("CLICK"), true);
  document.addEventListener("change", toEvent("CHANGE"), true);
  document.addEventListener("input", toEvent("INPUT"), true);
  document.addEventListener("submit", toEvent("SUBMIT"), true);
}

function installFetchCapture() {
  if (window.__CARBONET_AI_CONTEXT_FETCH_WRAPPED__ || typeof window.fetch !== "function") {
    return;
  }
  window.__CARBONET_AI_CONTEXT_FETCH_WRAPPED__ = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = performance.now();
    const method = init?.method || (input instanceof Request ? input.method : "GET");
    const url = input instanceof Request ? input.url : String(input);
    try {
      const response = await originalFetch(input, init);
      recordIntent("API_RESPONSE", {
        method,
        url: safeText(url, 220),
        status: response.status,
        ok: response.ok,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
      return response;
    } catch (error) {
      recordIntent("API_ERROR", {
        method,
        url: safeText(url, 220),
        elapsedMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}

function openTaskPopup(config: OpenTaskPopupConfig) {
  recordIntent("POPUP_OPENED", {
    ...config,
    actionId: config.actionId || "OPEN_TASK_POPUP",
    intent: config.intent || "사용자가 업무 팝업을 열어 현재 절차를 수행하려고 함"
  });
  return window.open(config.url, config.taskId || "_blank", config.windowFeatures || "width=980,height=760");
}

export function installAiContextRuntime(options: { application?: string } = {}) {
  if (typeof window === "undefined" || window.__CARBONET_AI_CONTEXT_INSTALLED__) {
    return;
  }
  const application = options.application || "CCUS 탄소중립 플랫폼";
  window.__CARBONET_AI_CONTEXT_INSTALLED__ = true;
  loadEvents();
  window.__AI_SCREEN_CONTEXT__ = {
    version: AI_CONTEXT_VERSION,
    application,
    installedAt: new Date().toISOString(),
    usage: "F12 콘솔에서 copy(window.__AI_CONTEXT_RUNTIME__.export()) 실행"
  };
  window.__AI_CONTEXT_RUNTIME__ = {
    collect: () => collectVisibleContext(application),
    export: () => JSON.stringify(collectVisibleContext(application), null, 2),
    copy: async () => {
      const snapshot = collectVisibleContext(application);
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      recordIntent("AI_CONTEXT_COPIED", { visibleElementCount: snapshot.visibleElements.length });
      return snapshot;
    },
    recordIntent,
    getRecentEvents: () => recentEvents.slice(-EVENT_LIMIT),
    openTaskPopup
  };
  window.openTaskPopup = openTaskPopup;
  installDomEventCapture();
  installFetchCapture();
}

export type { AiRuntimeEvent, AiScreenContextSnapshot, OpenTaskPopupConfig };
