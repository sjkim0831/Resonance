package egovframework.com.feature.admin.web;

import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMemberPasswordResetCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberPasswordResetCommandService.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AuthService authService;
    private final AdminMemberAccessSupport adminMemberAccessSupport;
    private final AdminMemberPasswordResetSupportService adminMemberPasswordResetSupportService;

    public ResponseEntity<Map<String, Object>> reset(
            String memberId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminMemberPasswordResetSupportService.isEnglishRequest(request, locale);

        String normalizedMemberId = adminMemberPasswordResetSupportService.safeString(memberId);
        if (normalizedMemberId.isEmpty()) {
            return failure(HttpServletResponse.SC_BAD_REQUEST,
                    isEn ? "Member ID was not provided." : "회원 ID가 전달되지 않았습니다.");
        }

        String temporaryPassword = buildTemporaryPassword();
        String currentAdminUserId = adminMemberPasswordResetSupportService.safeString(
                adminMemberPasswordResetSupportService.extractCurrentUserId(request));
        String clientIp = adminMemberPasswordResetSupportService.resolveClientIp();

        try {
            EntrprsManageVO member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
            if (member == null || adminMemberPasswordResetSupportService.safeString(member.getEntrprsmberId()).isEmpty()) {
                return failure(HttpServletResponse.SC_OK,
                        isEn ? "No matching user was found." : "일치하는 사용자를 찾을 수 없습니다.");
            }
            if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, member)) {
                return failure(HttpServletResponse.SC_FORBIDDEN, isEn
                        ? "You can only reset passwords for members in your own company."
                        : "본인 회사 소속 회원만 비밀번호를 초기화할 수 있습니다.");
            }
            boolean updated = authService.resetPassword(
                    normalizedMemberId,
                    temporaryPassword,
                    currentAdminUserId,
                    clientIp,
                    "ADMIN_MEMBER_RESET");
            if (!updated) {
                return failure(HttpServletResponse.SC_OK,
                        isEn ? "No matching user was found." : "일치하는 사용자를 찾을 수 없습니다.");
            }
        } catch (Exception e) {
            log.error("Failed to reset member credentials. memberId={}, adminId={}", normalizedMemberId, currentAdminUserId, e);
            return failure(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    isEn ? "Failed to reset the password." : "비밀번호 초기화에 실패했습니다.");
        }

        adminMemberPasswordResetSupportService.recordMemberPasswordResetAudit(request, currentAdminUserId, normalizedMemberId);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("temporaryPassword", temporaryPassword);
        payload.put("message", isEn ? "The password has been reset." : "비밀번호가 초기화되었습니다.");
        return success(payload);
    }

    private ResponseEntity<Map<String, Object>> failure(int status, String errors) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "fail");
        response.put("errors", errors);
        return ResponseEntity.status(status).body(response);
    }

    private ResponseEntity<Map<String, Object>> success(Map<String, Object> body) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        if (body != null && !body.isEmpty()) {
            response.putAll(body);
        }
        return ResponseEntity.ok(response);
    }

    private String buildTemporaryPassword() {
        String seed = Long.toString(System.currentTimeMillis(), 36).toUpperCase(Locale.ROOT);
        String suffix = Integer.toString((int) (Math.random() * 9000) + 1000);
        return "Cc!" + seed.substring(Math.max(0, seed.length() - 6)) + suffix;
    }
}
