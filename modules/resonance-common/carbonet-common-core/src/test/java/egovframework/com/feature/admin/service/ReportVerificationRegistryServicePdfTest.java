package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
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
