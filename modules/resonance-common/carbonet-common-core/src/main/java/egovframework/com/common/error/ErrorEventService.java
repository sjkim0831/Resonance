package egovframework.com.common.error;

import egovframework.com.common.mapper.ObservabilityMapper;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.trace.FrontendTelemetryEvent;
import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.common.trace.TraceIdGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.http.HttpServletRequest;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ErrorEventService {

    private static final Logger log = LoggerFactory.getLogger(ErrorEventService.class);

    private final ObservabilityMapper observabilityMapper;
    private final ProjectRuntimeContext projectRuntimeContext;

    public void recordBackendError(String sourceType,
                                   String errorType,
                                   HttpServletRequest request,
                                   String actorId,
                                   String actorRole,
                                   String actorInsttId,
                                   int statusCode,
                                   Throwable throwable,
                                   String message) {
        TraceContext traceContext = TraceContextHolder.get();
        ErrorEventRecordVO record = baseRecord(sourceType, errorType, traceContext);
        record.setActorId(safe(actorId));
        record.setActorRole(safe(actorRole));
        record.setActorInsttId(safe(actorInsttId));
        record.setRequestUri(request == null ? "" : safe(request.getRequestURI()));
        record.setRemoteAddr(request == null ? "" : safe(request.getRemoteAddr()));
        record.setMessage(truncate(firstNonBlank(message, throwable == null ? "" : throwable.getMessage()), 4000));
        record.setStackSummary(truncate(buildStackSummary(throwable), 6000));
        record.setResultStatus(statusCode > 0 ? Integer.toString(statusCode) : "ERROR");
        record.setUserAgent(request == null ? "" : truncate(request.getHeader("User-Agent"), 500));
        persist(record);
    }

    public void recordFrontendTelemetryErrors(List<FrontendTelemetryEvent> events) {
        if (events == null || events.isEmpty()) {
            return;
        }
        for (FrontendTelemetryEvent event : events) {
            if (event == null || !"UI_ERROR".equals(normalizeType(event.getType()))) {
                continue;
            }
        ErrorEventRecordVO record = new ErrorEventRecordVO();
        record.setErrorId(TraceIdGenerator.next("ERR"));
        record.setProjectId(currentProjectId());
        record.setTraceId(safe(event.getTraceId()));
            record.setRequestId(safe(event.getRequestId()));
            record.setPageId(safe(event.getPageId()));
            record.setApiId(safe(event.getApiId()));
            record.setSourceType("FRONTEND_TELEMETRY");
            record.setErrorType("UI_ERROR");
            record.setMessage(truncate(extractPayloadValue(event.getPayloadSummary(), "message"), 4000));
            record.setStackSummary(truncate(extractPayloadValue(event.getPayloadSummary(), "stack"), 6000));
            record.setResultStatus(firstNonBlank(safe(event.getResult()), "ERROR"));
            persist(record);
        }
    }

    public void recordFrontendErrorReport(String fingerprint,
                                          String actorId,
                                          String actorInsttId,
                                          HttpServletRequest request,
                                          String pageId,
                                          String url,
                                          String errorType,
                                          String message,
                                          String stack,
                                          String userAgent) {
        TraceContext traceContext = TraceContextHolder.get();
        ErrorEventRecordVO record = baseRecord("FRONTEND_REPORT", errorType, traceContext);
        record.setActorId(safe(actorId));
        record.setActorInsttId(safe(actorInsttId));
        record.setRequestUri(firstNonBlank(url, request == null ? "" : request.getRequestURI()));
        record.setRemoteAddr(request == null ? "" : safe(request.getRemoteAddr()));
        record.setPageId(firstNonBlank(pageId, record.getPageId()));
        record.setMessage(truncate(firstNonBlank(message, fingerprint), 4000));
        record.setStackSummary(truncate(stack, 6000));
        record.setResultStatus("REPORTED");
        record.setUserAgent(truncate(firstNonBlank(userAgent, request == null ? "" : request.getHeader("User-Agent")), 500));
        persist(record);
    }

    private ErrorEventRecordVO baseRecord(String sourceType, String errorType, TraceContext traceContext) {
        ErrorEventRecordVO record = new ErrorEventRecordVO();
        record.setErrorId(TraceIdGenerator.next("ERR"));
        record.setProjectId(currentProjectId());
        record.setTraceId(traceContext == null ? "" : safe(traceContext.getTraceId()));
        record.setRequestId(traceContext == null ? "" : safe(traceContext.getRequestId()));
        record.setPageId(traceContext == null ? "" : safe(traceContext.getPageId()));
        record.setApiId(traceContext == null ? "" : safe(traceContext.getApiId()));
        record.setSourceType(safe(sourceType));
        record.setErrorType(firstNonBlank(safe(errorType), "ERROR"));
        return record;
    }

    private void persist(ErrorEventRecordVO record) {
        try {
            observabilityMapper.insertErrorEvent(record);
        } catch (Exception e) {
            if (isClobBindingIssue(e)) {
                log.warn("Error event persistence failed due to CLOB binding. Retrying with compact text. source={}, type={}",
                        record.getSourceType(), record.getErrorType());
                record.setMessage(truncate(record.getMessage(), 500));
                record.setStackSummary(null);
                try {
                    observabilityMapper.insertErrorEvent(record);
                    return;
                } catch (Exception retryException) {
                    log.warn("Failed to persist error event after compact retry. source={}, type={}",
                            record.getSourceType(), record.getErrorType(), retryException);
                    return;
                }
            }
            log.warn("Failed to persist error event. source={}, type={}", record.getSourceType(), record.getErrorType(), e);
        }
    }

    private boolean isClobBindingIssue(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains("type clob")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String buildStackSummary(Throwable throwable) {
        if (throwable == null) {
            return "";
        }
        StringWriter writer = new StringWriter();
        throwable.printStackTrace(new PrintWriter(writer));
        return writer.toString();
    }

    private String extractPayloadValue(Map<String, Object> payload, String key) {
        if (payload == null || key == null) {
            return "";
        }
        Object value = payload.get(key);
        if (value == null && payload.get("summary") instanceof Map<?, ?>) {
            value = ((Map<?, ?>) payload.get("summary")).get(key);
        }
        return value == null ? "" : value.toString();
    }

    private String normalizeType(String value) {
        return safe(value).replace('-', '_').toUpperCase(Locale.ROOT);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String currentProjectId() {
        return safe(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
    }

    private String truncate(String value, int maxLength) {
        String safeValue = safe(value);
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, maxLength);
    }
}
