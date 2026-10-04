package egovframework.com.feature.auth.external.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.auth.external.config.PortOneV2Properties;
import egovframework.com.feature.auth.external.service.PortOneV2Gateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class HttpPortOneV2Gateway implements PortOneV2Gateway {
    private final PortOneV2Properties properties;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    @Override
    public String verifiedCi(String identityVerificationId) {
        if (!properties.isReady() || identityVerificationId == null
                || !identityVerificationId.matches("[A-Za-z0-9_-]{1,100}")) {
            throw new IllegalArgumentException("PORTONE_CONFIGURATION_OR_ID_INVALID");
        }
        try {
            String storeId = URLEncoder.encode(properties.getStoreId(), StandardCharsets.UTF_8);
            URI uri = URI.create("https://api.portone.io/identity-verifications/"
                    + identityVerificationId + "?storeId=" + storeId);
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15))
                    .header("Authorization", "PortOne " + properties.getApiSecret())
                    .header("Accept", "application/json").GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("PORTONE_VERIFICATION_UNAVAILABLE");
            return validatedCi(mapper.readTree(response.body()), identityVerificationId,
                    properties.getStoreId(), properties.getChannelKey());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("PORTONE_VERIFICATION_UNAVAILABLE", exception);
        } catch (Exception exception) {
            // Provider bodies and the API secret must never appear in application logs or API errors.
            throw new IllegalStateException("PORTONE_VERIFICATION_UNAVAILABLE");
        }
    }

    static String validatedCi(JsonNode record, String expectedId, String storeId, String channelKey) {
        if (record == null || !expectedId.equals(record.path("id").asText())
                || !"VERIFIED".equals(record.path("status").asText())
                || !channelKey.equals(record.path("channel").path("key").asText())
                || (record.hasNonNull("storeId") && !storeId.equals(record.path("storeId").asText()))) {
            throw new IllegalStateException("PORTONE_VERIFICATION_INVALID");
        }
        String ci = record.path("verifiedCustomer").path("ci").asText("").trim();
        if (ci.isEmpty()) throw new IllegalStateException("PORTONE_CI_REQUIRED");
        return ci;
    }
}
