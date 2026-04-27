package egovframework.com.common.audit;

import egovframework.com.common.mapper.ObservabilityMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class PersistingAuditEventWriter implements AuditEventWriter {

    private static final Logger log = LoggerFactory.getLogger(PersistingAuditEventWriter.class);

    private final ObservabilityMapper observabilityMapper;

    public PersistingAuditEventWriter(ObservabilityMapper observabilityMapper) {
        this.observabilityMapper = observabilityMapper;
    }

    @Override
    public void write(AuditEvent auditEvent) {
        try {
            observabilityMapper.insertAuditEvent(auditEvent);
        } catch (Exception e) {
            if (isClobBindingIssue(e)) {
                log.warn("Audit event persistence failed due to CLOB binding. Retrying with compact payload. actionCode={}, entityId={}",
                        auditEvent.getActionCode(), auditEvent.getEntityId());
                AuditEvent compactAuditEvent = AuditEvent.builder()
                        .auditId(auditEvent.getAuditId())
                        .projectId(auditEvent.getProjectId())
                        .traceId(auditEvent.getTraceId())
                        .requestId(auditEvent.getRequestId())
                        .actorId(auditEvent.getActorId())
                        .actorRole(auditEvent.getActorRole())
                        .menuCode(auditEvent.getMenuCode())
                        .pageId(auditEvent.getPageId())
                        .actionCode(auditEvent.getActionCode())
                        .entityType(auditEvent.getEntityType())
                        .entityId(auditEvent.getEntityId())
                        .resultStatus(auditEvent.getResultStatus())
                        .reasonSummary(truncate(auditEvent.getReasonSummary(), 1000))
                        .beforeSummaryJson(null)
                        .afterSummaryJson(null)
                        .requestUri(auditEvent.getRequestUri())
                        .httpMethod(auditEvent.getHttpMethod())
                        .ipAddress(auditEvent.getIpAddress())
                        .userAgent(truncate(auditEvent.getUserAgent(), 500))
                        .build();
                try {
                    observabilityMapper.insertAuditEvent(compactAuditEvent);
                    return;
                } catch (Exception retryException) {
                    log.warn("Failed to persist audit event after compact retry. actionCode={}, entityId={}",
                            auditEvent.getActionCode(), auditEvent.getEntityId(), retryException);
                    return;
                }
            }
            log.warn("Failed to persist audit event. actionCode={}, entityId={}",
                    auditEvent.getActionCode(), auditEvent.getEntityId(), e);
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

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }
}
