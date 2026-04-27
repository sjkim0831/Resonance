package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminApprovalPagePayloadService;
import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminApprovalCommandService {

    private final AdminApprovalActionService adminApprovalActionService;
    private final AdminCertificateApprovalService adminCertificateApprovalService;
    private final AdminApprovalPagePayloadService adminApprovalPagePayloadService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminApprovalNavigationSupport adminApprovalNavigationSupport;
    private final AdminApprovalAuditSupport adminApprovalAuditSupport;

    public AdminApprovalCommandService(
            AdminApprovalActionService adminApprovalActionService,
            AdminCertificateApprovalService adminCertificateApprovalService,
            AdminApprovalPagePayloadService adminApprovalPagePayloadService,
            AdminRequestContextSupport adminRequestContextSupport,
            AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport,
            AdminApprovalNavigationSupport adminApprovalNavigationSupport,
            AdminApprovalAuditSupport adminApprovalAuditSupport) {
        this.adminApprovalActionService = adminApprovalActionService;
        this.adminCertificateApprovalService = adminCertificateApprovalService;
        this.adminApprovalPagePayloadService = adminApprovalPagePayloadService;
        this.adminRequestContextSupport = adminRequestContextSupport;
        this.adminAuthorityPagePayloadSupport = adminAuthorityPagePayloadSupport;
        this.adminApprovalNavigationSupport = adminApprovalNavigationSupport;
        this.adminApprovalAuditSupport = adminApprovalAuditSupport;
    }

    public String submitMemberApproveForm(
            String action,
            String memberId,
            List<String> selectedMemberIds,
            String rejectReason,
            String pageIndexParam,
            String searchKeyword,
            String membershipType,
            String sbscrbSttus,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminApprovalActionService.ActionResult result = adminApprovalActionService.submitMemberApproval(
                action,
                memberId,
                selectedMemberIds,
                rejectReason,
                request,
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode));
        if (!result.isSuccess()) {
            String viewName = adminApprovalNavigationSupport.resolveMemberApprovalViewName(request, isEn);
            model.addAllAttributes(adminApprovalPagePayloadService.buildMemberApprovePagePayload(
                    pageIndexParam,
                    searchKeyword,
                    membershipType,
                    sbscrbSttus,
                    null,
                    request,
                    locale));
            model.addAttribute("memberApprovalError", result.getMessage());
            return viewName;
        }
        StringBuilder redirect = new StringBuilder();
        redirect.append("redirect:").append(adminApprovalNavigationSupport.resolveMemberApprovalBasePath(request, locale)).append("?result=").append(result.getResultCode());
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "pageIndex", pageIndexParam);
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "searchKeyword", searchKeyword);
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "membershipType", membershipType);
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "sbscrbSttus", sbscrbSttus);
        return redirect.toString();
    }

    public String submitCompanyApproveForm(
            String action,
            String insttId,
            List<String> selectedInsttIds,
            String rejectReason,
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminApprovalActionService.ActionResult result = adminApprovalActionService.submitCompanyApproval(
                action,
                insttId,
                selectedInsttIds,
                rejectReason,
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode));
        if (!result.isSuccess()) {
            model.addAllAttributes(adminApprovalPagePayloadService.buildCompanyApprovePagePayload(
                    pageIndexParam,
                    searchKeyword,
                    sbscrbSttus,
                    null,
                    request,
                    locale));
            model.addAttribute("memberApprovalError", result.getMessage());
            return adminApprovalNavigationSupport.resolveMemberApprovalViewName(request, isEn);
        }
        StringBuilder redirect = new StringBuilder();
        redirect.append("redirect:").append(adminApprovalNavigationSupport.adminPrefix(request, locale)).append("/member/company-approve?result=").append(result.getResultCode());
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "pageIndex", pageIndexParam);
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "searchKeyword", searchKeyword);
        adminApprovalNavigationSupport.appendApprovalRedirectQuery(redirect, "sbscrbSttus", sbscrbSttus);
        return redirect.toString();
    }

    public ResponseEntity<Map<String, Object>> submitMemberApproveApi(
            Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminApprovalActionService.ActionResult result = adminApprovalActionService.submitMemberApproval(
                payload == null ? null : payload.get("action"),
                payload == null ? null : payload.get("memberId"),
                payload == null ? null : payload.get("selectedIds"),
                payload == null ? null : payload.get("rejectReason"),
                request,
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode));
        if (!result.isSuccess()) {
            return result.toResponseEntity();
        }
        adminApprovalAuditSupport.recordApprovalAuditSafely(
                request,
                currentUserId,
                currentUserAuthorCode,
                "A0010103",
                "member-approve",
                "MEMBER_APPROVAL_" + ("P".equals(result.getTargetStatus()) ? "APPROVE" : "REJECT"),
                "MEMBER",
                result.getSelectedIds().toString(),
                "SUCCESS",
                "{\"action\":\"" + adminApprovalAuditSupport.safeJson(result.getAction()) + "\",\"selectedIds\":\""
                        + adminApprovalAuditSupport.safeJson(result.getSelectedIds().toString()) + "\",\"rejectReason\":\""
                        + adminApprovalAuditSupport.safeJson(result.getRejectReason()) + "\"}",
                "{\"targetStatus\":\"" + result.getTargetStatus() + "\"}");
        return result.toResponseEntity();
    }

    public ResponseEntity<Map<String, Object>> submitCompanyApproveApi(
            Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminApprovalActionService.ActionResult result = adminApprovalActionService.submitCompanyApproval(
                payload == null ? null : payload.get("action"),
                payload == null ? null : payload.get("insttId"),
                payload == null ? null : payload.get("selectedIds"),
                payload == null ? null : payload.get("rejectReason"),
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode));
        if (!result.isSuccess()) {
            return result.toResponseEntity();
        }
        adminApprovalAuditSupport.recordApprovalAuditSafely(
                request,
                currentUserId,
                currentUserAuthorCode,
                "A0010202",
                "company-approve",
                "COMPANY_APPROVAL_" + ("P".equals(result.getTargetStatus()) ? "APPROVE" : "REJECT"),
                "COMPANY",
                result.getSelectedIds().toString(),
                "SUCCESS",
                "{\"action\":\"" + adminApprovalAuditSupport.safeJson(result.getAction()) + "\",\"selectedIds\":\""
                        + adminApprovalAuditSupport.safeJson(result.getSelectedIds().toString()) + "\",\"rejectReason\":\""
                        + adminApprovalAuditSupport.safeJson(result.getRejectReason()) + "\"}",
                "{\"targetStatus\":\"" + result.getTargetStatus() + "\"}");
        return result.toResponseEntity();
    }

    public ResponseEntity<Map<String, Object>> submitCertificateApproveApi(
            Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminApprovalActionService.ActionResult result = adminCertificateApprovalService.submitApproval(
                payload == null ? null : payload.get("action"),
                payload == null ? null : payload.get("certificateId"),
                payload == null ? null : payload.get("selectedIds"),
                payload == null ? null : payload.get("rejectReason"),
                isEn,
                adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode));
        if (!result.isSuccess()) {
            return result.toResponseEntity();
        }
        adminApprovalAuditSupport.recordApprovalAuditSafely(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_CERTIFICATE_APPROVE",
                "certificate-approve",
                "CERTIFICATE_APPROVAL_" + ("P".equals(result.getTargetStatus()) ? "APPROVE" : "REJECT"),
                "CERTIFICATE",
                result.getSelectedIds().toString(),
                "SUCCESS",
                "{\"action\":\"" + adminApprovalAuditSupport.safeJson(result.getAction()) + "\",\"selectedIds\":\""
                        + adminApprovalAuditSupport.safeJson(result.getSelectedIds().toString()) + "\",\"rejectReason\":\""
                        + adminApprovalAuditSupport.safeJson(result.getRejectReason()) + "\"}",
                "{\"targetStatus\":\"" + result.getTargetStatus() + "\"}");
        return result.toResponseEntity();
    }
}
