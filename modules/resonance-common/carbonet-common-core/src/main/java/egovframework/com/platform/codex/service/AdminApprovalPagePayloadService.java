package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.ui.ExtendedModelMap;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminApprovalPagePayloadService {

    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminApprovalPageModelAssembler adminApprovalPageModelAssembler;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final AdminCertificateApprovalService certificateApprovalService;

    public Map<String, Object> buildMemberApprovePagePayload(
            String pageIndexParam,
            String searchKeyword,
            String membershipType,
            String sbscrbSttus,
            String result,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        adminRequestContextSupport.primeCsrfToken(request);
        ExtendedModelMap model = new ExtendedModelMap();
        adminApprovalPageModelAssembler.populateMemberApprovalList(
                pageIndexParam,
                searchKeyword,
                membershipType,
                sbscrbSttus,
                result,
                model,
                isEn,
                request,
                locale);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean canView = authorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode);
        response.put("canViewMemberApprove", canView);
        response.put("canUseMemberApproveAction", canView);
        return response;
    }

    public Map<String, Object> buildCompanyApprovePagePayload(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            String result,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        adminRequestContextSupport.primeCsrfToken(request);
        ExtendedModelMap model = new ExtendedModelMap();
        adminApprovalPageModelAssembler.populateCompanyApprovalList(
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                result,
                model,
                isEn,
                request,
                locale);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean canManage = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        response.put("canViewCompanyApprove", canManage);
        response.put("canUseCompanyApproveAction", canManage);
        return response;
    }

    public Map<String, Object> buildCertificateApprovePagePayload(
            String pageIndexParam,
            String searchKeyword,
            String requestType,
            String status,
            String result,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        adminRequestContextSupport.primeCsrfToken(request);
        Map<String, Object> response = new LinkedHashMap<>(certificateApprovalService.buildPagePayload(
                pageIndexParam,
                searchKeyword,
                requestType,
                status,
                result,
                isEn));
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean canManage = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        response.put("canViewCertificateApprove", canManage);
        response.put("canUseCertificateApproveAction", canManage);
        return response;
    }
}
