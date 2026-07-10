package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ReportVerificationRegistryService {

    private static final int MAX_DIFFERENCES = 50;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public Map<String, Object> issue(Map<String, Object> request, String actorId) {
        String certificateId = required(request, "certificateId");
        String payloadHash = required(request, "payloadHash");
        String integrityCode = required(request, "integrityCode");
        JsonNode dataset = objectMapper.valueToTree(request.get("dataset"));
        if (dataset == null || dataset.isNull() || !dataset.isObject()) {
            throw new IllegalArgumentException("A canonical report dataset is required.");
        }
        String datasetJson = writeJson(dataset);
        int inserted;
        try {
            inserted = jdbcTemplate.update("""
                    INSERT INTO carbonet_report_verification_registry (
                        certificate_id, payload_version, issued_at, report_title, product_name,
                        report_generated_at, total_emission, row_count, calculated_row_count,
                        warning_count, payload_hash, integrity_code, dataset_hash, dataset_json,
                        issuer_id, status_code, created_at, updated_at
                    ) VALUES (?, ?, CAST(? AS timestamptz), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, 'ISSUED', now(), now())
                    ON CONFLICT (certificate_id) DO NOTHING
                    """,
                    certificateId,
                    number(request.get("version"), 2),
                    required(request, "issuedAt"),
                    text(request.get("reportTitle")),
                    text(request.get("productName")),
                    text(request.get("generatedAt")),
                    decimal(request.get("totalEmission")),
                    number(request.get("rowCount"), 0),
                    number(request.get("calculatedRowCount"), 0),
                    number(request.get("warningCount"), 0),
                    payloadHash,
                    integrityCode,
                    textOr(request.get("datasetHash"), payloadHash),
                    datasetJson,
                    textOr(actorId, "anonymous")
            );
        } catch (DuplicateKeyException exception) {
            inserted = 0;
        }

        Map<String, Object> stored = load(certificateId);
        JsonNode storedDataset = readJson(stored.get("dataset_json"));
        boolean same = payloadHash.equals(text(stored.get("payload_hash")))
                && integrityCode.equals(text(stored.get("integrity_code")))
                && dataset.equals(storedDataset);
        if (!same) {
            throw new IllegalStateException("The certificate ID already exists with different report data.");
        }
        return Map.of(
                "success", true,
                "status", inserted == 1 ? "ISSUED" : "ALREADY_ISSUED",
                "certificateId", certificateId,
                "datasetStored", true,
                "datasetHash", text(stored.get("dataset_hash")),
                "storedAt", stored.get("created_at")
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verify(Map<String, Object> request) {
        String certificateId = required(request, "certificateId");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("certificateId", certificateId);

        Map<String, Object> stored;
        try {
            stored = load(certificateId);
        } catch (IllegalArgumentException exception) {
            response.put("valid", false);
            response.put("status", "NOT_FOUND");
            response.put("message", "No issued report dataset exists for this certificate ID.");
            response.put("differences", List.of());
            return response;
        }

        boolean fingerprintMatch = required(request, "payloadHash").equals(text(stored.get("payload_hash")));
        boolean integrityMatch = required(request, "integrityCode").equals(text(stored.get("integrity_code")));
        JsonNode uploadedDataset = objectMapper.valueToTree(request.get("dataset"));
        JsonNode storedDataset = readJson(stored.get("dataset_json"));
        boolean datasetPresent = uploadedDataset != null && !uploadedDataset.isNull() && uploadedDataset.isObject();
        List<Map<String, Object>> differences = new ArrayList<>();
        if (datasetPresent) {
            compare("$", storedDataset, uploadedDataset, differences);
        }
        boolean datasetMatch = datasetPresent && differences.isEmpty();
        boolean valid = fingerprintMatch && integrityMatch && datasetMatch;

        response.put("valid", valid);
        response.put("status", valid ? "VALID" : datasetPresent ? "DATASET_MISMATCH" : "LEGACY_NO_DATASET");
        response.put("fingerprintMatch", fingerprintMatch);
        response.put("integrityMatch", integrityMatch);
        response.put("datasetPresent", datasetPresent);
        response.put("datasetMatch", datasetMatch);
        response.put("differenceCount", differences.size());
        response.put("differences", differences);
        response.put("storedDatasetHash", stored.get("dataset_hash"));
        response.put("issuedAt", stored.get("issued_at"));
        response.put("reportTitle", stored.get("report_title"));
        response.put("productName", stored.get("product_name"));
        response.put("message", valid
                ? "Certificate tags and the complete report dataset match the issued record."
                : datasetPresent
                    ? "The uploaded report dataset does not fully match the issued record."
                    : "This document has no embedded dataset and can only use legacy tag verification.");
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyOcr(Map<String, Object> request) {
        String ocrText = required(request, "ocrText");
        String normalizedText = normalizeText(ocrText);
        Matcher certificateMatcher = Pattern.compile("CRN[-\\s]?\\d{8}[-\\s]?[A-Fa-f0-9]{12}").matcher(ocrText);
        String detectedCertificateId = certificateMatcher.find()
                ? certificateMatcher.group().replaceAll("\\s+", "").toUpperCase(Locale.ROOT)
                : "";
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList("""
                SELECT certificate_id, issued_at, report_title, product_name, total_emission,
                       row_count, payload_hash, integrity_code, dataset_hash,
                       dataset_json::text AS dataset_json
                  FROM carbonet_report_verification_registry
                 WHERE status_code = 'ISSUED'
                 ORDER BY issued_at DESC, certificate_id DESC
                """);

        Map<String, Object> best = null;
        double bestScore = -1;
        List<Map<String, Object>> comparisons = new ArrayList<>();
        for (Map<String, Object> candidate : candidates) {
            JsonNode dataset = readJson(candidate.get("dataset_json"));
            Map<String, Object> score = scoreOcrCandidate(normalizedText, dataset);
            double candidateScore = ((Number) score.get("score")).doubleValue();
            String certificateId = text(candidate.get("certificate_id"));
            String payloadHash = text(candidate.get("payload_hash"));
            String integrityCode = text(candidate.get("integrity_code"));
            String datasetHash = text(candidate.get("dataset_hash"));
            boolean certificateIdMatch = containsText(normalizedText, certificateId);
            boolean payloadHashMatch = containsText(normalizedText, payloadHash);
            boolean integrityCodeMatch = containsText(normalizedText, integrityCode);
            boolean datasetHashMatch = containsText(normalizedText, datasetHash);
            int confidence = (int) Math.round(candidateScore);
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("certificateId", certificateId);
            comparison.put("issuedAt", candidate.get("issued_at"));
            comparison.put("reportTitle", candidate.get("report_title"));
            comparison.put("productName", candidate.get("product_name"));
            comparison.put("totalEmission", candidate.get("total_emission"));
            comparison.put("rowCount", candidate.get("row_count"));
            comparison.put("payloadHash", payloadHash);
            comparison.put("integrityCode", integrityCode);
            comparison.put("datasetHash", datasetHash);
            comparison.put("confidence", confidence);
            comparison.put("contentMatch", confidence >= 75);
            comparison.put("certificateIdMatch", certificateIdMatch);
            comparison.put("payloadHashMatch", payloadHashMatch);
            comparison.put("integrityCodeMatch", integrityCodeMatch);
            comparison.put("datasetHashMatch", datasetHashMatch);
            comparison.put("verificationTagMatch", certificateIdMatch || payloadHashMatch || integrityCodeMatch || datasetHashMatch);
            comparison.putAll(score);
            comparisons.add(comparison);
            if (candidateScore > bestScore) {
                bestScore = candidateScore;
                best = new LinkedHashMap<>(candidate);
                best.putAll(score);
            }
        }
        comparisons.sort((left, right) -> Integer.compare(
                ((Number) right.get("confidence")).intValue(),
                ((Number) left.get("confidence")).intValue()
        ));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("verificationMode", "PHOTO_OCR_DATASET");
        response.put("ocrCharacterCount", ocrText.length());
        response.put("candidateCount", candidates.size());
        response.put("detectedCertificateId", detectedCertificateId);
        response.put("comparisons", comparisons);
        if (best == null) {
            response.put("photoConsistent", false);
            response.put("status", "NOT_FOUND");
            response.put("confidence", 0);
            response.put("message", "No issued report dataset could be matched to the photographed document.");
            return response;
        }

        int confidence = (int) Math.round(bestScore);
        String status = confidence >= 75 ? "PHOTO_CONTENT_MATCH" : confidence >= 55 ? "PHOTO_REVIEW" : "PHOTO_MISMATCH";
        response.put("photoConsistent", confidence >= 75);
        response.put("status", status);
        response.put("confidence", confidence);
        response.put("certificateId", best.get("certificate_id"));
        response.put("issuedAt", best.get("issued_at"));
        response.put("reportTitle", best.get("report_title"));
        response.put("productName", best.get("product_name"));
        response.put("datasetHash", best.get("dataset_hash"));
        response.put("productMatched", best.get("productMatched"));
        response.put("titleMatched", best.get("titleMatched"));
        response.put("totalEmissionMatched", best.get("totalEmissionMatched"));
        response.put("matchedMaterialCount", best.get("matchedMaterialCount"));
        response.put("materialCount", best.get("materialCount"));
        response.put("matchedNumberCount", best.get("matchedNumberCount"));
        response.put("numberCount", best.get("numberCount"));
        response.put("message", confidence >= 75
                ? "The photographed report content is highly consistent with the issued dataset."
                : confidence >= 60
                    ? "The photographed report partially matches an issued dataset and requires visual review."
                    : "The photographed report content does not sufficiently match the issued dataset.");
        return response;
    }

    private Map<String, Object> scoreOcrCandidate(String normalizedText, JsonNode dataset) {
        boolean productMatched = containsText(normalizedText, dataset.path("productName").asText());
        boolean titleMatched = containsText(normalizedText, dataset.path("pageTitle").asText());
        boolean totalMatched = containsNumber(normalizedText, dataset.path("summary").path("totalEmission"));
        JsonNode rows = dataset.path("rows");
        int materialCount = 0;
        int matchedMaterialCount = 0;
        int numberCount = 0;
        int matchedNumberCount = 0;
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                String materialName = row.path("materialName").asText();
                if (!materialName.isBlank() && materialName.length() >= 2) {
                    materialCount++;
                    if (containsText(normalizedText, materialName)) {
                        matchedMaterialCount++;
                    }
                }
                for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                    JsonNode value = row.path(field);
                    if (value.isNumber() && Math.abs(value.asDouble()) > 0.0000001) {
                        numberCount++;
                        if (containsNumber(normalizedText, value)) {
                            matchedNumberCount++;
                        }
                    }
                }
            }
        }
        double materialRatio = materialCount == 0 ? 0 : (double) matchedMaterialCount / materialCount;
        double numberRatio = numberCount == 0 ? 0 : (double) matchedNumberCount / numberCount;
        double score = (productMatched ? 30 : 0)
                + (titleMatched ? 20 : 0)
                + (totalMatched ? 25 : 0)
                + Math.min(15, materialRatio * 15)
                + Math.min(10, numberRatio * 10);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", Math.min(100, score));
        result.put("productMatched", productMatched);
        result.put("titleMatched", titleMatched);
        result.put("totalEmissionMatched", totalMatched);
        result.put("matchedMaterialCount", matchedMaterialCount);
        result.put("materialCount", materialCount);
        result.put("matchedNumberCount", matchedNumberCount);
        result.put("numberCount", numberCount);
        return result;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replaceAll("[,，]", "")
                .replaceAll("[^0-9a-z가-힣.]+", "");
    }

    private boolean containsText(String normalizedText, String expected) {
        String normalizedExpected = normalizeText(expected);
        return normalizedExpected.length() >= 2 && normalizedText.contains(normalizedExpected);
    }

    private boolean containsNumber(String normalizedText, JsonNode value) {
        if (value == null || !value.isNumber()) {
            return false;
        }
        java.math.BigDecimal number = value.decimalValue().stripTrailingZeros();
        String plain = number.toPlainString();
        if (normalizedText.contains(plain)) {
            return true;
        }
        String roundedTwo = number.setScale(Math.min(2, Math.max(0, number.scale())), java.math.RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
        return roundedTwo.length() >= 2 && normalizedText.contains(roundedTwo);
    }

    private Map<String, Object> load(String certificateId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT certificate_id, issued_at, report_title, product_name, payload_hash,
                       integrity_code, dataset_hash, dataset_json::text AS dataset_json, created_at
                  FROM carbonet_report_verification_registry
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                """, certificateId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Issued report not found.");
        }
        return rows.get(0);
    }

    private void compare(String path, JsonNode expected, JsonNode actual, List<Map<String, Object>> differences) {
        if (differences.size() >= MAX_DIFFERENCES) {
            return;
        }
        if (expected == null || actual == null || expected.getNodeType() != actual.getNodeType()) {
            addDifference(path, expected, actual, differences);
            return;
        }
        if (expected.isObject()) {
            expected.fieldNames().forEachRemaining(name -> {
                if (differences.size() < MAX_DIFFERENCES) {
                    compare(path + "." + name, expected.get(name), actual.get(name), differences);
                }
            });
            actual.fieldNames().forEachRemaining(name -> {
                if (!expected.has(name) && differences.size() < MAX_DIFFERENCES) {
                    addDifference(path + "." + name, null, actual.get(name), differences);
                }
            });
            return;
        }
        if (expected.isArray()) {
            if (expected.size() != actual.size()) {
                addDifference(path + ".length", expected.size(), actual.size(), differences);
            }
            for (int index = 0; index < Math.min(expected.size(), actual.size()) && differences.size() < MAX_DIFFERENCES; index++) {
                compare(path + "[" + index + "]", expected.get(index), actual.get(index), differences);
            }
            return;
        }
        if (!expected.equals(actual)) {
            addDifference(path, expected, actual, differences);
        }
    }

    private void addDifference(String path, Object expected, Object actual, List<Map<String, Object>> differences) {
        differences.add(Map.of(
                "path", path,
                "expected", expected == null ? "<missing>" : expected.toString(),
                "actual", actual == null ? "<missing>" : actual.toString()
        ));
    }

    private String required(Map<String, Object> request, String key) {
        String value = text(request.get(key));
        if (value.isBlank()) {
            throw new IllegalArgumentException(key + " is required.");
        }
        return value;
    }

    private String writeJson(JsonNode value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Invalid report dataset.", exception);
        }
    }

    private JsonNode readJson(Object value) {
        try {
            return objectMapper.readTree(text(value));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored report dataset is invalid.", exception);
        }
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String textOr(Object value, String fallback) {
        String text = text(value);
        return text.isBlank() ? fallback : text;
    }

    private int number(Object value, int fallback) {
        return value instanceof Number number ? number.intValue() : fallback;
    }

    private java.math.BigDecimal decimal(Object value) {
        return value instanceof Number number ? new java.math.BigDecimal(number.toString()) : java.math.BigDecimal.ZERO;
    }
}
