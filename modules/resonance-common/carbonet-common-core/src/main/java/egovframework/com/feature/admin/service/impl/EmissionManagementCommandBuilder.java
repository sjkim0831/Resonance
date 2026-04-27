package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.dto.request.EmissionInputValueRequest;

import java.util.LinkedHashMap;
import java.util.Map;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;

final class EmissionManagementCommandBuilder {
    Map<String, Object> inputSession(Long categoryId, int tier, String createdBy) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("categoryId", categoryId);
        params.put("tier", tier);
        params.put("createdBy", createdBy);
        params.put("calcStatus", "DRAFT");
        return params;
    }

    Map<String, Object> inputValue(Long sessionId, String varCode, EmissionInputValueRequest value) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("sessionId", sessionId);
        params.put("varCode", varCode);
        params.put("lineNo", Math.max(value == null || value.getLineNo() == null ? 1 : value.getLineNo(), 1));
        params.put("valueNum", value == null ? null : value.getValueNum());
        params.put("valueText", safe(value == null ? null : value.getValueText()));
        return params;
    }

    Map<String, Object> calcResult(Long sessionId, CalculationResult result, String snapshotJson) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("sessionId", sessionId);
        params.put("co2Total", result.total);
        params.put("formulaSummary", result.formulaSummary);
        params.put("factorSnapshotJson", snapshotJson);
        params.put("defaultAppliedYn", result.defaultApplied ? "Y" : "N");
        return params;
    }
}
