package egovframework.com.feature.member;

import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.model.ExternalAuthIdentity;
import egovframework.com.feature.auth.external.model.ExternalAuthSession;
import egovframework.com.feature.auth.external.service.AuthTokenLoginService;
import egovframework.com.feature.auth.external.service.ExternalAuthProvider;
import egovframework.com.feature.auth.external.service.impl.ExternalAuthServiceImpl;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.service.MemberConsentHistoryService;
import egovframework.com.feature.member.web.MemberJoinController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberRegistrationIdentityFlowTest {

    @Test
    void externalIdentityCompletesPendingJoinAndUnlocksStepFour() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        EntrprsManageVO joinVO = new EntrprsManageVO();
        joinVO.setEntrprsSeCode("E");
        joinVO.setUserTy("USR02");
        attributes.put("joinVO", joinVO);
        attributes.put("joinStep", 2);

        HttpSession httpSession = mock(HttpSession.class);
        when(httpSession.getId()).thenReturn("join-session-test");
        when(httpSession.getAttribute(any(String.class))).thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
        org.mockito.Mockito.doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(httpSession).setAttribute(any(String.class), any());
        org.mockito.Mockito.doAnswer(invocation -> {
            attributes.remove(invocation.getArgument(0));
            return null;
        }).when(httpSession).removeAttribute(any(String.class));

        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getSession(false)).thenReturn(httpSession);

        ExternalAuthSession providerSession = new ExternalAuthSession();
        providerSession.setProviderCode("KISA");
        providerSession.setMethodCode("SIMPLE");
        providerSession.setTxId("join-test-tx");
        providerSession.setRequestedAt(LocalDateTime.now());
        providerSession.setUrlScheme("mock://external-auth/join-test-tx");

        ExternalAuthIdentity identity = new ExternalAuthIdentity();
        identity.setProviderCode("KISA");
        identity.setMethodCode("SIMPLE");
        identity.setAuthTy("SIMPLE");
        identity.setAuthCi("TEST-CI-JOIN");
        identity.setAuthDi("TEST-DI-JOIN");
        identity.setAuthDn("test-identity");

        ExternalAuthProvider provider = mock(ExternalAuthProvider.class);
        when(provider.supports("SIMPLE")).thenReturn(true);
        when(provider.start(any(ExternalAuthStartRequest.class), any(HttpServletRequest.class))).thenReturn(providerSession);
        when(provider.complete(any(ExternalAuthSession.class), any(ExternalAuthCompleteRequest.class), any(HttpServletRequest.class)))
                .thenReturn(identity);

        ExternalAuthServiceImpl externalAuth = new ExternalAuthServiceImpl(
                List.of(provider), mock(AuthService.class), mock(AuthTokenLoginService.class));
        ExternalAuthStartRequest start = new ExternalAuthStartRequest();
        start.setMethodCode("SIMPLE");
        externalAuth.start(start, request);
        ExternalAuthCompleteRequest complete = new ExternalAuthCompleteRequest();
        complete.setMethodCode("SIMPLE");
        complete.setTxId("join-test-tx");

        Map<String, Object> completion = externalAuth.complete(complete, request, response);
        assertEquals("joinVerificationSuccess", completion.get("status"));
        assertEquals(Boolean.TRUE, completion.get("success"));
        assertSame(joinVO, attributes.get("joinVO"));
        assertEquals("TEST-CI-JOIN", joinVO.getAuthCi());
        assertEquals("TEST-DI-JOIN", joinVO.getAuthDi());
        assertEquals(3, attributes.get("joinStep"));

        MemberJoinController controller = new MemberJoinController();
        EnterpriseMemberService memberService = mock(EnterpriseMemberService.class);
        MemberConsentHistoryService consentHistoryService = mock(MemberConsentHistoryService.class);
        setField(controller, "entrprsManageService", memberService);
        setField(controller, "memberConsentHistoryService", consentHistoryService);
        ResponseEntity<Map<String, Object>> step3 = controller.saveStep3Api("SIMPLE", httpSession);
        assertTrue(step3.getStatusCode().is2xxSuccessful());
        assertEquals(Boolean.TRUE, step3.getBody().get("success"));
        assertEquals(4, step3.getBody().get("step"));
        assertEquals(4, attributes.get("joinStep"));

        MultipartFile evidence = mock(MultipartFile.class);
        when(evidence.isEmpty()).thenReturn(false);
        when(evidence.getOriginalFilename()).thenReturn("business-registration.pdf");
        when(evidence.getSize()).thenReturn(128L);
        when(evidence.getContentType()).thenReturn("application/pdf");
        ResponseEntity<Map<String, Object>> missingRequired = controller.step4SubmitApi(
                null, "member-test", "Password1!", "", "test-company", "INSTT-TEST",
                "representative", "1234567890", "123456", "test-address", "detail-address", "environment",
                "010", "1234", "5678", "member-test@example.com", List.of(evidence), httpSession);
        assertEquals(400, missingRequired.getStatusCode().value());
        assertEquals("REQUIRED_FIELDS_MISSING", missingRequired.getBody().get("errorCode"));
        assertEquals(List.of("mberNm"), missingRequired.getBody().get("missingFields"));

        ResponseEntity<Map<String, Object>> submitted = controller.step4SubmitApi(
                null, "member-test", "Password1!", "테스트 담당자", "테스트 기업", "INSTT-TEST",
                "대표자", "1234567890", "123456", "테스트 주소", "상세 주소", "환경팀",
                "010", "1234", "5678", "member-test@example.com", List.of(evidence), httpSession);
        assertTrue(submitted.getStatusCode().is2xxSuccessful());
        assertEquals(Boolean.TRUE, submitted.getBody().get("success"));
        assertEquals("member-test", submitted.getBody().get("receiptNumber"));
        assertEquals("PENDING_APPROVAL", submitted.getBody().get("applicationStatus"));
        assertEquals("E", submitted.getBody().get("membershipType"));
        assertTrue(String.valueOf(submitted.getBody().get("submittedAt")).endsWith("Z"));
        assertEquals("ADMIN_APPROVAL", submitted.getBody().get("nextAction"));
        verify(memberService).insertEntrprsmber(joinVO);
        verify(memberService).insertEntrprsMberFiles(any());
        verify(memberService).ensureEnterpriseSecurityMapping(joinVO.getUniqId());
        verify(consentHistoryService).linkMember(any(String.class), org.mockito.ArgumentMatchers.eq("member-test"));
        assertTrue(!attributes.containsKey("joinVO") && !attributes.containsKey("joinStep"));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
