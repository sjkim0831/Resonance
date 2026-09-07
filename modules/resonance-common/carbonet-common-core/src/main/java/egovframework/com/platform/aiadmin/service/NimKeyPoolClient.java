package egovframework.com.platform.aiadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Server-side NVIDIA NIM client backed by a round-robin pool of API keys.
 * Keys are never hardcoded: they are loaded from a secret file at startup,
 * matching the convention used by ops/scripts/import-hermes-nvidia-key-pool.py
 * (NVIDIA_API_KEYS_FILE-equivalent path, one key per line, mode 0600).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NimKeyPoolClient {

    private final ObjectMapper objectMapper;

    @Value("${resonance.nim.base-url:https://integrate.api.nvidia.com/v1}")
    private String baseUrl;

    @Value("${resonance.nim.keys-file:/etc/resonance/secrets/nvidia-api-keys}")
    private String keysFilePath;

    @Value("${resonance.nim.default-model:mistralai/mixtral-8x7b-instruct-v0.1}")
    private String defaultModel;

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final AtomicInteger keyIndex = new AtomicInteger(0);
    private volatile List<String> keys = List.of();

    @PostConstruct
    void loadKeys() {
        try {
            List<String> lines = Files.readAllLines(Path.of(keysFilePath)).stream()
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
            if (lines.isEmpty()) {
                log.error("NVIDIA NIM keys file is empty: {}", keysFilePath);
                return;
            }
            this.keys = lines;
            log.info("Loaded {} NVIDIA NIM API keys from {}", lines.size(), keysFilePath);
        } catch (IOException e) {
            log.error("Cannot read NVIDIA NIM keys file: {} ({})", keysFilePath, e.getMessage());
        }
    }

    private String nextKey() {
        List<String> current = keys;
        if (current.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "NVIDIA NIM key pool is not configured");
        }
        int idx = Math.floorMod(keyIndex.getAndIncrement(), current.size());
        return current.get(idx);
    }

    public int poolSize() {
        return keys.size();
    }

    /**
     * Non-streaming chat completion. Forwards requestBody (model/messages/max_tokens/
     * temperature/etc.) to NVIDIA NIM and returns the raw response JSON. Retries on
     * HTTP 429 by rotating to the next key with exponential backoff.
     */
    public JsonNode chatCompletion(Map<String, Object> requestBody) {
        Map<String, Object> body = new LinkedHashMap<>(requestBody);
        body.putIfAbsent("model", defaultModel);
        body.put("stream", false);

        Exception lastError = null;
        int maxAttempts = Math.max(3, Math.min(keys.size(), 6));
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            String apiKey = nextKey();
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/$", "") + "/chat/completions"))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 429) {
                    log.warn("NIM rate limited on attempt {}/{}, rotating key", attempt + 1, maxAttempts);
                    sleep(500L * (1L << attempt));
                    continue;
                }
                if (response.statusCode() / 100 != 2) {
                    throw new IllegalStateException("NIM HTTP " + response.statusCode() + ": " + response.body());
                }
                return objectMapper.readTree(response.body());
            } catch (Exception e) {
                lastError = e;
                log.warn("NIM call failed on attempt {}/{}: {}", attempt + 1, maxAttempts, e.getMessage());
            }
        }
        log.error("NIM invocation failed after {} attempts", maxAttempts, lastError);
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "NVIDIA NIM invocation failed");
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
