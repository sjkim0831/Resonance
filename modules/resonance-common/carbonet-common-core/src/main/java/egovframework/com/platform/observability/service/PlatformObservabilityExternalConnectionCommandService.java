package egovframework.com.platform.observability.service;

import egovframework.com.feature.admin.service.ExternalConnectionProfileStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalConnectionCommandService {

    private final ExternalConnectionProfileStoreService externalConnectionProfileStoreService;

    public Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn) {
        Map<String, String> normalized = normalizeExternalConnectionPayload(payload, isEn);
        String connectionId = safeString(normalized.get("connectionId")).toUpperCase(Locale.ROOT);
        String originalConnectionId = safeString(payload == null ? null : payload.get("originalConnectionId")).toUpperCase(Locale.ROOT);
        boolean addMode = "add".equalsIgnoreCase(safeString(payload == null ? null : payload.get("mode")));
        if (connectionId.isEmpty()) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Connection ID is required." : "연계 ID는 필수입니다.");
        }
        if (addMode && externalConnectionProfileStoreService.exists(connectionId)) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Connection ID already exists. Enter a new ID." : "이미 사용 중인 연계 ID입니다. 새 ID를 입력하세요.");
        }
        if (!addMode
                && !originalConnectionId.isEmpty()
                && !originalConnectionId.equalsIgnoreCase(connectionId)
                && externalConnectionProfileStoreService.exists(connectionId)) {
            return Map.of(
                    "success", false,
                    "message", isEn ? "Connection ID already exists. Enter a new ID." : "이미 사용 중인 연계 ID입니다. 새 ID를 입력하세요.");
        }
        Map<String, String> savedProfile = externalConnectionProfileStoreService.saveProfile(normalized, originalConnectionId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", isEn ? "External connection profile saved." : "외부연계 프로필을 저장했습니다.");
        response.put("mode", safeString(payload == null ? null : payload.get("mode")));
        response.put("connectionProfile", savedProfile);
        return response;
    }

    private Map<String, String> normalizeExternalConnectionPayload(Map<String, String> payload, boolean isEn) {
        Map<String, String> normalized = defaultExternalConnectionProfile(isEn);
        if (payload == null) {
            return normalized;
        }
        normalized.put("connectionName", trimToDefault(payload.get("connectionName"), 120));
        normalized.put("connectionId", trimToDefault(payload.get("connectionId"), 60).toUpperCase(Locale.ROOT));
        normalized.put("partnerName", trimToDefault(payload.get("partnerName"), 120));
        normalized.put("endpointUrl", trimToDefault(payload.get("endpointUrl"), 255));
        normalized.put("protocol", trimToDefault(payload.get("protocol"), 20));
        normalized.put("authMethod", trimToDefault(payload.get("authMethod"), 30));
        normalized.put("syncMode", trimToDefault(payload.get("syncMode"), 30));
        normalized.put("retryPolicy", trimToDefault(payload.get("retryPolicy"), 40));
        normalized.put("timeoutSeconds", trimToDefault(payload.get("timeoutSeconds"), 10));
        normalized.put("dataScope", trimToDefault(payload.get("dataScope"), 200));
        normalized.put("ownerName", trimToDefault(payload.get("ownerName"), 80));
        normalized.put("ownerContact", trimToDefault(payload.get("ownerContact"), 120));
        normalized.put("operationStatus", trimToDefault(payload.get("operationStatus"), 20));
        normalized.put("maintenanceWindow", trimToDefault(payload.get("maintenanceWindow"), 80));
        normalized.put("notes", trimToDefault(payload.get("notes"), 500));
        return normalized;
    }

    private Map<String, String> defaultExternalConnectionProfile(boolean isEn) {
        Map<String, String> profile = new LinkedHashMap<>();
        profile.put("connectionName", "");
        profile.put("connectionId", "");
        profile.put("partnerName", "");
        profile.put("endpointUrl", "https://");
        profile.put("protocol", "REST");
        profile.put("authMethod", "OAUTH2");
        profile.put("syncMode", "SCHEDULED");
        profile.put("retryPolicy", "EXP_BACKOFF_3");
        profile.put("timeoutSeconds", "30");
        profile.put("dataScope", "");
        profile.put("ownerName", "");
        profile.put("ownerContact", "");
        profile.put("operationStatus", "REVIEW");
        profile.put("maintenanceWindow", "Sun 01:00-02:00");
        profile.put("notes", isEn
                ? "Record token rotation owner, replay policy, and maintenance impact before requesting production approval."
                : "운영 승인 요청 전에 토큰 교체 담당, 재처리 정책, 점검 영향 범위를 먼저 기록합니다.");
        return profile;
    }

    private String trimToDefault(String value, int maxLength) {
        String normalized = safeString(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
