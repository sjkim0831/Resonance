package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.dto.request.EmissionInputValueRequest;
import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.buildCategoryTierParams;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.intValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.longValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;

final class EmissionManagementValidationSupport {
    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final EmissionCalculationDefinitionRegistry calculationDefinitionRegistry;
    private final AdminEmissionDefinitionStudioService definitionStudioService;
    private final EmissionVariableDefinitionAssembler variableDefinitionAssembler;

    EmissionManagementValidationSupport(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                        EmissionCalculationDefinitionRegistry calculationDefinitionRegistry,
                                        AdminEmissionDefinitionStudioService definitionStudioService,
                                        EmissionVariableDefinitionAssembler variableDefinitionAssembler) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.calculationDefinitionRegistry = calculationDefinitionRegistry;
        this.definitionStudioService = definitionStudioService;
        this.variableDefinitionAssembler = variableDefinitionAssembler;
    }

    Map<String, Object> requireSession(Long sessionId) {
        if (sessionId == null) {
            throw new IllegalArgumentException("sessionId is required.");
        }
        Map<String, Object> session = adminEmissionManagementMapper.selectEmissionInputSession(sessionId);
        if (session == null || session.isEmpty()) {
            throw new IllegalArgumentException("Emission input session not found.");
        }
        return session;
    }

    EmissionCategoryVO requireCategory(Long categoryId) {
        if (categoryId == null) {
            throw new IllegalArgumentException("categoryId is required.");
        }
        EmissionCategoryVO category = adminEmissionManagementMapper.selectEmissionCategory(categoryId);
        if (category == null) {
            throw new IllegalArgumentException("Emission category not found.");
        }
        return category;
    }

    int requireTier(EmissionCategoryVO category, Integer tier) {
        if (tier == null) {
            throw new IllegalArgumentException("tier is required.");
        }
        Long categoryId = category == null ? null : category.getCategoryId();
        List<Integer> tiers = adminEmissionManagementMapper.selectEmissionTierList(categoryId);
        if (!tiers.contains(tier)) {
            throw new IllegalArgumentException("Unsupported tier for category.");
        }
        if (!hasRuntimeSupport(category, tier)) {
            throw new IllegalArgumentException("Tier is defined in metadata but no calculation definition is registered for "
                    + EmissionManagementValueSupport.safe(category == null ? null : category.getSubCode())
                    + "/" + tier + ".");
        }
        return tier;
    }

    Long requireGeneratedId(Map<String, Object> params, String key, String entityName) {
        Long generatedId = longValue(params.get(key));
        if (generatedId == null || generatedId < 1L) {
            throw new IllegalStateException("Failed to generate ID for " + entityName + ".");
        }
        return generatedId;
    }

    void validateRequiredDirectInputs(EmissionCategoryVO category,
                                      int tier,
                                      List<EmissionInputValueRequest> values) {
        validateRequiredDirectInputs(category, tier, normalizeRequestValues(values));
    }

    void validateRequiredDirectInputsFromStoredValues(EmissionCategoryVO category,
                                                      int tier,
                                                      List<Map<String, Object>> values) {
        validateRequiredDirectInputs(category, tier, normalizeStoredValues(values));
    }

    private void validateRequiredDirectInputs(EmissionCategoryVO category,
                                              int tier,
                                              Map<String, Map<Integer, String>> inputs) {
        String categoryCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        Map<String, Object> publishedDefinition = publishedDefinition(category, tier);
        PolicyCodes policyCodes = policyCodes(publishedDefinition);
        List<EmissionVariableDefinitionVO> definitions = effectiveDefinitions(category, tier, publishedDefinition);
        Map<String, EmissionVariableDefinitionVO> definitionByCode = indexDefinitionsByCode(definitions);
        List<String> missingLabels = new ArrayList<>();
        Set<String> seenRepeatGroups = new LinkedHashSet<>();

        for (EmissionVariableDefinitionVO variable : definitions) {
            if (!requiresDirectInput(variable, policyCodes) || canOmitDirectInput(variable, categoryCode, tier, policyCodes)) {
                continue;
            }
            String varCode = safe(variable.getVarCode()).toUpperCase(Locale.ROOT);
            String repeatGroupKey = safe(variable.getRepeatGroupKey());
            if (!repeatGroupKey.isEmpty()) {
                if (!seenRepeatGroups.add(repeatGroupKey)) {
                    continue;
                }
                List<EmissionVariableDefinitionVO> groupVariables = variablesInRepeatGroup(definitions, repeatGroupKey);
                List<EmissionVariableDefinitionVO> requiredGroupVariables = new ArrayList<>();
                for (EmissionVariableDefinitionVO groupVariable : groupVariables) {
                    if (requiresDirectInput(groupVariable, policyCodes) && !canOmitDirectInput(groupVariable, categoryCode, tier, policyCodes)) {
                        requiredGroupVariables.add(groupVariable);
                    }
                }
                if (requiredGroupVariables.isEmpty()) {
                    continue;
                }
                Set<Integer> populatedLines = populatedLines(inputs, groupVariables, categoryCode, tier);
                if (populatedLines.isEmpty()) {
                    for (EmissionVariableDefinitionVO requiredVariable : requiredGroupVariables) {
                        if (!isDisabledField(category, tier, inputs, definitionByCode, safe(requiredVariable.getVarCode()), 1)) {
                            missingLabels.add(displayLabel(requiredVariable));
                        }
                    }
                    continue;
                }
                for (Integer lineNo : populatedLines) {
                    for (EmissionVariableDefinitionVO requiredVariable : requiredGroupVariables) {
                        String requiredCode = safe(requiredVariable.getVarCode()).toUpperCase(Locale.ROOT);
                        if (isDisabledField(category, tier, inputs, definitionByCode, requiredCode, lineNo)) {
                            continue;
                        }
                        if (!hasValue(inputs, requiredCode, lineNo)) {
                            missingLabels.add(displayLabel(requiredVariable) + " [line " + lineNo + "]");
                        }
                    }
                }
                continue;
            }
            if (!hasAnyValue(category, inputs, definitionByCode, varCode, categoryCode, tier)) {
                missingLabels.add(displayLabel(variable));
            }
        }

        if (!missingLabels.isEmpty()) {
            throw new IllegalArgumentException("Required direct input is missing for: " + String.join(", ", missingLabels));
        }
    }

    private Map<String, Map<Integer, String>> normalizeRequestValues(List<EmissionInputValueRequest> values) {
        Map<String, Map<Integer, String>> normalized = new LinkedHashMap<>();
        if (values == null) {
            return normalized;
        }
        for (EmissionInputValueRequest value : values) {
            String varCode = safe(value == null ? null : value.getVarCode()).toUpperCase(Locale.ROOT);
            if (varCode.isEmpty()) {
                continue;
            }
            int lineNo = normalizeLineNo(value == null ? null : value.getLineNo());
            String normalizedValue = normalizeValue(value == null ? null : value.getValueText(), value == null ? null : value.getValueNum());
            normalized.computeIfAbsent(varCode, key -> new LinkedHashMap<>()).put(lineNo, normalizedValue);
        }
        return normalized;
    }

    private Map<String, Map<Integer, String>> normalizeStoredValues(List<Map<String, Object>> values) {
        Map<String, Map<Integer, String>> normalized = new LinkedHashMap<>();
        if (values == null) {
            return normalized;
        }
        for (Map<String, Object> value : values) {
            String varCode = safe(value == null || value.get("varCode") == null ? null : String.valueOf(value.get("varCode"))).toUpperCase(Locale.ROOT);
            if (varCode.isEmpty()) {
                continue;
            }
            int lineNo = normalizeLineNo(intValue(value == null ? null : value.get("lineNo")));
            String normalizedValue = normalizeValue(
                    safe(value == null || value.get("valueText") == null ? null : String.valueOf(value.get("valueText"))),
                    value == null ? null : value.get("valueNum")
            );
            normalized.computeIfAbsent(varCode, key -> new LinkedHashMap<>()).put(lineNo, normalizedValue);
        }
        return normalized;
    }

    private String normalizeValue(String textValue, Object numericValue) {
        String normalizedText = safe(textValue);
        if (!normalizedText.isEmpty()) {
            return normalizedText;
        }
        if (numericValue == null) {
            return "";
        }
        return String.valueOf(numericValue).trim();
    }

    private int normalizeLineNo(Integer lineNo) {
        return lineNo == null || lineNo < 1 ? 1 : lineNo;
    }

    private boolean isRequired(EmissionVariableDefinitionVO variable) {
        return "Y".equalsIgnoreCase(safe(variable == null ? null : variable.getRequired()));
    }

    private boolean requiresDirectInput(EmissionVariableDefinitionVO variable, PolicyCodes policyCodes) {
        String varCode = safe(variable == null ? null : variable.getVarCode()).toUpperCase(Locale.ROOT);
        if (!policyCodes.directRequiredCodes.isEmpty()) {
            return policyCodes.directRequiredCodes.contains(varCode);
        }
        return isRequired(variable);
    }

    private boolean canOmitDirectInput(EmissionVariableDefinitionVO variable, String categoryCode, int tier, PolicyCodes policyCodes) {
        if ("Y".equalsIgnoreCase(safe(variable == null ? null : variable.getSupplementalYn()))) {
            return true;
        }
        String varCode = safe(variable == null ? null : variable.getVarCode()).toUpperCase(Locale.ROOT);
        if (policyCodes.autoCalculatedCodes.contains(varCode)
                || policyCodes.fallbackCodes.contains(varCode)
                || policyCodes.supplementalCodes.contains(varCode)) {
            return true;
        }
        if ("CEMENT".equals(categoryCode) && tier == 1) {
            return "EFCLC".equals(varCode);
        }
        if ("CEMENT".equals(categoryCode) && tier == 2) {
            return "EFC".equals(varCode) || "EFCL".equals(varCode) || "CFCKD".equals(varCode);
        }
        if ("CEMENT".equals(categoryCode) && tier == 3) {
            return "EFD".equals(varCode);
        }
        if ("LIME".equals(categoryCode) && tier == 1) {
            return "LIME_TYPE".equals(varCode);
        }
        if ("LIME".equals(categoryCode) && tier == 2) {
            return "LIME_TYPE".equals(varCode)
                    || "CAO_CONTENT".equals(varCode)
                    || "CAO_MGO_CONTENT".equals(varCode)
                    || "MD".equals(varCode)
                    || "CD".equals(varCode)
                    || "FD".equals(varCode)
                    || "HYDRATED_LIME_PRODUCTION_YN".equals(varCode)
                    || "X".equals(varCode)
                    || "Y".equals(varCode);
        }
        if ("LIME".equals(categoryCode) && tier == 3) {
            return "EFD".equals(varCode);
        }
        return false;
    }

    private List<EmissionVariableDefinitionVO> effectiveDefinitions(EmissionCategoryVO category,
                                                                    int tier,
                                                                    Map<String, Object> publishedDefinition) {
        List<EmissionVariableDefinitionVO> definitions = adminEmissionManagementMapper.selectEmissionVariableDefinitions(
                buildCategoryTierParams(category == null ? null : category.getCategoryId(), tier)
        );
        return variableDefinitionAssembler.applyDefinitionOverrides(
                definitions,
                publishedDefinition,
                category == null ? null : category.getCategoryId(),
                tier
        );
    }

    private Map<String, Object> publishedDefinition(EmissionCategoryVO category, int tier) {
        return definitionStudioService.findPublishedDefinitionRaw(category == null ? null : category.getSubCode(), tier);
    }

    boolean hasRuntimeSupport(EmissionCategoryVO category, Integer tier) {
        return calculationDefinitionRegistry.supports(category, tier) || hasDefinitionBackedRuntime(category, tier);
    }

    boolean hasDefinitionBackedRuntime(EmissionCategoryVO category, Integer tier) {
        if (tier == null) {
            return false;
        }
        Map<String, Object> publishedDefinition = publishedDefinition(category, tier);
        if (publishedDefinition.isEmpty()) {
            return false;
        }
        Object formulaTree = publishedDefinition.get("formulaTree");
        if (formulaTree instanceof List<?>) {
            return !((List<?>) formulaTree).isEmpty();
        }
        return !safe(String.valueOf(publishedDefinition.get("formula"))).isEmpty();
    }

    private PolicyCodes policyCodes(Map<String, Object> publishedDefinition) {
        return new PolicyCodes(
                codeSet(publishedDefinition == null ? null : publishedDefinition.get("directRequiredCodes")),
                codeSet(publishedDefinition == null ? null : publishedDefinition.get("fallbackCodes")),
                codeSet(publishedDefinition == null ? null : publishedDefinition.get("autoCalculatedCodes")),
                codeSet(publishedDefinition == null ? null : publishedDefinition.get("supplementalCodes"))
        );
    }

    @SuppressWarnings("unchecked")
    private Set<String> codeSet(Object value) {
        Set<String> result = new LinkedHashSet<>();
        if (value instanceof List<?>) {
            for (Object item : (List<Object>) value) {
                String normalized = safe(item == null ? null : String.valueOf(item)).toUpperCase(Locale.ROOT);
                if (!normalized.isEmpty()) {
                    result.add(normalized);
                }
            }
        }
        return result;
    }

    private static final class PolicyCodes {
        private final Set<String> directRequiredCodes;
        private final Set<String> fallbackCodes;
        private final Set<String> autoCalculatedCodes;
        private final Set<String> supplementalCodes;

        private PolicyCodes(Set<String> directRequiredCodes,
                            Set<String> fallbackCodes,
                            Set<String> autoCalculatedCodes,
                            Set<String> supplementalCodes) {
            this.directRequiredCodes = directRequiredCodes;
            this.fallbackCodes = fallbackCodes;
            this.autoCalculatedCodes = autoCalculatedCodes;
            this.supplementalCodes = supplementalCodes;
        }
    }

    private List<EmissionVariableDefinitionVO> variablesInRepeatGroup(List<EmissionVariableDefinitionVO> definitions, String repeatGroupKey) {
        List<EmissionVariableDefinitionVO> groupVariables = new ArrayList<>();
        for (EmissionVariableDefinitionVO candidate : definitions) {
            if (repeatGroupKey.equals(safe(candidate.getRepeatGroupKey()))) {
                groupVariables.add(candidate);
            }
        }
        return groupVariables;
    }

    private Set<Integer> populatedLines(Map<String, Map<Integer, String>> inputs,
                                        List<EmissionVariableDefinitionVO> groupVariables,
                                        String categoryCode,
                                        int tier) {
        Set<Integer> lines = new LinkedHashSet<>();
        Map<String, EmissionVariableDefinitionVO> definitionByCode = indexDefinitionsByCode(groupVariables);
        for (EmissionVariableDefinitionVO variable : groupVariables) {
            String code = safe(variable.getVarCode()).toUpperCase(Locale.ROOT);
            Map<Integer, String> rows = inputs.get(code);
            if (rows == null) {
                continue;
            }
            for (Map.Entry<Integer, String> entry : rows.entrySet()) {
                Integer lineNo = entry.getKey();
                if (lineNo == null || isDisabledFieldByCategoryCode(categoryCode, tier, inputs, definitionByCode, code, lineNo)) {
                    continue;
                }
                if (!safe(entry.getValue()).isEmpty()) {
                    lines.add(lineNo);
                }
            }
        }
        return lines;
    }

    private boolean hasAnyValue(EmissionCategoryVO category,
                                Map<String, Map<Integer, String>> inputs,
                                Map<String, EmissionVariableDefinitionVO> definitionByCode,
                                String varCode,
                                String categoryCode,
                                int tier) {
        Map<Integer, String> rows = inputs.get(varCode);
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        for (Map.Entry<Integer, String> entry : rows.entrySet()) {
            Integer lineNo = entry.getKey();
            if (lineNo != null && isDisabledField(category, tier, inputs, definitionByCode, varCode, lineNo)) {
                return true;
            }
            if (!safe(entry.getValue()).isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasValue(Map<String, Map<Integer, String>> inputs, String varCode, int lineNo) {
        Map<Integer, String> rows = inputs.get(varCode);
        if (rows == null) {
            return false;
        }
        return !safe(rows.get(lineNo)).isEmpty();
    }

    private boolean isDisabledField(EmissionCategoryVO category,
                                    int tier,
                                    Map<String, Map<Integer, String>> inputs,
                                    Map<String, EmissionVariableDefinitionVO> definitionByCode,
                                    String varCode,
                                    int lineNo) {
        String categoryCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        return isDisabledFieldByCategoryCode(categoryCode, tier, inputs, definitionByCode, varCode, lineNo);
    }

    private boolean isDisabledFieldByCategoryCode(String categoryCode,
                                                  int tier,
                                                  Map<String, Map<Integer, String>> inputs,
                                                  Map<String, EmissionVariableDefinitionVO> definitionByCode,
                                                  String varCode,
                                                  int lineNo) {
        EmissionVariableDefinitionVO variable = definitionByCode.get(safe(varCode).toUpperCase(Locale.ROOT));
        if (variable != null) {
            EmissionCategoryVO syntheticCategory = new EmissionCategoryVO();
            syntheticCategory.setSubCode(categoryCode);
            if (EmissionVariableConditionSupport.isDisabled(syntheticCategory, tier, inputs, variable, lineNo)) {
                return true;
            }
        }
        if (!"LIME".equals(categoryCode) || tier != 2) {
            return false;
        }
        String code = safe(varCode).toUpperCase(Locale.ROOT);
        String limeType = resolveLimeTier2Type(inputs, lineNo);
        boolean isDolomitic = "DOLOMITIC".equals(limeType)
                || "DOLOMITIC_HIGH".equals(limeType)
                || "DOLOMITIC_LOW".equals(limeType);
        if (!limeType.isEmpty() && !isDolomitic && "CAO_MGO_CONTENT".equals(code)) {
            return true;
        }
        String hydrated = lineValue(inputs, "HYDRATED_LIME_PRODUCTION_YN", lineNo).toUpperCase(Locale.ROOT);
        return ("X".equals(code) || "Y".equals(code)) && "N".equals(hydrated);
    }

    private Map<String, EmissionVariableDefinitionVO> indexDefinitionsByCode(List<EmissionVariableDefinitionVO> definitions) {
        Map<String, EmissionVariableDefinitionVO> rows = new LinkedHashMap<>();
        for (EmissionVariableDefinitionVO definition : definitions) {
            String code = safe(definition == null ? null : definition.getVarCode()).toUpperCase(Locale.ROOT);
            if (!code.isEmpty()) {
                rows.put(code, definition);
            }
        }
        return rows;
    }

    private String resolveLimeTier2Type(Map<String, Map<Integer, String>> inputs, int lineNo) {
        String normalized = normalizeToken(lineValue(inputs, "LIME_TYPE", lineNo));
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

    private String normalizeToken(String value) {
        return safe(value)
                .toUpperCase(Locale.ROOT)
                .replace(" ", "")
                .replace("_", "")
                .replace("-", "")
                .replace("·", "")
                .replace(".", "")
                .replace("내지", "");
    }

    private String lineValue(Map<String, Map<Integer, String>> inputs, String varCode, int lineNo) {
        Map<Integer, String> rows = inputs.get(varCode);
        if (rows == null) {
            return "";
        }
        return safe(rows.get(lineNo));
    }

    private String displayLabel(EmissionVariableDefinitionVO variable) {
        String displayName = safe(variable == null ? null : variable.getDisplayName());
        if (!displayName.isEmpty()) {
            return displayName;
        }
        String varName = safe(variable == null ? null : variable.getVarName());
        if (!varName.isEmpty()) {
            return varName;
        }
        return safe(variable == null ? null : variable.getVarCode());
    }
}
