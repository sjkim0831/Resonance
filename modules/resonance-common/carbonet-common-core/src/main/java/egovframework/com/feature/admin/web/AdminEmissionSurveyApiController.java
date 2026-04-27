package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.EmissionSurveyCaseSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDatasetReplaceRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDraftSetSaveRequest;
import egovframework.com.feature.admin.service.AdminEmissionSurveyWorkbookService;
import egovframework.com.feature.admin.service.EmissionClassificationCatalogService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class AdminEmissionSurveyApiController {

    private static final String DEFAULT_WORKBOOK_NAME = "데이터 수집 설문지 excel 양식_steel, electric, low-alloy.xlsx";
    private static final String BLANK_WORKBOOK_NAME = "데이터 수집 설문지 blank 양식_steel, electric, low-alloy.xlsx";
    private static final String SAMPLE_WORKBOOK_NAME = "데이터 수집 설문지 sample 양식_steel, electric, low-alloy.xlsx";
    private static final String ADMIN_BLANK_WORKBOOK_NAME = "관리자 업로드 양식_빈양식.xlsx";
    private static final Path WORKSPACE_SAMPLE = Path.of("/opt/Resonance", DEFAULT_WORKBOOK_NAME);
    private static final Path REFERENCE_SAMPLE = Path.of("/opt/reference/수식 설계 요", DEFAULT_WORKBOOK_NAME);

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminEmissionSurveyWorkbookService adminEmissionSurveyWorkbookService;
    private final EmissionClassificationCatalogService emissionClassificationCatalogService;
    private final CurrentUserContextService currentUserContextService;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping({
            "/admin/emission/survey-admin/page-data",
            "/en/admin/emission/survey-admin/page-data"
    })
    public ResponseEntity<Map<String, Object>> getPageData(@RequestParam(value = "productName", required = false) String productName,
                                                           HttpServletRequest request) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.getPagePayload(resolveActorId(request), productName, isEn);
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @GetMapping({
            "/admin/emission/survey-admin-data/page-data",
            "/en/admin/emission/survey-admin-data/page-data"
    })
    public ResponseEntity<Map<String, Object>> getDataPageData(@RequestParam(value = "lciMajorCode", required = false) String lciMajorCode,
                                                               @RequestParam(value = "lciMiddleCode", required = false) String lciMiddleCode,
                                                               @RequestParam(value = "lciSmallCode", required = false) String lciSmallCode,
                                                               @RequestParam(value = "status", required = false) String status,
                                                               @RequestParam(value = "datasetId", required = false) String datasetId,
                                                               @RequestParam(value = "logId", required = false) String logId,
                                                               @RequestParam(value = "pageIndex", required = false) String pageIndex,
                                                               @RequestParam(value = "pageSize", required = false) String pageSize,
                                                               HttpServletRequest request) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.getDataPagePayload(
                resolveActorId(request),
                lciMajorCode,
                lciMiddleCode,
                lciSmallCode,
                status,
                datasetId,
                logId,
                parsePositiveInt(pageIndex, 1),
                parsePositiveInt(pageSize, 10),
                isEn
        );
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @GetMapping({
            "/api/admin/emission-survey-admin/template-download",
            "/admin/api/admin/emission-survey-admin/template-download",
            "/en/admin/api/admin/emission-survey-admin/template-download"
    })
    public ResponseEntity<Resource> downloadTemplate() throws Exception {
        byte[] workbookBytes = adminEmissionSurveyWorkbookService.buildBlankTemplateBytes();
        return buildWorkbookResponse(workbookBytes, BLANK_WORKBOOK_NAME);
    }

    @GetMapping({
            "/api/admin/emission-survey-admin/sample-download",
            "/admin/api/admin/emission-survey-admin/sample-download",
            "/en/admin/api/admin/emission-survey-admin/sample-download"
    })
    public ResponseEntity<Resource> downloadSampleTemplate() throws Exception {
        Path templatePath = resolveTemplatePath();
        if (templatePath == null || !Files.exists(templatePath)) {
            return ResponseEntity.notFound().build();
        }
        InputStream inputStream = Files.newInputStream(templatePath);
        String fileName = SAMPLE_WORKBOOK_NAME;
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(Files.size(templatePath))
                .body(new InputStreamResource(inputStream));
    }

    @GetMapping({
            "/api/admin/emission-survey-admin/admin-template-download",
            "/admin/api/admin/emission-survey-admin/admin-template-download",
            "/en/admin/api/admin/emission-survey-admin/admin-template-download"
    })
    public ResponseEntity<Resource> downloadAdminTemplate() throws Exception {
        byte[] workbookBytes = adminEmissionSurveyWorkbookService.buildAdminUploadBlankTemplateBytes();
        return buildWorkbookResponse(workbookBytes, ADMIN_BLANK_WORKBOOK_NAME);
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/parse-workbook",
            "/admin/api/admin/emission-survey-admin/parse-workbook",
            "/en/admin/api/admin/emission-survey-admin/parse-workbook"
    })
    public ResponseEntity<Map<String, Object>> parseWorkbook(@RequestParam("uploadFile") MultipartFile uploadFile,
                                                             @RequestParam(value = "lciMajorCode", required = false) String lciMajorCode,
                                                             @RequestParam(value = "lciMajorLabel", required = false) String lciMajorLabel,
                                                             @RequestParam(value = "lciMiddleCode", required = false) String lciMiddleCode,
                                                             @RequestParam(value = "lciMiddleLabel", required = false) String lciMiddleLabel,
                                                             @RequestParam(value = "lciSmallCode", required = false) String lciSmallCode,
                                                             @RequestParam(value = "lciSmallLabel", required = false) String lciSmallLabel,
                                                             HttpServletRequest request) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.parseWorkbook(
                uploadFile,
                resolveActorId(request),
                lciMajorCode,
                lciMajorLabel,
                lciMiddleCode,
                lciMiddleLabel,
                lciSmallCode,
                lciSmallLabel,
                isEn
        );
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/preview-shared-dataset",
            "/admin/api/admin/emission-survey-admin/preview-shared-dataset",
            "/en/admin/api/admin/emission-survey-admin/preview-shared-dataset"
    })
    public ResponseEntity<Map<String, Object>> previewSharedDataset(@RequestParam("uploadFile") MultipartFile uploadFile,
                                                                    HttpServletRequest request) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.previewSharedDatasetWorkbook(uploadFile, isEn);
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/replace-shared-dataset",
            "/admin/api/admin/emission-survey-admin/replace-shared-dataset",
            "/en/admin/api/admin/emission-survey-admin/replace-shared-dataset"
    })
    public ResponseEntity<Map<String, Object>> replaceSharedDataset(@RequestParam("uploadFile") MultipartFile uploadFile,
                                                                    HttpServletRequest request) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.replaceSharedDatasetWorkbook(uploadFile, isEn);
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/replace-shared-dataset-sections",
            "/admin/api/admin/emission-survey-admin/replace-shared-dataset-sections",
            "/en/admin/api/admin/emission-survey-admin/replace-shared-dataset-sections"
    })
    public ResponseEntity<Map<String, Object>> replaceSharedDatasetSections(@RequestBody EmissionSurveyDatasetReplaceRequest request,
                                                                            HttpServletRequest httpServletRequest) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(httpServletRequest, null);
        Map<String, Object> payload = adminEmissionSurveyWorkbookService.replaceSharedDatasetSections(request, isEn);
        payload.put("classificationCatalog", emissionClassificationCatalogService.buildPayload(isEn));
        return ResponseEntity.ok(payload);
    }

    @GetMapping({
            "/api/admin/emission-survey-admin/case-drafts/by-classification",
            "/admin/api/admin/emission-survey-admin/case-drafts/by-classification",
            "/en/admin/api/admin/emission-survey-admin/case-drafts/by-classification"
    })
    public ResponseEntity<Map<String, Object>> loadCaseDraftsByClassification(@RequestParam("lciMajorCode") String lciMajorCode,
                                                                              @RequestParam("lciMiddleCode") String lciMiddleCode,
                                                                              @RequestParam("lciSmallCode") String lciSmallCode,
                                                                              @RequestParam("caseCode") String caseCode,
                                                                              @RequestParam(value = "productName", required = false) String productName,
                                                                              HttpServletRequest request) {
        return ResponseEntity.ok(adminEmissionSurveyWorkbookService.loadClassificationCaseDrafts(
                lciMajorCode,
                lciMiddleCode,
                lciSmallCode,
                caseCode,
                productName,
                resolveActorId(request),
                adminReactRouteSupport.isEnglishRequest(request, null)
        ));
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/case-drafts",
            "/admin/api/admin/emission-survey-admin/case-drafts",
            "/en/admin/api/admin/emission-survey-admin/case-drafts"
    })
    public ResponseEntity<Map<String, Object>> saveCaseDraft(@RequestBody EmissionSurveyCaseSaveRequest request,
                                                             HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(adminEmissionSurveyWorkbookService.saveCaseDraft(
                request,
                resolveActorId(httpServletRequest),
                adminReactRouteSupport.isEnglishRequest(httpServletRequest, null)
        ));
    }

    @PostMapping({
            "/api/admin/emission-survey-admin/draft-sets",
            "/admin/api/admin/emission-survey-admin/draft-sets",
            "/en/admin/api/admin/emission-survey-admin/draft-sets"
    })
    public ResponseEntity<Map<String, Object>> saveDraftSet(@RequestBody EmissionSurveyDraftSetSaveRequest request,
                                                            HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(adminEmissionSurveyWorkbookService.saveDraftSet(
                request,
                resolveActorId(httpServletRequest),
                adminReactRouteSupport.isEnglishRequest(httpServletRequest, null)
        ));
    }

    @DeleteMapping({
            "/api/admin/emission-survey-admin/case-drafts",
            "/admin/api/admin/emission-survey-admin/case-drafts",
            "/en/admin/api/admin/emission-survey-admin/case-drafts"
    })
    public ResponseEntity<Map<String, Object>> deleteCaseDraft(@RequestParam("sectionCode") String sectionCode,
                                                               @RequestParam("caseCode") String caseCode,
                                                               @RequestParam(value = "productName", required = false) String productName,
                                                               HttpServletRequest request) {
        return ResponseEntity.ok(adminEmissionSurveyWorkbookService.deleteCaseDraft(
                sectionCode,
                caseCode,
                productName,
                resolveActorId(request),
                adminReactRouteSupport.isEnglishRequest(request, null)));
    }

    @DeleteMapping({
            "/api/admin/emission-survey-admin/draft-sets",
            "/admin/api/admin/emission-survey-admin/draft-sets",
            "/en/admin/api/admin/emission-survey-admin/draft-sets"
    })
    public ResponseEntity<Map<String, Object>> deleteDraftSet(@RequestParam("setId") String setId,
                                                              HttpServletRequest request) {
        return ResponseEntity.ok(adminEmissionSurveyWorkbookService.deleteDraftSet(
                setId,
                adminReactRouteSupport.isEnglishRequest(request, null)));
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", exception.getMessage()));
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                for (String methodName : new String[]{"getId", "getUserId", "getUniqId"}) {
                    try {
                        Object value = loginVO.getClass().getMethod(methodName).invoke(loginVO);
                        if (value != null && !value.toString().trim().isEmpty()) {
                            return value.toString();
                        }
                    } catch (Exception ignored) {
                        // Try the next candidate accessor.
                    }
                }
            }
        }
        String tokenUserId = resolveActorIdFromAccessToken(request);
        if (!tokenUserId.isEmpty()) {
            return tokenUserId;
        }
        String actorRole = resolveActorRole(request);
        if ("ROLE_SYSTEM_MASTER".equalsIgnoreCase(actorRole)) {
            return "webmaster";
        }
        try {
            return safe(currentUserContextService.resolve(request).getUserId());
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveActorRole(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
                    if (value != null && !value.toString().trim().isEmpty()) {
                        return value.toString();
                    }
                } catch (Exception ignored) {
                    // Fall through.
                }
            }
        }
        try {
            return safe(currentUserContextService.resolve(request).getAuthorCode());
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveActorIdFromAccessToken(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        try {
            String accessToken = jwtTokenProvider.getCookie(request, "accessToken");
            if (accessToken == null || accessToken.trim().isEmpty()) {
                return "";
            }
            Object encryptedUserId = jwtTokenProvider.accessExtractClaims(accessToken).get("userId");
            if (encryptedUserId == null || encryptedUserId.toString().trim().isEmpty()) {
                return "";
            }
            return safe(jwtTokenProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception ignored) {
            return "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private int parsePositiveInt(String rawValue, int fallbackValue) {
        String normalized = safe(rawValue);
        if (normalized.isEmpty()) {
            return fallbackValue;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed > 0 ? parsed : fallbackValue;
        } catch (NumberFormatException ignored) {
            return fallbackValue;
        }
    }

    private Path resolveTemplatePath() {
        if (Files.exists(REFERENCE_SAMPLE)) {
            return REFERENCE_SAMPLE;
        }
        if (Files.exists(WORKSPACE_SAMPLE)) {
            return WORKSPACE_SAMPLE;
        }
        return null;
    }

    private ResponseEntity<Resource> buildWorkbookResponse(byte[] workbookBytes, String fileName) throws Exception {
        String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(workbookBytes.length)
                .body(new InputStreamResource(new ByteArrayInputStream(workbookBytes)));
    }
}
