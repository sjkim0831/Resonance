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
        int accepted = 0;
        try {
            accessEventService.recordFrontendPageViews(request == null ? null : request.getEvents(), httpRequest);
        } catch (Exception ignored) {
            // Keep frontend telemetry non-blocking even when observability persistence is degraded.
        }
        try {
            accepted = traceEventService.recordFrontendEvents(request == null ? null : request.getEvents());
        } catch (Exception ignored) {
            accepted = 0;
        }
        try {
            errorEventService.recordFrontendTelemetryErrors(request == null ? null : request.getEvents());
        } catch (Exception ignored) {
            // Keep frontend telemetry non-blocking even when observability persistence is degraded.
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("acceptedCount", accepted);
        return ResponseEntity.ok(response);
    }
}
