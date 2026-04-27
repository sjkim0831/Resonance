package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class EmissionVariableConditionSupport {
    private EmissionVariableConditionSupport() {
    }

    static boolean isVisible(EmissionCategoryVO category,
                             int tier,
                             Map<String, Map<Integer, String>> inputs,
                             EmissionVariableDefinitionVO variable,
                             int lineNo) {
        String rule = EmissionManagementValueSupport.safe(variable == null ? null : variable.getVisibleWhen());
        if (rule.isEmpty()) {
            return true;
        }
        return matchesRule(category, tier, inputs, lineNo, rule);
    }

    static boolean isDisabled(EmissionCategoryVO category,
                              int tier,
                              Map<String, Map<Integer, String>> inputs,
                              EmissionVariableDefinitionVO variable,
                              int lineNo) {
        if (!isVisible(category, tier, inputs, variable, lineNo)) {
            return true;
        }
        String rule = EmissionManagementValueSupport.safe(variable == null ? null : variable.getDisabledWhen());
        if (rule.isEmpty()) {
            return false;
        }
        return matchesRule(category, tier, inputs, lineNo, rule);
    }

    private static boolean matchesRule(EmissionCategoryVO category,
                                       int tier,
                                       Map<String, Map<Integer, String>> inputs,
                                       int lineNo,
                                       String rawRule) {
        String rule = EmissionManagementValueSupport.safe(rawRule);
        if (rule.isEmpty()) {
            return false;
        }
        String normalizedRule = rule.replaceAll("\\s+", " ").trim();
        String upperRule = normalizedRule.toUpperCase(Locale.ROOT);
        if (upperRule.contains(" NOTIN ")) {
            String[] parts = upperRule.split(" NOTIN ", 2);
            return !allowedValues(parts.length > 1 ? parts[1] : "").contains(resolveValue(category, tier, inputs, lineNo, parts[0]));
        }
        if (upperRule.contains(" IN ")) {
            String[] parts = upperRule.split(" IN ", 2);
            return allowedValues(parts.length > 1 ? parts[1] : "").contains(resolveValue(category, tier, inputs, lineNo, parts[0]));
        }
        if (upperRule.contains("!=")) {
            String[] parts = upperRule.split("!=", 2);
            return !resolveValue(category, tier, inputs, lineNo, parts[0]).equals(normalizeValue(parts.length > 1 ? parts[1] : ""));
        }
        if (upperRule.contains("=")) {
            String[] parts = upperRule.split("=", 2);
            return resolveValue(category, tier, inputs, lineNo, parts[0]).equals(normalizeValue(parts.length > 1 ? parts[1] : ""));
        }
        return false;
    }

    private static Set<String> allowedValues(String value) {
        String normalized = EmissionManagementValueSupport.safe(value);
        if (normalized.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> tokens = new LinkedHashSet<>();
        Arrays.stream(normalized.split("\\|"))
                .map(EmissionVariableConditionSupport::normalizeValue)
                .filter(token -> !token.isEmpty())
                .forEach(tokens::add);
        return tokens;
    }

    private static String resolveValue(EmissionCategoryVO category,
                                       int tier,
                                       Map<String, Map<Integer, String>> inputs,
                                       int lineNo,
                                       String leftOperand) {
        String operand = normalizeValue(leftOperand);
        if ("LIME_TYPE".equals(operand) && "LIME".equalsIgnoreCase(EmissionManagementValueSupport.safe(category == null ? null : category.getSubCode())) && tier == 2) {
            return resolveLimeTier2Type(inputs, lineNo);
        }
        if ("BLANK".equals(operand)) {
            return "BLANK";
        }
        Map<Integer, String> rows = inputs.getOrDefault(operand, Collections.emptyMap());
        return normalizeValue(rows.get(lineNo));
    }

    private static String resolveLimeTier2Type(Map<String, Map<Integer, String>> inputs, int lineNo) {
        String normalized = normalizeValue(lineValue(inputs, "LIME_TYPE", lineNo))
                .replace("0.77", "077")
                .replace("0.86", "086");
        if (normalized.isEmpty()) {
            return "BLANK";
        }
        if ("A".equals(normalized) || normalized.contains("고칼슘") || normalized.contains("HIGHCALCIUM")) {
            return "HIGH_CALCIUM";
        }
        if ("C".equals(normalized) || normalized.contains("수경성") || normalized.contains("HYDRAULIC")) {
            return "HYDRAULIC";
        }
        if (normalized.contains("개도국") || normalized.contains("LOW") || normalized.contains("077")) {
            return "DOLOMITIC_LOW";
        }
        if (normalized.contains("선진국") || normalized.contains("HIGH") || normalized.contains("086")) {
            return "DOLOMITIC_HIGH";
        }
        if ("B".equals(normalized) || normalized.contains("고토") || normalized.contains("DOLOMITIC")) {
            return "DOLOMITIC";
        }
        return "BLANK";
    }

    private static String lineValue(Map<String, Map<Integer, String>> inputs, String varCode, int lineNo) {
        Map<Integer, String> rows = inputs.get(varCode);
        if (rows == null) {
            return "";
        }
        return EmissionManagementValueSupport.safe(rows.get(lineNo));
    }

    private static String normalizeValue(String value) {
        return EmissionManagementValueSupport.safe(value)
                .toUpperCase(Locale.ROOT)
                .replace(" ", "")
                .replace("_", "_")
                .replace("-", "")
                .replace("·", "")
                .replace(".", "")
                .replace("내지", "");
    }
}
