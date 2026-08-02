package egovframework.com.feature.admin.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ReportIssuanceContractValidatorTest {

    @Test
    void acceptsCompleteEmissionSurveyRecord() {
        assertDoesNotThrow(() -> ReportIssuanceContractValidator.validate(validRecord("EMISSION_SURVEY")));
    }

    @Test
    void rejectsBlankProductNameAndIncompleteMaterialRows() {
        Map<String, Object> blankProductRecord = validRecord("EMISSION_SURVEY");
        blankProductRecord.put("productName", " ");
        assertThrows(IllegalArgumentException.class,
                () -> ReportIssuanceContractValidator.validate(blankProductRecord));

        Map<String, Object> incompleteRowRecord = validRecord("EMISSION_SURVEY");
        @SuppressWarnings("unchecked")
        Map<String, Object> dataset = (Map<String, Object>) incompleteRowRecord.get("dataset");
        dataset.put("rows", List.of(Map.of("materialName", "전력", "unit", "")));
        assertThrows(IllegalArgumentException.class,
                () -> ReportIssuanceContractValidator.validate(incompleteRowRecord));
    }

    @Test
    void requiresLcaSpecificFieldsAndPositiveOutputMass() {
        Map<String, Object> record = validRecord("LCA_SUMMARY");
        @SuppressWarnings("unchecked")
        Map<String, Object> dataset = (Map<String, Object>) record.get("dataset");
        dataset.put("lcaSummary", validLcaSummary());
        assertDoesNotThrow(() -> ReportIssuanceContractValidator.validate(record));

        @SuppressWarnings("unchecked")
        Map<String, Object> lca = (Map<String, Object>) dataset.get("lcaSummary");
        lca.put("normalizedOutputMass", 0);
        assertThrows(IllegalArgumentException.class, () -> ReportIssuanceContractValidator.validate(record));
    }

    private static Map<String, Object> validRecord(String reportType) {
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("reportType", reportType);
        record.put("certificateId", "CRN-TEST-001");
        record.put("payloadHash", "hash");
        record.put("integrityCode", "integrity");
        record.put("issuedAt", "2026-08-03T00:00:00Z");
        record.put("reportTitle", "제품 배출계수 리포트");
        record.put("productName", "탄산칼슘");
        record.put("generatedAt", "2026-08-03T00:00:00Z");
        record.put("totalEmission", 3.81);
        record.put("dataset", new LinkedHashMap<>(Map.of(
                "productName", "탄산칼슘",
                "pageTitle", "제품 배출계수 리포트",
                "summary", Map.of("totalEmission", 3.81),
                "rows", List.of(Map.of("materialName", "전력", "unit", "kWh")),
                "outputRows", List.of(Map.of("materialName", "탄산칼슘", "unit", "t", "processReferenceMass", 1.0))
        )));
        return record;
    }

    private static Map<String, Object> validLcaSummary() {
        Map<String, Object> row = Map.of("materialName", "전력", "unit", "kWh");
        return new LinkedHashMap<>(Map.ofEntries(
                Map.entry("companyName", "테스트 기업"),
                Map.entry("productFamily", "광물"),
                Map.entry("functionalUnit", "제품 1 t"),
                Map.entry("productModel", "탄산칼슘"),
                Map.entry("productDescription", "광물 탄산화 제품"),
                Map.entry("productType", "MODEL-1"),
                Map.entry("referenceFlow", "1 t"),
                Map.entry("normalizedOutputMass", 1.0),
                Map.entry("inputTable", List.of(row)),
                Map.entry("outputTable", List.of(Map.of("materialName", "탄산칼슘", "unit", "t")))
        ));
    }
}
