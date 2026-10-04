import { useEffect, useRef } from "react";
import { getCsrfMeta } from "../../lib/navigation/runtime";
import { classifyTelemetryEvent, type TelemetryEvent } from "./events";

type TransportEvent = TelemetryEvent & {
  eventId: string;
  traceId: string;
  requestId: string;
  pageId: string;
  locale: "ko" | "en";
  occurredAt: string;
};

const FLUSH_DELAY_MS = 1200;
const MAX_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 1000;
const TELEMETRY_ENDPOINT = "/api/telemetry/events";

export function useTelemetryTransport() {
  const queueRef = useRef<TransportEvent[]>([]);
  const timerRef = useRef<number | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let failures = 0;
    let retryAfter = 0;
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleFlush() {
      if (disposed || timerRef.current !== null) {
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush(false);
      }, Math.max(FLUSH_DELAY_MS, retryAfter - Date.now()));
    }

    async function flush(keepalive: boolean) {
      if (disposed || sendingRef.current || queueRef.current.length === 0) {
        return;
      }
      if (Date.now() < retryAfter) { scheduleFlush(); return; }
      sendingRef.current = true;
      clearTimer();
      // Keep the batch until the server explicitly acknowledges all events.
      const events = queueRef.current.slice(0, MAX_BATCH_SIZE);
      let { token, headerName } = getCsrfMeta();
      let sessionResolved = false;
      try {
        const response = await window.fetch("/api/frontend/session", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        if (response.ok) {
          const session = await response.json() as { csrfToken?: string; csrfHeaderName?: string };
          sessionResolved = true;
          token = session.csrfToken || token;
          headerName = session.csrfHeaderName || headerName;
        }
      } catch {
        // Keep best-effort telemetry transport non-blocking.
      }
      // Some existing server chains do not issue CSRF tokens. The server still
      // decides whether this same-origin JSON request is permitted; never change
      // server security settings or treat a rejected POST as acknowledged.
      if (!token && !sessionResolved) {
        failures += 1;
        retryAfter = Date.now() + Math.min(60000, FLUSH_DELAY_MS * 2 ** Math.min(failures, 6));
        sendingRef.current = false;
        if (queueRef.current.length > 0) {
          scheduleFlush();
        }
        return;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers[headerName] = token;
      }

      try {
        const response = await window.fetch(TELEMETRY_ENDPOINT, {
          method: "POST",
          credentials: "include",
          keepalive,
          headers,
          body: JSON.stringify({ events })
        });
        if (!response.ok) throw new Error(`Telemetry HTTP ${response.status}`);
        const acknowledgement = await response.json() as { success?: boolean; acceptedCount?: number; acceptedEventIds?: string[] };
        if (Array.isArray(acknowledgement.acceptedEventIds)) {
          const sentIds = new Set(events.map(event => event.eventId));
          const acceptedIds = new Set(acknowledgement.acceptedEventIds.filter(id => sentIds.has(id)));
          queueRef.current = queueRef.current.filter(event => !acceptedIds.has(event.eventId));
          if (acceptedIds.size !== events.length) throw new Error("Telemetry events remain unacknowledged");
        } else {
        if (acknowledgement.success !== true || acknowledgement.acceptedCount !== events.length) {
          throw new Error("Telemetry batch was not fully acknowledged");
        }
        queueRef.current.splice(0, events.length);
        }
        failures = 0;
        retryAfter = 0;
      } catch {
        failures += 1;
        retryAfter = Date.now() + Math.min(60000, FLUSH_DELAY_MS * 2 ** Math.min(failures, 6));
      } finally {
        sendingRef.current = false;
        if (queueRef.current.length > 0) {
          scheduleFlush();
        }
      }
    }

    function handleTelemetry(event: Event) {
      const detail = (event as CustomEvent<TransportEvent>).detail;
      if (!detail || !detail.traceId || !detail.type) {
        return;
      }
      if (queueRef.current.length >= MAX_QUEUE_SIZE) {
        // Do not emit another telemetry event here (it would recurse).
        console.warn("[CCUS telemetry] Queue capacity reached; newest event discarded");
        return;
      }
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      const eventId = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      // Assign once at enqueue, not on retry. Available on HTTP as well as HTTPS.
      queueRef.current.push({ ...detail, eventId, payloadSummary: {
        ...detail.payloadSummary,
        usageClassification: classifyTelemetryEvent(detail, window.navigator.webdriver === true)
      } });
      if (queueRef.current.length >= MAX_BATCH_SIZE) {
        void flush(false);
      } else {
        scheduleFlush();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void flush(true);
      }
    }

    function handleBeforeUnload() {
      void flush(true);
    }

    window.addEventListener("carbonet:telemetry", handleTelemetry as EventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      disposed = true;
      clearTimer();
      window.removeEventListener("carbonet:telemetry", handleTelemetry as EventListener);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
