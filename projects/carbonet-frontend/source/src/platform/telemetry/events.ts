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
