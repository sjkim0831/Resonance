package egovframework.com.feature.monitoring.web;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;

@RestController
@RequiredArgsConstructor
@Slf4j
public class MonitoringPublicController {

    private static final String METRICS_FILE = "/opt/Resonance/data/monitoring/metrics.json";

    @GetMapping(value = {
            "/api/monitoring/metrics",
            "/en/api/monitoring/metrics"
    }, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Resource> metrics() {
        try {
            File file = new File(METRICS_FILE);
            if (!file.exists()) {
                return ResponseEntity.notFound().build();
            }

            long lastModified = file.lastModified();
            long age = System.currentTimeMillis() - lastModified;

            if (age > 60000) {
                log.warn("Metrics file is older than 1 minute: {}ms", age);
            }

            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(resource);
        } catch (Exception e) {
            log.error("Failed to serve metrics", e);
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