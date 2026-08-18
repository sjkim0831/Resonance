package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.lang.reflect.Method;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportVerificationRegistryServicePdfTest {

    private static final String CERTIFICATE_ID = "CRN-20260814-63FE68D8B64E";
    private static final byte[] ORIGINAL_PDF = "%PDF-1.7\nissued carbon report\n%%EOF\n"
            .getBytes(StandardCharsets.US_ASCII);
    private static final byte[] TAMPERED_PDF = "%PDF-1.7\nissued carbon report\n1.62 kg CO2e\n%%EOF\n"
            .getBytes(StandardCharsets.US_ASCII);

    @Test
    void exactIssuedPdfMatchesAndAddedTextIsAlwaysTampered() throws Exception {
        FingerprintJdbcTemplate jdbc = new FingerprintJdbcTemplate();
        jdbc.projectRows.add(fingerprintRow(ORIGINAL_PDF));
        ReportVerificationRegistryService service = service(jdbc);

        Map<String, Object> original = service.verifyPdfFile(CERTIFICATE_ID, ORIGINAL_PDF);
        Map<String, Object> tampered = service.verifyPdfFile(CERTIFICATE_ID, TAMPERED_PDF);

        assertEquals("EXACT_PDF_MATCH", original.get("status"));
        assertTrue((Boolean) original.get("valid"));
        assertTrue((Boolean) original.get("byteHashMatch"));
        assertEquals("TAMPERED_PDF", tampered.get("status"));
        assertFalse((Boolean) tampered.get("valid"));
        assertFalse((Boolean) tampered.get("byteHashMatch"));
    }

    @Test
    void legacyRecordWithoutFinalPdfFingerprintFailsClosed() {
        FingerprintJdbcTemplate jdbc = new FingerprintJdbcTemplate();
        jdbc.registryRows.add(new LinkedHashMap<>());

        Map<String, Object> result = service(jdbc).verifyPdfFile(CERTIFICATE_ID, ORIGINAL_PDF);

        assertEquals("PDF_FINGERPRINT_UNAVAILABLE", result.get("status"));
        assertFalse((Boolean) result.get("valid"));
    }

    @Test
    void missingCertificateAndNonPdfNeverBecomeValid() {
        FingerprintJdbcTemplate jdbc = new FingerprintJdbcTemplate();
        ReportVerificationRegistryService service = service(jdbc);

        Map<String, Object> missing = service.verifyPdfFile(CERTIFICATE_ID, ORIGINAL_PDF);
        Map<String, Object> invalid = service.verifyPdfFile(CERTIFICATE_ID,
                "not a pdf".getBytes(StandardCharsets.US_ASCII));

        assertEquals("NOT_FOUND", missing.get("status"));
        assertEquals("INVALID_PDF", invalid.get("status"));
        assertFalse((Boolean) missing.get("valid"));
        assertFalse((Boolean) invalid.get("valid"));
    }

    @Test
    void administratorCanBindAnActiveLegacyCertificateOnlyOnce() throws Exception {
        FingerprintJdbcTemplate unbound = new FingerprintJdbcTemplate();
        unbound.projectRows.add(new LinkedHashMap<>());

        Map<String, Object> bound = service(unbound)
                .bindIssuedPdfFingerprint(CERTIFICATE_ID, ORIGINAL_PDF, "certificate-admin");

        assertEquals("PDF_FINGERPRINT_BOUND", bound.get("status"));
        assertEquals(1, unbound.updateCount);
        assertEquals(sha256(ORIGINAL_PDF), bound.get("pdfSha256"));

        FingerprintJdbcTemplate alreadyBound = new FingerprintJdbcTemplate();
        alreadyBound.projectRows.add(fingerprintRow(ORIGINAL_PDF));
        assertThrows(IllegalStateException.class, () -> service(alreadyBound)
                .bindIssuedPdfFingerprint(CERTIFICATE_ID, TAMPERED_PDF, "certificate-admin"));
        assertEquals(0, alreadyBound.updateCount);
    }

    @Test
    void conflictingRegistryAndProjectFingerprintsFailClosed() throws Exception {
        FingerprintJdbcTemplate jdbc = new FingerprintJdbcTemplate();
        jdbc.registryRows.add(fingerprintRow(ORIGINAL_PDF));
        jdbc.projectRows.add(fingerprintRow(TAMPERED_PDF));

        assertThrows(IllegalStateException.class,
                () -> service(jdbc).verifyPdfFile(CERTIFICATE_ID, ORIGINAL_PDF));
    }

    @Test
    @SuppressWarnings("unchecked")
    void ocrEvidenceRejectsAnOverlaidDuplicateValueEvenWhenEveryIssuedTokenRemains() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreRegisteredOcrEvidence", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        scorer.setAccessible(true);

        Map<String, Object> issuedPage = new LinkedHashMap<>();
        issuedPage.put("pageNumber", 2);
        issuedPage.put("pageType", "SECTION_BAR");
        issuedPage.put("tokens", List.of("에너지", "1.62", "kg", "co2e",
                "수계", "배출물", "0.36", "kg", "co2e"));
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("schemaVersion", 3);
        evidence.put("pages", List.of(issuedPage));

        Map<String, Object> exact = (Map<String, Object>) scorer.invoke(service,
                List.of("에너지 1.62 kg CO2e 수계 배출물 0.36 kg CO2e"),
                new ObjectMapper().valueToTree(evidence));
        Map<String, Object> overlaid = (Map<String, Object>) scorer.invoke(service,
                List.of("에너지 1.62 kg CO2e 수계 배출물 1.62 0.36 kg CO2e"),
                new ObjectMapper().valueToTree(evidence));

        assertTrue((Boolean) exact.get("ocrEvidenceExactMatch"));
        assertFalse((Boolean) overlaid.get("ocrEvidenceExactMatch"));
        Map<String, Object> comparison = (Map<String, Object>)
                ((List<?>) overlaid.get("ocrEvidencePageComparisons")).get(0);
        assertFalse((Boolean) comparison.get("tokenSequenceExact"));
        assertFalse(((List<?>) comparison.get("unexpectedTokens")).isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void sectionSummaryRejectsAnExtraOverlaidNumberThatExistsInAnotherSection() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        scorer.setAccessible(true);
        List<Map<String, Object>> summaries = new ArrayList<>();
        summaries.add(section("INPUT_ENERGY", "에너지", 1.62, 0, 3));
        summaries.add(section("OUTPUT_WATER", "수계 배출물", 0.36, 0, 2));
        Map<String, Object> dataset = Map.of("sectionSummaries", summaries);

        Map<String, Object> exact = (Map<String, Object>) scorer.invoke(service,
                List.of("page one", "에너지 1.62 kg CO2e 0% 수계 배출물 0.36 kg CO2e 0%"),
                new ObjectMapper().valueToTree(dataset));
        Map<String, Object> tampered = (Map<String, Object>) scorer.invoke(service,
                List.of("page one", "에너지 1.62 kg CO2e 0% 수계 배출물 0.36 1.62 kg CO2e 0%"),
                new ObjectMapper().valueToTree(dataset));

        assertTrue((Boolean) exact.get("sectionSummaryExactMatch"));
        assertFalse((Boolean) tampered.get("sectionSummaryExactMatch"));
        assertEquals(List.of("1.62"), tampered.get("unexpectedSectionSummaryNumbers"));
    }

    private static Map<String, Object> section(String code, String label, double total,
                                                double share, int rowCount) {
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("sectionCode", code);
        section.put("sectionLabel", label);
        section.put("totalEmission", total);
        section.put("sharePercent", share);
        section.put("calculatedRowCount", rowCount);
        return section;
    }

    private static ReportVerificationRegistryService service(FingerprintJdbcTemplate jdbc) {
        return new ReportVerificationRegistryService(jdbc, new ObjectMapper());
    }

    private static Map<String, Object> fingerprintRow(byte[] bytes) throws Exception {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("pdf_sha256", sha256(bytes));
        row.put("pdf_size_bytes", (long) bytes.length);
        return row;
    }

    private static String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static final class FingerprintJdbcTemplate extends JdbcTemplate {
        private final List<Map<String, Object>> registryRows = new ArrayList<>();
        private final List<Map<String, Object>> projectRows = new ArrayList<>();
        private int updateCount;

        @Override
        public List<Map<String, Object>> queryForList(String sql, Object... args) {
            return sql.contains("FROM emission_project_report") ? projectRows : registryRows;
        }

        @Override
        public int update(String sql, Object... args) {
            updateCount += 1;
            return 1;
        }
    }
}
