package egovframework.com.common.audit;

import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.common.trace.TraceIdGenerator;
import egovframework.com.common.context.ProjectRuntimeContext;
import org.springframework.stereotype.Service;

@Service
public class AuditTrailService {

    private final LoggingAuditEventWriter loggingAuditEventWriter;
    private final PersistingAuditEventWriter persistingAuditEventWriter;
    private final AuditPayloadMasker auditPayloadMasker;
    private final ProjectRuntimeContext projectRuntimeContext;

    public AuditTrailService(LoggingAuditEventWriter loggingAuditEventWriter,
                             PersistingAuditEventWriter persistingAuditEventWriter,
                             AuditPayloadMasker auditPayloadMasker,
                             ProjectRuntimeContext projectRuntimeContext) {
        this.loggingAuditEventWriter = loggingAuditEventWriter;
        this.persistingAuditEventWriter = persistingAuditEventWriter;
        this.auditPayloadMasker = auditPayloadMasker;
        this.projectRuntimeContext = projectRuntimeContext;
    }

    public void record(String actorId,
                       String actorRole,
                       String menuCode,
                       String pageId,
                       String actionCode,
                       String entityType,
                       String entityId,
                       String resultStatus,
                       String reasonSummary,
                       String beforeSummaryJson,
                       String afterSummaryJson,
                       String ipAddress,
                       String userAgent) {
        TraceContext traceContext = TraceContextHolder.get();
        AuditEvent auditEvent = AuditEvent.builder()
                .auditId(TraceIdGenerator.next("AUD"))
                .projectId(safe(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId()))
                .traceId(traceContext == null ? "" : traceContext.getTraceId())
                .requestId(traceContext == null ? "" : traceContext.getRequestId())
                .actorId(actorId)
                .actorRole(actorRole)
                .menuCode(menuCode)
                .pageId(pageId)
                .actionCode(actionCode)
                .entityType(entityType)
                .entityId(entityId)
                .resultStatus(resultStatus)
                .reasonSummary(reasonSummary)
                .beforeSummaryJson(auditPayloadMasker.mask(beforeSummaryJson))
                .afterSummaryJson(auditPayloadMasker.mask(afterSummaryJson))
                .requestUri(traceContext == null ? "" : traceContext.getRequestUri())
                .httpMethod(traceContext == null ? "" : traceContext.getHttpMethod())
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build();
        loggingAuditEventWriter.write(auditEvent);
        persistingAuditEventWriter.write(auditEvent);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
