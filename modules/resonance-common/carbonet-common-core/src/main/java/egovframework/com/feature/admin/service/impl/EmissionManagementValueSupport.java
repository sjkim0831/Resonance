package egovframework.com.feature.admin.service.impl;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class EmissionManagementValueSupport {
    private EmissionManagementValueSupport() {
    }

    static Map<String, String> option(String code, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("code", code);
        option.put("label", label);
        return option;
    }

    static List<Map<String, Object>> buildTierItems(List<Integer> tiers) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Integer tier : safeList(tiers)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("tier", tier);
            item.put("label", "Tier " + tier);
            items.add(item);
        }
        return items;
    }

    static List<Map<String, Object>> buildUnsupportedTierItems(List<Integer> tiers, String reason) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> item : buildTierItems(tiers)) {
            item.put("supported", false);
            item.put("reason", safe(reason));
            items.add(item);
        }
        return items;
    }

    static Map<String, Object> buildCategoryTierParams(Long categoryId, Integer tier) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("categoryId", categoryId);
        params.put("tier", tier);
        return params;
    }

    static String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    static String stringValue(Object value) {
        return value == null ? "" : value.toString();
    }

    static Long longValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(stringValue(value));
        } catch (Exception ignored) {
            return null;
        }
    }

    static Integer intValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(stringValue(value));
        } catch (Exception ignored) {
            return null;
        }
    }

    static Double doubleValue(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(stringValue(value));
        } catch (Exception ignored) {
            return null;
        }
    }

    static <T> List<T> safeList(Collection<T> values) {
        if (values == null) {
            return Collections.emptyList();
        }
        return new ArrayList<>(values);
    }

    static String format(String pattern, Object... args) {
        return String.format(Locale.ROOT, pattern, args);
    }
}
