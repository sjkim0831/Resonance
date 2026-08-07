package egovframework.com.feature.member.service.support;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InstitutionEvidenceReconcilerTest {

    private static final Instant NOW = Instant.parse("2026-08-07T05:00:00Z");
    private static final String UUID_A = "019cfa12-3456-4abc-8def-0123456789ab";
    private static final String UUID_B = "019cfa12-3456-4abc-8def-0123456789ac";
    private static final String TOKEN_C = "019cfa1234564abc8def0123456789ad";

    @TempDir
    Path root;

    @Test
    void deletesOnlyOldNewContractFilesThatAreNotReferenced() throws Exception {
        Path oldPart = old("P003_" + UUID_A + "_482019.part");
        Path orphanFinal = old("P003_" + UUID_B + ".pdf");
        Path referencedFinal = old("P003_" + TOKEN_C + ".png");
        Path legacy = old("INSTT_123_1700000000_1.pdf");
        Path recent = recent("P003_019cfa1234564abc8def0123456789ae.jpg");
        Path unrelatedPart = old("ordinary-upload.part");

        InstitutionEvidenceReconciler.ReconciliationResult result = new InstitutionEvidenceReconciler().reconcile(
                root, Duration.ofMinutes(60), 100, NOW,
                keys -> Set.of(referencedFinal.getFileName().toString())
        );

        assertFalse(Files.exists(oldPart));
        assertFalse(Files.exists(orphanFinal));
        assertTrue(Files.exists(referencedFinal));
        assertTrue(Files.exists(legacy));
        assertTrue(Files.exists(recent));
        assertTrue(Files.exists(unrelatedPart));
        assertEquals(2, result.deletedTotal());
        assertEquals(1, result.deletedStaged());
        assertEquals(1, result.deletedFinal());
        assertEquals(1, result.referenced());
        assertEquals(0, result.failedDeletes());
    }

    @Test
    void databaseFailureIsFailClosedAndDeletesNothing() throws Exception {
        Path oldPart = old("P003_" + UUID_A + "_991.part");
        Path orphanFinal = old("P003_" + UUID_B + ".pdf");

        assertThrows(IllegalStateException.class, () -> new InstitutionEvidenceReconciler().reconcile(
                root, Duration.ofMinutes(60), 100, NOW,
                keys -> { throw new IllegalStateException("database unavailable"); }
        ));

        assertTrue(Files.exists(oldPart));
        assertTrue(Files.exists(orphanFinal));
    }

    @Test
    void deletesActualCreateTempFileNameProducedByEvidenceWriters() throws Exception {
        String objectToken = InstitutionEvidenceFileSupport.newObjectToken();
        Path staged = Files.createTempFile(root, "P003_" + objectToken + "_", ".part");
        Files.writeString(staged, "evidence");
        Files.setLastModifiedTime(staged, FileTime.from(NOW.minus(Duration.ofHours(2))));

        InstitutionEvidenceReconciler.ReconciliationResult result = new InstitutionEvidenceReconciler().reconcile(
                root, Duration.ofMinutes(60), 100, NOW, keys -> Set.of()
        );

        assertFalse(Files.exists(staged));
        assertEquals(1, result.deletedStaged());
        assertEquals(0, result.failedDeletes());
    }

    @Test
    void scanAndDatabaseQueryAreBounded() throws Exception {
        for (int i = 0; i < 8; i++) {
            old(String.format("P003_019cfa1234564abc8def012345678%03x.pdf", i));
        }
        AtomicInteger queried = new AtomicInteger();

        InstitutionEvidenceReconciler.ReconciliationResult result = new InstitutionEvidenceReconciler().reconcile(
                root, Duration.ofMinutes(60), 3, NOW,
                keys -> {
                    queried.set(keys.size());
                    return Set.copyOf(keys);
                }
        );

        assertEquals(3, result.examined());
        assertTrue(result.truncated());
        assertTrue(queried.get() <= 3);
        assertEquals(0, result.deletedTotal());
    }

    @Test
    void actorProcessTestTaskEvidenceCodesRemainStable() {
        assertEquals("SYSTEM_RECOVERY", InstitutionEvidenceReconciler.RECOVERY_ACTOR_CODE);
        assertEquals("COMPANY_REAPPLICATION_PUBLIC", InstitutionEvidenceReconciler.RECOVERY_PROCESS_CODE);
        assertEquals("COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION", InstitutionEvidenceReconciler.RECOVERY_STEP_CODE);
        assertEquals("TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW", InstitutionEvidenceReconciler.RECOVERY_TEST_CODE);
        assertEquals("TASK_COMPANY_REAPPLICATION_EVIDENCE_RECONCILE", InstitutionEvidenceReconciler.RECOVERY_TASK_CODE);
    }

    private Path old(String name) throws IOException {
        Path path = Files.writeString(root.resolve(name), "evidence");
        Files.setLastModifiedTime(path, FileTime.from(NOW.minus(Duration.ofHours(2))));
        return path;
    }

    private Path recent(String name) throws IOException {
        Path path = Files.writeString(root.resolve(name), "evidence");
        Files.setLastModifiedTime(path, FileTime.from(NOW.minus(Duration.ofMinutes(5))));
        return path;
    }
}
