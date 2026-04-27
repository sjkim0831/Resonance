package egovframework.com.feature.admin.web;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class AdminPayloadSelectionSupport {

    public List<String> extractPayloadIds(Object selectedIds, String singleId) {
        Set<String> ids = new LinkedHashSet<>();
        String normalizedSingleId = safeString(singleId);
        if (!normalizedSingleId.isEmpty()) {
            ids.add(normalizedSingleId);
        }
        if (!(selectedIds instanceof List<?>)) {
            return new ArrayList<>(ids);
        }
        for (Object item : (List<?>) selectedIds) {
            String value = safeString(item == null ? null : item.toString());
            if (!value.isEmpty()) {
                ids.add(value);
            }
        }
        return new ArrayList<>(ids);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
