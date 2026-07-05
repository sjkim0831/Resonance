package egovframework.com.platform.observability.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.*;

@RestController
@RequestMapping("/admin/api/prometheus")
@Slf4j
public class PrometheusMetricsController {

    private final RestTemplate restTemplate;
    
    @Value("${prometheus.url:http://prometheus.monitoring.svc.cluster.local:9090}")
    private String prometheusUrl;

    public PrometheusMetricsController() {
        this.restTemplate = new RestTemplate();
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> response = new LinkedHashMap<>();
        
        try {
            // pg_up
            response.put("pgUp", fetchMetric("pg_up"));
            
            // pg_database_size_bytes
            response.put("databaseSizes", fetchDatabaseSizes());
            
            // pg_stat_activity_count
            response.put("activeConnections", fetchMetric("pg_stat_activity_count{state=\"active\"}"));
            
            // pg_replication_lag
            response.put("replicationLag", fetchMetric("pg_replication_lag"));
            
            // pg_exporter_last_scrape_error
            response.put("lastScrapeError", fetchMetric("pg_exporter_last_scrape_error"));
            
            // pg_exporter_last_scrape_duration_seconds
            response.put("scrapeDuration", fetchMetric("pg_exporter_last_scrape_duration_seconds"));
            
            response.put("timestamp", System.currentTimeMillis());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to fetch Prometheus metrics", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    private double fetchMetric(String query) {
        try {
            String url = prometheusUrl + "/api/v1/query?query=" + query.replace(" ", "%20");
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.getForObject(URI.create(url), Map.class);
            
            if (result != null && "success".equals(result.get("status"))) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("data");
                if (results != null && !results.isEmpty()) {
                    Map<String, Object> first = results.get(0);
                    @SuppressWarnings("unchecked")
                    List<Object> values = (List<Object>) first.get("value");
                    if (values != null && values.size() > 1) {
                        return Double.parseDouble(values.get(1).toString());
                    }
                }
            }
            return 0.0;
        } catch (Exception e) {
            log.warn("Failed to fetch metric {}: {}", query, e.getMessage());
            return 0.0;
        }
    }

    private List<Map<String, Object>> fetchDatabaseSizes() {
        List<Map<String, Object>> sizes = new ArrayList<>();
        try {
            String url = prometheusUrl + "/api/v1/query?query=pg_database_size_bytes";
            @SuppressWarnings("unchecked")
            Map<String, Object> result = restTemplate.getForObject(URI.create(url), Map.class);
            
            if (result != null && "success".equals(result.get("status"))) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("data");
                if (results != null) {
                    for (Map<String, Object> r : results) {
                        @SuppressWarnings("unchecked")
                        Map<String, String> metric = (Map<String, String>) r.get("metric");
                        @SuppressWarnings("unchecked")
                        List<Object> values = (List<Object>) r.get("value");
                        if (metric != null && values != null && values.size() > 1) {
                            Map<String, Object> entry = new LinkedHashMap<>();
                            entry.put("name", metric.getOrDefault("datname", "unknown"));
                            entry.put("size", (int) Double.parseDouble(values.get(1).toString()));
                            sizes.add(entry);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch database sizes: {}", e.getMessage());
        }
        return sizes;
    }
}
