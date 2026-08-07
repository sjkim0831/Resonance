package egovframework.com.feature.member.service.support;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Bounded, fail-closed reconciliation for institution evidence files that were
 * staged or moved before their database transaction committed.
 *
 * <p>Only the immutable UUID object naming contract is eligible. Historical
 * files are deliberately outside both patterns and can never be removed by
 * this component.</p>
 */
public final class InstitutionEvidenceReconciler {

    public static final String RECOVERY_ACTOR_CODE = "SYSTEM_RECOVERY";
    public static final String RECOVERY_PROCESS_CODE = "COMPANY_REAPPLICATION_PUBLIC";
    public static final String RECOVERY_STEP_CODE = "COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION";
    public static final String RECOVERY_TEST_CODE = "TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW";
    public static final String RECOVERY_TASK_CODE = "TASK_COMPANY_REAPPLICATION_EVIDENCE_RECONCILE";

    private static final String PROJECT_KEY = "[A-Za-z0-9_-]{1,100}";
    private static final String OBJECT_TOKEN = "(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})";
    private static final Pattern FINAL_OBJECT = Pattern.compile(
            "^" + PROJECT_KEY + "_" + OBJECT_TOKEN + "\\.(?:pdf|png|jpe?g)$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern STAGED_OBJECT = Pattern.compile(
            "^" + PROJECT_KEY + "_" + OBJECT_TOKEN + "(?:_[A-Za-z0-9.-]{1,80})?\\.part$",
            Pattern.CASE_INSENSITIVE
    );

    @FunctionalInterface
    public interface ReferenceLookup {
        Set<String> findReferencedObjectKeys(List<String> objectKeys);
    }

    public ReconciliationResult reconcile(
            Path storageRoot,
            Duration minimumAge,
            int scanLimit,
            Instant now,
            ReferenceLookup referenceLookup
    ) throws IOException {
        Objects.requireNonNull(storageRoot, "storageRoot");
        Objects.requireNonNull(minimumAge, "minimumAge");
        Objects.requireNonNull(now, "now");
        Objects.requireNonNull(referenceLookup, "referenceLookup");
        if (minimumAge.isNegative()) {
            throw new IllegalArgumentException("minimumAge cannot be negative");
        }
        if (scanLimit < 1) {
            throw new IllegalArgumentException("scanLimit must be positive");
        }

        Path root = storageRoot.toAbsolutePath().normalize();
        if (!Files.isDirectory(root, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(root)) {
            return ReconciliationResult.empty(now);
        }

        Instant cutoff = now.minus(minimumAge);
        ScanResult scan = scan(root, cutoff, scanLimit);
        if (scan.candidates().isEmpty()) {
            return new ReconciliationResult(
                    scan.examined(), 0, 0, 0, 0, 0, scan.truncated(), now
            );
        }

        List<String> objectKeys = scan.candidates().stream().map(Candidate::objectKey).toList();
        // Deliberately fail closed: an exception or null from the DB lookup
        // occurs before the first delete.
        Set<String> referenced = Objects.requireNonNull(
                referenceLookup.findReferencedObjectKeys(List.copyOf(objectKeys)),
                "referenceLookup result"
        );
        Set<String> referencedKeys = new HashSet<>(referenced);

        int referencedCount = 0;
        int deletedStaged = 0;
        int deletedFinal = 0;
        int failedDeletes = 0;
        for (Candidate candidate : scan.candidates()) {
            if (referencedKeys.contains(candidate.objectKey())) {
                referencedCount++;
                continue;
            }
            try {
                if (!isStillEligible(root, candidate, cutoff)) {
                    continue;
                }
                if (Files.deleteIfExists(candidate.path())) {
                    if (candidate.type() == CandidateType.STAGED_PART) {
                        deletedStaged++;
                    } else {
                        deletedFinal++;
                    }
                }
            } catch (IOException | SecurityException deleteFailure) {
                failedDeletes++;
            }
        }

        return new ReconciliationResult(
                scan.examined(), scan.candidates().size(), referencedCount,
                deletedStaged, deletedFinal, failedDeletes, scan.truncated(), now
        );
    }

    private ScanResult scan(Path root, Instant cutoff, int scanLimit) throws IOException {
        List<Candidate> candidates = new ArrayList<>();
        int examined = 0;
        boolean truncated = false;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(root)) {
            for (Path entry : stream) {
                if (examined >= scanLimit) {
                    truncated = true;
                    break;
                }
                examined++;
                Candidate candidate = candidate(root, entry, cutoff);
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
        }
        return new ScanResult(examined, candidates, truncated);
    }

    private Candidate candidate(Path root, Path entry, Instant cutoff) {
        try {
            Path normalized = entry.toAbsolutePath().normalize();
            if (!normalized.startsWith(root) || Files.isSymbolicLink(normalized)) {
                return null;
            }
            BasicFileAttributes attributes = Files.readAttributes(
                    normalized, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS
            );
            if (!attributes.isRegularFile() || attributes.lastModifiedTime().toInstant().isAfter(cutoff)) {
                return null;
            }
            String fileName = normalized.getFileName().toString();
            if (STAGED_OBJECT.matcher(fileName).matches()) {
                return new Candidate(normalized, fileName, CandidateType.STAGED_PART);
            }
            if (FINAL_OBJECT.matcher(fileName).matches()) {
                return new Candidate(normalized, fileName, CandidateType.UNREFERENCED_FINAL);
            }
            return null;
        } catch (IOException | SecurityException ignored) {
            return null;
        }
    }

    private boolean isStillEligible(Path root, Candidate candidate, Instant cutoff) throws IOException {
        Path path = candidate.path().toAbsolutePath().normalize();
        if (!path.startsWith(root) || Files.isSymbolicLink(path)) {
            return false;
        }
        BasicFileAttributes attributes = Files.readAttributes(
                path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS
        );
        if (!attributes.isRegularFile() || attributes.lastModifiedTime().toInstant().isAfter(cutoff)) {
            return false;
        }
        String fileName = path.getFileName().toString();
        return candidate.type() == CandidateType.STAGED_PART
                ? STAGED_OBJECT.matcher(fileName).matches()
                : FINAL_OBJECT.matcher(fileName).matches();
    }

    private enum CandidateType {
        STAGED_PART,
        UNREFERENCED_FINAL
    }

    private record Candidate(Path path, String objectKey, CandidateType type) {
    }

    private record ScanResult(int examined, List<Candidate> candidates, boolean truncated) {
    }

    public record ReconciliationResult(
            int examined,
            int candidates,
            int referenced,
            int deletedStaged,
            int deletedFinal,
            int failedDeletes,
            boolean truncated,
            Instant completedAt
    ) {
        public static ReconciliationResult empty(Instant completedAt) {
            return new ReconciliationResult(0, 0, 0, 0, 0, 0, false, completedAt);
        }

        public int deletedTotal() {
            return deletedStaged + deletedFinal;
        }
    }
}
