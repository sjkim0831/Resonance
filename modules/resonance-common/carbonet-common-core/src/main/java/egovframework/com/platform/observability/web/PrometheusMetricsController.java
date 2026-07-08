package egovframework.com.platform.observability.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
            response.put("environment", buildEnvironment());
            response.put("prometheusTargets", fetchTargets());
            response.put("pgUp", fetchScalar("pg_up"));
            response.put("databaseSizes", fetchDatabaseSizes());
            response.put("activityByState", fetchSeries("pg_stat_activity_count", "state"));
            response.put("activityByDatabase", fetchSeries("sum by (datname) (pg_stat_activity_count)", "datname"));
            response.put("activeConnections", fetchScalar("sum(pg_stat_activity_count{state=\"active\"})"));
            response.put("totalConnections", fetchScalar("sum(pg_stat_activity_count)"));
            response.put("maxConnections", fetchScalar("pg_settings_max_connections"));
            response.put("connectionUsagePercent", fetchScalar("sum(pg_stat_activity_count) / scalar(pg_settings_max_connections) * 100"));
            response.put("replicationLag", fetchScalar("pg_replication_lag_seconds"));
            response.put("replicationIsReplica", fetchScalar("pg_replication_is_replica"));
            response.put("replicationSlotsActive", fetchScalar("pg_replication_slots_active"));
            response.put("walSize", fetchScalar("pg_wal_size_bytes"));
            response.put("walSegments", fetchScalar("pg_wal_segments"));
            response.put("locksByMode", fetchSeries("sum by (mode) (pg_locks_count)", "mode"));
            response.put("accessShareLocks", fetchScalar("sum(pg_locks_count{mode=\"accesssharelock\"})"));
            response.put("exclusiveLocks", fetchScalar("sum(pg_locks_count{mode=~\".*exclusive.*\"})"));
            response.put("transactionStats", fetchTransactionStats());
            response.put("cacheHitPercent", fetchScalar("sum(pg_stat_database_blks_hit) / (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read)) * 100"));
            response.put("deadlocks", fetchScalar("sum(pg_stat_database_deadlocks)"));
            response.put("tempBytes", fetchScalar("sum(pg_stat_database_temp_bytes)"));
            response.put("tableStats", fetchTableStats());
            response.put("settings", fetchSettings());
            response.put("lastScrapeError", fetchScalar("pg_exporter_last_scrape_error"));
            response.put("scrapeDuration", fetchScalar("pg_exporter_last_scrape_duration_seconds"));
            response.put("scrapesTotal", fetchScalar("pg_exporter_scrapes_total"));
            response.put("timestamp", System.currentTimeMillis());
            response.put("timestampIso", Instant.now().toString());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to fetch Prometheus metrics", e);
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("error", e.getMessage());
            error.put("environment", buildEnvironment());
            error.put("timestamp", System.currentTimeMillis());
            return ResponseEntity.internalServerError().body(error);
        }
    }

    private Map<String, Object> buildEnvironment() {
        Map<String, Object> env = new LinkedHashMap<>();
        env.put("cluster", "carbonet-prod");
        env.put("databaseEngine", "PostgreSQL");
        env.put("haManager", "Patroni 3.2.2");
        env.put("patroniCluster", "postgres-patroni");
        env.put("pgData", "/home/postgres/pgdata/pgroot/data");
        env.put("writeService", "postgres-haproxy.carbonet-prod.svc.cluster.local:5432");
        env.put("readService", "postgres-haproxy.carbonet-prod.svc.cluster.local:5433");
        env.put("legacyService", "postgres-ha.carbonet-prod.svc.cluster.local:5432");
        env.put("pooler", "postgres-pgbouncer.carbonet-prod.svc.cluster.local:5432");
        env.put("poolerAdmin", "postgres-pgbouncer.carbonet-prod.svc.cluster.local:5433");
        env.put("exporter", "postgres-exporter.monitoring.svc.cluster.local:9187");
        env.put("prometheus", prometheusUrl);
        env.put("grafana", "http://172.16.1.232:30300");
        env.put("externalPatroniNodePort", "172.16.1.232:31433");
        env.put("externalHaNodePort", "172.16.1.232:31432");
        env.put("directHaNodePort", "172.16.1.232:31434");
        List<Map<String, Object>> nodes = new ArrayList<>();
        nodes.add(node("postgres-patroni-0", "Leader", "running", "10.244.0.215", 7, 0));
        nodes.add(node("postgres-patroni-1", "Replica", "streaming", "10.244.0.217", 7, 0));
        nodes.add(node("postgres-patroni-2", "Replica", "streaming", "10.244.0.218", 7, 0));
        env.put("patroniMembers", nodes);
        return env;
    }

    private Map<String, Object> node(String name, String role, String state, String host, int timeline, int lagMb) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("name", name);
        node.put("role", role);
        node.put("state", state);
        node.put("host", host);
        node.put("timeline", timeline);
        node.put("lagMb", lagMb);
        return node;
    }

    private List<Map<String, Object>> fetchTargets() {
        List<Map<String, Object>> targets = new ArrayList<>();
        try {
            Map<String, Object> result = getJson(prometheusUrl + "/api/v1/targets");
            Map<String, Object> data = asMap(result.get("data"));
            List<Object> activeTargets = asList(data.get("activeTargets"));
            for (Object targetObject : activeTargets) {
                Map<String, Object> target = asMap(targetObject);
                Map<String, Object> labels = asMap(target.get("labels"));
                String labelText = labels.toString().toLowerCase();
                if (!labelText.contains("postgres") && !labelText.contains("patroni") && !labelText.contains("pgbouncer")) {
                    continue;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("job", labels.getOrDefault("job", "-"));
                row.put("instance", labels.getOrDefault("instance", "-"));
                row.put("health", target.getOrDefault("health", "unknown"));
                row.put("lastScrape", target.getOrDefault("lastScrape", "-"));
                row.put("lastError", target.getOrDefault("lastError", ""));
                targets.add(row);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch Prometheus targets: {}", e.getMessage());
        }
        return targets;
    }

    private Map<String, Object> fetchTransactionStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("commits", fetchScalar("sum(pg_stat_database_xact_commit)"));
        stats.put("rollbacks", fetchScalar("sum(pg_stat_database_xact_rollback)"));
        stats.put("rollbackPercent", fetchScalar("sum(pg_stat_database_xact_rollback) / (sum(pg_stat_database_xact_commit) + sum(pg_stat_database_xact_rollback)) * 100"));
        stats.put("commitsPerSecond", fetchScalar("sum(rate(pg_stat_database_xact_commit[5m]))"));
        stats.put("rollbacksPerSecond", fetchScalar("sum(rate(pg_stat_database_xact_rollback[5m]))"));
        return stats;
    }

    private Map<String, Object> fetchSettings() {
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("maxConnections", fetchScalar("pg_settings_max_connections"));
        settings.put("sharedBuffersBytes", fetchScalar("pg_settings_shared_buffers_bytes"));
        settings.put("effectiveCacheSizeBytes", fetchScalar("pg_settings_effective_cache_size_bytes"));
        settings.put("workMemBytes", fetchScalar("pg_settings_work_mem_bytes"));
        settings.put("maintenanceWorkMemBytes", fetchScalar("pg_settings_maintenance_work_mem_bytes"));
        settings.put("walKeepSizeBytes", fetchScalar("pg_settings_wal_keep_size_bytes"));
        settings.put("maxWalSizeBytes", fetchScalar("pg_settings_max_wal_size_bytes"));
        settings.put("minWalSizeBytes", fetchScalar("pg_settings_min_wal_size_bytes"));
        settings.put("maxWalSenders", fetchScalar("pg_settings_max_wal_senders"));
        settings.put("maxReplicationSlots", fetchScalar("pg_settings_max_replication_slots"));
        settings.put("autovacuum", fetchScalar("pg_settings_autovacuum"));
        settings.put("hotStandby", fetchScalar("pg_settings_hot_standby"));
        settings.put("ssl", fetchScalar("pg_settings_ssl"));
        return settings;
    }

    private List<Map<String, Object>> fetchTableStats() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Double> live = fetchNamedValues("topk(10, pg_stat_user_tables_n_live_tup)", "relname");
        Map<String, Double> dead = fetchNamedValues("topk(10, pg_stat_user_tables_n_dead_tup)", "relname");
        Map<String, Double> size = fetchNamedValues("topk(10, pg_stat_user_tables_size_bytes)", "relname");
        for (String table : live.keySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", table);
            row.put("liveRows", live.getOrDefault(table, 0.0));
            row.put("deadRows", dead.getOrDefault(table, 0.0));
            row.put("sizeBytes", size.getOrDefault(table, 0.0));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> fetchDatabaseSizes() {
        List<Map<String, Object>> sizes = new ArrayList<>();
        for (MetricSample sample : query("pg_database_size_bytes")) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", sample.metric.getOrDefault("datname", "unknown"));
            entry.put("size", sample.value);
            sizes.add(entry);
        }
        return sizes;
    }

    private List<Map<String, Object>> fetchSeries(String query, String label) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (MetricSample sample : query(query)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", sample.metric.getOrDefault(label, "unknown"));
            row.put("value", sample.value);
            rows.add(row);
        }
        return rows;
    }

    private Map<String, Double> fetchNamedValues(String query, String label) {
        Map<String, Double> values = new LinkedHashMap<>();
        for (MetricSample sample : query(query)) {
            values.put(sample.metric.getOrDefault(label, "unknown"), sample.value);
        }
        return values;
    }

    private double fetchScalar(String query) {
        List<MetricSample> samples = query(query);
        return samples.isEmpty() ? 0.0 : samples.get(0).value;
    }

    private List<MetricSample> query(String query) {
        List<MetricSample> samples = new ArrayList<>();
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            Map<String, Object> result = getJson(prometheusUrl + "/api/v1/query?query=" + encoded);
            if (!"success".equals(result.get("status"))) {
                return samples;
            }
            Map<String, Object> data = asMap(result.get("data"));
            for (Object item : asList(data.get("result"))) {
                Map<String, Object> row = asMap(item);
                Map<String, String> metric = new LinkedHashMap<>();
                for (Map.Entry<String, Object> entry : asMap(row.get("metric")).entrySet()) {
                    metric.put(entry.getKey(), String.valueOf(entry.getValue()));
                }
                List<Object> value = asList(row.get("value"));
                if (value.size() > 1) {
                    samples.add(new MetricSample(metric, Double.parseDouble(String.valueOf(value.get(1)))));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch metric {}: {}", query, e.getMessage());
        }
        return samples;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getJson(String url) {
        Map<String, Object> body = restTemplate.getForObject(URI.create(url), Map.class);
        return body == null ? Map.of() : body;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Object> asList(Object value) {
        return value instanceof List<?> ? (List<Object>) value : List.of();
    }

    private record MetricSample(Map<String, String> metric, double value) {
    }
}
