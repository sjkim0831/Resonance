package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.feature.admin.model.vo.EmissionResultSummaryView;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.ui.Model;

import java.util.List;
import java.util.Locale;

@Component
@RequiredArgsConstructor
class AdminEmissionResultPageModelAssembler {

    private final AdminSummaryReadPort adminSummaryReadPort;

    void populateEmissionResultList(
            String pageIndexParam,
            String searchKeyword,
            String resultStatus,
            String verificationStatus,
            Model model,
            boolean isEn) {
        int pageIndex = parsePageIndex(pageIndexParam);
        String keyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedResultStatus = safeString(resultStatus).toUpperCase(Locale.ROOT);
        String normalizedVerificationStatus = safeString(verificationStatus).toUpperCase(Locale.ROOT);

        EmissionResultFilterSnapshot filterSnapshot = adminSummaryReadPort.buildEmissionResultFilterSnapshot(
                isEn,
                keyword,
                normalizedResultStatus,
                normalizedVerificationStatus);
        List<EmissionResultSummaryView> filteredItems = filterSnapshot.getItems();

        int pageSize = 10;
        int totalCount = filterSnapshot.getTotalCount();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<EmissionResultSummaryView> pageItems = filteredItems.subList(fromIndex, toIndex);

        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }

        model.addAttribute("emissionResultList", pageItems);
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("reviewCount", filterSnapshot.getReviewCount());
        model.addAttribute("verifiedCount", filterSnapshot.getVerifiedCount());
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("prevPage", Math.max(1, currentPage - 1));
        model.addAttribute("nextPage", Math.min(totalPages, currentPage + 1));
        model.addAttribute("searchKeyword", safeString(searchKeyword));
        model.addAttribute("resultStatus", normalizedResultStatus);
        model.addAttribute("verificationStatus", normalizedVerificationStatus);
    }

    private int parsePageIndex(String pageIndexParam) {
        String normalized = safeString(pageIndexParam);
        if (normalized.isEmpty()) {
            return 1;
        }
        try {
            return Integer.parseInt(normalized);
        } catch (NumberFormatException ignored) {
            return 1;
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
