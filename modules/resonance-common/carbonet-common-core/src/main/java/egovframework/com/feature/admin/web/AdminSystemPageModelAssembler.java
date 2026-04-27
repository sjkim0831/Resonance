package egovframework.com.feature.admin.web;

import egovframework.com.platform.bootstrap.service.AdminSchedulerBootstrapReadService;
import egovframework.com.platform.bootstrap.service.AdminSecurityBootstrapReadService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminSystemPageModelAssembler {

    private final AdminSummaryReadPort adminSummaryReadPort;
    private final AdminSecurityBootstrapReadService adminSecurityBootstrapReadService;
    private final AdminSchedulerBootstrapReadService adminSchedulerBootstrapReadService;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;

    public void populateSecurityPolicyPage(Model model, boolean isEn) {
        model.addAllAttributes(adminSecurityBootstrapReadService.buildSecurityPolicyPageData(isEn));
    }

    public void populateSecurityMonitoringPage(Model model, boolean isEn) {
        model.addAllAttributes(adminSecurityBootstrapReadService.buildSecurityMonitoringPageData(isEn));
    }

    public void populateBlocklistPage(
            String searchKeyword,
            String blockType,
            String status,
            String source,
            Model model,
            boolean isEn) {
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedBlockType = safeString(blockType).toUpperCase(Locale.ROOT);
        String normalizedStatus = safeString(status).toUpperCase(Locale.ROOT);
        String normalizedSource = safeString(source).toUpperCase(Locale.ROOT);
        model.addAttribute("searchKeyword", safeString(searchKeyword));
        model.addAttribute("blockType", normalizedBlockType);
        model.addAttribute("status", normalizedStatus);
        model.addAttribute("source", safeString(source));
        model.addAttribute("blocklistSummary", adminSummaryReadPort.getBlocklistSummary(isEn));
        List<Map<String, String>> blocklistRows = new ArrayList<>(adminSummaryReadPort.getBlocklistRows(isEn));
        model.addAttribute("blocklistRows", blocklistRows.stream()
                .filter(row -> matchesBlocklistFilter(row, normalizedKeyword, normalizedBlockType, normalizedStatus, normalizedSource))
                .toList());
        List<Map<String, String>> releaseQueue = new ArrayList<>(adminSummaryReadPort.getBlocklistReleaseQueue(isEn));
        model.addAttribute("blocklistReleaseQueue", releaseQueue.stream()
                .filter(row -> matchesQueueFilter(row, normalizedKeyword, normalizedSource))
                .toList());
        List<Map<String, String>> releaseHistory = new ArrayList<>(adminSummaryReadPort.getBlocklistReleaseHistory(isEn));
        model.addAttribute("blocklistReleaseHistory", releaseHistory.stream()
                .filter(row -> matchesHistoryFilter(row, normalizedKeyword, normalizedSource))
                .toList());
    }

    private boolean matchesBlocklistFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedBlockType,
            String normalizedStatus,
            String normalizedSource) {
        String rowBlockType = safeString(row.get("blockType")).toUpperCase(Locale.ROOT);
        String rowStatus = safeString(row.get("status")).toUpperCase(Locale.ROOT);
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                safeString(row.get("blockId")),
                safeString(row.get("target")),
                safeString(row.get("reason")),
                safeString(row.get("owner")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesBlockType = normalizedBlockType.isEmpty() || normalizedBlockType.equals(rowBlockType);
        boolean matchesStatus = normalizedStatus.isEmpty() || normalizedStatus.equals(rowStatus);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesBlockType && matchesStatus && matchesSource;
    }

    private boolean matchesQueueFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedSource) {
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                safeString(row.get("target")),
                safeString(row.get("condition")),
                safeString(row.get("releaseAt")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesSource;
    }

    private boolean matchesHistoryFilter(
            Map<String, String> row,
            String normalizedKeyword,
            String normalizedSource) {
        String rowSource = safeString(row.get("source")).toUpperCase(Locale.ROOT);
        boolean matchesKeyword = normalizedKeyword.isEmpty() || String.join(" ",
                safeString(row.get("blockId")),
                safeString(row.get("target")),
                safeString(row.get("reason")),
                safeString(row.get("releasedBy")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
        boolean matchesSource = normalizedSource.isEmpty() || normalizedSource.equals(rowSource);
        return matchesKeyword && matchesSource;
    }

    public void populateSecurityAuditPage(Model model, boolean isEn) {
        model.addAllAttributes(adminSecurityBootstrapReadService.buildSecurityAuditPageData(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                isEn));
    }

    public void populateSchedulerPage(
            String jobStatus,
            String executionType,
            Model model,
            boolean isEn) {
        model.addAllAttributes(adminSchedulerBootstrapReadService.buildSchedulerPageData(jobStatus, executionType, isEn));
    }

    public void populateBackupConfigPage(Model model, boolean isEn) {
        Map<String, Object> payload = adminShellBootstrapPageService.buildBackupConfigPageData(isEn);
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            model.addAttribute(entry.getKey(), entry.getValue());
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
