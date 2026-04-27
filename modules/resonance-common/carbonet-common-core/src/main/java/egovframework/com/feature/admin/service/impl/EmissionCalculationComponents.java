package egovframework.com.feature.admin.service.impl;

final class EmissionCalculationComponents {
    final EmissionCalculationDefinitionRegistry calculationDefinitionRegistry;

    private EmissionCalculationComponents(EmissionCalculationDefinitionRegistry calculationDefinitionRegistry) {
        this.calculationDefinitionRegistry = calculationDefinitionRegistry;
    }

    static EmissionCalculationComponents createDefault() {
        CarbonateFactorStrategy carbonateFactorStrategy = new CarbonateFactorStrategy(
                EmissionCalculationConstants.CACO3_FACTOR,
                EmissionCalculationConstants.MGCO3_FACTOR,
                EmissionCalculationConstants.CAMGCO32_FACTOR,
                EmissionCalculationConstants.FECO3_FACTOR,
                EmissionCalculationConstants.CAFE_MG_MN_CO32_FACTOR,
                EmissionCalculationConstants.MNCO3_FACTOR,
                EmissionCalculationConstants.NA2CO3_FACTOR
        );
        LimeFactorStrategy limeFactorStrategy = new LimeFactorStrategy(
                EmissionCalculationConstants.LIME_DEFAULT_FACTOR,
                EmissionCalculationConstants.SR_CAO_DEFAULT,
                EmissionCalculationConstants.SR_CAO_MGO_DEFAULT
        );
        CorrectionFactorStrategy correctionFactorStrategy = new CorrectionFactorStrategy(
                EmissionCalculationConstants.LIME_CF_LKD_DEFAULT,
                EmissionCalculationConstants.HYDRATED_LIME_CORRECTION_DEFAULT
        );
        EmissionCalculationSupport calculationSupport = new EmissionCalculationSupport(
                carbonateFactorStrategy,
                limeFactorStrategy,
                correctionFactorStrategy
        );
        CementEmissionCalculator cementEmissionCalculator = new CementEmissionCalculator(
                calculationSupport,
                EmissionCalculationConstants.CEMENT_TIER1_EFCLC_DEFAULT,
                EmissionCalculationConstants.CEMENT_EFC_DEFAULT,
                EmissionCalculationConstants.CEMENT_EFCL_DEFAULT,
                EmissionCalculationConstants.CEMENT_CFCKD_DEFAULT
        );
        LimeEmissionCalculator limeEmissionCalculator = new LimeEmissionCalculator(
                calculationSupport,
                EmissionCalculationConstants.CACO3_FACTOR
        );
        EmissionCalculationDefinitionRegistry calculationDefinitionRegistry = new EmissionCalculationDefinitionRegistry(
                cementEmissionCalculator::calculateTier1,
                cementEmissionCalculator::calculateTier2,
                cementEmissionCalculator::calculateTier3,
                limeEmissionCalculator::calculateTier1,
                limeEmissionCalculator::calculateTier2,
                limeEmissionCalculator::calculateTier3
        );
        return new EmissionCalculationComponents(calculationDefinitionRegistry);
    }
}
