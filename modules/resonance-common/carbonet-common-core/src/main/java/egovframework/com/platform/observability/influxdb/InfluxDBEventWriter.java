package egovframework.com.platform.observability.influxdb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InfluxDBEventWriter {

    private static final Logger log = LoggerFactory.getLogger(InfluxDBEventWriter.class);

    private static final String INFLUXDB_URL = System.getenv("INFLUXDB_URL") != null
            ? System.getenv("INFLUXDB_URL") : "http://influxdb.monitoring:8086";
    private static final String INFLUXDB_TOKEN = System.getenv("INFLUXDB_TOKEN") != null
            ? System.getenv("INFLUXDB_TOKEN") : "hermes-admin-token";
    private static final String INFLUXDB_ORG = System.getenv("INFLUXDB_ORG") != null
            ? System.getenv("INFLUXDB_ORG") : "hermes";
    private static final String INFLUXDB_BUCKET = System.getenv("INFLUXDB_BUCKET") != null
            ? System.getenv("INFLUXDB_BUCKET") : "events";

    private final boolean enabled;

    public InfluxDBEventWriter() {
        this.enabled = checkConnection();
        if (enabled) {
            log.info("InfluxDB event writer initialized. URL={}, Bucket={}", INFLUXDB_URL, INFLUXDB_BUCKET);
        } else {
            log.warn("InfluxDB connection failed. Events will not be sent to InfluxDB.");
        }
    }

    private boolean checkConnection() {
        try {
            URL url = new URL(INFLUXDB_URL + "/health");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            int responseCode = conn.getResponseCode();
            conn.disconnect();
            return responseCode == 200;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    @Async
    public void writeEvent(String measurement, Map<String, String> tags, Map<String, Object> fields) {
        if (!enabled) {
            return;
        }
        try {
            String lineProtocol = buildLineProtocol(measurement, tags, fields);
            sendToInfluxDB(lineProtocol);
        } catch (Exception e) {
            log.debug("Failed to write event to InfluxDB: {}", e.getMessage());
        }
    }

    public void writeAuditEvent(String actionCode, String entityId, String traceId,
                                 String actorId, String resultStatus, Map<String, Object> extraFields) {
        Map<String, String> tags = new ConcurrentHashMap<>();
        tags.put("type", "audit");
        tags.put("actionCode", actionCode);
        tags.put("entityType", entityId != null ? "unknown" : "");
        tags.put("resultStatus", resultStatus != null ? resultStatus : "UNKNOWN");

        Map<String, Object> fields = new ConcurrentHashMap<>();
        fields.put("entityId", entityId != null ? entityId : "");
        fields.put("traceId", traceId != null ? traceId : "");
        fields.put("actorId", actorId != null ? actorId : "");
        if (extraFields != null) {
            fields.putAll(extraFields);
        }

        writeEvent("audit_events", tags, fields);
    }

    public void writeK8sEvent(String eventType, String source, String message,
                              Map<String, Object> extraFields) {
        Map<String, String> tags = new ConcurrentHashMap<>();
        tags.put("type", eventType);
        tags.put("source", source);

        Map<String, Object> fields = new ConcurrentHashMap<>();
        fields.put("message", message != null ? message : "");
        if (extraFields != null) {
            fields.putAll(extraFields);
        }

        writeEvent("k8s_events", tags, fields);
    }

    public void writeHermesEvent(String eventType, String sessionId, String content,
                                  Map<String, Object> extraFields) {
        Map<String, String> tags = new ConcurrentHashMap<>();
        tags.put("type", eventType);
        tags.put("source", "hermes");

        Map<String, Object> fields = new ConcurrentHashMap<>();
        fields.put("sessionId", sessionId != null ? sessionId : "");
        fields.put("content", content != null ? content.substring(0, Math.min(content.length(), 500)) : "");
        if (extraFields != null) {
            fields.putAll(extraFields);
        }

        writeEvent("hermes_events", tags, fields);
    }

    private String buildLineProtocol(String measurement, Map<String, String> tags, Map<String, Object> fields) {
        StringBuilder sb = new StringBuilder();
        sb.append(measurement);

        if (tags != null && !tags.isEmpty()) {
            tags.forEach((key, value) -> {
                if (value != null && !value.isEmpty()) {
                    sb.append(",").append(escapeTag(key)).append("=").append(escapeTag(value));
                }
            });
        }

        sb.append(" ");
        if (fields != null && !fields.isEmpty()) {
            boolean first = true;
            for (Map.Entry<String, Object> entry : fields.entrySet()) {
                if (entry.getValue() != null) {
                    if (!first) sb.append(",");
                    sb.append(escapeFieldKey(entry.getKey())).append("=").append(escapeFieldValue(entry.getValue()));
                    first = false;
                }
            }
        }

        sb.append(" ").append(Instant.now().toEpochMilli() * 1_000_000);

        return sb.toString();
    }

    private String escapeTag(String value) {
        return value.replace(",", "\\,").replace(" ", "\\ ").replace("=", "\\=");
    }

    private String escapeFieldKey(String key) {
        return key.replace(",", "\\,").replace(" ", "\\ ").replace("=", "\\=");
    }

    private String escapeFieldValue(Object value) {
        String str = String.valueOf(value);
        if (value instanceof String) {
            return "\"" + str.replace("\"", "\\\"").replace("\\\\", "\\\\") + "\"";
        } else if (value instanceof Number) {
            return str;
        } else {
            return "\"" + str.replace("\"", "\\\"").replace("\\\\", "\\\\") + "\"";
        }
    }

    private void sendToInfluxDB(String lineProtocol) throws IOException {
        URL url = new URL(INFLUXDB_URL + "/api/v2/write?org=" + INFLUXDB_ORG + "&bucket=" + INFLUXDB_BUCKET);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setDoOutput(true);
        conn.setRequestProperty("Authorization", "Token " + INFLUXDB_TOKEN);
        conn.setRequestProperty("Content-Type", "text/plain; charset=utf-8");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        try {
            byte[] bytes = lineProtocol.getBytes(StandardCharsets.UTF_8);
            conn.getOutputStream().write(bytes);
            conn.getOutputStream().flush();
            conn.getOutputStream().close();

            int responseCode = conn.getResponseCode();
            if (responseCode != 204 && responseCode != 200) {
                log.debug("InfluxDB write returned code: {}", responseCode);
            }
        } finally {
            conn.disconnect();
        }
    }
}