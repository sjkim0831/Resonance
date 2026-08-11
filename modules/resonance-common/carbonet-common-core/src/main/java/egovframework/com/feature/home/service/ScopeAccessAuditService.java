package egovframework.com.feature.home.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.util.Map;
import java.util.Objects;

/**
 * Persists one immutable authorization-decision fact independently from the
 * business transaction that will be rolled back after a denial.
 */
@Service
public class ScopeAccessAuditService {
    public enum ActionCode {
        PROJECT_PARTICIPANT_READ,
        EMISSION_PROJECT_OPERATION,
        REGULATORY_SUBMISSION_CREATE,
        REGULATORY_SUBMISSION_TRANSITION
    }

    public enum ResourceType {
        EMISSION_PROJECT,
        REGULATORY_SUBMISSION
    }

    public record AuditEvidence(long auditId, String rowHash) { }

    /** Authorization stays denied and the persistence outage remains visible. */
    public static final class AuditPersistenceException extends SecurityException {
        public AuditPersistenceException(RuntimeException cause) {
            super("AUTHORIZATION_DENIED_AUDIT_PERSISTENCE_FAILED", cause);
        }
    }

    private final JdbcTemplate jdbc;

    @Autowired
    public ScopeAccessAuditService(DataSource dataSource) {
        this(new JdbcTemplate(dataSource));
    }

    ScopeAccessAuditService(JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Each authorization attempt appends exactly one row. A client retry is a
     * new decision fact with a new audit id; this method performs no dedupe.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditEvidence recordDenied(String accountId,
                                      String tenantId,
                                      String projectId,
                                      ActionCode actionCode,
                                      ResourceType resourceType,
                                      String reasonCode) {
        String account = required(accountId, "accountId");
        String tenant = required(tenantId, "tenantId");
        String project = required(projectId, "projectId");
        String reason = required(reasonCode, "reasonCode");
        Objects.requireNonNull(actionCode, "actionCode");
        Objects.requireNonNull(resourceType, "resourceType");
        try {
            Map<String, Object> row = jdbc.queryForMap(
                    "INSERT INTO framework_scope_access_audit(" +
                            "account_id,tenant_id,project_id,decision_code,reason_code,action_code,resource_type" +
                            ") VALUES (?,?,?,'DENIED',?,?,?) RETURNING audit_id,row_hash",
                    account, tenant, project, reason, actionCode.name(), resourceType.name());
            return new AuditEvidence(((Number) row.get("audit_id")).longValue(), String.valueOf(row.get("row_hash")));
        } catch (RuntimeException persistenceFailure) {
            throw new AuditPersistenceException(persistenceFailure);
        }
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
        return value.trim();
    }
}
