package egovframework.com.feature.admin.web;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminCompanyEvidenceCompatibilityTest {

    @TempDir
    Path uploadDirectory;

    private EnterpriseMemberService memberService;
    private AdminCompanyAccountSupportService support;

    @BeforeEach
    void setUp() {
        System.setProperty("carbosys.file.instt.dir", uploadDirectory.toString());
        memberService = mock(EnterpriseMemberService.class);
        AdminAuthorityPagePayloadSupport payload = mock(AdminAuthorityPagePayloadSupport.class);
        when(payload.safeValue(any())).thenAnswer(invocation -> {
            Object value = invocation.getArgument(0);
            return value == null ? "" : String.valueOf(value).trim();
        });
        ProjectRuntimeContext context = new ProjectRuntimeContext();
        context.setProjectId("P003");
        support = new AdminCompanyAccountSupportService(
                memberService,
                payload,
                mock(AdminRequestContextSupport.class),
                mock(AdminMemberPageModelAssembler.class),
                context);
    }

    @AfterEach
    void tearDown() {
        System.clearProperty("carbosys.file.instt.dir");
    }

    @Test
    void adminEvidenceUsesScopedUuidIdAndActualSha256() throws Exception {
        byte[] content = "%PDF-1.7 admin proof".getBytes();
        List<InsttFileVO> files = support.saveAdminInsttEvidenceFiles(
                "INSTT-ADMIN-01", List.of(file("proof.pdf", "application/pdf", content, false)), 1);

        assertEquals(1, files.size());
        InsttFileVO stored = files.get(0);
        assertTrue(stored.getFileId().matches("IF_[0-9a-f]{32}"));
        assertTrue(stored.getFileId().length() <= 60);
        assertEquals("P003", stored.getProjectId());
        assertEquals("SCOPED", stored.getScopeStatus());
        assertEquals(hex(MessageDigest.getInstance("SHA-256").digest(content)), stored.getFileSha256());
        assertTrue(Files.exists(Path.of(stored.getFileStrePath())));
    }

    @Test
    void partialUploadFailureRemovesPreviouslySavedAndStagedFiles() throws Exception {
        byte[] content = "%PDF-1.7 first".getBytes();
        MultipartFile first = file("first.pdf", "application/pdf", content, false);
        MultipartFile second = file("second.pdf", "application/pdf", content, true);

        assertThrows(Exception.class,
                () -> support.saveAdminInsttEvidenceFiles("INSTT-ADMIN-01", List.of(first, second), 1));
        try (var paths = Files.list(uploadDirectory)) {
            assertEquals(0L, paths.count());
        }
    }

    @Test
    void persistenceFailureRemovesNewPhysicalEvidence() throws Exception {
        when(memberService.selectInsttInfoForStatus(any())).thenReturn(null);
        when(memberService.selectInsttFiles(any())).thenReturn(List.of());
        doThrow(new Exception("database failure")).when(memberService).insertInsttFiles(any());
        AdminCompanyAccountService service = new AdminCompanyAccountService(memberService, support);

        AdminCompanyAccountService.CompanyAccountPersistenceException failure = assertThrows(
                AdminCompanyAccountService.CompanyAccountPersistenceException.class,
                () -> service.saveCompanyAccount(
                        "", "E", "테스트 기업", "대표자", "1234567890", "12345", "서울시",
                        "상세주소", "담당자", "owner@example.com", "010-1234-5678",
                        List.of(file("proof.pdf", "application/pdf", "%PDF-1.7 proof".getBytes(), false)),
                        false, true, true));

        assertFalse(failure.getResult().isSuccess());
        assertEquals(500, failure.getResult().getStatusCode());
        try (var paths = Files.list(uploadDirectory)) {
            assertEquals(0L, paths.count());
        }
    }

    private MultipartFile file(String name, String contentType, byte[] content, boolean failTransfer) throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getOriginalFilename()).thenReturn(name);
        when(file.getContentType()).thenReturn(contentType);
        when(file.getSize()).thenReturn((long) content.length);
        if (failTransfer) {
            doThrow(new java.io.IOException("write failed")).when(file).transferTo(any(File.class));
        } else {
            doAnswer(invocation -> {
                Files.write(((File) invocation.getArgument(0)).toPath(), content);
                return null;
            }).when(file).transferTo(any(File.class));
        }
        return file;
    }

    private String hex(byte[] digest) {
        StringBuilder value = new StringBuilder(64);
        for (byte item : digest) {
            value.append(String.format("%02x", item & 0xff));
        }
        return value.toString();
    }
}
