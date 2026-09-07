package egovframework.com.common.interceptor;

import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.framework.authority.service.FrameworkAuthorityPolicyService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminMainAuthInterceptorTest {
    private final JwtTokenProvider jwtProvider=mock(JwtTokenProvider.class);
    private final AuthGroupManageService permissions=mock(AuthGroupManageService.class);
    private final EnterpriseMemberService enterpriseMembers=mock(EnterpriseMemberService.class);
    private final EmployeeMemberRepository employeeMembers=mock(EmployeeMemberRepository.class);
    private final FrameworkAuthorityPolicyService authorityPolicy=mock(FrameworkAuthorityPolicyService.class);
    private final CurrentUserContextService currentUsers=mock(CurrentUserContextService.class);
    private final HttpServletRequest request=mock(HttpServletRequest.class);
    private final HttpServletResponse response=mock(HttpServletResponse.class);
    private final StringWriter responseBody=new StringWriter();
    private final AdminMainAuthInterceptor interceptor=new AdminMainAuthInterceptor(
            jwtProvider,permissions,enterpriseMembers,employeeMembers,authorityPolicy,currentUsers);

    @BeforeEach
    void authenticate() throws Exception {
        var context=new CurrentUserContextService.CurrentUserContext();
        when(currentUsers.resolve(request)).thenReturn(context);
        when(jwtProvider.getCookie(request,"accessToken")).thenReturn("token");
        when(jwtProvider.accessValidateToken("token")).thenReturn(200);
        Claims claims=mock(Claims.class);
        when(jwtProvider.accessExtractClaims("token")).thenReturn(claims);
        when(claims.get("userId")).thenReturn("encrypted-user");
        when(jwtProvider.decrypt("encrypted-user")).thenReturn("system-admin");
        when(request.getHeader("Accept")).thenReturn("application/json");
        when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
    }

    @Test
    void systemMasterBypassesRoleFeatureChecks() throws Exception {
        request("GET","/admin/system/actor-process");
        when(permissions.selectAuthorCodeByUserId("system-admin")).thenReturn("ROLE_SYSTEM_MASTER");
        when(authorityPolicy.isSystemMaster("ROLE_SYSTEM_MASTER")).thenReturn(true);

        assertTrue(interceptor.preHandle(request,response,new Object()));
        verify(request).setAttribute("companyScopeDecision","ALLOW_MASTER");
    }

    @Test
    void activeLegacyRoleFeatureGrantIsCheckedAtRequestTime() throws Exception {
        request("GET","/admin/system/actor-process");
        when(permissions.selectAuthorCodeByUserId("system-admin")).thenReturn("ROLE_SYSTEM_ADMIN");
        when(authorityPolicy.isGlobalCompanyRole("ROLE_SYSTEM_ADMIN")).thenReturn(true);
        when(permissions.selectRequiredViewFeatureCodeByMenuUrl("/admin/system/actor-process"))
                .thenReturn("ACTOR_PROCESS_VIEW");
        when(permissions.hasAuthorFeaturePermission("ROLE_SYSTEM_ADMIN","ACTOR_PROCESS_VIEW"))
                .thenReturn(true);

        assertTrue(interceptor.preHandle(request,response,new Object()));
        verify(permissions).hasAuthorFeaturePermission("ROLE_SYSTEM_ADMIN","ACTOR_PROCESS_VIEW");
    }

    @Test
    void missingLegacyRoleFeatureGrantDeniesTheRequest() throws Exception {
        request("GET","/admin/system/actor-process");
        when(permissions.selectAuthorCodeByUserId("system-admin")).thenReturn("ROLE_SYSTEM_ADMIN");
        when(authorityPolicy.isGlobalCompanyRole("ROLE_SYSTEM_ADMIN")).thenReturn(true);
        when(permissions.selectRequiredViewFeatureCodeByMenuUrl("/admin/system/actor-process"))
                .thenReturn("ACTOR_PROCESS_VIEW");
        when(permissions.hasAuthorFeaturePermission("ROLE_SYSTEM_ADMIN","ACTOR_PROCESS_VIEW"))
                .thenReturn(false);

        assertFalse(interceptor.preHandle(request,response,new Object()));
        verify(response).setStatus(HttpServletResponse.SC_FORBIDDEN);
        verify(request).setAttribute("companyScopeDecision","DENY_FEATURE_PERMISSION");
    }

    @Test
    void locallyGuardedDesignWriteCanReachItsController() throws Exception {
        request("POST","/admin/api/system/actor-process/design/save-and-generate");
        when(permissions.selectAuthorCodeByUserId("system-admin")).thenReturn("ROLE_SYSTEM_ADMIN");
        when(authorityPolicy.isGlobalCompanyRole("ROLE_SYSTEM_ADMIN")).thenReturn(true);

        assertTrue(interceptor.preHandle(request,response,new Object()));
        verify(permissions,never()).hasAuthorFeaturePermission(anyString(),anyString());
    }

    @Test
    void processActorWriteCanReachTheAssignmentGuardWithAnOrdinaryUserRole() throws Exception {
        request("POST","/admin/api/system/actor-process/executions/start");
        when(permissions.selectAuthorCodeByUserId("system-admin")).thenReturn("ROLE_USER");

        assertTrue(interceptor.preHandle(request,response,new Object()));
        verify(permissions,never()).hasAuthorFeaturePermission(anyString(),anyString());
    }

    @Test
    void workerControlEndpointDefersAuthenticationToItsControlPlaneTokenGuard() throws Exception {
        request("POST","/admin/api/system/actor-process/development/claim");

        assertTrue(interceptor.preHandle(request,response,new Object()));
        verify(currentUsers,never()).resolve(request);
        verify(jwtProvider,never()).getCookie(request,"accessToken");
    }

    private void request(String method,String uri){
        when(request.getMethod()).thenReturn(method);
        when(request.getRequestURI()).thenReturn(uri);
    }

}
