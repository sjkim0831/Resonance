package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.ReportVerificationRegistryService;
import egovframework.com.feature.admin.service.ReportProofreadingService;
import egovframework.com.feature.admin.service.ReportPdfIssuanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ReportVerificationRegistryController {

    private final ReportVerificationRegistryService reportVerificationRegistryService;
    private final ReportProofreadingService reportProofreadingService;
    private final ReportPdfIssuanceService reportPdfIssuanceService;

    @PostMapping({
            "/api/admin/emission-survey-report/issue",
            "/admin/api/admin/emission-survey-report/issue",
            "/en/admin/api/admin/emission-survey-report/issue"
    })
    public ResponseEntity<Map<String, Object>> issue(@RequestBody Map<String, Object> payload,
                                                      HttpServletRequest request) {
        return ResponseEntity.ok(reportVerificationRegistryService.issue(payload, resolveActorId(request)));
    }

    @PostMapping({
            "/api/admin/emission-survey-report/issue-pdf",
            "/admin/api/admin/emission-survey-report/issue-pdf",
            "/en/admin/api/admin/emission-survey-report/issue-pdf"
    })
    public ResponseEntity<byte[]> issuePdf(@RequestBody Map<String, Object> payload,
                                            HttpServletRequest request) {
        ReportPdfIssuanceService.IssuedPdf issued = reportPdfIssuanceService.issue(payload, resolveActorId(request));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=carbonet-report-" + issued.certificateId() + ".pdf")
                .header("X-Carbonet-Certificate-Id", issued.certificateId())
                .header("X-Carbonet-Visual-Pages", String.valueOf(issued.pageCount()))
                .header("X-Carbonet-Pdf-Sha256", issued.pdfSha256())
                .body(issued.bytes());
    }

    @PostMapping({
            "/api/admin/emission-survey-report/proofread",
            "/admin/api/admin/emission-survey-report/proofread",
            "/en/admin/api/admin/emission-survey-report/proofread"
    })
    public ResponseEntity<Map<String, Object>> proofread(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(reportProofreadingService.proofread(payload));
    }

    @PostMapping({
            "/api/home/certificate-verify/verify",
            "/api/en/home/certificate-verify/verify",
            "/api/admin/emission-survey-report/verify",
            "/admin/api/admin/emission-survey-report/verify",
            "/en/admin/api/admin/emission-survey-report/verify"
    })
    public ResponseEntity<Map<String, Object>> verify(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(reportVerificationRegistryService.verify(payload));
    }

    @PostMapping(value = {
            "/api/home/certificate-verify/verify-file",
            "/api/en/home/certificate-verify/verify-file",
            "/api/admin/emission-survey-report/verify-file",
            "/admin/api/admin/emission-survey-report/verify-file",
            "/en/admin/api/admin/emission-survey-report/verify-file"
    }, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> verifyPdfFile(@RequestParam("certificateId") String certificateId,
                                                              @RequestPart("file") MultipartFile file) {
        if (file.getSize() > ReportVerificationRegistryService.MAX_VERIFICATION_PDF_BYTES) {
            return ResponseEntity.badRequest().body(invalidPdfResult(certificateId,
                    "The uploaded PDF exceeds the 25 MB verification limit."));
        }
        try {
            return ResponseEntity.ok(reportVerificationRegistryService.verifyPdfFile(certificateId, file.getBytes()));
        } catch (IOException exception) {
            return ResponseEntity.badRequest().body(invalidPdfResult(certificateId,
                    "The uploaded PDF could not be read."));
        }
    }

    @PostMapping(value = {
            "/admin/api/admin/emission-survey-report/register-issued-pdf",
            "/en/admin/api/admin/emission-survey-report/register-issued-pdf"
    }, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> registerIssuedPdf(@RequestParam("certificateId") String certificateId,
                                                                  @RequestPart("file") MultipartFile file,
                                                                  HttpServletRequest request) {
        if (file.getSize() > ReportVerificationRegistryService.MAX_VERIFICATION_PDF_BYTES) {
            return ResponseEntity.badRequest().body(invalidPdfResult(certificateId,
                    "The trusted PDF exceeds the 25 MB registration limit."));
        }
        try {
            String actorId = resolveActorId(request);
            if ("anonymous".equals(actorId)) {
                Map<String, Object> response = invalidPdfResult(certificateId,
                        "An authenticated administrator is required to register trusted PDF bytes.");
                response.put("status", "PDF_FINGERPRINT_BIND_FORBIDDEN");
                return ResponseEntity.status(403).body(response);
            }
            return ResponseEntity.ok(reportVerificationRegistryService.bindIssuedPdfFingerprint(
                    certificateId, file.getBytes(), actorId));
        } catch (IOException | RuntimeException exception) {
            Map<String, Object> response = invalidPdfResult(certificateId, exception.getMessage());
            response.put("status", "PDF_FINGERPRINT_BIND_REJECTED");
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping({
            "/api/admin/emission-survey-report/visual-profile",
            "/admin/api/admin/emission-survey-report/visual-profile",
            "/en/admin/api/admin/emission-survey-report/visual-profile"
    })
    public ResponseEntity<Map<String, Object>> registerVisualProfile(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(reportVerificationRegistryService.registerVisualProfile(payload));
    }

    @PostMapping({
            "/api/home/certificate-verify/verify-ocr",
            "/api/en/home/certificate-verify/verify-ocr",
            "/api/admin/emission-survey-report/verify-ocr",
            "/admin/api/admin/emission-survey-report/verify-ocr",
            "/en/admin/api/admin/emission-survey-report/verify-ocr"
    })
    public ResponseEntity<Map<String, Object>> verifyOcr(@RequestBody Map<String, Object> payload) {
        return ResponseEntity.ok(reportVerificationRegistryService.verifyOcr(payload));
    }

    private String resolveActorId(HttpServletRequest request) {
        try {
            if (request.getUserPrincipal() != null && request.getUserPrincipal().getName() != null
                    && !request.getUserPrincipal().getName().isBlank()) {
                return request.getUserPrincipal().getName().trim();
            }
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null
                    && !authentication.getName().isBlank() && !"anonymousUser".equals(authentication.getName())) {
                return authentication.getName().trim();
            }
            return "anonymous";
        } catch (Exception exception) {
            return "anonymous";
        }
    }

    private Map<String, Object> invalidPdfResult(String certificateId, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("valid", false);
        response.put("status", "INVALID_PDF");
        response.put("certificateId", certificateId == null ? "" : certificateId.trim());
        response.put("verificationMode", "EXACT_PDF_BYTES");
        response.put("message", message);
        return response;
    }
}
