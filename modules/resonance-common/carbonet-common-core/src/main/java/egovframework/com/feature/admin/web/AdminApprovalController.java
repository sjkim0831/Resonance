package egovframework.com.feature.admin.web;

import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.platform.codex.service.AdminApprovalPagePayloadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminApprovalController {

    private final AdminApprovalPagePayloadService adminApprovalPagePayloadService;
    private final AdminApprovalCommandService adminApprovalCommandService;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = "/member/approve", method = RequestMethod.GET)
    public String memberApprovePage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "member-approve");
    }

    @GetMapping("/api/admin/member/approve/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberApprovePageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = adminApprovalPagePayloadService.buildMemberApprovePagePayload(
                pageIndexParam,
                searchKeyword,
                membershipType,
                sbscrbSttus,
                result,
                request,
                locale);
        boolean canManage = Boolean.TRUE.equals(response.get("canViewMemberApprove"));
        return canManage ? ResponseEntity.ok(response) : ResponseEntity.status(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN).body(response);
    }

    @RequestMapping(value = "/member/company-approve", method = RequestMethod.GET)
    public String companyApprovePage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "company-approve");
    }

    @GetMapping("/api/admin/member/company-approve/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyApprovePageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = adminApprovalPagePayloadService.buildCompanyApprovePagePayload(
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                result,
                request,
                locale);
        boolean canManage = Boolean.TRUE.equals(response.get("canViewCompanyApprove"));
        return canManage ? ResponseEntity.ok(response) : ResponseEntity.status(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN).body(response);
    }

    @RequestMapping(value = "/certificate/approve", method = RequestMethod.GET)
    public String certificateApprovePage(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "requestType", required = false) String requestType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "certificate-approve");
    }

    @GetMapping("/api/admin/certificate/approve/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateApprovePageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "requestType", required = false) String requestType,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "result", required = false) String result,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = adminApprovalPagePayloadService.buildCertificateApprovePagePayload(
                pageIndexParam,
                searchKeyword,
                requestType,
                status,
                result,
                request,
                locale);
        boolean canManage = Boolean.TRUE.equals(response.get("canViewCertificateApprove"));
        return canManage ? ResponseEntity.ok(response) : ResponseEntity.status(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN).body(response);
    }

    @RequestMapping(value = "/certificate/pending_list", method = RequestMethod.GET)
    public String certificatePendingPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "certificate-pending");
    }

    @RequestMapping(value = "/payment/virtual_issue", method = RequestMethod.GET)
    public String refundAccountReviewPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "virtual-issue");
    }

    @RequestMapping(value = "/certificate/objection_list", method = RequestMethod.GET)
    public String certificateObjectionListPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "certificate-objection-list");
    }

    @RequestMapping(value = "/certificate/review", method = RequestMethod.GET)
    public String certificateReviewPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "certificate-review");
    }

    @RequestMapping(value = "/certificate/statistics", method = RequestMethod.GET)
    public String certificateStatisticsPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "certificate-statistics");
    }

    @RequestMapping(value = "/payment/refund_process", method = RequestMethod.GET)
    public String refundProcessPage(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "refund-process");
    }

    @GetMapping("/certificate/statistics/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateStatisticsPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "periodFilter", required = false) String periodFilter,
            @RequestParam(value = "certificateType", required = false) String certificateType,
            @RequestParam(value = "issuanceStatus", required = false) String issuanceStatus,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(new LinkedHashMap<>(adminShellBootstrapPageService.buildCertificateStatisticsPageData(
                pageIndexParam,
                searchKeyword,
                periodFilter,
                certificateType,
                issuanceStatus,
                adminReactRouteSupport.isEnglishRequest(request, locale))));
    }

    @GetMapping("/certificate/pending_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificatePendingPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "certificateType", required = false) String certificateType,
            @RequestParam(value = "processStatus", required = false) String processStatus,
            @RequestParam(value = "applicationId", required = false) String applicationId,
            @RequestParam(value = "insttId", required = false) String insttId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = 5;
        Locale searchLocale = locale == null ? Locale.KOREAN : locale;
        String normalizedKeyword = safe(searchKeyword).toLowerCase(searchLocale);
        String normalizedType = safe(certificateType).toUpperCase(Locale.ROOT);
        String normalizedStatus = safe(processStatus).toUpperCase(Locale.ROOT);
        String requestedApplicationId = safe(applicationId);
        String requestedInsttId = safe(insttId);

        List<Map<String, Object>> sourceRows = buildCertificatePendingRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        Map<String, Object> focusedInstitutionRow = null;
        for (Map<String, Object> row : sourceRows) {
            String rowType = safe((String) row.get("certificateType"));
            String rowStatus = safe((String) row.get("processStatus"));
            if (!normalizedType.isEmpty() && !normalizedType.equalsIgnoreCase(rowType)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(rowStatus)) {
                continue;
            }
            String rowApplicationId = safe((String) row.get("applicationId"));
            if (!requestedApplicationId.isEmpty() && !requestedApplicationId.equalsIgnoreCase(rowApplicationId)) {
                continue;
            }
            String rowInsttId = safe((String) row.get("insttId"));
            if (!requestedInsttId.isEmpty() && !requestedInsttId.equalsIgnoreCase(rowInsttId)) {
                continue;
            }
            String searchable = String.join(" ",
                    rowApplicationId,
                    safe((String) row.get("companyName")),
                    safe((String) row.get("companyNameEn")),
                    rowInsttId,
                    safe((String) row.get("insttName")),
                    safe((String) row.get("insttNameEn")),
                    safe((String) row.get("siteName")),
                    safe((String) row.get("siteNameEn")),
                    safe((String) row.get("reviewerName")),
                    safe((String) row.get("reviewerNameEn")));
            if (!normalizedKeyword.isEmpty() && !searchable.toLowerCase(searchLocale).contains(normalizedKeyword)) {
                continue;
            }
            if (focusedInstitutionRow == null && !requestedInsttId.isEmpty()) {
                focusedInstitutionRow = row;
            }
            filtered.add(row);
        }

        int totalCount = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) pageSize));
        int safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
        int fromIndex = Math.min((safePageIndex - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pageIndex", safePageIndex);
        body.put("totalPages", totalPages);
        body.put("totalCount", totalCount);
        body.put("searchKeyword", safe(searchKeyword));
        body.put("certificateType", safe(certificateType));
        body.put("processStatus", normalizedStatus.isEmpty() ? "PENDING" : normalizedStatus);
        body.put("applicationId", requestedApplicationId);
        body.put("insttId", requestedInsttId);
        body.put("selectedApplicationId", requestedApplicationId);
        body.put("selectedInsttId", requestedInsttId);
        body.put("selectedInsttName", focusedInstitutionRow == null ? "" : safe((String) focusedInstitutionRow.get("insttName")));
        body.put("selectedInsttNameEn", focusedInstitutionRow == null ? "" : safe((String) focusedInstitutionRow.get("insttNameEn")));
        body.put("canViewCertificatePending", true);
        body.put("isEn", isEn);
        body.put("certificatePendingRows", filtered.subList(fromIndex, toIndex));
        body.put("certificatePendingSummary", buildCertificatePendingSummary(sourceRows));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/payment/virtual_issue/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> refundAccountReviewPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "verificationStatus", required = false) String verificationStatus,
            @RequestParam(value = "payoutStatus", required = false) String payoutStatus,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = 5;
        Locale searchLocale = locale == null ? Locale.KOREAN : locale;
        String normalizedKeyword = safe(searchKeyword).toLowerCase(searchLocale);
        String normalizedVerificationStatus = safe(verificationStatus).toUpperCase(Locale.ROOT);
        String normalizedPayoutStatus = safe(payoutStatus).toUpperCase(Locale.ROOT);

        List<Map<String, Object>> sourceRows = buildRefundAccountReviewRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> row : sourceRows) {
            String rowVerificationStatus = safe((String) row.get("verificationStatus"));
            String rowPayoutStatus = safe((String) row.get("payoutStatus"));
            if (!normalizedVerificationStatus.isEmpty()
                    && !"ALL".equalsIgnoreCase(normalizedVerificationStatus)
                    && !normalizedVerificationStatus.equalsIgnoreCase(rowVerificationStatus)) {
                continue;
            }
            if (!normalizedPayoutStatus.isEmpty()
                    && !"ALL".equalsIgnoreCase(normalizedPayoutStatus)
                    && !normalizedPayoutStatus.equalsIgnoreCase(rowPayoutStatus)) {
                continue;
            }
            String searchable = String.join(" ",
                    safe((String) row.get("requestId")),
                    safe((String) row.get("companyName")),
                    safe((String) row.get("companyNameEn")),
                    safe((String) row.get("refundRequestId")),
                    safe((String) row.get("bankName")),
                    safe((String) row.get("bankNameEn")),
                    safe((String) row.get("accountNumberMasked")),
                    safe((String) row.get("reviewer")),
                    safe((String) row.get("reviewerEn")));
            if (!normalizedKeyword.isEmpty() && !searchable.toLowerCase(searchLocale).contains(normalizedKeyword)) {
                continue;
            }
            filtered.add(row);
        }

        int totalCount = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) pageSize));
        int safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
        int fromIndex = Math.min((safePageIndex - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pageIndex", safePageIndex);
        body.put("pageSize", pageSize);
        body.put("totalPages", totalPages);
        body.put("totalCount", totalCount);
        body.put("searchKeyword", safe(searchKeyword));
        body.put("verificationStatus", normalizedVerificationStatus.isEmpty() ? "ALL" : normalizedVerificationStatus);
        body.put("payoutStatus", normalizedPayoutStatus.isEmpty() ? "ALL" : normalizedPayoutStatus);
        body.put("refundAccountRows", filtered.subList(fromIndex, toIndex));
        body.put("refundAccountSummary", buildRefundAccountReviewSummary(sourceRows));
        body.put("refundAccountGuidance", buildRefundAccountReviewGuidance(isEn));
        body.put("canViewRefundAccountReview", true);
        body.put("isEn", isEn);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/certificate/objection_list/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateObjectionListPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "priority", required = false) String priority,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = 5;
        Locale searchLocale = locale == null ? Locale.KOREAN : locale;
        String normalizedKeyword = safe(searchKeyword).toLowerCase(searchLocale);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedPriority = safe(priority).toUpperCase(Locale.ROOT);

        List<Map<String, Object>> sourceRows = buildCertificateObjectionRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> row : sourceRows) {
            String rowStatus = safe((String) row.get("status"));
            String rowPriority = safe((String) row.get("priority"));
            if (!normalizedStatus.isEmpty() && !"ALL".equals(normalizedStatus) && !normalizedStatus.equalsIgnoreCase(rowStatus)) {
                continue;
            }
            if (!normalizedPriority.isEmpty() && !"ALL".equals(normalizedPriority) && !normalizedPriority.equalsIgnoreCase(rowPriority)) {
                continue;
            }
            String searchable = String.join(" ",
                    safe((String) row.get("objectionId")),
                    safe((String) row.get("applicationId")),
                    safe((String) row.get("certificateNo")),
                    safe((String) row.get("companyName")),
                    safe((String) row.get("companyNameEn")),
                    safe((String) row.get("applicantName")),
                    safe((String) row.get("applicantNameEn")),
                    safe((String) row.get("assignee")),
                    safe((String) row.get("assigneeEn")),
                    safe((String) row.get("reason")),
                    safe((String) row.get("reasonEn")));
            if (!normalizedKeyword.isEmpty() && !searchable.toLowerCase(searchLocale).contains(normalizedKeyword)) {
                continue;
            }
            filtered.add(row);
        }

        int totalCount = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) pageSize));
        int safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
        int fromIndex = Math.min((safePageIndex - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pageIndex", safePageIndex);
        body.put("pageSize", pageSize);
        body.put("totalPages", totalPages);
        body.put("totalCount", totalCount);
        body.put("searchKeyword", safe(searchKeyword));
        body.put("status", normalizedStatus.isEmpty() ? "ALL" : normalizedStatus);
        body.put("priority", normalizedPriority.isEmpty() ? "ALL" : normalizedPriority);
        body.put("canViewCertificateObjectionList", true);
        body.put("isEn", isEn);
        body.put("certificateObjectionRows", filtered.subList(fromIndex, toIndex));
        body.put("certificateObjectionSummary", buildCertificateObjectionSummary(sourceRows));
        body.put("certificateObjectionGuidance", buildCertificateObjectionGuidance(isEn));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/payment/refund_process/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> refundProcessPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "refundStatus", required = false) String refundStatus,
            @RequestParam(value = "refundChannel", required = false) String refundChannel,
            @RequestParam(value = "priority", required = false) String priority,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = 5;
        Locale searchLocale = locale == null ? Locale.KOREAN : locale;
        String normalizedKeyword = safe(searchKeyword).toLowerCase(searchLocale);
        String normalizedStatus = safe(refundStatus).toUpperCase(Locale.ROOT);
        String normalizedChannel = safe(refundChannel).toUpperCase(Locale.ROOT);
        String normalizedPriority = safe(priority).toUpperCase(Locale.ROOT);

        List<Map<String, Object>> sourceRows = buildRefundProcessRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> row : sourceRows) {
            String rowStatus = safe((String) row.get("refundStatus"));
            String rowChannel = safe((String) row.get("refundChannel"));
            String rowPriority = safe((String) row.get("priority"));
            if (!normalizedStatus.isEmpty() && !"ALL".equals(normalizedStatus) && !normalizedStatus.equalsIgnoreCase(rowStatus)) {
                continue;
            }
            if (!normalizedChannel.isEmpty() && !"ALL".equals(normalizedChannel) && !normalizedChannel.equalsIgnoreCase(rowChannel)) {
                continue;
            }
            if (!normalizedPriority.isEmpty() && !"ALL".equals(normalizedPriority) && !normalizedPriority.equalsIgnoreCase(rowPriority)) {
                continue;
            }
            String searchable = String.join(" ",
                    safe((String) row.get("refundId")),
                    safe((String) row.get("requestId")),
                    safe((String) row.get("companyName")),
                    safe((String) row.get("companyNameEn")),
                    safe((String) row.get("payerName")),
                    safe((String) row.get("payerNameEn")),
                    safe((String) row.get("assignee")),
                    safe((String) row.get("assigneeEn")),
                    safe((String) row.get("refundReason")),
                    safe((String) row.get("refundReasonEn")));
            if (!normalizedKeyword.isEmpty() && !searchable.toLowerCase(searchLocale).contains(normalizedKeyword)) {
                continue;
            }
            filtered.add(row);
        }

        int totalCount = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) pageSize));
        int safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
        int fromIndex = Math.min((safePageIndex - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pageIndex", safePageIndex);
        body.put("pageSize", pageSize);
        body.put("totalPages", totalPages);
        body.put("totalCount", totalCount);
        body.put("searchKeyword", safe(searchKeyword));
        body.put("refundStatus", normalizedStatus.isEmpty() ? "ALL" : normalizedStatus);
        body.put("refundChannel", normalizedChannel.isEmpty() ? "ALL" : normalizedChannel);
        body.put("priority", normalizedPriority.isEmpty() ? "ALL" : normalizedPriority);
        body.put("canViewRefundProcess", true);
        body.put("isEn", isEn);
        body.put("refundRows", filtered.subList(fromIndex, toIndex));
        body.put("refundSummary", buildRefundProcessSummary(sourceRows));
        body.put("refundGuidance", buildRefundProcessGuidance(isEn));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/certificate/review/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateReviewPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "certificateType", required = false) String certificateType,
            @RequestParam(value = "applicationId", required = false) String applicationId,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(buildCertificateReviewPagePayload(
                pageIndexParam,
                searchKeyword,
                status,
                certificateType,
                applicationId,
                request,
                locale));
    }

    public Map<String, Object> buildCertificateReviewPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String status,
            String certificateType,
            String applicationId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        int pageIndex = parsePositiveInt(pageIndexParam, 1);
        int pageSize = 5;
        Locale searchLocale = locale == null ? Locale.KOREAN : locale;
        String normalizedKeyword = safe(searchKeyword).toLowerCase(searchLocale);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedType = safe(certificateType).toUpperCase(Locale.ROOT);
        String requestedApplicationId = safe(applicationId);

        List<Map<String, Object>> sourceRows = buildCertificateReviewRows();
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> row : sourceRows) {
            String rowStatus = safe((String) row.get("status"));
            String rowType = safe((String) row.get("certificateTypeCode"));
            if (!normalizedStatus.isEmpty() && !"ALL".equalsIgnoreCase(normalizedStatus) && !normalizedStatus.equalsIgnoreCase(rowStatus)) {
                continue;
            }
            if (!normalizedType.isEmpty() && !"ALL".equalsIgnoreCase(normalizedType) && !normalizedType.equalsIgnoreCase(rowType)) {
                continue;
            }
            String searchable = String.join(" ",
                    safe((String) row.get("requestId")),
                    safe((String) row.get("certificateType")),
                    safe((String) row.get("certificateTypeEn")),
                    safe((String) row.get("companyName")),
                    safe((String) row.get("companyNameEn")),
                    safe((String) row.get("applicantName")),
                    safe((String) row.get("applicantNameEn")),
                    safe((String) row.get("reviewer")),
                    safe((String) row.get("reviewerEn")),
                    safe((String) row.get("issueSummary")),
                    safe((String) row.get("issueSummaryEn")));
            if (!normalizedKeyword.isEmpty() && !searchable.toLowerCase(searchLocale).contains(normalizedKeyword)) {
                continue;
            }
            filtered.add(row);
        }

        int totalCount = filtered.size();
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) pageSize));
        int safePageIndex = Math.min(Math.max(pageIndex, 1), totalPages);
        int fromIndex = Math.min((safePageIndex - 1) * pageSize, totalCount);
        int toIndex = Math.min(fromIndex + pageSize, totalCount);

        String selectedRequestId = requestedApplicationId;
        if (selectedRequestId.isEmpty() && !filtered.isEmpty()) {
            selectedRequestId = safe((String) filtered.get(0).get("requestId"));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("pageIndex", safePageIndex);
        body.put("pageSize", pageSize);
        body.put("totalPages", totalPages);
        body.put("totalCount", totalCount);
        body.put("searchKeyword", safe(searchKeyword));
        body.put("status", normalizedStatus.isEmpty() ? "ALL" : normalizedStatus);
        body.put("certificateType", normalizedType.isEmpty() ? "ALL" : normalizedType);
        body.put("applicationId", requestedApplicationId);
        body.put("selectedRequestId", selectedRequestId);
        body.put("canViewCertificateReview", true);
        body.put("isEn", isEn);
        body.put("certificateReviewRows", filtered.subList(fromIndex, toIndex));
        body.put("certificateReviewSummary", buildCertificateReviewSummary(sourceRows));
        body.put("certificateReviewGuidance", buildCertificateReviewGuidance(isEn));
        return body;
    }

    @RequestMapping(value = "/member/approve", method = RequestMethod.POST)
    public String memberApproveSubmit(
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "memberId", required = false) String memberId,
            @RequestParam(value = "selectedMemberIds", required = false) List<String> selectedMemberIds,
            @RequestParam(value = "rejectReason", required = false) String rejectReason,
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminApprovalCommandService.submitMemberApproveForm(
                action,
                memberId,
                selectedMemberIds,
                rejectReason,
                pageIndexParam,
                searchKeyword,
                membershipType,
                sbscrbSttus,
                request,
                locale,
                model);
    }

    @RequestMapping(value = "/member/company-approve", method = RequestMethod.POST)
    public String companyApproveSubmit(
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "insttId", required = false) String insttId,
            @RequestParam(value = "selectedInsttIds", required = false) List<String> selectedInsttIds,
            @RequestParam(value = "rejectReason", required = false) String rejectReason,
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminApprovalCommandService.submitCompanyApproveForm(
                action,
                insttId,
                selectedInsttIds,
                rejectReason,
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                request,
                locale,
                model);
    }

    @PostMapping("/api/admin/member/approve/action")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> memberApproveSubmitApi(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        return adminApprovalCommandService.submitMemberApproveApi(payload, request, locale);
    }

    @PostMapping("/api/admin/member/company-approve/action")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyApproveSubmitApi(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        return adminApprovalCommandService.submitCompanyApproveApi(payload, request, locale);
    }

    @PostMapping("/api/admin/certificate/approve/action")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> certificateApproveSubmitApi(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        return adminApprovalCommandService.submitCertificateApproveApi(payload, request, locale);
    }

    private int parsePositiveInt(String value, int defaultValue) {
        try {
            int parsed = Integer.parseInt(safe(value));
            return parsed > 0 ? parsed : defaultValue;
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private List<Map<String, Object>> buildCertificatePendingRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(certificatePendingRow("CERT-2026-0319", "INST-001", "한강 CCUS 실증센터", "Han River CCUS Demonstration Center", "그린에너지솔루션", "Green Energy Solutions", "278-81-00419",
                "CCUS", "CCUS 인증서", "CCUS Certificate", "포집 2공장", "Capture Plant #2",
                "2026-03-29 14:20", "2026-04-01 18:00", "수수료 납부 완료", "Payment completed",
                "가상계좌 입금 확인", "Virtual account receipt confirmed",
                "김서현", "Seo-hyun Kim", "배출인증 운영팀", "Emission Certification Ops",
                "검토 대기", "Pending Review", "PENDING", "2025년 4분기 보고서", "2025 Q4 Report",
                "측정 리포트 3건, 첨부 5건", "3 measurement reports, 5 attachments",
                "bg-amber-100 text-amber-700", "/admin/certificate/review?applicationId=CERT-2026-0319"));
        rows.add(certificatePendingRow("CERT-2026-0316", "INST-008", "수도권 준수 점검단", "Capital Compliance Group", "에코시멘트", "Eco Cement", "134-86-77731",
                "REPORT", "배출량 보고서", "Emission Report", "클링커 소성로", "Clinker Kiln",
                "2026-03-28 09:10", "2026-03-31 12:00", "수수료 미납", "Fee not paid",
                "납부 안내 발송 대기", "Waiting for fee reminder dispatch",
                "박민재", "Min-jae Park", "수수료 정산 파트", "Fee Settlement Team",
                "수수료 대기", "Waiting Payment", "FEE_WAIT", "2025년 정산 보고", "2025 Settlement Report",
                "세금계산서 초안 생성", "Tax invoice draft generated",
                "bg-sky-100 text-sky-700", "/admin/certificate/review?applicationId=CERT-2026-0316"));
        rows.add(certificatePendingRow("CERT-2026-0311", "INST-002", "경기 저장소 운영본부", "Gyeonggi Carbon Storage Office", "한빛케미칼", "Hanbit Chemical", "621-88-12004",
                "CCUS", "CCUS 인증서", "CCUS Certificate", "울산 저장 설비", "Ulsan Storage Facility",
                "2026-03-27 16:40", "2026-03-30 18:00", "수수료 납부 완료", "Payment completed",
                "담당 검토자 재배정", "Reviewer reassigned",
                "이예진", "Ye-jin Lee", "현장 검증반", "Field Verification Unit",
                "심사중", "In Review", "IN_REVIEW", "2025년 3차 검증분", "2025 Cycle 3 Verification",
                "현장 사진 8건, 로그 2건", "8 site photos, 2 logs",
                "bg-violet-100 text-violet-700", "/admin/certificate/review?applicationId=CERT-2026-0311"));
        rows.add(certificatePendingRow("CERT-2026-0304", "INST-003", "남부 CO2 회수센터", "Southern CO2 Recovery Center", "서해자원순환", "West Sea Circular Resources", "512-81-92031",
                "REC", "REC 중복 확인", "REC Duplicate Check", "순환연료 저장소", "Circular Fuel Depot",
                "2026-03-24 11:05", "2026-03-30 10:00", "검토 수수료 없음", "No review fee",
                "중복 검증 자동 판독 완료", "Auto duplicate scan finished",
                "정하늘", "Ha-neul Jung", "외부연계 검증팀", "External Verification Team",
                "이의신청", "Objection", "OBJECTION", "REC 연계 검증", "REC Linked Validation",
                "KPX 응답 이력 첨부", "KPX response history attached",
                "bg-rose-100 text-rose-700", "/admin/certificate/objection_list?applicationId=CERT-2026-0304"));
        rows.add(certificatePendingRow("CERT-2026-0302", "INST-003", "남부 CO2 회수센터", "Southern CO2 Recovery Center", "동부수소네트워크", "East Hydrogen Network", "503-87-44192",
                "CCUS", "CCUS 인증서", "CCUS Certificate", "액화 CO2 허브", "Liquid CO2 Hub",
                "2026-03-22 13:45", "2026-03-31 18:00", "수수료 납부 완료", "Payment completed",
                "기관장 직인본 업로드 완료", "Seal copy uploaded",
                "최윤호", "Yoon-ho Choi", "인증서 발급반", "Certificate Issuance Unit",
                "검토 대기", "Pending Review", "PENDING", "2026년 1차 발급", "2026 First Issuance",
                "발급본 초안 1건", "1 issuance draft",
                "bg-amber-100 text-amber-700", "/admin/certificate/review?applicationId=CERT-2026-0302"));
        rows.add(certificatePendingRow("CERT-2026-0227", "INST-008", "수도권 준수 점검단", "Capital Compliance Group", "남부바이오연료", "Southern Bio Fuel", "418-81-65028",
                "REPORT", "배출량 보고서", "Emission Report", "바이오가스 정제동", "Biogas Refinery",
                "2026-03-21 08:30", "2026-03-29 18:00", "수수료 납부 완료", "Payment completed",
                "외부 검증기관 회신 대기", "Waiting for external verifier reply",
                "김서현", "Seo-hyun Kim", "배출인증 운영팀", "Emission Certification Ops",
                "심사중", "In Review", "IN_REVIEW", "2025년 최종 보고", "2025 Final Report",
                "검증기관 의견서 1건", "1 verifier memo",
                "bg-violet-100 text-violet-700", "/admin/certificate/review?applicationId=CERT-2026-0227"));
        return rows;
    }

    private List<Map<String, Object>> buildRefundAccountReviewRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(refundAccountReviewRow(
                "VRF-2026-0412", "RF-2026-1182",
                "그린에너지솔루션", "Green Energy Solutions",
                "기업은행", "IBK Bank",
                "566-***-019382", "그린에너지솔루션", "Green Energy Solutions",
                "KRW 18,500,000", "2026-03-31 09:20",
                "PENDING", "검수 대기", "Pending Review",
                "HOLD", "지급 보류", "On Hold",
                "예금주와 사업자명 일치 여부 확인이 필요합니다.", "Validate that the account holder matches the registered company name.",
                listOf("환불신청서", "통장사본", "사업자등록증"),
                listOf("Refund request form", "Bankbook copy", "Business registration"),
                "정유진", "Yu-jin Jung",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1182"));
        rows.add(refundAccountReviewRow(
                "VRF-2026-0410", "RF-2026-1174",
                "에코시멘트", "Eco Cement",
                "신한은행", "Shinhan Bank",
                "110-***-883145", "에코시멘트 정산계정", "Eco Cement Settlement",
                "KRW 6,200,000", "2026-03-30 15:45",
                "MISMATCH", "불일치 확인", "Mismatch",
                "HOLD", "지급 보류", "On Hold",
                "예금주 표기와 등록 법인명이 달라 추가 증빙이 필요합니다.", "The account holder naming differs from the registered legal entity and needs more evidence.",
                listOf("환불신청서", "통장사본", "위임장", "정산요청 메모"),
                listOf("Refund request form", "Bankbook copy", "Letter of delegation", "Settlement note"),
                "박민재", "Min-jae Park",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1174"));
        rows.add(refundAccountReviewRow(
                "VRF-2026-0408", "RF-2026-1168",
                "한빛케미칼", "Hanbit Chemical",
                "국민은행", "KB Kookmin Bank",
                "923-***-110824", "한빛케미칼", "Hanbit Chemical",
                "KRW 22,800,000", "2026-03-30 11:10",
                "VERIFIED", "검수 완료", "Verified",
                "READY", "지급 가능", "Ready for Payout",
                "통장사본, 사업자번호, 환불 요청 결재선이 모두 일치합니다.", "Bank copy, business number, and refund approval line are all consistent.",
                listOf("환불신청서", "통장사본", "사업자등록증", "내부결재문서"),
                listOf("Refund request form", "Bankbook copy", "Business registration", "Internal approval document"),
                "이예진", "Ye-jin Lee",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1168"));
        rows.add(refundAccountReviewRow(
                "VRF-2026-0403", "RF-2026-1155",
                "서해자원순환", "West Sea Circular Resources",
                "농협은행", "NongHyup Bank",
                "301-***-772401", "서해자원순환", "West Sea Circular Resources",
                "KRW 4,900,000", "2026-03-29 17:25",
                "ESCALATED", "상신 필요", "Escalated",
                "HOLD", "지급 보류", "On Hold",
                "공동명의 계좌 사용 사유와 세무처리 기준 확인이 필요합니다.", "The jointly named account requires tax-policy confirmation before payout.",
                listOf("환불신청서", "통장사본", "공문", "세무검토 메모"),
                listOf("Refund request form", "Bankbook copy", "Official memo", "Tax review note"),
                "최윤호", "Yoon-ho Choi",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1155"));
        rows.add(refundAccountReviewRow(
                "VRF-2026-0401", "RF-2026-1151",
                "남부바이오연료", "Southern Bio Fuel",
                "우리은행", "Woori Bank",
                "1002-***-553019", "남부바이오연료", "Southern Bio Fuel",
                "KRW 3,140,000", "2026-03-29 10:05",
                "PENDING", "검수 대기", "Pending Review",
                "HOLD", "지급 보류", "On Hold",
                "마스킹 전 원계좌 번호 대조와 첨부 유효기간 확인이 필요합니다.", "Check the original account number and the attachment validity period.",
                listOf("환불신청서", "통장사본", "신분확인서"),
                listOf("Refund request form", "Bankbook copy", "Identity confirmation"),
                "김서현", "Seo-hyun Kim",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1151"));
        rows.add(refundAccountReviewRow(
                "VRF-2026-0330", "RF-2026-1139",
                "동부수소네트워크", "East Hydrogen Network",
                "하나은행", "Hana Bank",
                "428-***-990240", "동부수소네트워크", "East Hydrogen Network",
                "KRW 11,600,000", "2026-03-28 14:40",
                "VERIFIED", "검수 완료", "Verified",
                "SENT", "지급 요청 전송", "Payout Requested",
                "계좌 검수는 종료됐고 정산 배치 이관만 남아 있습니다.", "Account review is complete and only settlement batch transfer remains.",
                listOf("환불신청서", "통장사본", "사업자등록증"),
                listOf("Refund request form", "Bankbook copy", "Business registration"),
                "정하늘", "Ha-neul Jung",
                "/admin/payment/refund_process?refundRequestId=RF-2026-1139"));
        return rows;
    }

    private Map<String, Object> refundAccountReviewRow(
            String requestId,
            String refundRequestId,
            String companyName,
            String companyNameEn,
            String bankName,
            String bankNameEn,
            String accountNumberMasked,
            String accountHolder,
            String accountHolderEn,
            String requestedAmount,
            String requestedAt,
            String verificationStatus,
            String verificationStatusLabel,
            String verificationStatusLabelEn,
            String payoutStatus,
            String payoutStatusLabel,
            String payoutStatusLabelEn,
            String mismatchReason,
            String mismatchReasonEn,
            List<String> checklist,
            List<String> checklistEn,
            String reviewer,
            String reviewerEn,
            String detailUrl) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("requestId", requestId);
        row.put("refundRequestId", refundRequestId);
        row.put("companyName", companyName);
        row.put("companyNameEn", companyNameEn);
        row.put("bankName", bankName);
        row.put("bankNameEn", bankNameEn);
        row.put("accountNumberMasked", accountNumberMasked);
        row.put("accountHolder", accountHolder);
        row.put("accountHolderEn", accountHolderEn);
        row.put("requestedAmount", requestedAmount);
        row.put("requestedAt", requestedAt);
        row.put("verificationStatus", verificationStatus);
        row.put("verificationStatusLabel", verificationStatusLabel);
        row.put("verificationStatusLabelEn", verificationStatusLabelEn);
        row.put("payoutStatus", payoutStatus);
        row.put("payoutStatusLabel", payoutStatusLabel);
        row.put("payoutStatusLabelEn", payoutStatusLabelEn);
        row.put("mismatchReason", mismatchReason);
        row.put("mismatchReasonEn", mismatchReasonEn);
        row.put("checklist", checklist);
        row.put("checklistEn", checklistEn);
        row.put("reviewer", reviewer);
        row.put("reviewerEn", reviewerEn);
        row.put("detailUrl", detailUrl);
        row.put("detailUrlEn", "/en" + detailUrl);
        return row;
    }

    private List<Map<String, Object>> buildCertificateReviewRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(certificateReviewRow("CERT-2026-0319", "CCUS", "CCUS 인증서", "CCUS Certificate",
                "그린에너지솔루션", "Green Energy Solutions", "김서현", "Seo-hyun Kim",
                "2026-03-29 14:20", "REQUESTED", "검토 대기", "Pending Review",
                "review.ops01", "Review Ops 01",
                "수수료 확인과 첨부 무결성 점검이 필요합니다.", "Payment readiness and attachment integrity need review.",
                listOf("2025_Q4_측정리포트.pdf", "정산증빙_0319.xlsx", "현장확인사진.zip"),
                listOf("수수료 납부 여부 확인", "증빙 파일 해시 검증", "검토자 배정 확인"),
                listOf("Confirm payment status", "Validate attachment hashes", "Confirm reviewer assignment"),
                "3건", "bg-amber-100 text-amber-700"));
        rows.add(certificateReviewRow("CERT-2026-0316", "REPORT", "배출량 보고서", "Emission Report",
                "에코시멘트", "Eco Cement", "박민재", "Min-jae Park",
                "2026-03-28 09:10", "UNDER_REVIEW", "검토 중", "Under Review",
                "fee.audit02", "Fee Audit 02",
                "세금계산서 초안과 발급 보류 사유를 함께 확인해야 합니다.", "The invoice draft and issuance hold reason must be reviewed together.",
                listOf("정산보고서_2025.pdf", "세금계산서초안.pdf"),
                listOf("수수료 안내 이력 확인", "정산 보고서 기준기간 확인", "보류 사유 메모 정리"),
                listOf("Check fee notice history", "Confirm settlement report period", "Document the hold reason"),
                "2건", "bg-blue-100 text-blue-700"));
        rows.add(certificateReviewRow("CERT-2026-0311", "CCUS", "CCUS 인증서", "CCUS Certificate",
                "한빛케미칼", "Hanbit Chemical", "이예진", "Ye-jin Lee",
                "2026-03-27 16:40", "UNDER_REVIEW", "검토 중", "Under Review",
                "field.verify01", "Field Verify 01",
                "현장 사진과 로그 파일 기준으로 재배정 사유를 검토 중입니다.", "The reassignment basis is being reviewed against site photos and log files.",
                listOf("현장사진_8건.zip", "검증로그_0311.txt", "검토메모_v2.docx"),
                listOf("재배정 이력 확인", "현장 검증 로그 비교", "발급 가능 여부 1차 판정"),
                listOf("Check reassignment history", "Compare field verification logs", "Make the first issuance decision"),
                "3건", "bg-blue-100 text-blue-700"));
        rows.add(certificateReviewRow("CERT-2026-0304", "REC", "REC 중복 확인", "REC Duplicate Check",
                "서해자원순환", "West Sea Circular Resources", "정하늘", "Ha-neul Jung",
                "2026-03-24 11:05", "REJECTED", "보완 요청", "Revision Requested",
                "external.audit03", "External Audit 03",
                "KPX 응답 이력은 확보됐지만 반영 근거가 부족해 보완이 필요합니다.", "KPX response history is attached, but additional justification is required.",
                listOf("KPX응답이력.pdf", "이의신청메모.docx"),
                listOf("중복 판독 결과 재검증", "보완 첨부 요청 여부 확인", "이의신청 연계 메모 등록"),
                listOf("Re-validate duplicate detection", "Check whether more evidence is required", "Register objection linkage note"),
                "2건", "bg-red-100 text-red-700"));
        rows.add(certificateReviewRow("CERT-2026-0302", "CCUS", "CCUS 인증서", "CCUS Certificate",
                "동부수소네트워크", "East Hydrogen Network", "최윤호", "Yoon-ho Choi",
                "2026-03-22 13:45", "READY", "발급 가능", "Ready to Issue",
                "issue.master", "Issue Master",
                "기관장 직인본과 발급 초안 검토가 끝나 승인 단계로 넘길 수 있습니다.", "Seal copy and issuance draft review are complete and ready for approval.",
                listOf("직인본.pdf", "발급본초안_1차.pdf"),
                listOf("승인 권한자 확인", "발급본 초안 검토 완료", "감사 로그 등록"),
                listOf("Confirm approver authority", "Finalize issuance draft review", "Record audit log"),
                "2건", "bg-emerald-100 text-emerald-700"));
        rows.add(certificateReviewRow("CERT-2026-0227", "REPORT", "배출량 보고서", "Emission Report",
                "남부바이오연료", "Southern Bio Fuel", "김서현", "Seo-hyun Kim",
                "2026-03-21 08:30", "REQUESTED", "검토 대기", "Pending Review",
                "review.ops01", "Review Ops 01",
                "외부 검증기관 회신 전이라 접수 상태와 검토 착수 시점을 분리해 관리해야 합니다.", "The external verifier has not replied yet, so intake and review start should be tracked separately.",
                listOf("최종보고서_2025.pdf", "검증기관의견서.pdf"),
                listOf("외부 검증기관 회신 대기", "접수 상태 기록", "검토 착수 시점 관리"),
                listOf("Wait for external verifier response", "Record intake state", "Track review start timing"),
                "2건", "bg-amber-100 text-amber-700"));
        return rows;
    }

    private Map<String, Object> certificateReviewRow(
            String requestId,
            String certificateTypeCode,
            String certificateType,
            String certificateTypeEn,
            String companyName,
            String companyNameEn,
            String applicantName,
            String applicantNameEn,
            String requestedAt,
            String status,
            String statusLabelKo,
            String statusLabelEn,
            String reviewer,
            String reviewerEn,
            String issueSummary,
            String issueSummaryEn,
            List<String> evidenceFiles,
            List<String> checklist,
            List<String> checklistEn,
            String relatedCount,
            String statusClassName) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("requestId", requestId);
        row.put("certificateTypeCode", certificateTypeCode);
        row.put("certificateType", certificateType);
        row.put("certificateTypeEn", certificateTypeEn);
        row.put("companyName", companyName);
        row.put("companyNameEn", companyNameEn);
        row.put("applicantName", applicantName);
        row.put("applicantNameEn", applicantNameEn);
        row.put("requestedAt", requestedAt);
        row.put("status", status);
        row.put("statusLabelKo", statusLabelKo);
        row.put("statusLabelEn", statusLabelEn);
        row.put("statusClassName", statusClassName);
        row.put("reviewer", reviewer);
        row.put("reviewerEn", reviewerEn);
        row.put("issueSummary", issueSummary);
        row.put("issueSummaryEn", issueSummaryEn);
        row.put("evidenceFiles", evidenceFiles);
        row.put("checklist", checklist);
        row.put("checklistEn", checklistEn);
        row.put("relatedCount", relatedCount);
        row.put("detailUrl", "/admin/certificate/review?applicationId=" + requestId);
        row.put("detailUrlEn", "/en/admin/certificate/review?applicationId=" + requestId);
        return row;
    }

    private Map<String, Object> certificatePendingRow(
            String applicationId,
            String insttId,
            String insttName,
            String insttNameEn,
            String companyName,
            String companyNameEn,
            String businessNumber,
            String certificateType,
            String certificateTypeLabel,
            String certificateTypeLabelEn,
            String siteName,
            String siteNameEn,
            String submittedAt,
            String slaDueAt,
            String feeStatus,
            String feeStatusEn,
            String feeMemo,
            String feeMemoEn,
            String reviewerName,
            String reviewerNameEn,
            String reviewerTeam,
            String reviewerTeamEn,
            String processStatusLabel,
            String processStatusLabelEn,
            String processStatus,
            String reportPeriod,
            String reportPeriodEn,
            String evidenceSummary,
            String evidenceSummaryEn,
            String statusBadgeClass,
            String detailUrl) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("applicationId", applicationId);
        row.put("insttId", insttId);
        row.put("insttName", insttName);
        row.put("insttNameEn", insttNameEn);
        row.put("companyName", companyName);
        row.put("companyNameEn", companyNameEn);
        row.put("businessNumber", businessNumber);
        row.put("certificateType", certificateType);
        row.put("certificateTypeLabel", certificateTypeLabel);
        row.put("certificateTypeLabelEn", certificateTypeLabelEn);
        row.put("siteName", siteName);
        row.put("siteNameEn", siteNameEn);
        row.put("submittedAt", submittedAt);
        row.put("slaDueAt", slaDueAt);
        row.put("feeStatus", feeStatus);
        row.put("feeStatusEn", feeStatusEn);
        row.put("feeMemo", feeMemo);
        row.put("feeMemoEn", feeMemoEn);
        row.put("reviewerName", reviewerName);
        row.put("reviewerNameEn", reviewerNameEn);
        row.put("reviewerTeam", reviewerTeam);
        row.put("reviewerTeamEn", reviewerTeamEn);
        row.put("processStatusLabel", processStatusLabel);
        row.put("processStatusLabelEn", processStatusLabelEn);
        row.put("processStatus", processStatus);
        row.put("reportPeriod", reportPeriod);
        row.put("reportPeriodEn", reportPeriodEn);
        row.put("evidenceSummary", evidenceSummary);
        row.put("evidenceSummaryEn", evidenceSummaryEn);
        row.put("statusBadgeClass", statusBadgeClass);
        row.put("detailUrl", detailUrl);
        row.put("detailUrlEn", "/en" + detailUrl);
        return row;
    }

    private List<Map<String, Object>> buildCertificateObjectionRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(certificateObjectionRow("OBJ-2026-0318", "CERT-2026-0304", "CERT-24-001982",
                "한강에너지", "Hangang Energy", "김민서", "Min-seo Kim",
                "반려 사유 이의", "Rejection reason objection",
                "RECEIVED", "접수", "Received", "HIGH", "높음", "High",
                "2026-03-28 09:10", "2026-04-01",
                "심사1팀 박지훈", "Ji-hoon Park / Review Team 1",
                "배출량 증빙 보완본이 이미 제출되었으나 반영되지 않았습니다.",
                "Supporting emission documents were resubmitted but were not reflected.",
                "보완 첨부 반영 후 재심사 요청",
                "Re-review after reflecting the supplemental attachment.",
                "bg-slate-100 text-slate-700", "bg-red-100 text-red-700"));
        rows.add(certificateObjectionRow("OBJ-2026-0315", "CERT-2026-0316", "CERT-24-001961",
                "동부그린테크", "Dongbu Green Tech", "이수현", "Su-hyeon Lee",
                "발급 보류 이의", "Hold objection",
                "IN_REVIEW", "검토중", "In Review", "MEDIUM", "보통", "Medium",
                "2026-03-27 14:40", "2026-04-02",
                "심사2팀 오세은", "Se-eun Oh / Review Team 2",
                "REC 중복 여부가 해소되었으므로 발급 보류 해제를 요청합니다.",
                "REC duplication has been resolved and the applicant requests hold release.",
                "REC 검증 이력 확인 후 보류 해제 검토",
                "Verify REC history and consider clearing the hold.",
                "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-800"));
        rows.add(certificateObjectionRow("OBJ-2026-0312", "CERT-2026-0311", "CERT-24-001944",
                "서해리뉴어블", "West Sea Renewable", "정하윤", "Ha-yoon Jung",
                "발급 수량 정정", "Issuance quantity correction",
                "ESCALATED", "상신 필요", "Escalated", "HIGH", "높음", "High",
                "2026-03-26 11:25", "2026-04-03",
                "정책검토 이나경", "Na-gyeong Lee / Policy Review",
                "확정 수량과 실제 발급 수량 간 차이가 발생했습니다.",
                "There is a mismatch between the confirmed and issued quantity.",
                "정산 기준과 승인 이력 대조 후 관리자 승인 요청",
                "Cross-check settlement basis and approval history before escalation approval.",
                "bg-amber-100 text-amber-800", "bg-red-100 text-red-700"));
        rows.add(certificateObjectionRow("OBJ-2026-0309", "CERT-2026-0302", "CERT-24-001907",
                "남부카본솔루션", "Southern Carbon Solution", "최서준", "Seo-jun Choi",
                "반려 사유 이의", "Rejection reason objection",
                "COMPLETED", "처리 완료", "Completed", "LOW", "낮음", "Low",
                "2026-03-24 16:00", "2026-03-29",
                "심사1팀 박지훈", "Ji-hoon Park / Review Team 1",
                "사업장 코드 오기재를 수정해 재검토를 요청했습니다.",
                "The applicant corrected a site code typo and requested re-review.",
                "정정 반영 후 승인 완료",
                "Correction reflected and approved.",
                "bg-emerald-100 text-emerald-700", "bg-slate-100 text-slate-700"));
        rows.add(certificateObjectionRow("OBJ-2026-0307", "CERT-2026-0227", "CERT-24-001891",
                "제주에코파워", "Jeju Eco Power", "박예린", "Ye-rin Park",
                "첨부 누락 소명", "Missing attachment explanation",
                "IN_REVIEW", "검토중", "In Review", "MEDIUM", "보통", "Medium",
                "2026-03-23 10:35", "2026-03-31",
                "심사3팀 강도윤", "Do-yoon Kang / Review Team 3",
                "초기 제출 시 누락된 검증확인서를 추가 제출했습니다.",
                "A missing verification confirmation file was added after the initial submission.",
                "첨부 유효성 재검토 및 처리 상태 갱신",
                "Recheck attachment validity and update the processing state.",
                "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-800"));
        rows.add(certificateObjectionRow("OBJ-2026-0302", "CERT-2026-0219", "CERT-24-001850",
                "울산수소네트웍스", "Ulsan Hydrogen Networks", "임도현", "Do-hyun Lim",
                "발급 보류 이의", "Hold objection",
                "RECEIVED", "접수", "Received", "LOW", "낮음", "Low",
                "2026-03-21 13:20", "2026-03-30",
                "심사2팀 오세은", "Se-eun Oh / Review Team 2",
                "내부 검토 완료 후 보류 유지 사유에 대한 설명을 요청했습니다.",
                "The applicant asked for an explanation of the continued hold after internal review.",
                "현 상태 설명 회신 또는 추가 심사 배정",
                "Respond with the current rationale or assign additional review.",
                "bg-slate-100 text-slate-700", "bg-slate-100 text-slate-700"));
        return rows;
    }

    private Map<String, Object> certificateObjectionRow(
            String objectionId,
            String applicationId,
            String certificateNo,
            String companyName,
            String companyNameEn,
            String applicantName,
            String applicantNameEn,
            String objectionType,
            String objectionTypeEn,
            String status,
            String statusLabel,
            String statusLabelEn,
            String priority,
            String priorityLabel,
            String priorityLabelEn,
            String submittedAt,
            String dueDate,
            String assignee,
            String assigneeEn,
            String reason,
            String reasonEn,
            String requestedAction,
            String requestedActionEn,
            String statusBadgeClass,
            String priorityBadgeClass) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("objectionId", objectionId);
        row.put("applicationId", applicationId);
        row.put("certificateNo", certificateNo);
        row.put("companyName", companyName);
        row.put("companyNameEn", companyNameEn);
        row.put("applicantName", applicantName);
        row.put("applicantNameEn", applicantNameEn);
        row.put("objectionType", objectionType);
        row.put("objectionTypeEn", objectionTypeEn);
        row.put("status", status);
        row.put("statusLabel", statusLabel);
        row.put("statusLabelEn", statusLabelEn);
        row.put("priority", priority);
        row.put("priorityLabel", priorityLabel);
        row.put("priorityLabelEn", priorityLabelEn);
        row.put("submittedAt", submittedAt);
        row.put("dueDate", dueDate);
        row.put("assignee", assignee);
        row.put("assigneeEn", assigneeEn);
        row.put("reason", reason);
        row.put("reasonEn", reasonEn);
        row.put("requestedAction", requestedAction);
        row.put("requestedActionEn", requestedActionEn);
        row.put("statusBadgeClass", statusBadgeClass);
        row.put("priorityBadgeClass", priorityBadgeClass);
        row.put("lastUpdatedAt", submittedAt);
        row.put("lastUpdatedAtEn", submittedAt);
        row.put("responseOwner", assignee);
        row.put("responseOwnerEn", assigneeEn);
        row.put("recommendedNextStep", requestedAction);
        row.put("recommendedNextStepEn", requestedActionEn);
        row.put("reviewPoints", Arrays.asList(
                "원본 심사 메모와 이의신청 사유 대조",
                "첨부 증빙의 최신 업로드 여부 확인",
                "처리 결과 변경 시 상신 필요 여부 판단"));
        row.put("reviewPointsEn", Arrays.asList(
                "Compare the original review memo with the objection rationale",
                "Verify that the latest supporting files were uploaded",
                "Decide whether escalation is required before changing the outcome"));
        row.put("attachments", Arrays.asList(
                Map.of("name", "이의신청서.pdf", "nameEn", "Objection_Request.pdf", "type", "PDF"),
                Map.of("name", "보완증빙.zip", "nameEn", "Supplemental_Evidence.zip", "type", "ZIP")));
        row.put("detailUrl", "/admin/certificate/review?applicationId=" + applicationId);
        row.put("detailUrlEn", "/en/admin/certificate/review?applicationId=" + applicationId);
        return row;
    }

    private List<Map<String, Object>> buildCertificateObjectionSummary(List<Map<String, Object>> rows) {
        int receivedCount = 0;
        int inReviewCount = 0;
        int escalatedCount = 0;
        int completedCount = 0;
        for (Map<String, Object> row : rows) {
            String status = safe((String) row.get("status"));
            if ("RECEIVED".equalsIgnoreCase(status)) {
                receivedCount++;
            } else if ("IN_REVIEW".equalsIgnoreCase(status)) {
                inReviewCount++;
            } else if ("ESCALATED".equalsIgnoreCase(status)) {
                escalatedCount++;
            } else if ("COMPLETED".equalsIgnoreCase(status)) {
                completedCount++;
            }
        }
        List<Map<String, Object>> summary = new ArrayList<>();
        summary.add(summaryMetric("received", "접수", "Received", String.valueOf(receivedCount),
                "1차 검토 대기 중인 이의신청 건입니다.", "Objections waiting for first review.",
                "text-slate-700", "bg-slate-50"));
        summary.add(summaryMetric("in_review", "검토중", "In Review", String.valueOf(inReviewCount),
                "담당자에게 배정되어 검토 중인 건입니다.", "Cases actively assigned to reviewers.",
                "text-blue-700", "bg-blue-50"));
        summary.add(summaryMetric("escalated", "상신 필요", "Escalated", String.valueOf(escalatedCount),
                "정책 또는 최종 승인 검토가 필요한 건입니다.", "Cases that require policy or approver confirmation.",
                "text-amber-800", "bg-amber-50"));
        summary.add(summaryMetric("completed", "처리 완료", "Completed", String.valueOf(completedCount),
                "이의신청 처리와 회신이 종료된 건입니다.", "Cases that have been processed and closed.",
                "text-emerald-700", "bg-emerald-50"));
        return summary;
    }

    private List<Map<String, Object>> buildCertificateObjectionGuidance(boolean isEn) {
        List<Map<String, Object>> guidance = new ArrayList<>();
        guidance.add(guidanceItem(
                isEn ? "Verify source documents" : "원본 증빙 재확인",
                isEn ? "Compare the objection attachment set with the original review memo before changing the result." : "처리 결과를 바꾸기 전에 이의신청 첨부와 기존 심사 메모를 함께 대조합니다.",
                "fact_check"));
        guidance.add(guidanceItem(
                isEn ? "Confirm issuance impact" : "발급 영향도 확인",
                isEn ? "If quantity, REC, or rejection status changes, escalate before closing the case." : "수량, REC, 반려 상태가 변경되면 종결 전에 상신 절차를 거칩니다.",
                "rule"));
        guidance.add(guidanceItem(
                isEn ? "Leave an operator note" : "처리 메모 남기기",
                isEn ? "Record why the case was escalated or closed so the next reviewer can trace the decision." : "상신 또는 종결 사유를 남겨 다음 검토자가 판단 근거를 추적할 수 있게 합니다.",
                "edit_note"));
        return guidance;
    }

    private List<Map<String, Object>> buildRefundProcessRows() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(refundProcessRow(
                "RF-2026-0331-01", "RR-2026-1821",
                "한강에너지", "Hangang Energy", "결제 취소", "Card refund", "김민서", "Min-seo Kim",
                "380,000원", "REQUESTED", "요청 접수", "Requested",
                "BANK", "계좌이체", "Bank transfer",
                "ACCOUNT_REVIEW", "계좌 검수 필요", "Account review required",
                "HIGH", "높음", "High",
                "2026-03-31 09:20", "2026-04-01 15:00",
                "환불사유 증빙 접수 완료", "Refund evidence received",
                "운영1팀 박지훈", "Ji-hoon Park / Ops Team 1", "정산팀 이소라", "So-ra Lee / Settlement Team",
                "기업은행", "IBK Bank", "110-***-23891", "한강에너지", "Hangang Energy",
                "유상 서비스 부분 취소분 환불", "Refund for partially cancelled paid service",
                "계좌 실명 검수 후 이체 집행", "Validate the real-name account and release transfer",
                "/admin/payment/refund_list?requestId=RR-2026-1821", "/admin/payment/virtual_issue?refundId=RF-2026-0331-01",
                "bg-slate-100 text-slate-700", "bg-red-100 text-red-700", "bg-amber-100 text-amber-800"));
        rows.add(refundProcessRow(
                "RF-2026-0330-07", "RR-2026-1808",
                "동부그린테크", "Dongbu Green Tech", "가상계좌 취소", "Virtual account cancellation", "이수현", "Su-hyeon Lee",
                "1,240,000원", "ACCOUNT_REVIEW", "계좌 검수", "Account Review",
                "MIXED", "혼합", "Mixed",
                "ACCOUNT_REVIEW", "서류 재확인", "Document re-check",
                "MEDIUM", "보통", "Medium",
                "2026-03-30 14:05", "2026-04-01 18:00",
                "가상계좌 입금 + 차액 계좌환불", "Virtual account deposit plus bank refund",
                "운영2팀 오세은", "Se-eun Oh / Ops Team 2", "정산팀 이소라", "So-ra Lee / Settlement Team",
                "신한은행", "Shinhan Bank", "140-***-88712", "동부그린테크", "Dongbu Green Tech",
                "정산 차액 환불", "Settlement difference refund",
                "가상계좌 취소 내역과 계좌 명의 일치 확인", "Confirm cancellation history and account holder match",
                "/admin/payment/refund_list?requestId=RR-2026-1808", "/admin/payment/virtual_issue?refundId=RF-2026-0330-07",
                "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-800", "bg-amber-100 text-amber-800"));
        rows.add(refundProcessRow(
                "RF-2026-0329-03", "RR-2026-1789",
                "서해리뉴어블", "West Sea Renewable", "카드 부분 취소", "Partial card cancellation", "정하윤", "Ha-yoon Jung",
                "640,000원", "EXECUTION_READY", "집행 대기", "Ready to Execute",
                "CARD", "카드취소", "Card cancellation",
                "APPROVED", "검수 완료", "Approved",
                "HIGH", "높음", "High",
                "2026-03-29 16:40", "2026-03-31 17:00",
                "카드 승인 취소 가능 시간 임박", "Card cancellation window closing",
                "운영1팀 강도윤", "Do-yoon Kang / Ops Team 1", "결제승인 이나경", "Na-gyeong Lee / Payment Approval",
                "국민카드", "KB Card", "CARD-****-1124", "정하윤", "Ha-yoon Jung",
                "과납 수수료 환불", "Overpaid fee refund",
                "카드 취소 승인 후 결과 회신", "Approve cancellation and send the result back",
                "/admin/payment/refund_list?requestId=RR-2026-1789", "/admin/payment/virtual_issue?refundId=RF-2026-0329-03",
                "bg-emerald-100 text-emerald-700", "bg-emerald-100 text-emerald-700", "bg-red-100 text-red-700"));
        rows.add(refundProcessRow(
                "RF-2026-0328-11", "RR-2026-1764",
                "남부카본솔루션", "Southern Carbon Solution", "서비스 해지 환불", "Service termination refund", "최서준", "Seo-jun Choi",
                "220,000원", "COMPLETED", "완료", "Completed",
                "BANK", "계좌이체", "Bank transfer",
                "APPROVED", "검수 완료", "Approved",
                "LOW", "낮음", "Low",
                "2026-03-28 10:15", "2026-03-29 12:00",
                "집행 완료 후 회신 발송", "Execution complete and notified",
                "운영3팀 박예린", "Ye-rin Park / Ops Team 3", "정산팀 김하늘", "Ha-neul Kim / Settlement Team",
                "농협은행", "NongHyup Bank", "302-***-11209", "남부카본솔루션", "Southern Carbon Solution",
                "월 구독 해지 정산", "Monthly subscription termination settlement",
                "완료 이력과 회신 메시지 확인", "Confirm completion history and outbound notice",
                "/admin/payment/refund_list?requestId=RR-2026-1764", "/admin/payment/virtual_issue?refundId=RF-2026-0328-11",
                "bg-slate-100 text-slate-700", "bg-emerald-100 text-emerald-700", "bg-slate-100 text-slate-700"));
        rows.add(refundProcessRow(
                "RF-2026-0327-05", "RR-2026-1742",
                "울산수소네트웍스", "Ulsan Hydrogen Networks", "거래 취소 환불", "Trade cancellation refund", "임도현", "Do-hyun Lim",
                "910,000원", "EXECUTION_READY", "집행 대기", "Ready to Execute",
                "BANK", "계좌이체", "Bank transfer",
                "APPROVED", "검수 완료", "Approved",
                "MEDIUM", "보통", "Medium",
                "2026-03-27 11:30", "2026-03-31 18:00",
                "담당자 승인 완료, 이체 배치 대기", "Approved and waiting for transfer batch",
                "운영2팀 장도현", "Do-hyeon Jang / Ops Team 2", "정산팀 김하늘", "Ha-neul Kim / Settlement Team",
                "하나은행", "Hana Bank", "412-***-55821", "울산수소네트웍스", "Ulsan Hydrogen Networks",
                "거래 취소에 따른 원복 환불", "Rollback refund due to trade cancellation",
                "배치 집행 후 정산 원장 반영", "Run the transfer batch and update the settlement ledger",
                "/admin/payment/refund_list?requestId=RR-2026-1742", "/admin/payment/virtual_issue?refundId=RF-2026-0327-05",
                "bg-emerald-100 text-emerald-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800"));
        return rows;
    }

    private Map<String, Object> refundProcessRow(
            String refundId,
            String requestId,
            String companyName,
            String companyNameEn,
            String requestTypeLabel,
            String requestTypeLabelEn,
            String payerName,
            String payerNameEn,
            String refundAmount,
            String refundStatus,
            String refundStatusLabel,
            String refundStatusLabelEn,
            String refundChannel,
            String refundChannelLabel,
            String refundChannelLabelEn,
            String accountReviewStatus,
            String accountReviewLabel,
            String accountReviewLabelEn,
            String priority,
            String priorityLabel,
            String priorityLabelEn,
            String requestedAt,
            String dueAt,
            String sourceStatus,
            String sourceStatusEn,
            String assignee,
            String assigneeEn,
            String escalationOwner,
            String escalationOwnerEn,
            String bankName,
            String bankNameEn,
            String accountMasked,
            String accountOwner,
            String accountOwnerEn,
            String refundReason,
            String refundReasonEn,
            String nextAction,
            String nextActionEn,
            String listUrl,
            String accountReviewUrl,
            String statusBadgeClass,
            String accountBadgeClass,
            String priorityBadgeClass) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("refundId", refundId);
        row.put("requestId", requestId);
        row.put("companyName", companyName);
        row.put("companyNameEn", companyNameEn);
        row.put("requestTypeLabel", requestTypeLabel);
        row.put("requestTypeLabelEn", requestTypeLabelEn);
        row.put("payerName", payerName);
        row.put("payerNameEn", payerNameEn);
        row.put("refundAmount", refundAmount);
        row.put("refundStatus", refundStatus);
        row.put("refundStatusLabel", refundStatusLabel);
        row.put("refundStatusLabelEn", refundStatusLabelEn);
        row.put("refundChannel", refundChannel);
        row.put("refundChannelLabel", refundChannelLabel);
        row.put("refundChannelLabelEn", refundChannelLabelEn);
        row.put("accountReviewStatus", accountReviewStatus);
        row.put("accountReviewLabel", accountReviewLabel);
        row.put("accountReviewLabelEn", accountReviewLabelEn);
        row.put("priority", priority);
        row.put("priorityLabel", priorityLabel);
        row.put("priorityLabelEn", priorityLabelEn);
        row.put("requestedAt", requestedAt);
        row.put("dueAt", dueAt);
        row.put("sourceStatus", sourceStatus);
        row.put("sourceStatusEn", sourceStatusEn);
        row.put("assignee", assignee);
        row.put("assigneeEn", assigneeEn);
        row.put("teamName", assignee.contains("/") ? assignee.substring(assignee.indexOf('/') + 2) : assignee);
        row.put("teamNameEn", assigneeEn.contains("/") ? assigneeEn.substring(assigneeEn.indexOf('/') + 2) : assigneeEn);
        row.put("escalationOwner", escalationOwner);
        row.put("escalationOwnerEn", escalationOwnerEn);
        row.put("bankName", bankName);
        row.put("bankNameEn", bankNameEn);
        row.put("accountMasked", accountMasked);
        row.put("accountOwner", accountOwner);
        row.put("accountOwnerEn", accountOwnerEn);
        row.put("refundReason", refundReason);
        row.put("refundReasonEn", refundReasonEn);
        row.put("nextAction", nextAction);
        row.put("nextActionEn", nextActionEn);
        row.put("listUrl", listUrl);
        row.put("listUrlEn", "/en" + listUrl);
        row.put("accountReviewUrl", accountReviewUrl);
        row.put("accountReviewUrlEn", "/en" + accountReviewUrl);
        row.put("statusBadgeClass", statusBadgeClass);
        row.put("accountBadgeClass", accountBadgeClass);
        row.put("priorityBadgeClass", priorityBadgeClass);
        row.put("reviewChecklist", Arrays.asList(
                "환불 요청 사유와 취소 원천 대조",
                "예금주 실명 및 계좌 검수 상태 확인",
                "집행 후 회신 또는 원장 반영 순서 점검"));
        row.put("reviewChecklistEn", Arrays.asList(
                "Compare the refund reason with the cancellation source",
                "Confirm the real-name holder and account review status",
                "Verify the post-execution notice and ledger update order"));
        row.put("attachments", Arrays.asList(
                Map.of("name", "환불요청서.pdf", "nameEn", "Refund_Request.pdf", "type", "PDF"),
                Map.of("name", "계좌증빙.png", "nameEn", "Account_Evidence.png", "type", "PNG")));
        return row;
    }

    private List<Map<String, Object>> buildRefundProcessSummary(List<Map<String, Object>> rows) {
        int requestedCount = 0;
        int accountReviewCount = 0;
        int executionReadyCount = 0;
        int completedCount = 0;
        for (Map<String, Object> row : rows) {
            String status = safe((String) row.get("refundStatus"));
            if ("REQUESTED".equalsIgnoreCase(status)) {
                requestedCount++;
            } else if ("ACCOUNT_REVIEW".equalsIgnoreCase(status)) {
                accountReviewCount++;
            } else if ("EXECUTION_READY".equalsIgnoreCase(status)) {
                executionReadyCount++;
            } else if ("COMPLETED".equalsIgnoreCase(status)) {
                completedCount++;
            }
        }
        List<Map<String, Object>> summary = new ArrayList<>();
        summary.add(summaryMetric("requested", "요청 접수", "Requested", String.valueOf(requestedCount),
                "환불 사유와 차감 원천을 확인해야 하는 초기 접수 단계입니다.", "Initial intake cases waiting for refund-source verification.",
                "text-slate-700", "bg-slate-50"));
        summary.add(summaryMetric("account_review", "계좌 검수", "Account Review", String.valueOf(accountReviewCount),
                "예금주 실명과 제출 증빙을 확인 중인 건입니다.", "Cases under account-holder and document review.",
                "text-amber-800", "bg-amber-50"));
        summary.add(summaryMetric("execution_ready", "집행 대기", "Ready to Execute", String.valueOf(executionReadyCount),
                "계좌 검수와 승인 조건이 끝나 실제 집행을 기다리는 건입니다.", "Cases cleared for actual execution after review and approval checks.",
                "text-blue-700", "bg-blue-50"));
        summary.add(summaryMetric("completed", "완료", "Completed", String.valueOf(completedCount),
                "환불 집행과 회신까지 끝난 건입니다.", "Cases that completed execution and outbound response.",
                "text-emerald-700", "bg-emerald-50"));
        return summary;
    }

    private List<Map<String, Object>> buildRefundProcessGuidance(boolean isEn) {
        List<Map<String, Object>> guidance = new ArrayList<>();
        guidance.add(guidanceItem(
                isEn ? "Match the refund source" : "환불 원천 대조",
                isEn ? "Confirm whether the refund should be executed by bank transfer, card cancellation, or a mixed path before assignment." : "담당 배정 전에 계좌이체, 카드취소, 혼합 처리 중 어떤 경로인지 먼저 확정합니다.",
                "currency_exchange"));
        guidance.add(guidanceItem(
                isEn ? "Validate account evidence" : "계좌 증빙 검수",
                isEn ? "Do not release a transfer until the account holder, bank evidence, and institution scope are aligned." : "예금주, 계좌 증빙, 기관 범위가 맞지 않으면 이체 집행으로 넘기지 않습니다.",
                "fact_check"));
        guidance.add(guidanceItem(
                isEn ? "Leave execution trace" : "집행 이력 남기기",
                isEn ? "Record the operator note, escalation owner, and completion reply so settlement follow-up can trace the refund." : "운영 메모, 상신 담당, 완료 회신을 남겨 정산 후속 대응이 환불 이력을 그대로 추적할 수 있게 합니다.",
                "edit_note"));
        return guidance;
    }

    private List<Map<String, Object>> buildCertificateReviewSummary(List<Map<String, Object>> rows) {
        int requestedCount = 0;
        int underReviewCount = 0;
        int rejectedCount = 0;
        int readyCount = 0;
        for (Map<String, Object> row : rows) {
            String status = safe((String) row.get("status"));
            if ("REQUESTED".equalsIgnoreCase(status)) {
                requestedCount++;
            } else if ("UNDER_REVIEW".equalsIgnoreCase(status)) {
                underReviewCount++;
            } else if ("REJECTED".equalsIgnoreCase(status)) {
                rejectedCount++;
            } else if ("READY".equalsIgnoreCase(status)) {
                readyCount++;
            }
        }
        List<Map<String, Object>> summary = new ArrayList<>();
        summary.add(summaryMetric("requested", "검토 대기", "Pending Review", String.valueOf(requestedCount),
                "검토자 배정 또는 1차 검토를 기다리는 신청 건입니다.", "Requests waiting for reviewer assignment or first review.",
                "text-amber-700", "bg-amber-50"));
        summary.add(summaryMetric("under_review", "검토 중", "Under Review", String.valueOf(underReviewCount),
                "증빙 검증과 운영자 검토가 진행 중인 신청 건입니다.", "Requests with active evidence validation and operator review.",
                "text-blue-700", "bg-blue-50"));
        summary.add(summaryMetric("rejected", "보완 요청", "Revision Requested", String.valueOf(rejectedCount),
                "보완 또는 재제출이 필요한 신청 건입니다.", "Requests that need revision or resubmission before proceeding.",
                "text-red-700", "bg-red-50"));
        summary.add(summaryMetric("ready", "발급 가능", "Ready to Issue", String.valueOf(readyCount),
                "검토 완료로 승인 단계 이관이 가능한 신청 건입니다.", "Requests that completed review and can move to approval.",
                "text-emerald-700", "bg-emerald-50"));
        return summary;
    }

    private List<Map<String, Object>> buildCertificateReviewGuidance(boolean isEn) {
        List<Map<String, Object>> guidance = new ArrayList<>();
        guidance.add(guidanceItem(
                isEn ? "Validate evidence first" : "증빙 우선 검증",
                isEn ? "Keep fee, file integrity, and reviewer ownership aligned before opening approval." : "승인 단계로 넘기기 전에 수수료, 파일 무결성, 검토자 배정을 먼저 맞춥니다.",
                "fact_check"));
        guidance.add(guidanceItem(
                isEn ? "Escalate objections early" : "이의신청 조기 분기",
                isEn ? "If the review is tied to an objection or REC duplicate issue, branch to the linked queue before marking it ready." : "이의신청이나 REC 중복 이슈가 연결된 건은 발급 가능 처리 전에 연계 대기열로 먼저 분기합니다.",
                "alt_route"));
        guidance.add(guidanceItem(
                isEn ? "Leave a handoff note" : "이관 메모 남기기",
                isEn ? "Record why the request is ready or held so the approval operator can trace the decision." : "발급 가능 또는 보류 판단 근거를 남겨 다음 승인 담당자가 그대로 추적할 수 있게 합니다.",
                "edit_note"));
        return guidance;
    }

    private List<String> listOf(String... values) {
        List<String> items = new ArrayList<>();
        if (values == null) {
            return items;
        }
        for (String value : values) {
            items.add(value);
        }
        return items;
    }

    private Map<String, Object> guidanceItem(String title, String description, String icon) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("title", title);
        item.put("description", description);
        item.put("icon", icon);
        return item;
    }

    private List<Map<String, Object>> buildCertificatePendingSummary(List<Map<String, Object>> rows) {
        int pendingCount = 0;
        int feeWaitCount = 0;
        int objectionCount = 0;
        int overdueSoonCount = 0;
        for (Map<String, Object> row : rows) {
            String processStatus = safe((String) row.get("processStatus"));
            if ("PENDING".equalsIgnoreCase(processStatus)) {
                pendingCount++;
            }
            if ("FEE_WAIT".equalsIgnoreCase(processStatus)) {
                feeWaitCount++;
            }
            if ("OBJECTION".equalsIgnoreCase(processStatus)) {
                objectionCount++;
            }
            if (safe((String) row.get("slaDueAt")).startsWith("2026-03-30") || safe((String) row.get("slaDueAt")).startsWith("2026-03-31")) {
                overdueSoonCount++;
            }
        }
        List<Map<String, Object>> summary = new ArrayList<>();
        summary.add(summaryMetric("pending", "검토 대기", "Pending Review", String.valueOf(pendingCount),
                "수수료와 첨부 검증이 끝나 본 심사를 기다리는 건입니다.", "Items ready for reviewer assignment.",
                "text-amber-700", "bg-amber-50"));
        summary.add(summaryMetric("fee_wait", "수수료 대기", "Waiting Payment", String.valueOf(feeWaitCount),
                "가상계좌 입금 또는 세금계산서 확정 전 단계입니다.", "Waiting for payment or invoice confirmation.",
                "text-sky-700", "bg-sky-50"));
        summary.add(summaryMetric("objection", "이의신청", "Objection", String.valueOf(objectionCount),
                "반려 이후 재검토가 필요한 건입니다.", "Returned items reopened through objection flow.",
                "text-rose-700", "bg-rose-50"));
        summary.add(summaryMetric("sla_due", "마감 임박", "Due Soon", String.valueOf(overdueSoonCount),
                "오늘 또는 다음 영업일 내 처리기한이 도래하는 건수입니다.", "SLA due today or next business day.",
                "text-violet-700", "bg-violet-50"));
        return summary;
    }

    private List<Map<String, Object>> buildRefundAccountReviewSummary(List<Map<String, Object>> rows) {
        int pendingCount = 0;
        int mismatchCount = 0;
        int verifiedCount = 0;
        int escalatedCount = 0;
        for (Map<String, Object> row : rows) {
            String verificationStatus = safe((String) row.get("verificationStatus"));
            if ("PENDING".equalsIgnoreCase(verificationStatus)) {
                pendingCount++;
            } else if ("MISMATCH".equalsIgnoreCase(verificationStatus)) {
                mismatchCount++;
            } else if ("VERIFIED".equalsIgnoreCase(verificationStatus)) {
                verifiedCount++;
            } else if ("ESCALATED".equalsIgnoreCase(verificationStatus)) {
                escalatedCount++;
            }
        }
        List<Map<String, Object>> summary = new ArrayList<>();
        summary.add(summaryMetric("pending", "검수 대기", "Pending Review", String.valueOf(pendingCount),
                "예금주, 사업자명, 계좌번호 원본 대조가 남은 건입니다.", "Cases waiting for account holder and source-account verification.",
                "text-amber-700", "bg-amber-50"));
        summary.add(summaryMetric("mismatch", "불일치", "Mismatch", String.valueOf(mismatchCount),
                "추가 증빙 또는 신청자 확인이 필요한 건입니다.", "Cases that need more evidence or applicant confirmation.",
                "text-rose-700", "bg-rose-50"));
        summary.add(summaryMetric("verified", "검수 완료", "Verified", String.valueOf(verifiedCount),
                "정산 처리로 넘길 수 있는 정상 계좌입니다.", "Accounts that are ready for settlement handling.",
                "text-emerald-700", "bg-emerald-50"));
        summary.add(summaryMetric("escalated", "상신 필요", "Escalated", String.valueOf(escalatedCount),
                "세무 또는 정책 판단이 필요한 건입니다.", "Cases that need policy or tax review before payout.",
                "text-violet-700", "bg-violet-50"));
        return summary;
    }

    private List<Map<String, Object>> buildRefundAccountReviewGuidance(boolean isEn) {
        List<Map<String, Object>> guidance = new ArrayList<>();
        guidance.add(guidanceItem(
                isEn ? "Match holder and entity" : "예금주와 법인 일치 확인",
                isEn ? "Do not release payout until the account holder, legal entity, and refund request owner are aligned." : "예금주, 법인명, 환불 신청 주체가 맞지 않으면 지급 가능으로 넘기지 않습니다.",
                "fact_check"));
        guidance.add(guidanceItem(
                isEn ? "Escalate joint accounts early" : "공동명의 계좌는 조기 상신",
                isEn ? "Joint or delegated accounts should be escalated before settlement batch transfer." : "공동명의 또는 위임 계좌는 정산 배치 이관 전에 정책 검토로 상신합니다.",
                "alt_route"));
        guidance.add(guidanceItem(
                isEn ? "Keep evidence traceable" : "증빙 추적성 유지",
                isEn ? "Leave a clear note about which document resolved the mismatch for the payout operator." : "어떤 증빙으로 불일치가 해소됐는지 메모를 남겨 다음 정산 담당자가 그대로 추적할 수 있게 합니다.",
                "edit_note"));
        return guidance;
    }

    private Map<String, Object> summaryMetric(
            String metricKey,
            String label,
            String labelEn,
            String value,
            String description,
            String descriptionEn,
            String accentClassName,
            String surfaceClassName) {
        Map<String, Object> metric = new LinkedHashMap<>();
        metric.put("metricKey", metricKey);
        metric.put("label", label);
        metric.put("labelEn", labelEn);
        metric.put("value", value);
        metric.put("description", description);
        metric.put("descriptionEn", descriptionEn);
        metric.put("accentClassName", accentClassName);
        metric.put("surfaceClassName", surfaceClassName);
        return metric;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
