package egovframework.com.feature.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccountRecoveryServiceTest {

    private static final String USER_ID = "recovery-user";
    private static final String EMAIL = "recovery-user@example.test";
    private static final String CLIENT_IP = "192.0.2.41";
    private static final String NEW_PASSWORD = "Recovered1!";

    private JdbcTemplate jdbc;
    private AuthService authService;
    private Environment environment;
    private RecoveryLedger ledger;
    private AccountRecoveryService service;

    @BeforeEach
    void setUp() throws Exception {
        jdbc = mock(JdbcTemplate.class);
        authService = mock(AuthService.class);
        environment = mock(Environment.class);
        ledger = new RecoveryLedger();

        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(Object[].class))).thenReturn(0);
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(ledger::queryForList);
        doAnswer(ledger::update).when(jdbc).update(anyString(), any(Object[].class));
        when(authService.resetPassword(anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(true);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);

        service = new AccountRecoveryService(jdbc, new ObjectMapper(), authService, environment);
        setField(service, "recoveryPepper", "unit-test-pepper");
        setField(service, "deliveryUrl", "");
        setField(service, "deliveryBearerToken", "");
        setField(service, "developmentCodeEnabled", true);
    }

    @Test
    void requestVerifyCompleteConsumesProofAndDelegatesAtomicCredentialMutation() {
        AccountRecoveryService.RequestResult requested = requestCode();
        assertEquals("accepted", requested.status());
        assertNotNull(requested.requestId());
        assertTrue(requested.developmentCode().matches("\\d{6}"));
        assertEquals("CODE_SENT", ledger.value("status"));

        AccountRecoveryService.VerifyResult verified = service.verifyCode(
                requested.requestId(), requested.developmentCode(), CLIENT_IP, false);
        assertEquals("success", verified.status());
        assertNotNull(verified.recoveryProof());
        assertEquals("VERIFIED", ledger.value("status"));
        assertNull(ledger.row.get("otp_hash"));

        Object originalProofHash = ledger.row.get("proof_hash");
        Object originalProofExpiresAt = ledger.row.get("proof_expires_at");
        AccountRecoveryService.VerifyResult duplicateVerification = service.verifyCode(
                requested.requestId(), requested.developmentCode(), CLIENT_IP, false);
        assertEquals("fail", duplicateVerification.status());
        assertNull(duplicateVerification.recoveryProof());
        assertEquals("VERIFIED", ledger.value("status"));
        assertEquals(originalProofHash, ledger.row.get("proof_hash"));
        assertEquals(originalProofExpiresAt, ledger.row.get("proof_expires_at"));
        assertEquals(0, ledger.number("attempt_count"));

        AccountRecoveryService.CompleteResult completed = service.complete(
                requested.requestId(), verified.recoveryProof(), NEW_PASSWORD, CLIENT_IP, false);
        assertEquals("success", completed.status());
        assertEquals("COMPLETED", ledger.value("status"));
        assertNull(ledger.row.get("proof_hash"));

        AccountRecoveryService.VerifyResult verificationAfterCompletion = service.verifyCode(
                requested.requestId(), requested.developmentCode(), CLIENT_IP, false);
        assertEquals("fail", verificationAfterCompletion.status());
        assertNull(verificationAfterCompletion.recoveryProof());
        assertEquals("COMPLETED", ledger.value("status"));
        assertNull(ledger.row.get("proof_hash"));

        AccountRecoveryService.CompleteResult replayed = service.complete(
                requested.requestId(), verified.recoveryProof(), "Different2@", CLIENT_IP, false);
        assertEquals("fail", replayed.status());
        assertEquals("COMPLETED", ledger.value("status"));

        verify(authService, times(1)).resetPassword(
                USER_ID, "GNR", NEW_PASSWORD, USER_ID, CLIENT_IP, "ACCOUNT_RECOVERY");
        assertTrue(ledger.auditEvents.containsAll(List.of(
                "CODE_DISPATCHED", "CODE_VERIFIED", "CODE_REPLAY_REJECTED",
                "RECOVERY_COMPLETED", "PROOF_REJECTED")));
    }

    @Test
    void developmentCodeModeFailsStartupWithoutExplicitTestProfile() throws Exception {
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);

        IllegalStateException failure = assertThrows(
                IllegalStateException.class, service::validateDevelopmentCodeConfiguration);

        assertTrue(failure.getMessage().contains("explicit test profile"));
    }

    @Test
    void developmentCodeModeIsDisabledSafelyOutsideTestProfile() throws Exception {
        setField(service, "developmentCodeEnabled", false);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);

        service.validateDevelopmentCodeConfiguration();
        AccountRecoveryService.RequestResult requested = requestCode();

        assertNull(requested.developmentCode());
        assertEquals("DELIVERY_FAILED", ledger.value("status"));
    }

    @Test
    void uniqueLoginEligibleSubjectCreatesRecoveryChallenge() {
        ledger.subjectRows = List.of(subject("GNR"));

        AccountRecoveryService.RequestResult requested = requestCode();

        assertEquals("accepted", requested.status());
        assertNotNull(requested.developmentCode());
        assertEquals(USER_ID, ledger.value("target_user_id"));
        assertEquals("GNR", ledger.value("target_user_se"));
        assertNotNull(ledger.row.get("otp_hash"));
        assertEquals("CODE_SENT", ledger.value("status"));
        assertEligibilityScopedSubjectQuery();
    }

    @Test
    void duplicateLoginEligibleSubjectsAreSuppressedWithoutPersistingTargetOrSecrets() {
        ledger.subjectRows = List.of(subject("GNR"), subject("USR"));

        AccountRecoveryService.RequestResult requested = requestCode();

        assertSuppressedWithoutTargetOrSecrets(requested);
        assertEligibilityScopedSubjectQuery();
    }

    @Test
    void ineligibleOnlySubjectIsSuppressedWithoutPersistingTargetOrSecrets() {
        // The status-scoped UNION excludes inactive candidates, so an ineligible-only
        // database result is an empty eligible result set.
        ledger.subjectRows = List.of();

        AccountRecoveryService.RequestResult requested = requestCode();

        assertSuppressedWithoutTargetOrSecrets(requested);
        assertEligibilityScopedSubjectQuery();
    }

    @Test
    void completionFailsClosedWhenTheBoundAccountTypeIsNoLongerEligible() {
        AccountRecoveryService.RequestResult requested = requestCode();
        AccountRecoveryService.VerifyResult verified = service.verifyCode(
                requested.requestId(), requested.developmentCode(), CLIENT_IP, false);
        Object proofHash = ledger.row.get("proof_hash");
        when(authService.resetPassword(
                USER_ID, "GNR", NEW_PASSWORD, USER_ID, CLIENT_IP, "ACCOUNT_RECOVERY"))
                .thenReturn(false);

        IllegalStateException failure = assertThrows(IllegalStateException.class, () -> service.complete(
                requested.requestId(), verified.recoveryProof(), NEW_PASSWORD, CLIENT_IP, false));

        assertTrue(failure.getMessage().contains("type, eligibility, or existence"));
        assertEquals("VERIFIED", ledger.value("status"));
        assertEquals(proofHash, ledger.row.get("proof_hash"));
        verify(authService).resetPassword(
                USER_ID, "GNR", NEW_PASSWORD, USER_ID, CLIENT_IP, "ACCOUNT_RECOVERY");
    }

    @Test
    void fifthInvalidOtpLocksRequestAndRejectsThePreviouslyValidCode() {
        AccountRecoveryService.RequestResult requested = requestCode();
        String wrongCode = "000000".equals(requested.developmentCode()) ? "000001" : "000000";

        for (int attempt = 1; attempt <= 5; attempt++) {
            AccountRecoveryService.VerifyResult result = service.verifyCode(
                    requested.requestId(), wrongCode, CLIENT_IP, false);
            assertEquals("fail", result.status());
            assertNull(result.recoveryProof());
            assertEquals(attempt, ledger.number("attempt_count"));
        }

        assertEquals("LOCKED", ledger.value("status"));
        AccountRecoveryService.VerifyResult afterLock = service.verifyCode(
                requested.requestId(), requested.developmentCode(), CLIENT_IP, false);
        assertEquals("fail", afterLock.status());
        assertNull(afterLock.recoveryProof());
        assertEquals("LOCKED", ledger.value("status"));
        assertEquals(5, ledger.auditEvents.stream().filter("CODE_REJECTED"::equals).count());

        verify(authService, never()).resetPassword(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    private AccountRecoveryService.RequestResult requestCode() {
        return service.requestCode(USER_ID, EMAIL, CLIENT_IP, "account-recovery-unit-test", false);
    }

    private void assertSuppressedWithoutTargetOrSecrets(AccountRecoveryService.RequestResult requested) {
        assertEquals("accepted", requested.status());
        assertNull(requested.developmentCode());
        assertEquals("SUBJECT_NOT_FOUND", ledger.value("status"));
        assertEquals("SUPPRESSED", ledger.value("delivery_status"));
        assertNull(ledger.row.get("target_user_id"));
        assertNull(ledger.row.get("target_user_se"));
        assertNull(ledger.row.get("masked_destination"));
        assertNull(ledger.row.get("otp_hash"));
        assertNull(ledger.row.get("proof_hash"));
        assertTrue(ledger.auditEvents.contains("REQUEST_SUPPRESSED"));
        verify(authService, never()).resetPassword(
                anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    private void assertEligibilityScopedSubjectQuery() {
        assertNotNull(ledger.subjectQuerySql);
        assertTrue(ledger.subjectQuerySql.contains("from comtngnrlmber where mber_sttus='p'"));
        assertTrue(ledger.subjectQuerySql.contains(
                "from comtnentrprsmber where entrprs_mber_sttus='a'"));
        assertTrue(ledger.subjectQuerySql.contains("from comtnemplyrinfo where emplyr_sttus_code='p'"));
        assertFalse(ledger.subjectQuerySql.contains("order by case user_se"));
        assertFalse(ledger.subjectQuerySql.contains("limit 1"));
    }

    private static Map<String, Object> subject(String userSe) {
        return Map.of("user_id", USER_ID, "user_se", userSe, "email", EMAIL);
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static final class RecoveryLedger {
        private final Map<String, Object> row = new LinkedHashMap<>();
        private final List<String> auditEvents = new ArrayList<>();
        private List<Map<String, Object>> subjectRows = List.of(subject("GNR"));
        private String subjectQuerySql;

        private Object queryForList(InvocationOnMock invocation) {
            String sql = compact(invocation.getArgument(0));
            if (sql.contains("from ( select mber_id as user_id")) {
                subjectQuerySql = sql;
                return subjectRows;
            }
            if (sql.contains("select request_id,otp_hash,status,attempt_count,max_attempts,expires_at")) {
                return row.isEmpty() ? List.of() : List.of(snapshot(
                        "request_id", "otp_hash", "status", "attempt_count", "max_attempts", "expires_at"));
            }
            if (sql.contains("select target_user_id,target_user_se,proof_hash,proof_expires_at,status")) {
                return row.isEmpty() ? List.of() : List.of(snapshot(
                        "target_user_id", "target_user_se", "proof_hash", "proof_expires_at", "status"));
            }
            throw new AssertionError("Unexpected account-recovery query: " + sql);
        }

        private Object update(InvocationOnMock invocation) {
            String sql = compact(invocation.getArgument(0));
            Object[] invocationArgs = invocation.getArguments();
            Object[] args = Arrays.copyOfRange(invocationArgs, 1, invocationArgs.length);
            if (sql.startsWith("insert into account_recovery_request") && sql.contains("target_user_id")) {
                row.put("request_id", args[0]);
                row.put("target_user_id", args[1]);
                row.put("target_user_se", args[2]);
                row.put("masked_destination", args[3]);
                row.put("otp_hash", args[4]);
                row.put("status", "PENDING_DELIVERY");
                row.put("delivery_status", "PENDING");
                row.put("attempt_count", 0);
                row.put("max_attempts", args[7]);
                row.put("expires_at", args[8]);
                return 1;
            }
            if (sql.startsWith("insert into account_recovery_request")) {
                row.put("request_id", args[0]);
                row.put("status", "SUBJECT_NOT_FOUND");
                row.put("delivery_status", "SUPPRESSED");
                row.put("max_attempts", args[3]);
                return 1;
            }
            if (sql.startsWith("update account_recovery_request set status=?, delivery_status=?")) {
                row.put("status", args[0]);
                row.put("delivery_status", args[1]);
                return 1;
            }
            if (sql.startsWith("insert into account_recovery_audit")) {
                auditEvents.add(String.valueOf(args[1]));
                return 1;
            }
            if (sql.startsWith("update account_recovery_request set attempt_count=?,status=?")) {
                row.put("attempt_count", args[0]);
                row.put("status", args[1]);
                return 1;
            }
            if (sql.startsWith("update account_recovery_request set proof_hash=?")) {
                row.put("proof_hash", args[0]);
                row.put("proof_expires_at", args[1]);
                row.put("status", "VERIFIED");
                row.put("otp_hash", null);
                return 1;
            }
            if (sql.startsWith("update account_recovery_request set status='completed'")) {
                row.put("status", "COMPLETED");
                row.put("proof_hash", null);
                return 1;
            }
            if (sql.startsWith("update account_recovery_request set status=?,otp_hash=null,proof_hash=null")) {
                if (!List.of("COMPLETED", "LOCKED").contains(value("status"))) {
                    row.put("status", args[0]);
                    row.put("otp_hash", null);
                    row.put("proof_hash", null);
                }
                return 1;
            }
            throw new AssertionError("Unexpected account-recovery update: " + sql);
        }

        private Map<String, Object> snapshot(String... keys) {
            Map<String, Object> result = new LinkedHashMap<>();
            for (String key : keys) result.put(key, row.get(key));
            return result;
        }

        private String value(String key) {
            Object value = row.get(key);
            return value == null ? "" : String.valueOf(value);
        }

        private int number(String key) {
            Object value = row.get(key);
            return value instanceof Number number ? number.intValue() : 0;
        }

        private static String compact(String sql) {
            return sql.toLowerCase().replaceAll("\\s+", " ").trim();
        }
    }
}
