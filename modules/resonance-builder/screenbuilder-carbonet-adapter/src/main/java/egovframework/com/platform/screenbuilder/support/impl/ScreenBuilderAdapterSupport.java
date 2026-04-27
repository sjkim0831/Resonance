package egovframework.com.platform.screenbuilder.support.impl;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Collections;

final class ScreenBuilderAdapterSupport {

    private ScreenBuilderAdapterSupport() {
    }

    static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    static String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    static String lowerCaseSafe(String value) {
        return safe(value).toLowerCase(Locale.ROOT);
    }

    static String firstNonBlank(String... values) {
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    static Map<String, Object> orderedMap(Object... entries) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index + 1 < entries.length; index += 2) {
            map.put(String.valueOf(entries[index]), entries[index + 1]);
        }
        return map;
    }

    static <T> List<T> emptyIfNull(List<T> values) {
        return values == null ? Collections.emptyList() : values;
    }
}
