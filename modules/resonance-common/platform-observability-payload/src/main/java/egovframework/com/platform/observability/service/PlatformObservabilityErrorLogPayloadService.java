package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.feature.admin.dto.response.AdminErrorLogRowResponse;
import egovframework.com.platform.service.observability.AdminAuthoritySelectionPort;
import egovframework.com.platform.service.observability.CurrentUserContextReadPort;
import egovframework.com.platform.service.observability.CurrentUserContextSnapshot;
import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformObservabilityErrorLogPayloadService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";

    private final CurrentUserContextReadPort currentUserContextReadPort;
    private final AdminAuthoritySelectionPort adminAuthoritySelectionPort;
    private final ObservabilityQueryService observabilityQueryService;
    private final PlatformObservabilityCompanyScopePort companyScopeService;

    public Map<String, Object> buildErrorLogPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String requestedInsttId,
            String sourceType,
            String errorType,
            HttpServletRequest request,
            boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        int pageIndex = parsePageIndex(pageIndexParam);
        CurrentUserContextSnapshot context = currentUserContextReadPort.resolve(request);
        String currentUserAuthorCode = safeString(context == null ? null : context.getAuthorCode());
        boolean masterAccess = ROLE_SYSTEM_MASTER.equalsIgnoreCase(currentUserAuthorCode);
        boolean systemAccess = ROLE_SYSTEM_ADMIN.equalsIgnoreCase(currentUserAuthorCode);
        boolean canView = masterAccess || systemAccess;
        payload.put("canViewErrorLog", canView);
        payload.put("canManageAllCompanies", masterAccess);
        payload.put("searchKeyword", safeString(searchKeyword));
        payload.put("selectedSourceType", safeString(sourceType));
        payload.put("selectedErrorType", safeString(errorType));

        String currentUserInsttId = safeString(context == null ? null : context.getInsttId());
        List<Map<String, String>> companyOptions = masterAccess
                ? companyScopeService.loadAccessHistoryCompanyOptions()
                : companyScopeService.buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
        String selectedInsttId = masterAccess
                ? adminAuthoritySelectionPort.resolveSelectedInsttId(requestedInsttId, companyOptions, true)
                : currentUserInsttId;
        payload.put("companyOptions", companyOptions);
        payload.put("selectedInsttId", selectedInsttId);

        if (!masterAccess && currentUserInsttId.isEmpty()) {
            return deniedPayload(payload, "errorLogError",
                    isEn ? "Your administrator account is missing company information."
                            : "관리자 계정에 회사 정보가 없습니다.",
                    "errorLogList",
                    isEn);
        }
        if (!canView) {
            return deniedPayload(payload, "errorLogError",
                    isEn ? "Only master administrators and system administrators can view error logs."
                            : "에러 로그는 마스터 관리자와 시스템 관리자만 조회할 수 있습니다.",
                    "errorLogList",
                    isEn);
        }

        String forcedInsttId = masterAccess ? selectedInsttId : currentUserInsttId;
        int pageSize = 10;
        int totalCount = 0;
        int totalPages = 1;
        int currentPage = 1;
        List<AdminErrorLogRowResponse> rows = new ArrayList<>();
        String errorMessage = "";
        try {
            ErrorEventSearchVO searchVO = new ErrorEventSearchVO();
            searchVO.setFirstIndex(Math.max(pageIndex - 1, 0) * pageSize);
            searchVO.setRecordCountPerPage(pageSize);
            searchVO.setSearchKeyword(safeString(searchKeyword));
            searchVO.setInsttId(forcedInsttId);
            searchVO.setSourceType(safeString(sourceType));
            searchVO.setErrorType(safeString(errorType));
            totalCount = observabilityQueryService.selectErrorEventCount(searchVO);
            totalPages = totalCount == 0 ? 1 : (int) Math.ceil(totalCount / (double) pageSize);
            currentPage = Math.max(1, Math.min(pageIndex, totalPages));
            searchVO.setFirstIndex(Math.max(currentPage - 1, 0) * pageSize);
            for (ErrorEventRecordVO item : observabilityQueryService.selectErrorEventList(searchVO)) {
                String scopedInsttId = safeString(item.getActorInsttId());
                rows.add(createErrorLogRow(
                        item,
                        scopedInsttId,
                        scopedInsttId.isEmpty() ? "-" : companyScopeService.resolveCompanyNameByInsttId(scopedInsttId)));
            }
        } catch (Exception e) {
            log.error("Failed to load error log page.", e);
            errorMessage = isEn ? "An error occurred while retrieving error logs." : "에러 로그 조회 중 오류가 발생했습니다.";
        }

        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }
        payload.put("errorLogError", errorMessage);
        payload.put("errorLogList", rows);
        payload.put("totalCount", totalCount);
        payload.put("pageIndex", currentPage);
        payload.put("pageSize", pageSize);
        payload.put("totalPages", totalPages);
        payload.put("startPage", startPage);
        payload.put("endPage", endPage);
        payload.put("prevPage", Math.max(1, currentPage - 1));
        payload.put("nextPage", Math.min(totalPages, currentPage + 1));
        payload.put("sourceTypeOptions", buildObservabilityOptionList("", "BACKEND_ERROR_CONTROLLER", "PAGE_EXCEPTION_ADVICE", "FRONTEND_REPORT", "FRONTEND_TELEMETRY"));
        payload.put("errorTypeOptions", buildObservabilityOptionList("", "UI_ERROR", "ERROR_DISPATCH", "PAGE_EXCEPTION"));
        payload.put("isEn", isEn);
        return payload;
    }

    private Map<String, Object> deniedPayload(Map<String, Object> payload, String errorKey, String message, String listKey, boolean isEn) {
        payload.put(errorKey, message);
        payload.put(listKey, Collections.emptyList());
        payload.put("totalCount", 0);
        payload.put("pageIndex", 1);
        payload.put("pageSize", 10);
        payload.put("totalPages", 1);
        payload.put("startPage", 1);
        payload.put("endPage", 1);
        payload.put("prevPage", 1);
        payload.put("nextPage", 1);
        payload.put("isEn", isEn);
        return payload;
    }

    private int parsePageIndex(String pageIndexParam) {
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                return Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }

    private AdminErrorLogRowResponse createErrorLogRow(ErrorEventRecordVO item, String insttId, String companyName) {
        return new AdminErrorLogRowResponse(
                safeString(item.getCreatedAt()),
                insttId,
                companyName,
                safeString(item.getSourceType()),
                safeString(item.getErrorType()),
                safeString(item.getActorId()),
                safeString(item.getActorRole()),
                safeString(item.getRequestUri()),
                safeString(item.getPageId()),
                safeString(item.getApiId()),
                safeString(item.getRemoteAddr()),
                safeString(item.getMessage()),
                safeString(item.getResultStatus()));
    }

    private List<Map<String, String>> buildObservabilityOptionList(String... values) {
        List<Map<String, String>> items = new ArrayList<>();
        if (values == null) {
            return items;
        }
        for (String value : values) {
            Map<String, String> option = new LinkedHashMap<>();
            option.put("value", safeString(value));
            option.put("label", safeString(value).isEmpty() ? "전체" : safeString(value));
            items.add(option);
        }
        return items;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
