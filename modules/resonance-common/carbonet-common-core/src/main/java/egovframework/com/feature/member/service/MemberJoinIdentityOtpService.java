package egovframework.com.feature.member.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Server-authoritative email identity verification for the public join relay. */
@Service
@RequiredArgsConstructor
public class MemberJoinIdentityOtpService {
    private static final int OTP_TTL_MINUTES = 10;
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Environment environment;

    @Value("${security.join.identity-otp.pepper:${token.refreshSecret}}")
    private String pepper;

    @Value("${security.join.identity-otp.development-code-enabled:false}")
    private boolean developmentCodeEnabled;

    @Value("${security.join.identity-otp.delivery.url:${carbonet.mfa.delivery.url:${account.recovery.delivery.url:}}}")
    private String deliveryUrl;

    @Value("${security.join.identity-otp.delivery.bearer-token:${carbonet.mfa.delivery.bearer-token:${account.recovery.delivery.bearer-token:}}}")
    private String deliveryBearerToken;

    public record IssueResult(String challengeId, String status, String maskedDestination,
            int expiresInSeconds, String developmentCode) { }
    public record VerifyResult(String status, String message, String identityCi, String identityDi) { }
    public static final class RateLimitException extends RuntimeException {
        public RateLimitException(String message) { super(message); }
    }

    @PostConstruct
    void validateDevelopmentConfiguration() {
        if (developmentCodeEnabled && environment.acceptsProfiles(Profiles.of("prod", "production"))) {
            throw new IllegalStateException("Join identity development codes are forbidden in production");
        }
    }

