package egovframework.com.common.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingAuditEventWriter implements AuditEventWriter {

    private static final Logger log = LoggerFactory.getLogger(LoggingAuditEventWriter.class);

    @Override
    public void write(AuditEvent auditEvent) {
        log.info("AUDIT traceId={} requestId={} actorId={} actionCode={} entityType={} entityId={} resultStatus={} uri={}",
                auditEvent.getTraceId(),
                auditEvent.getRequestId(),
                auditEvent.getActorId(),
                auditEvent.getActionCode(),
                auditEvent.getEntityType(),
                auditEvent.getEntityId(),
                auditEvent.getResultStatus(),
                auditEvent.getRequestUri());
    }
}
