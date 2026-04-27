package egovframework.com.platform.observability.model;

import egovframework.com.common.logging.RequestExecutionLogVO;
import lombok.Getter;

import java.util.Collections;
import java.util.List;

@Getter
public class SecurityAuditSnapshot {

    private final List<RequestExecutionLogVO> auditLogs;
    private final SecurityAuditAggregate aggregate;

    public SecurityAuditSnapshot(List<RequestExecutionLogVO> auditLogs, SecurityAuditAggregate aggregate) {
        this.auditLogs = auditLogs == null ? Collections.emptyList() : auditLogs;
        this.aggregate = aggregate == null ? SecurityAuditAggregate.empty() : aggregate;
    }

    public static SecurityAuditSnapshot empty() {
        return new SecurityAuditSnapshot(Collections.emptyList(), SecurityAuditAggregate.empty());
    }
}
