package egovframework.com.common.audit;

public interface AuditEventWriter {

    void write(AuditEvent auditEvent);
}
