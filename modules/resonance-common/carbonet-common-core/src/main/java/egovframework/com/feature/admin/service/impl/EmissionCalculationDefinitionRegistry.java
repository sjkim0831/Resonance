package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class EmissionCalculationDefinitionRegistry {
    private final Map<String, CalculationDefinition> definitions = new LinkedHashMap<>();
    private final CalculationExecutor cementTier1Executor;
    private final CalculationExecutor cementTier2Executor;
    private final CalculationExecutor cementTier3Executor;
    private final CalculationExecutor limeTier1Executor;
    private final CalculationExecutor limeTier2Executor;
    private final CalculationExecutor limeTier3Executor;

    EmissionCalculationDefinitionRegistry(CalculationExecutor cementTier1Executor,
                                          CalculationExecutor cementTier2Executor,
                                          CalculationExecutor cementTier3Executor,
                                          CalculationExecutor limeTier1Executor,
                                          CalculationExecutor limeTier2Executor,
                                          CalculationExecutor limeTier3Executor) {
        this.cementTier1Executor = cementTier1Executor;
        this.cementTier2Executor = cementTier2Executor;
        this.cementTier3Executor = cementTier3Executor;
        this.limeTier1Executor = limeTier1Executor;
        this.limeTier2Executor = limeTier2Executor;
        this.limeTier3Executor = limeTier3Executor;
        registerDefinitions();
    }

    CalculationDefinition require(EmissionCategoryVO category, Integer tier) {
        String subCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        CalculationDefinition definition = definitions.get(calculationKey(subCode, tier == null ? 0 : tier));
        if (definition == null) {
            throw new IllegalArgumentException("Unsupported emission category/tier: " + subCode + "/" + tier);
        }
        return definition;
    }

    boolean supports(EmissionCategoryVO category, Integer tier) {
        String subCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        int normalizedTier = tier == null ? 0 : tier;
        return definitions.containsKey(calculationKey(subCode, normalizedTier));
    }

    private void registerDefinitions() {
        register(definitions, CalculationDefinition.builder("CEMENT", 1)
                .formulaSummary("[SUM(Mci * Ccli) - Im + Ex] * EFclc")
                .formulaDisplay("CO2 = [Σ(Mci × Ccli) - Im + Ex] × EFclc")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.cementTier1())
                .executor(cementTier1Executor)
                .build());
        register(definitions, CalculationDefinition.builder("CEMENT", 2)
                .formulaSummary("Mcl * EFcl * CFckd")
                .formulaDisplay("CO2 = Mcl × EFcl × CFckd")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.cementTier2())
                .executor(cementTier2Executor)
                .build());
        register(definitions, CalculationDefinition.builder("CEMENT", 3)
                .formulaSummary("SUM(EFi * Mi * Fi) - Md * Cd * (1 - Fd) * EFd + SUM(Mk * Xk * EFk)")
                .formulaDisplay("CO2 = Σ(EFi × Mi × Fi) - Md × Cd × (1 - Fd) × EFd + Σ(Mk × Xk × EFk)")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.cementTier3())
                .executor(cementTier3Executor)
                .build());
        register(definitions, CalculationDefinition.builder("LIME", 1)
                .formulaSummary("SUM(EF석회,i * Ml,i)")
                .formulaDisplay("CO2 = Σ(EF석회,i × Ml,i)")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.limeTier1())
                .executor(limeTier1Executor)
                .build());
        register(definitions, CalculationDefinition.builder("LIME", 2)
                .formulaSummary("SUM(EF석회,i * Ml,i * CF_lkd,i * C_h,i)")
                .formulaDisplay("CO2 = Σ(EF석회,i × Ml,i × CF_lkd,i × C_h,i)")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.limeTier2())
                .executor(limeTier2Executor)
                .build());
        register(definitions, CalculationDefinition.builder("LIME", 3)
                .formulaSummary("SUM(EFi * Mi * Fi) - Md * Cd * (1 - Fd) * EFd")
                .formulaDisplay("CO2 = Σ(EFi × Mi × Fi) - Md × Cd × (1 - Fd) × EFd")
                .uiDefinition(EmissionCalculationUiDefinitionFactory.limeTier3())
                .executor(limeTier3Executor)
                .build());
    }

    private void register(Map<String, CalculationDefinition> definitions, CalculationDefinition definition) {
        definitions.put(calculationKey(definition.subCode, definition.tier), definition);
    }

    private String calculationKey(String subCode, int tier) {
        return subCode + ":" + tier;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
