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
