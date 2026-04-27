package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionFactorVO;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.doubleValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.intValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safeList;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.stringValue;

final class EmissionCalculationInputMapper {
    Map<String, Double> toScalarMap(List<Map<String, Object>> values) {
        Map<String, Double> result = new LinkedHashMap<>();
        for (Map<String, Object> row : safeList(values)) {
            String varCode = safe(stringValue(row.get("varCode"))).toUpperCase(Locale.ROOT);
            Integer lineNo = intValue(row.get("lineNo"));
            Double valueNum = doubleValue(row.get("valueNum"));
            if (varCode.isEmpty() || valueNum == null) {
                continue;
            }
            if (lineNo == null || lineNo <= 1) {
                result.put(varCode, valueNum);
            }
        }
        return result;
    }

    Map<String, Map<Integer, Double>> toLineValueMap(List<Map<String, Object>> values) {
        Map<String, Map<Integer, Double>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : safeList(values)) {
            String varCode = safe(stringValue(row.get("varCode"))).toUpperCase(Locale.ROOT);
            Integer lineNo = intValue(row.get("lineNo"));
            Double valueNum = doubleValue(row.get("valueNum"));
            if (varCode.isEmpty() || valueNum == null || lineNo == null) {
                continue;
            }
            result.computeIfAbsent(varCode, ignored -> new LinkedHashMap<>()).put(lineNo, valueNum);
        }
        return result;
    }

    Map<String, String> toScalarTextMap(List<Map<String, Object>> values) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map<String, Object> row : safeList(values)) {
            String varCode = safe(stringValue(row.get("varCode"))).toUpperCase(Locale.ROOT);
            Integer lineNo = intValue(row.get("lineNo"));
            String valueText = safe(stringValue(row.get("valueText")));
            if (varCode.isEmpty() || valueText.isEmpty()) {
                continue;
            }
            if (lineNo == null || lineNo <= 1) {
                result.put(varCode, valueText);
            }
        }
        return result;
    }

    Map<String, Map<Integer, String>> toLineTextMap(List<Map<String, Object>> values) {
        Map<String, Map<Integer, String>> result = new LinkedHashMap<>();
        for (Map<String, Object> row : safeList(values)) {
            String varCode = safe(stringValue(row.get("varCode"))).toUpperCase(Locale.ROOT);
            Integer lineNo = intValue(row.get("lineNo"));
            String valueText = safe(stringValue(row.get("valueText")));
            if (varCode.isEmpty() || valueText.isEmpty() || lineNo == null) {
                continue;
            }
            result.computeIfAbsent(varCode, ignored -> new LinkedHashMap<>()).put(lineNo, valueText);
        }
        return result;
    }

    Map<String, Double> toFactorMap(List<EmissionFactorVO> factors) {
        Map<String, Double> result = new LinkedHashMap<>();
        for (EmissionFactorVO factor : safeList(factors)) {
            String code = safe(factor.getFactorCode()).toUpperCase(Locale.ROOT);
            if (code.isEmpty() || factor.getFactorValue() == null) {
                continue;
            }
            result.put(code, factor.getFactorValue());
        }
        return result;
    }
}
