package egovframework.com.feature.download;

import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;

@Slf4j
@RestController
@RequestMapping("/api/mobile")
public class MobileDownloadController {

    @Value("${app.mobile.apk.path:/opt/Resonance/projects/carbonet-assets/static/download}")
    private String apkPath;

    @GetMapping("/download/carbonet.apk")
    public Resource downloadApk(HttpServletResponse response) {
        try {
            File apkFile = new File(apkPath, "CarbonetMobile.apk");
            if (!apkFile.exists()) {
                apkFile = new File("/opt/Resonance/projects/egovframe-mobile-device-api/device-api-app/build/app/outputs/flutter-apk/app-release.apk");
            }
            if (!apkFile.exists()) {
                response.setStatus(HttpServletResponse.SC_NOT_FOUND);
                return null;
            }

            Resource resource = new FileSystemResource(apkFile);

            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=CarbonetMobile.apk");
            headers.add("Content-Type", "application/vnd.android.package-archive");

            return resource;
        } catch (Exception e) {
            log.error("APK download error", e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            return null;
        }
    }

    @GetMapping("/download/carbonet.apk/info")
    public java.util.Map<String, Object> getApkInfo() {
        java.util.Map<String, Object> info = new java.util.LinkedHashMap<>();
        try {
            File apkFile = new File(apkPath, "CarbonetMobile.apk");
            if (!apkFile.exists()) {
                apkFile = new File("/opt/Resonance/projects/egovframe-mobile-device-api/device-api-app/build/app/outputs/flutter-apk/app-release.apk");
            }
            if (apkFile.exists()) {
                info.put("exists", true);
                info.put("size", apkFile.length());
                info.put("sizeMB", apkFile.length() / (1024 * 1024));
                info.put("lastModified", new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(apkFile.lastModified()));
            } else {
                info.put("exists", false);
            }
        } catch (Exception e) {
            info.put("exists", false);
            info.put("error", e.getMessage());
        }
        return info;
    }
}