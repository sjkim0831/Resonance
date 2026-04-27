package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.stringValue;

final class EmissionCalculationResultTransformer {
    private final ObjectMapper objectMapper;

    EmissionCalculationResultTransformer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String writeSnapshotJson(CalculationResult result) {
        try {
            return objectMapper.writeValueAsString(result.snapshot());
        } catch (Exception ignored) {
            return "[]";
        }
    }

    Map<String, Object> enrichStoredResult(Map<String, Object> storedResult) {
        if (storedResult == null || storedResult.isEmpty()) {
            return storedResult;
        }
        Object snapshotJson = storedResult.get("factorSnapshotJson");
        if (!(snapshotJson instanceof String) || safe((String) snapshotJson).isEmpty()) {
            return storedResult;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> snapshot = objectMapper.readValue((String) snapshotJson, LinkedHashMap.class);
            storedResult.put("appliedFactors", snapshot.getOrDefault("appliedFactors", Collections.emptyList()));
            storedResult.put("formulaDisplay", snapshot.getOrDefault("formulaDisplay", ""));
            storedResult.put("substitutedFormula", snapshot.getOrDefault("substitutedFormula", ""));
            storedResult.put("calculationLogs", snapshot.getOrDefault("calculationLogs", Collections.emptyList()));
            storedResult.put("definitionFormulaPreview", snapshot.getOrDefault("definitionFormulaPreview", Collections.emptyMap()));
            storedResult.put("definitionFormulaComparison", snapshot.getOrDefault("definitionFormulaComparison", Collections.emptyMap()));
            storedResult.put("definitionFormulaAdopted", snapshot.getOrDefault("definitionFormulaAdopted", false));
            storedResult.put("calculationSource", snapshot.getOrDefault("calculationSource", "LEGACY"));
            storedResult.put("legacyFormulaDisplay", snapshot.getOrDefault("legacyFormulaDisplay", ""));
            storedResult.put("legacySubstitutedFormula", snapshot.getOrDefault("legacySubstitutedFormula", ""));
            storedResult.put("legacyCalculationLogs", snapshot.getOrDefault("legacyCalculationLogs", Collections.emptyList()));
            storedResult.put("defaultApplied", "Y".equalsIgnoreCase(stringValue(storedResult.get("defaultAppliedYn"))));
        } catch (Exception ignored) {
            storedResult.put("appliedFactors", Collections.emptyList());
            storedResult.put("formulaDisplay", "");
            storedResult.put("substitutedFormula", "");
            storedResult.put("calculationLogs", Collections.emptyList());
            storedResult.put("definitionFormulaPreview", Collections.emptyMap());
            storedResult.put("definitionFormulaComparison", Collections.emptyMap());
            storedResult.put("definitionFormulaAdopted", false);
            storedResult.put("calculationSource", "LEGACY");
            storedResult.put("legacyFormulaDisplay", "");
            storedResult.put("legacySubstitutedFormula", "");
            storedResult.put("legacyCalculationLogs", Collections.emptyList());
            storedResult.put("defaultApplied", "Y".equalsIgnoreCase(stringValue(storedResult.get("defaultAppliedYn"))));
        }
        return storedResult;
    }
}
