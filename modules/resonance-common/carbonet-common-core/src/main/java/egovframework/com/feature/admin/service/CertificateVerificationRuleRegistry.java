package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Locale;

final class CertificateVerificationRuleRegistry {
    static final String RULE_FILE_PROPERTY = "carbonet.certificate.verification.rule-file";
    static final String RULE_FILE_ENV = "CARBONET_CERTIFICATE_VERIFICATION_RULE_FILE";
    private static final long RELOAD_INTERVAL_NANOS = 1_000_000_000L;
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final NumberRule BUILT_IN = new NumberRule(
            "certificate-number-exact-v1", true, true, "TRUNCATE_TO_PDF_SCALE");
    private static volatile CachedRule cached = new CachedRule("", -1L, -1L, BUILT_IN);
    private static volatile long nextCheckNanos;

    private CertificateVerificationRuleRegistry() {}

    static NumberRule activeNumberRule() {
        String configured = configuredPath();
        if (configured.isBlank()) return BUILT_IN;
        long now = System.nanoTime();
        CachedRule current = cached;
        if (configured.equals(current.path()) && now < nextCheckNanos) return current.rule();
        synchronized (CertificateVerificationRuleRegistry.class) {
            current = cached;
            now = System.nanoTime();
            if (configured.equals(current.path()) && now < nextCheckNanos) return current.rule();
            Path path = trustedRegularFile(configured);
            BasicFileAttributes attributes;
            try {
                attributes = Files.readAttributes(path, BasicFileAttributes.class);
            } catch (IOException exception) {
                throw invalidRule("cannot read rule file", exception);
            }
            long modified = attributes.lastModifiedTime().toMillis();
            long size = attributes.size();
            if (configured.equals(current.path()) && modified == current.modifiedMillis()
                    && size == current.size()) {
                nextCheckNanos = now + RELOAD_INTERVAL_NANOS;
                return current.rule();
            }
            NumberRule loaded = load(path);
            cached = new CachedRule(configured, modified, size, loaded);
            nextCheckNanos = now + RELOAD_INTERVAL_NANOS;
            return loaded;
        }
    }

    static synchronized void resetForTest() {
        cached = new CachedRule("", -1L, -1L, BUILT_IN);
        nextCheckNanos = 0L;
    }

    private static String configuredPath() {
        String property = System.getProperty(RULE_FILE_PROPERTY, "").trim();
        return property.isBlank() ? System.getenv().getOrDefault(RULE_FILE_ENV, "").trim() : property;
    }

    private static Path trustedRegularFile(String configured) {
        Path path;
        try {
            path = Path.of(configured);
        } catch (RuntimeException exception) {
            throw invalidRule("invalid rule path", exception);
        }
        if (!path.isAbsolute() || Files.isSymbolicLink(path) || !Files.isRegularFile(path)) {
            throw invalidRule("rule file must be an absolute regular non-symlink file", null);
        }
        return path;
    }

    private static NumberRule load(Path path) {
        try {
            JsonNode root = JSON.readTree(Files.readAllBytes(path));
            if (root == null || !root.isObject() || root.path("schemaVersion").asInt() != 1
                    || !root.path("active").asBoolean(false)) {
                throw invalidRule("schemaVersion=1 and active=true are required", null);
            }
            JsonNode number = root.path("numberComparison");
            NumberRule rule = new NumberRule(requiredText(root, "ruleVersion"),
                    number.path("requirePdfScreenDigitsExact").asBoolean(false),
                    number.path("ignoreThousandsGrouping").asBoolean(false),
                    requiredText(number, "databaseComparison").toUpperCase(Locale.ROOT));
            if (!rule.requirePdfScreenDigitsExact() || !rule.ignoreThousandsGrouping()
                    || !"TRUNCATE_TO_PDF_SCALE".equals(rule.databaseComparison())) {
                throw invalidRule("unsupported or unsafe number comparison policy", null);
            }
            return rule;
        } catch (IOException exception) {
            throw invalidRule("invalid JSON rule file", exception);
        }
    }

    private static String requiredText(JsonNode node, String field) {
        String value = node.path(field).asText("").trim();
        if (value.isBlank()) throw invalidRule(field + " is required", null);
        return value;
    }

    private static IllegalStateException invalidRule(String message, Exception cause) {
        return new IllegalStateException("CERTIFICATE_VERIFICATION_RULE_INVALID: " + message, cause);
    }

    record NumberRule(String ruleVersion, boolean requirePdfScreenDigitsExact,
                      boolean ignoreThousandsGrouping, String databaseComparison) {}
    private record CachedRule(String path, long modifiedMillis, long size, NumberRule rule) {}
}
