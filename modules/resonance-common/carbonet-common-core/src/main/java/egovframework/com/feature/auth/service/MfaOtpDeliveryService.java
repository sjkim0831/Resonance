package egovframework.com.feature.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MfaOtpDeliveryService {
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    @Value("${carbonet.mfa.delivery.url:${account.recovery.delivery.url:}}")
    private String deliveryUrl;

    @Value("${carbonet.mfa.delivery.bearer-token:${account.recovery.delivery.bearer-token:}}")
    private String bearerToken;

    @Value("${carbonet.mfa.development-code-enabled:false}")
    private boolean developmentCodeEnabled;

    public boolean deliver(String challengeId, String userId, String destination, String code, String purpose,
            boolean english) {
        return deliver(challengeId, userId, destination, code, purpose, "EMAIL", english);
    }

    public boolean deliver(String challengeId, String userId, String destination, String code, String purpose,
            String channel, boolean english) {
        if (!StringUtils.hasText(destination)) return false;
        if (!StringUtils.hasText(deliveryUrl)) {
            if (!developmentCodeEnabled) return false;
            try {
                record(challengeId, userId, purpose, destination, "DEVELOPMENT_DELIVERED", null);
            } catch (RuntimeException exception) {
                log.info("Development MFA outbox is unavailable; continuing without persistence. challengeId={}", challengeId);
            }
            return true;
        }
        try {
            Map<String, Object> body = Map.of(
                    "event", "MFA_OTP", "challengeId", challengeId, "userId", userId,
                    "channel", channel, "destination", destination, "code", code,
                    "purpose", purpose, "expiresInSeconds", 600, "language", english ? "en" : "ko");
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(deliveryUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            if (StringUtils.hasText(bearerToken)) request.header("Authorization", "Bearer " + bearerToken);
            HttpResponse<Void> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
                    .send(request.build(),
                    HttpResponse.BodyHandlers.discarding());
            boolean delivered = response.statusCode() >= 200 && response.statusCode() < 300;
            record(challengeId, userId, purpose, destination,
                    delivered ? "PROVIDER_DELIVERED" : "FAILED", response.statusCode());
            return delivered;
        } catch (Exception exception) {
            log.warn("MFA delivery failed. challengeId={}", challengeId, exception);
            return false;
        }
    }

    private void record(String challengeId, String userId, String purpose, String destination,
            String status, Integer providerStatus) {
        jdbcTemplate.update("""
                INSERT INTO member_mfa_delivery_outbox
                  (delivery_id,challenge_id,user_id,purpose,destination_masked,delivery_status,provider_status)
                VALUES (?,?,?,?,?,?,?)
                """, java.util.UUID.randomUUID(), java.util.UUID.fromString(challengeId), userId, purpose,
                mask(destination), status, providerStatus);
    }

    private String mask(String value) {
        int at = value == null ? -1 : value.indexOf('@');
        if (at < 2) return "***";
        return value.substring(0, 2) + "***" + value.substring(at);
    }
}
