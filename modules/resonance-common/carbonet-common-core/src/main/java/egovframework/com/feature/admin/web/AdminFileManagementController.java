package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.AdminFileManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.util.Locale;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class AdminFileManagementController {

    private final AdminFileManagementService adminFileManagementService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = {"/admin/content/file"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String fileManagement(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "file-management");
    }

    @RequestMapping(value = {"/en/admin/content/file"}, method = {RequestMethod.GET, RequestMethod.POST})
    public String fileManagementEn(HttpServletRequest request, Locale locale) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, "file-management");
    }

    @GetMapping("/admin/api/admin/content/file")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> fileManagementApi(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "fileId", required = false) String fileId) {
        return ResponseEntity.ok(adminFileManagementService.buildPagePayload(searchKeyword, status, visibility, fileId, false));
    }

    @GetMapping("/en/admin/api/admin/content/file")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> fileManagementApiEn(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "fileId", required = false) String fileId) {
        return ResponseEntity.ok(adminFileManagementService.buildPagePayload(searchKeyword, status, visibility, fileId, true));
    }

    @GetMapping("/admin/api/admin/content/file/download")
    public void downloadFileManagementApi(
            @RequestParam(value = "fileId", required = false) String fileId,
            HttpServletResponse response) throws Exception {
        streamDownload(fileId, false, response);
    }

    @GetMapping("/en/admin/api/admin/content/file/download")
    public void downloadFileManagementApiEn(
            @RequestParam(value = "fileId", required = false) String fileId,
            HttpServletResponse response) throws Exception {
        streamDownload(fileId, true, response);
    }

    @PostMapping("/admin/api/admin/content/file/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveFileManagementApi(
            @RequestParam(value = "uploadFile", required = false) MultipartFile uploadFile,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "description", required = false) String description) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.saveFile(uploadFile, category, visibility, status, description, false));
    }

    @PostMapping("/en/admin/api/admin/content/file/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveFileManagementApiEn(
            @RequestParam(value = "uploadFile", required = false) MultipartFile uploadFile,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "description", required = false) String description) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.saveFile(uploadFile, category, visibility, status, description, true));
    }

    @PostMapping("/admin/api/admin/content/file/replace")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> replaceFileManagementApi(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "uploadFile", required = false) MultipartFile uploadFile) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.replaceFile(fileId, uploadFile, false));
    }

    @PostMapping("/en/admin/api/admin/content/file/replace")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> replaceFileManagementApiEn(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "uploadFile", required = false) MultipartFile uploadFile) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.replaceFile(fileId, uploadFile, true));
    }

    @PostMapping("/admin/api/admin/content/file/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateFileManagementApi(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "description", required = false) String description) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.updateFile(fileId, category, visibility, status, description, false));
    }

    @PostMapping("/en/admin/api/admin/content/file/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateFileManagementApiEn(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "description", required = false) String description) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.updateFile(fileId, category, visibility, status, description, true));
    }

    @PostMapping("/admin/api/admin/content/file/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteFileManagementApi(
            @RequestParam(value = "fileId", required = false) String fileId) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.deleteFile(fileId, false));
    }

    @PostMapping("/en/admin/api/admin/content/file/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteFileManagementApiEn(
            @RequestParam(value = "fileId", required = false) String fileId) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.deleteFile(fileId, true));
    }

    @PostMapping("/admin/api/admin/content/file/restore")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> restoreFileManagementApi(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "restoreNote", required = false) String restoreNote) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.restoreDeletedFile(fileId, restoreNote, false));
    }

    @PostMapping("/en/admin/api/admin/content/file/restore")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> restoreFileManagementApiEn(
            @RequestParam(value = "fileId", required = false) String fileId,
            @RequestParam(value = "restoreNote", required = false) String restoreNote) throws Exception {
        return ResponseEntity.ok(adminFileManagementService.restoreDeletedFile(fileId, restoreNote, true));
    }

    private void streamDownload(String fileId, boolean isEn, HttpServletResponse response) throws Exception {
        try {
            AdminFileManagementService.DownloadTarget target = adminFileManagementService.prepareDownload(fileId, isEn);
            response.setContentType("application/octet-stream");
            response.setHeader("Content-Disposition",
                    "attachment; filename=\"" + URLEncoder.encode(target.getFileName(), "UTF-8") + "\"");
            try (FileInputStream fis = new FileInputStream(target.getPath().toFile());
                 OutputStream os = response.getOutputStream()) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                }
                os.flush();
            }
        } catch (IllegalArgumentException exception) {
            response.sendError(404, exception.getMessage());
        }
    }
}
