package egovframework.com.platform.bootstrap.service;

import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.feature.admin.model.vo.EmissionResultSummaryView;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminEmissionResultBootstrapReadService {

    private final AdminSummaryReadPort adminSummaryReadPort;

    public Map<String, Object> buildEmissionResultListPageData(
            String pageIndexParam,
            String searchKeyword,
            String resultStatus,
            String verificationStatus,
            boolean isEn) {
        int pageIndex = 1;
        if (!safeString(pageIndexParam).isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }

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

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("emissionResultList", pageItems);
        response.put("totalCount", totalCount);
        response.put("reviewCount", filterSnapshot.getReviewCount());
        response.put("verifiedCount", filterSnapshot.getVerifiedCount());
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("startPage", startPage);
        response.put("endPage", endPage);
        response.put("prevPage", Math.max(1, currentPage - 1));
        response.put("nextPage", Math.min(totalPages, currentPage + 1));
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("resultStatus", normalizedResultStatus);
        response.put("verificationStatus", normalizedVerificationStatus);
        return response;
    }

    public Map<String, Object> buildEmissionResultDetailPageData(String resultId, boolean isEn) {
        String normalizedResultId = safeString(resultId);
        EmissionResultFilterSnapshot filterSnapshot = adminSummaryReadPort.buildEmissionResultFilterSnapshot(isEn, "", "", "");
        EmissionResultSummaryView summary = filterSnapshot.getItems().stream()
                .filter(item -> normalizedResultId.equalsIgnoreCase(safeString(item.getResultId())))
                .findFirst()
                .orElse(null);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("resultId", normalizedResultId);
        response.put("listUrl", buildAdminPath(isEn, "/emission/result_list"));
        response.put("found", summary != null);
        if (summary == null) {
            response.put("pageError", isEn ? "The requested emission result could not be found." : "요청한 산정 결과를 찾을 수 없습니다.");
            return response;
        }

        response.put("projectName", summary.getProjectName());
        response.put("companyName", summary.getCompanyName());
        response.put("calculatedAt", summary.getCalculatedAt());
        response.put("totalEmission", summary.getTotalEmission());
        response.put("resultStatusCode", summary.getResultStatusCode());
        response.put("resultStatusLabel", summary.getResultStatusLabel());
        response.put("verificationStatusCode", summary.getVerificationStatusCode());
        response.put("verificationStatusLabel", summary.getVerificationStatusLabel());
        response.put("reportPeriod", resolveEmissionReportPeriod(summary.getResultId(), isEn));
        response.put("submittedAt", resolveEmissionSubmittedAt(summary.getResultId()));
        response.put("formulaVersion", resolveEmissionFormulaVersion(summary.getResultId()));
        response.put("verificationOwner", resolveEmissionVerificationOwner(summary.getResultId(), isEn));
        response.put("reviewMessage", resolveEmissionReviewMessage(summary.getResultStatusCode(), summary.getVerificationStatusCode(), isEn));
        response.put("reviewChecklist", buildEmissionReviewChecklist(summary.getResultId(), isEn));
        response.put("siteRows", buildEmissionResultSiteRows(summary.getResultId(), isEn));
        response.put("evidenceRows", buildEmissionEvidenceRows(summary.getResultId(), isEn));
        response.put("historyRows", buildEmissionHistoryRows(summary.getResultId(), isEn));
        response.put("siteCount", ((List<?>) response.get("siteRows")).size());
        response.put("evidenceCount", ((List<?>) response.get("evidenceRows")).size());
        response.put("verificationActionUrl", buildAdminPath(isEn, "/emission/validate?resultId=" + urlQueryValue(summary.getResultId())));
        response.put("historyUrl", buildAdminPath(isEn, "/emission/data_history?resultId=" + urlQueryValue(summary.getResultId())));
        return response;
    }

    private String resolveEmissionReportPeriod(String resultId, boolean isEn) {
        switch (safeString(resultId)) {
            case "ER-2026-001":
            case "ER-2026-002":
                return isEn ? "2026 Q1" : "2026년 1분기";
            case "ER-2026-003":
            case "ER-2026-004":
            case "ER-2026-005":
            default:
                return isEn ? "2026 February" : "2026년 2월";
        }
    }

    private String resolveEmissionSubmittedAt(String resultId) {
        switch (safeString(resultId)) {
            case "ER-2026-001": return "2026-03-05 10:24";
            case "ER-2026-002": return "2026-03-04 16:10";
            case "ER-2026-003": return "-";
            case "ER-2026-004": return "2026-02-27 09:40";
            case "ER-2026-005": return "2026-02-25 14:22";
            default: return "2026-02-21 11:05";
        }
    }

    private String resolveEmissionFormulaVersion(String resultId) {
        switch (safeString(resultId)) {
            case "ER-2026-001": return "CCUS-CALC-2.4";
            case "ER-2026-002": return "BLUE-H2-1.9";
            case "ER-2026-003": return "TRANS-NET-0.8";
            case "ER-2026-004": return "STORAGE-VERIFY-3.1";
            case "ER-2026-005": return "MEOH-CONV-1.4";
            default: return "REGIONAL-AUDIT-1.2";
        }
    }

    private String resolveEmissionVerificationOwner(String resultId, boolean isEn) {
        switch (safeString(resultId)) {
            case "ER-2026-001": return isEn ? "Verification Team A" : "검증 1팀";
            case "ER-2026-002": return isEn ? "Verification Team B" : "검증 2팀";
            case "ER-2026-003": return isEn ? "Calculation Operator" : "산정 담당자";
            case "ER-2026-004": return isEn ? "Storage Quality Team" : "저장소 품질팀";
            case "ER-2026-005": return isEn ? "Verification Team B" : "검증 2팀";
            default: return isEn ? "Regional Audit Cell" : "권역 감사 셀";
        }
    }

    private String resolveEmissionReviewMessage(String resultStatusCode, String verificationStatusCode, boolean isEn) {
        if ("VERIFIED".equalsIgnoreCase(verificationStatusCode)) {
            return isEn ? "Verification is complete. Review the site-level evidence and final calculation trace."
                    : "검증이 완료되었습니다. 배출지별 증빙과 최종 산정 이력을 확인하세요.";
        }
        if ("REVIEW".equalsIgnoreCase(resultStatusCode)) {
            return isEn ? "This result is in review. Confirm evidence completeness and anomaly notes before approval."
                    : "현재 검토 진행 중입니다. 승인 전 증빙 누락과 이상치 메모를 확인하세요.";
        }
        return isEn ? "The calculation draft is available for internal review before verification."
                : "검증 전 내부 검토를 위한 산정 초안입니다.";
    }

    private List<Map<String, String>> buildEmissionReviewChecklist(String resultId, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(mapOf("title", isEn ? "Calculation formula version" : "산정식 버전", "detail", resolveEmissionFormulaVersion(resultId)));
        rows.add(mapOf("title", isEn ? "Submission timestamp" : "제출 시각", "detail", resolveEmissionSubmittedAt(resultId)));
        rows.add(mapOf("title", isEn ? "Verification owner" : "검증 담당", "detail", resolveEmissionVerificationOwner(resultId, isEn)));
        return rows;
    }

    private List<Map<String, String>> buildEmissionResultSiteRows(String resultId, boolean isEn) {
        if ("ER-2026-002".equalsIgnoreCase(safeString(resultId))) {
            return List.of(
                    mapOf("siteName", isEn ? "Hydrogen Reforming Unit" : "수소 개질 설비", "scopeLabel", "Scope 1", "activityLabel", isEn ? "Natural gas 18,420 Nm3" : "천연가스 18,420 Nm3", "emissionValue", "41,200 tCO2e", "statusLabel", isEn ? "Evidence pending" : "증빙 보완 필요"),
                    mapOf("siteName", isEn ? "Steam Generator" : "스팀 발생기", "scopeLabel", "Scope 1", "activityLabel", isEn ? "Fuel 12,110 GJ" : "연료 12,110 GJ", "emissionValue", "21,480 tCO2e", "statusLabel", isEn ? "Reviewed" : "검토 완료"),
                    mapOf("siteName", isEn ? "Utility Power Feed" : "유틸리티 전력", "scopeLabel", "Scope 2", "activityLabel", isEn ? "Power 9,880 MWh" : "전력 9,880 MWh", "emissionValue", "21,530 tCO2e", "statusLabel", isEn ? "Reviewed" : "검토 완료"));
        }
        return List.of(
                mapOf("siteName", isEn ? "Capture Train A" : "포집 트레인 A", "scopeLabel", "Scope 1", "activityLabel", isEn ? "Fuel 22,400 GJ" : "연료 22,400 GJ", "emissionValue", "52,140 tCO2e", "statusLabel", isEn ? "Reviewed" : "검토 완료"),
                mapOf("siteName", isEn ? "Compression Line" : "압축 라인", "scopeLabel", "Scope 2", "activityLabel", isEn ? "Power 14,220 MWh" : "전력 14,220 MWh", "emissionValue", "37,880 tCO2e", "statusLabel", isEn ? "Reviewed" : "검토 완료"),
                mapOf("siteName", isEn ? "Storage & Transfer" : "저장·이송 설비", "scopeLabel", "Scope 3", "activityLabel", isEn ? "Transport 480 runs" : "운송 480회", "emissionValue", "35,420 tCO2e", "statusLabel", isEn ? "Reviewed" : "검토 완료"));
    }

    private List<Map<String, String>> buildEmissionEvidenceRows(String resultId, boolean isEn) {
        return List.of(
                mapOf("fileName", safeString(resultId) + "_activity-data.xlsx", "categoryLabel", isEn ? "Activity data" : "활동자료", "updatedAt", "2026-03-04 09:10", "owner", isEn ? "Emission operator" : "배출 담당자", "statusLabel", isEn ? "Submitted" : "제출 완료"),
                mapOf("fileName", safeString(resultId) + "_meter-log.pdf", "categoryLabel", isEn ? "Meter log" : "계측 로그", "updatedAt", "2026-03-04 11:30", "owner", isEn ? "Site manager" : "현장 관리자", "statusLabel", isEn ? "Reviewed" : "검토 완료"),
                mapOf("fileName", safeString(resultId) + "_verification-note.docx", "categoryLabel", isEn ? "Verification note" : "검증 메모", "updatedAt", "2026-03-05 14:00", "owner", resolveEmissionVerificationOwner(resultId, isEn), "statusLabel", isEn ? "Linked" : "연결 완료"));
    }

    private List<Map<String, String>> buildEmissionHistoryRows(String resultId, boolean isEn) {
        return List.of(
                mapOf("actionAt", "2026-03-04 08:55", "actor", isEn ? "Emission operator" : "배출 담당자", "actionLabel", isEn ? "Calculation executed" : "산정 실행", "note", resolveEmissionFormulaVersion(resultId) + (isEn ? " applied" : " 적용")),
                mapOf("actionAt", "2026-03-04 13:40", "actor", resolveEmissionVerificationOwner(resultId, isEn), "actionLabel", isEn ? "Review requested" : "검토 요청", "note", isEn ? "Evidence bundle attached." : "증빙 묶음 첨부"),
                mapOf("actionAt", "2026-03-05 10:05", "actor", resolveEmissionVerificationOwner(resultId, isEn), "actionLabel", isEn ? "Status updated" : "상태 변경", "note", resolveEmissionReviewMessage("", "VERIFIED", isEn)));
    }

    private String buildAdminPath(boolean isEn, String path) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private String urlQueryValue(String value) {
        if (value == null) {
            return "";
        }
        return value.replace(" ", "+");
    }

    private Map<String, String> mapOf(String... values) {
        Map<String, String> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(values[index], values[index + 1]);
        }
        return row;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
