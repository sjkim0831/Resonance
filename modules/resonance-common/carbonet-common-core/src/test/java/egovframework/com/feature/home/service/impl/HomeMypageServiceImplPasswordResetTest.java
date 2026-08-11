package egovframework.com.feature.home.service.impl;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HomeMypageServiceImplPasswordResetTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void activeEnterpriseSelfResetUsesTypedTargetAndEndsCurrentAuthentication() {
        JwtTokenProvider jwt = mock(JwtTokenProvider.class);
        EnterpriseMemberRepository members = mock(EnterpriseMemberRepository.class);
        AuthService authService = mock(AuthService.class);
        ProjectRuntimeContext project = mock(ProjectRuntimeContext.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = mock(HttpSession.class);
        Claims claims = mock(Claims.class);

        EntrprsMber member = new EntrprsMber();
        member.setEntrprsMberId("member01");
        member.setEntrprsMberStus("A");
        member.setEntrprsMberPassword("OldPass1!");

        when(jwt.getCookie(request, "accessToken")).thenReturn("access-token");
        when(jwt.accessValidateToken("access-token")).thenReturn(200);
        when(jwt.accessExtractClaims("access-token")).thenReturn(claims);
        when(claims.get("userId")).thenReturn("encrypted-member");
        when(jwt.decrypt("encrypted-member")).thenReturn("member01");
        when(project.getProjectId()).thenReturn("");
        when(members.findById("member01")).thenReturn(Optional.of(member));
        when(authService.findRecentPasswordResetHistories("member01")).thenReturn(Collections.emptyList());
        when(authService.resetPassword("member01", "ENT", "NewPass1!", "member01", "127.0.0.1",
                "MYPAGE_SELF_SERVICE")).thenReturn(true);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getSession(false)).thenReturn(session);
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("member01", "ignored", "ROLE_USER"));

        HomeMypageServiceImpl service = new HomeMypageServiceImpl(
                jwt, members, mock(EnterpriseMemberService.class), authService, project);
        Map<String, Object> result = service.updatePassword(false, "OldPass1!", "NewPass1!", request);

        assertTrue(Boolean.TRUE.equals(result.get("saved")));
        assertEquals("비밀번호를 변경했습니다.", result.get("message"));
        verify(authService).resetPassword("member01", "ENT", "NewPass1!", "member01", "127.0.0.1",
                "MYPAGE_SELF_SERVICE");
        verify(session).invalidate();
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
