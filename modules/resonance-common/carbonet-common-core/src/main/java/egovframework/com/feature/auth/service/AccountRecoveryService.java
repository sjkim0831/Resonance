package egovframework.com.feature.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Server-authoritative account recovery workflow.
 * Raw OTP and proof values are never persisted or logged. Public request responses
 * are deliberately identical whether an account exists or not.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountRecoveryService {

    private static final int OTP_TTL_MINUTES = 10;
    private static final int PROOF_TTL_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AuthService authService;
    private final AuthTokenStoreService authTokenStoreService;

    @Value("${account.recovery.pepper:${token.refreshSecret}}")
    private String recoveryPepper;

    @Value("${account.recovery.delivery.url:}")
    private String deliveryUrl;

    @Value("${account.recovery.delivery.bearer-token:}")
    private String deliveryBearerToken;

    @Value("${account.recovery.development-code-enabled:false}")
    private boolean developmentCodeEnabled;

    public record RequestResult(String requestId, String status, String message, String developmentCode) { }
    public record VerifyResult(String status, String recoveryProof, String message) { }
    public record CompleteResult(String status, String message) { }

    @Transactional
    public RequestResult requestCode(String userId, String email, String clientIp, String userAgent, boolean english) {
        String normalizedUserId = normalize(userId);
        String normalizedEmail = normalize(email).toLowerCase();
        String ip = limited(normalize(clientIp), 64);
        UUID requestId = UUID.randomUUID();
        String genericMessage = english
                ? "If the account information matches, a verification code will be sent."
                : "입력한 계정 정보가 일치하면 인증번호가 발송됩니다.";

        if (normalizedUserId.isEmpty() || normalizedEmail.isEmpty() || isRateLimited(normalizedUserId, ip)) {
            auditSuppressed(requestId, ip, "INVALID_OR_RATE_LIMITED");
            return new RequestResult(requestId.toString(), "accepted", genericMessage, null);
        }

        AccountSubject subject = findSubject(normalizedUserId, normalizedEmail);
        if (subject == null) {
            jdbcTemplate.update("""
                    INSERT INTO account_recovery_request
                      (request_id,status,delivery_status,requested_ip,user_agent,max_attempts)
                    VALUES (?,'SUBJECT_NOT_FOUND','SUPPRESSED',?,?,?)
                    """, requestId, ip, limited(userAgent, 500), MAX_ATTEMPTS);
            audit(requestId, "REQUEST_SUPPRESSED", "ANONYMOUS", ip, "SUBJECT_NOT_FOUND");
            return new RequestResult(requestId.toString(), "accepted", genericMessage, null);
        }

        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        String otpHash = digest(requestId, otp);
        String masked = maskEmail(subject.email());
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES);
        jdbcTemplate.update("""
                INSERT INTO account_recovery_request
                  (request_id,target_user_id,target_user_se,masked_destination,otp_hash,status,
                   delivery_status,requested_ip,user_agent,max_attempts,expires_at)
                VALUES (?,?,?,?,?,'PENDING_DELIVERY','PENDING',?,?,?,?)
                """, requestId, subject.userId(), subject.userSe(), masked, otpHash, ip,
                limited(userAgent, 500), MAX_ATTEMPTS, expiresAt);

        boolean delivered = deliverCode(requestId, subject.email(), otp, english);
        jdbcTemplate.update("""
                UPDATE account_recovery_request
                   SET status=?, delivery_status=?, updated_at=CURRENT_TIMESTAMP
                 WHERE request_id=?
                """, delivered ? "CODE_SENT" : "DELIVERY_FAILED", delivered ? "SENT" : "FAILED", requestId);
        audit(requestId, delivered ? "CODE_DISPATCHED" : "CODE_DELIVERY_FAILED", "SYSTEM", ip,
                delivered ? "EMAIL" : "PROVIDER_UNAVAILABLE");

        String developmentCode = developmentCodeEnabled ? otp : null;
        return new RequestResult(requestId.toString(), "accepted", genericMessage, developmentCode);
    }

    @Transactional
    public VerifyResult verifyCode(String requestIdText, String otp, String clientIp, boolean english) {
        UUID requestId = parseUuid(requestIdText);
        String failure = english ? "The verification information is invalid or expired."
                : "인증 정보가 올바르지 않거나 만료되었습니다.";
        if (requestId == null || !otp.matches("\\d{6}")) {
            return new VerifyResult("fail", null, failure);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT request_id,otp_hash,status,attempt_count,max_attempts,expires_at
                  FROM account_recovery_request WHERE request_id=? FOR UPDATE
                """, requestId);
        if (rows.isEmpty()) {
            return new VerifyResult("fail", null, failure);
        }
        Map<String, Object> row = rows.get(0);
        String status = value(row, "status");
        int attempts = number(row, "attempt_count");
        int maxAttempts = number(row, "max_attempts");
        LocalDateTime expiresAt = timestamp(row, "expires_at");
        if (!"CODE_SENT".equals(status) || attempts >= maxAttempts || expiresAt == null
                || !expiresAt.isAfter(LocalDateTime.now())) {
            expireOrLock(requestId, attempts >= maxAttempts ? "LOCKED" : "EXPIRED");
            return new VerifyResult("fail", null, failure);
        }

        boolean matches = MessageDigest.isEqual(
                value(row, "otp_hash").getBytes(StandardCharsets.US_ASCII),
                digest(requestId, otp).getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            int nextAttempts = attempts + 1;
            jdbcTemplate.update("""
                    UPDATE account_recovery_request SET attempt_count=?,status=?,updated_at=CURRENT_TIMESTAMP
                     WHERE request_id=?
                    """, nextAttempts, nextAttempts >= maxAttempts ? "LOCKED" : "CODE_SENT", requestId);
            audit(requestId, "CODE_REJECTED", "ANONYMOUS", limited(clientIp, 64),
                    nextAttempts >= maxAttempts ? "ATTEMPT_LIMIT" : "MISMATCH");
            return new VerifyResult("fail", null, failure);
        }

        String proof = randomToken();
        jdbcTemplate.update("""
                UPDATE account_recovery_request
                   SET proof_hash=?,proof_expires_at=?,verified_at=CURRENT_TIMESTAMP,status='VERIFIED',
                       otp_hash=NULL,updated_at=CURRENT_TIMESTAMP
                 WHERE request_id=?
                """, digest(requestId, proof), LocalDateTime.now().plusMinutes(PROOF_TTL_MINUTES), requestId);
        audit(requestId, "CODE_VERIFIED", "ANONYMOUS", limited(clientIp, 64), "SINGLE_USE_PROOF_ISSUED");
        return new VerifyResult("success", proof,
                english ? "Verification completed." : "본인 확인이 완료되었습니다.");
    }

    @Transactional
    public CompleteResult complete(String requestIdText, String proof, String newPassword, String clientIp,
            boolean english) {
        UUID requestId = parseUuid(requestIdText);
        String failure = english ? "The recovery request is invalid or expired."
                : "복구 요청이 올바르지 않거나 만료되었습니다.";
        if (requestId == null || !StringUtils.hasText(proof) || !validPassword(newPassword)) {
            return new CompleteResult("fail", failure);
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT target_user_id,target_user_se,proof_hash,proof_expires_at,status
                  FROM account_recovery_request WHERE request_id=? FOR UPDATE
                """, requestId);
        if (rows.isEmpty()) {
            return new CompleteResult("fail", failure);
        }
        Map<String, Object> row = rows.get(0);
        LocalDateTime proofExpiresAt = timestamp(row, "proof_expires_at");
        boolean proofMatches = "VERIFIED".equals(value(row, "status"))
                && proofExpiresAt != null && proofExpiresAt.isAfter(LocalDateTime.now())
                && MessageDigest.isEqual(value(row, "proof_hash").getBytes(StandardCharsets.US_ASCII),
                        digest(requestId, proof).getBytes(StandardCharsets.US_ASCII));
        if (!proofMatches) {
            audit(requestId, "PROOF_REJECTED", "ANONYMOUS", limited(clientIp, 64), "INVALID_OR_EXPIRED");
            return new CompleteResult("fail", failure);
        }

        String userId = value(row, "target_user_id");
        boolean updated = authService.resetPassword(userId, newPassword, userId, limited(clientIp, 64),
                "ACCOUNT_RECOVERY");
        if (!updated) {
            throw new IllegalStateException("Account recovery target disappeared before completion");
        }
        authTokenStoreService.revokeAll(userId);
        jdbcTemplate.update("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME=?", userId);
        jdbcTemplate.update("""
                UPDATE account_recovery_request
                   SET status='COMPLETED',proof_hash=NULL,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
                 WHERE request_id=?
                """, requestId);
        audit(requestId, "RECOVERY_COMPLETED", userId, limited(clientIp, 64), "SESSIONS_REVOKED");
        return new CompleteResult("success",
                english ? "Your password has been changed." : "비밀번호가 변경되었습니다.");
    }

    private AccountSubject findSubject(String userId, String email) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT user_id,user_se,email FROM (
                  SELECT MBER_ID AS user_id,'GNR' AS user_se,MBER_EMAIL_ADRES AS email FROM COMTNGNRLMBER
                  UNION ALL
                  SELECT ENTRPRS_MBER_ID,'ENT',APPLCNT_EMAIL_ADRES FROM COMTNENTRPRSMBER
                  UNION ALL
                  SELECT EMPLYR_ID,'USR',EMAIL_ADRES FROM COMTNEMPLYRINFO
                ) account
                WHERE lower(user_id)=lower(?) AND lower(coalesce(email,''))=lower(?)
                ORDER BY CASE user_se WHEN 'ENT' THEN 1 WHEN 'USR' THEN 2 ELSE 3 END
                LIMIT 1
                """, userId, email);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);
        return new AccountSubject(value(row, "user_id"), value(row, "user_se"), value(row, "email"));
    }

    private boolean isRateLimited(String userId, String ip) {
        Integer ipCount = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM account_recovery_request
                 WHERE requested_ip=? AND created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
                """, Integer.class, ip);
        Integer userCount = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM account_recovery_request
                 WHERE lower(coalesce(target_user_id,''))=lower(?)
                   AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
                """, Integer.class, userId);
        return (ipCount != null && ipCount >= 10) || (userCount != null && userCount >= 5);
    }

    private boolean deliverCode(UUID requestId, String destination, String otp, boolean english) {
        if (!StringUtils.hasText(deliveryUrl)) {
            return developmentCodeEnabled;
        }
        try {
            Map<String, Object> body = Map.of(
                    "event", "ACCOUNT_RECOVERY_OTP",
                    "requestId", requestId.toString(),
                    "channel", "EMAIL",
                    "destination", destination,
                    "code", otp,
                    "expiresInSeconds", OTP_TTL_MINUTES * 60,
                    "language", english ? "en" : "ko");
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(deliveryUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (StringUtils.hasText(deliveryBearerToken)) {
                builder.header("Authorization", "Bearer " + deliveryBearerToken);
            }
            HttpResponse<Void> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
                    .send(builder.build(), HttpResponse.BodyHandlers.discarding());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception e) {
            log.warn("Account recovery delivery provider failed. requestId={}", requestId, e);
            return false;
        }
    }

    private void auditSuppressed(UUID requestId, String ip, String reason) {
        jdbcTemplate.update("""
                INSERT INTO account_recovery_request
                  (request_id,status,delivery_status,requested_ip,max_attempts)
                VALUES (?,'SUBJECT_NOT_FOUND','SUPPRESSED',?,?)
                """, requestId, ip, MAX_ATTEMPTS);
        audit(requestId, "REQUEST_SUPPRESSED", "ANONYMOUS", ip, reason);
    }

    private void audit(UUID requestId, String event, String actor, String ip, String detail) {
        jdbcTemplate.update("""
                INSERT INTO account_recovery_audit(request_id,event_code,actor_id,actor_ip,detail_code)
                VALUES (?,?,?,?,?)
                """, requestId, event, normalize(actor), limited(ip, 64), limited(detail, 100));
    }

    private void expireOrLock(UUID requestId, String status) {
        jdbcTemplate.update("""
                UPDATE account_recovery_request SET status=?,otp_hash=NULL,proof_hash=NULL,updated_at=CURRENT_TIMESTAMP
                 WHERE request_id=? AND status NOT IN ('COMPLETED','LOCKED')
                """, status, requestId);
    }

    private String digest(UUID requestId, String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String source = recoveryPepper + '|' + requestId + '|' + normalize(value);
            return HexFormat.of().formatHex(digest.digest(source.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static boolean validPassword(String value) {
        if (value == null || value.length() < 9 || value.length() > 128) return false;
        int categories = 0;
        if (value.matches(".*[a-z].*")) categories++;
        if (value.matches(".*[A-Z].*")) categories++;
        if (value.matches(".*[0-9].*")) categories++;
        if (value.matches(".*[^A-Za-z0-9].*")) categories++;
        return categories >= 3;
    }

    private static String maskEmail(String email) {
        int at = email == null ? -1 : email.indexOf('@');
        if (at < 1) return "***";
        String local = email.substring(0, at);
        return local.substring(0, 1) + "***@" + email.substring(at + 1);
    }

    private static UUID parseUuid(String value) {
        try { return UUID.fromString(normalize(value)); } catch (Exception ignored) { return null; }
    }

    private static String normalize(String value) { return value == null ? "" : value.trim(); }
    private static String limited(String value, int max) {
        String normalized = normalize(value);
        return normalized.length() <= max ? normalized : normalized.substring(0, max);
    }
    private static String value(Map<String, Object> row, String key) {
        Object result = row.get(key);
        if (result == null) result = row.get(key.toUpperCase());
        return result == null ? "" : String.valueOf(result).trim();
    }
    private static int number(Map<String, Object> row, String key) {
        Object result = row.get(key);
        if (result == null) result = row.get(key.toUpperCase());
        return result instanceof Number number ? number.intValue() : 0;
    }
    private static LocalDateTime timestamp(Map<String, Object> row, String key) {
        Object result = row.get(key);
        if (result == null) result = row.get(key.toUpperCase());
        if (result instanceof LocalDateTime value) return value;
        if (result instanceof java.sql.Timestamp value) return value.toLocalDateTime();
        return null;
    }

    private record AccountSubject(String userId, String userSe, String email) { }
}
