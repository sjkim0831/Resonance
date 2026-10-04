package egovframework.com.common.trace;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.mapper.ObservabilityMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class TraceEventService {

    private final ObservabilityMapper observabilityMapper;
    private final ObjectMapper objectMapper;
    private final ProjectRuntimeContext projectRuntimeContext;
    @org.springframework.beans.factory.annotation.Value("${ccus.telemetry.technical-rollup.enabled:true}")
    private boolean technicalRollupEnabled = true;

    public TraceEventService(ObservabilityMapper observabilityMapper, ObjectMapper objectMapper, ProjectRuntimeContext projectRuntimeContext) {
        this.observabilityMapper = observabilityMapper;
        this.objectMapper = objectMapper;
        this.projectRuntimeContext = projectRuntimeContext;
    }

    public boolean tryAggregateTechnicalRequest(TraceContext traceContext, String resultCode, int durationMs, int responseStatus) {
        if (traceContext == null) return false;
        if (technicalRollupEnabled && "GET".equals(traceContext.getHttpMethod())
                && "/api/frontend/session".equals(traceContext.getRequestUri())
                && "SUCCESS".equals(resultCode) && responseStatus >= 200 && responseStatus < 300) {
            if (traceContext.isTechnicalRequestAggregated()) return true;
            try {
                int stored = observabilityMapper.aggregateTechnicalRequest(Map.of(
                        "projectId", currentProjectId(), "route", traceContext.getRequestUri(),
                        "method", "GET", "status", responseStatus, "durationMs", Math.max(0, durationMs)));
                if (stored == 1) {
                    traceContext.markTechnicalRequestAggregated();
                    return true;
                }
            } catch (Exception aggregationFailure) {
                // Fail open for observability: retain the original individual event.
                log.warn("Technical request aggregation unavailable; preserving individual trace");
            }
        }
        return false;
    }

    public void recordRequestEvent(TraceContext traceContext, String resultCode, int durationMs, int responseStatus) {
        if (traceContext == null) return;
        if (tryAggregateTechnicalRequest(traceContext, resultCode, durationMs, responseStatus)) return;
        TraceEventRecordVO traceEvent = new TraceEventRecordVO();
        traceEvent.setEventId(TraceIdGenerator.next("EVT"));
        traceEvent.setProjectId(currentProjectId());
        traceEvent.setTraceId(traceContext.getTraceId());
        traceEvent.setSpanId(traceContext.getRequestId());
        traceEvent.setParentSpanId("");
        traceEvent.setEventType("REQUEST_OUT");
        traceEvent.setPageId(traceContext.getPageId());
        traceEvent.setApiId(traceContext.getApiId());
        traceEvent.setResultCode(resultCode);
        traceEvent.setDurationMs(durationMs);
        Map<String, Object> requestPayload = new LinkedHashMap<>();
        requestPayload.put("uri", safe(traceContext.getRequestUri()));
        requestPayload.put("method", safe(traceContext.getHttpMethod()));
        requestPayload.put("status", responseStatus);
        boolean technicalRead = "GET".equalsIgnoreCase(traceContext.getHttpMethod()) &&
                java.util.Set.of("/api/frontend/session", "/actuator/health").contains(safe(traceContext.getRequestUri()));
        boolean telemetryIngest = "/api/telemetry/events".equals(traceContext.getRequestUri());
        requestPayload.put("usageClassification", Map.of("version", 1,
                "origin", "UNKNOWN", "trust", "SERVER_ROUTE_CLASSIFICATION",
                "activity", telemetryIngest ? "TELEMETRY_INGEST" : technicalRead ? "TECHNICAL_READ" : "API_REQUEST",
                "attention", responseStatus >= 400 ? "ERROR_OR_SECURITY" : "NORMAL",
                "analyticsEligible", false));
        try { traceEvent.setPayloadSummaryJson(objectMapper.writeValueAsString(requestPayload)); }
        catch (JsonProcessingException ignored) { traceEvent.setPayloadSummaryJson("{}"); }
        tryInsertTraceEvent(traceEvent, "uri=" + traceContext.getRequestUri() + ", status=" + responseStatus);
    }

    public int recordFrontendEvents(List<FrontendTelemetryEvent> events) {
        return recordFrontendBatch(events).acceptedCount();
    }

    public record FrontendBatchResult(int acceptedCount, List<String> acceptedEventIds,
                                      List<FrontendTelemetryEvent> newEvents) {}

    public FrontendBatchResult recordFrontendBatch(List<FrontendTelemetryEvent> events) {
        List<String> acknowledged = new ArrayList<>();
        List<FrontendTelemetryEvent> inserted = new ArrayList<>();
        if (events == null || events.isEmpty()) {
            return new FrontendBatchResult(0, acknowledged, inserted);
        }

        int accepted = 0;
        for (FrontendTelemetryEvent event : events) {
            if (event == null) {
                continue;
            }
            String traceId = safe(event.getTraceId());
            String eventType = normalizeEventType(event.getType());
            if (traceId.isEmpty() || eventType.isEmpty()) {
                continue;
            }

            TraceEventRecordVO traceEvent = new TraceEventRecordVO();
            String clientId = safe(event.getEventId());
            if (!clientId.isEmpty() && !clientId.matches("[A-Za-z0-9_-]{16,80}")) continue;
            try {
                String identity = currentProjectId() + "|" + objectMapper.writer()
                        .with(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                        .writeValueAsString(event);
                traceEvent.setEventId(clientId.isEmpty() ? TraceIdGenerator.next("EVT") : "FE_" +
                        java.util.UUID.nameUUIDFromBytes(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            } catch (Exception serializationFailure) { continue; }
            traceEvent.setProjectId(currentProjectId());
            traceEvent.setTraceId(traceId);
            traceEvent.setSpanId(safe(event.getRequestId()));
            traceEvent.setParentSpanId(safe(event.getActionId()));
            traceEvent.setEventType(eventType);
            traceEvent.setPageId(safe(event.getPageId()));
            traceEvent.setComponentId(safe(event.getComponentId()));
            traceEvent.setFunctionId(safe(event.getFunctionId()));
            traceEvent.setApiId(safe(event.getApiId()));
            traceEvent.setResultCode(safe(event.getResult()));
            traceEvent.setDurationMs(event.getDurationMs());
            traceEvent.setPayloadSummaryJson(toPayloadJson(event));
            try {
                int rows = observabilityMapper.insertFrontendTraceEvent(traceEvent);
                accepted++;
                if (!clientId.isEmpty()) acknowledged.add(clientId);
                if (rows > 0) inserted.add(event);
            } catch (Exception persistenceFailure) {
                log.warn("Frontend telemetry persistence failed; event remains unacknowledged", persistenceFailure);
            }
        }
        return new FrontendBatchResult(accepted, acknowledged, inserted);
    }

    private boolean tryInsertTraceEvent(TraceEventRecordVO traceEvent, String contextSummary) {
        try {
            observabilityMapper.insertTraceEvent(traceEvent);
            return true;
        } catch (Exception e) {
            if (isClobBindingIssue(e) && traceEvent.getPayloadSummaryJson() != null) {
                log.warn("Trace payload persistence failed due to CLOB binding. Retrying without payload. {}", contextSummary);
                traceEvent.setPayloadSummaryJson(null);
                try {
                    observabilityMapper.insertTraceEvent(traceEvent);
                    return true;
                } catch (Exception retryException) {
                    log.warn("Failed to persist trace event after retry without payload. {}", contextSummary, retryException);
                    return false;
                }
            }
            log.warn("Failed to persist trace event. {}", contextSummary, e);
            return false;
        }
    }

    private boolean isClobBindingIssue(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase().contains("type clob")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String toPayloadJson(FrontendTelemetryEvent event) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("locale", safe(event.getLocale()));
        payload.put("requestId", safe(event.getRequestId()));
        payload.put("actionId", safe(event.getActionId()));
        payload.put("occurredAt", safe(event.getOccurredAt()));
        payload.put("summary", sanitizePayload(event.getPayloadSummary()));
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return "{\"summary\":{}}";
        }
    }

    @SuppressWarnings("unchecked")
    private Object sanitizePayload(Object value) {
        if (value == null) {
            return Collections.emptyMap();
        }
        if (value instanceof Map) {
            Map<String, Object> source = (Map<String, Object>) value;
            Map<String, Object> sanitized = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : source.entrySet()) {
                String key = entry.getKey() == null ? "" : entry.getKey().trim();
                sanitized.put(key, isSensitiveKey(key) ? "***" : sanitizePayload(entry.getValue()));
            }
            return sanitized;
        }
        if (value instanceof List) {
            List<?> source = (List<?>) value;
            List<Object> sanitized = new ArrayList<>();
            for (Object item : source) {
                sanitized.add(sanitizePayload(item));
            }
            return sanitized;
        }
        if (value instanceof String && ((String) value).length() > 1000) {
            return ((String) value).substring(0, 1000);
        }
        return value;
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key.toLowerCase();
        return normalized.contains("password")
                || normalized.contains("passwd")
                || normalized.contains("token")
                || normalized.contains("secret")
                || normalized.contains("authorization");
    }

    private String normalizeEventType(String value) {
        return safe(value).replace('-', '_').toUpperCase();
    }

    private String safe(String value) {
        return value == null ? "" : value.replace("\"", "'");
    }

    private String currentProjectId() {
        return safe(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
    }
}
