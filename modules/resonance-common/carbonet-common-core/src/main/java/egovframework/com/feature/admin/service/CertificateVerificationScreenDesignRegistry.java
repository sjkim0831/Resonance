package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class CertificateVerificationScreenDesignRegistry {
    public static final String SCREEN_FILE_PROPERTY = "carbonet.certificate.verification.screen-file";
    public static final String SCREEN_FILE_ENV = "CARBONET_CERTIFICATE_VERIFICATION_SCREEN_FILE";
    private static final String DEFAULT_SCREEN_FILE = "/app/config/certificate-verification-screen.json";
    private static final long RELOAD_INTERVAL_NANOS = 1_000_000_000L;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> REQUIRED_SECTIONS = Set.of(
            "UPLOAD", "VERDICT", "IDENTITY", "VISUAL", "SUMMARY", "PAGE_SEQUENCE", "DETAILS", "LOG");
    private static final Set<String> REQUIRED_SUPPORT = Set.of(
            "HELP", "SCREEN_DESIGN", "QA", "WORK_GUIDE", "ALL_WORK");
    private static final Set<String> REQUIRED_QA = Set.of(
            "HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY");
    private static volatile CachedDesign cached = new CachedDesign("", -1L, -1L, null);
    private static volatile long nextCheckNanos;

    private CertificateVerificationScreenDesignRegistry() {}

    public static Map<String, Object> activeDesign() {
        String configured = configuredPath();
        if (configured.isBlank()) {
            throw invalidDesign("screen design file is not configured", null);
        }
        long now = System.nanoTime();
        CachedDesign current = cached;
        if (configured.equals(current.path()) && current.design() != null && now < nextCheckNanos) {
            return current.design();
        }
        synchronized (CertificateVerificationScreenDesignRegistry.class) {
            current = cached;
            now = System.nanoTime();
            if (configured.equals(current.path()) && current.design() != null && now < nextCheckNanos) {
                return current.design();
            }
            Path path = trustedRegularFile(configured);
            try {
                BasicFileAttributes attributes = Files.readAttributes(path, BasicFileAttributes.class);
                if (configured.equals(current.path()) && current.design() != null
                        && attributes.lastModifiedTime().toMillis() == current.modifiedMillis()
                        && attributes.size() == current.size()) {
                    nextCheckNanos = now + RELOAD_INTERVAL_NANOS;
                    return current.design();
                }
                Map<String, Object> loaded = load(path);
                cached = new CachedDesign(configured, attributes.lastModifiedTime().toMillis(), attributes.size(), loaded);
                nextCheckNanos = now + RELOAD_INTERVAL_NANOS;
                return loaded;
            } catch (IOException exception) {
                throw invalidDesign("cannot read screen design file", exception);
            }
        }
    }

    static synchronized void resetForTest() {
        cached = new CachedDesign("", -1L, -1L, null);
        nextCheckNanos = 0L;
    }

    private static String configuredPath() {
        String property = System.getProperty(SCREEN_FILE_PROPERTY, "").trim();
        if (!property.isBlank()) return property;
        String environment = System.getenv().getOrDefault(SCREEN_FILE_ENV, "").trim();
        return environment.isBlank() ? DEFAULT_SCREEN_FILE : environment;
    }

    private static Path trustedRegularFile(String configured) {
        Path path;
        try {
            path = Path.of(configured);
        } catch (RuntimeException exception) {
            throw invalidDesign("invalid screen design path", exception);
        }
        if (!path.isAbsolute() || Files.isSymbolicLink(path) || !Files.isRegularFile(path)) {
            throw invalidDesign("screen design must be an absolute regular non-symlink file", null);
        }
        return path;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> load(Path path) throws IOException {
        JsonNode root = JSON.readTree(Files.readAllBytes(path));
        if (root == null || !root.isObject() || root.path("schemaVersion").asInt() != 1
                || !root.path("active").asBoolean(false) || root.path("designVersion").asText("").isBlank()) {
            throw invalidDesign("schemaVersion=1, active=true and designVersion are required", null);
        }
        requireExactCodes(root.path("sections"), REQUIRED_SECTIONS, "sections");
        requireExactCodes(root.path("supportCards"), REQUIRED_SUPPORT, "supportCards");
        requireExactCodes(root.path("qaScenarios"), REQUIRED_QA, "qaScenarios");
        JsonNode hero = root.path("hero");
        if (hero.path("koTitle").asText("").isBlank() || hero.path("enTitle").asText("").isBlank()) {
            throw invalidDesign("localized hero titles are required", null);
        }
        return JSON.convertValue(root, Map.class);
    }

    private static void requireExactCodes(JsonNode array, Set<String> expected, String field) {
        if (!array.isArray()) throw invalidDesign(field + " must be an array", null);
        Set<String> actual = new LinkedHashSet<>();
        for (JsonNode item : array) {
            String code = item.path("code").asText("").trim();
            if (code.isBlank() || !actual.add(code)) throw invalidDesign(field + " codes must be non-empty and unique", null);
        }
        if (actual.size() != expected.size() || !actual.equals(expected)) {
            throw invalidDesign(field + " must contain the canonical code set", null);
        }
    }

    private static IllegalStateException invalidDesign(String message, Exception cause) {
        return new IllegalStateException("CERTIFICATE_VERIFICATION_SCREEN_INVALID: " + message, cause);
    }

    private record CachedDesign(String path, long modifiedMillis, long size, Map<String, Object> design) {}
}
