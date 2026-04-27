package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import egovframework.com.common.model.ComDefaultCodeVO;
import egovframework.com.common.service.CmmnDetailCode;
import egovframework.com.common.service.CommonCodeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.firstNonBlank;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.intValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.longValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.option;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.stringValue;

final class EmissionVariableDefinitionAssembler {
    private static final Logger log = LoggerFactory.getLogger(EmissionVariableDefinitionAssembler.class);

    private final CommonCodeService commonCodeService;
    private final String carbonateTypeCodeId;
    private final String limeTypeTier1CodeId;
    private final String limeTypeTier2CodeId;
    private final String hydratedLimeProductionCodeId;
    private final String yes;
    private final String no;

    EmissionVariableDefinitionAssembler(CommonCodeService commonCodeService,
                                        String carbonateTypeCodeId,
                                        String limeTypeTier1CodeId,
                                        String limeTypeTier2CodeId,
                                        String hydratedLimeProductionCodeId,
                                        String yes,
                                        String no) {
        this.commonCodeService = commonCodeService;
        this.carbonateTypeCodeId = carbonateTypeCodeId;
        this.limeTypeTier1CodeId = limeTypeTier1CodeId;
        this.limeTypeTier2CodeId = limeTypeTier2CodeId;
        this.hydratedLimeProductionCodeId = hydratedLimeProductionCodeId;
        this.yes = yes;
        this.no = no;
    }

