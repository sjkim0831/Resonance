package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;

import jakarta.servlet.http.HttpServletRequest;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminMemberExportController {

    private final AdminMemberExportService adminMemberExportService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final JwtTokenProvider jwtTokenProvider;

    @RequestMapping(value = "/member/list/excel", method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<byte[]> memberListExcel(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus) throws Exception {
        return adminMemberExportService.buildMemberListExcel(searchKeyword, membershipType, sbscrbSttus);
    }

    @RequestMapping(value = { "/member/admin_list/excel", "/member/admin-list/excel" }, method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<byte[]> adminListExcel(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            HttpServletRequest request) throws Exception {
        String currentUserId = extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean canManage = adminAuthorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode);
        return adminMemberExportService.buildAdminListExcel(
                searchKeyword,
                sbscrbSttus,
                currentUserId,
                currentUserAuthorCode,
                canManage,
                adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId));
    }

    @RequestMapping(value = { "/member/company_list/excel", "/member/company-list/excel" }, method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<byte[]> companyListExcel(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "sbscrbSttus", required = false) String sbscrbSttus,
            HttpServletRequest request) throws Exception {
        String currentUserId = extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        return adminMemberExportService.buildCompanyListExcel(
                searchKeyword,
                sbscrbSttus,
                adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode),
                adminAuthorityPagePayloadSupport.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode)
                        ? adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId)
                        : "");
    }

    private String extractCurrentUserId(HttpServletRequest request) {
        try {
            String accessToken = jwtTokenProvider.getCookie(request, "accessToken");
            if (ObjectUtils.isEmpty(accessToken)) {
                return "";
            }
            Claims claims = jwtTokenProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            return encryptedUserId == null ? "" : jwtTokenProvider.decrypt(encryptedUserId.toString());
        } catch (Exception ignored) {
            return "";
        }
    }
}
