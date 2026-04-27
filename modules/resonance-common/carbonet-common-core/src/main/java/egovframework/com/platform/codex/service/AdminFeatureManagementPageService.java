package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.platform.codex.model.FeatureAssignmentStatVO;
import egovframework.com.platform.codex.model.MenuFeatureVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminFeatureManagementPageService {

    private static final Logger log = LoggerFactory.getLogger(AdminFeatureManagementPageService.class);

    private final MenuFeatureManageService menuFeatureManageService;
    private final AuthGroupManageService authGroupManageService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    public Map<String, Object> buildFunctionManagementPageData(
            String menuType,
            String searchMenuCode,
            String searchKeyword,
            String errorMessage,
            HttpServletRequest request,
            Locale locale) {
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        Map<String, Object> payload = new LinkedHashMap<>();

        List<MenuFeatureVO> featureRows = loadFeatureManagementRows(codeId, searchMenuCode, searchKeyword);
        Map<String, Integer> featureAssignmentCounts = loadFeatureAssignmentCountMap();
        int unassignedFeatureCount = 0;
        for (MenuFeatureVO row : featureRows) {
            String featureCode = safeString(row.getFeatureCode()).toUpperCase(Locale.ROOT);
            int assignedRoleCount = featureAssignmentCounts.getOrDefault(featureCode, 0);
            row.setAssignedRoleCount(assignedRoleCount);
            row.setUnassignedToRole(assignedRoleCount == 0);
            if (assignedRoleCount == 0) {
                unassignedFeatureCount++;
            }
        }

        payload.put("menuType", normalizedMenuType);
        payload.put("featurePageOptions", loadFeaturePageOptions(codeId));
        payload.put("featureUserPageOptions", loadFeaturePageOptions(resolveMenuCodeId("USER")));
        payload.put("featureAdminPageOptions", loadFeaturePageOptions(resolveMenuCodeId("ADMIN")));
        payload.put("featureRows", featureRows);
        payload.put("featureTotalCount", featureRows.size());
        payload.put("featureUnassignedCount", unassignedFeatureCount);
        payload.put("useAtOptions", List.of("Y", "N"));
        payload.put("searchMenuCode", safeString(searchMenuCode));
        payload.put("searchKeyword", safeString(searchKeyword));
        applyQueryError(payload, "featureMgmtError", errorMessage);
        return payload;
    }

    private List<MenuFeatureVO> loadFeatureManagementRows(String codeId, String searchMenuCode, String searchKeyword) {
        try {
            return menuFeatureManageService.selectMenuFeatureList(codeId, safeString(searchMenuCode), safeString(searchKeyword));
        } catch (Exception e) {
            log.error("Failed to load feature management rows.", e);
            return Collections.emptyList();
        }
    }

    private Map<String, Integer> loadFeatureAssignmentCountMap() {
        try {
            List<FeatureAssignmentStatVO> stats = authGroupManageService.selectFeatureAssignmentStats();
            Map<String, Integer> result = new LinkedHashMap<>();
            for (FeatureAssignmentStatVO stat : stats) {
                String featureCode = safeString(stat.getFeatureCode()).toUpperCase(Locale.ROOT);
                if (!featureCode.isEmpty()) {
                    result.put(featureCode, stat.getAssignedRoleCount());
                }
            }
            return result;
        } catch (Exception e) {
            log.error("Failed to load feature assignment statistics.", e);
            return Collections.emptyMap();
        }
    }

    private List<MenuFeatureVO> loadFeaturePageOptions(String codeId) {
        try {
            return menuFeatureManageService.selectMenuPageOptions(codeId);
        } catch (Exception e) {
            log.error("Failed to load feature page options.", e);
            return Collections.emptyList();
        }
    }

    private void applyQueryError(Map<String, Object> target, String attributeName, String errorMessage) {
        String normalized = safeString(errorMessage);
        if (!normalized.isEmpty()) {
            target.put(attributeName, normalized);
        }
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(safeString(menuType)) ? "USER" : "ADMIN";
    }

    private String resolveMenuCodeId(String menuType) {
        return "USER".equals(menuType) ? "HMENU1" : "AMENU1";
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
