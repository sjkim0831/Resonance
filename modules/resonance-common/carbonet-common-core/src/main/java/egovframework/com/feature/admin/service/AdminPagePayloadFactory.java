package egovframework.com.feature.admin.service;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class AdminPagePayloadFactory {

    public Map<String, Object> create(boolean isEn, String menuCode) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", menuCode);
        return payload;
    }

    public Map<String, Object> createStatusResponse(
            String statusKey,
            boolean statusValue,
            String idKey,
            Object idValue,
            Object message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put(statusKey, statusValue);
        if (idKey != null && !idKey.trim().isEmpty()) {
            response.put(idKey, idValue);
        }
        if (message != null) {
            response.put("message", message);
        }
        return response;
    }
}
