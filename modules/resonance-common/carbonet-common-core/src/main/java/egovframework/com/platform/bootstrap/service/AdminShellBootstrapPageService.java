package egovframework.com.platform.bootstrap.service;

import egovframework.com.platform.codex.service.AuthGroupManageService;

import egovframework.com.common.trace.UiManifestRegistryPort;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.feature.admin.model.vo.EmissionResultSummaryView;
import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;
import egovframework.com.platform.read.AdminSummaryReadPort;
import egovframework.com.platform.read.MenuInfoReadPort;
import egovframework.com.platform.service.observability.CertificateAuditLogPageDataPort;
import egovframework.com.platform.service.observability.ExternalMonitoringPayloadPort;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.platform.governance.service.BackupConfigManagementService;
import egovframework.com.platform.trade.service.TradeControlPlanePort;
import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.service.VersionControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminShellBootstrapPageService {

    private final AdminSummaryReadPort adminSummaryReadPort;
    private final AdminSecurityBootstrapReadService adminSecurityBootstrapReadService;
    private final AdminHomeBootstrapReadService adminHomeBootstrapReadService;
    private final AdminSchedulerBootstrapReadService adminSchedulerBootstrapReadService;
    private final AdminEmissionResultBootstrapReadService adminEmissionResultBootstrapReadService;
    private final VerificationCenterBootstrapReadService verificationCenterBootstrapReadService;
    private final BackupConfigManagementService backupConfigManagementService;
    private final MenuInfoReadPort menuInfoReadPort;
    private final AuthGroupManageService authGroupManageService;
    private final UiManifestRegistryPort uiManifestRegistryPort;
    private final ExternalMonitoringPayloadPort externalMonitoringPayloadPort;
    private final CertificateAuditLogPageDataPort certificateAuditLogPageDataPort;
    private final TradeControlPlanePort tradeControlPlanePort;
    private final VersionControlService versionControlService;
    private final ProjectRuntimeContext projectRuntimeContext;

    private static final int SECURITY_AUDIT_BOOTSTRAP_PAGE_SIZE = 10;

    private String getProjectId() {
        String id = projectRuntimeContext.getProjectId();
        return (id == null || id.trim().isEmpty()) ? "carbonet" : id.trim();
    }

    private Map<String, Object> createPayload(boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        
        List<ReleaseUnitVO> units = versionControlService.getReleaseUnitsByProject(getProjectId());
        if (!units.isEmpty()) {
            ReleaseUnitVO latest = units.get(units.size() - 1);
            payload.put("runtimeVersion", latest.getReleaseVersion());
            payload.put("releaseStatus", latest.getReleaseStatus());
        } else {
            payload.put("runtimeVersion", "1.0.0-UNKNOWN");
            payload.put("releaseStatus", "UNKNOWN");
        }
        
        return payload;
    }

    public Map<String, Object> buildMemberStatsPageData(boolean isEn) {
        Map<String, Object> response = createPayload(isEn);
        response.put("title", isEn ? "Member Statistics Dashboard" : "회원 통계 현황");
        response.put("subtitle", isEn
                ? "Analyze the registered member base by member type, monthly signups, and regional distribution."
                : "시스템에 등록된 전체 회원 정보를 유형별, 지역별로 분석합니다.");
        response.put("totalMembers", 1422);
        appendMemberStatsSections(response, isEn);
        return response;
    }

    public Map<String, Object> buildSecurityPolicyPageData(boolean isEn) {
        return adminSecurityBootstrapReadService.buildSecurityPolicyPageData(isEn);
    }

    public Map<String, Object> buildSecurityMonitoringPageData(boolean isEn) {
        return adminSecurityBootstrapReadService.buildSecurityMonitoringPageData(isEn);
    }

    public Map<String, Object> buildExternalMonitoringPageData(boolean isEn) {
        return externalMonitoringPayloadPort.buildExternalMonitoringPagePayload(isEn);
    }

    public Map<String, Object> buildSecurityAuditPageData(
            String pageIndexParam,
            String searchKeyword,
            String actionType,
            String routeGroup,
            String startDate,
            String endDate,
            String sortKey,
            String sortDirection,
            boolean isEn) {
        return adminSecurityBootstrapReadService.buildSecurityAuditPageData(
                pageIndexParam,
                searchKeyword,
                actionType,
                routeGroup,
                startDate,
                endDate,
                sortKey,
                sortDirection,
                isEn);
    }

    public Map<String, Object> buildCertificateAuditLogPageData(
            String pageIndexParam,
            String searchKeyword,
            String auditType,
            String status,
            String certificateType,
            String startDate,
            String endDate,
            boolean isEn) {
        return certificateAuditLogPageDataPort.buildCertificateAuditLogPageData(
                pageIndexParam,
                searchKeyword,
                auditType,
                status,
                certificateType,
                startDate,
                endDate,
                isEn);
    }

    public Map<String, Object> buildCertificateRecCheckPageData(boolean isEn) {
        List<Map<String, Object>> duplicateGroups = buildCertificateRecCheckGroups();
        long blockedCount = duplicateGroups.stream()
                .filter(row -> "BLOCKED".equals(stringValue(row.get("status"))))
                .count();
        long reviewCount = duplicateGroups.stream()
                .filter(row -> "REVIEW".equals(stringValue(row.get("status"))))
                .count();
        int highestRisk = duplicateGroups.stream()
                .mapToInt(row -> parseInt(row.get("riskScore")))
                .max()
                .orElse(0);

        Map<String, Object> response = createPayload(isEn);
        response.put("duplicateGroups", duplicateGroups);
        response.put("totalCount", duplicateGroups.size());
        response.put("blockedCount", blockedCount);
        response.put("reviewCount", reviewCount);
        response.put("highestRisk", highestRisk);
        response.put("lastRefreshedAt", "2026-03-30 09:20");
        return response;
    }

    public Map<String, Object> buildAdminHomePageData(boolean isEn) {
        SecurityAuditSnapshot auditSnapshot = adminSummaryReadPort.loadSecurityAuditSnapshot();
        EmissionResultFilterSnapshot emissionSnapshot = adminSummaryReadPort.buildEmissionResultFilterSnapshot(isEn, "", "", "");
        return adminHomeBootstrapReadService.buildAdminHomePageData(
                isEn,
                emissionSnapshot.getItems(),
                auditSnapshot);
    }

    public Map<String, Object> buildSchedulerPageData(String jobStatus, String executionType, boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>(adminSchedulerBootstrapReadService.buildSchedulerPageData(
                jobStatus,
                executionType,
                isEn));
        response.put("isEn", isEn);
        return response;
    }

    public Map<String, Object> buildBackupConfigPageData(boolean isEn) {
        return backupConfigManagementService.buildPageData(isEn);
    }

    public Map<String, Object> buildVerificationCenterPageData(boolean isEn) {
        return verificationCenterBootstrapReadService.buildPageData(isEn);
    }

    public Map<String, Object> runVerificationCenterCheck(String actionType, String actorId, boolean isEn) {
        return verificationCenterBootstrapReadService.runCheck(actionType, actorId, isEn);
    }

    public Map<String, Object> buildVerificationAssetManagementPageData(boolean isEn) {
        return verificationCenterBootstrapReadService.buildManagementPageData(isEn);
    }

    public Map<String, Object> upsertVerificationBaseline(Map<String, Object> payload, String actorId, boolean isEn) {
        return verificationCenterBootstrapReadService.upsertBaseline(payload, actorId, isEn);
    }

    public Map<String, Object> upsertVerificationAccount(Map<String, Object> payload, String actorId, boolean isEn) {
        return verificationCenterBootstrapReadService.upsertAccount(payload, actorId, isEn);
    }

    public Map<String, Object> upsertVerificationDataset(Map<String, Object> payload, boolean isEn) {
        return verificationCenterBootstrapReadService.upsertDataset(payload, isEn);
    }

    public Map<String, Object> resolveVerificationAction(String actionId, boolean isEn) {
        return verificationCenterBootstrapReadService.resolveAction(actionId, isEn);
    }

    public Map<String, Object> buildNewPagePageData(boolean isEn) {
        String canonicalMenuUrl = "/admin/system/new-page";
        String localizedMenuUrl = isEn ? "/en/admin/system/new-page" : canonicalMenuUrl;
        String menuCode = "";
        String requiredViewFeatureCode = "";
        List<String> featureCodes = Collections.emptyList();
        MenuInfoDTO menuDetail = null;
        Map<String, Object> manifest = uiManifestRegistryPort.getPageRegistry("new-page");

        try {
            menuDetail = menuInfoReadPort.selectMenuDetailByUrl(canonicalMenuUrl);
        } catch (Exception ignored) {
            menuDetail = null;
        }

        try {
            menuCode = safeString(authGroupManageService.selectMenuCodeByMenuUrl(canonicalMenuUrl));
            requiredViewFeatureCode = safeString(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(canonicalMenuUrl));
            if (!menuCode.isEmpty()) {
                featureCodes = new ArrayList<>(authGroupManageService.selectFeatureCodesByMenuCode(menuCode));
            }
        } catch (Exception ignored) {
            featureCodes = Collections.emptyList();
        }

        if (menuCode.isEmpty()) {
            menuCode = safeString(menuDetail == null ? null : menuDetail.getCode());
        }
        if (requiredViewFeatureCode.isEmpty() && !menuCode.isEmpty()) {
            requiredViewFeatureCode = menuCode + "_VIEW";
        }

        List<MenuInfoDTO> menuRows = loadMenuTreeRows("AMENU1");
        MenuInfoDTO selfRow = findMenuRow(menuRows, menuCode);
        Map<String, Object> payload = createPayload(isEn);
        payload.put("pageId", "new-page");
        appendNewPageMenuPayload(
                payload,
                canonicalMenuUrl,
                localizedMenuUrl,
                menuCode,
                requiredViewFeatureCode,
                featureCodes,
                menuDetail,
                selfRow);
        payload.put("roleAssignments", buildNewPageRoleAssignments(requiredViewFeatureCode, isEn));
        payload.put("menuAncestry", buildMenuAncestry(menuRows, menuCode, isEn));
        payload.put("manifest", manifest);
        payload.put("governanceNotes", buildNewPageGovernanceNotes(isEn, requiredViewFeatureCode, manifest, featureCodes));
        return payload;
    }

    private void appendMemberStatsSections(Map<String, Object> response, boolean isEn) {
        response.put("memberTypeStats", List.of(
                statsRow("enterprise", isEn ? "Enterprise Members" : "기업 회원", "78.7", "1120", "bg-blue-600"),
                statsRow("individual", isEn ? "Individual Members" : "개인 회원", "21.3", "302", "bg-emerald-500")));
        response.put("monthlySignupStats", List.of(
                monthlySignupRow(isEn ? "Apr" : "04월", "100", "56", false),
                monthlySignupRow(isEn ? "May" : "05월", "85", "48", false),
                monthlySignupRow(isEn ? "Jun" : "06월", "120", "63", false),
                monthlySignupRow(isEn ? "Jul" : "07월", "145", "81", false),
                monthlySignupRow(isEn ? "Aug" : "08월", "170", "96", true)));
        response.put("regionalDistribution", List.of(
                regionalDistributionRow(isEn ? "Capital Area" : "수도권", "42.5", isEn ? "774 companies" : "774개 기업"),
                regionalDistributionRow(isEn ? "Yeongnam Area" : "영남권", "28.2", isEn ? "513 companies" : "513개 기업"),
                regionalDistributionRow(isEn ? "Chungcheong Area" : "충청권", "18.4", isEn ? "335 companies" : "335개 기업"),
                regionalDistributionRow(isEn ? "Honam and Others" : "호남·기타", "10.9", isEn ? "198 companies" : "198개 기업")));
    }

    private void appendNewPageMenuPayload(
            Map<String, Object> payload,
            String canonicalMenuUrl,
            String localizedMenuUrl,
            String menuCode,
            String requiredViewFeatureCode,
            List<String> featureCodes,
            MenuInfoDTO menuDetail,
            MenuInfoDTO selfRow) {
        payload.put("canonicalMenuUrl", canonicalMenuUrl);
        payload.put("localizedMenuUrl", localizedMenuUrl);
        payload.put("menuCode", menuCode);
        payload.put("menuName", firstNonBlank(
                safeString(menuDetail == null ? null : menuDetail.getCodeNm()),
                safeString(selfRow == null ? null : selfRow.getCodeNm()),
                "새 페이지"));
        payload.put("menuNameEn", firstNonBlank(
                safeString(menuDetail == null ? null : menuDetail.getCodeDc()),
                safeString(selfRow == null ? null : selfRow.getCodeDc()),
                "New Page"));
        payload.put("menuIcon", firstNonBlank(
                safeString(menuDetail == null ? null : menuDetail.getMenuIcon()),
                safeString(selfRow == null ? null : selfRow.getMenuIcon()),
                "note_stack"));
        payload.put("useAt", firstNonBlank(
                safeString(menuDetail == null ? null : menuDetail.getUseAt()),
                safeString(selfRow == null ? null : selfRow.getUseAt()),
                "Y"));
        payload.put("sortOrder", selfRow == null ? null : selfRow.getSortOrdr());
        payload.put("requiredViewFeatureCode", requiredViewFeatureCode);
        payload.put("featureCodes", featureCodes);
        payload.put("featureCount", featureCodes.size());
    }

    public Map<String, Object> buildEmissionResultListPageData(
            String pageIndexParam,
            String searchKeyword,
            String resultStatus,
            String verificationStatus,
            boolean isEn) {
        return adminEmissionResultBootstrapReadService.buildEmissionResultListPageData(
                pageIndexParam,
                searchKeyword,
                resultStatus,
                verificationStatus,
                isEn);
    }

    public Map<String, Object> buildTradeListPageData(
            String pageIndexParam,
            String searchKeyword,
            String tradeStatus,
            String settlementStatus,
            boolean isEn) {
        return tradeControlPlanePort.buildTradeListPageData(
                pageIndexParam,
                searchKeyword,
                tradeStatus,
                settlementStatus,
                isEn);
    }

    public Map<String, Object> buildTradeStatisticsPageData(
            String pageIndexParam,
            String searchKeyword,
            String periodFilter,
            String tradeType,
            String settlementStatus,
            boolean isEn) {
        return tradeControlPlanePort.buildTradeStatisticsPageData(
                pageIndexParam,
                searchKeyword,
                periodFilter,
                tradeType,
                settlementStatus,
                isEn);
    }

    public Map<String, Object> buildTradeDuplicatePageData(
            String pageIndexParam,
            String searchKeyword,
            String detectionType,
            String reviewStatus,
            String riskLevel,
            boolean isEn) {
        return tradeControlPlanePort.buildTradeDuplicatePageData(
                pageIndexParam,
                searchKeyword,
                detectionType,
                reviewStatus,
                riskLevel,
                isEn);
    }

    public Map<String, Object> buildSettlementCalendarPageData(
            String pageIndexParam,
            String selectedMonth,
            String searchKeyword,
            String settlementStatus,
            String riskLevel,
            boolean isEn) {
        return tradeControlPlanePort.buildSettlementCalendarPageData(
                pageIndexParam,
                selectedMonth,
                searchKeyword,
                settlementStatus,
                riskLevel,
                isEn);
    }

    public Map<String, Object> buildTradeRejectPageData(String tradeId, String returnUrl, boolean isEn) {
        return tradeControlPlanePort.buildTradeRejectPageData(tradeId, returnUrl, isEn);
    }

    public Map<String, Object> buildTradeApprovePageData(
            String pageIndexParam,
            String searchKeyword,
            String approvalStatus,
            String tradeType,
            boolean isEn) {
        return tradeControlPlanePort.buildTradeApprovePageData(
                pageIndexParam,
                searchKeyword,
                approvalStatus,
                tradeType,
                isEn);
    }

    public Map<String, Object> submitTradeApproveAction(Map<String, Object> payload, boolean isEn) {
        return tradeControlPlanePort.submitTradeApproveAction(payload, isEn);
    }

    public Map<String, Object> submitTradeRejectAction(Map<String, Object> payload, boolean isEn) {
        return tradeControlPlanePort.submitTradeRejectAction(payload, isEn);
    }

    public Map<String, Object> buildEmissionResultDetailPageData(String resultId, boolean isEn) {
        return adminEmissionResultBootstrapReadService.buildEmissionResultDetailPageData(resultId, isEn);
    }

    public Map<String, Object> buildCertificateStatisticsPageData(
            String pageIndexParam,
            String searchKeyword,
            String periodFilter,
            String certificateType,
            String issuanceStatus,
            boolean isEn) {
        int pageIndex = 1;
        if (!safeString(pageIndexParam).isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }

        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedPeriodFilter = normalizeCertificatePeriodFilter(periodFilter);
        String normalizedCertificateType = safeString(certificateType).toUpperCase(Locale.ROOT);
        String normalizedIssuanceStatus = safeString(issuanceStatus).toUpperCase(Locale.ROOT);

        List<Map<String, String>> institutionRows = buildCertificateStatisticsInstitutionRows(isEn).stream()
                .filter(row -> normalizedCertificateType.isEmpty() || normalizedCertificateType.equals(safeString(row.get("certificateTypeCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedIssuanceStatus.isEmpty() || normalizedIssuanceStatus.equals(safeString(row.get("statusCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedKeyword.isEmpty() || matchesCertificateStatisticsKeyword(row, normalizedKeyword))
                .collect(Collectors.toList());

        List<Map<String, String>> monthlyRows = selectCertificateMonthlyRows(
                buildCertificateStatisticsMonthlyRows(isEn),
                normalizedPeriodFilter);
        List<Map<String, String>> certificateTypeRows = buildCertificateStatisticsTypeRows(isEn).stream()
                .filter(row -> normalizedCertificateType.isEmpty() || normalizedCertificateType.equals(safeString(row.get("certificateTypeCode")).toUpperCase(Locale.ROOT)))
                .collect(Collectors.toList());

        int pageSize = 6;
        int totalCount = institutionRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageRows = institutionRows.subList(fromIndex, toIndex);

        int totalIssuedCount = sumCertificateStatistic(institutionRows, "issuedCount");
        int pendingCount = sumCertificateStatistic(institutionRows, "pendingCount");
        int rejectedCount = sumCertificateStatistic(institutionRows, "rejectedCount");
        int reissuedCount = sumCertificateStatistic(institutionRows, "reissuedCount");
        int totalRequestCount = sumCertificateStatistic(institutionRows, "requestCount");
        String issuanceRate = totalRequestCount <= 0
                ? "0.0"
                : String.format(Locale.ROOT, "%.1f", (totalIssuedCount * 100.0) / totalRequestCount);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("totalCount", totalCount);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("periodFilter", normalizedPeriodFilter);
        response.put("certificateType", normalizedCertificateType);
        response.put("issuanceStatus", normalizedIssuanceStatus);
        response.put("totalIssuedCount", totalIssuedCount);
        response.put("pendingCount", pendingCount);
        response.put("rejectedCount", rejectedCount);
        response.put("reissuedCount", reissuedCount);
        response.put("totalRequestCount", totalRequestCount);
        response.put("avgLeadDays", formatCertificateLeadDays(institutionRows));
        response.put("issuanceRate", issuanceRate);
        response.put("monthlyRows", monthlyRows);
        response.put("certificateTypeRows", certificateTypeRows);
        response.put("institutionRows", pageRows);
        response.put("alertRows", buildCertificateStatisticsAlertRows(isEn));
        return response;
    }

    private String normalizeCertificatePeriodFilter(String value) {
        String normalized = safeString(value).toUpperCase(Locale.ROOT);
        if ("LAST_6_MONTHS".equals(normalized) || "Q1_2026".equals(normalized)) {
            return normalized;
        }
        return "LAST_12_MONTHS";
    }

    private boolean matchesCertificateStatisticsKeyword(Map<String, String> row, String normalizedKeyword) {
        return String.join(" ",
                        safeString(row.get("insttId")),
                        safeString(row.get("insttName")),
                        safeString(row.get("siteName")),
                        safeString(row.get("operatorName")),
                        safeString(row.get("certificateTypeLabel")))
                .toLowerCase(Locale.ROOT)
                .contains(normalizedKeyword);
    }

    private List<Map<String, String>> selectCertificateMonthlyRows(List<Map<String, String>> sourceRows, String periodFilter) {
        if ("LAST_6_MONTHS".equals(periodFilter)) {
            return sourceRows.subList(Math.max(sourceRows.size() - 6, 0), sourceRows.size());
        }
        if ("Q1_2026".equals(periodFilter)) {
            return sourceRows.subList(Math.max(sourceRows.size() - 3, 0), sourceRows.size());
        }
        return sourceRows;
    }

    private int sumCertificateStatistic(List<Map<String, String>> rows, String key) {
        int total = 0;
        for (Map<String, String> row : rows) {
            String rawValue = safeString(row.get(key)).replace(",", "");
            if (rawValue.isEmpty()) {
                continue;
            }
            try {
                total += Integer.parseInt(rawValue);
            } catch (NumberFormatException ignored) {
                // Ignore malformed seed data and keep the screen available.
            }
        }
        return total;
    }

    private String formatCertificateLeadDays(List<Map<String, String>> rows) {
        double totalLeadDays = 0.0;
        int measuredRows = 0;
        for (Map<String, String> row : rows) {
            String rawValue = safeString(row.get("avgLeadDays")).replace(",", "");
            if (rawValue.isEmpty()) {
                continue;
            }
            try {
                totalLeadDays += Double.parseDouble(rawValue);
                measuredRows += 1;
            } catch (NumberFormatException ignored) {
                // Ignore malformed seed data and keep the screen available.
            }
        }
        if (measuredRows == 0) {
            return "0.0";
        }
        return String.format(Locale.ROOT, "%.1f", totalLeadDays / measuredRows);
    }

    private List<Map<String, String>> buildCertificateStatisticsMonthlyRows(boolean isEn) {
        return List.of(
                mapOf("monthLabel", isEn ? "Apr" : "04월", "issuedCount", "84", "reissuedCount", "7", "rejectedCount", "5"),
                mapOf("monthLabel", isEn ? "May" : "05월", "issuedCount", "91", "reissuedCount", "8", "rejectedCount", "6"),
                mapOf("monthLabel", isEn ? "Jun" : "06월", "issuedCount", "96", "reissuedCount", "10", "rejectedCount", "7"),
                mapOf("monthLabel", isEn ? "Jul" : "07월", "issuedCount", "108", "reissuedCount", "12", "rejectedCount", "8"),
                mapOf("monthLabel", isEn ? "Aug" : "08월", "issuedCount", "114", "reissuedCount", "12", "rejectedCount", "9"),
                mapOf("monthLabel", isEn ? "Sep" : "09월", "issuedCount", "120", "reissuedCount", "15", "rejectedCount", "8"),
                mapOf("monthLabel", isEn ? "Oct" : "10월", "issuedCount", "128", "reissuedCount", "15", "rejectedCount", "10"),
                mapOf("monthLabel", isEn ? "Nov" : "11월", "issuedCount", "136", "reissuedCount", "18", "rejectedCount", "11"),
                mapOf("monthLabel", isEn ? "Dec" : "12월", "issuedCount", "142", "reissuedCount", "17", "rejectedCount", "9"),
                mapOf("monthLabel", isEn ? "Jan" : "01월", "issuedCount", "149", "reissuedCount", "20", "rejectedCount", "11"),
                mapOf("monthLabel", isEn ? "Feb" : "02월", "issuedCount", "156", "reissuedCount", "21", "rejectedCount", "13"),
                mapOf("monthLabel", isEn ? "Mar" : "03월", "issuedCount", "164", "reissuedCount", "23", "rejectedCount", "14"));
    }

    private List<Map<String, String>> buildCertificateStatisticsTypeRows(boolean isEn) {
        return List.of(
                mapOf("certificateTypeCode", "EMISSION", "certificateTypeLabel", isEn ? "Emission Certificate" : "배출권 인증서", "requestCount", "342", "issuedCount", "281", "pendingCount", "31", "rejectedCount", "18", "avgLeadDays", "2.8", "successRate", "82.2"),
                mapOf("certificateTypeCode", "REDUCTION", "certificateTypeLabel", isEn ? "Reduction Confirmation" : "감축실적 확인서", "requestCount", "214", "issuedCount", "176", "pendingCount", "18", "rejectedCount", "9", "avgLeadDays", "2.3", "successRate", "82.2"),
                mapOf("certificateTypeCode", "REC", "certificateTypeLabel", isEn ? "REC Verification" : "REC 검증서", "requestCount", "168", "issuedCount", "132", "pendingCount", "17", "rejectedCount", "8", "avgLeadDays", "3.1", "successRate", "78.6"),
                mapOf("certificateTypeCode", "COMPLIANCE", "certificateTypeLabel", isEn ? "Compliance Report" : "준수 확인서", "requestCount", "122", "issuedCount", "95", "pendingCount", "14", "rejectedCount", "6", "avgLeadDays", "3.4", "successRate", "77.9"));
    }

    private List<Map<String, String>> buildCertificateStatisticsInstitutionRows(boolean isEn) {
        return List.of(
                mapOf("insttId", "INST-001", "insttName", isEn ? "Han River CCUS Demonstration Center" : "한강 CCUS 실증센터", "siteName", isEn ? "Capture Unit A" : "포집 설비 A", "operatorName", "review.lead", "certificateTypeCode", "EMISSION", "certificateTypeLabel", isEn ? "Emission Certificate" : "배출권 인증서", "statusCode", "ISSUED", "requestCount", "94", "issuedCount", "82", "pendingCount", "7", "rejectedCount", "3", "reissuedCount", "6", "avgLeadDays", "2.1", "lastIssuedAt", "2026-03-29 17:10", "detailUrl", buildAdminPath(isEn, "/certificate/review?insttId=INST-001")),
                mapOf("insttId", "INST-002", "insttName", isEn ? "Gyeonggi Carbon Storage Office" : "경기 저장소 운영본부", "siteName", isEn ? "Storage Block 2" : "저장 블록 2", "operatorName", "issue.master", "certificateTypeCode", "REDUCTION", "certificateTypeLabel", isEn ? "Reduction Confirmation" : "감축실적 확인서", "statusCode", "ISSUED", "requestCount", "73", "issuedCount", "61", "pendingCount", "6", "rejectedCount", "2", "reissuedCount", "4", "avgLeadDays", "2.4", "lastIssuedAt", "2026-03-28 14:42", "detailUrl", buildAdminPath(isEn, "/certificate/review?insttId=INST-002")),
                mapOf("insttId", "INST-003", "insttName", isEn ? "Southern CO2 Recovery Center" : "남부 CO2 회수센터", "siteName", isEn ? "Recovery Line 1" : "회수 라인 1", "operatorName", "queue.admin", "certificateTypeCode", "REC", "certificateTypeLabel", isEn ? "REC Verification" : "REC 검증서", "statusCode", "PENDING", "requestCount", "68", "issuedCount", "42", "pendingCount", "17", "rejectedCount", "4", "reissuedCount", "5", "avgLeadDays", "3.6", "lastIssuedAt", "2026-03-27 09:35", "detailUrl", buildAdminPath(isEn, "/certificate/pending_list?insttId=INST-003")),
                mapOf("insttId", "INST-004", "insttName", isEn ? "West Coast Capture Pilot Zone" : "서부 포집 시범단지", "siteName", isEn ? "Pilot Field" : "시범 부지", "operatorName", "audit.admin", "certificateTypeCode", "EMISSION", "certificateTypeLabel", isEn ? "Emission Certificate" : "배출권 인증서", "statusCode", "REJECTED", "requestCount", "51", "issuedCount", "29", "pendingCount", "8", "rejectedCount", "10", "reissuedCount", "3", "avgLeadDays", "4.2", "lastIssuedAt", "2026-03-26 12:05", "detailUrl", buildAdminPath(isEn, "/certificate/objection_list?insttId=INST-004")),
                mapOf("insttId", "INST-005", "insttName", isEn ? "East Sea Storage Validation Lab" : "동해 저장 검증랩", "siteName", isEn ? "Verification Bay" : "검증 베이", "operatorName", "review.team02", "certificateTypeCode", "COMPLIANCE", "certificateTypeLabel", isEn ? "Compliance Report" : "준수 확인서", "statusCode", "ISSUED", "requestCount", "66", "issuedCount", "55", "pendingCount", "5", "rejectedCount", "3", "reissuedCount", "5", "avgLeadDays", "2.9", "lastIssuedAt", "2026-03-25 16:22", "detailUrl", buildAdminPath(isEn, "/certificate/review?insttId=INST-005")),
                mapOf("insttId", "INST-006", "insttName", isEn ? "Chungcheong Monitoring Hub" : "충청 모니터링 허브", "siteName", isEn ? "Hub Control Room" : "허브 관제실", "operatorName", "ops.cert01", "certificateTypeCode", "REDUCTION", "certificateTypeLabel", isEn ? "Reduction Confirmation" : "감축실적 확인서", "statusCode", "ISSUED", "requestCount", "58", "issuedCount", "48", "pendingCount", "4", "rejectedCount", "2", "reissuedCount", "4", "avgLeadDays", "2.2", "lastIssuedAt", "2026-03-24 10:14", "detailUrl", buildAdminPath(isEn, "/certificate/review?insttId=INST-006")),
                mapOf("insttId", "INST-007", "insttName", isEn ? "Honam Conversion Cluster" : "호남 전환 클러스터", "siteName", isEn ? "Methanol Process" : "메탄올 공정", "operatorName", "ops.cert02", "certificateTypeCode", "REC", "certificateTypeLabel", isEn ? "REC Verification" : "REC 검증서", "statusCode", "REISSUED", "requestCount", "83", "issuedCount", "64", "pendingCount", "7", "rejectedCount", "5", "reissuedCount", "12", "avgLeadDays", "3.3", "lastIssuedAt", "2026-03-23 18:08", "detailUrl", buildAdminPath(isEn, "/certificate/review?insttId=INST-007")),
                mapOf("insttId", "INST-008", "insttName", isEn ? "Capital Compliance Group" : "수도권 준수 점검단", "siteName", isEn ? "Audit Desk" : "점검 데스크", "operatorName", "qa.cert03", "certificateTypeCode", "COMPLIANCE", "certificateTypeLabel", isEn ? "Compliance Report" : "준수 확인서", "statusCode", "PENDING", "requestCount", "53", "issuedCount", "31", "pendingCount", "14", "rejectedCount", "4", "reissuedCount", "2", "avgLeadDays", "3.8", "lastIssuedAt", "2026-03-22 11:47", "detailUrl", buildAdminPath(isEn, "/certificate/pending_list?insttId=INST-008")));
    }

    private List<Map<String, String>> buildCertificateStatisticsAlertRows(boolean isEn) {
        return List.of(
                mapOf("title", isEn ? "Pending backlog above threshold" : "대기 백로그 임계치 초과",
                        "description", isEn ? "REC verification queue has 31 outstanding items across two institutions." : "REC 검증서 대기 건이 2개 기관에서 31건 누적되었습니다.",
                        "badge", isEn ? "Attention" : "주의",
                        "toneClassName", "bg-amber-100 text-amber-700",
                        "actionLabel", isEn ? "Open pending queue" : "대기열 열기",
                        "actionUrl", buildAdminPath(isEn, "/certificate/pending_list")),
                mapOf("title", isEn ? "Re-issuance concentration detected" : "재발급 집중 기관 감지",
                        "description", isEn ? "Honam Conversion Cluster exceeded the weekly re-issuance watch line." : "호남 전환 클러스터의 주간 재발급 건수가 감시선 이상입니다.",
                        "badge", isEn ? "Watch" : "관찰",
                        "toneClassName", "bg-sky-100 text-sky-700",
                        "actionLabel", isEn ? "Open review queue" : "검토 화면 열기",
                        "actionUrl", buildAdminPath(isEn, "/certificate/review?certificateType=REC")),
                mapOf("title", isEn ? "Rejected requests need follow-up" : "반려 건 후속 조치 필요",
                        "description", isEn ? "West Coast Capture Pilot Zone has unresolved objection candidates after rejection." : "서부 포집 시범단지에 반려 후 미해결 이의신청 후보가 남아 있습니다.",
                        "badge", isEn ? "Action" : "조치",
                        "toneClassName", "bg-rose-100 text-rose-700",
                        "actionLabel", isEn ? "Open objections" : "이의신청 열기",
                        "actionUrl", buildAdminPath(isEn, "/certificate/objection_list")));
    }

    public Map<String, Object> buildEmissionDataHistoryPageData(
            String pageIndexParam,
            String searchKeyword,
            String changeType,
            String changeTarget,
            boolean isEn) {
        int pageIndex = 1;
        if (!safeString(pageIndexParam).isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }

        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedChangeType = safeString(changeType).toUpperCase(Locale.ROOT);
        String normalizedChangeTarget = safeString(changeTarget).toUpperCase(Locale.ROOT);
        String adminPrefix = isEn ? "/en/admin" : "/admin";

        List<Map<String, String>> allRows = buildEmissionDataHistoryRows(isEn, adminPrefix);
        List<Map<String, String>> filteredRows = allRows.stream()
                .filter(row -> normalizedChangeType.isEmpty() || normalizedChangeType.equals(safeString(row.get("changeTypeCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedChangeTarget.isEmpty() || normalizedChangeTarget.equals(safeString(row.get("changeTargetCode")).toUpperCase(Locale.ROOT)))
                .filter(row -> normalizedKeyword.isEmpty() || matchesEmissionHistoryKeyword(row, normalizedKeyword))
                .collect(Collectors.toList());

        int pageSize = 10;
        int totalCount = filteredRows.size();
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pageItems = filteredRows.subList(fromIndex, toIndex);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("historyRows", pageItems);
        response.put("totalCount", totalCount);
        response.put("correctionCount", countEmissionHistoryByType(filteredRows, "CORRECTION"));
        response.put("approvalCount", countEmissionHistoryByType(filteredRows, "APPROVAL"));
        response.put("schemaCount", countEmissionHistoryByType(filteredRows, "SCHEMA"));
        response.put("summaryCards", buildEmissionDataHistorySummaryCards(filteredRows, isEn));
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("changeType", normalizedChangeType);
        response.put("changeTarget", normalizedChangeTarget);
        response.put("changeTypeOptions", buildEmissionDataHistoryChangeTypeOptions(isEn));
        response.put("changeTargetOptions", buildEmissionDataHistoryChangeTargetOptions(isEn));
        response.put("changeTypeMeta", buildEmissionDataHistoryChangeTypeMeta(isEn));
        response.put("changeTargetMeta", buildEmissionDataHistoryChangeTargetMeta(isEn));
        response.put("detailBaseUrl", adminPrefix + "/emission/result_list");
        return response;
    }

    public Map<String, Object> buildEmissionSiteManagementPageData(boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        String menuCode = "A0020105";
        String adminPrefix = isEn ? "/en/admin" : "/admin";
        String homePrefix = isEn ? "/en" : "";
        String selfUrl = adminPrefix + "/emission/site-management";
        String homeReferenceUrl = homePrefix + "/emission/project_list";
        String functionManagementUrl = adminPrefix + "/system/feature-management?menuType=ADMIN&searchMenuCode=" + menuCode;
        String menuManagementUrl = adminPrefix + "/system/menu?menuType=ADMIN";
        String resultListUrl = adminPrefix + "/emission/result_list";
        String dataHistoryUrl = adminPrefix + "/emission/data_history";

        response.put("isEn", isEn);
        response.put("menuCode", menuCode);
        response.put("menuUrl", selfUrl);
        response.put("homeReferenceUrl", homeReferenceUrl);
        response.put("referenceFolder", "/opt/reference/screen/홈 화면/배출지 관리/한글");
        response.put("summaryCards", List.of(
                summaryCard(isEn ? "Admin Direct Registration" : "관리자 직접 등록", isEn ? "Enabled" : "사용 가능",
                        isEn ? "Use this menu as the direct admin entry for new emission site registration." : "신규 배출지 등록의 관리자 직접 진입 화면으로 사용합니다.", "text-[var(--kr-gov-blue)]"),
                summaryCard(isEn ? "Function Catalog" : "기능 카탈로그", "9",
                        isEn ? "Seeded feature codes are ready for role mapping and function management." : "역할 매핑과 기능 관리를 위한 시드 기능 코드 9개를 제공합니다.", "text-emerald-600"),
                summaryCard(isEn ? "Home Reference" : "홈 기준 경로", "/emission/project_list",
                        isEn ? "Keep the user-side workflow aligned with the home route." : "사용자용 흐름은 홈 화면 경로를 기준으로 맞춥니다.", "text-amber-600")
        ));
        response.put("quickLinks", List.of(
                quickLink(isEn ? "Direct Register" : "배출지 등록", selfUrl + "#register", "add_business"),
                quickLink(isEn ? "Function Management" : "기능 관리", functionManagementUrl, "deployed_code"),
                quickLink(isEn ? "Menu Management" : "메뉴 관리", menuManagementUrl, "account_tree"),
                quickLink(isEn ? "Data History" : "데이터 변경 이력", dataHistoryUrl, "history")
        ));
        response.put("operationCards", List.of(
                operationCard(isEn ? "Emission Site Registration" : "배출지 등록",
                        isEn ? "Create new emission site records directly from the admin workspace." : "관리자 작업공간에서 신규 배출지를 직접 등록합니다.",
                        isEn ? "Direct admin action" : "관리자 직접 처리",
                        selfUrl + "#register",
                        isEn ? "Open registration guide" : "등록 가이드 열기",
                        functionManagementUrl,
                        isEn ? "Manage function" : "기능 관리"),
                operationCard(isEn ? "Data Input" : "데이터 입력",
                        isEn ? "Control the input workflow from admin while keeping the home reference available." : "홈 기준 흐름을 유지하되 입력 통제는 관리자에서 관리합니다.",
                        isEn ? "Managed from admin" : "관리자 통제",
                        homeReferenceUrl,
                        isEn ? "Open home reference" : "홈 기준 경로 열기",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "Data Input" : "데이터 입력"),
                        isEn ? "Open related feature" : "관련 기능 열기"),
                operationCard(isEn ? "Calculation Logic Registration" : "산정 로직 등록",
                        isEn ? "Register and govern calculation logic under the same admin menu." : "동일한 관리자 메뉴 아래에서 산정 로직을 등록하고 관리합니다.",
                        isEn ? "Admin governed" : "관리자 거버넌스",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "Calculation Logic" : "산정 로직"),
                        isEn ? "Open feature setup" : "기능 설정 열기",
                        menuManagementUrl,
                        isEn ? "Review menu placement" : "메뉴 배치 보기"),
                operationCard(isEn ? "Document Supplement" : "서류 보완",
                        isEn ? "Follow up missing or rejected documents from the admin side." : "누락 또는 반려 서류는 관리자 화면에서 후속 처리합니다.",
                        isEn ? "Admin follow-up" : "관리자 후속 처리",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "Document" : "서류 보완"),
                        isEn ? "Open supplement feature" : "보완 기능 열기",
                        resultListUrl,
                        isEn ? "Check history" : "이력 보기"),
                operationCard(isEn ? "History Review" : "이력 확인",
                        isEn ? "Use result history and operational records to trace the emission site lifecycle." : "배출지 생명주기 추적은 결과 이력과 운영 기록을 함께 사용합니다.",
                        isEn ? "History enabled" : "이력 사용",
                        dataHistoryUrl,
                        isEn ? "Open data history" : "데이터 이력 열기",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "History" : "이력 확인"),
                        isEn ? "Open feature" : "기능 열기"),
                operationCard(isEn ? "Report Export" : "보고서 출력",
                        isEn ? "Connect report export authority and operator entry from one admin menu." : "동일 관리자 메뉴에서 보고서 출력 권한과 운영 진입을 함께 관리합니다.",
                        isEn ? "Export ready" : "출력 준비",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "Report" : "보고서 출력"),
                        isEn ? "Open report feature" : "보고서 기능 열기",
                        homeReferenceUrl,
                        isEn ? "Open home screen" : "홈 화면 열기"),
                operationCard(isEn ? "Administration" : "관리",
                        isEn ? "Keep menu, page, and function governance in the admin domain." : "메뉴, 화면, 기능 거버넌스는 관리자 도메인에서 유지합니다.",
                        isEn ? "Governed" : "거버넌스 적용",
                        menuManagementUrl,
                        isEn ? "Open menu management" : "메뉴 관리 열기",
                        functionManagementUrl,
                        isEn ? "Open function management" : "기능 관리 열기"),
                operationCard(isEn ? "Integrated Monitoring Report" : "종합 배출 모니터링 리포트",
                        isEn ? "Bind the integrated monitoring report to the same admin authority chain." : "종합 배출 모니터링 리포트를 동일한 관리자 권한 체인에 연결합니다.",
                        isEn ? "Monitoring ready" : "모니터링 준비",
                        resultListUrl,
                        isEn ? "Open monitoring result list" : "모니터링 결과 열기",
                        functionManagementUrl + "&searchKeyword=" + urlQueryValue(isEn ? "Monitoring" : "모니터링"),
                        isEn ? "Open monitoring feature" : "모니터링 기능 열기")
        ));
        response.put("featureRows", List.of(
                featureRow(menuCode + "_VIEW", isEn ? "View page access" : "화면 조회", isEn ? "Base page access feature for the admin menu." : "관리자 메뉴의 기본 조회 권한입니다.", functionManagementUrl),
                featureRow(menuCode + "_REGISTER", isEn ? "Emission site registration" : "배출지 등록", isEn ? "Admin direct registration capability." : "관리자 직접 등록 기능입니다.", functionManagementUrl),
                featureRow(menuCode + "_DATA_INPUT", isEn ? "Emission data input" : "배출 데이터 입력", isEn ? "Activity data input control." : "활동자료 입력 통제 기능입니다.", functionManagementUrl),
                featureRow(menuCode + "_CALCULATION", isEn ? "Calculation logic registration" : "산정 로직 등록", isEn ? "Calculation logic operation control." : "산정 로직 운영 통제 기능입니다.", functionManagementUrl),
                featureRow(menuCode + "_DOCUMENT", isEn ? "Document supplement" : "서류 보완 관리", isEn ? "Follow-up workflow for supplemental documents." : "보완 서류 후속 처리 기능입니다.", functionManagementUrl),
                featureRow(menuCode + "_HISTORY", isEn ? "History review" : "이력 확인", isEn ? "Operational history review authority." : "운영 이력 확인 권한입니다.", functionManagementUrl),
                featureRow(menuCode + "_REPORT", isEn ? "Report export" : "보고서 출력", isEn ? "Report generation and export authority." : "보고서 생성 및 출력 권한입니다.", functionManagementUrl),
                featureRow(menuCode + "_MANAGE", isEn ? "Administration" : "배출지 운영 관리", isEn ? "Administrative governance actions." : "관리자 운영 제어 기능입니다.", functionManagementUrl),
                featureRow(menuCode + "_MONITOR", isEn ? "Integrated monitoring report" : "종합 배출 모니터링 리포트", isEn ? "Integrated report and monitoring authority." : "종합 리포트 및 모니터링 권한입니다.", functionManagementUrl)
        ));
        response.put("referenceRows", List.of(
                referenceRow(isEn ? "Design reference folder" : "설계 기준 폴더", "/opt/reference/screen/홈 화면/배출지 관리/한글"),
                referenceRow(isEn ? "Home reference path" : "홈 기준 경로", homeReferenceUrl),
                referenceRow(isEn ? "Admin menu path" : "관리자 메뉴 경로", selfUrl),
                referenceRow(isEn ? "Function management link" : "기능 관리 링크", functionManagementUrl)
        ));
        return response;
    }

    public Map<String, Object> buildEmissionValidatePageData(
            String pageIndexParam,
            String resultId,
            String searchKeyword,
            String verificationStatus,
            String priorityFilter,
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
        String normalizedResultId = safeString(resultId);
        String normalizedVerificationStatus = safeString(verificationStatus).toUpperCase(Locale.ROOT);
        String normalizedPriority = safeString(priorityFilter).toUpperCase(Locale.ROOT);
        String menuCode = "A0020104";
        String adminPrefix = isEn ? "/en/admin" : "/admin";
        String resultListUrl = adminPrefix + "/emission/result_list";
        String functionManagementUrl = adminPrefix + "/system/feature-management?menuType=ADMIN&searchMenuCode=" + menuCode;

        EmissionResultFilterSnapshot filterSnapshot = adminSummaryReadPort.buildEmissionResultFilterSnapshot(
                isEn,
                keyword,
                "",
                normalizedVerificationStatus);

        List<Map<String, String>> queueRows = new ArrayList<>();
        for (EmissionResultSummaryView item : filterSnapshot.getItems()) {
            String priorityCode = deriveVerificationPriorityCode(item);
            if (!normalizedPriority.isEmpty() && !normalizedPriority.equals(priorityCode)) {
                continue;
            }
            queueRows.add(verificationQueueRow(item, priorityCode, isEn));
        }

        int totalCount = queueRows.size();
        int pageSize = 8;
        int totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
        if (pageIndexParam == null || pageIndexParam.trim().isEmpty()) {
            int selectedIndex = -1;
            for (int i = 0; i < queueRows.size(); i++) {
                if (normalizedResultId.equalsIgnoreCase(safeString(queueRows.get(i).get("resultId")))) {
                    selectedIndex = i;
                    break;
                }
            }
            if (selectedIndex >= 0) {
                pageIndex = (selectedIndex / pageSize) + 1;
            }
        }
        int currentPage = Math.max(1, Math.min(pageIndex, totalPages));
        int fromIndex = Math.min((currentPage - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);
        List<Map<String, String>> pagedRows = queueRows.subList(fromIndex, toIndex);
        Map<String, String> selectedResultSummary = null;
        if (!normalizedResultId.isEmpty()) {
            for (Map<String, String> row : queueRows) {
                if (normalizedResultId.equalsIgnoreCase(safeString(row.get("resultId")))) {
                    selectedResultSummary = new LinkedHashMap<>();
                    selectedResultSummary.put("resultId", safeString(row.get("resultId")));
                    selectedResultSummary.put("projectName", safeString(row.get("projectName")));
                    selectedResultSummary.put("companyName", safeString(row.get("companyName")));
                    selectedResultSummary.put("verificationStatusLabel", safeString(row.get("verificationStatusLabel")));
                    selectedResultSummary.put("priorityLabel", safeString(row.get("priorityLabel")));
                    selectedResultSummary.put("detailUrl", safeString(row.get("detailUrl")));
                    break;
                }
            }
        }

        long pendingCount = queueRows.stream()
                .filter(row -> "PENDING".equalsIgnoreCase(safeString(row.get("verificationStatusCode"))))
                .count();
        long inProgressCount = queueRows.stream()
                .filter(row -> "IN_PROGRESS".equalsIgnoreCase(safeString(row.get("verificationStatusCode"))))
                .count();
        long failedCount = queueRows.stream()
                .filter(row -> "FAILED".equalsIgnoreCase(safeString(row.get("verificationStatusCode"))))
                .count();
        long highPriorityCount = queueRows.stream()
                .filter(row -> "HIGH".equalsIgnoreCase(safeString(row.get("priorityCode"))))
                .count();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("menuCode", menuCode);
        response.put("resultId", normalizedResultId);
        response.put("searchKeyword", safeString(searchKeyword));
        response.put("verificationStatus", normalizedVerificationStatus);
        response.put("priorityFilter", normalizedPriority);
        response.put("pageIndex", currentPage);
        response.put("pageSize", pageSize);
        response.put("totalPages", totalPages);
        response.put("totalCount", totalCount);
        response.put("pendingCount", pendingCount);
        response.put("inProgressCount", inProgressCount);
        response.put("failedCount", failedCount);
        response.put("highPriorityCount", highPriorityCount);
        response.put("selectedResultFound", selectedResultSummary != null);
        response.put("selectedResult", selectedResultSummary);
        response.put("queueRows", pagedRows);
        response.put("summaryCards", List.of(
                summaryCard(isEn ? "Verification Queue" : "검증 대기열", String.valueOf(totalCount),
                        isEn ? "Items currently routed through verification management." : "검증 관리 작업공간에서 현재 처리 중인 건수입니다.", "text-[var(--kr-gov-blue)]"),
                summaryCard(isEn ? "Pending / In Progress" : "대기 / 진행중", pendingCount + " / " + inProgressCount,
                        isEn ? "Separate waiting items from actively reviewed items." : "대기 건과 실검토 건을 분리해서 추적합니다.", "text-amber-600"),
                summaryCard(isEn ? "Failed / High Priority" : "반려 / 고우선", failedCount + " / " + highPriorityCount,
                        isEn ? "Rejected or risky items should be triaged first." : "반려 또는 위험 건은 우선적으로 재검토합니다.", "text-red-600")
        ));
        response.put("priorityLegend", List.of(
                verificationLegendRow(isEn ? "High" : "높음", isEn ? "Missing evidence or failed verification" : "증빙 누락 또는 검증 반려 건", "HIGH"),
                verificationLegendRow(isEn ? "Medium" : "중간", isEn ? "Actively under verifier review" : "검증 담당자가 검토 중인 건", "MEDIUM"),
                verificationLegendRow(isEn ? "Normal" : "일반", isEn ? "Waiting for initial verification assignment" : "최초 검증 배정을 기다리는 건", "NORMAL")
        ));
        response.put("policyRows", List.of(
                verificationPolicyRow(isEn ? "Evidence completeness" : "증빙 완결성", isEn ? "Check source documents, meter logs, and factor references before approval." : "승인 전 원천 문서, 계측 로그, 계수 근거를 모두 확인합니다."),
                verificationPolicyRow(isEn ? "Calculation delta review" : "산정 편차 검토", isEn ? "Escalate items when emission totals shift sharply from the previous cycle." : "이전 주기 대비 총배출량 편차가 큰 건은 상향 검토합니다."),
                verificationPolicyRow(isEn ? "Final action trace" : "최종 조치 이력", isEn ? "Approval, rejection, and supplement requests must leave an operator trace." : "승인, 반려, 보완 요청은 모두 운영자 이력을 남겨야 합니다.")
        ));
        response.put("actionLinks", List.of(
                quickLink(isEn ? "Result List" : "산정 결과 목록", resultListUrl, "table_view"),
                quickLink(isEn ? "Pending Review" : "검토 대기", resultListUrl + "?verificationStatus=PENDING", "hourglass_top"),
                quickLink(isEn ? "Failed Review" : "반려 건", resultListUrl + "?verificationStatus=FAILED", "warning"),
                quickLink(isEn ? "Feature Management" : "기능 관리", functionManagementUrl, "deployed_code")
        ));
        return response;
    }

    private Map<String, String> statsRow(String key, String label, String percentage, String count, String colorClass) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("key", key);
        row.put("label", label);
        row.put("percentage", percentage);
        row.put("count", count);
        row.put("colorClass", colorClass);
        return row;
    }

    private Map<String, String> monthlySignupRow(String month, String currentHeight, String previousHeight, boolean active) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("month", month);
        row.put("currentHeight", currentHeight);
        row.put("previousHeight", previousHeight);
        row.put("active", active ? "Y" : "N");
        return row;
    }

    private Map<String, String> regionalDistributionRow(String region, String percentage, String countLabel) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("region", region);
        row.put("percentage", percentage);
        row.put("countLabel", countLabel);
        return row;
    }

    private Map<String, String> summaryCard(String title, String value, String description, String toneClass) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        row.put("toneClass", toneClass);
        return row;
    }

    private Map<String, String> summaryCard(String title,
                                            String value,
                                            String description,
                                            String toneClass,
                                            String surfaceClassName) {
        Map<String, String> row = summaryCard(title, value, description, toneClass);
        row.put("surfaceClassName", surfaceClassName);
        return row;
    }

    private Map<String, String> quickLink(String label, String url, String icon) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("url", url);
        row.put("icon", icon);
        return row;
    }

    private Map<String, String> operationCard(String title,
                                              String description,
                                              String statusLabel,
                                              String primaryUrl,
                                              String primaryLabel,
                                              String secondaryUrl,
                                              String secondaryLabel) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("description", description);
        row.put("statusLabel", statusLabel);
        row.put("primaryUrl", primaryUrl);
        row.put("primaryLabel", primaryLabel);
        row.put("secondaryUrl", secondaryUrl);
        row.put("secondaryLabel", secondaryLabel);
        return row;
    }

    private Map<String, String> featureRow(String featureCode, String featureName, String featureDescription, String functionManagementUrl) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("featureCode", featureCode);
        row.put("featureName", featureName);
        row.put("featureDescription", featureDescription);
        row.put("manageUrl", functionManagementUrl);
        return row;
    }

    private Map<String, String> referenceRow(String label, String value) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("value", value);
        return row;
    }

    private List<Map<String, String>> buildEmissionDataHistoryRows(boolean isEn, String adminPrefix) {
        return List.of(
                emissionDataHistoryRow("HIS-2026-0042", "2026-03-29 16:40", "동해 CCUS 실증", "포집시설 A-01", "system.admin", "CORRECTION",
                        isEn ? "Correction" : "정정", "ACTIVITY_DATA", isEn ? "Activity Data" : "활동자료",
                        isEn ? "Fuel usage 3,250 Nm3" : "연료 사용량 3,250 Nm3",
                        isEn ? "Fuel usage 3,480 Nm3" : "연료 사용량 3,480 Nm3",
                        adminPrefix + "/emission/result_list?searchKeyword=동해+CCUS"),
                emissionDataHistoryRow("HIS-2026-0041", "2026-03-29 13:12", "서해 저장소 검증", "압축라인 C-02", "qa.operator", "APPROVAL",
                        isEn ? "Approval" : "승인 반영", "VERIFICATION_STATUS", isEn ? "Verification Status" : "검증 상태",
                        isEn ? "Pending review" : "검증 대기",
                        isEn ? "Verified" : "검증 완료",
                        adminPrefix + "/emission/result_list?verificationStatus=VERIFIED"),
                emissionDataHistoryRow("HIS-2026-0040", "2026-03-28 19:08", "남부 배출원 점검", "배출원 S-11", "schema.bot", "SCHEMA",
                        isEn ? "Schema sync" : "스키마 동기화", "EMISSION_FACTOR", isEn ? "Emission Factor" : "배출계수",
                        isEn ? "Tier 2 factor 0.932" : "Tier 2 계수 0.932",
                        isEn ? "Tier 3 factor 0.918" : "Tier 3 계수 0.918",
                        adminPrefix + "/emission/result_list?searchKeyword=남부"),
                emissionDataHistoryRow("HIS-2026-0039", "2026-03-28 14:22", "인천 수송망 연계", "이송설비 B-08", "audit.manager", "CORRECTION",
                        isEn ? "Correction" : "정정", "ATTACHMENT", isEn ? "Attachment" : "첨부 문서",
                        isEn ? "Evidence file missing" : "증빙 파일 누락",
                        isEn ? "Evidence file uploaded" : "증빙 파일 업로드 완료",
                        adminPrefix + "/emission/result_list?searchKeyword=인천"),
                emissionDataHistoryRow("HIS-2026-0038", "2026-03-28 10:10", "중부 포집 시범", "포집설비 P-03", "review.lead", "APPROVAL",
                        isEn ? "Approval" : "승인 반영", "RESULT_STATUS", isEn ? "Result Status" : "산정 상태",
                        isEn ? "Under review" : "검토 중",
                        isEn ? "Completed" : "산정 완료",
                        adminPrefix + "/emission/result_list?resultStatus=COMPLETED"),
                emissionDataHistoryRow("HIS-2026-0037", "2026-03-27 17:32", "울산 저장소 운영", "저장탱크 T-09", "system.admin", "SCHEMA",
                        isEn ? "Schema sync" : "스키마 동기화", "SITE_METADATA", isEn ? "Site Metadata" : "배출지 메타데이터",
                        isEn ? "Storage class B" : "저장 등급 B",
                        isEn ? "Storage class A" : "저장 등급 A",
                        adminPrefix + "/emission/site-management"),
                emissionDataHistoryRow("HIS-2026-0036", "2026-03-27 09:56", "포항 연계 검토", "배관라인 R-04", "field.manager", "CORRECTION",
                        isEn ? "Correction" : "정정", "CALCULATION_FORMULA", isEn ? "Calculation Formula" : "산정식",
                        isEn ? "Recovery rate 91.2%" : "회수율 91.2%",
                        isEn ? "Recovery rate 92.6%" : "회수율 92.6%",
                        adminPrefix + "/emission/result_list?searchKeyword=포항"),
                emissionDataHistoryRow("HIS-2026-0035", "2026-03-26 18:41", "광양 실증 운영", "압축설비 G-07", "qa.operator", "APPROVAL",
                        isEn ? "Approval" : "승인 반영", "ATTACHMENT", isEn ? "Attachment" : "첨부 문서",
                        isEn ? "Supplement requested" : "보완 요청",
                        isEn ? "Supplement accepted" : "보완 승인",
                        adminPrefix + "/emission/result_list?searchKeyword=광양"),
                emissionDataHistoryRow("HIS-2026-0034", "2026-03-26 11:17", "강릉 테스트베드", "배출원 K-01", "schema.bot", "SCHEMA",
                        isEn ? "Schema sync" : "스키마 동기화", "MONITORING_RULE", isEn ? "Monitoring Rule" : "모니터링 규칙",
                        isEn ? "15 min interval" : "15분 간격",
                        isEn ? "5 min interval" : "5분 간격",
                        adminPrefix + "/emission/data_history?changeTarget=MONITORING_RULE"),
                emissionDataHistoryRow("HIS-2026-0033", "2026-03-25 15:03", "경기 포집 검증", "포집라인 Y-12", "review.lead", "CORRECTION",
                        isEn ? "Correction" : "정정", "VERIFICATION_STATUS", isEn ? "Verification Status" : "검증 상태",
                        isEn ? "Failed" : "재검토 필요",
                        isEn ? "In progress" : "검증 진행중",
                        adminPrefix + "/emission/result_list?verificationStatus=IN_PROGRESS"),
                emissionDataHistoryRow("HIS-2026-0032", "2026-03-25 09:28", "전북 실증 단지", "보정설비 J-05", "audit.manager", "APPROVAL",
                        isEn ? "Approval" : "승인 반영", "SITE_METADATA", isEn ? "Site Metadata" : "배출지 메타데이터",
                        isEn ? "Operator team Beta" : "운영팀 Beta",
                        isEn ? "Operator team Alpha" : "운영팀 Alpha",
                        adminPrefix + "/emission/site-management"),
                emissionDataHistoryRow("HIS-2026-0031", "2026-03-24 20:06", "부산 수송 실증", "운송라인 M-02", "system.admin", "CORRECTION",
                        isEn ? "Correction" : "정정", "ACTIVITY_DATA", isEn ? "Activity Data" : "활동자료",
                        isEn ? "Shipment count 14" : "운송 횟수 14회",
                        isEn ? "Shipment count 16" : "운송 횟수 16회",
                        adminPrefix + "/emission/result_list?searchKeyword=부산")
        );
    }

    private List<Map<String, String>> buildEmissionDataHistoryChangeTypeOptions(boolean isEn) {
        return List.of(
                mapOf("value", "", "label", isEn ? "All" : "전체"),
                mapOf("value", "CORRECTION", "label", isEn ? "Correction" : "정정"),
                mapOf("value", "APPROVAL", "label", isEn ? "Approval" : "승인 반영"),
                mapOf("value", "SCHEMA", "label", isEn ? "Schema Sync" : "스키마 동기화"));
    }

    private Map<String, Map<String, String>> buildEmissionDataHistoryChangeTypeMeta(boolean isEn) {
        Map<String, Map<String, String>> meta = new LinkedHashMap<>();
        meta.put("CORRECTION", mapOf(
                "label", isEn ? "Correction" : "정정",
                "badgeClass", "bg-amber-100 text-amber-700"));
        meta.put("APPROVAL", mapOf(
                "label", isEn ? "Approval" : "승인 반영",
                "badgeClass", "bg-emerald-100 text-emerald-700"));
        meta.put("SCHEMA", mapOf(
                "label", isEn ? "Schema Sync" : "스키마 동기화",
                "badgeClass", "bg-indigo-100 text-indigo-700"));
        return meta;
    }

    private List<Map<String, String>> buildEmissionDataHistoryChangeTargetOptions(boolean isEn) {
        return List.of(
                mapOf("value", "", "label", isEn ? "All" : "전체"),
                mapOf("value", "ACTIVITY_DATA", "label", isEn ? "Activity Data" : "활동자료"),
                mapOf("value", "VERIFICATION_STATUS", "label", isEn ? "Verification Status" : "검증 상태"),
                mapOf("value", "RESULT_STATUS", "label", isEn ? "Result Status" : "산정 상태"),
                mapOf("value", "ATTACHMENT", "label", isEn ? "Attachment" : "첨부 문서"),
                mapOf("value", "SITE_METADATA", "label", isEn ? "Site Metadata" : "배출지 메타데이터"),
                mapOf("value", "CALCULATION_FORMULA", "label", isEn ? "Calculation Formula" : "산정식"),
                mapOf("value", "EMISSION_FACTOR", "label", isEn ? "Emission Factor" : "배출계수"),
                mapOf("value", "MONITORING_RULE", "label", isEn ? "Monitoring Rule" : "모니터링 규칙"));
    }

    private Map<String, Map<String, String>> buildEmissionDataHistoryChangeTargetMeta(boolean isEn) {
        Map<String, Map<String, String>> meta = new LinkedHashMap<>();
        meta.put("ACTIVITY_DATA", mapOf(
                "label", isEn ? "Activity Data" : "활동자료",
                "badgeClass", "bg-blue-100 text-blue-700"));
        meta.put("VERIFICATION_STATUS", mapOf(
                "label", isEn ? "Verification Status" : "검증 상태",
                "badgeClass", "bg-emerald-100 text-emerald-700"));
        meta.put("RESULT_STATUS", mapOf(
                "label", isEn ? "Result Status" : "산정 상태",
                "badgeClass", "bg-amber-100 text-amber-700"));
        meta.put("ATTACHMENT", mapOf(
                "label", isEn ? "Attachment" : "첨부 문서",
                "badgeClass", "bg-rose-100 text-rose-700"));
        meta.put("SITE_METADATA", mapOf(
                "label", isEn ? "Site Metadata" : "배출지 메타데이터",
                "badgeClass", "bg-slate-100 text-slate-700"));
        meta.put("CALCULATION_FORMULA", mapOf(
                "label", isEn ? "Calculation Formula" : "산정식",
                "badgeClass", "bg-slate-100 text-slate-700"));
        meta.put("EMISSION_FACTOR", mapOf(
                "label", isEn ? "Emission Factor" : "배출계수",
                "badgeClass", "bg-slate-100 text-slate-700"));
        meta.put("MONITORING_RULE", mapOf(
                "label", isEn ? "Monitoring Rule" : "모니터링 규칙",
                "badgeClass", "bg-slate-100 text-slate-700"));
        return meta;
    }

    private Map<String, String> emissionDataHistoryRow(String historyId,
                                                       String changedAt,
                                                       String projectName,
                                                       String siteName,
                                                       String changedBy,
                                                       String changeTypeCode,
                                                       String changeTypeLabel,
                                                       String changeTargetCode,
                                                       String changeTargetLabel,
                                                       String beforeValue,
                                                       String afterValue,
                                                       String detailUrl) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("historyId", historyId);
        row.put("changedAt", changedAt);
        row.put("projectName", projectName);
        row.put("siteName", siteName);
        row.put("changedBy", changedBy);
        row.put("changeTypeCode", changeTypeCode);
        row.put("changeTypeLabel", changeTypeLabel);
        row.put("changeTargetCode", changeTargetCode);
        row.put("changeTargetLabel", changeTargetLabel);
        row.put("beforeValue", beforeValue);
        row.put("afterValue", afterValue);
        row.put("detailUrl", detailUrl);
        return row;
    }

    private List<Map<String, String>> buildEmissionDataHistorySummaryCards(List<Map<String, String>> rows, boolean isEn) {
        return List.of(
                summaryCard(isEn ? "Filtered History" : "조회 이력 수",
                        String.valueOf(rows.size()),
                        isEn ? "Rows matching the current filter set." : "현재 필터 조건에 맞는 이력 건수입니다.",
                        "text-[var(--kr-gov-blue)]"),
                summaryCard(isEn ? "Corrections" : "정정",
                        String.valueOf(countEmissionHistoryByType(rows, "CORRECTION")),
                        isEn ? "Operator corrections reflected in activity or attached evidence." : "활동자료나 첨부 증빙에 반영된 정정 건수입니다.",
                        "text-amber-600",
                        "bg-amber-50"),
                summaryCard(isEn ? "Approvals" : "승인 반영",
                        String.valueOf(countEmissionHistoryByType(rows, "APPROVAL")),
                        isEn ? "Approval or review state changes reflected in the ledger." : "검토·승인 상태 변경이 반영된 건수입니다.",
                        "text-emerald-600",
                        "bg-emerald-50"),
                summaryCard(isEn ? "Schema Sync" : "스키마 동기화",
                        String.valueOf(countEmissionHistoryByType(rows, "SCHEMA")),
                        isEn ? "Metadata or rule sync updates applied to emission calculation." : "배출 산정에 반영된 메타데이터·규칙 동기화 건수입니다.",
                        "text-indigo-600",
                        "bg-indigo-50"));
    }

    private boolean matchesEmissionHistoryKeyword(Map<String, String> row, String keyword) {
        return safeString(row.get("historyId")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("projectName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("siteName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("changedBy")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("beforeValue")).toLowerCase(Locale.ROOT).contains(keyword)
                || safeString(row.get("afterValue")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private int countEmissionHistoryByType(List<Map<String, String>> rows, String changeTypeCode) {
        return (int) rows.stream()
                .filter(row -> changeTypeCode.equalsIgnoreCase(safeString(row.get("changeTypeCode"))))
                .count();
    }

    private Map<String, String> verificationQueueRow(EmissionResultSummaryView item, String priorityCode, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("resultId", safeString(item.getResultId()));
        row.put("projectName", safeString(item.getProjectName()));
        row.put("companyName", safeString(item.getCompanyName()));
        row.put("calculatedAt", safeString(item.getCalculatedAt()));
        row.put("totalEmission", safeString(item.getTotalEmission()));
        row.put("resultStatusCode", safeString(item.getResultStatusCode()));
        row.put("resultStatusLabel", safeString(item.getResultStatusLabel()));
        row.put("verificationStatusCode", safeString(item.getVerificationStatusCode()));
        row.put("verificationStatusLabel", safeString(item.getVerificationStatusLabel()));
        row.put("priorityCode", priorityCode);
        row.put("priorityLabel", verificationPriorityLabel(priorityCode, isEn));
        row.put("priorityReason", verificationPriorityReason(priorityCode, item, isEn));
        row.put("assignee", verificationAssignee(priorityCode, isEn));
        row.put("actionLabel", "FAILED".equalsIgnoreCase(safeString(item.getVerificationStatusCode()))
                ? (isEn ? "Re-review" : "재검토")
                : (isEn ? "Open result" : "결과 보기"));
        row.put("detailUrl", safeString(item.getDetailUrl()));
        return row;
    }

    private String deriveVerificationPriorityCode(EmissionResultSummaryView item) {
        String verificationCode = safeString(item.getVerificationStatusCode()).toUpperCase(Locale.ROOT);
        String resultCode = safeString(item.getResultStatusCode()).toUpperCase(Locale.ROOT);
        if ("FAILED".equals(verificationCode) || "REVIEW".equals(resultCode)) {
            return "HIGH";
        }
        if ("IN_PROGRESS".equals(verificationCode)) {
            return "MEDIUM";
        }
        return "NORMAL";
    }

    private String verificationPriorityLabel(String priorityCode, boolean isEn) {
        switch (safeString(priorityCode).toUpperCase(Locale.ROOT)) {
            case "HIGH":
                return isEn ? "High" : "높음";
            case "MEDIUM":
                return isEn ? "Medium" : "중간";
            default:
                return isEn ? "Normal" : "일반";
        }
    }

    private String verificationPriorityReason(String priorityCode, EmissionResultSummaryView item, boolean isEn) {
        String verificationCode = safeString(item.getVerificationStatusCode()).toUpperCase(Locale.ROOT);
        if ("FAILED".equals(verificationCode)) {
            return isEn ? "Failed verification or missing evidence requires escalation." : "검증 반려 또는 증빙 누락으로 상향 검토가 필요합니다.";
        }
        if ("IN_PROGRESS".equals(verificationCode)) {
            return isEn ? "Verifier review is underway and should be monitored." : "검증 담당자가 검토 중이므로 진행 상황을 추적해야 합니다.";
        }
        return isEn ? "Ready to assign a verifier and evidence checklist." : "검증 담당자와 증빙 체크리스트를 배정할 준비 상태입니다.";
    }

    private String verificationAssignee(String priorityCode, boolean isEn) {
        switch (safeString(priorityCode).toUpperCase(Locale.ROOT)) {
            case "HIGH":
                return isEn ? "Lead verifier" : "수석 검증자";
            case "MEDIUM":
                return isEn ? "Assigned verifier" : "담당 검증자";
            default:
                return isEn ? "Verification queue" : "검증 대기열";
        }
    }

    private Map<String, String> verificationLegendRow(String label, String description, String code) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("description", description);
        row.put("code", code);
        return row;
    }

    private Map<String, String> verificationPolicyRow(String title, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("description", description);
        return row;
    }

    private Map<String, String> backupProfileRow(String profileId, String profileName, String scheduledAt, String frequency, String retention, String status) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("profileId", profileId);
        row.put("profileName", profileName);
        row.put("scheduledAt", scheduledAt);
        row.put("frequency", frequency);
        row.put("retention", retention);
        row.put("status", status);
        return row;
    }

    private Map<String, String> backupStorageRow(String storageType, String location, String owner, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("storageType", storageType);
        row.put("location", location);
        row.put("owner", owner);
        row.put("note", note);
        return row;
    }

    private Map<String, String> backupExecutionRow(String executedAt, String profileName, String result, String duration, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("executedAt", executedAt);
        row.put("profileName", profileName);
        row.put("result", result);
        row.put("duration", duration);
        row.put("note", note);
        return row;
    }

    private Map<String, String> playbookRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private String urlQueryValue(String value) {
        if (value == null) {
            return "";
        }
        return value.replace(" ", "+");
    }

    private String buildAdminPath(boolean isEn, String path) {
        return isEn ? "/en/admin" + path : "/admin" + path;
    }

    private List<Map<String, String>> buildSecurityPolicyRows(boolean isEn) {
        return List.of(
                mapOf(
                        "policyId", "POL-001",
                        "targetUrl", "/signin/actionLogin",
                        "policyName", isEn ? "User login protection" : "사용자 로그인 보호",
                        "threshold", isEn ? "30 req/min per IP" : "IP당 분당 30회",
                        "burst", isEn ? "5 req / 10 sec" : "10초 5회 burst",
                        "action", isEn ? "Captcha -> 10 min block" : "CAPTCHA -> 10분 차단",
                        "status", "ACTIVE",
                        "updatedAt", "2026-03-12 08:20"),
                mapOf(
                        "policyId", "POL-002",
                        "targetUrl", "/admin/login/actionLogin",
                        "policyName", isEn ? "Admin login hardening" : "관리자 로그인 강화",
                        "threshold", isEn ? "10 req/min per IP" : "IP당 분당 10회",
                        "burst", isEn ? "3 req / 10 sec" : "10초 3회 burst",
                        "action", isEn ? "Immediate 30 min block" : "즉시 30분 차단",
                        "status", "ACTIVE",
                        "updatedAt", "2026-03-12 08:25"),
                mapOf(
                        "policyId", "POL-003",
                        "targetUrl", "/api/search/**",
                        "policyName", isEn ? "Search API throttle" : "검색 API 제어",
                        "threshold", isEn ? "120 req/min per token" : "토큰당 분당 120회",
                        "burst", isEn ? "20 req / 10 sec" : "10초 20회 burst",
                        "action", isEn ? "429 + alert" : "429 + 알림",
                        "status", "ACTIVE",
                        "updatedAt", "2026-03-11 18:10"));
    }

    private List<Map<String, String>> buildSecurityPolicyPlaybooks(boolean isEn) {
        return List.of(
                mapOf("title", isEn ? "Login attack playbook" : "로그인 공격 플레이북",
                        "body", isEn ? "Raise admin login threshold only after verifying WAF and captcha counters." : "WAF 및 CAPTCHA 지표 확인 후에만 관리자 로그인 임계치를 상향합니다."),
                mapOf("title", isEn ? "Search API degradation" : "검색 API 완화 전략",
                        "body", isEn ? "If 429 spikes persist for over 10 minutes, shift to token-based limits and cache prebuilt queries." : "429 급증이 10분 이상 지속되면 토큰 기준 제한과 캐시 응답으로 전환합니다."),
                mapOf("title", isEn ? "Emergency block release" : "긴급 차단 해제",
                        "body", isEn ? "Release only after verifying owner, CIDR, expiry time, and related gateway policy." : "소유 조직, CIDR, 만료 시각, 게이트웨이 정책 연동을 모두 확인한 뒤 해제합니다."));
    }

    private List<Map<String, String>> buildSecurityMonitoringTargets(boolean isEn) {
        return List.of(
                mapOf("url", "/admin/login/actionLogin", "rps", "88", "status", isEn ? "Escalated" : "경계", "rule", isEn ? "Admin login hardening" : "관리자 로그인 강화"),
                mapOf("url", "/signin/actionLogin", "rps", "240", "status", isEn ? "Protected" : "방어중", "rule", isEn ? "User login protection" : "사용자 로그인 보호"),
                mapOf("url", "/api/search/carbon-footprint", "rps", "510", "status", isEn ? "Throttled" : "제한중", "rule", isEn ? "Search API throttle" : "검색 API 제어"));
    }

    private List<Map<String, String>> buildSecurityMonitoringIps(boolean isEn) {
        return List.of(
                mapOf("ip", "198.51.100.42", "country", "US", "requestCount", "4,120", "action", isEn ? "Temp blocked" : "임시차단"),
                mapOf("ip", "203.0.113.78", "country", "KR", "requestCount", "2,844", "action", isEn ? "Captcha enforced" : "CAPTCHA 전환"),
                mapOf("ip", "45.67.22.91", "country", "DE", "requestCount", "2,337", "action", isEn ? "429 only" : "429 응답"));
    }

    private List<Map<String, String>> buildSecurityMonitoringEvents(boolean isEn) {
        return List.of(
                mapOf("detectedAt", "2026-03-12 09:18", "title", isEn ? "Burst login attack detected" : "로그인 버스트 공격 감지", "detail", isEn ? "Admin login burst exceeded threshold from 3 IPs." : "3개 IP에서 관리자 로그인 burst 임계치 초과", "severity", "HIGH"),
                mapOf("detectedAt", "2026-03-12 09:12", "title", isEn ? "Search API abuse pattern" : "검색 API 남용 패턴", "detail", isEn ? "Single token generated 429 for 6 consecutive minutes." : "단일 토큰에서 6분 연속 429 다발", "severity", "MEDIUM"));
    }

    private List<Map<String, String>> buildCertificateAuditLogRows(boolean isEn) {
        return List.of(
                mapOf(
                        "auditAt", "2026-03-30 14:25",
                        "requestId", "CERT-20260330-014",
                        "certificateNo", "KC-2026-44821",
                        "companyName", "한강에너지",
                        "companyId", "INSTT-110045",
                        "applicantName", "김지훈",
                        "applicantId", "jihun.kim",
                        "approverName", "박서연",
                        "auditType", isEn ? "Reissue after revocation" : "폐기 후 재발급",
                        "auditTypeCode", "REISSUE",
                        "certificateType", isEn ? "Emission certificate" : "배출 인증서",
                        "certificateTypeCode", "EMISSION",
                        "status", isEn ? "Approved" : "승인",
                        "statusCode", "APPROVED",
                        "riskLevel", isEn ? "High" : "높음",
                        "riskLevelCode", "HIGH",
                        "reason", isEn ? "Previous token was revoked after signer rotation." : "서명자 변경으로 기존 토큰 폐기 후 재발급"),
                mapOf(
                        "auditAt", "2026-03-30 10:40",
                        "requestId", "CERT-20260330-011",
                        "certificateNo", "KFTC-2026-99120",
                        "companyName", "그린포인트",
                        "companyId", "INSTT-220031",
                        "applicantName", "이수민",
                        "applicantId", "sumin.lee",
                        "approverName", "오승민",
                        "auditType", isEn ? "Issuance" : "신규 발급",
                        "auditTypeCode", "ISSUE",
                        "certificateType", isEn ? "Joint certificate" : "공동인증서",
                        "certificateTypeCode", "JOINT",
                        "status", isEn ? "Pending review" : "검토 대기",
                        "statusCode", "PENDING",
                        "riskLevel", isEn ? "Medium" : "보통",
                        "riskLevelCode", "MEDIUM",
                        "reason", isEn ? "Awaiting evidence file cross-check." : "증빙 파일 교차 점검 대기"),
                mapOf(
                        "auditAt", "2026-03-29 17:15",
                        "requestId", "CERT-20260329-027",
                        "certificateNo", "CC-2026-10294",
                        "companyName", "서해화학",
                        "companyId", "INSTT-130882",
                        "applicantName", "최민재",
                        "applicantId", "minjae.choi",
                        "approverName", "정해린",
                        "auditType", isEn ? "Renewal" : "갱신",
                        "auditTypeCode", "RENEW",
                        "certificateType", isEn ? "Cloud certificate" : "클라우드 인증서",
                        "certificateTypeCode", "CLOUD",
                        "status", isEn ? "Approved" : "승인",
                        "statusCode", "APPROVED",
                        "riskLevel", isEn ? "Low" : "낮음",
                        "riskLevelCode", "LOW",
                        "reason", isEn ? "Validity period extended after annual review." : "연간 점검 후 유효기간 연장"),
                mapOf(
                        "auditAt", "2026-03-29 11:08",
                        "requestId", "CERT-20260329-016",
                        "certificateNo", "KC-2026-44702",
                        "companyName", "동남스틸",
                        "companyId", "INSTT-140440",
                        "applicantName", "정가은",
                        "applicantId", "gaeun.jeong",
                        "approverName", "박서연",
                        "auditType", isEn ? "Revocation" : "폐기",
                        "auditTypeCode", "REVOKE",
                        "certificateType", isEn ? "Emission certificate" : "배출 인증서",
                        "certificateTypeCode", "EMISSION",
                        "status", isEn ? "Approved" : "승인",
                        "statusCode", "APPROVED",
                        "riskLevel", isEn ? "Medium" : "보통",
                        "riskLevelCode", "MEDIUM",
                        "reason", isEn ? "Compromised browser environment reported by the company." : "회원사 측 브라우저 환경 이상 신고"),
                mapOf(
                        "auditAt", "2026-03-28 18:44",
                        "requestId", "CERT-20260328-031",
                        "certificateNo", "JC-2026-55200",
                        "companyName", "한빛물산",
                        "companyId", "INSTT-180122",
                        "applicantName", "오하늘",
                        "applicantId", "haneul.oh",
                        "approverName", "오승민",
                        "auditType", isEn ? "Issuance" : "신규 발급",
                        "auditTypeCode", "ISSUE",
                        "certificateType", isEn ? "Joint certificate" : "공동인증서",
                        "certificateTypeCode", "JOINT",
                        "status", isEn ? "Rejected" : "반려",
                        "statusCode", "REJECTED",
                        "riskLevel", isEn ? "High" : "높음",
                        "riskLevelCode", "HIGH",
                        "reason", isEn ? "Registrant identity did not match the authority mapping." : "신청자 정보가 권한 맵핑과 불일치"),
                mapOf(
                        "auditAt", "2026-03-28 09:12",
                        "requestId", "CERT-20260328-007",
                        "certificateNo", "CC-2026-10210",
                        "companyName", "미래에코",
                        "companyId", "INSTT-200301",
                        "applicantName", "권도현",
                        "applicantId", "dohyun.kwon",
                        "approverName", "정해린",
                        "auditType", isEn ? "Renewal" : "갱신",
                        "auditTypeCode", "RENEW",
                        "certificateType", isEn ? "Cloud certificate" : "클라우드 인증서",
                        "certificateTypeCode", "CLOUD",
                        "status", isEn ? "Pending review" : "검토 대기",
                        "statusCode", "PENDING",
                        "riskLevel", isEn ? "Low" : "낮음",
                        "riskLevelCode", "LOW",
                        "reason", isEn ? "Auto-renewal scheduled after billing verification." : "정산 확인 후 자동 갱신 예정"),
                mapOf(
                        "auditAt", "2026-03-27 16:22",
                        "requestId", "CERT-20260327-022",
                        "certificateNo", "KC-2026-44651",
                        "companyName", "남부환경",
                        "companyId", "INSTT-170930",
                        "applicantName", "문서윤",
                        "applicantId", "seoyun.moon",
                        "approverName", "박서연",
                        "auditType", isEn ? "Reissue after department transfer" : "부서 이동 후 재발급",
                        "auditTypeCode", "REISSUE",
                        "certificateType", isEn ? "Emission certificate" : "배출 인증서",
                        "certificateTypeCode", "EMISSION",
                        "status", isEn ? "Approved" : "승인",
                        "statusCode", "APPROVED",
                        "riskLevel", isEn ? "Medium" : "보통",
                        "riskLevelCode", "MEDIUM",
                        "reason", isEn ? "Role transfer approved by both department managers." : "양 부서 관리자 승인 후 권한 이전"),
                mapOf(
                        "auditAt", "2026-03-26 13:05",
                        "requestId", "CERT-20260326-015",
                        "certificateNo", "JC-2026-55084",
                        "companyName", "북항리소스",
                        "companyId", "INSTT-190511",
                        "applicantName", "신유진",
                        "applicantId", "yujin.shin",
                        "approverName", "오승민",
                        "auditType", isEn ? "Revocation" : "폐기",
                        "auditTypeCode", "REVOKE",
                        "certificateType", isEn ? "Joint certificate" : "공동인증서",
                        "certificateTypeCode", "JOINT",
                        "status", isEn ? "Rejected" : "반려",
                        "statusCode", "REJECTED",
                        "riskLevel", isEn ? "High" : "높음",
                        "riskLevelCode", "HIGH",
                        "reason", isEn ? "Emergency revocation requested without incident ticket." : "장애 티켓 없이 긴급 폐기 요청 접수"));
    }

    private List<Map<String, String>> buildCertificateAuditAlerts(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> alerts = new ArrayList<>();
        long pendingHighRiskCount = rows.stream()
                .filter(row -> "PENDING".equals(safeString(row.get("statusCode"))))
                .filter(row -> "HIGH".equals(safeString(row.get("riskLevelCode"))))
                .count();
        if (pendingHighRiskCount > 0) {
            alerts.add(mapOf(
                    "title", isEn ? "High-risk requests still pending" : "고위험 요청이 아직 대기 중입니다",
                    "body", isEn ? "High-risk reissue or revocation requests should be closed with dual review before shift handoff."
                            : "고위험 재발급/폐기 요청은 근무 교대 전 이중 검토로 종결해야 합니다.",
                    "tone", "danger"));
        }
        long rejectedCount = rows.stream().filter(row -> "REJECTED".equals(safeString(row.get("statusCode")))).count();
        if (rejectedCount > 0) {
            alerts.add(mapOf(
                    "title", isEn ? "Rejected requests need follow-up" : "반려 건에 대한 후속 조치가 필요합니다",
                    "body", isEn ? "Check that the rejection reason was sent back to the applicant and the evidence gap is documented."
                            : "반려 사유가 신청자에게 전달되었는지, 증빙 보완 항목이 기록되었는지 확인하세요.",
                    "tone", "warning"));
        }
        if (alerts.isEmpty()) {
            alerts.add(mapOf(
                    "title", isEn ? "No immediate escalation" : "즉시 에스컬레이션 대상 없음",
                    "body", isEn ? "Current certificate audit events are within the standard review window."
                            : "현재 인증서 감사 이벤트는 표준 검토 시간 안에서 처리되고 있습니다.",
                    "tone", "neutral"));
        }
        return alerts;
    }

    private List<Map<String, String>> buildSettlementCalendarRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(settlementScheduleRow("SET-202604-001", "2026-04", isEn ? "March offset close" : "3월 상쇄 정산", isEn ? "Hanul Steel" : "한울제철",
                isEn ? "Lee Minji" : "이민지", "2026-04-01", "KRW 418,000,000", "PENDING", isEn ? "Pending" : "대기",
                "HIGH", isEn ? "High" : "높음", isEn ? "Counterparty evidence not signed" : "상대 기관 증빙 미서명"));
        rows.add(settlementScheduleRow("SET-202604-002", "2026-04", isEn ? "REC hedge settlement" : "REC 헤지 정산", isEn ? "Green Grid" : "그린그리드",
                isEn ? "Park Jiwon" : "박지원", "2026-04-01", "KRW 192,000,000", "READY", isEn ? "Ready" : "준비 완료",
                "MEDIUM", isEn ? "Medium" : "보통", isEn ? "Treasury confirmation pending" : "재무 확인 대기"));
        rows.add(settlementScheduleRow("SET-202604-003", "2026-04", isEn ? "Biochar partner payout" : "바이오차 파트너 정산", isEn ? "Eco Farm" : "에코팜",
                isEn ? "Choi Yuna" : "최유나", "2026-04-02", "KRW 87,500,000", "BLOCKED", isEn ? "Blocked" : "차단",
                "HIGH", isEn ? "High" : "높음", isEn ? "Tax invoice mismatch" : "세금계산서 금액 불일치"));
        rows.add(settlementScheduleRow("SET-202604-004", "2026-04", isEn ? "Balancing lot treasury release" : "밸런싱 물량 자금 집행", isEn ? "East Port" : "이스트포트",
                isEn ? "Han Jaeho" : "한재호", "2026-04-02", "KRW 522,400,000", "READY", isEn ? "Ready" : "준비 완료",
                "LOW", isEn ? "Low" : "낮음", isEn ? "Treasury batch assigned" : "재무 배치 편성 완료"));
        rows.add(settlementScheduleRow("SET-202604-005", "2026-04", isEn ? "Data center reserve settlement" : "데이터센터 예비물량 정산", isEn ? "Sun Network" : "선네트워크",
                isEn ? "Jeong Haein" : "정해인", "2026-04-03", "KRW 154,000,000", "PENDING", isEn ? "Pending" : "대기",
                "MEDIUM", isEn ? "Medium" : "보통", isEn ? "Operator note update required" : "운영 메모 보완 필요"));
        rows.add(settlementScheduleRow("SET-202604-006", "2026-04", isEn ? "Capture storage close" : "포집 저장 블록 정산", isEn ? "CCUS Plant A" : "CCUS 플랜트 A",
                isEn ? "Kim Sujin" : "김수진", "2026-04-03", "KRW 301,000,000", "COMPLETED", isEn ? "Completed" : "완료",
                "LOW", isEn ? "Low" : "낮음", isEn ? "Transferred to treasury archive" : "재무 이관 완료"));
        rows.add(settlementScheduleRow("SET-202604-007", "2026-04", isEn ? "Seasonal hedge settlement" : "계절성 헤지 정산", isEn ? "Nova Chemical" : "노바케미칼",
                isEn ? "Seo Dahye" : "서다혜", "2026-04-04", "KRW 333,600,000", "PENDING", isEn ? "Pending" : "대기",
                "MEDIUM", isEn ? "Medium" : "보통", isEn ? "Need buyer confirmation" : "매수 기관 확인 필요"));
        rows.add(settlementScheduleRow("SET-202604-008", "2026-04", isEn ? "Cold-chain settlement run" : "콜드체인 정산 실행", isEn ? "Wind Core" : "윈드코어",
                isEn ? "Yun Ara" : "윤아라", "2026-04-05", "KRW 71,000,000", "COMPLETED", isEn ? "Completed" : "완료",
                "LOW", isEn ? "Low" : "낮음", isEn ? "Month-end payout completed" : "월말 지급 완료"));
        rows.add(settlementScheduleRow("SET-202605-001", "2026-05", isEn ? "Afforestation offset close" : "조림 상쇄 정산", isEn ? "Forest Link" : "포레스트링크",
                isEn ? "Lee Minji" : "이민지", "2026-05-02", "KRW 126,000,000", "PENDING", isEn ? "Pending" : "대기",
                "MEDIUM", isEn ? "Medium" : "보통", isEn ? "Awaiting evidence bundle" : "증빙 묶음 수신 대기"));
        rows.add(settlementScheduleRow("SET-202605-002", "2026-05", isEn ? "Compliance fill settlement" : "의무량 보전 정산", isEn ? "River Cement" : "리버시멘트",
                isEn ? "Han Jaeho" : "한재호", "2026-05-03", "KRW 257,000,000", "READY", isEn ? "Ready" : "준비 완료",
                "LOW", isEn ? "Low" : "낮음", isEn ? "Queued for treasury handoff" : "재무 이관 대기열 편성"));
        rows.add(settlementScheduleRow("SET-202606-001", "2026-06", isEn ? "Heat network mix settlement" : "열공급 믹스 정산", isEn ? "North Solar" : "노스솔라",
                isEn ? "Park Jiwon" : "박지원", "2026-06-01", "KRW 59,400,000", "PENDING", isEn ? "Pending" : "대기",
                "LOW", isEn ? "Low" : "낮음", isEn ? "Next month open queue" : "차월 오픈 큐"));
        rows.add(settlementScheduleRow("SET-202606-002", "2026-06", isEn ? "Agriculture offset pool" : "농업 상쇄 풀 정산", isEn ? "Eco Farm" : "에코팜",
                isEn ? "Choi Yuna" : "최유나", "2026-06-02", "KRW 143,500,000", "BLOCKED", isEn ? "Blocked" : "차단",
                "HIGH", isEn ? "High" : "높음", isEn ? "Rejection memo not closed" : "반려 메모 미종결"));
        return rows;
    }

    private Map<String, String> settlementScheduleRow(
            String settlementId,
            String settlementMonth,
            String settlementTitle,
            String institutionName,
            String ownerName,
            String dueDate,
            String amount,
            String statusCode,
            String statusLabel,
            String riskLevelCode,
            String riskLevelLabel,
            String blockerReason) {
        return mapOf(
                "settlementId", settlementId,
                "settlementMonth", settlementMonth,
                "settlementTitle", settlementTitle,
                "institutionName", institutionName,
                "ownerName", ownerName,
                "dueDate", dueDate,
                "amount", amount,
                "statusCode", statusCode,
                "statusLabel", statusLabel,
                "riskLevelCode", riskLevelCode,
                "riskLevelLabel", riskLevelLabel,
                "blockerReason", blockerReason);
    }

    private List<Map<String, String>> buildSettlementCalendarDays(String selectedMonth, boolean isEn) {
        if ("2026-05".equals(selectedMonth)) {
            return List.of(
                    settlementCalendarDay("2026-05-02", isEn ? "Fri" : "금", "02", "6", "1", isEn ? "Lee Minji" : "이민지", "MEDIUM", isEn ? "Medium" : "보통",
                            isEn ? "Offset proof packet deadline" : "상쇄 증빙 패킷 마감"),
                    settlementCalendarDay("2026-05-03", isEn ? "Sat" : "토", "03", "4", "0", isEn ? "Han Jaeho" : "한재호", "LOW", isEn ? "Low" : "낮음",
                            isEn ? "Treasury handoff slots open" : "재무 이관 슬롯 오픈"));
        }
        if ("2026-06".equals(selectedMonth)) {
            return List.of(
                    settlementCalendarDay("2026-06-01", isEn ? "Mon" : "월", "01", "3", "0", isEn ? "Park Jiwon" : "박지원", "LOW", isEn ? "Low" : "낮음",
                            isEn ? "Open next-cycle settlement queue" : "차기 정산 큐 개시"),
                    settlementCalendarDay("2026-06-02", isEn ? "Tue" : "화", "02", "2", "1", isEn ? "Choi Yuna" : "최유나", "HIGH", isEn ? "High" : "높음",
                            isEn ? "Blocked memo needs closure" : "차단 메모 종결 필요"));
        }
        return List.of(
                settlementCalendarDay("2026-04-01", isEn ? "Wed" : "수", "01", "5", "1", isEn ? "Lee Minji" : "이민지", "HIGH", isEn ? "High" : "높음",
                        isEn ? "Daily close and counterparty confirmation overlap." : "일 마감과 상대 기관 확인 일정이 겹칩니다."),
                settlementCalendarDay("2026-04-02", isEn ? "Thu" : "목", "02", "4", "1", isEn ? "Han Jaeho" : "한재호", "MEDIUM", isEn ? "Medium" : "보통",
                        isEn ? "Tax invoice mismatch should be resolved before treasury release." : "재무 집행 전에 세금계산서 불일치를 정리해야 합니다."),
                settlementCalendarDay("2026-04-03", isEn ? "Fri" : "금", "03", "3", "0", isEn ? "Kim Sujin" : "김수진", "MEDIUM", isEn ? "Medium" : "보통",
                        isEn ? "15:00 treasury cut-off for ready schedules." : "준비 완료 건은 15시 재무 마감 전에 넘겨야 합니다."),
                settlementCalendarDay("2026-04-04", isEn ? "Sat" : "토", "04", "2", "0", isEn ? "Seo Dahye" : "서다혜", "LOW", isEn ? "Low" : "낮음",
                        isEn ? "Buyer confirmation follow-up window." : "매수 기관 확인 추적 구간입니다."),
                settlementCalendarDay("2026-04-05", isEn ? "Sun" : "일", "05", "1", "0", isEn ? "Yun Ara" : "윤아라", "LOW", isEn ? "Low" : "낮음",
                        isEn ? "Archive completed payouts and close notes." : "지급 완료 건 아카이브와 마감 메모 정리를 진행합니다."));
    }

    private Map<String, String> settlementCalendarDay(
            String date,
            String weekdayLabel,
            String dayLabel,
            String scheduledCount,
            String exceptionCount,
            String ownerName,
            String riskLevelCode,
            String riskLevelLabel,
            String focusNote) {
        return mapOf(
                "date", date,
                "weekdayLabel", weekdayLabel,
                "dayLabel", dayLabel,
                "scheduledCount", scheduledCount,
                "exceptionCount", exceptionCount,
                "ownerName", ownerName,
                "riskLevelCode", riskLevelCode,
                "riskLevelLabel", riskLevelLabel,
                "focusNote", focusNote);
    }

    private List<Map<String, String>> buildRefundListRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(refundRow("RFD-202603-031", isEn ? "Hanul Steel" : "한울제철", isEn ? "Kim Minseo" : "김민서",
                isEn ? "Card Refund" : "카드 취소", "Shinhan 123-45****-88", "KRW 1,280,000", "KRW 1,280,000",
                "2026-03-31 15:10", "RECEIVED", isEn ? "Received" : "접수", "HIGH", isEn ? "High" : "높음",
                isEn ? "Duplicate payment detected during invoice closing." : "세금계산서 마감 중 이중 결제가 확인되었습니다.",
                isEn ? "Verify duplicate transaction evidence" : "중복 결제 증빙 확인"));
        rows.add(refundRow("RFD-202603-030", isEn ? "Blue Energy" : "블루에너지", isEn ? "Park Jiwon" : "박지원",
                isEn ? "Bank Transfer" : "계좌 이체", "KB 991-20****-11", "KRW 860,000", "KRW 860,000",
                "2026-03-31 13:42", "ACCOUNT_REVIEW", isEn ? "Account Review" : "계좌 검수", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Refund account was changed after submission." : "신청 후 환불 계좌가 변경되었습니다.",
                isEn ? "Confirm account ownership" : "예금주 확인"));
        rows.add(refundRow("RFD-202603-029", isEn ? "Metro Heat" : "메트로히트", isEn ? "Lee Seojun" : "이서준",
                isEn ? "Card Refund" : "카드 취소", "Hyundai 883-10****-04", "KRW 540,000", "KRW 540,000",
                "2026-03-31 11:05", "IN_REVIEW", isEn ? "In Review" : "검토중", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Service package downgrade before activation." : "서비스 개시 전 상품 등급 하향 요청입니다.",
                isEn ? "Review downgrade effective date" : "등급 변경 적용일 검토"));
        rows.add(refundRow("RFD-202603-028", isEn ? "Green Grid" : "그린그리드", isEn ? "Choi Yena" : "최예나",
                isEn ? "Bank Transfer" : "계좌 이체", "NH 118-77****-90", "KRW 2,140,000", "KRW 1,920,000",
                "2026-03-30 17:26", "APPROVED", isEn ? "Approved" : "승인", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Partial refund after monthly settlement offset." : "월 정산 상계 후 부분 환불 승인 건입니다.",
                isEn ? "Queue next transfer batch" : "다음 이체 배치 편성"));
        rows.add(refundRow("RFD-202603-027", isEn ? "River Cement" : "리버시멘트", isEn ? "Han Jaeho" : "한재호",
                isEn ? "Bank Transfer" : "계좌 이체", "Woori 227-00****-53", "KRW 3,400,000", "KRW 3,400,000",
                "2026-03-30 15:11", "TRANSFER_SCHEDULED", isEn ? "Transfer Scheduled" : "이체 예정", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Approved full refund awaiting treasury batch." : "전액 환불 승인 후 자금 배치 대기 중입니다.",
                isEn ? "Monitor transfer completion" : "이체 완료 모니터링"));
        rows.add(refundRow("RFD-202603-026", isEn ? "Sun Network" : "선네트워크", isEn ? "Jeong Haein" : "정해인",
                isEn ? "Card Refund" : "카드 취소", "Samsung 771-30****-61", "KRW 420,000", "KRW 420,000",
                "2026-03-29 18:08", "COMPLETED", isEn ? "Completed" : "처리 완료", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Cancellation completed with card acquirer." : "카드 매입사 취소 처리가 완료되었습니다.",
                isEn ? "Complete" : "완료"));
        rows.add(refundRow("RFD-202603-025", isEn ? "Carbon Labs" : "카본랩스", isEn ? "Yun Ara" : "윤아라",
                isEn ? "Bank Transfer" : "계좌 이체", "IBK 004-18****-32", "KRW 1,100,000", "KRW 0",
                "2026-03-29 12:14", "REJECTED", isEn ? "Rejected" : "반려", "HIGH", isEn ? "High" : "높음",
                isEn ? "Requested period already consumed by issued certificate." : "발급 완료된 인증서 사용 기간과 중복되어 반려되었습니다.",
                isEn ? "Notify rejection reason" : "반려 사유 안내"));
        rows.add(refundRow("RFD-202603-024", isEn ? "Seoul Mobility" : "서울모빌리티", isEn ? "Kang Doyun" : "강도윤",
                isEn ? "Bank Transfer" : "계좌 이체", "KakaoBank 333-22****-71", "KRW 780,000", "KRW 780,000",
                "2026-03-28 10:22", "IN_REVIEW", isEn ? "In Review" : "검토중", "MEDIUM", isEn ? "Medium" : "보통",
                isEn ? "Support escalation attached for service outage credit." : "서비스 장애 보상 사유로 고객지원 이관 메모가 첨부되었습니다.",
                isEn ? "Validate outage compensation rule" : "장애 보상 기준 확인"));
        rows.add(refundRow("RFD-202603-023", isEn ? "Nova Chemical" : "노바케미칼", isEn ? "Seo Dahye" : "서다혜",
                isEn ? "Card Refund" : "카드 취소", "Lotte 441-90****-15", "KRW 690,000", "KRW 690,000",
                "2026-03-27 16:35", "TRANSFER_SCHEDULED", isEn ? "Transfer Scheduled" : "이체 예정", "LOW", isEn ? "Low" : "낮음",
                isEn ? "Treasury approved same-week refund batch." : "재무팀이 주간 환불 배치를 승인했습니다.",
                isEn ? "Await batch completion" : "배치 완료 대기"));
        return rows;
    }

    private Map<String, String> refundRow(
            String refundId,
            String companyName,
            String applicantName,
            String paymentMethodLabel,
            String accountMasked,
            String requestedAmount,
            String refundableAmount,
            String requestedAt,
            String statusCode,
            String statusLabel,
            String riskLevelCode,
            String riskLevelLabel,
            String reasonSummary,
            String nextActionLabel) {
        return mapOf(
                "refundId", refundId,
                "companyName", companyName,
                "applicantName", applicantName,
                "paymentMethodLabel", paymentMethodLabel,
                "accountMasked", accountMasked,
                "requestedAmount", requestedAmount,
                "refundableAmount", refundableAmount,
                "requestedAt", requestedAt,
                "statusCode", statusCode,
                "statusLabel", statusLabel,
                "riskLevelCode", riskLevelCode,
                "riskLevelLabel", riskLevelLabel,
                "reasonSummary", reasonSummary,
                "nextActionLabel", nextActionLabel);
    }

    private Map<String, String> option(String code, String label) {
        return mapOf("code", code, "label", label);
    }

    private Map<String, String> mapOf(String... values) {
        Map<String, String> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(values[index], values[index + 1]);
        }
        return row;
    }

    private List<Map<String, String>> filterAndSortSecurityAuditRows(
            List<Map<String, String>> rows,
            String searchKeyword,
            String actionType,
            String routeGroup,
            String sortKey,
            String sortDirection) {
        List<Map<String, String>> filtered = new ArrayList<>();
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        for (Map<String, String> row : rows) {
            if (!matchesSecurityAuditActionType(row, actionType)) {
                continue;
            }
            if (!matchesSecurityAuditRouteGroup(row, routeGroup)) {
                continue;
            }
            if (!normalizedKeyword.isEmpty() && !matchesSecurityAuditKeyword(row, normalizedKeyword)) {
                continue;
            }
            filtered.add(new LinkedHashMap<>(row));
        }
        Comparator<Map<String, String>> comparator = securityAuditComparator(sortKey);
        filtered.sort("ASC".equals(sortDirection) ? comparator : comparator.reversed());
        return filtered;
    }

    private Comparator<Map<String, String>> securityAuditComparator(String sortKey) {
        switch (sortKey) {
            case "ACTOR":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> extractSecurityAuditActorId(safeString(row.get("actor"))),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "ACTION":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("action")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "TARGET":
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("target")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("auditAt")), String.CASE_INSENSITIVE_ORDER);
            case "AUDIT_AT":
            default:
                return Comparator.<Map<String, String>, String>comparing(
                                row -> safeString(row.get("auditAt")),
                                String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(row -> safeString(row.get("target")), String.CASE_INSENSITIVE_ORDER);
        }
    }

    private boolean matchesSecurityAuditKeyword(Map<String, String> row, String normalizedKeyword) {
        String actor = safeString(row.get("actor"));
        return actor.toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("target")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("detail")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("action")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || extractSecurityAuditActorId(actor).toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private boolean matchesSecurityAuditActionType(Map<String, String> row, String actionType) {
        if ("ALL".equals(actionType)) {
            return true;
        }
        if ("BLOCKED".equals(actionType)) {
            return isBlockedSecurityAuditRow(row);
        }
        if ("ALLOWED".equals(actionType)) {
            return isAllowedSecurityAuditRow(row);
        }
        return !isBlockedSecurityAuditRow(row) && !isAllowedSecurityAuditRow(row);
    }

    private boolean matchesSecurityAuditRouteGroup(Map<String, String> row, String routeGroup) {
        if ("ALL".equals(routeGroup)) {
            return true;
        }
        String target = safeString(row.get("target")).toLowerCase(Locale.ROOT);
        if ("BLOCK".equals(routeGroup)) {
            return target.contains("block") || target.contains("deny");
        }
        if ("POLICY".equals(routeGroup)) {
            return target.contains("policy");
        }
        return true;
    }

    private boolean isBlockedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("차단") || action.contains("blocked");
    }

    private boolean isAllowedSecurityAuditRow(Map<String, String> row) {
        String action = safeString(row.get("action")).toLowerCase(Locale.ROOT);
        return action.contains("허용") || action.contains("allowed");
    }

    private boolean isSecurityAuditErrorRow(Map<String, String> row) {
        try {
            return Integer.parseInt(safeString(row.get("responseStatus"))) >= 400 || !safeString(row.get("errorMessage")).isEmpty();
        } catch (NumberFormatException ignored) {
            return !safeString(row.get("errorMessage")).isEmpty();
        }
    }

    private boolean isSecurityAuditSlowRow(Map<String, String> row) {
        try {
            return Long.parseLong(safeString(row.get("durationMs"))) >= 1000L;
        } catch (NumberFormatException ignored) {
            return false;
        }
    }

    private long countRepeatedSecurityAuditValues(
            List<Map<String, String>> rows,
            Function<Map<String, String>, String> extractor) {
        return rows.stream()
                .map(extractor)
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .values()
                .stream()
                .filter(count -> count > 1)
                .count();
    }

    private List<Map<String, String>> buildRepeatedSecurityAuditRows(
            List<Map<String, String>> rows,
            Function<Map<String, String>, String> extractor,
            String label) {
        return rows.stream()
                .map(extractor)
                .map(this::safeString)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.groupingBy(Function.identity(), LinkedHashMap::new, Collectors.counting()))
                .entrySet()
                .stream()
                .filter(entry -> entry.getValue() > 1)
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                        .thenComparing(Map.Entry.comparingByKey(String.CASE_INSENSITIVE_ORDER)))
                .limit(5)
                .map(entry -> mapOf(
                        "label", label,
                        "value", entry.getKey(),
                        "count", String.valueOf(entry.getValue())))
                .collect(Collectors.toList());
    }

    private String extractSecurityAuditActorId(String actor) {
        String normalized = safeString(actor);
        int slashIndex = normalized.indexOf(" / ");
        if (slashIndex >= 0) {
            normalized = normalized.substring(0, slashIndex);
        }
        int typeStart = normalized.indexOf("(");
        if (typeStart >= 0) {
            normalized = normalized.substring(0, typeStart);
        }
        return normalized.trim();
    }

    private String normalizeSecurityAuditActionType(String actionType) {
        String normalized = safeString(actionType).toUpperCase(Locale.ROOT);
        if ("BLOCKED".equals(normalized) || "ALLOWED".equals(normalized) || "REVIEWED".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeSecurityAuditRouteGroup(String routeGroup) {
        String normalized = safeString(routeGroup).toUpperCase(Locale.ROOT);
        if ("BLOCK".equals(normalized) || "POLICY".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeSecurityAuditSortKey(String sortKey) {
        String normalized = safeString(sortKey).toUpperCase(Locale.ROOT);
        if ("ACTOR".equals(normalized) || "ACTION".equals(normalized) || "TARGET".equals(normalized)) {
            return normalized;
        }
        return "AUDIT_AT";
    }

    private String normalizeSecurityAuditSortDirection(String sortDirection) {
        return "ASC".equals(safeString(sortDirection).toUpperCase(Locale.ROOT)) ? "ASC" : "DESC";
    }

    private List<Map<String, String>> filterCertificateAuditLogRows(
            List<Map<String, String>> rows,
            String searchKeyword,
            String auditType,
            String status,
            String certificateType,
            String startDate,
            String endDate) {
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : rows) {
            if (!"ALL".equals(auditType) && !auditType.equals(safeString(row.get("auditTypeCode")))) {
                continue;
            }
            if (!"ALL".equals(status) && !status.equals(safeString(row.get("statusCode")))) {
                continue;
            }
            if (!"ALL".equals(certificateType) && !certificateType.equals(safeString(row.get("certificateTypeCode")))) {
                continue;
            }
            String auditDate = safeString(row.get("auditAt"));
            String auditDateOnly = auditDate.length() >= 10 ? auditDate.substring(0, 10) : auditDate;
            if (!startDate.isEmpty() && auditDateOnly.compareTo(startDate) < 0) {
                continue;
            }
            if (!endDate.isEmpty() && auditDateOnly.compareTo(endDate) > 0) {
                continue;
            }
            if (!normalizedKeyword.isEmpty() && !matchesCertificateAuditKeyword(row, normalizedKeyword)) {
                continue;
            }
            filtered.add(new LinkedHashMap<>(row));
        }
        filtered.sort(Comparator.<Map<String, String>, String>comparing(row -> safeString(row.get("auditAt"))).reversed());
        return filtered;
    }

    private boolean matchesCertificateAuditKeyword(Map<String, String> row, String normalizedKeyword) {
        return safeString(row.get("requestId")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("certificateNo")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("companyName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("companyId")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("applicantName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("applicantId")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("approverName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(row.get("reason")).toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private String normalizeCertificateAuditType(String auditType) {
        String normalized = safeString(auditType).toUpperCase(Locale.ROOT);
        if ("ISSUE".equals(normalized) || "REISSUE".equals(normalized) || "RENEW".equals(normalized) || "REVOKE".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeCertificateAuditStatus(String status) {
        String normalized = safeString(status).toUpperCase(Locale.ROOT);
        if ("PENDING".equals(normalized) || "APPROVED".equals(normalized) || "REJECTED".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeCertificateAuditCertificateType(String certificateType) {
        String normalized = safeString(certificateType).toUpperCase(Locale.ROOT);
        if ("EMISSION".equals(normalized) || "JOINT".equals(normalized) || "CLOUD".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private String normalizeCertificateAuditDate(String date) {
        String normalized = safeString(date);
        return normalized.matches("\\d{4}-\\d{2}-\\d{2}") ? normalized : "";
    }

    private List<Map<String, Object>> buildCertificateRecCheckGroups() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(mapOfObjects(
                "id", "REC-DUP-240330-01",
                "recNo", "REC-2026-001248",
                "projectName", "여수 바이오매스 열병합",
                "companyName", "한빛에너지",
                "issuanceWindow", "2026-03-01 ~ 2026-03-15",
                "duplicateCount", 3,
                "riskScore", 98,
                "matchBasis", "SERIAL",
                "status", "BLOCKED",
                "lastCheckedAt", "2026-03-30 09:15",
                "actionOwner", "운영1팀 김주임",
                "reason", mapOfObjects(
                        "ko", "동일 REC 번호가 발급 검토 2건과 이의신청 반영 1건에 동시에 연결되었습니다.",
                        "en", "The same REC number is attached to two review cases and one objection reflection case."
                ),
                "comparedCertificates", List.of(
                        mapOfObjects("certificateId", "CERT-REVIEW-0912", "companyName", "한빛에너지", "status", "BLOCKED"),
                        mapOfObjects("certificateId", "CERT-OBJ-0311", "companyName", "한빛에너지", "status", "PENDING"),
                        mapOfObjects("certificateId", "CERT-REVIEW-0840", "companyName", "동해그린파워", "status", "PENDING")
                )));
        rows.add(mapOfObjects(
                "id", "REC-DUP-240330-02",
                "recNo", "REC-2026-001091",
                "projectName", "포항 수소환원 제철",
                "companyName", "에코스틸",
                "issuanceWindow", "2026-02-21 ~ 2026-03-04",
                "duplicateCount", 2,
                "riskScore", 84,
                "matchBasis", "REGISTRY",
                "status", "REVIEW",
                "lastCheckedAt", "2026-03-30 08:42",
                "actionOwner", "심사팀 박대리",
                "reason", mapOfObjects(
                        "ko", "등록원장 기준 감축량 합계는 같지만 서로 다른 신청번호로 재검토 요청이 접수되었습니다.",
                        "en", "The registry reduction total matches, but two different application numbers were submitted for re-review."
                ),
                "comparedCertificates", List.of(
                        mapOfObjects("certificateId", "CERT-REVIEW-0868", "companyName", "에코스틸", "status", "PENDING"),
                        mapOfObjects("certificateId", "CERT-REISSUE-0023", "companyName", "에코스틸", "status", "ELIGIBLE")
                )));
        rows.add(mapOfObjects(
                "id", "REC-DUP-240330-03",
                "recNo", "REC-2026-000774",
                "projectName", "서남권 해상풍력 연계",
                "companyName", "그린웨이브",
                "issuanceWindow", "2026-01-10 ~ 2026-01-31",
                "duplicateCount", 2,
                "riskScore", 41,
                "matchBasis", "PERIOD",
                "status", "CLEARED",
                "lastCheckedAt", "2026-03-29 18:10",
                "actionOwner", "심사팀 오과장",
                "reason", mapOfObjects(
                        "ko", "동일 기간으로 보였으나 모니터링 보고서 버전 정정으로 실제 발급 구간이 분리되었습니다.",
                        "en", "The periods initially looked identical, but a monitoring report revision separated the actual issuance windows."
                ),
                "comparedCertificates", List.of(
                        mapOfObjects("certificateId", "CERT-REVIEW-0741", "companyName", "그린웨이브", "status", "ELIGIBLE"),
                        mapOfObjects("certificateId", "CERT-REISSUE-0018", "companyName", "그린웨이브", "status", "ELIGIBLE")
                )));
        return rows;
    }

    private List<MenuInfoDTO> loadMenuTreeRows(String codeId) {
        try {
            List<MenuInfoDTO> rows = new ArrayList<>(menuInfoReadPort.selectMenuTreeList(codeId));
            rows.sort(Comparator.comparing(row -> safeString(row == null ? null : row.getCode())));
            return rows;
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private MenuInfoDTO findMenuRow(List<MenuInfoDTO> menuRows, String menuCode) {
        String normalizedMenuCode = safeString(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedMenuCode.isEmpty()) {
            return null;
        }
        for (MenuInfoDTO row : menuRows) {
            if (normalizedMenuCode.equalsIgnoreCase(safeString(row == null ? null : row.getCode()))) {
                return row;
            }
        }
        return null;
    }

    private List<Map<String, Object>> buildMenuAncestry(List<MenuInfoDTO> menuRows, String menuCode, boolean isEn) {
        String normalizedMenuCode = safeString(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedMenuCode.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> ancestryCodes = new ArrayList<>();
        if (normalizedMenuCode.length() >= 4) {
            ancestryCodes.add(normalizedMenuCode.substring(0, 4));
        }
        if (normalizedMenuCode.length() >= 6) {
            ancestryCodes.add(normalizedMenuCode.substring(0, 6));
        }
        if (normalizedMenuCode.length() >= 8) {
            ancestryCodes.add(normalizedMenuCode.substring(0, 8));
        }
        List<Map<String, Object>> ancestry = new ArrayList<>();
        for (String code : ancestryCodes) {
            MenuInfoDTO row = findMenuRow(menuRows, code);
            if (row == null) {
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", safeString(row.getCode()));
            item.put("label", isEn ? firstNonBlank(row.getCodeDc(), row.getCodeNm(), row.getCode()) : firstNonBlank(row.getCodeNm(), row.getCodeDc(), row.getCode()));
            item.put("labelKo", firstNonBlank(row.getCodeNm(), row.getCodeDc(), row.getCode()));
            item.put("labelEn", firstNonBlank(row.getCodeDc(), row.getCodeNm(), row.getCode()));
            item.put("menuUrl", safeString(row.getMenuUrl()));
            item.put("menuIcon", safeString(row.getMenuIcon()));
            item.put("sortOrdr", row.getSortOrdr());
            ancestry.add(item);
        }
        return ancestry;
    }

    private List<Map<String, String>> buildNewPageGovernanceNotes(boolean isEn,
                                                                  String requiredViewFeatureCode,
                                                                  Map<String, Object> manifest,
                                                                  List<String> featureCodes) {
        List<Map<String, String>> notes = new ArrayList<>();
        notes.add(governanceNote(
                isEn ? "Route contract" : "라우트 계약",
                isEn
                        ? "The route is bootstrap-ready and uses the same page-data contract on first render and follow-up fetch."
                        : "이 경로는 bootstrap-ready 상태이며 첫 렌더와 후속 fetch에서 같은 page-data 계약을 사용합니다."));
        notes.add(governanceNote(
                isEn ? "Authority baseline" : "권한 기준선",
                isEn
                        ? "Required VIEW feature: " + firstNonBlank(requiredViewFeatureCode, "unresolved")
                        : "필수 VIEW 기능: " + firstNonBlank(requiredViewFeatureCode, "미해결")));
        notes.add(governanceNote(
                isEn ? "Manifest coverage" : "매니페스트 범위",
                isEn
                        ? "UI manifest component count: " + stringValue(manifest == null ? null : manifest.get("componentCount"))
                        : "UI 매니페스트 컴포넌트 수: " + stringValue(manifest == null ? null : manifest.get("componentCount"))));
        notes.add(governanceNote(
                isEn ? "Feature scope" : "기능 범위",
                isEn
                        ? "Linked feature count: " + featureCodes.size()
                        : "연결 기능 수: " + featureCodes.size()));
        return notes;
    }

    private List<Map<String, Object>> buildNewPageRoleAssignments(String requiredViewFeatureCode, boolean isEn) {
        String normalizedFeatureCode = safeString(requiredViewFeatureCode).toUpperCase(Locale.ROOT);
        if (normalizedFeatureCode.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (AuthorInfoVO author : authGroupManageService.selectAuthorList()) {
                String authorCode = safeString(author == null ? null : author.getAuthorCode()).toUpperCase(Locale.ROOT);
                if (authorCode.isEmpty()) {
                    continue;
                }
                boolean assigned = authGroupManageService.hasAuthorFeaturePermission(authorCode, normalizedFeatureCode);
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("authorCode", authorCode);
                row.put("authorName", safeString(author == null ? null : author.getAuthorNm()));
                row.put("authorDescription", safeString(author == null ? null : author.getAuthorDc()));
                row.put("assigned", assigned);
                row.put("statusLabel", assigned ? (isEn ? "Granted" : "부여됨") : (isEn ? "Not granted" : "미부여"));
                row.put("statusTone", assigned ? "healthy" : "warning");
                rows.add(row);
            }
            rows.sort((left, right) -> {
                boolean leftAssigned = Boolean.TRUE.equals(left.get("assigned"));
                boolean rightAssigned = Boolean.TRUE.equals(right.get("assigned"));
                if (leftAssigned != rightAssigned) {
                    return leftAssigned ? -1 : 1;
                }
                return safeString(String.valueOf(left.get("authorCode"))).compareTo(safeString(String.valueOf(right.get("authorCode"))));
            });
            return rows;
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private Map<String, String> governanceNote(String title, String description) {
        Map<String, String> note = new LinkedHashMap<>();
        note.put("title", title);
        note.put("description", description);
        return note;
    }

    private String firstNonBlank(String... candidates) {
        if (candidates == null) {
            return "";
        }
        for (String candidate : candidates) {
            String normalized = safeString(candidate);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private int parseInt(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(stringValue(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Map<String, Object> mapOfObjects(Object... values) {
        Map<String, Object> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            row.put(String.valueOf(values[index]), values[index + 1]);
        }
        return row;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
