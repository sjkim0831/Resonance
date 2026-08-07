package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.service.support.InstitutionEvidenceFileSupport;
import egovframework.com.common.context.ProjectRuntimeContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminCompanyAccountSupportService {

    private static final Logger log = LoggerFactory.getLogger(AdminCompanyAccountSupportService.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;
    private final ProjectRuntimeContext projectRuntimeContext;

    public String extractCurrentUserId(HttpServletRequest request) {
        return adminRequestContextSupport.extractCurrentUserId(request);
    }

    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale);
    }

    public void primeCsrfToken(HttpServletRequest request) {
        adminRequestContextSupport.primeCsrfToken(request);
    }

    public String resolveFormViewName(boolean isEn) {
        return isEn ? "egovframework/com/admin/company_account_en" : "egovframework/com/admin/company_account";
    }

    public String resolveSuccessRedirect(HttpServletRequest request, Locale locale, String insttId) {
        return "redirect:" + adminPrefix(request, locale)
                + "/member/company_account?insttId=" + urlEncode(insttId) + "&saved=Y";
    }

    public void populateCompanyAccountModelFromValues(
            String insttId,
            String membershipType,
            String agencyName,
            String representativeName,
            String bizRegistrationNumber,
            String zipCode,
            String companyAddress,
            String companyAddressDetail,
            String chargerName,
            String chargerEmail,
            String chargerTel,
            boolean isEn,
            Model model) {
        adminMemberPageModelAssembler.populateCompanyAccountModel(insttId, isEn, model);
        Object attribute = model.asMap().get("companyAccountForm");
        InstitutionStatusVO form = attribute instanceof InstitutionStatusVO
                ? (InstitutionStatusVO) attribute
                : new InstitutionStatusVO();
        form.setInsttId(safeString(insttId));
        form.setEntrprsSeCode(normalizeMembershipCode(membershipType));
        form.setInsttNm(trimToLen(agencyName, 100));
        form.setReprsntNm(trimToLen(representativeName, 60));
        form.setBizrno(trimToLen(digitsOnly(bizRegistrationNumber), 10));
        form.setZip(trimToLen(digitsOnly(zipCode), 6));
        form.setAdres(trimToLen(companyAddress, 200));
        form.setDetailAdres(trimToLen(companyAddressDetail, 200));
        form.setChargerNm(trimToLen(chargerName, 60));
        form.setChargerEmail(trimToLen(chargerEmail, 100));
        form.setChargerTel(trimToLen(chargerTel, 30));
        model.addAttribute("companyAccountForm", form);
    }

    public InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return null;
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            return entrprsManageService.selectInsttInfoForStatus(searchVO);
        } catch (Exception e) {
            log.warn("Failed to load institution info. insttId={}", insttId, e);
            return null;
        }
    }

    public List<InsttFileVO> loadInsttFilesByInsttId(String insttId) {
        if (safeString(insttId).isEmpty()) {
            return Collections.emptyList();
        }
        try {
            List<InsttFileVO> fileList = entrprsManageService.selectInsttFiles(insttId);
            return fileList == null ? Collections.emptyList() : fileList;
        } catch (Exception e) {
            log.warn("Failed to load institution file list. insttId={}", insttId, e);
            return Collections.emptyList();
        }
    }

    public boolean hasValidInsttEvidenceFiles(List<MultipartFile> fileUploads) {
        if (fileUploads == null || fileUploads.isEmpty()) {
            return false;
        }
        boolean hasRealFile = false;
        for (MultipartFile file : fileUploads) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            hasRealFile = true;
            String name = safeString(file.getOriginalFilename()).toLowerCase(Locale.ROOT);
            boolean extOk = name.endsWith(".pdf") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
            if (!extOk || file.getSize() > 10L * 1024L * 1024L) {
                return false;
            }
        }
        return hasRealFile;
    }

    public List<InsttFileVO> saveAdminInsttEvidenceFiles(String insttId, List<MultipartFile> fileUploads, int startFileSn) throws Exception {
        if (fileUploads == null || fileUploads.isEmpty()) {
            return Collections.emptyList();
        }
        String normalizedInsttId = InstitutionEvidenceFileSupport.requireInstitutionId(insttId);
        String projectId = projectRuntimeContext == null ? "" : safeString(projectRuntimeContext.getProjectId());
        if (projectId.isEmpty()) {
            throw new IllegalStateException("Project context is required for institution evidence storage.");
        }
        String safeProjectId = projectId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (safeProjectId.isEmpty()) {
            throw new IllegalStateException("Project context cannot be converted to a safe storage key.");
        }
        File dir = resolveInsttUploadDir();
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Cannot create upload directory: " + dir.getAbsolutePath());
        }

        List<InsttFileVO> savedFiles = new ArrayList<>();
        try {
            for (MultipartFile file : fileUploads) {
                if (file == null || file.isEmpty()) {
                    continue;
                }
                String originalFileName = safeString(file.getOriginalFilename());
                String ext = "";
                int lastDotIndex = originalFileName.lastIndexOf('.');
                if (lastDotIndex > -1) {
                    ext = InstitutionEvidenceFileSupport.normalizeExtension(originalFileName.substring(lastDotIndex));
                }
                String objectToken = InstitutionEvidenceFileSupport.newObjectToken();
                String newFileName = InstitutionEvidenceFileSupport.storageFileName(projectId, objectToken, ext);
                Path targetPath = dir.toPath().resolve(newFileName);
                Path stagingPath = Files.createTempFile(
                        dir.toPath(), safeProjectId + "_" + objectToken + "_", ".part");
                try {
                    file.transferTo(stagingPath.toFile());
                    String sha256 = InstitutionEvidenceFileSupport.sha256(stagingPath);
                    InstitutionEvidenceFileSupport.moveStagedFile(stagingPath, targetPath);

                    InsttFileVO fileVO = new InsttFileVO();
                    fileVO.setFileId(InstitutionEvidenceFileSupport.fileId(objectToken));
                    fileVO.setInsttId(normalizedInsttId);
                    fileVO.setProjectId(projectId);
                    fileVO.setScopeStatus("SCOPED");
                    fileVO.setFileSha256(sha256);
                    fileVO.setFileSn(startFileSn + savedFiles.size());
                    fileVO.setStreFileNm(newFileName);
                    fileVO.setOrignlFileNm(originalFileName.isEmpty() ? newFileName : originalFileName);
                    fileVO.setFileStrePath(targetPath.toAbsolutePath().toString());
                    fileVO.setFileMg(Files.size(targetPath));
                    fileVO.setFileExtsn(ext);
                    fileVO.setFileCn(file.getContentType());
                    savedFiles.add(fileVO);
                } catch (Exception fileError) {
                    Files.deleteIfExists(stagingPath);
                    Files.deleteIfExists(targetPath);
                    throw fileError;
                }
            }
            return savedFiles;
        } catch (Exception saveError) {
            cleanupInsttEvidenceFiles(savedFiles);
            throw saveError;
        }
    }

    public void cleanupInsttEvidenceFiles(List<InsttFileVO> files) {
        InstitutionEvidenceFileSupport.cleanup(files);
    }

    public String joinInsttEvidencePaths(List<InsttFileVO> fileList) {
        if (fileList == null || fileList.isEmpty()) {
            return "";
        }
        List<String> paths = new ArrayList<>();
        for (InsttFileVO fileVO : fileList) {
            if (fileVO != null && !safeString(fileVO.getFileStrePath()).isEmpty()) {
                paths.add(safeString(fileVO.getFileStrePath()));
            }
        }
        return String.join(",", paths);
    }

    public String createInstitutionId() {
        String generated = "INSTT_" + System.currentTimeMillis();
        return generated.length() > 20 ? generated.substring(0, 20) : generated;
    }

    public String normalizeMembershipCode(String membershipType) {
        String normalized = safeString(membershipType).toUpperCase(Locale.ROOT);
        if ("EMITTER".equals(normalized) || "EMITTER_COMPANY".equals(normalized)) {
            return "E";
        }
        if ("PROJECT".equals(normalized) || "PROJECT_COMPANY".equals(normalized) || "PERFORMER".equals(normalized)) {
            return "P";
        }
        if ("CENTER".equals(normalized) || "PROMOTION_CENTER".equals(normalized)) {
            return "C";
        }
        if ("GOVERNMENT".equals(normalized) || "AGENCY".equals(normalized) || "GOV".equals(normalized)) {
            return "G";
        }
        return normalized;
    }

    public boolean isValidEmail(String email) {
        String value = safeString(email);
        return !value.isEmpty() && value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    public String digitsOnly(String value) {
        return safeString(value).replaceAll("[^0-9]", "");
    }

    public String trimToLen(String value, int maxLen) {
        String normalized = safeString(value);
        return normalized.length() <= maxLen ? normalized : normalized.substring(0, maxLen);
    }

    public String safeString(String value) {
        return adminAuthorityPagePayloadSupport.safeValue(value);
    }

    private String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    private File resolveInsttUploadDir() {
        String path = safeString(System.getProperty("carbosys.file.instt.dir"));
        if (path.isEmpty()) {
            path = safeString(System.getenv("CARBONET_FILE_INSTT_DIR"));
        }
        if (path.isEmpty()) {
            path = "./var/file/instt";
        }
        return new File(path).getAbsoluteFile();
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }
}
