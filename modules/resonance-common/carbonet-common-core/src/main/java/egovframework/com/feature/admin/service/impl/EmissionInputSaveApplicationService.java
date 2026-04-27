package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.dto.request.EmissionInputSessionSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionInputValueRequest;
import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

final class EmissionInputSaveApplicationService {
    private final AdminEmissionManagementMapper adminEmissionManagementMapper;
    private final EmissionManagementValidationSupport validationSupport;
    private final EmissionInputSavePolicySupport inputSavePolicySupport;
    private final EmissionManagementCommandBuilder commandBuilder;

    EmissionInputSaveApplicationService(AdminEmissionManagementMapper adminEmissionManagementMapper,
                                        EmissionManagementValidationSupport validationSupport,
                                        EmissionInputSavePolicySupport inputSavePolicySupport,
                                        EmissionManagementCommandBuilder commandBuilder) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
        this.validationSupport = validationSupport;
        this.inputSavePolicySupport = inputSavePolicySupport;
        this.commandBuilder = commandBuilder;
    }

    EmissionInputSaveExecution save(EmissionInputSessionSaveRequest request, String actorId) {
        if (request == null) {
            throw new IllegalArgumentException("Request body is required.");
        }
        EmissionCategoryVO category = validationSupport.requireCategory(request.getCategoryId());
        int normalizedTier = validationSupport.requireTier(category, request.getTier());
        List<EmissionInputValueRequest> values = request.getValues() == null ? Collections.emptyList() : request.getValues();
        String createdBy = EmissionManagementValueSupport.firstNonBlank(
                EmissionManagementValueSupport.safe(actorId),
                EmissionManagementValueSupport.safe(request.getCreatedBy()),
                "anonymous"
        );
        validationSupport.validateRequiredDirectInputs(category, normalizedTier, values);

        Map<String, Object> sessionParams = commandBuilder.inputSession(category.getCategoryId(), normalizedTier, createdBy);
        adminEmissionManagementMapper.insertEmissionInputSession(sessionParams);
        Long sessionId = validationSupport.requireGeneratedId(sessionParams, "sessionId", "emission input session");

        Set<String> acceptedCodes = inputSavePolicySupport.loadAcceptedVariableCodes(category, normalizedTier);
        int savedCount = 0;
        for (EmissionInputValueRequest value : values) {
            String varCode = EmissionManagementValueSupport.safe(value == null ? null : value.getVarCode()).toUpperCase(Locale.ROOT);
            if (varCode.isEmpty()) {
                continue;
            }
            if (!acceptedCodes.isEmpty() && !acceptedCodes.contains(varCode)) {
                throw new IllegalArgumentException("Unsupported variable code: " + varCode);
            }
            if (inputSavePolicySupport.isDerivedCarbonateFactorInput(category, normalizedTier, varCode)) {
                continue;
            }
            Map<String, Object> valueParams = commandBuilder.inputValue(sessionId, varCode, value);
            adminEmissionManagementMapper.insertEmissionInputValue(valueParams);
            validationSupport.requireGeneratedId(valueParams, "inputValueId", "emission input value");
            savedCount++;
        }
        return new EmissionInputSaveExecution(sessionId, category, normalizedTier, savedCount);
    }
}
