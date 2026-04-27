package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.buildCategoryTierParams;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.stringValue;

final class EmissionInputSavePolicySupport {
    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final AdminEmissionDefinitionStudioService definitionStudioService;

    EmissionInputSavePolicySupport(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                   AdminEmissionDefinitionStudioService definitionStudioService) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.definitionStudioService = definitionStudioService;
    }

    Set<String> loadAcceptedVariableCodes(EmissionCategoryVO category, Integer tier) {
        Set<String> codes = new LinkedHashSet<>();
        Long categoryId = category == null ? null : category.getCategoryId();
        for (EmissionVariableDefinitionVO variable : adminEmissionManagementMapper.selectEmissionVariableDefinitions(buildCategoryTierParams(categoryId, tier))) {
            codes.add(safe(variable.getVarCode()).toUpperCase(Locale.ROOT));
        }
        for (EmissionFactorVO factor : adminEmissionManagementMapper.selectEmissionFactors(buildCategoryTierParams(categoryId, tier))) {
            codes.add(safe(factor.getFactorCode()).toUpperCase(Locale.ROOT));
        }
        Map<String, Object> publishedDefinition = definitionStudioService.findPublishedDefinitionRaw(category == null ? null : category.getSubCode(), tier);
        codes.addAll(codeSet(publishedDefinition.get("directRequiredCodes")));
        codes.addAll(codeSet(publishedDefinition.get("fallbackCodes")));
        codes.addAll(codeSet(publishedDefinition.get("autoCalculatedCodes")));
        codes.addAll(codeSet(publishedDefinition.get("supplementalCodes")));
        for (Map<String, Object> variable : mapList(publishedDefinition.get("variableDefinitions"))) {
            String varCode = safe(stringValue(variable == null ? null : variable.get("varCode"))).toUpperCase(Locale.ROOT);
            if (!varCode.isEmpty()) {
                codes.add(varCode);
            }
        }
        return codes;
    }

    boolean isDerivedCarbonateFactorInput(EmissionCategoryVO category, int tier, String varCode) {
        Map<String, Object> publishedDefinition = definitionStudioService.findPublishedDefinitionRaw(category == null ? null : category.getSubCode(), tier);
        if (codeSet(publishedDefinition.get("autoCalculatedCodes")).contains(varCode)) {
            return true;
        }
        for (Map<String, Object> variable : mapList(publishedDefinition.get("variableDefinitions"))) {
            String code = safe(stringValue(variable == null ? null : variable.get("varCode"))).toUpperCase(Locale.ROOT);
            if (varCode.equals(code) && "Y".equalsIgnoreCase(safe(stringValue(variable.get("derivedYn"))))) {
                return true;
            }
        }
        String subCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        return "CEMENT".equals(subCode) && tier == 3 && ("EFI".equals(varCode) || "EFK".equals(varCode));
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

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapList(Object value) {
        if (value instanceof List<?>) {
            List<Map<String, Object>> rows = new java.util.ArrayList<>();
            for (Object item : (List<Object>) value) {
                if (item instanceof Map<?, ?>) {
                    rows.add(new java.util.LinkedHashMap<>((Map<String, Object>) item));
                }
            }
            return rows;
        }
        return java.util.Collections.emptyList();
    }
}
