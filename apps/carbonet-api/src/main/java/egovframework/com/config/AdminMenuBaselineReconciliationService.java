package egovframework.com.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

@Component
@Slf4j
public class AdminMenuBaselineReconciliationService {

    private static final int EXPECTED_MENU_COUNT = 169;
    private static final String BASELINE_RESOURCE = "db/baseline/admin-menu-169.tsv";

    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;
    private final ReentrantLock reconciliationLock = new ReentrantLock();

    public AdminMenuBaselineReconciliationService(
            JdbcTemplate jdbcTemplate,
            TransactionTemplate transactionTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = transactionTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void reconcileOnStartup() {
        reconcile("startup");
    }

    @Scheduled(
            initialDelayString = "${carbonet.menu-reconciliation.initial-delay-ms:60000}",
            fixedDelayString = "${carbonet.menu-reconciliation.fixed-delay-ms:300000}"
    )
    public void reconcilePeriodically() {
        reconcile("scheduled");
    }

    private void reconcile(String trigger) {
        if (!reconciliationLock.tryLock()) {
            return;
        }
        try {
            List<MenuBaselineRow> baseline = loadBaseline();
            int[] restored = transactionTemplate.execute(status -> restoreMissingRows(baseline));
            if (restored == null) {
                throw new IllegalStateException("Menu reconciliation transaction returned no result");
            }
            String state = restored[0] + restored[1] + restored[2] > 0 ? "REPAIRED" : "HEALTHY";
            writeHistory(trigger, state, restored, "Missing rows only; existing menu values preserved");
            log.info(
                    "Admin menu baseline reconciliation completed. trigger={}, state={}, expected={}, info={}, order={}, detail={}",
                    trigger, state, EXPECTED_MENU_COUNT, restored[0], restored[1], restored[2]
            );
        } catch (Exception e) {
            log.error("Admin menu baseline reconciliation failed. trigger={}", trigger, e);
        } finally {
            reconciliationLock.unlock();
        }
    }

    private List<MenuBaselineRow> loadBaseline() throws Exception {
        List<MenuBaselineRow> rows = new ArrayList<>();
        ClassPathResource resource = new ClassPathResource(BASELINE_RESOURCE);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] values = line.split("\\t", -1);
                if (values.length != 6) {
                    throw new IllegalStateException("Invalid admin menu baseline row: " + line);
                }
                rows.add(new MenuBaselineRow(
                        values[0], values[1], values[2], values[3], values[4], Integer.parseInt(values[5])
                ));
            }
        }
        if (rows.size() != EXPECTED_MENU_COUNT) {
            throw new IllegalStateException(
                    "Expected " + EXPECTED_MENU_COUNT + " admin menu baseline rows but found " + rows.size()
            );
        }
        return rows;
    }

    private int[] restoreMissingRows(List<MenuBaselineRow> baseline) {
        List<Object[]> infoArgs = new ArrayList<>(baseline.size());
        List<Object[]> orderArgs = new ArrayList<>(baseline.size());
        List<Object[]> detailArgs = new ArrayList<>(baseline.size());
        for (MenuBaselineRow row : baseline) {
            infoArgs.add(new Object[]{row.code(), row.nameKo(), row.nameEn(), row.url(), row.icon()});
            orderArgs.add(new Object[]{row.code(), row.sortOrder()});
            detailArgs.add(new Object[]{row.code(), row.nameKo(), row.nameEn()});
        }

        int info = sum(jdbcTemplate.batchUpdate("""
                INSERT INTO comtnmenuinfo
                  (menu_code, menu_nm, menu_nm_en, menu_url, menu_icon, use_at,
                   frst_regist_pnttm, last_updt_pnttm, expsr_at)
                VALUES (?, ?, ?, ?, ?, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'Y')
                ON CONFLICT (menu_code) DO NOTHING
                """, infoArgs));
        int ordering = sum(jdbcTemplate.batchUpdate("""
                INSERT INTO comtnmenuorder
                  (menu_code, sort_ordr, frst_regist_pnttm, last_updt_pnttm)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (menu_code) DO NOTHING
                """, orderArgs));
        int detail = sum(jdbcTemplate.batchUpdate("""
                INSERT INTO comtccmmndetailcode
                  (code_id, code, code_nm, code_dc, use_at, frst_regist_pnttm,
                   frst_register_id, last_updt_pnttm, last_updusr_id)
                VALUES ('AMENU1', ?, ?, ?, 'Y', CURRENT_TIMESTAMP,
                        'SYSTEM_RECONCILE', CURRENT_TIMESTAMP, 'SYSTEM_RECONCILE')
                ON CONFLICT (code_id, code) DO NOTHING
                """, detailArgs));
        return new int[]{info, ordering, detail};
    }

    private void writeHistory(String trigger, String state, int[] restored, String message) {
        try {
            jdbcTemplate.update("""
                    INSERT INTO carbonet_menu_reconciliation_history
                      (trigger_type, expected_count, restored_info, restored_order,
                       restored_detail, status, message)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, trigger, EXPECTED_MENU_COUNT, restored[0], restored[1], restored[2], state, message);
        } catch (Exception e) {
            log.warn("Failed to write admin menu reconciliation history. trigger={}", trigger, e);
        }
    }

    private int sum(int[] updates) {
        int total = 0;
        for (int update : updates) {
            if (update > 0) {
                total += update;
            }
        }
        return total;
    }

    private record MenuBaselineRow(
            String code,
            String nameKo,
            String nameEn,
            String url,
            String icon,
            int sortOrder
    ) {
    }
}
