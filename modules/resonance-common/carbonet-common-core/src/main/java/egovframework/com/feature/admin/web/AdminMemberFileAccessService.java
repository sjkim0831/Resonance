package egovframework.com.feature.admin.web;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.net.URLEncoder;

@Service
@RequiredArgsConstructor
public class AdminMemberFileAccessService {

    private final AdminMemberAccessSupport adminMemberAccessSupport;

    public void serveMemberFile(
            String fileId,
            String download,
            HttpServletRequest request,
            HttpServletResponse response) throws Exception {
        String targetInsttId = adminMemberAccessSupport.resolveMemberFileInsttId(fileId);
        if (!adminMemberAccessSupport.canCurrentAdminAccessInsttId(request, targetInsttId)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        File file = adminMemberAccessSupport.resolveMemberFile(fileId);
        streamResolvedFile(file, download, response);
    }

    public void serveCompanyFile(
            String fileId,
            String download,
            HttpServletRequest request,
            HttpServletResponse response) throws Exception {
        if (!adminMemberAccessSupport.canAccessInstitutionFiles(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        File file = adminMemberAccessSupport.resolveInstitutionFile(fileId);
        streamResolvedFile(file, download, response);
    }

    private void streamResolvedFile(
            File file,
            String download,
            HttpServletResponse response) throws Exception {
        if (file == null) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "File not found or access denied.");
            return;
        }
        String canonicalPath = file.getCanonicalPath();
        if (!file.exists() || !adminMemberAccessSupport.isAllowedFilePath(canonicalPath)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, "File not found or access denied.");
            return;
        }
        boolean forceDownload = "true".equalsIgnoreCase(download == null ? "" : download.trim());
        String fileName = file.getName();
        response.setContentType(adminMemberAccessSupport.resolveMediaType(fileName));
        response.setHeader(
                "Content-Disposition",
                (forceDownload ? "attachment" : "inline") + "; filename=\""
                        + URLEncoder.encode(fileName, "UTF-8") + "\"");

        try (FileInputStream fis = new FileInputStream(file); OutputStream os = response.getOutputStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
            os.flush();
        }
    }
}
