package egovframework.com.feature.admin.service.impl;

import egovframework.com.platform.governance.service.AdminSummaryCommandService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SecurityPolicyMaintenanceScheduler {

    private final AdminSummaryCommandService adminSummaryCommandService;

    @Scheduled(cron = "0 */10 * * * *")
    public void expireSuppressionsKo() {
        adminSummaryCommandService.expireSecurityInsightSuppressions(false);
    }

    @Scheduled(cron = "30 */10 * * * *")
    public void expireSuppressionsEn() {
        adminSummaryCommandService.expireSecurityInsightSuppressions(true);
    }

    @Scheduled(cron = "0 5-59/10 * * * *")
    public void dispatchDigestKo() {
        adminSummaryCommandService.runScheduledSecurityInsightDigest(false);
    }

    @Scheduled(cron = "30 5-59/10 * * * *")
    public void dispatchDigestEn() {
        adminSummaryCommandService.runScheduledSecurityInsightDigest(true);
    }
}
