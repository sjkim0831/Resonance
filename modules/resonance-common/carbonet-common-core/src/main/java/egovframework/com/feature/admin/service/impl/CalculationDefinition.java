package egovframework.com.feature.admin.service.impl;

import java.util.Objects;

final class CalculationDefinition {
    final String subCode;
    final int tier;
    final String formulaSummary;
    final String formulaDisplay;
    final VariableUiDefinition uiDefinition;
    final CalculationExecutor executor;

    CalculationDefinition(String subCode,
                          int tier,
                          String formulaSummary,
                          String formulaDisplay,
                          VariableUiDefinition uiDefinition,
                          CalculationExecutor executor) {
        this.subCode = subCode;
        this.tier = tier;
        this.formulaSummary = formulaSummary;
        this.formulaDisplay = formulaDisplay;
        this.uiDefinition = uiDefinition;
        this.executor = executor;
    }

    static Builder builder(String subCode, int tier) {
        return new Builder(subCode, tier);
    }

    static final class Builder {
        private final String subCode;
        private final int tier;
        private String formulaSummary = "";
        private String formulaDisplay = "";
        private VariableUiDefinition uiDefinition = VariableUiDefinition.empty();
        private CalculationExecutor executor;

        Builder(String subCode, int tier) {
            this.subCode = subCode;
            this.tier = tier;
        }

        Builder formulaSummary(String formulaSummary) {
            this.formulaSummary = formulaSummary;
            return this;
        }

        Builder formulaDisplay(String formulaDisplay) {
            this.formulaDisplay = formulaDisplay;
            return this;
        }

        Builder uiDefinition(VariableUiDefinition uiDefinition) {
            this.uiDefinition = uiDefinition == null ? VariableUiDefinition.empty() : uiDefinition;
            return this;
        }

        Builder executor(CalculationExecutor executor) {
            this.executor = executor;
            return this;
        }

        CalculationDefinition build() {
            return new CalculationDefinition(subCode, tier, formulaSummary, formulaDisplay, uiDefinition, Objects.requireNonNull(executor, "executor"));
        }
    }
}
