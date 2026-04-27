package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminMemberAccessSupport {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberAccessSupport.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;

    public EntrprsManageVO loadMemberById(String memberId) throws Exception {
        return entrprsManageService.selectEntrprsmberByMberId(memberId);
    }

    public boolean canCurrentAdminAccessMember(HttpServletRequest request, EntrprsManageVO member) {
        return canCurrentAdminAccessInsttId(request, member == null ? "" : member.getInsttId());
    }

    public boolean canCurrentAdminAccessInsttId(HttpServletRequest request, String targetInsttId) {
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (authorityPagePayloadSupport.hasGlobalDeptRoleAccess(currentUserId, currentUserAuthorCode)) {
            return true;
        }
        if (!authorityPagePayloadSupport.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode)) {
            return false;
        }
        String currentUserInsttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        String normalizedTargetInsttId = authorityPagePayloadSupport.safeValue(targetInsttId);
        return !currentUserInsttId.isEmpty() && currentUserInsttId.equals(normalizedTargetInsttId);
    }

    public boolean canAccessInstitutionFiles(HttpServletRequest request) {
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        return authorityPagePayloadSupport.hasGlobalDeptRoleAccess(currentUserId, currentUserAuthorCode);
    }

    public String resolveMemberFileInsttId(String fileId) {
        String normalizedFileId = authorityPagePayloadSupport.safeValue(fileId);
        if (normalizedFileId.isEmpty()) {
            return "";
        }
        try {
            EntrprsMberFileVO memberFile = entrprsManageService.selectEntrprsMberFileByFileId(normalizedFileId);
            if (memberFile == null || authorityPagePayloadSupport.safeValue(memberFile.getEntrprsmberId()).isEmpty()) {
                return "";
            }
            EntrprsManageVO member = entrprsManageService.selectEntrprsmberByMberId(memberFile.getEntrprsmberId());
            return member == null ? "" : authorityPagePayloadSupport.safeValue(member.getInsttId());
        } catch (Exception e) {
            log.warn("Failed to resolve member file institution. fileId={}", normalizedFileId, e);
            return "";
        }
    }

    public File resolveMemberFile(String fileId) {
        String normalizedFileId = authorityPagePayloadSupport.safeValue(fileId);
        if (normalizedFileId.isEmpty()) {
            return null;
        }
        try {
            EntrprsMberFileVO fileVO = entrprsManageService.selectEntrprsMberFileByFileId(normalizedFileId);
            if (fileVO == null || authorityPagePayloadSupport.safeValue(fileVO.getFileStrePath()).isEmpty()) {
                return null;
            }
            return new File(fileVO.getFileStrePath());
        } catch (Exception ignore) {
            return null;
        }
    }

    public File resolveInstitutionFile(String fileId) {
        String normalizedFileId = authorityPagePayloadSupport.safeValue(fileId);
        if (normalizedFileId.isEmpty()) {
            return null;
        }
        try {
            InsttFileVO fileVO = entrprsManageService.selectInsttFileByFileId(normalizedFileId);
            if (fileVO == null || authorityPagePayloadSupport.safeValue(fileVO.getFileStrePath()).isEmpty()) {
                return null;
            }
            return new File(fileVO.getFileStrePath());
        } catch (Exception ignore) {
            return null;
        }
    }

    public boolean isAllowedFilePath(String canonicalPath) {
        List<String> roots = new ArrayList<>();
        String byProp = authorityPagePayloadSupport.safeValue(System.getProperty("carbosys.file.root"));
        String byEnv = authorityPagePayloadSupport.safeValue(System.getenv("CARBONET_FILE_ROOT"));
        if (!byProp.isEmpty()) {
            roots.add(byProp);
        } else if (!byEnv.isEmpty()) {
            roots.add(byEnv);
        } else {
            roots.add("./file");
        }
        roots.add("/srv/file/carbosys");

        for (String root : roots) {
            try {
                String prefix = new File(root).getCanonicalPath();
                if (canonicalPath.startsWith(prefix + File.separator) || canonicalPath.equals(prefix)) {
                    return true;
                }
            } catch (Exception ignore) {
                // Ignore invalid roots and continue checking the remaining candidates.
            }
        }
        return false;
    }

    public String resolveMediaType(String fileName) {
        String lower = authorityPagePayloadSupport.safeValue(fileName).toLowerCase(Locale.ROOT);
        if (lower.endsWith(".pdf")) {
            return MediaType.APPLICATION_PDF_VALUE;
        }
        if (lower.endsWith(".png")) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG_VALUE;
        }
        if (lower.endsWith(".gif")) {
            return MediaType.IMAGE_GIF_VALUE;
        }
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}
