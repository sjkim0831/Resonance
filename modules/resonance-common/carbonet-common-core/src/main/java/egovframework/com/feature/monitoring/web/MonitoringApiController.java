package egovframework.com.feature.monitoring.web;

import egovframework.com.feature.monitoring.service.MonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class MonitoringApiController {

    private final MonitoringService monitoringService;

    @GetMapping({
            "/admin/api/monitoring/system",
            "/en/admin/api/monitoring/system"
    })
    public ResponseEntity<Map<String, Object>> systemMetrics() {
        return ResponseEntity.ok(monitoringService.getSystemMetrics());
    }

    @GetMapping({
            "/admin/api/monitoring/database",
            "/en/admin/api/monitoring/database"
    })
    public ResponseEntity<Map<String, Object>> databaseMetrics() {
        return ResponseEntity.ok(monitoringService.getDatabaseMetrics());
    }

    @GetMapping({
            "/admin/api/monitoring/kubernetes",
            "/en/admin/api/monitoring/kubernetes"
    })
    public ResponseEntity<Map<String, Object>> kubernetesMetrics() {
        return ResponseEntity.ok(monitoringService.getKubernetesMetrics());
    }

    @GetMapping({
            "/admin/api/monitoring/overview",
            "/en/admin/api/monitoring/overview"
    })
    public ResponseEntity<Map<String, Object>> overview() {
        return ResponseEntity.ok(monitoringService.getOverview());
    }

    @GetMapping({
            "/admin/api/monitoring/alerts",
            "/en/admin/api/monitoring/alerts"
    })
    public ResponseEntity<Map<String, Object>> alerts() {
        return ResponseEntity.ok(monitoringService.getAlerts());
    }

    @GetMapping({
            "/admin/api/monitoring/health",
            "/en/admin/api/monitoring/health"
    })
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(monitoringService.getHealthStatus());
    }
}