package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.platform.governance.model.vo.ClassCodeVO;
import egovframework.com.platform.governance.model.vo.CommonCodeVO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.dbchange.model.DbChangeCaptureRequest;
import egovframework.com.platform.dbchange.service.DbChangeCaptureService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCodeManagementCommandService {

    private final AdminCodeManageService adminCodeManageService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final DbChangeCaptureService dbChangeCaptureService;
    private final ObjectMapper objectMapper;

    public String createClassCode(
            String clCode,
            String clCodeNm,
            String clCodeDc,
            String useAt,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String code = safeString(clCode).toUpperCase(Locale.ROOT);
        String name = safeString(clCodeNm);
        String desc = safeString(clCodeDc);
        String use = normalizeUseAt(useAt);
        String actorId = resolveActorId(request);
        if (code.isEmpty() || name.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Class code and name are required." : "분류 코드와 분류명은 필수입니다.");
        }
        try {
            boolean duplicate = adminCodeManageService.selectClassCodeList().stream()
                    .anyMatch(item -> code.equalsIgnoreCase(safeString(item == null ? null : item.getClCode())));
            if (duplicate) {
                return redirectCodeManagementError(request, locale, currentDetailCodeId,
                        isEn ? "The class code already exists." : "이미 등록된 분류 코드입니다.");
            }
        } catch (Exception e) {
            log.error("Failed to validate duplicate class code. clCode={}", code, e);
            return redirectCodeManagementError(request, locale, currentDetailCodeId,
                    isEn ? "Failed to validate class code duplication." : "분류 코드 중복 확인에 실패했습니다.");
        }
        try {
            adminCodeManageService.insertClassCode(code, name, desc, use, actorId);
            recordClassCodeChange(request, actorId, "INSERT", null, adminCodeManageService.selectClassCode(code));
        } catch (Exception e) {
            log.error("Failed to create class code. clCode={}", code, e);
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Failed to create class code." : "분류 코드 등록에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Class code has been created." : "분류 코드가 등록되었습니다.");
    }

    public String updateClassCode(
            String clCode,
            String clCodeNm,
            String clCodeDc,
            String useAt,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String code = safeString(clCode).toUpperCase(Locale.ROOT);
        String name = safeString(clCodeNm);
        String desc = safeString(clCodeDc);
        String use = normalizeUseAt(useAt);
        String actorId = resolveActorId(request);
        if (code.isEmpty() || name.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Class code and name are required." : "분류 코드와 분류명은 필수입니다.");
        }
        try {
            ClassCodeVO before = adminCodeManageService.selectClassCode(code);
            adminCodeManageService.updateClassCode(code, name, desc, use, actorId);
            recordClassCodeChange(request, actorId, "UPDATE", before, adminCodeManageService.selectClassCode(code));
        } catch (Exception e) {
            log.error("Failed to update class code. clCode={}", code, e);
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Failed to update class code." : "분류 코드 수정에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Class code has been updated." : "분류 코드가 수정되었습니다.");
    }

    public String deleteClassCode(
            String clCode,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String code = safeString(clCode).toUpperCase(Locale.ROOT);
        String actorId = resolveActorId(request);
        if (code.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Class code is required." : "분류 코드를 입력해 주세요.");
        }
        try {
            int refCount = adminCodeManageService.countCodesByClass(code);
            if (refCount > 0) {
                return redirectCodeManagementError(request, locale, null,
                        isEn ? "Cannot delete: codes are still linked." : "연결된 코드가 있어 삭제할 수 없습니다.");
            }
            ClassCodeVO before = adminCodeManageService.selectClassCode(code);
            adminCodeManageService.deleteClassCode(code);
            recordClassCodeChange(request, actorId, "DELETE", before, null);
        } catch (Exception e) {
            log.error("Failed to delete class code. clCode={}", code, e);
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Failed to delete class code." : "분류 코드 삭제에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Class code has been deleted." : "분류 코드가 삭제되었습니다.");
    }

    public String createCommonCode(
            String codeId,
            String codeIdNm,
            String codeIdDc,
            String clCode,
            String useAt,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String name = safeString(codeIdNm);
        String desc = safeString(codeIdDc);
        String cl = safeString(clCode).toUpperCase(Locale.ROOT);
        String use = normalizeUseAt(useAt);
        String actorId = resolveActorId(request);
        if (id.isEmpty() || name.isEmpty() || cl.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Code ID, name, and class code are required." : "코드 ID, 코드명, 분류 코드는 필수입니다.");
        }
        try {
            boolean duplicate = adminCodeManageService.selectCodeList().stream()
                    .anyMatch(item -> id.equalsIgnoreCase(safeString(item == null ? null : item.getCodeId())));
            if (duplicate) {
                return redirectCodeManagementError(request, locale, currentDetailCodeId,
                        isEn ? "The code ID already exists." : "이미 등록된 코드 ID입니다.");
            }
        } catch (Exception e) {
            log.error("Failed to validate duplicate code ID. codeId={}", id, e);
            return redirectCodeManagementError(request, locale, currentDetailCodeId,
                    isEn ? "Failed to validate code ID duplication." : "코드 ID 중복 확인에 실패했습니다.");
        }
        try {
            adminCodeManageService.insertCommonCode(id, name, desc, use, cl, actorId);
            recordCommonCodeChange(request, actorId, "INSERT", null, adminCodeManageService.selectCommonCode(id));
        } catch (Exception e) {
            log.error("Failed to create common code. codeId={}", id, e);
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Failed to create code ID." : "코드 ID 등록에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Code ID has been created." : "코드 ID가 등록되었습니다.");
    }

    public String updateCommonCode(
            String codeId,
            String codeIdNm,
            String codeIdDc,
            String clCode,
            String useAt,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String name = safeString(codeIdNm);
        String desc = safeString(codeIdDc);
        String cl = safeString(clCode).toUpperCase(Locale.ROOT);
        String use = normalizeUseAt(useAt);
        String actorId = resolveActorId(request);
        if (id.isEmpty() || name.isEmpty() || cl.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Code ID, name, and class code are required." : "코드 ID, 코드명, 분류 코드는 필수입니다.");
        }
        try {
            CommonCodeVO before = adminCodeManageService.selectCommonCode(id);
            adminCodeManageService.updateCommonCode(id, name, desc, use, cl, actorId);
            recordCommonCodeChange(request, actorId, "UPDATE", before, adminCodeManageService.selectCommonCode(id));
        } catch (Exception e) {
            log.error("Failed to update common code. codeId={}", id, e);
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Failed to update code ID." : "코드 ID 수정에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Code ID has been updated." : "코드 ID가 수정되었습니다.");
    }

    public String deleteCommonCode(
            String codeId,
            String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String actorId = resolveActorId(request);
        if (id.isEmpty()) {
            return redirectCodeManagementError(request, locale, null,
                    isEn ? "Code ID is required." : "코드 ID를 입력해 주세요.");
        }
        try {
            int refCount = adminCodeManageService.countDetailCodesByCodeId(id);
            if (refCount > 0) {
                return redirectCodeManagementError(request, locale, id,
                        isEn ? "Cannot delete: detail codes are linked." : "연결된 상세 코드가 있어 삭제할 수 없습니다.");
            }
            CommonCodeVO before = adminCodeManageService.selectCommonCode(id);
            adminCodeManageService.deleteCommonCode(id);
            recordCommonCodeChange(request, actorId, "DELETE", before, null);
        } catch (Exception e) {
            log.error("Failed to delete common code. codeId={}", id, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to delete code ID." : "코드 ID 삭제에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, currentDetailCodeId,
                isEn ? "Code ID has been deleted." : "코드 ID가 삭제되었습니다.");
    }

    public String createDetailCode(
            String codeId,
            String code,
            String codeNm,
            String codeDc,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String name = safeString(codeNm);
        String desc = safeString(codeDc);
        String use = normalizeUseAt(useAt);
        if (id.isEmpty() || normalizedCode.isEmpty() || name.isEmpty()) {
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Code ID, code, and name are required." : "코드 ID, 코드, 코드명은 필수입니다.");
        }
        try {
            boolean duplicate = adminCodeManageService.selectDetailCodeList(id).stream()
                    .anyMatch(item -> id.equalsIgnoreCase(safeString(item == null ? null : item.getCodeId()))
                            && normalizedCode.equalsIgnoreCase(safeString(item == null ? null : item.getCode())));
            if (duplicate) {
                return redirectCodeManagementError(request, locale, id,
                        isEn ? "The detail code already exists." : "이미 등록된 상세 코드입니다.");
            }
        } catch (Exception e) {
            log.error("Failed to validate duplicate detail code. codeId={}, code={}", id, normalizedCode, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to validate detail code duplication." : "상세 코드 중복 확인에 실패했습니다.");
        }
        try {
            adminCodeManageService.insertDetailCode(id, normalizedCode, name, desc, use, "admin");
        } catch (Exception e) {
            log.error("Failed to create detail code. codeId={}, code={}", id, normalizedCode, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to create detail code." : "상세 코드 등록에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, id,
                isEn ? "Detail code has been created." : "상세 코드가 등록되었습니다.");
    }

    public String updateDetailCode(
            String codeId,
            String code,
            String codeNm,
            String codeDc,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        String name = safeString(codeNm);
        String desc = safeString(codeDc);
        String use = normalizeUseAt(useAt);
        if (id.isEmpty() || normalizedCode.isEmpty() || name.isEmpty()) {
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Code ID, code, and name are required." : "코드 ID, 코드, 코드명은 필수입니다.");
        }
        try {
            adminCodeManageService.updateDetailCode(id, normalizedCode, name, desc, use, "admin");
        } catch (Exception e) {
            log.error("Failed to update detail code. codeId={}, code={}", id, normalizedCode, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to update detail code." : "상세 코드 수정에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, id,
                isEn ? "Detail code has been updated." : "상세 코드가 수정되었습니다.");
    }

    public String bulkUpdateDetailCodeUseAt(
            String codeId,
            String codes,
            String useAt,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String normalizedUseAt = normalizeUseAt(useAt);
        Set<String> selectedCodeSet = new LinkedHashSet<>();
        for (String token : safeString(codes).split(",")) {
            String normalizedCode = safeStaticString(token).toUpperCase(Locale.ROOT);
            if (!normalizedCode.isEmpty()) {
                selectedCodeSet.add(normalizedCode);
            }
        }
        List<String> selectedCodes = new ArrayList<>(selectedCodeSet);
        if (id.isEmpty() || selectedCodes.isEmpty()) {
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Select at least one detail code." : "하나 이상의 상세 코드를 선택하세요.");
        }
        try {
            List<DetailCodeVO> detailCodeList = adminCodeManageService.selectDetailCodeList(id);
            Map<String, DetailCodeVO> detailCodeByCode = new LinkedHashMap<>();
            for (DetailCodeVO item : detailCodeList) {
                String code = safeString(item == null ? null : item.getCode()).toUpperCase(Locale.ROOT);
                if (!code.isEmpty()) {
                    detailCodeByCode.put(code, item);
                }
            }
            for (String selectedCode : selectedCodes) {
                DetailCodeVO detailCode = detailCodeByCode.get(selectedCode);
                if (detailCode == null) {
                    continue;
                }
                adminCodeManageService.updateDetailCode(
                        id,
                        selectedCode,
                        safeString(detailCode.getCodeNm()),
                        safeString(detailCode.getCodeDc()),
                        normalizedUseAt,
                        "admin");
            }
        } catch (Exception e) {
            log.error("Failed to bulk update detail code useAt. codeId={}, useAt={}, codes={}", id, normalizedUseAt, selectedCodes, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to update selected detail codes." : "선택한 상세 코드 일괄 수정에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, id,
                isEn ? "Selected detail codes have been updated." : "선택한 상세 코드가 일괄 수정되었습니다.");
    }

    public String deleteDetailCode(
            String codeId,
            String code,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        String id = safeString(codeId).toUpperCase(Locale.ROOT);
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        if (id.isEmpty() || normalizedCode.isEmpty()) {
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Code ID and code are required." : "코드 ID와 코드값을 입력해 주세요.");
        }
        try {
            adminCodeManageService.deleteDetailCode(id, normalizedCode);
        } catch (Exception e) {
            log.error("Failed to delete detail code. codeId={}, code={}", id, normalizedCode, e);
            return redirectCodeManagementError(request, locale, id,
                    isEn ? "Failed to delete detail code." : "상세 코드 삭제에 실패했습니다.");
        }
        return redirectCodeManagementMessage(request, locale, id,
                isEn ? "Detail code has been deleted." : "상세 코드가 삭제되었습니다.");
    }

    private String redirectCodeManagementMessage(
            HttpServletRequest request,
            Locale locale,
            String detailCodeId,
            String message) {
        StringBuilder redirect = new StringBuilder("redirect:")
                .append(adminPrefix(request, locale))
                .append("/system/code");
        boolean hasQuery = false;
        String normalizedDetailCodeId = safeString(detailCodeId);
        if (!normalizedDetailCodeId.isEmpty()) {
            redirect.append("?detailCodeId=").append(urlEncode(normalizedDetailCodeId));
            hasQuery = true;
        }
        redirect.append(hasQuery ? '&' : '?').append("message=").append(urlEncode(message));
        return redirect.toString();
    }

    private String redirectCodeManagementError(
            HttpServletRequest request,
            Locale locale,
            String detailCodeId,
            String errorMessage) {
        StringBuilder redirect = new StringBuilder("redirect:")
                .append(adminPrefix(request, locale))
                .append("/system/code");
        boolean hasQuery = false;
        String normalizedDetailCodeId = safeString(detailCodeId);
        if (!normalizedDetailCodeId.isEmpty()) {
            redirect.append("?detailCodeId=").append(urlEncode(normalizedDetailCodeId));
            hasQuery = true;
        }
        redirect.append(hasQuery ? '&' : '?').append("errorMessage=").append(urlEncode(errorMessage));
        return redirect.toString();
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String uri = safeString(request.getRequestURI());
            if (uri.startsWith("/en/")) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().equalsIgnoreCase(Locale.ENGLISH.getLanguage());
    }

    private String adminPrefix(HttpServletRequest request, Locale locale) {
        return isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    private String normalizeUseAt(String value) {
        return "N".equalsIgnoreCase(safeString(value)) ? "N" : "Y";
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(safeString(value), StandardCharsets.UTF_8);
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String resolveActorId(HttpServletRequest request) {
        String actorId = adminRequestContextSupport.extractCurrentUserId(request);
        return actorId.isEmpty() ? "admin" : actorId;
    }

    private void recordClassCodeChange(HttpServletRequest request, String actorId, String changeType, ClassCodeVO before, ClassCodeVO after) {
        try {
            String code = safeString(after == null ? null : after.getClCode());
            if (code.isEmpty()) {
                code = safeString(before == null ? null : before.getClCode());
            }
            DbChangeCaptureRequest captureRequest = buildBaseCaptureRequest(request, actorId, "COMTCCMMNCLCODE", "CLASS_CODE", code, changeType);
            captureRequest.setTargetPkJson(jsonOf(Map.of("CL_CODE", code)));
            captureRequest.setBeforeSummaryJson(jsonOf(classCodeSummary(before)));
            captureRequest.setAfterSummaryJson(jsonOf(classCodeSummary(after)));
            captureRequest.setChangeSummary("System code class " + changeType + " " + code);
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("UPSERT_BY_KEY");
            captureRequest.setTargetKeysJson(jsonOf(Map.of("CL_CODE", code)));
            captureRequest.setPatchPayloadJson(jsonOf(classCodeSummary(after)));
            captureRequest.setRenderedSqlPreview(renderClassCodeSqlPreview(changeType, before, after));
            captureRequest.setRiskLevel("LOW");
            captureRequest.setLogicalObjectId("COMTCCMMNCLCODE:" + code);
            captureRequest.setSourceEnv("LOCAL");
            captureRequest.setRenameFromKeyJson(jsonOf(renameBeforeKeyMap("CL_CODE", before == null ? null : before.getClCode(), after == null ? null : after.getClCode())));
            captureRequest.setRenameToKeyJson(jsonOf(renameAfterKeyMap("CL_CODE", before == null ? null : before.getClCode(), after == null ? null : after.getClCode())));
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to record class code business change. actorId={}", actorId, e);
        }
    }

    private void recordCommonCodeChange(HttpServletRequest request, String actorId, String changeType, CommonCodeVO before, CommonCodeVO after) {
        try {
            String codeId = safeString(after == null ? null : after.getCodeId());
            if (codeId.isEmpty()) {
                codeId = safeString(before == null ? null : before.getCodeId());
            }
            DbChangeCaptureRequest captureRequest = buildBaseCaptureRequest(request, actorId, "COMTCCMMNCODE", "COMMON_CODE", codeId, changeType);
            captureRequest.setTargetPkJson(jsonOf(Map.of("CODE_ID", codeId)));
            captureRequest.setBeforeSummaryJson(jsonOf(commonCodeSummary(before)));
            captureRequest.setAfterSummaryJson(jsonOf(commonCodeSummary(after)));
            captureRequest.setChangeSummary("System common code " + changeType + " " + codeId);
            captureRequest.setPatchFormatCode("JSON_PATCH");
            captureRequest.setPatchKindCode("UPSERT_BY_KEY");
            captureRequest.setTargetKeysJson(jsonOf(Map.of("CODE_ID", codeId)));
            captureRequest.setPatchPayloadJson(jsonOf(commonCodeSummary(after)));
            captureRequest.setRenderedSqlPreview(renderCommonCodeSqlPreview(changeType, before, after));
            captureRequest.setRiskLevel("LOW");
            captureRequest.setLogicalObjectId("COMTCCMMNCODE:" + codeId);
            captureRequest.setSourceEnv("LOCAL");
            captureRequest.setRenameFromKeyJson(jsonOf(renameBeforeKeyMap("CODE_ID", before == null ? null : before.getCodeId(), after == null ? null : after.getCodeId())));
            captureRequest.setRenameToKeyJson(jsonOf(renameAfterKeyMap("CODE_ID", before == null ? null : before.getCodeId(), after == null ? null : after.getCodeId())));
            dbChangeCaptureService.captureChange(captureRequest);
        } catch (Exception e) {
            log.warn("Failed to record common code business change. actorId={}", actorId, e);
        }
    }

    private DbChangeCaptureRequest buildBaseCaptureRequest(HttpServletRequest request, String actorId, String tableName,
                                                           String entityType, String entityId, String changeType) {
        DbChangeCaptureRequest captureRequest = new DbChangeCaptureRequest();
        TraceContext traceContext = TraceContextHolder.get();
        captureRequest.setProjectId("carbonet");
        captureRequest.setPageId("system-code");
        captureRequest.setMenuCode("A0060201");
        captureRequest.setApiPath(request == null ? "" : safeString(request.getRequestURI()));
        captureRequest.setHttpMethod(request == null ? "" : safeString(request.getMethod()));
        captureRequest.setActorId(actorId);
        captureRequest.setActorRole("");
        captureRequest.setActorScopeId("");
        captureRequest.setTargetTableName(tableName);
        captureRequest.setEntityType(entityType);
        captureRequest.setEntityId(entityId);
        captureRequest.setChangeType(changeType);
        captureRequest.setTargetEnv("REMOTE_MAIN");
        if (traceContext != null) {
            captureRequest.setApiPath(defaultIfBlank(captureRequest.getApiPath(), safeString(traceContext.getRequestUri())));
        }
        return captureRequest;
    }

    private Map<String, Object> classCodeSummary(ClassCodeVO value) {
        Map<String, Object> summary = new LinkedHashMap<>();
        if (value == null) {
            return summary;
        }
        summary.put("clCode", safeString(value.getClCode()));
        summary.put("clCodeNm", safeString(value.getClCodeNm()));
        summary.put("clCodeDc", safeString(value.getClCodeDc()));
        summary.put("useAt", safeString(value.getUseAt()));
        return summary;
    }

    private Map<String, Object> renameBeforeKeyMap(String keyName, Object beforeValue, Object afterValue) {
        String before = safeString(beforeValue);
        String after = safeString(afterValue);
        if (before.isEmpty() || after.isEmpty() || before.equals(after)) {
            return java.util.Collections.emptyMap();
        }
        return Map.of(keyName, before);
    }

    private Map<String, Object> renameAfterKeyMap(String keyName, Object beforeValue, Object afterValue) {
        String before = safeString(beforeValue);
        String after = safeString(afterValue);
        if (before.isEmpty() || after.isEmpty() || before.equals(after)) {
            return java.util.Collections.emptyMap();
        }
        return Map.of(keyName, after);
    }

    private Map<String, Object> commonCodeSummary(CommonCodeVO value) {
        Map<String, Object> summary = new LinkedHashMap<>();
        if (value == null) {
            return summary;
        }
        summary.put("codeId", safeString(value.getCodeId()));
        summary.put("codeIdNm", safeString(value.getCodeIdNm()));
        summary.put("codeIdDc", safeString(value.getCodeIdDc()));
        summary.put("clCode", safeString(value.getClCode()));
        summary.put("useAt", safeString(value.getUseAt()));
        return summary;
    }

    private String renderClassCodeSqlPreview(String changeType, ClassCodeVO before, ClassCodeVO after) {
        ClassCodeVO target = after == null ? before : after;
        String code = safeString(target == null ? null : target.getClCode());
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTCCMMNCLCODE WHERE CL_CODE = '" + escapeSql(code) + "';";
        }
        if ("INSERT".equals(changeType)) {
            return "UPSERT COMTCCMMNCLCODE BY CL_CODE '" + escapeSql(code) + "';";
        }
        return "UPDATE COMTCCMMNCLCODE SET ... WHERE CL_CODE = '" + escapeSql(code) + "';";
    }

    private String renderCommonCodeSqlPreview(String changeType, CommonCodeVO before, CommonCodeVO after) {
        CommonCodeVO target = after == null ? before : after;
        String codeId = safeString(target == null ? null : target.getCodeId());
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTCCMMNCODE WHERE CODE_ID = '" + escapeSql(codeId) + "';";
        }
        if ("INSERT".equals(changeType)) {
            return "UPSERT COMTCCMMNCODE BY CODE_ID '" + escapeSql(codeId) + "';";
        }
        return "UPDATE COMTCCMMNCODE SET ... WHERE CODE_ID = '" + escapeSql(codeId) + "';";
    }

    private String jsonOf(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "";
        }
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = safeString(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private String escapeSql(String value) {
        return safeString(value).replace("'", "''");
    }

    private String safeStaticString(String value) {
        return value == null ? "" : value.trim();
    }
}
