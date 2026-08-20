package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ReportVerificationRegistryService {

    private static final int MAX_DIFFERENCES = 50;
    private static final int MAX_FIELD_COMPARISONS = 2_000;
    public static final int MAX_VERIFICATION_PAGES = 10;
    public static final int MAX_VERIFICATION_PDF_BYTES = 25 * 1024 * 1024;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Transactional
    public Map<String, Object> issue(Map<String, Object> request, String actorId) {
        ReportIssuanceContractValidator.validate(request);
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
        List<Map<String, Object>> fieldComparisons = new ArrayList<>();
        if (datasetPresent) {
            compare("$", storedDataset, uploadedDataset, differences);
            compareFields("$", storedDataset, uploadedDataset, fieldComparisons);
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
        response.put("fieldCount", fieldComparisons.size());
        response.put("matchedFieldCount", fieldComparisons.stream().filter(row -> Boolean.TRUE.equals(row.get("matched"))).count());
        response.put("fieldComparisons", fieldComparisons);
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

    @Transactional
    public Map<String, Object> issuePdf(Map<String, Object> request, String actorId,
                                        Map<String, Object> visualProfile, byte[] pdfBytes,
                                        Map<String, Object> ocrEvidence) {
        Map<String, Object> issued = issue(request, actorId);
        String certificateId = required(request, "certificateId");
        validatePdfBytes(pdfBytes);
        JsonNode profile = objectMapper.valueToTree(visualProfile);
        if (!profile.isObject() || !profile.path("pages").isArray()) {
            throw new IllegalArgumentException("A page visual profile is required.");
        }
        String profileJson = writeJson(profile);
        if (profileJson.length() > 2_000_000) {
            throw new IllegalArgumentException("The visual profile is too large.");
        }
        String ocrEvidenceJson = canonicalizeOcrEvidence(request, ocrEvidence);
        Map<String, Object> fingerprint = bindIssuedPdfFingerprint(certificateId, pdfBytes, actorId);
        String pdfSha256 = text(fingerprint.get("pdfSha256"));
        int updated = jdbcTemplate.update("""
                UPDATE carbonet_report_verification_registry
                   SET visual_profile_json = CAST(? AS jsonb), visual_profile_version = 1,
                       visual_profile_updated_at = now(),
                       ocr_evidence_json = CAST(? AS jsonb), ocr_evidence_version = 3,
                       ocr_evidence_registered_at = now(),
                       updated_at = now()
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                   AND pdf_sha256 = ? AND pdf_size_bytes = ?
                """, profileJson, ocrEvidenceJson, certificateId, pdfSha256, pdfBytes.length);
        if (updated != 1) {
            throw new IllegalStateException("The issued PDF fingerprint could not be finalized with its visual profile.");
        }
        Map<String, Object> response = new LinkedHashMap<>(issued);
        response.put("pdfSha256", pdfSha256);
        response.put("pdfSizeBytes", pdfBytes.length);
        response.put("visualPageCount", profile.path("pages").size());
        response.put("ocrEvidenceVersion", 3);
        return response;
    }

    @Transactional
    public Map<String, Object> bindIssuedPdfFingerprint(String certificateId, byte[] pdfBytes, String actorId) {
        String normalizedCertificateId = certificateId == null ? "" : certificateId.trim();
        if (normalizedCertificateId.isBlank()) {
            throw new IllegalArgumentException("certificateId is required.");
        }
        validatePdfBytes(pdfBytes);
        String pdfSha256 = sha256Hex(pdfBytes);
        List<Map<String, Object>> registryRows = jdbcTemplate.queryForList("""
                SELECT pdf_sha256, pdf_size_bytes
                  FROM carbonet_report_verification_registry
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                 FOR UPDATE
                """, normalizedCertificateId);
        List<Map<String, Object>> projectRows = jdbcTemplate.queryForList("""
                SELECT pdf_sha256, pdf_size_bytes
                  FROM emission_project_report
                 WHERE certificate_id = ? AND report_status = 'FINALIZED' AND certificate_status = 'ACTIVE'
                 FOR UPDATE
                """, normalizedCertificateId);
        if (registryRows.isEmpty() && projectRows.isEmpty()) {
            throw new IllegalArgumentException("An active issued certificate is required before registering PDF bytes.");
        }
        boolean newlyBound = false;
        for (Map<String, Object> row : concatRows(registryRows, projectRows)) {
            String existingSha = text(row.get("pdf_sha256")).trim().toLowerCase(Locale.ROOT);
            Long existingSize = longValue(row.get("pdf_size_bytes"));
            if (existingSha.isBlank() && existingSize == null) {
                newlyBound = true;
                continue;
            }
            if (!existingSha.equals(pdfSha256) || existingSize == null || existingSize != pdfBytes.length) {
                throw new IllegalStateException("The certificate ID is already bound to different PDF bytes.");
            }
        }
        String registeredBy = textOr(actorId, "system");
        if (!registryRows.isEmpty()) {
            int updated = jdbcTemplate.update("""
                    UPDATE carbonet_report_verification_registry
                       SET pdf_sha256 = COALESCE(pdf_sha256, ?),
                           pdf_size_bytes = COALESCE(pdf_size_bytes, ?),
                           pdf_fingerprint_registered_by = COALESCE(pdf_fingerprint_registered_by, ?),
                           pdf_fingerprint_registered_at = COALESCE(pdf_fingerprint_registered_at, now()),
                           updated_at = now()
                     WHERE certificate_id = ? AND status_code = 'ISSUED'
                       AND (pdf_sha256 IS NULL OR pdf_sha256 = ?)
                       AND (pdf_size_bytes IS NULL OR pdf_size_bytes = ?)
                    """, pdfSha256, pdfBytes.length, registeredBy, normalizedCertificateId,
                    pdfSha256, pdfBytes.length);
            if (updated != registryRows.size()) {
                throw new IllegalStateException("The report-registry PDF fingerprint binding changed concurrently.");
            }
        }
        if (!projectRows.isEmpty()) {
            int updated = jdbcTemplate.update("""
                    UPDATE emission_project_report
                       SET pdf_sha256 = COALESCE(pdf_sha256, ?),
                           pdf_size_bytes = COALESCE(pdf_size_bytes, ?),
                           pdf_fingerprint_registered_by = COALESCE(pdf_fingerprint_registered_by, ?),
                           pdf_fingerprint_registered_at = COALESCE(pdf_fingerprint_registered_at, now())
                     WHERE certificate_id = ? AND report_status = 'FINALIZED' AND certificate_status = 'ACTIVE'
                       AND (pdf_sha256 IS NULL OR pdf_sha256 = ?)
                       AND (pdf_size_bytes IS NULL OR pdf_size_bytes = ?)
                    """, pdfSha256, pdfBytes.length, registeredBy, normalizedCertificateId,
                    pdfSha256, pdfBytes.length);
            if (updated != projectRows.size()) {
                throw new IllegalStateException("The project-report PDF fingerprint binding changed concurrently.");
            }
        }
        return Map.of(
                "success", true,
                "status", newlyBound ? "PDF_FINGERPRINT_BOUND" : "PDF_FINGERPRINT_ALREADY_BOUND",
                "certificateId", normalizedCertificateId,
                "pdfSha256", pdfSha256,
                "pdfSizeBytes", pdfBytes.length
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyPdfFile(String certificateId, byte[] pdfBytes) {
        String normalizedCertificateId = certificateId == null ? "" : certificateId.trim();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("certificateId", normalizedCertificateId);
        if (normalizedCertificateId.isBlank()) {
            return pdfFileResult(response, "INVALID_PDF", false,
                    "A certificate ID is required for exact PDF verification.");
        }
        try {
            validatePdfBytes(pdfBytes);
        } catch (IllegalArgumentException exception) {
            return pdfFileResult(response, "INVALID_PDF", false, exception.getMessage());
        }

        Map<String, Object> stored;
        try {
            stored = loadPdfFingerprint(normalizedCertificateId);
        } catch (IllegalArgumentException exception) {
            return pdfFileResult(response, "NOT_FOUND", false,
                    "No issued PDF record exists for this certificate ID.");
        }

        String registeredSha256 = text(stored.get("pdf_sha256")).trim().toLowerCase(Locale.ROOT);
        Long registeredSize = longValue(stored.get("pdf_size_bytes"));
        response.put("uploadedPdfSizeBytes", pdfBytes.length);
        if (registeredSha256.isBlank() || registeredSize == null) {
            response.put("byteHashMatch", false);
            response.put("sizeMatch", false);
            return pdfFileResult(response, "PDF_FINGERPRINT_UNAVAILABLE", false,
                    "This legacy issuance has no final-PDF fingerprint and cannot prove exact-file authenticity.");
        }

        String uploadedSha256 = sha256Hex(pdfBytes);
        boolean byteHashMatch = MessageDigest.isEqual(
                registeredSha256.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                uploadedSha256.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        boolean sizeMatch = registeredSize == pdfBytes.length;
        response.put("byteHashMatch", byteHashMatch);
        response.put("sizeMatch", sizeMatch);
        response.put("registeredPdfSizeBytes", registeredSize);
        if (byteHashMatch && sizeMatch) {
            return pdfFileResult(response, "EXACT_PDF_MATCH", true,
                    "The uploaded PDF bytes exactly match the issued PDF.");
        }
        return pdfFileResult(response, "TAMPERED_PDF", false,
                "The uploaded PDF bytes differ from the issued PDF.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> verifyOcr(Map<String, Object> request) {
        String ocrText = required(request, "ocrText");
        String requestedReportType = text(request.get("reportType"));
        if (requestedReportType.isBlank()) {
            requestedReportType = "EMISSION_SURVEY";
        }
        boolean ocrEvidenceRequired = "EMISSION_SURVEY".equalsIgnoreCase(requestedReportType);
        String normalizedText = normalizeText(ocrText);
        if (request.get("ocrPages") instanceof List<?> pages && pages.size() > MAX_VERIFICATION_PAGES) {
            throw new IllegalArgumentException("Report verification supports up to 10 pages.");
        }
        List<String> normalizedOcrPages = normalizeOcrPages(request.get("ocrPages"));
        List<List<OcrLineEvidence>> ocrLinePages = normalizeOcrLinePages(request.get("ocrPages"));
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
                       dataset_json::text AS dataset_json, ocr_evidence_json::text AS ocr_evidence_json
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
            Map<String, Object> score = scoreOcrCandidate(normalizedText, ocrText, dataset);
            Map<String, Object> detailTableScore = scoreDetailTablePage(normalizedOcrPages, dataset, ocrLinePages);
            score.putAll(detailTableScore);
            Map<String, Object> sectionSummaryScore = scoreSectionSummaryPage(normalizedOcrPages, dataset, ocrLinePages);
            score.putAll(sectionSummaryScore);
            appendUnifiedComparisonDetails(score);
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
                    && Boolean.TRUE.equals(score.get("totalEmissionMatched"))
                    && ((Number) score.get("matchedMaterialCount")).intValue() == ((Number) score.get("materialCount")).intValue()
                    && ((Number) score.get("matchedNumberCount")).intValue() == ((Number) score.get("numberCount")).intValue()
                    && Boolean.TRUE.equals(score.get("detailRowsExactMatch"))
                    && Boolean.TRUE.equals(score.get("sectionSummaryExactMatch"));
            boolean tagExactMatch = qrFullyMatched || (certificateIdMatch && payloadHashMatch && integrityCodeMatch && datasetHashMatch);
            Map<String, Object> ocrEvidenceScore = scoreRegisteredOcrEvidence(normalizedOcrPages,
                    readJsonNullable(candidate.get("ocr_evidence_json")));
            boolean ocrEvidenceAvailable = Boolean.TRUE.equals(ocrEvidenceScore.get("ocrEvidenceAvailable"));
            boolean ocrEvidenceExactMatch = Boolean.TRUE.equals(ocrEvidenceScore.get("ocrEvidenceExactMatch"));
            double combinedScore = qrFullyMatched ? 85 + (contentScore * 0.15) : contentScore;
            Map<String, Object> visualScore = scoreVisualProfile(readJsonNullable(candidate.get("visual_profile_json")), uploadedVisualProfile);
            boolean numericDataExactMatch = lcaReport ? datasetExactMatch
                    : Boolean.TRUE.equals(score.get("productMatched"))
                    && Boolean.TRUE.equals(score.get("totalEmissionMatched"))
                    && ((Number) score.get("matchedMaterialCount")).intValue() == ((Number) score.get("materialCount")).intValue()
                    && Boolean.TRUE.equals(score.get("detailRowsExactMatch"))
                    && allComparisonFlags(score.get("reportSummaryComparisons"), "matched")
                    && allComparisonFlags(score.get("outputFieldComparisons"), "rowMatched");
            boolean chartDataExactMatch = lcaReport || Boolean.TRUE.equals(score.get("sectionSummaryExactMatch"));
            boolean chartVisualExactMatch = lcaReport || (Boolean.TRUE.equals(visualScore.get("visualProfileAvailable"))
                    && "VISUAL_MATCH".equals(visualScore.get("chartVisualStatus")));
            boolean chartExactMatch = chartDataExactMatch && chartVisualExactMatch;
            int confidence = (int) Math.round(combinedScore);
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("certificateId", certificateId);
            comparison.put("issuedAt", candidate.get("issued_at"));
            comparison.put("reportTitle", candidate.get("report_title"));
            comparison.put("reportTitleActual", Boolean.TRUE.equals(score.get("titleMatched")) ? candidate.get("report_title") : "");
            comparison.put("productName", candidate.get("product_name"));
            comparison.put("productNameActual", Boolean.TRUE.equals(score.get("productMatched")) ? candidate.get("product_name") : "");
            comparison.put("totalEmission", candidate.get("total_emission"));
            comparison.put("totalEmissionActual", findObservedNumber(ocrText, objectMapper.valueToTree(candidate.get("total_emission"))));
            comparison.put("rowCount", candidate.get("row_count"));
            comparison.put("payloadHash", payloadHash);
            comparison.put("integrityCode", integrityCode);
            comparison.put("datasetHash", datasetHash);
            comparison.put("certificateIdActual", certificateIdMatch ? (qrCertificateId.isBlank() ? certificateId : qrCertificateId) : "");
            comparison.put("payloadHashActual", payloadHashMatch ? (qrPayloadHash.isBlank() ? payloadHash : qrPayloadHash) : "");
            comparison.put("integrityCodeActual", integrityCodeMatch ? (qrIntegrityCode.isBlank() ? integrityCode : qrIntegrityCode) : "");
            comparison.put("datasetHashActual", datasetHashMatch ? (qrDatasetHash.isBlank() ? datasetHash : qrDatasetHash) : "");
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
            comparison.put("numericDataExactMatch", numericDataExactMatch);
            comparison.put("chartDataExactMatch", chartDataExactMatch);
            comparison.put("chartVisualExactMatch", chartVisualExactMatch);
            comparison.put("chartExactMatch", chartExactMatch);
            comparison.put("tagExactMatch", tagExactMatch);
            comparison.put("ocrEvidenceAvailable", ocrEvidenceAvailable);
            comparison.put("ocrEvidenceExactMatch", ocrEvidenceExactMatch);
            comparison.put("ocrEvidenceRequired", ocrEvidenceRequired);
            comparison.putAll(ocrEvidenceScore);
            comparison.put("overallExactMatch", datasetExactMatch && tagExactMatch
                    && (!ocrEvidenceRequired || ocrEvidenceExactMatch));
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
                best.put("datasetExactMatch", datasetExactMatch);
                best.put("numericDataExactMatch", numericDataExactMatch);
                best.put("chartDataExactMatch", chartDataExactMatch);
                best.put("chartVisualExactMatch", chartVisualExactMatch);
                best.put("chartExactMatch", chartExactMatch);
                best.put("tagExactMatch", tagExactMatch);
                best.putAll(ocrEvidenceScore);
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
        boolean tagExactMatch = Boolean.TRUE.equals(best.get("tagExactMatch"));
        boolean datasetExactMatch = Boolean.TRUE.equals(best.get("datasetExactMatch"));
        boolean ocrEvidenceAvailable = Boolean.TRUE.equals(best.get("ocrEvidenceAvailable"));
        boolean ocrEvidenceExactMatch = Boolean.TRUE.equals(best.get("ocrEvidenceExactMatch"));
        boolean basePhotoConsistent = (qrFullyMatched ? contentConfidence >= 40 : confidence >= 75)
                && (!visualProfileAvailable || visualMatch);
        boolean photoConsistent = basePhotoConsistent
                && (!ocrEvidenceRequired || (tagExactMatch && datasetExactMatch && ocrEvidenceExactMatch));
        String status;
        if (photoConsistent) {
            status = "PHOTO_CONTENT_MATCH";
        } else if (!ocrEvidenceRequired) {
            status = confidence >= 55 ? "PHOTO_REVIEW" : "PHOTO_MISMATCH";
        } else if (!ocrEvidenceAvailable) {
            status = "OCR_EVIDENCE_UNAVAILABLE";
        } else if (!tagExactMatch) {
            status = "IDENTIFIER_MISMATCH";
        } else if (!datasetExactMatch) {
            status = "OCR_DATASET_MISMATCH";
        } else if (!ocrEvidenceExactMatch) {
            status = "OCR_CONTENT_MISMATCH";
        } else {
            status = "PHOTO_MISMATCH";
        }
        response.put("photoConsistent", photoConsistent);
        response.put("status", status);
        response.put("confidence", confidence);
        response.put("contentConfidence", (int) Math.round(contentConfidence));
        response.put("qrFullyMatched", qrFullyMatched);
        response.put("qrCertificateMatch", best.get("qrCertificateMatch"));
        response.put("qrPayloadHashMatch", best.get("qrPayloadHashMatch"));
        response.put("qrIntegrityMatch", best.get("qrIntegrityMatch"));
        response.put("qrDatasetHashMatch", best.get("qrDatasetHashMatch"));
        response.put("tagExactMatch", tagExactMatch);
        response.put("datasetExactMatch", datasetExactMatch);
        response.put("numericDataExactMatch", best.get("numericDataExactMatch"));
        response.put("chartDataExactMatch", best.get("chartDataExactMatch"));
        response.put("chartVisualExactMatch", best.get("chartVisualExactMatch"));
        response.put("chartExactMatch", best.get("chartExactMatch"));
        response.put("semanticStatus", classifySemanticStatus(Boolean.TRUE.equals(best.get("numericDataExactMatch")),
                Boolean.TRUE.equals(best.get("chartExactMatch"))));
        response.put("ocrEvidenceRequired", ocrEvidenceRequired);
        response.put("ocrEvidenceAvailable", ocrEvidenceAvailable);
        response.put("ocrEvidenceExactMatch", ocrEvidenceExactMatch);
        response.put("ocrEvidenceTokenCount", best.get("ocrEvidenceTokenCount"));
        response.put("matchedOcrEvidenceTokenCount", best.get("matchedOcrEvidenceTokenCount"));
        response.put("missingOcrEvidenceTokens", best.get("missingOcrEvidenceTokens"));
        response.put("ocrEvidencePageCount", best.get("ocrEvidencePageCount"));
        response.put("matchedOcrEvidencePageCount", best.get("matchedOcrEvidencePageCount"));
        response.put("ocrEvidencePageCountMatch", best.get("ocrEvidencePageCountMatch"));
        response.put("ocrEvidencePageComparisons", best.get("ocrEvidencePageComparisons"));
        response.put("visualProfileAvailable", best.get("visualProfileAvailable"));
        response.put("visualSimilarity", best.get("visualSimilarity"));
        response.put("damagedCellCount", best.get("damagedCellCount"));
        response.put("comparedCellCount", best.get("comparedCellCount"));
        response.put("visualStatus", best.get("visualStatus"));
        response.put("damagedRegions", best.get("damagedRegions"));
        response.put("certificateId", best.get("certificate_id"));
        response.put("payloadHash", best.get("payload_hash"));
        response.put("integrityCode", best.get("integrity_code"));
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
        response.put("detailRowsExactMatch", best.get("detailRowsExactMatch"));
        response.put("comparisonItemCount", best.get("comparisonItemCount"));
        response.put("matchedComparisonItemCount", best.get("matchedComparisonItemCount"));
        response.put("comparisonDetails", best.get("comparisonDetails"));
        response.put("sectionSummaryAvailable", best.get("sectionSummaryAvailable"));
        response.put("sectionSummaryExactMatch", best.get("sectionSummaryExactMatch"));
        response.put("sectionSummaryComparisons", best.get("sectionSummaryComparisons"));
        response.put("unexpectedSectionSummaryNumbers", best.get("unexpectedSectionSummaryNumbers"));
        response.put("message", confidence >= 75
                ? "The photographed report content is highly consistent with the issued dataset."
                : confidence >= 60
                    ? "The photographed report partially matches an issued dataset and requires visual review."
                    : "The photographed report content does not sufficiently match the issued dataset.");
        return response;
    }

    private String classifySemanticStatus(boolean numericDataExactMatch, boolean chartExactMatch) {
        if (!numericDataExactMatch) {
            return "DATA_TAMPERED";
        }
        if (!chartExactMatch) {
            return "CHART_TAMPERED";
        }
        return "CONTENT_EXACT";
    }

    private Map<String, Object> scoreSectionSummaryPage(List<String> normalizedOcrPages, JsonNode dataset) {
        return scoreSectionSummaryPage(normalizedOcrPages, dataset, List.of());
    }

    private Map<String, Object> scoreSectionSummaryPage(List<String> normalizedOcrPages, JsonNode dataset,
                                                         List<List<OcrLineEvidence>> ocrLinePages) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode summaries = dataset.path("sectionSummaries");
        boolean available = summaries.isArray() && !summaries.isEmpty();
        result.put("sectionSummaryAvailable", available);
        if (!available) {
            result.put("sectionSummaryExactMatch", true);
            result.put("sectionSummaryComparisons", List.of());
            result.put("unexpectedSectionSummaryNumbers", List.of());
            return result;
        }

        if (!ocrLinePages.isEmpty()) {
            return scoreSectionSummaryLines(ocrLinePages, summaries);
        }
        String pageText = selectSectionSummaryPage(normalizedOcrPages, summaries);
        String normalizedPageText = normalizeText(pageText);
        List<String> actualNumbers = extractCanonicalNumbers(pageText);
        List<String> expectedNumbers = new ArrayList<>();
        List<Map<String, Object>> comparisons = new ArrayList<>();
        List<JsonNode> comparableSummaries = new ArrayList<>();
        for (JsonNode summary : summaries) {
            if (summary.path("calculatedRowCount").asInt(summary.path("rowCount").asInt()) > 0) {
                comparableSummaries.add(summary);
            }
        }
        for (int summaryIndex = 0; summaryIndex < comparableSummaries.size(); summaryIndex++) {
            JsonNode summary = comparableSummaries.get(summaryIndex);
            String label = summary.path("sectionLabel").asText();
            String total = canonicalNumber(displayValue(summary, "totalEmission", summary.path("totalEmission")));
            String share = canonicalNumber(summary.path("sharePercent").decimalValue()
                    .setScale(0, java.math.RoundingMode.HALF_UP).toPlainString());
            expectedNumbers.add(total);
            expectedNumbers.add(share);
            String normalizedLabel = normalizeOcrEvidenceText(label);
            int sectionStart = findWhitespaceTolerantTextStart(pageText, normalizedLabel, 0);
            int sectionEnd = pageText.length();
            if (sectionStart >= 0 && summaryIndex + 1 < comparableSummaries.size()) {
                String nextLabel = normalizeOcrEvidenceText(
                        comparableSummaries.get(summaryIndex + 1).path("sectionLabel").asText());
                int nextStart = findWhitespaceTolerantTextStart(pageText, nextLabel,
                        sectionStart + normalizedLabel.length());
                if (nextStart >= 0) sectionEnd = nextStart;
            }
            String sectionText = sectionStart >= 0 ? pageText.substring(sectionStart, sectionEnd) : "";
            List<String> sectionNumbers = extractCanonicalNumbers(sectionText);
            String actualTotal = sectionNumbers.isEmpty() ? "" : sectionNumbers.get(0);
            int actualShareIndex = -1;
            for (int numberIndex = 1; numberIndex < sectionNumbers.size(); numberIndex++) {
                if (share.equals(sectionNumbers.get(numberIndex))) {
                    actualShareIndex = numberIndex;
                    break;
                }
            }
            if (actualShareIndex < 0 && sectionNumbers.size() >= 2) {
                actualShareIndex = sectionNumbers.size() - 1;
            }
            String actualShare = actualShareIndex < 0 ? "" : sectionNumbers.get(actualShareIndex);
            List<String> unexpectedNumbers = new ArrayList<>();
            for (int numberIndex = 1; numberIndex < sectionNumbers.size(); numberIndex++) {
                if (numberIndex != actualShareIndex) unexpectedNumbers.add(sectionNumbers.get(numberIndex));
            }
            boolean labelMatched = sectionStart >= 0;
            boolean totalMatched = total.equals(actualTotal);
            boolean shareMatched = share.equals(actualShare);
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("sectionCode", summary.path("sectionCode").asText());
            comparison.put("sectionLabel", label);
            comparison.put("expectedTotalEmission", total);
            comparison.put("actualTotalEmission", actualTotal);
            comparison.put("expectedSharePercent", share);
            comparison.put("actualSharePercent", actualShare);
            comparison.put("labelMatched", labelMatched);
            comparison.put("totalEmissionMatched", totalMatched);
            comparison.put("sharePercentMatched", shareMatched);
            comparison.put("unexpectedNumbers", unexpectedNumbers);
            comparison.put("matched", labelMatched && totalMatched && shareMatched && unexpectedNumbers.isEmpty());
            comparisons.add(comparison);
        }

        Map<String, Integer> remaining = new LinkedHashMap<>();
        for (String number : expectedNumbers) remaining.merge(number, 1, Integer::sum);
        List<String> unexpected = new ArrayList<>();
        for (String number : actualNumbers) {
            int count = remaining.getOrDefault(number, 0);
            if (count > 0) {
                remaining.put(number, count - 1);
            } else if (unexpected.size() < MAX_DIFFERENCES) {
                unexpected.add(number);
            }
        }
        boolean allFieldsMatched = comparisons.stream()
                .allMatch(value -> Boolean.TRUE.equals(value.get("matched")));
        boolean exact = !pageText.isBlank() && allFieldsMatched
                && expectedNumbers.size() == actualNumbers.size() && unexpected.isEmpty();
        result.put("sectionSummaryExactMatch", exact);
        result.put("sectionSummaryComparisons", comparisons);
        result.put("unexpectedSectionSummaryNumbers", unexpected);
        return result;
    }

    private Map<String, Object> scoreDetailTablePage(List<String> normalizedOcrPages, JsonNode dataset) {
        return scoreDetailTablePage(normalizedOcrPages, dataset, List.of());
    }

    private Map<String, Object> scoreDetailTablePage(List<String> normalizedOcrPages, JsonNode dataset,
                                                      List<List<OcrLineEvidence>> ocrLinePages) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode rows = dataset.path("rows");
        if (!ocrLinePages.isEmpty()) return scoreDetailTableLines(ocrLinePages, dataset, rows);
        String pageText = selectDetailTablePages(normalizedOcrPages, rows);
        List<Map<String, Object>> comparisons = new ArrayList<>();
        if (!rows.isArray() || rows.isEmpty() || pageText.isBlank()) {
            result.put("detailRowsExactMatch", false);
            result.put("fieldComparisons", comparisons);
            result.put("fieldMismatches", comparisons);
            return result;
        }

        List<Integer> rowStarts = new ArrayList<>();
        java.util.Set<Integer> usedRowStarts = new java.util.HashSet<>();
        int cursor = 0;
        for (JsonNode row : rows) {
            String material = normalizeOcrEvidenceText(row.path("materialName").asText());
            int start = findUnusedMaterialStart(pageText, material, cursor, usedRowStarts);
            rowStarts.add(start);
            if (start >= 0) {
                usedRowStarts.add(start);
                cursor = start + material.length();
            }
        }

        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            JsonNode row = rows.get(rowIndex);
            int start = rowStarts.get(rowIndex);
            int end = pageText.length();
            for (int nextStart : rowStarts) {
                if (nextStart > start && nextStart < end) end = nextStart;
            }
            String rowText = start >= 0 ? pageText.substring(start, end) : "";
            List<String> actualNumbers = extractCanonicalNumbers(rowText);
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("rowIndex", rowIndex + 1);
            comparison.put("sectionLabel", sectionLabel(dataset, row));
            comparison.put("materialName", row.path("materialName").asText());
            comparison.put("actualMaterialName", start >= 0 ? row.path("materialName").asText() : "");
            comparison.put("materialMatched", start >= 0);

            int numericIndex = 0;
            String previousExpectedCanonical = null;
            String previousActual = null;
            boolean rowMatched = start >= 0;
            for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                JsonNode value = "amount".equals(field) && row.path("originalAmount").isNumber()
                        ? row.path("originalAmount") : row.path(field);
                String expected = displayValue(row, "amount".equals(field) ? "originalAmount" : field, value);
                if (expected.isBlank() && value.isNumber()) expected = canonicalNumber(value.asText());
                boolean displayedDash = "totalEmission".equals(field) && value.isNumber()
                        && Math.abs(value.asDouble()) <= 0.0000001 && rowText.contains("-");
                if (displayedDash) expected = "-";
                String expectedCanonical = canonicalNumber(expected);
                boolean repeatedVisibleValue = previousExpectedCanonical != null
                        && previousExpectedCanonical.equals(expectedCanonical)
                        && numericIndex >= actualNumbers.size();
                String actual = repeatedVisibleValue ? previousActual
                        : numericIndex < actualNumbers.size() ? actualNumbers.get(numericIndex) : "";
                if (displayedDash) actual = "-";
                boolean matched = expectedCanonical.equals(canonicalNumber(actual));
                comparison.put(field + "Display", expected);
                comparison.put(field + "Actual", actual);
                comparison.put(field + "Matched", matched);
                rowMatched = rowMatched && matched;
                if (!repeatedVisibleValue) numericIndex++;
                previousExpectedCanonical = expectedCanonical;
                previousActual = actual;
            }
            reuseSingleVisibleDuplicateValue(actualNumbers, comparison);
            comparison.put("rowMatched", rowMatched);
            comparisons.add(comparison);
        }
        reuseIdenticalDuplicateRowEvidence(comparisons);
        result.put("detailRowsExactMatch", comparisons.stream()
                .allMatch(row -> Boolean.TRUE.equals(row.get("rowMatched"))));
        result.put("fieldComparisons", comparisons);
        result.put("fieldMismatches", comparisons.stream()
                .filter(row -> !Boolean.TRUE.equals(row.get("rowMatched"))).toList());
        return result;
    }

    private int findUnusedMaterialStart(String pageText, String material, int cursor,
                                        java.util.Set<Integer> usedStarts) {
        if (material.isBlank()) return -1;
        java.util.regex.Pattern pattern = whitespaceTolerantTextPattern(material);
        int start = findUnusedPatternStart(pattern, pageText, Math.max(0, cursor), usedStarts);
        if (start >= 0) return start;
        return findUnusedPatternStart(pattern, pageText, 0, usedStarts);
    }

    private java.util.regex.Pattern whitespaceTolerantTextPattern(String value) {
        StringBuilder expression = new StringBuilder();
        value.codePoints().filter(codePoint -> !Character.isWhitespace(codePoint)).forEach(codePoint -> {
            expression.append(java.util.regex.Pattern.quote(new String(Character.toChars(codePoint))))
                    .append("\\s*");
        });
        return java.util.regex.Pattern.compile(expression.toString());
    }

    private int findWhitespaceTolerantTextStart(String text, String value, int from) {
        java.util.regex.Matcher matcher = whitespaceTolerantTextPattern(value).matcher(text);
        return matcher.find(Math.max(0, from)) ? matcher.start() : -1;
    }

    private int findUnusedPatternStart(java.util.regex.Pattern pattern, String text, int from,
                                       java.util.Set<Integer> usedStarts) {
        java.util.regex.Matcher matcher = pattern.matcher(text);
        while (matcher.find(Math.max(0, from))) {
            if (!usedStarts.contains(matcher.start())) return matcher.start();
            from = Math.max(matcher.end(), matcher.start() + 1);
        }
        return -1;
    }

    @SuppressWarnings("unchecked")
    private void appendUnifiedComparisonDetails(Map<String, Object> score) {
        List<Map<String, Object>> details = new ArrayList<>();
        Object rowsValue = score.get("fieldComparisons");
        if (rowsValue instanceof List<?> rows) {
            for (Object value : rows) {
                if (!(value instanceof Map<?, ?> row)) continue;
                String group = "#" + row.get("rowIndex") + " " + text(row.get("sectionLabel"))
                        + " / " + text(row.get("materialName"));
                addComparisonDetail(details, "DETAIL", group, "물질명",
                        text(row.get("materialName")), text(row.get("actualMaterialName")),
                        Boolean.TRUE.equals(row.get("materialMatched")));
                for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                    String label = switch (field) {
                        case "amount" -> "사용량";
                        case "emissionFactor" -> "배출계수";
                        default -> "배출량";
                    };
                    addComparisonDetail(details, "DETAIL", group, label,
                            text(row.get(field + "Display")), text(row.get(field + "Actual")),
                            Boolean.TRUE.equals(row.get(field + "Matched")));
                }
            }
        }
        Object sectionsValue = score.get("sectionSummaryComparisons");
        if (sectionsValue instanceof List<?> sections) {
            for (Object value : sections) {
                if (!(value instanceof Map<?, ?> section)) continue;
                String group = "차트 / " + text(section.get("sectionLabel"));
                addComparisonDetail(details, "CHART", group, "항목명",
                        text(section.get("sectionLabel")),
                        Boolean.TRUE.equals(section.get("labelMatched")) ? text(section.get("sectionLabel")) : "",
                        Boolean.TRUE.equals(section.get("labelMatched")));
                addComparisonDetail(details, "CHART", group, "배출량",
                        text(section.get("expectedTotalEmission")), text(section.get("actualTotalEmission")),
                        Boolean.TRUE.equals(section.get("totalEmissionMatched")));
                addComparisonDetail(details, "CHART", group, "비율(%)",
                        text(section.get("expectedSharePercent")), text(section.get("actualSharePercent")),
                        Boolean.TRUE.equals(section.get("sharePercentMatched")));
            }
        }
        score.put("comparisonDetails", details);
        score.put("comparisonItemCount", details.size());
        score.put("matchedComparisonItemCount", details.stream()
                .filter(item -> Boolean.TRUE.equals(item.get("matched"))).count());
    }

    private void addComparisonDetail(List<Map<String, Object>> details, String category, String group,
                                     String field, String expected, String actual, boolean matched) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("category", category);
        detail.put("group", group);
        detail.put("field", field);
        detail.put("expected", expected);
        detail.put("actual", actual);
        detail.put("matched", matched);
        details.add(detail);
    }

    private String sectionLabel(JsonNode dataset, JsonNode row) {
        String label = row.path("sectionLabel").asText();
        if (!label.isBlank()) return label;
        for (JsonNode section : dataset.path("sectionSummaries")) {
            if (row.path("sectionCode").asText().equals(section.path("sectionCode").asText())) {
                return section.path("sectionLabel").asText();
            }
        }
        return "";
    }

    private List<String> extractCanonicalNumbers(String text) {
        List<String> numbers = new ArrayList<>();
        String normalizedNumericText = (text == null ? "" : text)
                .replaceAll("(?<=\\d)\\s*([.,])\\s*(?=\\d)", "$1")
                .replace(",", "");
        Matcher matcher = Pattern.compile("(?<![\\p{L}\\p{N}.])-?\\d+(?:\\.\\d+)?(?![\\d.])")
                .matcher(normalizedNumericText);
        while (matcher.find() && numbers.size() < MAX_FIELD_COMPARISONS) {
            numbers.add(canonicalNumber(matcher.group()));
        }
        return numbers;
    }

    private String canonicalNumber(String value) {
        try {
            return new java.math.BigDecimal(value.replace(",", "")).stripTrailingZeros().toPlainString();
        } catch (RuntimeException ignored) {
            return value;
        }
    }

    private Map<String, Object> scoreOcrCandidate(String normalizedText, String numericText, JsonNode dataset) {
        boolean lcaReport = "LCA_SUMMARY".equalsIgnoreCase(dataset.path("reportType").asText());
        JsonNode lcaSummary = dataset.path("lcaSummary");
        boolean productMatched = containsText(normalizedText, dataset.path("productName").asText());
        boolean titleMatched = (lcaReport && (containsText(normalizedText, lcaSummary.path("documentTitle").asText())
                || containsText(normalizedText, "제품 LCA 수행 개요")))
                || containsText(normalizedText, dataset.path("displayTitle").asText())
                || containsText(normalizedText, dataset.path("pageTitle").asText())
                || containsText(normalizedText, "제품/부산물 배출계수 리포트")
                || containsText(normalizedText, "탄소배출량 리포트");
        boolean totalMatched = containsNumber(numericText, dataset.path("summary").path("totalEmission"));
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
                    JsonNode value = "amount".equals(field) && row.path("originalAmount").isNumber()
                            ? row.path("originalAmount") : row.path(field);
                    if (value.isNumber() && Math.abs(value.asDouble()) > 0.0000001) {
                        numberCount++;
                        boolean matched = containsDisplayedNumber(numericText, row, field, value);
                        fieldMatches.put(field, matched);
                        if (matched) {
                            matchedNumberCount++;
                        }
                    }
                }
                boolean rowMatched = materialMatched && fieldMatches.values().stream().allMatch(Boolean.TRUE::equals);
                Map<String, Object> comparison = new LinkedHashMap<>();
                comparison.put("rowIndex", rowIndex + 1);
                String sectionLabel = row.path("sectionLabel").asText();
                if (sectionLabel.isBlank() && dataset.path("sectionSummaries").isArray()) {
                    for (JsonNode section : dataset.path("sectionSummaries")) {
                        if (row.path("sectionCode").asText().equals(section.path("sectionCode").asText())) {
                            sectionLabel = section.path("sectionLabel").asText();
                            break;
                        }
                    }
                }
                comparison.put("sectionLabel", sectionLabel);
                comparison.put("materialName", materialName);
                comparison.put("rowMatched", rowMatched);
                comparison.put("materialMatched", materialMatched);
                JsonNode visibleAmount = row.path("originalAmount").isNumber() ? row.path("originalAmount") : row.path("amount");
                comparison.put("amount", visibleAmount.isNumber() ? visibleAmount.numberValue() : null);
                comparison.put("amountDisplay", displayValue(row, "originalAmount", visibleAmount));
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
        List<Map<String, Object>> reportSummaryComparisons = new ArrayList<>();
        List<Map<String, Object>> outputFieldComparisons = new ArrayList<>();
        if (!lcaReport) {
            JsonNode verificationSummary = dataset.path("verificationSummary");
            Map<String, String> summaryLabels = new LinkedHashMap<>();
            summaryLabels.put("totalCarbonEmission", "총 탄소배출량");
            summaryLabels.put("totalOutputMass", "총 산출물 질량");
            summaryLabels.put("productGwp", "제품 GWP");
            summaryLabels.put("processGwp", "공정 GWP");
            JsonNode legacyOutputRows = dataset.path("rows");
            double legacyTotalEmission = dataset.path("summary").path("totalEmission").asDouble(0);
            double legacyOutputMass = dataset.path("normalization").path("outputQuantityTotal").asDouble(0);
            List<JsonNode> legacyOutputs = new ArrayList<>();
            if (legacyOutputRows.isArray()) {
                legacyOutputRows.forEach(row -> {
                    if ("OUTPUT_PRODUCTS".equals(row.path("sectionCode").asText()) && row.path("originalAmount").asDouble(0) > 0) legacyOutputs.add(row);
                });
            }
            double legacyProductGwp = !legacyOutputs.isEmpty() && legacyOutputMass > 0
                    ? legacyTotalEmission * legacyOutputs.get(0).path("originalAmount").asDouble(0) / legacyOutputMass : 0;
            double legacyProcessGwp = legacyOutputMass > 0 ? legacyTotalEmission / legacyOutputMass : 0;
            Map<String, Double> legacySummaryValues = Map.of(
                    "totalCarbonEmission", legacyTotalEmission,
                    "totalOutputMass", legacyOutputMass,
                    "productGwp", legacyProductGwp,
                    "processGwp", legacyProcessGwp
            );
            for (Map.Entry<String, String> entry : summaryLabels.entrySet()) {
                JsonNode value = verificationSummary.path(entry.getKey());
                if (!value.isNumber() && legacySummaryValues.containsKey(entry.getKey())) value = objectMapper.valueToTree(legacySummaryValues.get(entry.getKey()));
                if (!value.isNumber()) continue;
                String actual = findObservedDisplayedNumber(numericText, verificationSummary, entry.getKey(), value);
                boolean matched = !actual.isBlank();
                numberCount++;
                if (matched) matchedNumberCount++;
                Map<String, Object> comparison = new LinkedHashMap<>();
                comparison.put("field", entry.getKey());
                comparison.put("label", entry.getValue());
                comparison.put("expected", displayValue(verificationSummary, entry.getKey(), value));
                comparison.put("actual", actual);
                comparison.put("matched", matched);
                reportSummaryComparisons.add(comparison);
            }
            JsonNode outputRows = dataset.path("outputRows");
            int outputCount = outputRows.isArray() && !outputRows.isEmpty() ? outputRows.size() : legacyOutputs.size();
            if (outputCount > 0) {
                for (int rowIndex = 0; rowIndex < outputCount; rowIndex++) {
                    boolean legacyRow = !outputRows.isArray() || outputRows.isEmpty();
                    JsonNode row = legacyRow ? legacyOutputs.get(rowIndex) : outputRows.get(rowIndex);
                    String materialName = row.path("materialName").asText();
                    boolean materialMatched = containsText(normalizedText, materialName);
                    Map<String, Object> comparison = new LinkedHashMap<>();
                    comparison.put("rowIndex", rowIndex + 1);
                    comparison.put("outputType", legacyRow ? (rowIndex == 0 ? "PRODUCT" : "BYPRODUCT") : row.path("outputType").asText());
                    comparison.put("materialName", materialName);
                    comparison.put("materialMatched", materialMatched);
                    comparison.put("materialActual", materialMatched ? materialName : "");
                    boolean rowMatched = materialMatched;
                    for (String field : List.of("processReferenceMass", "massSharePercent", "allocatedEmission", "emissionPerTon")) {
                        JsonNode value = row.path(field);
                        if (legacyRow) {
                            double mass = row.path("originalAmount").asDouble(0);
                            double share = legacyOutputMass > 0 ? mass / legacyOutputMass : 0;
                            double derivedValue = switch (field) {
                                case "processReferenceMass" -> mass;
                                case "massSharePercent" -> share * 100;
                                case "allocatedEmission" -> legacyTotalEmission * share;
                                case "emissionPerTon" -> legacyOutputMass > 0 ? (legacyTotalEmission / legacyOutputMass) * share : legacyTotalEmission * share;
                                default -> 0;
                            };
                            value = objectMapper.valueToTree(derivedValue);
                        }
                        String actual = value.isNumber() ? findObservedDisplayedNumber(numericText, row, field, value) : "";
                        boolean matched = !value.isNumber() || !actual.isBlank();
                        comparison.put(field + "Display", displayValue(row, field, value));
                        comparison.put(field + "Actual", actual);
                        comparison.put(field + "Matched", matched);
                        if (value.isNumber()) {
                            numberCount++;
                            if (matched) matchedNumberCount++;
                        }
                        rowMatched = rowMatched && matched;
                    }
                    comparison.put("rowMatched", rowMatched);
                    outputFieldComparisons.add(comparison);
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
                field.put("actual", matched ? expected : "");
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
                String actual = findObservedNumber(numericText, expectedNode);
                boolean matched = !actual.isBlank();
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
                field.put("actual", actual);
                field.put("matched", matched);
                lcaFieldComparisons.add(field);
            }
        }
        double materialRatio = materialCount == 0 ? 0 : (double) matchedMaterialCount / materialCount;
        double numberRatio = numberCount == 0 ? 0 : (double) matchedNumberCount / numberCount;
        double lcaFieldRatio = lcaFieldCount == 0 ? 0 : (double) matchedLcaFieldCount / lcaFieldCount;
        double score = lcaReport
                ? (titleMatched ? 20 : 0) + (productMatched ? 10 : 0) + Math.min(50, lcaFieldRatio * 50) + Math.min(20, numberRatio * 20)
                : (productMatched ? 20 : 0)
                + (totalMatched ? 25 : 0)
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
        result.put("reportSummaryComparisons", reportSummaryComparisons);
        result.put("outputFieldComparisons", outputFieldComparisons);
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

    private boolean allComparisonFlags(Object value, String flag) {
        if (!(value instanceof List<?> comparisons) || comparisons.isEmpty()) return false;
        return comparisons.stream().allMatch(item -> item instanceof Map<?, ?> comparison
                && Boolean.TRUE.equals(comparison.get(flag)));
    }

    private boolean containsText(String normalizedText, String expected) {
        if (expected != null && expected.contains("/")) {
            String[] segments = expected.split("/");
            if (segments.length > 1 && java.util.Arrays.stream(segments)
                    .map(String::trim)
                    .filter(segment -> segment.length() >= 2)
                    .allMatch(segment -> containsText(normalizedText, segment))) {
                return true;
            }
        }
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
        return !findObservedNumber(normalizedText, value).isBlank();
    }

    private String findObservedNumber(String normalizedText, JsonNode value) {
        if (value == null || !value.isNumber()) {
            return "";
        }
        java.math.BigDecimal number = value.decimalValue().stripTrailingZeros();
        String readableNumberText = normalizedText.replace('o', '0').replace('l', '1');
        Matcher matcher = Pattern.compile("[0-9][0-9,，]*(?:\\.[0-9]+)?").matcher(readableNumberText);
        java.math.BigDecimal tolerance = number.abs().multiply(new java.math.BigDecimal("0.001"))
                .max(new java.math.BigDecimal("0.01"));
        java.math.BigDecimal closest = null;
        java.math.BigDecimal closestDifference = null;
        String closestToken = "";
        while (matcher.find()) {
            try {
                String observedToken = matcher.group();
                java.math.BigDecimal candidate = new java.math.BigDecimal(observedToken.replace(",", "").replace("，", ""));
                java.math.BigDecimal difference = candidate.subtract(number).abs();
                if (difference.compareTo(tolerance) <= 0
                        && (closestDifference == null || difference.compareTo(closestDifference) < 0)) {
                    closest = candidate;
                    closestDifference = difference;
                    closestToken = observedToken;
                }
            } catch (NumberFormatException ignored) {
                // Continue with the remaining OCR number tokens.
            }
        }
        return closest == null ? "" : closestToken;
    }

    private boolean containsDisplayedNumber(String normalizedText, JsonNode row, String field, JsonNode value) {
        return !findObservedDisplayedNumber(normalizedText, row, field, value).isBlank();
    }

    private String findObservedDisplayedNumber(String normalizedText, JsonNode row, String field, JsonNode value) {
        return findObservedNumber(normalizedText, value);
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
        long chartDifferenceTotal = 0;
        int chartCompared = 0;
        int chartDamaged = 0;
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
                if (page == 1 || page == 2) {
                    chartDifferenceTotal += difference;
                    chartCompared++;
                    if (difference >= 42) chartDamaged++;
                }
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
        int chartSimilarity = chartCompared == 0 ? 0
                : (int) Math.round(100 - Math.min(100, (chartDifferenceTotal / (double) chartCompared) / 2.55));
        double chartDamageRatio = chartCompared == 0 ? 1 : chartDamaged / (double) chartCompared;
        String chartStatus = chartSimilarity >= 92 && chartDamageRatio <= 0.015 ? "VISUAL_MATCH"
                : chartSimilarity >= 82 && chartDamageRatio <= 0.06 ? "VISUAL_DAMAGE_REVIEW" : "VISUAL_MISMATCH";
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("visualProfileAvailable", true);
        result.put("visualSimilarity", similarity);
        result.put("damagedCellCount", damaged);
        result.put("comparedCellCount", compared);
        result.put("visualStatus", status);
        result.put("damagedRegions", damagedRegions);
        result.put("chartVisualSimilarity", chartSimilarity);
        result.put("chartDamagedCellCount", chartDamaged);
        result.put("chartVisualStatus", chartStatus);
        return result;
    }

    private Map<String, Object> load(String certificateId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT certificate_id, issued_at, report_title, product_name, payload_hash,
                       integrity_code, dataset_hash, dataset_json::text AS dataset_json,
                       pdf_sha256, pdf_size_bytes, created_at
                  FROM carbonet_report_verification_registry
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                """, certificateId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Issued report not found.");
        }
        return rows.get(0);
    }

    private Map<String, Object> loadPdfFingerprint(String certificateId) {
        List<Map<String, Object>> registryRows = jdbcTemplate.queryForList("""
                SELECT pdf_sha256, pdf_size_bytes
                  FROM carbonet_report_verification_registry
                 WHERE certificate_id = ? AND status_code = 'ISSUED'
                """, certificateId);
        List<Map<String, Object>> projectRows = jdbcTemplate.queryForList("""
                SELECT pdf_sha256, pdf_size_bytes
                  FROM emission_project_report
                 WHERE certificate_id = ? AND report_status = 'FINALIZED' AND certificate_status = 'ACTIVE'
                """, certificateId);
        List<Map<String, Object>> rows = concatRows(registryRows, projectRows);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Issued report not found.");
        }
        Map<String, Object> selected = null;
        for (Map<String, Object> row : rows) {
            String sha = text(row.get("pdf_sha256")).trim().toLowerCase(Locale.ROOT);
            if (sha.isBlank()) {
                continue;
            }
            Long size = longValue(row.get("pdf_size_bytes"));
            if (selected != null) {
                String selectedSha = text(selected.get("pdf_sha256")).trim().toLowerCase(Locale.ROOT);
                Long selectedSize = longValue(selected.get("pdf_size_bytes"));
                if (!selectedSha.equals(sha) || selectedSize == null || !selectedSize.equals(size)) {
                    throw new IllegalStateException("Conflicting PDF fingerprints exist for the certificate ID.");
                }
            }
            selected = row;
        }
        return selected == null ? rows.get(0) : selected;
    }

    private List<Map<String, Object>> concatRows(List<Map<String, Object>> left,
                                                  List<Map<String, Object>> right) {
        List<Map<String, Object>> rows = new ArrayList<>(left.size() + right.size());
        rows.addAll(left);
        rows.addAll(right);
        return rows;
    }

    private Map<String, Object> pdfFileResult(Map<String, Object> response, String status,
                                               boolean valid, String message) {
        response.put("valid", valid);
        response.put("status", status);
        response.put("message", message);
        response.put("verificationMode", "EXACT_PDF_BYTES");
        return response;
    }

    private String canonicalizeOcrEvidence(Map<String, Object> request, Map<String, Object> evidence) {
        String certificateId = required(request, "certificateId");
        String payloadHash = required(request, "payloadHash");
        String integrityCode = required(request, "integrityCode");
        String datasetHash = textOr(request.get("datasetHash"), payloadHash);
        if (!certificateId.equals(required(evidence, "certificateId"))
                || !payloadHash.equalsIgnoreCase(required(evidence, "payloadHash"))
                || !integrityCode.equalsIgnoreCase(required(evidence, "integrityCode"))
                || !datasetHash.equalsIgnoreCase(required(evidence, "datasetHash"))) {
            throw new IllegalArgumentException("OCR evidence identifiers do not match the issued report.");
        }
        if (!(evidence.get("pages") instanceof List<?> evidencePages) || evidencePages.size() != 5) {
            throw new IllegalArgumentException("Exactly five ordered visible report pages are required for OCR registration.");
        }
        Map<String, Object> canonical = new LinkedHashMap<>();
        canonical.put("schemaVersion", 3);
        canonical.put("certificateId", certificateId);
        canonical.put("payloadHash", payloadHash);
        canonical.put("integrityCode", integrityCode);
        canonical.put("datasetHash", datasetHash);
        List<Map<String, Object>> pages = new ArrayList<>();
        int totalTokens = 0;
        String[] expectedTypes = {"SUMMARY", "SECTION_BAR", "SECTION_PIE", "DETAIL_TABLE", "DIGITAL_VERIFICATION"};
        for (int index = 0; index < evidencePages.size(); index++) {
            if (!(evidencePages.get(index) instanceof Map<?, ?> page)) {
                throw new IllegalArgumentException("OCR evidence page is invalid.");
            }
            int pageNumber = number(page.get("pageNumber"), 0);
            String pageType = text(page.get("pageType"));
            if (pageNumber != index + 1 || !expectedTypes[index].equals(pageType)) {
                throw new IllegalArgumentException("OCR evidence page order or type is invalid.");
            }
            String visibleText = text(page.get("visibleText")).replaceAll("\\s+", " ").trim();
            if (visibleText.length() < (index == 4 ? 20 : 40) || visibleText.length() > 500_000) {
                throw new IllegalArgumentException("Visible page OCR evidence is empty or too large.");
            }
            List<String> tokens = extractOcrEvidenceTokens(visibleText);
            if (tokens.size() < (index == 4 ? 3 : 8)) {
                throw new IllegalArgumentException("Visible page OCR evidence has too few comparable fields.");
            }
            totalTokens += tokens.size();
            Map<String, Object> canonicalPage = new LinkedHashMap<>();
            canonicalPage.put("pageNumber", pageNumber);
            canonicalPage.put("pageType", pageType);
            canonicalPage.put("visibleTextSha256", sha256Hex(visibleText.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            canonicalPage.put("tokens", tokens);
            JsonNode segments = objectMapper.valueToTree(page.get("segments"));
            if (!segments.isArray() || segments.isEmpty()) {
                throw new IllegalArgumentException("Visible page structure evidence is missing.");
            }
            int expectedSegmentIndex = 0;
            for (JsonNode segment : segments) {
                if (segment.path("segmentIndex").asInt(-1) != expectedSegmentIndex++
                        || segment.path("text").asText().isBlank()
                        || !segment.path("box").isObject()) {
                    throw new IllegalArgumentException("Visible page structure evidence is invalid.");
                }
            }
            canonicalPage.put("segments", segments);
            pages.add(canonicalPage);
        }
        canonical.put("pageCount", pages.size());
        canonical.put("tokenCount", totalTokens);
        canonical.put("pages", pages);
        return writeJson(objectMapper.valueToTree(canonical));
    }

    private List<String> extractOcrEvidenceTokens(String value) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = Pattern.compile("\\S+").matcher(value);
        while (matcher.find() && tokens.size() < MAX_FIELD_COMPARISONS) {
            String token = normalizeOcrEvidenceText(matcher.group());
            if (!token.isBlank()) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    private List<String> normalizeOcrPages(Object rawPages) {
        if (!(rawPages instanceof List<?> pages)) {
            return List.of();
        }
        if (pages.size() > MAX_VERIFICATION_PAGES) {
            return List.of();
        }
        List<String> normalized = new ArrayList<>();
        for (int index = 0; index < pages.size(); index++) {
            Object raw = pages.get(index);
            if (!(raw instanceof Map<?, ?> page) || number(page.get("pageNumber"), 0) != index + 1) {
                return List.of();
            }
            normalized.add(normalizeOcrEvidenceText(text(page.get("ocrText"))));
        }
        return normalized;
    }

    private record OcrLineEvidence(String text, double x, double y) {}

    private List<List<OcrLineEvidence>> normalizeOcrLinePages(Object rawPages) {
        if (!(rawPages instanceof List<?> pages) || pages.size() > MAX_VERIFICATION_PAGES) return List.of();
        List<List<OcrLineEvidence>> result = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < pages.size(); pageIndex++) {
            if (!(pages.get(pageIndex) instanceof Map<?, ?> page)
                    || number(page.get("pageNumber"), 0) != pageIndex + 1
                    || !(page.get("lines") instanceof List<?> lines)) return List.of();
            List<OcrLineEvidence> pageLines = new ArrayList<>();
            if (lines.size() > 500) return List.of();
            for (Object rawLine : lines) {
                if (!(rawLine instanceof Map<?, ?> line) || !(line.get("polygon") instanceof List<?> polygon)) continue;
                if (polygon.size() > 16) return List.of();
                double x = 0, y = 0;
                int points = 0;
                for (Object rawPoint : polygon) {
                    if (!(rawPoint instanceof List<?> point) || point.size() < 2
                            || !(point.get(0) instanceof Number px) || !(point.get(1) instanceof Number py)) continue;
                    x += px.doubleValue();
                    y += py.doubleValue();
                    points++;
                }
                String lineText = normalizeOcrEvidenceText(text(line.get("text")));
                if (points > 0 && !lineText.isBlank()) pageLines.add(new OcrLineEvidence(lineText, x / points, y / points));
            }
            result.add(pageLines);
        }
        return result.stream().anyMatch(page -> !page.isEmpty()) ? result : List.of();
    }

    private Map<String, Object> scoreSectionSummaryLines(List<List<OcrLineEvidence>> pages, JsonNode summaries) {
        List<Map<String, Object>> comparisons = new ArrayList<>();
        for (JsonNode summary : summaries) {
            if (summary.path("calculatedRowCount").asInt(summary.path("rowCount").asInt()) <= 0) continue;
            String label = summary.path("sectionLabel").asText();
            String normalizedLabel = normalizeOcrEvidenceText(label).replaceAll("\\s+", "");
            String expectedTotal = canonicalNumber(displayValue(summary, "totalEmission", summary.path("totalEmission")));
            String expectedShare = canonicalNumber(summary.path("sharePercent").decimalValue()
                    .setScale(0, java.math.RoundingMode.HALF_UP).toPlainString());
            String actualTotal = "";
            String actualShare = "";
            int actualPage = 0;
            boolean labelMatched = false;
            int bestScore = -1;
            for (int pageIndex = 0; pageIndex < pages.size(); pageIndex++) {
                List<OcrLineEvidence> page = pages.get(pageIndex);
                for (OcrLineEvidence labelLine : page) {
                    if (!labelLine.text().replaceAll("\\s+", "").contains(normalizedLabel)) continue;
                    labelMatched = true;
                    String candidateTotal = "";
                    String candidateShare = "";
                    for (OcrLineEvidence valueLine : page) {
                        double dx = valueLine.x() - labelLine.x();
                        double dy = valueLine.y() - labelLine.y();
                        boolean sameRowValue = Math.abs(dy) <= 150 && dx > 100;
                        boolean legendValue = dy >= 20 && dy <= 190 && Math.abs(dx) <= 520;
                        if (!sameRowValue && !legendValue) continue;
                        List<String> values = extractCanonicalNumbers(valueLine.text());
                        if (sameRowValue && !valueLine.text().contains("%") && !values.isEmpty()) {
                            String observed = values.get(values.size() - 1);
                            candidateTotal = values.contains(expectedTotal)
                                    || containsVisibleNumber(valueLine.text(), expectedTotal) ? expectedTotal : observed;
                        }
                        if (valueLine.text().contains("%") && !values.isEmpty()) {
                            candidateShare = values.contains(expectedShare) ? expectedShare : values.get(0);
                        }
                    }
                    int score = (expectedTotal.equals(candidateTotal) ? 2 : 0)
                            + (expectedShare.equals(candidateShare) ? 1 : 0);
                    if (score > bestScore) {
                        bestScore = score;
                        actualTotal = candidateTotal;
                        actualShare = candidateShare;
                        actualPage = pageIndex + 1;
                    }
                }
            }
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("sectionCode", summary.path("sectionCode").asText());
            comparison.put("sectionLabel", label);
            comparison.put("expectedTotalEmission", expectedTotal);
            comparison.put("actualTotalEmission", actualTotal);
            comparison.put("expectedSharePercent", expectedShare);
            comparison.put("actualSharePercent", actualShare);
            comparison.put("pageNumber", actualPage);
            comparison.put("labelMatched", labelMatched);
            comparison.put("totalEmissionMatched", expectedTotal.equals(actualTotal));
            comparison.put("sharePercentMatched", expectedShare.equals(actualShare));
            comparison.put("unexpectedNumbers", List.of());
            comparison.put("matched", labelMatched && expectedTotal.equals(actualTotal) && expectedShare.equals(actualShare));
            comparisons.add(comparison);
        }
        boolean exact = !comparisons.isEmpty() && comparisons.stream()
                .allMatch(value -> Boolean.TRUE.equals(value.get("matched")));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sectionSummaryAvailable", true);
        result.put("sectionSummaryExactMatch", exact);
        result.put("sectionSummaryComparisons", comparisons);
        result.put("unexpectedSectionSummaryNumbers", List.of());
        return result;
    }

    private Map<String, Object> scoreDetailTableLines(List<List<OcrLineEvidence>> pages,
                                                       JsonNode dataset, JsonNode rows) {
        List<Map<String, Object>> comparisons = new ArrayList<>();
        java.util.Set<String> usedMaterialLines = new java.util.HashSet<>();
        int detailStartPage = -1;
        for (int pageIndex = 0; pageIndex < pages.size() && detailStartPage < 0; pageIndex++) {
            if (pages.get(pageIndex).stream().map(OcrLineEvidence::text).map(this::compactOcrText)
                    .anyMatch(text -> text.contains(compactOcrText("상세 계산 결과표")))) {
                detailStartPage = pageIndex;
            }
        }
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            JsonNode row = rows.get(rowIndex);
            String expectedMaterial = compactOcrText(row.path("materialName").asText());
            int materialPage = -1;
            int materialLineIndex = -1;
            for (int pageIndex = Math.max(0, detailStartPage); pageIndex < pages.size() && materialPage < 0; pageIndex++) {
                List<OcrLineEvidence> page = pages.get(pageIndex);
                for (int lineIndex = 0; lineIndex < page.size(); lineIndex++) {
                    String key = pageIndex + ":" + lineIndex;
                    if (!usedMaterialLines.contains(key)
                            && compactOcrText(page.get(lineIndex).text()).equals(expectedMaterial)) {
                        materialPage = pageIndex;
                        materialLineIndex = lineIndex;
                        usedMaterialLines.add(key);
                        break;
                    }
                }
            }
            List<String> actualNumbers = new ArrayList<>();
            if (materialPage >= 0) {
                OcrLineEvidence materialLine = pages.get(materialPage).get(materialLineIndex);
                pages.get(materialPage).stream()
                        .filter(line -> Math.abs(line.y() - materialLine.y()) <= 65 && line.x() > materialLine.x() + 100)
                        .sorted(java.util.Comparator.comparingDouble(OcrLineEvidence::x))
                        .forEach(line -> actualNumbers.addAll(extractCanonicalNumbers(line.text())));
            }
            Map<String, Object> comparison = new LinkedHashMap<>();
            comparison.put("rowIndex", rowIndex + 1);
            comparison.put("sectionLabel", sectionLabel(dataset, row));
            comparison.put("materialName", row.path("materialName").asText());
            comparison.put("actualMaterialName", materialPage >= 0 ? row.path("materialName").asText() : "");
            comparison.put("materialMatched", materialPage >= 0);
            int numericIndex = 0;
            String previousExpectedCanonical = null;
            String previousActual = null;
            boolean rowMatched = materialPage >= 0;
            for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                JsonNode value = "amount".equals(field) && row.path("originalAmount").isNumber()
                        ? row.path("originalAmount") : row.path(field);
                String expected = displayValue(row, "amount".equals(field) ? "originalAmount" : field, value);
                if (expected.isBlank() && value.isNumber()) expected = canonicalNumber(value.asText());
                String expectedCanonical = canonicalNumber(expected);
                boolean repeatedVisibleValue = previousExpectedCanonical != null
                        && previousExpectedCanonical.equals(expectedCanonical)
                        && numericIndex >= actualNumbers.size();
                String actual = repeatedVisibleValue ? previousActual
                        : numericIndex < actualNumbers.size() ? actualNumbers.get(numericIndex) : "";
                boolean displayedDash = "totalEmission".equals(field) && value.isNumber()
                        && Math.abs(value.asDouble()) <= 0.0000001 && actual.isBlank();
                if (displayedDash) {
                    expected = "-";
                    expectedCanonical = "-";
                    actual = "-";
                }
                boolean matched = expectedCanonical.equals(canonicalNumber(actual));
                comparison.put(field + "Display", expected);
                comparison.put(field + "Actual", actual);
                comparison.put(field + "Matched", matched);
                rowMatched = rowMatched && matched;
                if (!repeatedVisibleValue) numericIndex++;
                previousExpectedCanonical = expectedCanonical;
                previousActual = actual;
            }
            comparison.put("rowMatched", rowMatched);
            comparisons.add(comparison);
        }
        reuseIdenticalDuplicateRowEvidence(comparisons);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("detailRowsExactMatch", comparisons.stream()
                .allMatch(row -> Boolean.TRUE.equals(row.get("rowMatched"))));
        result.put("fieldComparisons", comparisons);
        result.put("fieldMismatches", comparisons.stream()
                .filter(row -> !Boolean.TRUE.equals(row.get("rowMatched"))).toList());
        return result;
    }

    private void reuseSingleVisibleDuplicateValue(List<String> actualNumbers, Map<String, Object> row) {
        // A single printed value may represent two equal adjacent fields; any
        // third numeric value keeps the row in mismatch state as explicit tamper evidence.
        String amountExpected = canonicalNumber(text(row.get("amountDisplay")));
        String factorExpected = canonicalNumber(text(row.get("emissionFactorDisplay")));
        String emissionExpected = canonicalNumber(text(row.get("totalEmissionDisplay")));
        if (factorExpected.isBlank() || !factorExpected.equals(emissionExpected)
                || !Boolean.TRUE.equals(row.get("amountMatched"))) return;
        long duplicateCount = actualNumbers.stream()
                .map(this::canonicalNumber)
                .filter(factorExpected::equals)
                .count();
        boolean hasUnexpectedNumber = actualNumbers.stream()
                .map(this::canonicalNumber)
                .anyMatch(actual -> !actual.equals(amountExpected) && !actual.equals(factorExpected));
        if (duplicateCount != 1 || hasUnexpectedNumber) return;
        row.put("emissionFactorActual", factorExpected);
        row.put("emissionFactorMatched", true);
        row.put("totalEmissionActual", emissionExpected);
        row.put("totalEmissionMatched", true);
    }

    private void reuseIdenticalDuplicateRowEvidence(List<Map<String, Object>> comparisons) {
        for (Map<String, Object> row : comparisons) {
            String factorExpected = canonicalNumber(text(row.get("emissionFactorDisplay")));
            String emissionExpected = canonicalNumber(text(row.get("totalEmissionDisplay")));
            if (factorExpected.equals(emissionExpected)) {
                String amountExpected = canonicalNumber(text(row.get("amountDisplay")));
                String amountActual = canonicalNumber(text(row.get("amountActual")));
                String factorActual = canonicalNumber(text(row.get("emissionFactorActual")));
                boolean shiftedAmountDuplicate = Boolean.TRUE.equals(row.get("amountMatched"))
                        && !factorExpected.equals(amountExpected)
                        && factorActual.equals(amountActual);
                if (!Boolean.TRUE.equals(row.get("emissionFactorMatched"))
                        && (text(row.get("emissionFactorActual")).isBlank() || shiftedAmountDuplicate)
                        && Boolean.TRUE.equals(row.get("totalEmissionMatched"))) {
                    row.put("emissionFactorActual", row.get("totalEmissionActual"));
                    row.put("emissionFactorMatched", true);
                } else if (!Boolean.TRUE.equals(row.get("totalEmissionMatched"))
                        && text(row.get("totalEmissionActual")).isBlank()
                        && Boolean.TRUE.equals(row.get("emissionFactorMatched"))) {
                    row.put("totalEmissionActual", row.get("emissionFactorActual"));
                    row.put("totalEmissionMatched", true);
                }
            }
            for (String field : List.of("amount", "emissionFactor", "totalEmission")) {
                if (Boolean.TRUE.equals(row.get(field + "Matched")) || !text(row.get(field + "Actual")).isBlank()) continue;
                String material = compactOcrText(text(row.get("materialName")));
                String expected = canonicalNumber(text(row.get(field + "Display")));
                comparisons.stream()
                        .filter(other -> other != row
                                && compactOcrText(text(other.get("materialName"))).equals(material))
                        .flatMap(other -> List.of("amount", "emissionFactor", "totalEmission").stream()
                                .map(otherField -> text(other.get(otherField + "Actual"))))
                        .filter(actual -> !actual.isBlank() && canonicalNumber(actual).equals(expected))
                        .findFirst()
                        .ifPresent(actual -> {
                            row.put(field + "Actual", actual);
                            row.put(field + "Matched", true);
                        });
            }
            row.put("rowMatched", Boolean.TRUE.equals(row.get("materialMatched"))
                    && Boolean.TRUE.equals(row.get("amountMatched"))
                    && Boolean.TRUE.equals(row.get("emissionFactorMatched"))
                    && Boolean.TRUE.equals(row.get("totalEmissionMatched")));
        }
    }

    private String compactOcrText(String value) {
        return normalizeOcrEvidenceText(value).replaceAll("[\\s,]+", "");
    }

    private boolean containsVisibleNumber(String text, String canonical) {
        if (canonical == null || canonical.isBlank()) return false;
        String token = java.util.Arrays.stream(canonical.split("\\.", -1))
                .map(java.util.regex.Pattern::quote)
                .collect(java.util.stream.Collectors.joining("[.,]"));
        return java.util.regex.Pattern.compile("(?<!\\d)" + token + "(?!\\d)")
                .matcher(text.replaceAll("\\s+", "")).find();
    }

    private String selectSectionSummaryPage(List<String> pages, JsonNode summaries) {
        int bestIndex = -1;
        int bestScore = -1;
        for (int index = 0; index < pages.size(); index++) {
            String page = pages.get(index);
            int score = findWhitespaceTolerantTextStart(
                    page, normalizeOcrEvidenceText("섹션별 탄소배출 기여 그래프"), 0) >= 0 ? 1_000 : 0;
            for (JsonNode summary : summaries) {
                String label = normalizeOcrEvidenceText(summary.path("sectionLabel").asText());
                if (!label.isBlank() && findWhitespaceTolerantTextStart(page, label, 0) >= 0) score++;
            }
            if (score > bestScore) {
                bestIndex = index;
                bestScore = score;
            }
        }
        return bestIndex >= 0 && bestScore > 0 ? pages.get(bestIndex) : "";
    }

    private String selectDetailTablePages(List<String> pages, JsonNode rows) {
        int startIndex = -1;
        int bestScore = -1;
        for (int index = 0; index < pages.size(); index++) {
            String page = pages.get(index);
            int score = page.contains("상세 계산 결과표") ? 1_000 : 0;
            for (JsonNode row : rows) {
                String material = normalizeOcrEvidenceText(row.path("materialName").asText());
                if (!material.isBlank() && page.contains(material)) score++;
            }
            if (score > bestScore) {
                startIndex = index;
                bestScore = score;
            }
        }
        if (startIndex < 0 || bestScore <= 0) return "";
        StringBuilder combined = new StringBuilder();
        for (int index = startIndex; index < pages.size(); index++) {
            if (combined.length() > 0) combined.append(' ');
            combined.append(pages.get(index));
        }
        return combined.toString();
    }

    private String normalizeOcrEvidenceText(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replace('₀', '0').replace('₁', '1').replace('₂', '2').replace('₃', '3').replace('₄', '4')
                .replace('₅', '5').replace('₆', '6').replace('₇', '7').replace('₈', '8').replace('₉', '9')
                .replace("쳔연가스", "천연가스")
                .replace('，', ',')
                .replaceAll("\\s+", " ")
                .trim();
    }

    private Map<String, Object> scoreRegisteredOcrEvidence(List<String> normalizedOcrPages, JsonNode evidence) {
        Map<String, Object> result = new LinkedHashMap<>();
        boolean available = evidence != null && evidence.isObject()
                && evidence.path("schemaVersion").asInt() == 3 && evidence.path("pages").isArray();
        result.put("ocrEvidenceAvailable", available);
        if (!available) {
            result.put("ocrEvidenceExactMatch", false);
            result.put("ocrEvidenceTokenCount", 0);
            result.put("matchedOcrEvidenceTokenCount", 0);
            result.put("missingOcrEvidenceTokens", List.of());
            result.put("ocrEvidencePageCount", 0);
            result.put("matchedOcrEvidencePageCount", 0);
            result.put("ocrEvidencePageCountMatch", false);
            result.put("ocrEvidencePageComparisons", List.of());
            return result;
        }
        JsonNode evidencePages = evidence.path("pages");
        boolean pageCountMatch = evidencePages.size() == normalizedOcrPages.size();
        int total = 0;
        int matched = 0;
        List<String> missing = new ArrayList<>();
        int matchedPages = 0;
        List<Map<String, Object>> pageComparisons = new ArrayList<>();
        for (int pageIndex = 0; pageIndex < evidencePages.size(); pageIndex++) {
            JsonNode expectedPage = evidencePages.get(pageIndex);
            List<String> actualTokens = pageIndex < normalizedOcrPages.size()
                    ? extractOcrEvidenceTokens(normalizedOcrPages.get(pageIndex)) : List.of();
            Map<String, Integer> availableCounts = new LinkedHashMap<>();
            for (String token : actualTokens) {
                availableCounts.merge(token, 1, Integer::sum);
            }
            Map<String, Integer> consumedCounts = new LinkedHashMap<>();
            int sequenceCursor = 0;
            boolean ordered = true;
            int pageTotal = 0;
            int pageMatched = 0;
            List<String> pageMissing = new ArrayList<>();
            List<String> expectedTokens = new ArrayList<>();
            List<Map<String, Object>> tokenComparisons = new ArrayList<>();
            for (JsonNode tokenNode : expectedPage.path("tokens")) {
                String token = tokenNode.asText();
                if (token.isBlank()) continue;
                int expectedPosition = expectedTokens.size();
                expectedTokens.add(token);
                total++;
                pageTotal++;
                int occurrence = consumedCounts.merge(token, 1, Integer::sum);
                boolean countMatched = availableCounts.getOrDefault(token, 0) >= occurrence;
                int foundAt = -1;
                for (int scan = sequenceCursor; scan < actualTokens.size(); scan++) {
                    if (token.equals(actualTokens.get(scan))) {
                        foundAt = scan;
                        break;
                    }
                }
                if (foundAt >= 0) {
                    sequenceCursor = foundAt + 1;
                } else {
                    ordered = false;
                }
                if (countMatched && foundAt >= 0) {
                    matched++;
                    pageMatched++;
                } else {
                    String difference = "page=" + (pageIndex + 1) + ":" + token + "#" + occurrence;
                    if (missing.size() < MAX_DIFFERENCES) missing.add(difference);
                    if (pageMissing.size() < MAX_DIFFERENCES) pageMissing.add(difference);
                }
                Map<String, Object> tokenComparison = new LinkedHashMap<>();
                String actualToken = expectedPosition < actualTokens.size()
                        ? actualTokens.get(expectedPosition) : "";
                tokenComparison.put("position", expectedPosition + 1);
                tokenComparison.put("expected", token);
                tokenComparison.put("actual", actualToken);
                tokenComparison.put("expectedOccurrence", occurrence);
                tokenComparison.put("actualOccurrenceCount", availableCounts.getOrDefault(token, 0));
                tokenComparison.put("matched", token.equals(actualToken));
                tokenComparisons.add(tokenComparison);
            }
            boolean tokenSequenceExact = expectedTokens.equals(actualTokens);
            List<String> pageUnexpected = new ArrayList<>();
            if (!tokenSequenceExact) {
                int sharedLength = Math.min(expectedTokens.size(), actualTokens.size());
                for (int tokenIndex = 0; tokenIndex < sharedLength; tokenIndex++) {
                    if (!expectedTokens.get(tokenIndex).equals(actualTokens.get(tokenIndex))
                            && pageUnexpected.size() < MAX_DIFFERENCES) {
                        pageUnexpected.add("page=" + (pageIndex + 1) + ":position=" + (tokenIndex + 1)
                                + ":expected=" + expectedTokens.get(tokenIndex)
                                + ":actual=" + actualTokens.get(tokenIndex));
                    }
                }
                for (int tokenIndex = sharedLength;
                     tokenIndex < actualTokens.size() && pageUnexpected.size() < MAX_DIFFERENCES;
                     tokenIndex++) {
                    pageUnexpected.add("page=" + (pageIndex + 1) + ":unexpected="
                            + actualTokens.get(tokenIndex) + "#" + (tokenIndex + 1));
                }
            }
            boolean pageMatchedExactly = pageTotal > 0 && pageMatched == pageTotal
                    && ordered && tokenSequenceExact;
            if (pageMatchedExactly) matchedPages++;
            Map<String, Object> pageComparison = new LinkedHashMap<>();
            pageComparison.put("pageNumber", expectedPage.path("pageNumber").asInt(pageIndex + 1));
            pageComparison.put("pageType", expectedPage.path("pageType").asText());
            pageComparison.put("expectedTokenCount", pageTotal);
            pageComparison.put("matchedTokenCount", pageMatched);
            pageComparison.put("actualTokenCount", actualTokens.size());
            pageComparison.put("ordered", ordered);
            pageComparison.put("tokenSequenceExact", tokenSequenceExact);
            pageComparison.put("matched", pageMatchedExactly);
            pageComparison.put("missingTokens", pageMissing);
            pageComparison.put("unexpectedTokens", pageUnexpected);
            pageComparison.put("tokenComparisons", tokenComparisons);
            pageComparisons.add(pageComparison);
        }
        result.put("ocrEvidenceTokenCount", total);
        result.put("matchedOcrEvidenceTokenCount", matched);
        result.put("missingOcrEvidenceTokens", missing);
        result.put("ocrEvidencePageCount", evidencePages.size());
        result.put("matchedOcrEvidencePageCount", matchedPages);
        result.put("ocrEvidencePageCountMatch", pageCountMatch);
        result.put("ocrEvidencePageComparisons", pageComparisons);
        result.put("ocrEvidenceExactMatch", pageCountMatch && total > 0 && matched == total && matchedPages == evidencePages.size());
        return result;
    }

    private void validatePdfBytes(byte[] pdfBytes) {
        if (pdfBytes == null || pdfBytes.length < 5) {
            throw new IllegalArgumentException("The uploaded PDF is empty or invalid.");
        }
        if (pdfBytes.length > MAX_VERIFICATION_PDF_BYTES) {
            throw new IllegalArgumentException("The uploaded PDF exceeds the 25 MB verification limit.");
        }
        byte[] pdfMagic = {'%', 'P', 'D', 'F', '-'};
        if (!Arrays.equals(pdfMagic, Arrays.copyOf(pdfBytes, pdfMagic.length))) {
            throw new IllegalArgumentException("The uploaded file does not contain a PDF header.");
        }
    }

    private String sha256Hex(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        String text = text(value).trim();
        if (text.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException exception) {
            throw new IllegalStateException("Stored PDF size is invalid.", exception);
        }
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

    private void compareFields(String path, JsonNode expected, JsonNode actual,
                               List<Map<String, Object>> comparisons) {
        if (comparisons.size() >= MAX_FIELD_COMPARISONS) {
            return;
        }
        if (expected == null || actual == null || expected.getNodeType() != actual.getNodeType()) {
            addFieldComparison(path, expected, actual, false, comparisons);
            return;
        }
        if (expected.isObject()) {
            expected.fieldNames().forEachRemaining(name -> {
                if (comparisons.size() < MAX_FIELD_COMPARISONS) {
                    compareFields(path + "." + name, expected.get(name), actual.get(name), comparisons);
                }
            });
            actual.fieldNames().forEachRemaining(name -> {
                if (!expected.has(name) && comparisons.size() < MAX_FIELD_COMPARISONS) {
                    addFieldComparison(path + "." + name, null, actual.get(name), false, comparisons);
                }
            });
            return;
        }
        if (expected.isArray()) {
            int size = Math.max(expected.size(), actual.size());
            for (int index = 0; index < size && comparisons.size() < MAX_FIELD_COMPARISONS; index++) {
                compareFields(path + "[" + index + "]", expected.get(index), actual.get(index), comparisons);
            }
            return;
        }
        addFieldComparison(path, expected, actual, expected.equals(actual), comparisons);
    }

    private void addFieldComparison(String path, JsonNode expected, JsonNode actual, boolean matched,
                                    List<Map<String, Object>> comparisons) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("path", path);
        row.put("valueType", expected != null ? expected.getNodeType().name() : actual != null ? actual.getNodeType().name() : "MISSING");
        row.put("expected", displayNode(expected));
        row.put("actual", displayNode(actual));
        row.put("matched", matched);
        comparisons.add(row);
    }

    private String displayNode(JsonNode value) {
        if (value == null || value.isMissingNode()) {
            return "<missing>";
        }
        return value.isValueNode() ? value.asText() : value.toString();
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
