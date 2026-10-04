import { getTraceContext } from "./traceContext";

export type TelemetryEventType =
  | "page_view"
  | "page_leave"
  | "ui_action"
  | "function_call"
  | "api_request"
  | "api_response"
  | "ui_error"
  | "layout_render"
  | "component_render_summary";

export type TelemetryEvent = {
  type: TelemetryEventType;
  pageId?: string;
  actionId?: string;
  functionId?: string;
  apiId?: string;
  componentId?: string;
  result?: string;
  durationMs?: number;
  payloadSummary?: Record<string, unknown>;
  occurredAt?: string;
};

// Analytics hints only: never use client classifications for access control.
export function classifyTelemetryEvent(event: TelemetryEvent, automatedBrowser: boolean) {
  const summary = event.payloadSummary || {};
  const qa = summary.test === true || (event.actionId || "").startsWith("QA_");
  let path = "";
  try { path = new URL(String(summary.url || ""), "http://classification.invalid").pathname; } catch { /* unknown */ }
  const technical = ["/api/frontend/session", "/api/telemetry/events", "/actuator/health"].includes(path);
  const polling = summary.polling === true;
  const failed = event.type === "ui_error" || ["HTTP_ERROR", "NETWORK_ERROR", "SECURITY_DIAGNOSTIC", "ERROR", "FAILURE"].includes(event.result || "")
    || (typeof summary.status === "number" && summary.status >= 400);
  return {
    version: 1,
    origin: qa ? "QA" : automatedBrowser ? "AUTOMATION" : "USER_CANDIDATE",
    originEvidence: qa ? "client_test_marker" : automatedBrowser ? "webdriver_hint" : "no_automation_hint",
    activity: polling ? "POLLING" : technical ? "TECHNICAL_READ" : event.type === "ui_action" ? "UI_ACTION" : event.type.startsWith("api_") ? "API" : "OBSERVATION",
    attention: failed ? "ERROR_OR_SECURITY" : "NORMAL",
    analyticsEligible: !qa && !automatedBrowser && !technical && !polling,
    trust: "CLIENT_HINT_NOT_AUTHORITY"
  };
}

export function publishTelemetryEvent(event: TelemetryEvent) {
  const trace = getTraceContext();
  const payload = {
    traceId: trace.traceId,
    requestId: trace.requestId,
    pageId: event.pageId || trace.pageId,
    locale: trace.locale,
    occurredAt: event.occurredAt || new Date().toISOString(),
    ...event
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("carbonet:telemetry", { detail: payload }));
  }
  const isLocalDebug = typeof window !== "undefined"
    && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isLocalDebug) {
    console.debug("[carbonet-telemetry]", payload);
  }
}
