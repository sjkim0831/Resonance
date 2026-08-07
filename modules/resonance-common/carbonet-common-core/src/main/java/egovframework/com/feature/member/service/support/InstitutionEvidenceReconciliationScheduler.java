package egovframework.com.feature.member.service.support;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.File;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Scheduled adapter for {@link InstitutionEvidenceReconciler}.
 *
 * <p>The in-process and filesystem locks prevent duplicate work in a JVM and
 * across runtime replicas sharing the evidence volume. Any DB or filesystem
 * uncertainty is reported and results in zero unsafe deletes.</p>
 */
@Component
@Slf4j
public class InstitutionEvidenceReconciliationScheduler {

    private static final String LOCK_FILE = ".institution-evidence-reconciliation.lock";

    private final JdbcTemplate jdbcTemplate;
    private final MeterRegistry meterRegistry;
    private final InstitutionEvidenceReconciler reconciler = new InstitutionEvidenceReconciler();
    private final ReentrantLock localLock = new ReentrantLock();

    @Value("${carbonet.evidence-reconciliation.enabled:true}")
    private boolean enabled;

    @Value("${carbonet.evidence-reconciliation.storage-root:}")
    private String configuredStorageRoot;

    @Value("${carbonet.evidence-reconciliation.minimum-age-minutes:60}")
    private long minimumAgeMinutes;

    @Value("${carbonet.evidence-reconciliation.scan-limit:500}")
    private int scanLimit;

    public InstitutionEvidenceReconciliationScheduler(
            JdbcTemplate jdbcTemplate,
            ObjectProvider<MeterRegistry> meterRegistryProvider
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.meterRegistry = meterRegistryProvider.getIfAvailable();
    }

    @Scheduled(
            initialDelayString = "${carbonet.evidence-reconciliation.initial-delay-ms:300000}",
            fixedDelayString = "${carbonet.evidence-reconciliation.fixed-delay-ms:900000}"
    )
    public void reconcilePeriodically() {
        reconcile("scheduled");
    }

    void reconcile(String trigger) {
        if (!enabled) {
            metricRun("disabled");
            return;
        }
        if (!localLock.tryLock()) {
            metricRun("local_lock_busy");
            return;
        }
        try {
            Path storageRoot = resolveStorageRoot();
            if (!Files.isDirectory(storageRoot) || Files.isSymbolicLink(storageRoot)) {
                metricRun("root_unavailable");
                log.debug("Institution evidence reconciliation skipped. trigger={}, reason=root_unavailable, root={}",
                        trigger, storageRoot);
                return;
            }
            Path lockPath = storageRoot.resolve(LOCK_FILE).normalize();
            try (FileChannel channel = FileChannel.open(
                    lockPath, StandardOpenOption.CREATE, StandardOpenOption.WRITE
            ); FileLock ignored = tryFileLock(channel)) {
                if (ignored == null) {
                    metricRun("shared_lock_busy");
                    return;
                }
                InstitutionEvidenceReconciler.ReconciliationResult result = reconciler.reconcile(
                        storageRoot,
                        Duration.ofMinutes(Math.max(1, minimumAgeMinutes)),
                        Math.max(1, scanLimit),
                        Instant.now(),
                        this::findReferencedObjectKeys
                );
                metricRun(result.failedDeletes() == 0 ? "success" : "partial_failure");
                metricDeleted("staged_part", result.deletedStaged());
                metricDeleted("unreferenced_final", result.deletedFinal());
                log.info(
                        "Institution evidence reconciliation completed. trigger={}, actor={}, process={}, step={}, test={}, task={}, examined={}, candidates={}, referenced={}, deletedPart={}, deletedFinal={}, failedDeletes={}, truncated={}",
                        trigger,
                        InstitutionEvidenceReconciler.RECOVERY_ACTOR_CODE,
                        InstitutionEvidenceReconciler.RECOVERY_PROCESS_CODE,
                        InstitutionEvidenceReconciler.RECOVERY_STEP_CODE,
                        InstitutionEvidenceReconciler.RECOVERY_TEST_CODE,
                        InstitutionEvidenceReconciler.RECOVERY_TASK_CODE,
                        result.examined(), result.candidates(), result.referenced(),
                        result.deletedStaged(), result.deletedFinal(), result.failedDeletes(), result.truncated()
                );
            } catch (OverlappingFileLockException lockBusy) {
                metricRun("shared_lock_busy");
            }
        } catch (Exception failure) {
            metricRun("failure");
            log.error(
                    "Institution evidence reconciliation failed closed. trigger={}, actor={}, process={}, step={}, test={}, task={}",
                    trigger,
                    InstitutionEvidenceReconciler.RECOVERY_ACTOR_CODE,
                    InstitutionEvidenceReconciler.RECOVERY_PROCESS_CODE,
                    InstitutionEvidenceReconciler.RECOVERY_STEP_CODE,
                    InstitutionEvidenceReconciler.RECOVERY_TEST_CODE,
                    InstitutionEvidenceReconciler.RECOVERY_TASK_CODE,
                    failure
            );
        } finally {
            localLock.unlock();
        }
    }

    private Set<String> findReferencedObjectKeys(List<String> objectKeys) {
        if (objectKeys.isEmpty()) {
            return Set.of();
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(objectKeys.size(), "?"));
        List<String> rows = jdbcTemplate.query(
                "SELECT STRE_FILE_NM FROM COMTNINSTTFILE WHERE STRE_FILE_NM IN (" + placeholders + ")",
                (resultSet, rowNumber) -> resultSet.getString(1),
                objectKeys.toArray()
        );
        return new HashSet<>(rows);
    }

    private Path resolveStorageRoot() {
        String path = configuredStorageRoot == null ? "" : configuredStorageRoot.trim();
        if (path.isEmpty()) {
            path = System.getProperty("carbosys.file.instt.dir", "").trim();
        }
        if (path.isEmpty()) {
            String environmentPath = System.getenv("CARBONET_FILE_INSTT_DIR");
            path = environmentPath == null ? "" : environmentPath.trim();
        }
        if (path.isEmpty()) {
            path = "./var/file/instt";
        }
        return new File(path).toPath().toAbsolutePath().normalize();
    }

    private FileLock tryFileLock(FileChannel channel) throws Exception {
        return channel.tryLock();
    }

    private void metricRun(String outcome) {
        if (meterRegistry != null) {
            meterRegistry.counter(
                    "carbonet.institution.evidence.reconciliation.runs",
                    "outcome", outcome,
                    "process", InstitutionEvidenceReconciler.RECOVERY_PROCESS_CODE
            ).increment();
        }
    }

    private void metricDeleted(String type, int count) {
        if (meterRegistry != null && count > 0) {
            meterRegistry.counter(
                    "carbonet.institution.evidence.reconciliation.files.deleted",
                    "type", type,
                    "process", InstitutionEvidenceReconciler.RECOVERY_PROCESS_CODE
            ).increment(count);
        }
    }
}
