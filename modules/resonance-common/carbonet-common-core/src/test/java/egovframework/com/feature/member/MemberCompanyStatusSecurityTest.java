package egovframework.com.feature.member;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.security.PublicLookupRateLimitService;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.service.support.InstitutionEvidenceFileSupport;
import egovframework.com.feature.member.web.MemberJoinController;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberCompanyStatusSecurityTest {

    @TempDir
    Path uploadDirectory;

    private MemberJoinController controller;
    private EnterpriseMemberService memberService;
    private InstitutionStatusVO status;
    private InsttFileVO evidence;

    @BeforeEach
    void setUp() throws Exception {
        System.setProperty("carbosys.file.instt.dir", uploadDirectory.toString());
        controller = new MemberJoinController();
        memberService = mock(EnterpriseMemberService.class);
        setField(controller, "entrprsManageService", memberService);
        ProjectRuntimeContext context = new ProjectRuntimeContext();
        context.setProjectId("P003");
        setField(controller, "projectRuntimeContext", context);
        PublicLookupRateLimitService limiter = mock(PublicLookupRateLimitService.class);
        when(limiter.check(anyString(), anyString(), anyString(), anyInt(), anyLong()))
                .thenReturn(PublicLookupRateLimitService.Decision.allowed(1));
        setField(controller, "publicLookupRateLimitService", limiter);

        status = new InstitutionStatusVO();
        status.setInsttId("INSTT-STATUS-01");
        status.setInsttNm("테스트 기업");
        status.setReprsntNm("테스트 대표");
        status.setBizrno("1234567890");
        status.setEntrprsSeCode("E");
        status.setInsttSttus("A");
        status.setChargerNm("비공개 담당자");
        status.setChargerEmail("owner@example.com");
        status.setChargerTel("010-1234-5678");
        status.setDetailAdres("비공개 상세주소");
        status.setBizRegFilePath("/private/evidence.pdf");

        byte[] bytes = "%PDF-1.7 status proof".getBytes();
        Path physical = uploadDirectory.resolve("P003_status.pdf");
        Files.write(physical, bytes);
        evidence = new InsttFileVO();
        evidence.setFileId("IF_0123456789abcdef0123456789abcdef");
        evidence.setInsttId(status.getInsttId());
        evidence.setProjectId("P003");
        evidence.setScopeStatus("SCOPED");
        evidence.setFileSha256(InstitutionEvidenceFileSupport.sha256(physical));
        evidence.setFileSn(1);
        evidence.setOrignlFileNm("사업자등록증.pdf");
        evidence.setStreFileNm("P003_status.pdf");
        evidence.setFileStrePath(physical.toString());
        evidence.setFileMg((long) bytes.length);
        evidence.setFileExtsn(".pdf");
    }

    @Test
    void legacyStatusRoutesRemainMappedForKoreanAndEnglishApplicants() throws Exception {
        org.springframework.web.bind.annotation.GetMapping mapping = MemberJoinController.class
                .getMethod("companyJoinStatusSearch", HttpServletRequest.class, org.springframework.ui.Model.class)
                .getAnnotation(org.springframework.web.bind.annotation.GetMapping.class);

        assertNotNull(mapping);
        List<String> paths = List.of(mapping.value());
        assertTrue(paths.contains("/companyJoinStatus"));
        assertTrue(paths.contains("/ko/companyJoinStatus"));
        assertTrue(paths.contains("/en/companyJoinStatus"));
    }

    @Test
    void statusLookupReturnsOnlyAllowlistedFieldsAndOpaqueDownloadToken() throws Exception {
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(status);
        when(memberService.selectInsttFiles(status.getInsttId())).thenReturn(List.of(evidence));
        ResponseEntity<Map<String, Object>> response = lookup(
                "1234567890", null, "테스트 대표", "owner@example.com", session(new HashMap<>()));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
        assertEquals("no-cache", response.getHeaders().getFirst("Pragma"));
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.getBody().get("result");
        assertEquals(List.of("insttId", "insttNm", "reprsntNm", "bizrno", "entrprsSeCode", "insttSttus",
                "rjctRsn", "rjctPnttm", "frstRegistPnttm", "lastUpdtPnttm"), new ArrayList<>(result.keySet()));
        assertFalse(result.containsKey("chargerEmail"));
        assertFalse(result.containsKey("detailAdres"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = (List<Map<String, Object>>) response.getBody().get("insttFiles");
        assertEquals(List.of("fileSn", "orignlFileNm", "fileMg", "fileExtsn", "regDate", "downloadToken"),
                new ArrayList<>(files.get(0).keySet()));
        assertNotNull(files.get(0).get("downloadToken"));
        assertFalse(files.get(0).containsKey("fileId"));
        assertFalse(files.get(0).containsKey("fileStrePath"));
        assertFalse(files.get(0).containsKey("fileSha256"));
        assertFalse(response.getBody().toString().contains("/private/"));
    }

    @Test
    void opaqueLookupHandleIsSessionBoundAndCanContinueWithoutIdentityInTheUrl() throws Exception {
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(status);
        when(memberService.selectInsttFiles(status.getInsttId())).thenReturn(List.of(evidence));
        Map<String, Object> attributes = new HashMap<>();
        HttpSession originalSession = session(attributes);

        ResponseEntity<Map<String, Object>> identified = lookup(
                "1234567890", null, "테스트 대표", "owner@example.com", originalSession);
        String handle = String.valueOf(identified.getBody().get("lookupHandle"));
        assertTrue(handle.matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));

        ResponseEntity<Map<String, Object>> continued = controller.companyJoinStatusDetailApi(
                Map.of("lookupHandle", handle), originalSession, request("127.0.0.1"));
        assertEquals(200, continued.getStatusCode().value());
        assertEquals(handle, continued.getBody().get("lookupHandle"));

        ResponseEntity<Map<String, Object>> foreignSession = controller.companyJoinStatusDetailApi(
                Map.of("lookupHandle", handle), session(new HashMap<>()), request("127.0.0.1"));
        assertEquals(400, foreignSession.getStatusCode().value());
        assertEquals("STATUS_LOOKUP_NOT_AVAILABLE", foreignSession.getBody().get("errorCode"));
    }

    @Test
    void applicationNumberLookupStillRequiresRepresentativeContactAndProjectScope() throws Exception {
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(status);
        ResponseEntity<Map<String, Object>> response = lookup(
                null, status.getInsttId(), "다른 대표", "owner@example.com", session(new HashMap<>()));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("STATUS_LOOKUP_NOT_AVAILABLE", response.getBody().get("errorCode"));
        verify(memberService, never()).selectInsttFiles(any());
    }

    @Test
    void missingDownloadTokenIsRejectedBeforeFileLookup() throws Exception {
        ResponseCapture response = responseCapture();
        controller.downloadInsttFile("", session(new HashMap<>()), response.response);
        assertEquals(403, response.status.get());
        verify(memberService, never()).selectInsttFileByFileId(any());
    }

    @Test
    void authorizedDownloadRequiresDatabaseAndPhysicalHashMatch() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        HttpSession session = session(attributes);
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(status);
        when(memberService.selectInsttFiles(status.getInsttId())).thenReturn(List.of(evidence));
        when(memberService.selectInsttFileByFileId(evidence.getFileId())).thenReturn(evidence);
        ResponseEntity<Map<String, Object>> lookup = lookup(
                "1234567890", null, "테스트 대표", "01012345678", session);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = (List<Map<String, Object>>) lookup.getBody().get("insttFiles");
        String token = String.valueOf(files.get(0).get("downloadToken"));

        ResponseCapture response = responseCapture();
        controller.downloadInsttFile(token, session, response.response);
        assertEquals(200, response.status.get());
        assertArrayEquals(Files.readAllBytes(Path.of(evidence.getFileStrePath())), response.body.toByteArray());
    }

    @Test
    void tokenCannotDownloadTamperedOrDifferentInstitutionEvidence() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        HttpSession session = session(attributes);
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(status);
        when(memberService.selectInsttFiles(status.getInsttId())).thenReturn(List.of(evidence));
        when(memberService.selectInsttFileByFileId(evidence.getFileId())).thenReturn(evidence);
        ResponseEntity<Map<String, Object>> lookup = lookup(
                "1234567890", null, "테스트 대표", "owner@example.com", session);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = (List<Map<String, Object>>) lookup.getBody().get("insttFiles");
        String token = String.valueOf(files.get(0).get("downloadToken"));
        Files.writeString(Path.of(evidence.getFileStrePath()), "tampered");

        ResponseCapture response = responseCapture();
        controller.downloadInsttFile(token, session, response.response);
        assertEquals(404, response.status.get());
    }

    @Test
    void distributedLimiterCannotBeBypassedWithANewSessionAndReturnsRetryAfter() throws Exception {
        PublicLookupRateLimitService limiter = mock(PublicLookupRateLimitService.class);
        when(limiter.check(anyString(), anyString(), anyString(), anyInt(), anyLong()))
                .thenReturn(PublicLookupRateLimitService.Decision.limited(123, 11));
        setField(controller, "publicLookupRateLimitService", limiter);
        Map<String, String> payload = Map.of(
                "bizNo", "1234567890", "repName", "테스트 대표", "registeredContact", "owner@example.com");
        ResponseEntity<Map<String, Object>> denied = controller.companyJoinStatusDetailApi(
                payload, session(new HashMap<>()), request("198.51.100.9"));
        assertEquals(429, denied.getStatusCode().value());
        assertEquals("123", denied.getHeaders().getFirst("Retry-After"));
        assertEquals("STATUS_LOOKUP_NOT_AVAILABLE", denied.getBody().get("errorCode"));
        verify(memberService, never()).selectInsttInfoForStatus(any());
    }

    @Test
    void statusLookupIsLimitedToTenRequestsPerFiveMinuteSession() throws Exception {
        HttpSession session = session(new HashMap<>());
        when(memberService.selectInsttInfoForStatus(any(InsttInfoVO.class))).thenReturn(null);
        for (int index = 0; index < 10; index++) {
            assertEquals(400, lookup(
                    "1234567890", null, "테스트 대표", "owner@example.com", session).getStatusCode().value());
        }
        ResponseEntity<Map<String, Object>> limited = lookup(
                "1234567890", null, "테스트 대표", "owner@example.com", session);
        assertEquals(429, limited.getStatusCode().value());
        assertEquals("STATUS_LOOKUP_NOT_AVAILABLE", limited.getBody().get("errorCode"));
    }

    private ResponseEntity<Map<String, Object>> lookup(
            String bizNo, String appNo, String repName, String registeredContact, HttpSession session) {
        Map<String, String> payload = new HashMap<>();
        if (bizNo != null) payload.put("bizNo", bizNo);
        if (appNo != null) payload.put("appNo", appNo);
        payload.put("repName", repName);
        payload.put("registeredContact", registeredContact);
        return controller.companyJoinStatusDetailApi(payload, session, request("127.0.0.1"));
    }

    private HttpServletRequest request(String remoteAddress) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(remoteAddress);
        return request;
    }

    private ResponseCapture responseCapture() throws IOException {
        HttpServletResponse response = mock(HttpServletResponse.class);
        AtomicInteger status = new AtomicInteger(200);
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        ServletOutputStream output = new ServletOutputStream() {
            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setWriteListener(WriteListener writeListener) {
                // Synchronous test stream.
            }

            @Override
            public void write(int value) {
                body.write(value);
            }
        };
        when(response.getOutputStream()).thenReturn(output);
        doAnswer(invocation -> {
            status.set(invocation.getArgument(0));
            return null;
        }).when(response).sendError(anyInt(), anyString());
        return new ResponseCapture(response, status, body);
    }

    private static final class ResponseCapture {
        private final HttpServletResponse response;
        private final AtomicInteger status;
        private final ByteArrayOutputStream body;

        private ResponseCapture(HttpServletResponse response, AtomicInteger status, ByteArrayOutputStream body) {
            this.response = response;
            this.status = status;
            this.body = body;
        }
    }

    private HttpSession session(Map<String, Object> attributes) {
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(any(String.class))).thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
        org.mockito.Mockito.doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(session).setAttribute(any(String.class), any());
        return session;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
