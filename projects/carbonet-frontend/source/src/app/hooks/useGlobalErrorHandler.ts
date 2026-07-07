import { useEffect } from "react";
import { publishTelemetryEvent } from "../../platform/telemetry/events";
import {
  getCurrentBootstrappedRouteId,
  getCurrentRuntimeHref,
  getCurrentRuntimeRequestPath,
  reloadCurrentRuntime
} from "../routes/runtime";

interface ErrorReportPayload {
  errorType: "WINDOW_ERROR" | "UNHANDLED_REJECTION" | "REACT_ERROR_BOUNDARY";
  fingerprint: string;
  message: string;
  stack?: string;
  componentStack?: string;
  pageId: string;
  timestamp: string;
  userAgent: string;
  url: string;
  line?: number;
  col?: number;
}

const CHUNK_RECOVERY_STORAGE_KEY = "carbonet.react.chunk-recovery";

function generateFingerprint(message: string, url: string, line?: number): string {
  const hashInput = [message, url, line?.toString() || ""].join("|");
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `ERR_${Math.abs(hash).toString(16).toUpperCase()}`;
}

function isChunkLoadFailure(message: string, url: string) {
  const normalizedMessage = (message || "").toLowerCase();
  const normalizedUrl = (url || "").toLowerCase();
  return normalizedMessage.includes("failed to fetch dynamically imported module")
    || normalizedMessage.includes("importing a module script failed")
    || normalizedMessage.includes("loading chunk")
    || normalizedMessage.includes("chunkloaderror")
    || normalizedMessage.includes("vite:preloaderror")
    || normalizedUrl.includes("/assets/react/assets/");
}

function tryRecoverChunkLoad(reason: { message: string; url: string; pageId: string }) {
  if (!isChunkLoadFailure(reason.message, reason.url)) {
    return false;
  }

  const recoveryKey = `${getCurrentRuntimeRequestPath()}|${reason.pageId}`;
  const previousRecoveryKey = window.sessionStorage.getItem(CHUNK_RECOVERY_STORAGE_KEY) || "";
  if (previousRecoveryKey === recoveryKey) {
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RECOVERY_STORAGE_KEY, recoveryKey);
  reloadCurrentRuntime();
  return true;
}

async function reportErrorToBackend(payload: ErrorReportPayload) {
  try {
    const csrfToken = document.querySelector('meta[name="_csrf"]')?.getAttribute("content") || "";

    const response = await fetch("/api/frontend/error/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken
      },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    });

    const result = await response.json();
    if (result.status === "self_healing_triggered" || result.status === "ticket_created") {
      console.log("[GlobalErrorHandler] Auto-ticket created:", result.ticketId);
    }
  } catch (reportError) {
    console.error("[GlobalErrorHandler] Failed to report error to backend:", reportError);
  }
}

export function useGlobalErrorHandler() {
  useEffect(() => {
    const pageId = getCurrentBootstrappedRouteId() || "unknown";
    const currentPath = getCurrentRuntimeRequestPath();

    function handleWindowError(event: ErrorEvent) {
      const fingerprint = generateFingerprint(event.message, event.filename, event.lineno);

      const payload: ErrorReportPayload = {
        errorType: "WINDOW_ERROR",
        fingerprint,
        message: event.message,
        stack: event.error?.stack,
        pageId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: event.filename,
        line: event.lineno,
        col: event.colno
      };

      console.error("[GlobalErrorHandler] Window error:", payload);

      publishTelemetryEvent({
        type: "ui_error",
        result: "window_error",
        payloadSummary: { ...payload } as Record<string, unknown>
      });

      if (tryRecoverChunkLoad({ message: event.message, url: event.filename, pageId })) {
        return;
      }

      reportErrorToBackend(payload);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      const currentHref = getCurrentRuntimeHref();
      const fingerprint = generateFingerprint(message, currentHref);

      const payload: ErrorReportPayload = {
        errorType: "UNHANDLED_REJECTION",
        fingerprint,
        message,
        stack,
        pageId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: currentHref
      };

      console.error("[GlobalErrorHandler] Unhandled rejection:", payload);

      publishTelemetryEvent({
        type: "ui_error",
        result: "unhandled_rejection",
        payloadSummary: { ...payload } as Record<string, unknown>
      });

      if (tryRecoverChunkLoad({ message, url: currentHref, pageId })) {
        return;
      }

      reportErrorToBackend(payload);
    }

    function handleVitePreloadError(event: Event) {
      const customEvent = event as Event & { payload?: unknown };
      const message = customEvent.payload instanceof Error
        ? customEvent.payload.message
        : "vite:preloadError";
      const currentHref = getCurrentRuntimeHref();
      const payload: ErrorReportPayload = {
        errorType: "UNHANDLED_REJECTION",
        fingerprint: generateFingerprint(message, currentHref),
        message,
        stack: customEvent.payload instanceof Error ? customEvent.payload.stack : undefined,
        pageId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: currentHref
      };

      publishTelemetryEvent({
        type: "ui_error",
        result: "vite_preload_error",
        payloadSummary: { ...payload, routePath: currentPath } as Record<string, unknown>
      });

      if (tryRecoverChunkLoad({ message, url: currentHref, pageId })) {
        event.preventDefault();
        return;
      }

      reportErrorToBackend(payload);
    }

    function clearChunkRecoveryMarker() {
      window.sessionStorage.removeItem(CHUNK_RECOVERY_STORAGE_KEY);
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("vite:preloadError", handleVitePreloadError as EventListener);
    window.addEventListener("pageshow", clearChunkRecoveryMarker);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("vite:preloadError", handleVitePreloadError as EventListener);
      window.removeEventListener("pageshow", clearChunkRecoveryMarker);
    };
  }, []);
}
