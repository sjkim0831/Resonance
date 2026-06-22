package egovframework.com.feature.monitoring.web;

import egovframework.com.feature.monitoring.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
public class MonitoringPublicController {

    private final MonitoringService monitoringService;

    @GetMapping(value = {
            "/api/monitoring/metrics",
            "/en/api/monitoring/metrics"
    }, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> metrics() {
        try {
            Map<String, Object> metrics = monitoringService.getSystemMetrics();
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(metrics);
        } catch (Exception e) {
            log.error("Failed to get metrics", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping(value = {
            "/api/monitoring/system",
            "/en/api/monitoring/system"
    }, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> systemMetrics() {
        try {
            Map<String, Object> metrics = monitoringService.getSystemMetrics();
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(metrics);
        } catch (Exception e) {
            log.error("Failed to get system metrics", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping(value = {
            "/api/monitoring/health",
            "/en/api/monitoring/health"
    }, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> healthCheck() {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"status\":\"ok\",\"timestamp\":\"" + java.time.Instant.now() + "\"}");
    }
}