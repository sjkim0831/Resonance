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

    @Transactional
    public Map<String, Object> registerVisualProfile(Map<String, Object> request) {
        String certificateId = required(request, "certificateId");
        JsonNode profile = objectMapper.valueToTree(request.get("visualProfile"));
        if (profile == null || !profile.isObject() || !profile.path("pages").isArray()) {
            throw new IllegalArgumentException("A page visual profile is required.");
        }
        String profileJson = writeJson(profile);
        if (profileJson.length() > 2_000_000) {
            throw new IllegalArgumentException("The visual profile is too large.");
        }
        int updated = jdbcTemplate.update("""
                UPDATE carbonet_report_verification_registry
                   SET visual_profile_json = CAST(? AS jsonb), visual_profile_version = 1,
                       visual_profile_updated_at = now(), updated_at = now()
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                """, profileJson, certificateId);
        if (updated != 1) {
            throw new IllegalArgumentException("Issued report not found.");
        }
        return Map.of("success", true, "certificateId", certificateId,
                "pageCount", profile.path("pages").size(), "profileVersion", 1);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyOcr(Map<String, Object> request) {
        String ocrText = required(request, "ocrText");
        String requestedReportType = text(request.get("reportType"));
        if (requestedReportType.isBlank()) {
            requestedReportType = "EMISSION_SURVEY";
        }
        String normalizedText = normalizeText(ocrText);
        Map<?, ?> qrEvidence = request.get("qrEvidence") instanceof Map<?, ?> value ? value : Map.of();
        String qrCertificateId = text(qrEvidence.get("certificateId"));
        String qrPayloadHash = text(qrEvidence.get("payloadHash"));
        String qrIntegrityCode = text(qrEvidence.get("integrityCode"));
        String qrDatasetHash = text(qrEvidence.get("datasetHash"));
        boolean qrDetected = !qrCertificateId.isBlank();
        Matcher certificateMatcher = Pattern.compile("CRN[-\\s]?\\d{8}[-\\s]?[A-Fa-f0-9]{12}").matcher(ocrText);
        String detectedCertificateId = qrDetected
                ? qrCertificateId.toUpperCase(Locale.ROOT)
                : certificateMatcher.find()
                ? certificateMatcher.group().replaceAll("\\s+", "").toUpperCase(Locale.ROOT)
                : "";
        List<Map<String, Object>> candidates = jdbcTemplate.queryForList("""
                SELECT certificate_id, issued_at, report_title, product_name, total_emission,
                       row_count, payload_hash, integrity_code, dataset_hash, visual_profile_json::text AS visual_profile_json,
                       dataset_json::text AS dataset_json
                  FROM carbonet_report_verification_registry
                 WHERE status_code = 'ISSUED'
                 ORDER BY issued_at DESC, certificate_id DESC
                """);

        Map<String, Object> best = null;
        double bestScore = -1;
        List<Map<String, Object>> comparisons = new ArrayList<>();
        JsonNode uploadedVisualProfile = objectMapper.valueToTree(request.get("visualProfile"));
        for (Map<String, Object> candidate : candidates) {
            JsonNode dataset = readJson(candidate.get("dataset_json"));
            String candidateReportType = dataset.path("reportType").asText("EMISSION_SURVEY");
            if (!requestedReportType.equalsIgnoreCase(candidateReportType)) {
                continue;
            }
            Map<String, Object> score = scoreOcrCandidate(normalizedText, dataset);
            double contentScore = ((Number) score.get("score")).doubleValue();
            String certificateId = text(candidate.get("certificate_id"));
            String payloadHash = text(candidate.get("payload_hash"));
            String integrityCode = text(candidate.get("integrity_code"));
            String datasetHash = text(candidate.get("dataset_hash"));
            boolean certificateIdMatch = qrCertificateId.equalsIgnoreCase(certificateId) || containsText(normalizedText, certificateId);
            boolean payloadHashMatch = qrPayloadHash.equalsIgnoreCase(payloadHash) || containsText(normalizedText, payloadHash);
            boolean integrityCodeMatch = qrIntegrityCode.equalsIgnoreCase(integrityCode) || containsText(normalizedText, integrityCode);
            boolean datasetHashMatch = qrDatasetHash.equalsIgnoreCase(datasetHash) || containsText(normalizedText, datasetHash);
            boolean qrFullyMatched = qrDetected && qrCertificateId.equalsIgnoreCase(certificateId)
                    && qrPayloadHash.equalsIgnoreCase(payloadHash)
                    && qrIntegrityCode.equalsIgnoreCase(integrityCode)
                    && qrDatasetHash.equalsIgnoreCase(datasetHash);
            boolean lcaReport = "LCA_SUMMARY".equalsIgnoreCase(candidateReportType);
            boolean datasetExactMatch = lcaReport
                    ? Boolean.TRUE.equals(score.get("titleMatched"))
                    && ((Number) score.get("matchedLcaFieldCount")).intValue() == ((Number) score.get("lcaFieldCount")).intValue()
                    : Boolean.TRUE.equals(score.get("productMatched"))
                    && Boolean.TRUE.equals(score.get("titleMatched"))
                    && Boolean.TRUE.equals(score.get("totalEmissionMatched"))
                    && ((Number) score.get("matchedMaterialCount")).intValue() == ((Number) score.get("materialCount")).intValue()
                    && ((Number) score.get("matchedNumberCount")).intValue() == ((Number) score.get("numberCount")).intValue();
            boolean tagExactMatch = qrFullyMatched || (certificateIdMatch && payloadHashMatch && integrityCodeMatch && datasetHashMatch);
            double combinedScore = qrFullyMatched ? 85 + (contentScore * 0.15) : contentScore;
            Map<String, Object> visualScore = scoreVisualProfile(readJsonNullable(candidate.get("visual_profile_json")), uploadedVisualProfile);
            int confidence = (int) Math.round(combinedScore);
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
            comparison.put("contentConfidence", (int) Math.round(contentScore));
            comparison.put("contentMatch", contentScore >= 75 || (qrFullyMatched && contentScore >= 40));
            comparison.put("certificateIdMatch", certificateIdMatch);
            comparison.put("payloadHashMatch", payloadHashMatch);
            comparison.put("integrityCodeMatch", integrityCodeMatch);
            comparison.put("datasetHashMatch", datasetHashMatch);
            comparison.put("verificationTagMatch", certificateIdMatch || payloadHashMatch || integrityCodeMatch || datasetHashMatch);
            comparison.put("qrFullyMatched", qrFullyMatched);
            comparison.put("datasetExactMatch", datasetExactMatch);
            comparison.put("tagExactMatch", tagExactMatch);
            comparison.put("overallExactMatch", datasetExactMatch && tagExactMatch);
            comparison.putAll(visualScore);
            comparison.putAll(score);
            comparisons.add(comparison);
            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                best = new LinkedHashMap<>(candidate);
                best.putAll(score);
                best.put("contentScore", contentScore);
                best.put("qrFullyMatched", qrFullyMatched);
                best.put("qrCertificateMatch", qrDetected && qrCertificateId.equalsIgnoreCase(certificateId));
                best.put("qrPayloadHashMatch", qrDetected && qrPayloadHash.equalsIgnoreCase(payloadHash));
                best.put("qrIntegrityMatch", qrDetected && qrIntegrityCode.equalsIgnoreCase(integrityCode));
                best.put("qrDatasetHashMatch", qrDetected && qrDatasetHash.equalsIgnoreCase(datasetHash));
                best.putAll(visualScore);
            }
        }
        comparisons.sort((left, right) -> Integer.compare(
                ((Number) right.get("confidence")).intValue(),
                ((Number) left.get("confidence")).intValue()
        ));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("verificationMode", "PHOTO_OCR_DATASET");
        response.put("ocrCharacterCount", ocrText.length());
        response.put("reportType", requestedReportType);
        response.put("candidateCount", comparisons.size());
        response.put("detectedCertificateId", detectedCertificateId);
        response.put("qrDetected", qrDetected);
        response.put("comparisons", comparisons);
        if (best == null) {
            response.put("photoConsistent", false);
            response.put("status", "NOT_FOUND");
            response.put("confidence", 0);
            response.put("message", "No issued report dataset could be matched to the photographed document.");
            return response;
        }

        int confidence = (int) Math.round(bestScore);
        double contentConfidence = ((Number) best.get("contentScore")).doubleValue();
        boolean qrFullyMatched = Boolean.TRUE.equals(best.get("qrFullyMatched"));
        boolean visualProfileAvailable = Boolean.TRUE.equals(best.get("visualProfileAvailable"));
        boolean visualMatch = "VISUAL_MATCH".equals(best.get("visualStatus"));
        boolean photoConsistent = (qrFullyMatched ? contentConfidence >= 40 : confidence >= 75)
                && (!visualProfileAvailable || visualMatch);
        String status = photoConsistent ? "PHOTO_CONTENT_MATCH" : confidence >= 55 ? "PHOTO_REVIEW" : "PHOTO_MISMATCH";
        response.put("photoConsistent", photoConsistent);
        response.put("status", status);
        response.put("confidence", confidence);
        response.put("contentConfidence", (int) Math.round(contentConfidence));
        response.put("qrFullyMatched", qrFullyMatched);
        response.put("qrCertificateMatch", best.get("qrCertificateMatch"));
        response.put("qrPayloadHashMatch", best.get("qrPayloadHashMatch"));
        response.put("qrIntegrityMatch", best.get("qrIntegrityMatch"));
        response.put("qrDatasetHashMatch", best.get("qrDatasetHashMatch"));
        response.put("visualProfileAvailable", best.get("visualProfileAvailable"));
        response.put("visualSimilarity", best.get("visualSimilarity"));
        response.put("damagedCellCount", best.get("damagedCellCount"));
        response.put("comparedCellCount", best.get("comparedCellCount"));
        response.put("visualStatus", best.get("visualStatus"));
        response.put("damagedRegions", best.get("damagedRegions"));
        response.put("certificateId", best.get("certificate_id"));
        response.put("issuedAt", best.get("issued_at"));
        response.put("reportTitle", best.get("report_title"));
        response.put("productName", best.get("product_name"));
        response.put("totalEmission", best.get("total_emission"));
        response.put("rowCount", best.get("row_count"));
        response.put("datasetHash", best.get("dataset_hash"));
        response.put("productMatched", best.get("productMatched"));
        response.put("titleMatched", best.get("titleMatched"));
        response.put("totalEmissionMatched", best.get("totalEmissionMatched"));
        response.put("matchedMaterialCount", best.get("matchedMaterialCount"));
        response.put("materialCount", best.get("materialCount"));
        response.put("matchedNumberCount", best.get("matchedNumberCount"));
        response.put("numberCount", best.get("numberCount"));
        response.put("matchedLcaFieldCount", best.get("matchedLcaFieldCount"));
        response.put("lcaFieldCount", best.get("lcaFieldCount"));
        response.put("lcaFieldComparisons", best.get("lcaFieldComparisons"));
        response.put("fieldMismatches", best.get("fieldMismatches"));
        response.put("message", confidence >= 75
                ? "The photographed report content is highly consistent with the issued dataset."
                : confidence >= 60
                    ? "The photographed report partially matches an issued dataset and requires visual review."
                    : "The photographed report content does not sufficiently match the issued dataset.");
        return response;
    }

    private Map<String, Object> scoreOcrCandidate(String normalizedText, JsonNode dataset) {
        boolean lcaReport = "LCA_SUMMARY".equalsIgnoreCase(dataset.path("reportType").asText());
        JsonNode lcaSummary = dataset.path("lcaSummary");
        boolean productMatched = containsText(normalizedText, dataset.path("productName").asText());
        boolean titleMatched = (lcaReport && (containsText(normalizedText, lcaSummary.path("documentTitle").asText())
                || containsText(normalizedText, "제품 LCA 수행 개요")))
                || containsText(normalizedText, dataset.path("displayTitle").asText())
                || containsText(normalizedText, dataset.path("pageTitle").asText())
                || containsText(normalizedText, "제품/부산물 배출계수 리포트")
                || containsText(normalizedText, "탄소배출량 리포트");
        boolean totalMatched = containsNumber(normalizedText, dataset.path("summary").path("totalEmission"));
        JsonNode rows = dataset.path("rows");
        int materialCount = 0;
        int matchedMaterialCount = 0;
        int numberCount = 0;
        int matchedNumberCount = 0;
        List<Map<String, Object>> allFieldComparisons = new ArrayList<>();
        List<Map<String, Object>> fieldMismatches = new ArrayList<>();
        if (!lcaReport && rows.isArray()) {
            for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
                JsonNode row = rows.get(rowIndex);
                String materialName = row.path("materialName").asText();
                boolean materialMatched = materialName.isBlank() || materialName.length() < 2 || containsText(normalizedText, materialName);
                if (!materialName.isBlank() && materialName.length() >= 2) {
                    materialCount++;
                    if (materialMatched) {
                        matchedMaterialCount++;
                    }
                }
                Map<String, Object> fieldMatches = new LinkedHashMap<>();
                for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                    JsonNode value = row.path(field);
                    if (value.isNumber() && Math.abs(value.asDouble()) > 0.0000001) {
                        numberCount++;
                        boolean matched = containsDisplayedNumber(normalizedText, row, field, value);
                        fieldMatches.put(field, matched);
                        if (matched) {
                            matchedNumberCount++;
                        }
                    }
                }
                boolean rowMatched = materialMatched && fieldMatches.values().stream().allMatch(Boolean.TRUE::equals);
                Map<String, Object> comparison = new LinkedHashMap<>();
                comparison.put("rowIndex", rowIndex + 1);
                comparison.put("sectionLabel", row.path("sectionLabel").asText());
                comparison.put("materialName", materialName);
                comparison.put("rowMatched", rowMatched);
                comparison.put("materialMatched", materialMatched);
                comparison.put("amount", row.path("amount").isNumber() ? row.path("amount").numberValue() : null);
                comparison.put("amountDisplay", displayValue(row, "amount", row.path("amount")));
                comparison.put("amountMatched", fieldMatches.getOrDefault("amount", true));
                comparison.put("emissionFactor", row.path("emissionFactor").isNumber() ? row.path("emissionFactor").numberValue() : null);
                comparison.put("emissionFactorDisplay", displayValue(row, "emissionFactor", row.path("emissionFactor")));
                comparison.put("emissionFactorMatched", fieldMatches.getOrDefault("emissionFactor", true));
                comparison.put("totalEmission", row.path("totalEmission").isNumber() ? row.path("totalEmission").numberValue() : null);
                comparison.put("totalEmissionDisplay", displayValue(row, "totalEmission", row.path("totalEmission")));
                comparison.put("totalEmissionMatched", fieldMatches.getOrDefault("totalEmission", true));
                allFieldComparisons.add(comparison);
                if (!rowMatched) {
                    fieldMismatches.add(comparison);
                }
            }
        }
        List<Map<String, Object>> lcaFieldComparisons = new ArrayList<>();
        int lcaFieldCount = 0;
        int matchedLcaFieldCount = 0;
        if (lcaReport && lcaSummary.isObject()) {
            Map<String, String> labels = new LinkedHashMap<>();
            labels.put("companyName", "기업명");
            labels.put("productFamily", "제품군");
            labels.put("functionalUnit", "기능단위");
            labels.put("productModel", "제품 모델");
            labels.put("productType", "제품 유형");
            labels.put("equipmentWeight", "장비 중량");
            labels.put("bucketCapacity", "버킷 용량");
            labels.put("referenceFlow", "기준 흐름");
            labels.put("dataPeriod", "데이터 기간");
            labels.put("regionScope", "지역 범위");
            labels.put("lcaSoftware", "LCA 소프트웨어");
            for (Map.Entry<String, String> entry : labels.entrySet()) {
                String expected = lcaSummary.path(entry.getKey()).asText("").trim();
                if (expected.isBlank()) continue;
                boolean matched = containsText(normalizedText, expected);
                lcaFieldCount++;
                if (matched) matchedLcaFieldCount++;
                Map<String, Object> field = new LinkedHashMap<>();
                field.put("field", entry.getKey());
                field.put("label", entry.getValue());
                field.put("expected", expected);
                field.put("matched", matched);
                lcaFieldComparisons.add(field);
            }
            Map<String, String> numericLabels = new LinkedHashMap<>();
            numericLabels.put("preManufacturingMass", "제조 전 투입 질량");
            numericLabels.put("postManufacturingMass", "제조 후 산출 질량");
            numericLabels.put("normalizedOutputMass", "정규화 산출 질량");
            numericLabels.put("totalEmission", "총 배출량");
            numericLabels.put("totalEmissionPerMass", "단위 질량당 배출량");
            for (Map.Entry<String, String> entry : numericLabels.entrySet()) {
                JsonNode expectedNode = lcaSummary.path(entry.getKey());
                if (!expectedNode.isNumber()) continue;
                boolean matched = containsNumber(normalizedText, expectedNode);
                numberCount++;
                lcaFieldCount++;
                if (matched) {
                    matchedNumberCount++;
                    matchedLcaFieldCount++;
                }
                Map<String, Object> field = new LinkedHashMap<>();
                field.put("field", entry.getKey());
                field.put("label", entry.getValue());
                field.put("expected", expectedNode.asText());
                field.put("matched", matched);
                lcaFieldComparisons.add(field);
            }
        }
        double materialRatio = materialCount == 0 ? 0 : (double) matchedMaterialCount / materialCount;
        double numberRatio = numberCount == 0 ? 0 : (double) matchedNumberCount / numberCount;
        double lcaFieldRatio = lcaFieldCount == 0 ? 0 : (double) matchedLcaFieldCount / lcaFieldCount;
        double score = lcaReport
                ? (titleMatched ? 20 : 0) + (productMatched ? 10 : 0) + Math.min(50, lcaFieldRatio * 50) + Math.min(20, numberRatio * 20)
                : (productMatched ? 15 : 0)
                + (titleMatched ? 10 : 0)
                + (totalMatched ? 20 : 0)
                + Math.min(25, materialRatio * 25)
                + Math.min(30, numberRatio * 30);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", Math.min(100, score));
        result.put("productMatched", productMatched);
        result.put("titleMatched", titleMatched);
        result.put("totalEmissionMatched", totalMatched);
        result.put("matchedMaterialCount", matchedMaterialCount);
        result.put("materialCount", materialCount);
        result.put("matchedNumberCount", matchedNumberCount);
        result.put("numberCount", numberCount);
        result.put("matchedLcaFieldCount", matchedLcaFieldCount);
        result.put("lcaFieldCount", lcaFieldCount);
        result.put("lcaFieldComparisons", lcaFieldComparisons);
        result.put("fieldComparisons", allFieldComparisons);
        result.put("fieldMismatches", fieldMismatches);
        return result;
    }

    private String normalizeText(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replace('₀', '0').replace('₁', '1').replace('₂', '2').replace('₃', '3').replace('₄', '4')
                .replace('₅', '5').replace('₆', '6').replace('₇', '7').replace('₈', '8').replace('₉', '9')
                .replace("쳔연가스", "천연가스")
                .replaceAll("[,，]", "")
                .replaceAll("[^0-9a-z가-힣.]+", "");
    }

    private boolean containsText(String normalizedText, String expected) {
        String normalizedExpected = normalizeText(expected);
        if (normalizedExpected.length() < 2) {
            return false;
        }
        if (normalizedText.contains(normalizedExpected)) {
            return true;
        }
        if (normalizedExpected.matches("[a-z]{1,3}[0-9]{1,2}")) {
            String ocrAlias = normalizedExpected.replace('0', 'o').replace('1', 'l').replace('4', 'a').replace('5', 's');
            if (normalizedText.contains(ocrAlias)) {
                return true;
            }
        }
        if (normalizedExpected.length() < 4) {
            return false;
        }
        int allowedDistance = Math.max(1, normalizedExpected.length() / 6);
        int minimumLength = Math.max(2, normalizedExpected.length() - allowedDistance);
        int maximumLength = normalizedExpected.length() + allowedDistance;
        for (int length = minimumLength; length <= maximumLength; length++) {
            for (int start = 0; start + length <= normalizedText.length(); start++) {
                if (editDistanceWithin(normalizedExpected, normalizedText.substring(start, start + length), allowedDistance)) {
                    return true;
                }
            }
        }
        return false;
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
        if (roundedTwo.length() >= 2 && normalizedText.contains(roundedTwo)) {
            return true;
        }
        String numericText = normalizedText.replace('o', '0').replace('l', '1');
        Matcher matcher = Pattern.compile("[0-9]+(?:\\.[0-9]+)?").matcher(numericText);
        java.math.BigDecimal tolerance = number.abs().multiply(new java.math.BigDecimal("0.001"))
                .max(new java.math.BigDecimal("0.01"));
        while (matcher.find()) {
            try {
                java.math.BigDecimal candidate = new java.math.BigDecimal(matcher.group());
                if (candidate.subtract(number).abs().compareTo(tolerance) <= 0) {
                    return true;
                }
            } catch (NumberFormatException ignored) {
                // Continue with the remaining OCR number tokens.
            }
        }
        return false;
    }

    private boolean containsDisplayedNumber(String normalizedText, JsonNode row, String field, JsonNode value) {
        String display = displayValue(row, field, value);
        String normalizedDisplay = normalizeText(display);
        if (!normalizedDisplay.isBlank() && normalizedText.contains(normalizedDisplay)) {
            return true;
        }
        return containsNumber(normalizedText, value);
    }

    private String displayValue(JsonNode row, String field, JsonNode value) {
        String configured = row.path(field + "Display").asText();
        if (!configured.isBlank()) {
            return configured;
        }
        if (value == null || !value.isNumber()) {
            return "";
        }
        return value.decimalValue().setScale(2, java.math.RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    private boolean editDistanceWithin(String expected, String actual, int limit) {
        if (Math.abs(expected.length() - actual.length()) > limit) {
            return false;
        }
        int[] previous = new int[actual.length() + 1];
        int[] current = new int[actual.length() + 1];
        for (int column = 0; column <= actual.length(); column++) {
            previous[column] = column;
        }
        for (int row = 1; row <= expected.length(); row++) {
            current[0] = row;
            int rowMinimum = current[0];
            for (int column = 1; column <= actual.length(); column++) {
                int substitution = previous[column - 1] + (expected.charAt(row - 1) == actual.charAt(column - 1) ? 0 : 1);
                current[column] = Math.min(Math.min(previous[column] + 1, current[column - 1] + 1), substitution);
                rowMinimum = Math.min(rowMinimum, current[column]);
            }
            if (rowMinimum > limit) {
                return false;
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[actual.length()] <= limit;
    }

    private Map<String, Object> scoreVisualProfile(JsonNode stored, JsonNode uploaded) {
        if (stored == null || uploaded == null || !stored.isObject() || !uploaded.isObject()) {
            return Map.of("visualProfileAvailable", false, "visualSimilarity", 0,
                    "damagedCellCount", 0, "comparedCellCount", 0, "visualStatus", "NOT_AVAILABLE");
        }
        JsonNode storedPages = stored.path("pages");
        JsonNode uploadedPages = uploaded.path("pages");
        if (!storedPages.isArray() || !uploadedPages.isArray() || storedPages.size() != uploadedPages.size()) {
            return Map.of("visualProfileAvailable", true, "visualSimilarity", 0,
                    "damagedCellCount", 0, "comparedCellCount", 0, "visualStatus", "PAGE_MISMATCH");
        }
        long differenceTotal = 0;
        int compared = 0;
        int damaged = 0;
        int columns = Math.max(1, stored.path("columns").asInt(48));
        List<Map<String, Object>> damagedRegions = new ArrayList<>();
        for (int page = 0; page < storedPages.size(); page++) {
            JsonNode expectedValues = storedPages.path(page).path("values");
            JsonNode actualValues = uploadedPages.path(page).path("values");
            if (!expectedValues.isArray() || !actualValues.isArray() || expectedValues.size() != actualValues.size()) {
                return Map.of("visualProfileAvailable", true, "visualSimilarity", 0,
                        "damagedCellCount", damaged, "comparedCellCount", compared, "visualStatus", "GRID_MISMATCH");
            }
            for (int index = 0; index < expectedValues.size(); index++) {
                int difference = Math.abs(expectedValues.get(index).asInt() - actualValues.get(index).asInt());
                differenceTotal += difference;
                compared++;
                if (difference >= 42) {
                    damaged++;
                    if (damagedRegions.size() < 100) {
                        damagedRegions.add(Map.of(
                                "page", page + 1,
                                "row", index / columns + 1,
                                "column", index % columns + 1,
                                "difference", difference
                        ));
                    }
                }
            }
        }
        int similarity = compared == 0 ? 0 : (int) Math.round(100 - Math.min(100, (differenceTotal / (double) compared) / 2.55));
        double damageRatio = compared == 0 ? 1 : damaged / (double) compared;
        String status = similarity >= 92 && damageRatio <= 0.015 ? "VISUAL_MATCH"
                : similarity >= 82 && damageRatio <= 0.06 ? "VISUAL_DAMAGE_REVIEW" : "VISUAL_MISMATCH";
        return Map.of("visualProfileAvailable", true, "visualSimilarity", similarity,
                "damagedCellCount", damaged, "comparedCellCount", compared, "visualStatus", status,
                "damagedRegions", damagedRegions);
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

    private JsonNode readJsonNullable(Object value) {
        String text = text(value);
        if (text.isBlank()) {
            return null;
        }
        return readJson(text);
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
