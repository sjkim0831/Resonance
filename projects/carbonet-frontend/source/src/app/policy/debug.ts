import { publishTelemetryEvent } from "../../platform/telemetry/events";

type GovernanceLogPayload = Record<string, unknown>;

function readDebugFlag() {
  if (typeof window === "undefined") {
    return false;
  }
  const host = String(window.location.hostname || "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return true;
  }
  return window.localStorage.getItem("carbonet:scope-debug") === "Y";
}

export function logGovernanceScope(
  phase: "PAGE" | "COMPONENT" | "ACTION",
  name: string,
  payload: GovernanceLogPayload
) {
  if (!readDebugFlag() || typeof console === "undefined") {
    return;
  }
  const timestamp = new Date().toISOString();
  console.groupCollapsed(`[scope:${phase.toLowerCase()}] ${name} @ ${timestamp}`);
  console.table(payload);
  console.groupEnd();

  if (phase === "ACTION") {
    publishTelemetryEvent({
      type: "ui_action",
      actionId: name,
      componentId: typeof payload.component === "string" ? payload.component : undefined,
      functionId: typeof payload.functionId === "string" ? payload.functionId : undefined,
      apiId: typeof payload.apiId === "string" ? payload.apiId : undefined,
      result: typeof payload.result === "string" ? payload.result : undefined,
      payloadSummary: {
        scopePhase: phase,
        scopeName: name,
        ...payload
      }
    });
    return;
  }

  if (phase === "COMPONENT") {
    publishTelemetryEvent({
      type: "layout_render",
      componentId: name,
      functionId: typeof payload.functionId === "string" ? payload.functionId : undefined,
      apiId: typeof payload.apiId === "string" ? payload.apiId : undefined,
      payloadSummary: {
        scopePhase: phase,
        scopeName: name,
        ...payload
      }
    });
  }
}
