package egovframework.com.feature.member.service.support;

import egovframework.com.feature.member.model.vo.InsttFileVO;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Shared immutable naming, hashing and cleanup contract for institution evidence files.
 */
public final class InstitutionEvidenceFileSupport {

    public static final int MAX_INSTITUTION_ID_LENGTH = 20;
    public static final int MAX_FILE_ID_LENGTH = 60;

    private InstitutionEvidenceFileSupport() {
    }

    public static String requireInstitutionId(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty() || normalized.length() > MAX_INSTITUTION_ID_LENGTH) {
            throw new IllegalArgumentException("Institution ID must contain 1 to 20 characters.");
        }
        return normalized;
    }

    public static String newObjectToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String fileId(String objectToken) {
        String value = "IF_" + requireObjectToken(objectToken);
        if (value.length() > MAX_FILE_ID_LENGTH) {
            throw new IllegalStateException("Generated institution evidence file ID exceeds its DB contract.");
        }
        return value;
    }

    public static String storageFileName(String projectId, String objectToken, String extension) {
        String safeProjectId = projectId == null ? "" : projectId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (safeProjectId.isEmpty()) {
            throw new IllegalArgumentException("Project ID cannot be converted to a safe storage key.");
        }
        return safeProjectId + "_" + requireObjectToken(objectToken) + normalizeExtension(extension);
    }

    public static String normalizeExtension(String extension) {
        String normalized = extension == null ? "" : extension.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "";
        }
        if (!normalized.startsWith(".") || !normalized.matches("\\.[a-z0-9]{1,10}")) {
            throw new IllegalArgumentException("Invalid evidence file extension.");
        }
        return normalized;
    }

    public static String sha256(Path path) throws IOException {
        final MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable.", impossible);
        }
        try (InputStream input = Files.newInputStream(path)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) >= 0) {
                if (read > 0) {
                    digest.update(buffer, 0, read);
                }
            }
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte value : digest.digest()) {
            hex.append(String.format("%02x", value & 0xff));
        }
        return hex.toString();
    }

    public static void moveStagedFile(Path stagingPath, Path targetPath) throws IOException {
        try {
            Files.move(stagingPath, targetPath, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException unsupported) {
            Files.move(stagingPath, targetPath);
        }
    }

    public static void cleanup(List<InsttFileVO> files) {
        if (files == null) {
            return;
        }
        for (InsttFileVO file : files) {
            if (file == null || file.getFileStrePath() == null || file.getFileStrePath().isBlank()) {
                continue;
            }
            try {
                Files.deleteIfExists(Path.of(file.getFileStrePath()));
            } catch (IOException ignored) {
                // The calling transaction remains failed; orphan cleanup can be retried operationally.
            }
        }
    }

    private static String requireObjectToken(String objectToken) {
        String normalized = objectToken == null ? "" : objectToken.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[0-9a-f]{32}")) {
            throw new IllegalArgumentException("Invalid evidence object token.");
        }
        return normalized;
    }
}
