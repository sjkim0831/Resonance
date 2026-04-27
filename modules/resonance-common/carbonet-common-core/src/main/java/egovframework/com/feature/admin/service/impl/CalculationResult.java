package egovframework.com.feature.admin.service.impl;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class CalculationResult {
    final double total;
    final String formulaSummary;
    final String formulaDisplay;
    final String substitutedFormula;
    final List<Map<String, Object>> appliedFactors;
    final List<Map<String, Object>> calculationLogs;
    final boolean defaultApplied;
    final Map<String, Object> definitionFormulaPreview;
    final Map<String, Object> definitionFormulaComparison;
    final boolean definitionFormulaAdopted;
    final String calculationSource;
    final String legacyFormulaDisplay;
    final String legacySubstitutedFormula;
    final List<Map<String, Object>> legacyCalculationLogs;

    CalculationResult(double total,
                      String formulaSummary,
                      String formulaDisplay,
                      String substitutedFormula,
                      List<Map<String, Object>> appliedFactors,
                      List<Map<String, Object>> calculationLogs,
                      boolean defaultApplied) {
        this(total, formulaSummary, formulaDisplay, substitutedFormula, appliedFactors, calculationLogs, defaultApplied, new LinkedHashMap<String, Object>(), new LinkedHashMap<String, Object>(), false, "LEGACY", formulaDisplay, substitutedFormula, calculationLogs);
    }

    CalculationResult(double total,
                      String formulaSummary,
                      String formulaDisplay,
                      String substitutedFormula,
                      List<Map<String, Object>> appliedFactors,
                      List<Map<String, Object>> calculationLogs,
                      boolean defaultApplied,
                      Map<String, Object> definitionFormulaPreview,
                      Map<String, Object> definitionFormulaComparison,
                      boolean definitionFormulaAdopted,
                      String calculationSource,
                      String legacyFormulaDisplay,
                      String legacySubstitutedFormula,
                      List<Map<String, Object>> legacyCalculationLogs) {
        this.total = total;
        this.formulaSummary = formulaSummary;
        this.appliedFactors = appliedFactors;
        this.formulaDisplay = formulaDisplay;
        this.substitutedFormula = substitutedFormula;
        this.calculationLogs = calculationLogs;
        this.defaultApplied = defaultApplied;
        this.definitionFormulaPreview = definitionFormulaPreview == null ? new LinkedHashMap<String, Object>() : new LinkedHashMap<>(definitionFormulaPreview);
        this.definitionFormulaComparison = definitionFormulaComparison == null ? new LinkedHashMap<String, Object>() : new LinkedHashMap<>(definitionFormulaComparison);
        this.definitionFormulaAdopted = definitionFormulaAdopted;
        this.calculationSource = calculationSource == null ? "LEGACY" : calculationSource;
        this.legacyFormulaDisplay = legacyFormulaDisplay == null ? "" : legacyFormulaDisplay;
        this.legacySubstitutedFormula = legacySubstitutedFormula == null ? "" : legacySubstitutedFormula;
        this.legacyCalculationLogs = legacyCalculationLogs == null ? new java.util.ArrayList<>() : legacyCalculationLogs;
    }

    Map<String, Object> snapshot() {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("appliedFactors", appliedFactors);
        snapshot.put("formulaDisplay", formulaDisplay);
        snapshot.put("substitutedFormula", substitutedFormula);
        snapshot.put("calculationLogs", calculationLogs);
        if (!definitionFormulaPreview.isEmpty()) {
            snapshot.put("definitionFormulaPreview", definitionFormulaPreview);
        }
        if (!definitionFormulaComparison.isEmpty()) {
            snapshot.put("definitionFormulaComparison", definitionFormulaComparison);
        }
        snapshot.put("definitionFormulaAdopted", definitionFormulaAdopted);
        snapshot.put("calculationSource", calculationSource);
        snapshot.put("legacyFormulaDisplay", legacyFormulaDisplay);
        snapshot.put("legacySubstitutedFormula", legacySubstitutedFormula);
        snapshot.put("legacyCalculationLogs", legacyCalculationLogs);
        return snapshot;
    }
}
