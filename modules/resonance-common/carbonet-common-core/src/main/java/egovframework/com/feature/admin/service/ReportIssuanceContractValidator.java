package egovframework.com.feature.admin.service;

import java.util.List;
import java.util.Map;

/**
 * Server-side counterpart of the report input required-field contract.
 * Drafts may remain incomplete, but an issued verification record must be
 * complete enough to reproduce and verify the report without UI state.
 */
final class ReportIssuanceContractValidator {

    private ReportIssuanceContractValidator() {
    }

    static void validate(Map<String, Object> request) {
        requiredText(request, "certificateId");
        requiredText(request, "payloadHash");
        requiredText(request, "integrityCode");
        requiredText(request, "issuedAt");
        requiredText(request, "reportTitle");
        requiredText(request, "productName");
        requiredText(request, "generatedAt");
        nonNegativeNumber(request.get("totalEmission"), "totalEmission");

        Map<?, ?> dataset = requiredMap(request.get("dataset"), "dataset");
        requiredText(dataset, "productName");
        requiredText(dataset, "pageTitle");
        Map<?, ?> summary = requiredMap(dataset.get("summary"), "dataset.summary");
        nonNegativeNumber(summary.get("totalEmission"), "dataset.summary.totalEmission");

        List<?> rows = requiredList(dataset.get("rows"), "dataset.rows");
        validateMaterialRows(rows, "dataset.rows", false);
        List<?> outputRows = requiredList(dataset.get("outputRows"), "dataset.outputRows");
        validateMaterialRows(outputRows, "dataset.outputRows", true);

        if ("LCA_SUMMARY".equals(String.valueOf(request.get("reportType")))) {
            validateLcaSummary(requiredMap(dataset.get("lcaSummary"), "dataset.lcaSummary"));
        }
    }

    private static void validateLcaSummary(Map<?, ?> lcaSummary) {
        for (String field : List.of("companyName", "productFamily", "functionalUnit", "productModel",
                "productDescription", "productType", "referenceFlow")) {
            requiredText(lcaSummary, field);
        }
        positiveNumber(lcaSummary.get("normalizedOutputMass"), "dataset.lcaSummary.normalizedOutputMass");
        validateMaterialRows(requiredList(lcaSummary.get("inputTable"), "dataset.lcaSummary.inputTable"),
                "dataset.lcaSummary.inputTable", false);
        validateMaterialRows(requiredList(lcaSummary.get("outputTable"), "dataset.lcaSummary.outputTable"),
                "dataset.lcaSummary.outputTable", false);
    }

    private static void validateMaterialRows(List<?> rows, String path, boolean requirePositiveMass) {
        for (int index = 0; index < rows.size(); index++) {
            Map<?, ?> row = requiredMap(rows.get(index), path + "[" + index + "]");
            requiredText(row, "materialName");
            requiredText(row, "unit");
            if (requirePositiveMass) {
                positiveNumber(row.get("processReferenceMass"), path + "[" + index + "].processReferenceMass");
            }
        }
    }

    private static Map<?, ?> requiredMap(Object value, String path) {
        if (!(value instanceof Map<?, ?> map) || map.isEmpty()) {
            throw new IllegalArgumentException("Required report field is missing: " + path);
        }
        return map;
    }

    private static List<?> requiredList(Object value, String path) {
        if (!(value instanceof List<?> list) || list.isEmpty()) {
            throw new IllegalArgumentException("Required report collection is empty: " + path);
        }
        return list;
    }

    private static void requiredText(Map<?, ?> source, String field) {
        Object value = source.get(field);
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            throw new IllegalArgumentException("Required report field is missing: " + field);
        }
    }

    private static void nonNegativeNumber(Object value, String path) {
        double number = finiteNumber(value, path);
        if (number < 0) {
            throw new IllegalArgumentException("Required report number must not be negative: " + path);
        }
    }

    private static void positiveNumber(Object value, String path) {
        if (finiteNumber(value, path) <= 0) {
            throw new IllegalArgumentException("Required report number must be positive: " + path);
        }
    }

    private static double finiteNumber(Object value, String path) {
        try {
            double number = value instanceof Number numeric ? numeric.doubleValue() : Double.parseDouble(String.valueOf(value));
            if (!Double.isFinite(number)) {
                throw new NumberFormatException("non-finite");
            }
            return number;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException("Required report number is invalid: " + path, exception);
        }
    }
}
