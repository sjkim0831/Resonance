import { useEffect, useRef } from "react";
import { getCsrfMeta } from "../../lib/navigation/runtime";
import type { TelemetryEvent } from "./events";

type TransportEvent = TelemetryEvent & {
  traceId: string;
  requestId: string;
  pageId: string;
  locale: "ko" | "en";
  occurredAt: string;
};

const FLUSH_DELAY_MS = 1200;
const MAX_BATCH_SIZE = 20;
const TELEMETRY_ENDPOINT = "/api/telemetry/events";

export function useTelemetryTransport() {
  const queueRef = useRef<TransportEvent[]>([]);
  const timerRef = useRef<number | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function scheduleFlush() {
      if (timerRef.current !== null) {
        return;
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush(false);
      }, FLUSH_DELAY_MS);
    }

    async function flush(keepalive: boolean) {
      if (sendingRef.current || queueRef.current.length === 0) {
        return;
      }
      sendingRef.current = true;
      clearTimer();
      const events = queueRef.current.splice(0, MAX_BATCH_SIZE);
      let { token, headerName } = getCsrfMeta();
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
          token = session.csrfToken || token;
          headerName = session.csrfHeaderName || headerName;
        }
      } catch {
        // Keep best-effort telemetry transport non-blocking.
      }
      if (!token) {
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
        await window.fetch(TELEMETRY_ENDPOINT, {
          method: "POST",
          credentials: "include",
          keepalive,
          headers,
          body: JSON.stringify({ events })
        });
      } catch {
        queueRef.current = [...events, ...queueRef.current];
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
      queueRef.current.push(detail);
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
      clearTimer();
      window.removeEventListener("carbonet:telemetry", handleTelemetry as EventListener);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
