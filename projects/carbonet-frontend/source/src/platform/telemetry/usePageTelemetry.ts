import { useEffect } from "react";
import { getCurrentRuntimeRequestPath } from "../../app/routes/runtime";
import { publishTelemetryEvent } from "./events";
import { initializeTraceContext, updateCurrentPage } from "./traceContext";

export function usePageTelemetry(pageId: string, locale: "ko" | "en") {
  useEffect(() => {
    initializeTraceContext(pageId, locale);
    updateCurrentPage(pageId, locale);
    const enteredAt = Date.now();
    publishTelemetryEvent({
      type: "page_view",
      pageId,
      payloadSummary: {
        path: getCurrentRuntimeRequestPath()
      }
    });

    return () => {
      publishTelemetryEvent({
        type: "page_leave",
        pageId,
        durationMs: Date.now() - enteredAt
      });
    };
  }, [locale, pageId]);
}
