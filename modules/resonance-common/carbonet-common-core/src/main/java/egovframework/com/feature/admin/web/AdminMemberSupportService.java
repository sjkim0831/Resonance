package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.dto.response.CompanySearchResponseDTO;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.service.EmployeeMemberService;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMemberSupportService {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberSupportService.class);
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final EmployeeMemberService userManageService;
    private final EnterpriseMemberService entrprsManageService;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final CurrentUserContextService currentUserContextService;

    public ResponseEntity<Map<String, Object>> checkAdminAccountId(
            String adminId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String currentUserId = resolveCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (!canCreateAdminAccounts(currentUserId, currentUserAuthorCode)) {
            return duplicateCheckResponse(HttpServletResponse.SC_FORBIDDEN, false,
                    isEn ? "You do not have permission to validate administrator IDs." : "관리자 ID를 확인할 권한이 없습니다.");
        }
        String normalizedAdminId = safeString(adminId);
        if (normalizedAdminId.isEmpty()) {
            return duplicateCheckResponse(HttpServletResponse.SC_BAD_REQUEST, false,
                    isEn ? "Administrator ID is required." : "관리자 ID를 입력해 주세요.");
        }
        if (!normalizedAdminId.matches("^[A-Za-z0-9]{6,16}$")) {
            return duplicateCheckResponse(HttpServletResponse.SC_BAD_REQUEST, false,
                    isEn ? "Use 6 to 16 letters or numbers for the administrator ID."
                            : "관리자 ID는 영문/숫자 6~16자로 입력해 주세요.");
        }
        boolean duplicated;
        try {
            duplicated = userManageService.checkIdDplct(normalizedAdminId) > 0;
        } catch (Exception e) {
            log.error("Failed to check admin id duplication. adminId={}", normalizedAdminId, e);
            return duplicateCheckResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, false,
                    isEn ? "An error occurred while checking the administrator ID." : "관리자 ID 중복 확인 중 오류가 발생했습니다.");
        }
        return duplicateCheckResponse(HttpServletResponse.SC_OK,
                duplicated,
                duplicated
                        ? (isEn ? "This administrator ID is already in use." : "이미 사용 중인 관리자 ID입니다.")
                        : (isEn ? "This administrator ID is available." : "사용 가능한 관리자 ID입니다."));
    }

    public ResponseEntity<Map<String, Object>> checkMemberId(
            String memberId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String currentUserId = resolveCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (!authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)
                && !authorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode)) {
            return duplicateCheckResponse(HttpServletResponse.SC_FORBIDDEN, false,
                    isEn ? "You do not have permission to validate member IDs." : "회원 ID를 확인할 권한이 없습니다.");
        }

        String normalizedMemberId = safeString(memberId);
        if (!normalizedMemberId.matches("^[A-Za-z0-9]{6,12}$")) {
            return duplicateCheckResponse(HttpServletResponse.SC_BAD_REQUEST, false,
                    isEn ? "Use 6 to 12 letters or numbers for the member ID." : "회원 ID는 영문/숫자 6~12자로 입력해 주세요.");
        }

        boolean duplicated;
        try {
            duplicated = entrprsManageService.checkIdDplct(normalizedMemberId) > 0;
        } catch (Exception e) {
            log.error("Failed to check member id duplication. memberId={}", normalizedMemberId, e);
            return duplicateCheckResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, false,
                    isEn ? "An error occurred while checking the member ID." : "회원 ID 중복 확인 중 오류가 발생했습니다.");
        }

        return duplicateCheckResponse(HttpServletResponse.SC_OK,
                duplicated,
                duplicated
                        ? (isEn ? "This member ID is already in use." : "이미 사용 중인 회원 ID입니다.")
                        : (isEn ? "This member ID is available." : "사용 가능한 회원 ID입니다."));
    }

    public ResponseEntity<CompanySearchResponseDTO> searchCompanies(
            String keyword,
            int page,
            int size,
            String status,
            String membershipType,
            HttpServletRequest request,
            Locale locale) {
        String currentUserId = resolveCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean masterAccess = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        boolean companyScopedAccess = authorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode);
        if (!masterAccess && !companyScopedAccess) {
            return ResponseEntity.status(HttpServletResponse.SC_FORBIDDEN)
                    .body(new CompanySearchResponseDTO(Collections.emptyList(), 0, 1, 1, 0));
        }
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 20));
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("keyword", trimToLen(safeString(keyword), 100));
        params.put("offset", (safePage - 1) * safeSize);
        params.put("pageSize", safeSize);
        params.put("status", trimToLen(safeString(status), 10));
        params.put("membershipType", trimToLen(safeString(membershipType).toLowerCase(Locale.ROOT), 20));
        if (companyScopedAccess) {
            params.put("insttId", authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId));
        }
        try {
            List<CompanyListItemVO> list = entrprsManageService.searchCompanyListPaged(params);
            int totalCnt = entrprsManageService.searchCompanyListTotCnt(params);
            return ResponseEntity.ok(new CompanySearchResponseDTO(
                    list,
                    totalCnt,
                    safePage,
                    safeSize,
                    (int) Math.ceil(totalCnt / (double) safeSize)));
        } catch (Exception e) {
            log.error("Failed to search companies for admin account migration. keyword={}", keyword, e);
            return ResponseEntity.status(HttpServletResponse.SC_INTERNAL_SERVER_ERROR)
                    .body(new CompanySearchResponseDTO(Collections.emptyList(), 0, safePage, safeSize, 0));
        }
    }

    private ResponseEntity<Map<String, Object>> duplicateCheckResponse(int status, boolean duplicated, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", status < HttpServletResponse.SC_BAD_REQUEST);
        body.put("duplicated", duplicated);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private boolean canCreateAdminAccounts(String currentUserId, String currentUserAuthorCode) {
        return authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)
                || canCreateOperationAdminAccounts(currentUserAuthorCode);
    }

    private boolean canCreateOperationAdminAccounts(String currentUserAuthorCode) {
        String normalizedAuthorCode = safeString(currentUserAuthorCode).toUpperCase(Locale.ROOT);
        return ROLE_SYSTEM_ADMIN.equals(normalizedAuthorCode)
                || ROLE_ADMIN.equals(normalizedAuthorCode);
    }

    private String resolveCurrentUserId(HttpServletRequest request) {
        return currentUserContextService.resolve(request).getUserId();
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        String requestUri = safeString(request == null ? null : request.getRequestURI());
        if (requestUri.startsWith("/en/")) {
            return true;
        }
        return locale != null && Locale.ENGLISH.getLanguage().equalsIgnoreCase(locale.getLanguage());
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToLen(String value, int maxLen) {
        String normalized = safeString(value);
        if (normalized.length() <= maxLen) {
            return normalized;
        }
        return normalized.substring(0, maxLen);
    }
}