    @Transactional
    public IssueResult issue(String sessionId, String email, String clientIp, boolean english) {
        String normalizedEmail = normalizeEmail(email);
        if (sessionId == null || sessionId.isBlank() || !normalizedEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException(english ? "Enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
        }
        String sessionHash = sessionHash(sessionId);
        Integer recent = jdbcTemplate.queryForObject("""
                SELECT count(*) FROM member_join_identity_challenge
                 WHERE session_hash=? AND created_at > CURRENT_TIMESTAMP - INTERVAL '60 seconds'
                """, Integer.class, sessionHash);
        if (recent != null && recent >= 3) {
            throw new RateLimitException(english ? "Please wait before requesting another code."
                    : "인증번호를 너무 자주 요청했습니다. 잠시 후 다시 시도해 주세요.");
        }

        UUID challengeId = UUID.randomUUID();
        String otp = String.format("%06d", RANDOM.nextInt(1_000_000));
        String masked = maskEmail(normalizedEmail);
        jdbcTemplate.update("""
                UPDATE member_join_identity_challenge
                   SET status='REPLACED',otp_hash=NULL,updated_at=CURRENT_TIMESTAMP
                 WHERE session_hash=? AND status IN ('ISSUED','DELIVERY_FAILED')
                """, sessionHash);
        jdbcTemplate.update("""
                INSERT INTO member_join_identity_challenge
                  (challenge_id,session_hash,destination_hash,destination_masked,otp_hash,status,
                   attempt_count,max_attempts,expires_at,requested_ip)
                VALUES (?,?,?,?,?,'ISSUED',0,?,?,?)
                """, challengeId, sessionHash, digest(normalizedEmail), masked,
                challengeDigest(challengeId, sessionHash, otp), MAX_ATTEMPTS,
                LocalDateTime.now().plusMinutes(OTP_TTL_MINUTES), limited(clientIp, 64));

        boolean delivered = deliver(challengeId, normalizedEmail, otp, english);
        if (!delivered) {
            jdbcTemplate.update("""
                    UPDATE member_join_identity_challenge
                       SET status='DELIVERY_FAILED',updated_at=CURRENT_TIMESTAMP WHERE challenge_id=?
                    """, challengeId);
            return new IssueResult(challengeId.toString(), "DELIVERY_FAILED", masked,
                    OTP_TTL_MINUTES * 60, null);
        }
        return new IssueResult(challengeId.toString(), "CODE_SENT", masked, OTP_TTL_MINUTES * 60,
                developmentCodeEnabled ? otp : null);
    }

    @Transactional
    public VerifyResult verify(String sessionId, String challengeIdText, String otp, boolean english) {
        UUID challengeId = parseUuid(challengeIdText);
        String failure = english ? "The code is invalid or expired." : "인증번호가 올바르지 않거나 만료되었습니다.";
        if (challengeId == null || sessionId == null || otp == null || !otp.matches("\\d{6}")) {
            return new VerifyResult("FAIL", failure, null, null);
        }
        String sessionHash = sessionHash(sessionId);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT otp_hash,status,attempt_count,max_attempts,expires_at,destination_hash
                  FROM member_join_identity_challenge WHERE challenge_id=? AND session_hash=? FOR UPDATE
                """, challengeId, sessionHash);
        if (rows.isEmpty()) return new VerifyResult("FAIL", failure, null, null);
        Map<String, Object> row = rows.get(0);
        String status = text(row.get("status"));
        int attempts = number(row.get("attempt_count"));
        int maxAttempts = number(row.get("max_attempts"));
        LocalDateTime expiresAt = ((java.sql.Timestamp) row.get("expires_at")).toLocalDateTime();
        if (!"ISSUED".equals(status) || attempts >= maxAttempts || !expiresAt.isAfter(LocalDateTime.now())) {
            if ("ISSUED".equals(status)) jdbcTemplate.update("""
                    UPDATE member_join_identity_challenge SET status=?,otp_hash=NULL,updated_at=CURRENT_TIMESTAMP
                     WHERE challenge_id=?
                    """, attempts >= maxAttempts ? "LOCKED" : "EXPIRED", challengeId);
            return new VerifyResult("FAIL", failure, null, null);
        }
        boolean matches = MessageDigest.isEqual(
                text(row.get("otp_hash")).getBytes(StandardCharsets.US_ASCII),
                challengeDigest(challengeId, sessionHash, otp).getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            int next = attempts + 1;
            jdbcTemplate.update("""
                    UPDATE member_join_identity_challenge SET attempt_count=?,status=?,updated_at=CURRENT_TIMESTAMP
                     WHERE challenge_id=?
                    """, next, next >= maxAttempts ? "LOCKED" : "ISSUED", challengeId);
            return new VerifyResult("FAIL", failure, null, null);
        }
        String destinationHash = text(row.get("destination_hash"));
        String ci = digest("CI|" + challengeId + "|" + destinationHash);
        String di = digest("DI|" + sessionHash + "|" + destinationHash);
        jdbcTemplate.update("""
                UPDATE member_join_identity_challenge
                   SET status='VERIFIED',otp_hash=NULL,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
                 WHERE challenge_id=?
                """, challengeId);
        return new VerifyResult("VERIFIED", english ? "Verification completed." : "본인확인이 완료되었습니다.", ci, di);
    }

    private String sessionHash(String sessionId) { return digest("SESSION|" + sessionId); }
    private boolean deliver(UUID challengeId, String email, String otp, boolean english) {
        if (deliveryUrl == null || deliveryUrl.isBlank()) return developmentCodeEnabled;
        try {
            Map<String, Object> body = Map.of(
                    "event", "JOIN_IDENTITY_OTP", "challengeId", challengeId.toString(),
                    "channel", "EMAIL", "destination", email, "code", otp,
                    "purpose", "JOIN_IDENTITY", "expiresInSeconds", OTP_TTL_MINUTES * 60,
                    "language", english ? "en" : "ko");
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(deliveryUrl))
                    .timeout(Duration.ofSeconds(5)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (deliveryBearerToken != null && !deliveryBearerToken.isBlank()) {
                builder.header("Authorization", "Bearer " + deliveryBearerToken);
            }
            HttpResponse<Void> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
                    .send(builder.build(), HttpResponse.BodyHandlers.discarding());
            return response.statusCode() >= 200 && response.statusCode() < 300;
        } catch (Exception exception) {
            return false;
        }
    }
    private String challengeDigest(UUID id, String sessionHash, String otp) {
        return digest("OTP|" + id + "|" + sessionHash + "|" + otp);
    }
    private String digest(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((pepper + "|" + value).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException("Unable to hash identity verification data", e); }
    }
    private UUID parseUuid(String value) { try { return UUID.fromString(value); } catch (Exception e) { return null; } }
    private String normalizeEmail(String value) { return value == null ? "" : value.trim().toLowerCase(); }
    private String maskEmail(String value) {
        int at = value.indexOf('@');
        return at < 2 ? "***" : value.substring(0, 2) + "***" + value.substring(at);
    }
    private String limited(String value, int max) {
        String result = value == null ? "" : value.trim(); return result.length() <= max ? result : result.substring(0, max);
    }
    private String text(Object value) { return value == null ? "" : value.toString(); }
    private int number(Object value) { return value instanceof Number n ? n.intValue() : Integer.parseInt(text(value)); }
}
