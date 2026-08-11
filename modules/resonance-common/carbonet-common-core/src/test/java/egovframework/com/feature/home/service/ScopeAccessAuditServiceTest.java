package egovframework.com.feature.home.service;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScopeAccessAuditServiceTest {

    @Test
    void denialAuditUsesRequiresNewAndReturnsDatabaseIntegrityBinding() throws Exception {
        Method method=ScopeAccessAuditService.class.getMethod("recordDenied",
                String.class,String.class,String.class,
                ScopeAccessAuditService.ActionCode.class,ScopeAccessAuditService.ResourceType.class,String.class);
        Transactional transactional=method.getAnnotation(Transactional.class);
        assertEquals(Propagation.REQUIRES_NEW,transactional.propagation());

        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        when(jdbc.queryForMap(anyString(),any(Object[].class)))
                .thenReturn(Map.of("audit_id",41L,"row_hash","a".repeat(64)))
                .thenReturn(Map.of("audit_id",42L,"row_hash","b".repeat(64)));
        ScopeAccessAuditService service=new ScopeAccessAuditService(jdbc);

        ScopeAccessAuditService.AuditEvidence first=service.recordDenied(
                "wrong.actor","TENANT-1","PRJ-1",
                ScopeAccessAuditService.ActionCode.REGULATORY_SUBMISSION_TRANSITION,
                ScopeAccessAuditService.ResourceType.REGULATORY_SUBMISSION,
                "ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER");
        ScopeAccessAuditService.AuditEvidence retry=service.recordDenied(
                "wrong.actor","TENANT-1","PRJ-1",
                ScopeAccessAuditService.ActionCode.REGULATORY_SUBMISSION_TRANSITION,
                ScopeAccessAuditService.ResourceType.REGULATORY_SUBMISSION,
                "ACTOR_NOT_AUTHORIZED:APPROVER|VERIFIER");

        assertEquals(41L,first.auditId());
        assertEquals("a".repeat(64),first.rowHash());
        assertEquals(42L,retry.auditId());
        verify(jdbc,times(2)).queryForMap(contains("RETURNING audit_id,row_hash"),any(Object[].class));
    }

    @Test
    void persistenceFailureRemainsFailClosedAndKeepsDatabaseCauseVisible() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        DataAccessResourceFailureException databaseFailure=new DataAccessResourceFailureException("audit database offline");
        when(jdbc.queryForMap(anyString(),any(Object[].class))).thenThrow(databaseFailure);
        ScopeAccessAuditService service=new ScopeAccessAuditService(jdbc);

        ScopeAccessAuditService.AuditPersistenceException denial=assertThrows(
                ScopeAccessAuditService.AuditPersistenceException.class,
                () -> service.recordDenied("wrong.actor","TENANT-1","PRJ-1",
                        ScopeAccessAuditService.ActionCode.EMISSION_PROJECT_OPERATION,
                        ScopeAccessAuditService.ResourceType.EMISSION_PROJECT,"PROJECT_ACTOR_SCOPE_DENIED"));

        assertEquals("AUTHORIZATION_DENIED_AUDIT_PERSISTENCE_FAILED",denial.getMessage());
        assertInstanceOf(DataAccessResourceFailureException.class,denial.getCause());
        verify(jdbc).queryForMap(anyString(),any(Object[].class));
    }
}
