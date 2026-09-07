package egovframework.com.feature.member;

import java.io.ByteArrayInputStream;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.security.PublicLookupRateLimitService;
import egovframework.com.feature.member.mapper.EntrprsManageMapper;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.service.impl.EnterpriseMemberServiceImpl;
import egovframework.com.feature.member.web.MemberJoinController;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MemberCompanyReapplyFlowTest {

    @TempDir
    Path uploadDirectory;

    private MemberJoinController controller;
    private EnterpriseMemberService memberService;

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
    }

    @Test
    void lookupReturnsAllowlistedFieldsAndOneTimeTokenWithoutPhysicalPaths() throws Exception {
        InstitutionStatusVO rejected = rejectedInstitution();
        rejected.setRawInsttId("RAW-INTERNAL-ID");
        rejected.setDetailAdres("비공개 상세주소");
        rejected.setBizRegFilePath("/secret/original-proof.pdf");
        rejected.setChargerNm("비공개 담당자");
        rejected.setChargerEmail("private@example.com");
        rejected.setChargerTel("010-9999-9999");
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejected);

        InsttFileVO file = new InsttFileVO();
        file.setFileId("SECRET-FILE-ID");
        file.setInsttId("INSTT-REJECTED");
        file.setFileSn(1);
        file.setStreFileNm("internal-storage-name.pdf");
        file.setOrignlFileNm("사업자등록증.pdf");
        file.setFileStrePath("/secret/internal-storage-name.pdf");
        file.setFileMg(123L);
        file.setFileExtsn(".pdf");
        file.setFileCn("application/pdf");
        file.setRegDate("2026.08.07");
        when(memberService.selectInsttFiles("INSTT-REJECTED")).thenReturn(List.of(file));

        ResponseEntity<Map<String, Object>> response = reapplyPage(
                "1234567890", "테스트 대표", "private@example.com", session(new HashMap<>()));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("no-store", response.getHeaders().getFirst("Cache-Control"));
        assertEquals("no-cache", response.getHeaders().getFirst("Pragma"));
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertNotNull(body.get("reapplyToken"));
        assertEquals(900L, body.get("reapplyTokenExpiresInSeconds"));

        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) body.get("result");
        assertEquals(List.of("insttId", "insttNm", "reprsntNm", "bizrno", "zip", "adres",
                "insttSttus", "rjctRsn", "rjctPnttm", "entrprsSeCode"), new ArrayList<>(result.keySet()));
        assertFalse(result.containsKey("rawInsttId"));
        assertFalse(result.containsKey("detailAdres"));
        assertFalse(result.containsKey("bizRegFilePath"));
        assertFalse(result.containsKey("chargerEmail"));
        assertFalse(result.containsKey("chargerNm"));
        assertFalse(result.containsKey("chargerTel"));
        assertFalse(result.containsKey("frstRegistPnttm"));
        assertFalse(result.containsKey("lastUpdtPnttm"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = (List<Map<String, Object>>) body.get("insttFiles");
        assertEquals(1, files.size());
        assertEquals(List.of("fileSn", "orignlFileNm", "fileMg", "fileExtsn", "regDate"),
                new ArrayList<>(files.get(0).keySet()));
        assertFalse(files.get(0).containsKey("fileId"));
        assertFalse(files.get(0).containsKey("streFileNm"));
        assertFalse(files.get(0).containsKey("fileStrePath"));
        assertFalse(files.get(0).containsKey("fileCn"));
        assertFalse(body.toString().contains("/secret/"));
        assertFalse(body.toString().contains("SECRET-FILE-ID"));
    }

    @Test
    void validSubmissionUsesAtomicServiceAndTokenCannotBeReplayed() throws Exception {
        HttpSession session = session(new HashMap<>());
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejectedInstitution());
        InsttFileVO oldFile1 = new InsttFileVO();
        oldFile1.setFileSn(1);
        InsttFileVO oldFile2 = new InsttFileVO();
        oldFile2.setFileSn(2);
        when(memberService.selectInsttFiles("INSTT-REJECTED")).thenReturn(List.of(oldFile1, oldFile2));
        when(memberService.reapplyInstitution(any(), anyList(), eq("서류 보완 필요"), any())).thenReturn(storedReceipt());
        String token = issueToken(session);

        ResponseEntity<Map<String, Object>> submitted = validSubmit(token, validEvidence(), session);

        assertEquals(200, submitted.getStatusCode().value());
        assertEquals(Boolean.TRUE, submitted.getBody().get("success"));
        assertEquals("APPLIED", submitted.getBody().get("status"));
        assertEquals(List.of("success", "insttId", "insttNm", "bizrno", "status", "regDate", "lookupHandle", "receipt"),
                new ArrayList<>(submitted.getBody().keySet()));
        assertTrue(String.valueOf(submitted.getBody().get("lookupHandle")).matches("[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"));
        @SuppressWarnings("unchecked")
        Map<String, Object> receipt = (Map<String, Object>) submitted.getBody().get("receipt");
        assertEquals(List.of("applicationVersion", "evidenceFileCount", "changeHash", "fileIds", "fileSha256s"),
                new ArrayList<>(receipt.keySet()));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<InsttFileVO>> newFilesCaptor = ArgumentCaptor.forClass(List.class);
        verify(memberService).reapplyInstitution(any(InsttInfoVO.class), newFilesCaptor.capture(), eq("서류 보완 필요"), any());
        assertEquals(1, newFilesCaptor.getValue().size());
        assertEquals(3, newFilesCaptor.getValue().get(0).getFileSn());
        assertEquals("P003", newFilesCaptor.getValue().get(0).getProjectId());
        assertEquals("SCOPED", newFilesCaptor.getValue().get(0).getScopeStatus());
        assertEquals(64, newFilesCaptor.getValue().get(0).getFileSha256().length());
        assertTrue(newFilesCaptor.getValue().get(0).getFileId().matches("IF_[0-9a-f]{32}"));

        ResponseEntity<Map<String, Object>> replayed = validSubmit(token, validEvidence(), session);
        assertEquals(403, replayed.getStatusCode().value());
        assertEquals("REAPPLY_TOKEN_INVALID_OR_EXPIRED", replayed.getBody().get("errorCode"));
    }

    @Test
    void representativeCanChangeAcrossLookupSubmitAndStatusDetailUsingStableInstitutionIdentity() throws Exception {
        HttpSession session = session(new HashMap<>());
        InstitutionStatusVO rejectedWithOldRepresentative = rejectedInstitution();
        InstitutionStatusVO reappliedWithNewRepresentative = rejectedInstitution();
        reappliedWithNewRepresentative.setReprsntNm("변경 대표");
        reappliedWithNewRepresentative.setInsttSttus("A");
        when(memberService.selectInsttInfoForStatus(any()))
                .thenReturn(rejectedWithOldRepresentative, rejectedWithOldRepresentative,
                        reappliedWithNewRepresentative);
        when(memberService.selectInsttFiles("INSTT-REJECTED")).thenReturn(List.of());
        when(memberService.reapplyInstitution(any(), anyList(), eq("서류 보완 필요"), any()))
                .thenReturn(storedReceipt());

        ResponseEntity<Map<String, Object>> lookup = reapplyPage(
                "1234567890", "테스트 대표", "owner@example.com", session);
        assertEquals(200, lookup.getStatusCode().value());
        String token = String.valueOf(lookup.getBody().get("reapplyToken"));

        ResponseEntity<Map<String, Object>> submitted = submitApi(
                "INSTT-REJECTED", "테스트 기업", "변경 대표", "123-45-67890", "12345", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", token,
                List.of(validEvidence()), session);
        assertEquals(200, submitted.getStatusCode().value());
        String lookupHandle = String.valueOf(submitted.getBody().get("lookupHandle"));
        assertFalse(lookupHandle.isBlank());

        Map<String, String> statusLookup = Map.of("lookupHandle", lookupHandle);
        ResponseEntity<Map<String, Object>> detail = controller.companyJoinStatusDetailApi(
                statusLookup, session, request("127.0.0.1"));
        assertEquals(200, detail.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> detailResult = (Map<String, Object>) detail.getBody().get("result");
        assertEquals("변경 대표", detailResult.get("reprsntNm"));

        ArgumentCaptor<InsttInfoVO> lookupCaptor = ArgumentCaptor.forClass(InsttInfoVO.class);
        verify(memberService, times(3)).selectInsttInfoForStatus(lookupCaptor.capture());
        InsttInfoVO submitPrelookup = lookupCaptor.getAllValues().get(1);
        assertEquals("P003", submitPrelookup.getProjectId());
        assertEquals("INSTT-REJECTED", submitPrelookup.getInsttId());
        assertNull(submitPrelookup.getReprsntNm());
        assertNull(submitPrelookup.getBizrno());

        InsttInfoVO statusHandleLookup = lookupCaptor.getAllValues().get(2);
        assertEquals("INSTT-REJECTED", statusHandleLookup.getInsttId());
        assertEquals("변경 대표", statusHandleLookup.getReprsntNm());
    }

    @Test
    void committedEvidenceIsPreservedWhenSessionHandleIssuanceFails() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        HttpSession session = session(attributes);
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejectedInstitution());
        when(memberService.selectInsttFiles("INSTT-REJECTED")).thenReturn(List.of());
        when(memberService.reapplyInstitution(any(), anyList(), eq("서류 보완 필요"), any())).thenReturn(storedReceipt());
        String token = issueToken(session);
        org.mockito.Mockito.doThrow(new IllegalStateException("session store unavailable"))
                .when(session).setAttribute(eq("companyLookupGrants"), any());

        ResponseEntity<Map<String, Object>> submitted = validSubmit(token, validEvidence(), session);

        assertEquals(200, submitted.getStatusCode().value());
        assertEquals(Boolean.TRUE, submitted.getBody().get("success"));
        assertEquals("", submitted.getBody().get("lookupHandle"));
        verify(memberService).reapplyInstitution(any(), anyList(), eq("서류 보완 필요"), any());
        try (java.util.stream.Stream<Path> files = Files.list(uploadDirectory)) {
            List<Path> committedFiles = files.toList();
            assertEquals(1, committedFiles.size());
            assertTrue(Files.size(committedFiles.get(0)) > 0L);
        }
    }

    @Test
    void requiredFieldsAreRejectedBeforePersistence() throws Exception {
        ResponseEntity<Map<String, Object>> response = submitApi(
                "INSTT-REJECTED", "", "테스트 대표", "1234567890", "12345", "서울시",
                null, "담당자", "owner@example.com", "010-1234-5678", "unused", List.of(validEvidence()),
                session(new HashMap<>()));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("REQUIRED_FIELDS_MISSING", response.getBody().get("errorCode"));
        assertEquals(List.of("agencyName"), response.getBody().get("missingFields"));
        verify(memberService, never()).reapplyInstitution(any(), anyList(), any(), any());
    }

    @Test
    void invalidEvidenceIsRejectedBeforeTokenConsumption() throws Exception {
        MultipartFile executable = mock(MultipartFile.class);
        when(executable.isEmpty()).thenReturn(false);
        when(executable.getOriginalFilename()).thenReturn("payload.exe");
        when(executable.getContentType()).thenReturn("application/octet-stream");
        when(executable.getSize()).thenReturn(3L);
        ResponseEntity<Map<String, Object>> response = validSubmit("unused", executable, session(new HashMap<>()));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("INVALID_EVIDENCE_FILE", response.getBody().get("errorCode"));
        verify(memberService, never()).reapplyInstitution(any(), anyList(), any(), any());
    }

    @Test
    void disguisedExecutableWithPdfExtensionAndMimeIsRejectedByMagicBytes() throws Exception {
        MultipartFile disguised = mock(MultipartFile.class);
        when(disguised.isEmpty()).thenReturn(false);
        when(disguised.getOriginalFilename()).thenReturn("payload.pdf");
        when(disguised.getContentType()).thenReturn("application/pdf");
        when(disguised.getSize()).thenReturn(4L);
        when(disguised.getInputStream()).thenReturn(new ByteArrayInputStream(new byte[] {'M', 'Z', 0, 0}));

        ResponseEntity<Map<String, Object>> response = validSubmit("unused", disguised, session(new HashMap<>()));

        assertEquals(400, response.getStatusCode().value());
        assertEquals("INVALID_EVIDENCE_FILE", response.getBody().get("errorCode"));
        verify(memberService, never()).reapplyInstitution(any(), anyList(), any(), any());
    }

    @Test
    void zeroByteAndOversizedEvidenceAreRejected() throws Exception {
        MultipartFile zeroByte = mock(MultipartFile.class);
        when(zeroByte.isEmpty()).thenReturn(false);
        when(zeroByte.getOriginalFilename()).thenReturn("empty.pdf");
        when(zeroByte.getContentType()).thenReturn("application/pdf");
        when(zeroByte.getSize()).thenReturn(0L);
        ResponseEntity<Map<String, Object>> zeroResponse = validSubmit(
                "unused", zeroByte, session(new HashMap<>()));
        assertEquals(400, zeroResponse.getStatusCode().value());
        assertEquals("INVALID_EVIDENCE_FILE", zeroResponse.getBody().get("errorCode"));

        MultipartFile oversized = mock(MultipartFile.class);
        when(oversized.isEmpty()).thenReturn(false);
        when(oversized.getOriginalFilename()).thenReturn("large.pdf");
        when(oversized.getContentType()).thenReturn("application/pdf");
        when(oversized.getSize()).thenReturn(10L * 1024L * 1024L + 1L);
        ResponseEntity<Map<String, Object>> oversizedResponse = validSubmit(
                "unused", oversized, session(new HashMap<>()));
        assertEquals(400, oversizedResponse.getStatusCode().value());
        assertEquals("INVALID_EVIDENCE_FILE", oversizedResponse.getBody().get("errorCode"));
    }

    @Test
    void moreThanTenEvidenceFilesAreRejectedBeforeTokenConsumptionOrPersistence() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        HttpSession session = session(attributes);
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejectedInstitution());
        when(memberService.selectInsttFiles(any())).thenReturn(List.of());
        String token = issueToken(session);
        org.mockito.Mockito.clearInvocations(memberService);

        List<MultipartFile> evidenceFiles = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            evidenceFiles.add(validEvidence());
        }
        ResponseEntity<Map<String, Object>> response = submitApi(
                "INSTT-REJECTED", "테스트 기업", "테스트 대표", "1234567890", "12345", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", token, evidenceFiles, session);

        assertEquals(400, response.getStatusCode().value());
        assertEquals("INVALID_EVIDENCE_FILE", response.getBody().get("errorCode"));
        assertTrue(String.valueOf(response.getBody().get("message")).contains("최대 10개"));
        assertEquals(token, attributes.get("companyReapplyToken"));
        verify(memberService, never()).selectInsttInfoForStatus(any());
        verify(memberService, never()).reapplyInstitution(any(), anyList(), any(), any());
        try (java.util.stream.Stream<Path> files = Files.list(uploadDirectory)) {
            assertEquals(0L, files.count());
        }
    }

    @Test
    void businessNumberZipAndFieldLengthContractsAreEnforced() throws Exception {
        HttpSession session = session(new HashMap<>());
        ResponseEntity<Map<String, Object>> invalidBusiness = submitApi(
                "INSTT-REJECTED", "테스트 기업", "테스트 대표", "1234", "12345", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", "unused",
                List.of(validEvidence()), session);
        assertEquals(400, invalidBusiness.getStatusCode().value());
        assertEquals("INVALID_BUSINESS_NUMBER", invalidBusiness.getBody().get("errorCode"));

        ResponseEntity<Map<String, Object>> invalidZip = submitApi(
                "INSTT-REJECTED", "테스트 기업", "테스트 대표", "123-45-67890", "1234", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", "unused",
                List.of(validEvidence()), session);
        assertEquals(400, invalidZip.getStatusCode().value());
        assertEquals("INVALID_ZIP_CODE", invalidZip.getBody().get("errorCode"));

        ResponseEntity<Map<String, Object>> oversizedName = submitApi(
                "INSTT-REJECTED", "가".repeat(201), "테스트 대표", "1234567890", "12345", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", "unused",
                List.of(validEvidence()), session);
        assertEquals(400, oversizedName.getStatusCode().value());
        assertEquals("FIELD_LENGTH_EXCEEDED", oversizedName.getBody().get("errorCode"));
        assertEquals(List.of("agencyName"), oversizedName.getBody().get("invalidFields"));
    }

    @Test
    void expiredTokenIsRejectedAndConsumed() throws Exception {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("companyReapplyToken", "expired-token");
        attributes.put("companyReapplyTokenExpiresAt", System.currentTimeMillis() - 1L);
        attributes.put("companyReapplyTokenInsttId", "INSTT-REJECTED");
        attributes.put("companyReapplyTokenBizNo", "1234567890");
        attributes.put("companyReapplyTokenRepName", "테스트 대표");
        attributes.put("companyReapplyTokenProjectId", "P003");
        HttpSession session = session(attributes);

        ResponseEntity<Map<String, Object>> response = validSubmit("expired-token", validEvidence(), session);

        assertEquals(403, response.getStatusCode().value());
        assertEquals("REAPPLY_TOKEN_INVALID_OR_EXPIRED", response.getBody().get("errorCode"));
        assertFalse(attributes.containsKey("companyReapplyToken"));
        verify(memberService, never()).selectInsttInfoForStatus(any());
    }

    @Test
    void missingTokenIsRejectedWithoutDatabaseLookup() throws Exception {
        ResponseEntity<Map<String, Object>> response = validSubmit(null, validEvidence(), session(new HashMap<>()));

        assertEquals(403, response.getStatusCode().value());
        assertEquals("REAPPLY_TOKEN_REQUIRED", response.getBody().get("errorCode"));
        verify(memberService, never()).selectInsttInfoForStatus(any());
    }

    @Test
    void conditionalUpdateConflictCleansSavedPhysicalFiles() throws Exception {
        HttpSession session = session(new HashMap<>());
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejectedInstitution());
        when(memberService.selectInsttFiles("INSTT-REJECTED")).thenReturn(List.of());
        when(memberService.reapplyInstitution(any(), anyList(), any(), any())).thenReturn(null);
        String token = issueToken(session);

        ResponseEntity<Map<String, Object>> response = validSubmit(token, validEvidence(), session);

        assertEquals(409, response.getStatusCode().value());
        assertEquals("REAPPLY_STATE_CONFLICT", response.getBody().get("errorCode"));
        try (java.util.stream.Stream<Path> files = Files.list(uploadDirectory)) {
            assertEquals(0L, files.count());
        }
    }

    @Test
    void lookupRateLimitAllowsTenRequestsPerFiveMinuteSessionWindow() throws Exception {
        HttpSession session = session(new HashMap<>());
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(rejectedInstitution());
        when(memberService.selectInsttFiles(any())).thenReturn(List.of());

        for (int i = 0; i < 10; i++) {
            assertEquals(200, reapplyPage("1234567890", "테스트 대표", "owner@example.com", session)
                    .getStatusCode().value());
        }
        ResponseEntity<Map<String, Object>> limited = reapplyPage(
                "1234567890", "테스트 대표", "owner@example.com", session);
        assertEquals(429, limited.getStatusCode().value());
        assertEquals("REAPPLY_LOOKUP_RATE_LIMIT_EXCEEDED", limited.getBody().get("errorCode"));
        assertTrue(((Number) limited.getBody().get("retryAfterSeconds")).longValue() > 0L);
    }

    @Test
    void serviceWritesConditionalUpdateFilesAndAuditInOneOperation() throws Exception {
        ProjectRuntimeContext context = new ProjectRuntimeContext();
        context.setProjectId("P003");
        EnterpriseMemberServiceImpl service = new EnterpriseMemberServiceImpl(context);
        EntrprsManageMapper mapper = mock(EntrprsManageMapper.class);
        setField(service, "entrprsManageMapper", mapper);
        when(mapper.updateRejectedInsttInfo(any())).thenReturn(1);

        InsttInfoVO institution = new InsttInfoVO();
        institution.setInsttId("INSTT-REJECTED");
        institution.setInsttNm("테스트 기업");
        institution.setReprsntNm("테스트 대표");
        institution.setBizrno("1234567890");
        InsttFileVO file = new InsttFileVO();
        file.setOrignlFileNm("proof.pdf");
        file.setFileMg(10L);
        file.setFileExtsn(".pdf");
        file.setFileSha256("a".repeat(64));
        Map<String, Object> stored = new HashMap<>();
        stored.put("applicationVersion", 1);
        stored.put("evidenceFileCount", 1);
        stored.put("changeHash", "b".repeat(64));
        stored.put("fileIdsCsv", "P003_file");
        stored.put("fileSha256sCsv", "a".repeat(64));
        when(mapper.selectLatestCompanyReapplicationAudit(any())).thenReturn(stored);

        Map<String, Object> receipt = service.reapplyInstitution(institution, List.of(file), "서류 보완 필요", "반려 사유에 맞게 정보를 수정하고 증빙을 보완했습니다.");
        assertEquals(1, receipt.get("applicationVersion"));
        assertEquals("P003", institution.getProjectId());
        verify(mapper).insertInsttFile(file);
        ArgumentCaptor<Map<String, Object>> auditCaptor = ArgumentCaptor.forClass(Map.class);
        verify(mapper).insertCompanyReapplicationAudit(auditCaptor.capture());
        assertEquals("P003", auditCaptor.getValue().get("projectId"));
        assertEquals("서류 보완 필요", auditCaptor.getValue().get("rejectionReason"));
        assertEquals(1, auditCaptor.getValue().get("evidenceFileCount"));
        assertEquals(64, String.valueOf(auditCaptor.getValue().get("changeHash")).length());

        InstitutionStatusVO scopedResult = new InstitutionStatusVO();
        when(mapper.selectInsttInfoForStatus(any())).thenReturn(scopedResult);
        InsttInfoVO lookup = new InsttInfoVO();
        service.selectInsttInfoForStatus(lookup);
        assertEquals("P003", lookup.getProjectId());
        verify(mapper).selectInsttInfoForStatus(lookup);
    }

    @Test
    void serviceConflictDoesNotInsertEvidenceOrAudit() throws Exception {
        ProjectRuntimeContext context = new ProjectRuntimeContext();
        context.setProjectId("P003");
        EnterpriseMemberServiceImpl service = new EnterpriseMemberServiceImpl(context);
        EntrprsManageMapper mapper = mock(EntrprsManageMapper.class);
        setField(service, "entrprsManageMapper", mapper);
        when(mapper.updateRejectedInsttInfo(any())).thenReturn(0);
        InsttInfoVO institution = new InsttInfoVO();
        institution.setInsttId("INSTT-REJECTED");
        InsttFileVO evidence = new InsttFileVO();
        evidence.setFileSha256("a".repeat(64));

        assertNull(service.reapplyInstitution(institution, List.of(evidence), "반려", "반려 사유에 맞게 정보를 수정하고 증빙을 보완했습니다."));
        verify(mapper, never()).insertInsttFile(any());
        verify(mapper, never()).insertCompanyReapplicationAudit(any());
    }

    private ResponseEntity<Map<String, Object>> reapplyPage(
            String bizNo, String repName, String registeredContact, HttpSession session) {
        Map<String, String> lookup = new HashMap<>();
        lookup.put("bizNo", bizNo);
        lookup.put("repName", repName);
        lookup.put("registeredContact", registeredContact);
        return controller.companyReapplyPageApi(lookup, session, request("127.0.0.1"));
    }

    private ResponseEntity<Map<String, Object>> submitApi(
            String insttId, String agencyName, String representativeName, String bizRegistrationNumber,
            String zipCode, String companyAddress, String companyAddressDetail, String chargerName,
            String chargerEmail, String chargerTel, String token, List<MultipartFile> files,
            HttpSession session) {
        return controller.companyReapplySubmitApi(insttId, agencyName, representativeName,
                bizRegistrationNumber, zipCode, companyAddress, companyAddressDetail, chargerName,
                chargerEmail, chargerTel, "반려 사유에 맞게 정보를 수정하고 증빙을 보완했습니다.",
                token, files, session, request("127.0.0.1"));
    }

    private HttpServletRequest request(String remoteAddress) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn(remoteAddress);
        return request;
    }

    private String issueToken(HttpSession session) throws Exception {
        ResponseEntity<Map<String, Object>> lookup = reapplyPage(
                "1234567890", "테스트 대표", "owner@example.com", session);
        assertEquals(200, lookup.getStatusCode().value());
        return String.valueOf(lookup.getBody().get("reapplyToken"));
    }

    private ResponseEntity<Map<String, Object>> validSubmit(
            String token, MultipartFile evidence, HttpSession session) {
        return submitApi(
                "INSTT-REJECTED", "테스트 기업", "테스트 대표", "1234567890", "12345", "서울시",
                "상세주소", "담당자", "owner@example.com", "010-1234-5678", token, List.of(evidence), session);
    }

    private MultipartFile validEvidence() throws Exception {
        MultipartFile evidence = mock(MultipartFile.class);
        when(evidence.isEmpty()).thenReturn(false);
        byte[] content = "%PDF-1.7 proof".getBytes();
        when(evidence.getOriginalFilename()).thenReturn("proof.pdf");
        when(evidence.getContentType()).thenReturn("application/pdf");
        when(evidence.getSize()).thenReturn((long) content.length);
        when(evidence.getInputStream()).thenAnswer(invocation -> new ByteArrayInputStream(content));
        org.mockito.Mockito.doAnswer(invocation -> {
            File target = invocation.getArgument(0);
            Files.write(target.toPath(), content);
            return null;
        }).when(evidence).transferTo(any(File.class));
        return evidence;
    }

    private InstitutionStatusVO rejectedInstitution() {
        InstitutionStatusVO result = new InstitutionStatusVO();
        result.setInsttId("INSTT-REJECTED");
        result.setInsttNm("테스트 기업");
        result.setReprsntNm("테스트 대표");
        result.setBizrno("1234567890");
        result.setZip("12345");
        result.setAdres("서울시");
        result.setInsttSttus("R");
        result.setRjctRsn("서류 보완 필요");
        result.setRjctPnttm("2026.08.07");
        result.setEntrprsSeCode("E");
        result.setChargerEmail("owner@example.com");
        result.setChargerTel("010-1234-5678");
        return result;
    }

    private Map<String, Object> storedReceipt() {
        Map<String, Object> receipt = new java.util.LinkedHashMap<>();
        receipt.put("applicationVersion", 1);
        receipt.put("evidenceFileCount", 1);
        receipt.put("changeHash", "b".repeat(64));
        receipt.put("fileIds", List.of("P003_file"));
        receipt.put("fileSha256s", List.of("a".repeat(64)));
        return receipt;
    }

    private HttpSession session(Map<String, Object> attributes) {
        HttpSession session = mock(HttpSession.class);
        when(session.getAttribute(any(String.class))).thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
        org.mockito.Mockito.doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(session).setAttribute(any(String.class), any());
        org.mockito.Mockito.doAnswer(invocation -> {
            attributes.remove(invocation.getArgument(0));
            return null;
        }).when(session).removeAttribute(any(String.class));
        return session;
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