    List<EmissionVariableDefinitionVO> enrich(EmissionCategoryVO category,
                                              Integer tier,
                                              List<EmissionVariableDefinitionVO> variables,
                                              CalculationDefinition definition) {
        if (variables == null || variables.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, String>> carbonateOptions = loadCommonCodeOptions(carbonateTypeCodeId);
        List<Map<String, String>> limeTypeTier1Options = loadCommonCodeOptions(limeTypeTier1CodeId);
        List<Map<String, String>> limeTypeTier2Options = loadCommonCodeOptions(limeTypeTier2CodeId);
        List<Map<String, String>> hydratedLimeProductionOptions = List.of(
                option("Y", "생산함"),
                option("N", "생산하지 않음")
        );
        String subCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        for (EmissionVariableDefinitionVO variable : variables) {
            applyVariableOptions(variable, subCode, tier, carbonateOptions, limeTypeTier1Options, limeTypeTier2Options, hydratedLimeProductionOptions);
            applyVariableUiMetadata(variable, definition);
        }
        return variables;
    }

    List<EmissionVariableDefinitionVO> applyDefinitionOverrides(List<EmissionVariableDefinitionVO> baseVariables,
                                                                Map<String, Object> definitionDraft,
                                                                Long categoryId,
                                                                Integer tier) {
        if (baseVariables == null || baseVariables.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> overrides = asMapList(definitionDraft == null ? null : definitionDraft.get("variableDefinitions"));
        if (overrides.isEmpty()) {
            return baseVariables;
        }
        List<EmissionVariableDefinitionVO> merged = new ArrayList<>();
        Map<String, Integer> indexByCode = new LinkedHashMap<>();
        for (EmissionVariableDefinitionVO variable : baseVariables) {
            EmissionVariableDefinitionVO copy = copyVariable(variable);
            indexByCode.put(safe(copy.getVarCode()).toUpperCase(Locale.ROOT), merged.size());
            merged.add(copy);
        }
        for (int index = 0; index < overrides.size(); index += 1) {
            Map<String, Object> override = overrides.get(index);
            String varCode = safe(stringValue(override == null ? null : override.get("varCode"))).toUpperCase(Locale.ROOT);
            if (varCode.isEmpty()) {
                continue;
            }
            EmissionVariableDefinitionVO normalized = buildOverrideVariable(override, categoryId, tier, index, varCode);
            Integer existingIndex = indexByCode.get(varCode);
            if (existingIndex != null) {
                mergeVariable(merged.get(existingIndex), normalized);
                continue;
            }
            indexByCode.put(varCode, merged.size());
            merged.add(normalized);
        }
        merged.sort((left, right) -> Integer.compare(left.getSortOrder() == null ? 0 : left.getSortOrder(), right.getSortOrder() == null ? 0 : right.getSortOrder()));
        return merged;
    }

    private void applyVariableOptions(EmissionVariableDefinitionVO variable,
                                      String subCode,
                                      Integer tier,
                                      List<Map<String, String>> carbonateOptions,
                                      List<Map<String, String>> limeTypeTier1Options,
                                      List<Map<String, String>> limeTypeTier2Options,
                                      List<Map<String, String>> hydratedLimeProductionOptions) {
        String varCode = safe(variable == null ? null : variable.getVarCode()).toUpperCase(Locale.ROOT);
        if (varCode.endsWith("CARBONATE_TYPE")) {
            variable.setCommonCodeId(carbonateTypeCodeId);
            variable.setOptions(carbonateOptions);
            return;
        }
        if ("LIME".equals(subCode) && "LIME_TYPE".equals(varCode)) {
            if (Objects.equals(tier, 1)) {
                variable.setCommonCodeId(limeTypeTier1CodeId);
                variable.setOptions(limeTypeTier1Options);
            } else if (Objects.equals(tier, 2)) {
                variable.setCommonCodeId(limeTypeTier2CodeId);
                variable.setOptions(limeTypeTier2Options);
            }
            return;
        }
        if ("LIME".equals(subCode) && Objects.equals(tier, 2) && "HYDRATED_LIME_PRODUCTION_YN".equals(varCode)) {
            variable.setCommonCodeId(hydratedLimeProductionCodeId);
            variable.setOptions(hydratedLimeProductionOptions);
        }
    }

    private void applyVariableUiMetadata(EmissionVariableDefinitionVO variable, CalculationDefinition definition) {
        String varCode = safe(variable == null ? null : variable.getVarCode()).toUpperCase(Locale.ROOT);
        if (varCode.isEmpty()) {
            return;
        }
        String displayName = firstNonBlank(safe(variable.getDisplayName()), definition.uiDefinition.displayName(varCode));
        if (!displayName.isEmpty()) {
            variable.setDisplayName(displayName);
        }
        String displayCode = firstNonBlank(safe(variable.getDisplayCode()), definition.uiDefinition.displayCode(varCode));
        if (!displayCode.isEmpty()) {
            variable.setDisplayCode(displayCode);
        }
        String uiHint = firstNonBlank(safe(variable.getUiHint()), definition.uiDefinition.uiHint(varCode));
        if (!uiHint.isEmpty()) {
            variable.setUiHint(uiHint);
        }
        variable.setDerivedYn(firstNonBlank(safe(variable.getDerivedYn()), definition.uiDefinition.isDerived(varCode) ? yes : no));
        variable.setSupplementalYn(firstNonBlank(safe(variable.getSupplementalYn()), definition.uiDefinition.isSupplemental(varCode) ? yes : no));
        String repeatGroupKey = firstNonBlank(safe(variable.getRepeatGroupKey()), definition.uiDefinition.repeatGroupKey(varCode));
        if (!repeatGroupKey.isEmpty()) {
            variable.setRepeatGroupKey(repeatGroupKey);
        }
        String visibleWhen = firstNonBlank(safe(variable.getVisibleWhen()), definition.uiDefinition.visibleWhen(varCode));
        if (!visibleWhen.isEmpty()) {
            variable.setVisibleWhen(visibleWhen);
        }
        String disabledWhen = firstNonBlank(safe(variable.getDisabledWhen()), definition.uiDefinition.disabledWhen(varCode));
        if (!disabledWhen.isEmpty()) {
            variable.setDisabledWhen(disabledWhen);
        }
        VariableSectionDefinition section = hasSectionMetadata(variable)
                ? new VariableSectionDefinition(
                safe(variable.getSectionId()),
                variable.getSectionOrder() == null ? 0 : variable.getSectionOrder(),
                safe(variable.getSectionTitle()),
                safe(variable.getSectionDescription()),
                safe(variable.getSectionFormula()),
                safe(variable.getSectionPreviewType()),
                safe(variable.getSectionRelatedFactorCodes()))
                : definition.uiDefinition.section(varCode);
        if (section != null && !section.id.isEmpty()) {
            setSection(variable, section.id, section.order, section.title, section.description, section.formula, section.previewType, section.relatedFactorCodes);
        }
    }

    private boolean hasSectionMetadata(EmissionVariableDefinitionVO variable) {
        return variable != null && !safe(variable.getSectionId()).isEmpty();
    }

    private void setSection(EmissionVariableDefinitionVO variable,
                            String sectionId,
                            Integer sectionOrder,
                            String sectionTitle,
                            String sectionDescription,
                            String sectionFormula,
                            String sectionPreviewType,
                            String sectionRelatedFactorCodes) {
        variable.setSectionId(sectionId);
        variable.setSectionOrder(sectionOrder);
        variable.setSectionTitle(sectionTitle);
        variable.setSectionDescription(sectionDescription);
        variable.setSectionFormula(sectionFormula);
        variable.setSectionPreviewType(sectionPreviewType);
        variable.setSectionRelatedFactorCodes(sectionRelatedFactorCodes);
    }

    private List<Map<String, String>> loadCommonCodeOptions(String codeId) {
        if (commonCodeService == null || safe(codeId).isEmpty()) {
            return Collections.emptyList();
        }
        try {
            ComDefaultCodeVO request = new ComDefaultCodeVO();
            request.setCodeId(codeId);
            List<CmmnDetailCode> detailCodes = commonCodeService.selectCmmCodeDetail(request);
            List<Map<String, String>> options = new ArrayList<>();
            for (CmmnDetailCode detailCode : detailCodes) {
                options.add(buildCommonCodeOption(detailCode));
            }
            return options;
        } catch (Exception e) {
            log.warn("Failed to load common code options. codeId={}", codeId, e);
            return Collections.emptyList();
        }
    }

    private Map<String, String> buildCommonCodeOption(CmmnDetailCode detailCode) {
        Map<String, String> option = new java.util.LinkedHashMap<>();
        option.put("code", safe(detailCode.getCode()));
        option.put("label", firstNonBlank(safe(detailCode.getCodeNm()), safe(detailCode.getCode())));
        option.put("description", safe(detailCode.getCodeDc()));
        return option;
    }

    private EmissionVariableDefinitionVO copyVariable(EmissionVariableDefinitionVO source) {
        EmissionVariableDefinitionVO copy = new EmissionVariableDefinitionVO();
        mergeVariable(copy, source);
        return copy;
    }

    private EmissionVariableDefinitionVO buildOverrideVariable(Map<String, Object> override,
                                                               Long categoryId,
                                                               Integer tier,
                                                               int overrideIndex,
                                                               String varCode) {
        EmissionVariableDefinitionVO variable = new EmissionVariableDefinitionVO();
        variable.setVariableId(longValue(override.get("variableId")));
        variable.setCategoryId(longValue(override.get("categoryId")) == null ? categoryId : longValue(override.get("categoryId")));
        variable.setTier(intValue(override.get("tier")) == null ? tier : intValue(override.get("tier")));
        variable.setVarCode(varCode);
        variable.setVarName(firstNonBlank(safe(stringValue(override.get("varName"))), varCode));
        variable.setVarDesc(safe(stringValue(override.get("varDesc"))));
        variable.setUnit(safe(stringValue(override.get("unit"))));
        variable.setInputType(firstNonBlank(safe(stringValue(override.get("inputType"))), "TEXT"));
        variable.setSourceType(safe(stringValue(override.get("sourceType"))));
        variable.setRepeatable(safe(stringValue(override.get("isRepeatable"))));
        variable.setRequired(safe(stringValue(override.get("isRequired"))));
        variable.setSortOrder(intValue(override.get("sortOrder")) == null ? 1000 + overrideIndex : intValue(override.get("sortOrder")));
        variable.setUseYn(firstNonBlank(safe(stringValue(override.get("useYn"))), "Y"));
        variable.setCommonCodeId(safe(stringValue(override.get("commonCodeId"))));
        variable.setOptions(asStringMapList(override.get("options")));
        variable.setDisplayName(safe(stringValue(override.get("displayName"))));
        variable.setDisplayCode(safe(stringValue(override.get("displayCode"))));
        variable.setUiHint(safe(stringValue(override.get("uiHint"))));
        variable.setDerivedYn(safe(stringValue(override.get("derivedYn"))));
        variable.setSupplementalYn(safe(stringValue(override.get("supplementalYn"))));
        variable.setRepeatGroupKey(safe(stringValue(override.get("repeatGroupKey"))));
        variable.setSectionId(safe(stringValue(override.get("sectionId"))));
        variable.setSectionOrder(intValue(override.get("sectionOrder")) == null ? 0 : intValue(override.get("sectionOrder")));
        variable.setSectionTitle(safe(stringValue(override.get("sectionTitle"))));
        variable.setSectionDescription(safe(stringValue(override.get("sectionDescription"))));
        variable.setSectionFormula(safe(stringValue(override.get("sectionFormula"))));
        variable.setSectionPreviewType(safe(stringValue(override.get("sectionPreviewType"))));
        variable.setSectionRelatedFactorCodes(safe(stringValue(override.get("sectionRelatedFactorCodes"))));
        variable.setVisibleWhen(safe(stringValue(override.get("visibleWhen"))));
        variable.setDisabledWhen(safe(stringValue(override.get("disabledWhen"))));
        return variable;
    }

    private void mergeVariable(EmissionVariableDefinitionVO target, EmissionVariableDefinitionVO source) {
        if (target == null || source == null) {
            return;
        }
        if (source.getVariableId() != null) {
            target.setVariableId(source.getVariableId());
        }
        if (source.getCategoryId() != null) {
            target.setCategoryId(source.getCategoryId());
        }
        if (source.getTier() != null) {
            target.setTier(source.getTier());
        }
        if (!safe(source.getVarCode()).isEmpty()) {
            target.setVarCode(source.getVarCode());
        }
        if (!safe(source.getVarName()).isEmpty()) {
            target.setVarName(source.getVarName());
        }
        if (!safe(source.getVarDesc()).isEmpty()) {
            target.setVarDesc(source.getVarDesc());
        }
        if (!safe(source.getUnit()).isEmpty()) {
            target.setUnit(source.getUnit());
        }
        if (!safe(source.getInputType()).isEmpty()) {
            target.setInputType(source.getInputType());
        }
        if (!safe(source.getSourceType()).isEmpty()) {
            target.setSourceType(source.getSourceType());
        }
        if (!safe(source.getRepeatable()).isEmpty()) {
            target.setRepeatable(source.getRepeatable());
        }
        if (!safe(source.getRequired()).isEmpty()) {
            target.setRequired(source.getRequired());
        }
        if (source.getSortOrder() != null) {
            target.setSortOrder(source.getSortOrder());
        }
        if (!safe(source.getUseYn()).isEmpty()) {
            target.setUseYn(source.getUseYn());
        }
        if (!safe(source.getCommonCodeId()).isEmpty()) {
            target.setCommonCodeId(source.getCommonCodeId());
        }
        if (source.getOptions() != null && !source.getOptions().isEmpty()) {
            target.setOptions(source.getOptions());
        }
        if (!safe(source.getDisplayName()).isEmpty()) {
            target.setDisplayName(source.getDisplayName());
        }
        if (!safe(source.getDisplayCode()).isEmpty()) {
            target.setDisplayCode(source.getDisplayCode());
        }
        if (!safe(source.getUiHint()).isEmpty()) {
            target.setUiHint(source.getUiHint());
        }
        if (!safe(source.getDerivedYn()).isEmpty()) {
            target.setDerivedYn(source.getDerivedYn());
        }
        if (!safe(source.getSupplementalYn()).isEmpty()) {
            target.setSupplementalYn(source.getSupplementalYn());
        }
        if (!safe(source.getRepeatGroupKey()).isEmpty()) {
            target.setRepeatGroupKey(source.getRepeatGroupKey());
        }
        if (!safe(source.getSectionId()).isEmpty()) {
            target.setSectionId(source.getSectionId());
        }
        if (source.getSectionOrder() != null) {
            target.setSectionOrder(source.getSectionOrder());
        }
        if (!safe(source.getSectionTitle()).isEmpty()) {
            target.setSectionTitle(source.getSectionTitle());
        }
        if (!safe(source.getSectionDescription()).isEmpty()) {
            target.setSectionDescription(source.getSectionDescription());
        }
        if (!safe(source.getSectionFormula()).isEmpty()) {
            target.setSectionFormula(source.getSectionFormula());
        }
        if (!safe(source.getSectionPreviewType()).isEmpty()) {
            target.setSectionPreviewType(source.getSectionPreviewType());
        }
        if (!safe(source.getSectionRelatedFactorCodes()).isEmpty()) {
            target.setSectionRelatedFactorCodes(source.getSectionRelatedFactorCodes());
        }
        if (!safe(source.getVisibleWhen()).isEmpty()) {
            target.setVisibleWhen(source.getVisibleWhen());
        }
        if (!safe(source.getDisabledWhen()).isEmpty()) {
            target.setDisabledWhen(source.getDisabledWhen());
        }
    }
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asMapList(Object value) {
        if (value instanceof List<?>) {
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Object item : (List<Object>) value) {
                if (item instanceof Map<?, ?>) {
                    rows.add(new LinkedHashMap<>((Map<String, Object>) item));
                }
            }
            return rows;
        }
        return Collections.emptyList();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> asStringMapList(Object value) {
        if (value instanceof List<?>) {
            List<Map<String, String>> rows = new ArrayList<>();
            for (Object item : (List<Object>) value) {
                if (item instanceof Map<?, ?>) {
                    rows.add(new LinkedHashMap<>((Map<String, String>) item));
                }
            }
            return rows;
        }
        return Collections.emptyList();
    }
}
