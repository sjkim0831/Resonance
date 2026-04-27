package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService;
import egovframework.com.common.service.CommonCodeService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class EmissionManagementConfiguration {
    @Bean
    EmissionCalculationDefinitionRegistry emissionCalculationDefinitionRegistry() {
        return EmissionCalculationComponents.createDefault().calculationDefinitionRegistry;
    }

    @Bean
    EmissionCalculationInputMapper emissionCalculationInputMapper() {
        return new EmissionCalculationInputMapper();
    }

    @Bean
    EmissionManagementValidationSupport emissionManagementValidationSupport(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                                            EmissionCalculationDefinitionRegistry calculationDefinitionRegistry,
                                                                            egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService,
                                                                            EmissionVariableDefinitionAssembler emissionVariableDefinitionAssembler) {
        return new EmissionManagementValidationSupport(
                adminEmissionManagementMapper,
                calculationDefinitionRegistry,
                adminEmissionDefinitionStudioService,
                emissionVariableDefinitionAssembler
        );
    }

    @Bean
    EmissionCalculationResultTransformer emissionCalculationResultTransformer(ObjectMapper objectMapper) {
        return new EmissionCalculationResultTransformer(objectMapper);
    }

    @Bean
    DefinitionFormulaPreviewService definitionFormulaPreviewService(ObjectMapper objectMapper) {
        return new DefinitionFormulaPreviewService(objectMapper);
    }

    @Bean
    EmissionCategoryTierDataProvider emissionCategoryTierDataProvider(AdminEmissionManagementMapper adminEmissionManagementMapper) {
        return new EmissionCategoryTierDataProvider(adminEmissionManagementMapper);
    }

    @Bean
    EmissionInputSavePolicySupport emissionInputSavePolicySupport(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                                  egovframework.com.feature.admin.service.AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService) {
        return new EmissionInputSavePolicySupport(adminEmissionManagementMapper, adminEmissionDefinitionStudioService);
    }

    @Bean
    EmissionManagementCommandBuilder emissionManagementCommandBuilder() {
        return new EmissionManagementCommandBuilder();
    }

    @Bean
    EmissionCategoryMetadataProvider emissionCategoryMetadataProvider() {
        return new EmissionCategoryMetadataProvider();
    }

    @Bean
    EmissionVariableDefinitionAssembler emissionVariableDefinitionAssembler(CommonCodeService commonCodeService) {
        return new EmissionVariableDefinitionAssembler(
                commonCodeService,
                EmissionManagementConstants.CARBONATE_CODE_ID,
                EmissionManagementConstants.LIME_TYPE_TIER1_CODE_ID,
                EmissionManagementConstants.LIME_TYPE_TIER23_CODE_ID,
                EmissionManagementConstants.HYDRATED_LIME_CODE_ID,
                EmissionManagementConstants.FLAG_Y,
                EmissionManagementConstants.FLAG_N
        );
    }

    @Bean
    EmissionManagementResponsePresenter emissionManagementResponsePresenter() {
        return new EmissionManagementResponsePresenter();
    }

    @Bean
    EmissionManagementQueryService emissionManagementQueryService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                                  EmissionCalculationDefinitionRegistry calculationDefinitionRegistry,
                                                                  EmissionVariableDefinitionAssembler variableDefinitionAssembler,
                                                                  EmissionManagementValidationSupport validationSupport,
                                                                  EmissionCalculationResultTransformer resultTransformer,
                                                                  EmissionCategoryTierDataProvider categoryTierDataProvider,
                                                                  EmissionCategoryMetadataProvider categoryMetadataProvider,
                                                                  AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService) {
        return new EmissionManagementQueryService(
                adminEmissionManagementMapper,
                calculationDefinitionRegistry,
                variableDefinitionAssembler,
                validationSupport,
                resultTransformer,
                categoryTierDataProvider,
                categoryMetadataProvider,
                adminEmissionDefinitionStudioService
        );
    }

    @Bean
    EmissionInputSaveApplicationService emissionInputSaveApplicationService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                                            EmissionManagementValidationSupport validationSupport,
                                                                            EmissionInputSavePolicySupport inputSavePolicySupport,
                                                                            EmissionManagementCommandBuilder commandBuilder) {
        return new EmissionInputSaveApplicationService(
                adminEmissionManagementMapper,
                validationSupport,
                inputSavePolicySupport,
                commandBuilder
        );
    }

    @Bean
    EmissionCalculationApplicationService emissionCalculationApplicationService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                                                EmissionCalculationDefinitionRegistry calculationDefinitionRegistry,
                                                                                EmissionCalculationInputMapper calculationInputMapper,
                                                                                EmissionManagementValidationSupport validationSupport,
                                                                                EmissionCalculationResultTransformer resultTransformer,
                                                                                EmissionCategoryTierDataProvider categoryTierDataProvider,
                                                                                EmissionManagementCommandBuilder commandBuilder,
                                                                                DefinitionFormulaPreviewService definitionFormulaPreviewService,
                                                                                EmissionRuntimeTransitionHistoryService runtimeTransitionHistoryService) {
        return new EmissionCalculationApplicationService(
                adminEmissionManagementMapper,
                calculationDefinitionRegistry,
                calculationInputMapper,
                validationSupport,
                resultTransformer,
                categoryTierDataProvider,
                commandBuilder,
                definitionFormulaPreviewService,
                runtimeTransitionHistoryService
        );
    }

    @Bean
    EmissionScopeStatusService emissionScopeStatusService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                                          AdminEmissionDefinitionStudioService adminEmissionDefinitionStudioService,
                                                          EmissionManagementValidationSupport validationSupport,
                                                          EmissionCalculationResultTransformer resultTransformer,
                                                          EmissionMaterializationHistoryService materializationHistoryService,
                                                          EmissionRuntimeTransitionHistoryService runtimeTransitionHistoryService) {
        return new EmissionScopeStatusService(
                adminEmissionManagementMapper,
                adminEmissionDefinitionStudioService,
                validationSupport,
                resultTransformer,
                materializationHistoryService,
                runtimeTransitionHistoryService
        );
    }
}
