package egovframework.com.feature.admin.web;

import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminMemberPasswordResetCommandServiceTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void selfResetUsesEnterpriseTargetAndEndsCurrentAuthentication() throws Exception {
        EnterpriseMemberService members = mock(EnterpriseMemberService.class);
        AuthService authService = mock(AuthService.class);
        AdminMemberAccessSupport access = mock(AdminMemberAccessSupport.class);
        AdminMemberPasswordResetSupportService support = mock(AdminMemberPasswordResetSupportService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        EntrprsManageVO member = new EntrprsManageVO();
        member.setEntrprsmberId("admin01");

        when(support.safeString("admin01")).thenReturn("admin01");
        when(support.extractCurrentUserId(request)).thenReturn("admin01");
        when(support.resolveClientIp()).thenReturn("127.0.0.1");
        when(members.selectEntrprsmberByMberId("admin01")).thenReturn(member);
        when(access.canCurrentAdminAccessMember(request, member)).thenReturn(true);
        when(authService.resetPassword(eq("admin01"), eq("ENT"), anyString(), eq("admin01"),
                eq("127.0.0.1"), eq("ADMIN_MEMBER_RESET"))).thenReturn(true);
        when(request.getSession(false)).thenReturn(session);
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin01", "ignored", "ROLE_ADMIN"));

        AdminMemberPasswordResetCommandService service = new AdminMemberPasswordResetCommandService(
                members, authService, access, support);
        ResponseEntity<Map<String, Object>> response = service.reset("admin01", request, Locale.KOREAN);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("success", response.getBody().get("status"));
        verify(authService).resetPassword(eq("admin01"), eq("ENT"), anyString(), eq("admin01"),
                eq("127.0.0.1"), eq("ADMIN_MEMBER_RESET"));
        verify(session).invalidate();
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
