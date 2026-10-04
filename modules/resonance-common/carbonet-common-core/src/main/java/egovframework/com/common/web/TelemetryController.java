package egovframework.com.common.web;

import egovframework.com.common.error.ErrorEventService;
import egovframework.com.common.logging.AccessEventService;
import egovframework.com.common.trace.FrontendTelemetryBatchRequest;
import egovframework.com.common.trace.TraceEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/telemetry", "/signin/telemetry", "/en/signin/telemetry"})
public class TelemetryController {

    private final TraceEventService traceEventService;
    private final ErrorEventService errorEventService;
    private final AccessEventService accessEventService;

    @PostMapping("/events")
    public ResponseEntity<Map<String, Object>> ingestEvents(@RequestBody(required = false) FrontendTelemetryBatchRequest request,
                                                            HttpServletRequest httpRequest) {
        var events = request == null ? null : request.getEvents();
        if (events != null && events.size() > 100) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "reason", "batch_too_large"));
        }
        var result = new TraceEventService.FrontendBatchResult(0, java.util.List.of(), java.util.List.of());
        try {
            result = traceEventService.recordFrontendBatch(events);
        } catch (Exception ignored) {
            // Unacknowledged events are retried by the client.
        }
        try {
            accessEventService.recordFrontendPageViews(result.newEvents(), httpRequest);
        } catch (Exception ignored) {
            // Auxiliary projections remain best-effort; trace is the canonical ledger.
        }
        try {
            errorEventService.recordFrontendTelemetryErrors(result.newEvents());
        } catch (Exception ignored) {
            // Keep frontend telemetry non-blocking even when observability persistence is degraded.
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", result.acceptedCount() == (events == null ? 0 : events.size()));
        response.put("acceptedCount", result.acceptedCount());
        response.put("acceptedEventIds", result.acceptedEventIds());
        response.put("newCount", result.newEvents().size());
        return ResponseEntity.ok(response);
    }
}
