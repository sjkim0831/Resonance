package egovframework.com.feature.admin.service.impl;

import java.util.Map;

final class CalculationContext {
    final CalculationDefinition definition;
    final Map<String, Double> scalarValues;
    final Map<String, Map<Integer, Double>> lineValues;
    final Map<String, String> scalarTexts;
    final Map<String, Map<Integer, String>> lineTextValues;
    final Map<String, Double> factorValues;

    CalculationContext(CalculationDefinition definition,
                       Map<String, Double> scalarValues,
                       Map<String, Map<Integer, Double>> lineValues,
                       Map<String, String> scalarTexts,
                       Map<String, Map<Integer, String>> lineTextValues,
                       Map<String, Double> factorValues) {
        this.definition = definition;
        this.scalarValues = scalarValues;
        this.lineValues = lineValues;
        this.scalarTexts = scalarTexts;
        this.lineTextValues = lineTextValues;
        this.factorValues = factorValues;
    }
}
