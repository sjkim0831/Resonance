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
        List<Map<String, Object>> tokenComparisons =
                (List<Map<String, Object>>) comparison.get("tokenComparisons");
        assertEquals(9, tokenComparisons.size());
        assertTrue((Boolean) tokenComparisons.get(0).get("matched"));
        assertEquals("0.36", tokenComparisons.get(6).get("expected"));
        assertEquals("1.62", tokenComparisons.get(6).get("actual"));
        assertFalse((Boolean) tokenComparisons.get(6).get("matched"));
        assertEquals(2, tokenComparisons.get(1).get("actualOccurrenceCount"));
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
        List<Map<String, Object>> comparisons =
                (List<Map<String, Object>>) tampered.get("sectionSummaryComparisons");
        assertTrue((Boolean) comparisons.get(0).get("matched"));
        assertEquals(List.of("1.62"), comparisons.get(1).get("unexpectedNumbers"));
        assertFalse((Boolean) comparisons.get(1).get("matched"));

        Map<String, Object> trailingOverlay = (Map<String, Object>) scorer.invoke(service,
                List.of("page one", "에너지 1.62 kg CO2e 0% 수계 배출물 0.36 kg CO2e 0% 1.62"),
                new ObjectMapper().valueToTree(dataset));
        List<Map<String, Object>> trailingComparisons =
                (List<Map<String, Object>>) trailingOverlay.get("sectionSummaryComparisons");
        assertEquals("0", trailingComparisons.get(1).get("actualSharePercent"));
        assertEquals(List.of("1.62"), trailingComparisons.get(1).get("unexpectedNumbers"));
        assertFalse((Boolean) trailingComparisons.get(1).get("matched"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void coordinateChartComparisonDoesNotBorrowExpectedValueFromAnotherSection() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method normalize = ReportVerificationRegistryService.class.getDeclaredMethod("normalizeOcrLinePages", Object.class);
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class, List.class);
        normalize.setAccessible(true);
        scorer.setAccessible(true);
        List<Map<String, Object>> chartLines = List.of(
                ocrLine("에너지", 200, 500), ocrLine("1.62 kg CO2e", 900, 500), ocrLine("0%", 900, 560),
                ocrLine("수계 배출물", 200, 900), ocrLine("1.62", 900, 900), ocrLine("kg CO2e", 990, 900),
                ocrLine("0%", 900, 960));
        List<Map<String, Object>> ocrPages = List.of(
                Map.of("pageNumber", 1, "ocrText", "cover", "lines", List.of()),
                Map.of("pageNumber", 2, "ocrText", "에너지 1.62 0% 수계 배출물 1.62 0%", "lines", chartLines));
        Object lines = normalize.invoke(service, ocrPages);
        Map<String, Object> dataset = Map.of("sectionSummaries", List.of(
                section("INPUT_ENERGY", "에너지", 1.62, 0, 3),
                section("OUTPUT_WATER", "수계 배출물", 0.36, 0, 2)));
        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                List.of("cover", "chart"), new ObjectMapper().valueToTree(dataset), lines);
        List<Map<String, Object>> comparisons =
                (List<Map<String, Object>>) result.get("sectionSummaryComparisons");
        assertTrue((Boolean) comparisons.get(0).get("matched"));
        assertEquals("1.62", comparisons.get(1).get("actualTotalEmission"));
        assertEquals(2, comparisons.get(1).get("pageNumber"));
        assertFalse((Boolean) comparisons.get(1).get("matched"));
        assertFalse((Boolean) result.get("sectionSummaryExactMatch"));
    }

    @Test
    void chartVisualStatusIgnoresNonChartPageRenderingNoise() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreVisualProfile", com.fasterxml.jackson.databind.JsonNode.class,
                com.fasterxml.jackson.databind.JsonNode.class);
        scorer.setAccessible(true);
        ObjectMapper mapper = new ObjectMapper();
        Map<String, Object> stored = Map.of("columns", 1, "pages", List.of(
                Map.of("values", List.of(0)), Map.of("values", List.of(10)), Map.of("values", List.of(20)),
                Map.of("values", List.of(30))));
        Map<String, Object> uploaded = Map.of("columns", 1, "pages", List.of(
                Map.of("values", List.of(255)), Map.of("values", List.of(10)), Map.of("values", List.of(20)),
                Map.of("values", List.of(30))));
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                mapper.valueToTree(stored), mapper.valueToTree(uploaded));
        assertEquals("VISUAL_MISMATCH", result.get("visualStatus"));
        assertEquals("VISUAL_MATCH", result.get("chartVisualStatus"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void sectionSummaryReportsEachGraphValueWithoutBorrowingAMatchFromAnotherSection() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        scorer.setAccessible(true);
        Map<String, Object> dataset = Map.of("sectionSummaries", List.of(
                section("INPUT_ENERGY", "에너지", 1.62, 0, 3),
                section("OUTPUT_WATER", "수계 배출물", 0.36, 0, 2)));

        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                List.of("page one", "에너지 1.62 kg CO2e 0% 수계 배출물 9.36 kg CO2e 0%"),
                new ObjectMapper().valueToTree(dataset));

        assertFalse((Boolean) result.get("sectionSummaryExactMatch"));
        List<Map<String, Object>> comparisons =
                (List<Map<String, Object>>) result.get("sectionSummaryComparisons");
        assertTrue((Boolean) comparisons.get(0).get("matched"));
        assertEquals("0.36", comparisons.get(1).get("expectedTotalEmission"));
        assertEquals("9.36", comparisons.get(1).get("actualTotalEmission"));
        assertFalse((Boolean) comparisons.get(1).get("totalEmissionMatched"));
        assertFalse((Boolean) comparisons.get(1).get("matched"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void detailRowsAndChartFieldsArePositionScopedAndIncludedInUnifiedCount() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method detailScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        Method chartScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        Method unified = ReportVerificationRegistryService.class.getDeclaredMethod(
                "appendUnifiedComparisonDetails", Map.class);
        detailScorer.setAccessible(true);
        chartScorer.setAccessible(true);
        unified.setAccessible(true);

        Map<String, Object> first = detailRow("INPUT_ENERGY", "전력", 1, 0.26, 0.26);
        Map<String, Object> second = detailRow("INPUT_ENERGY", "재생전력", 1, 0.14, 0.14);
        Map<String, Object> dataset = new LinkedHashMap<>();
        dataset.put("rows", List.of(first, second));
        dataset.put("sectionSummaries", List.of(section("INPUT_ENERGY", "에너지", 0.4, 100, 2)));
        com.fasterxml.jackson.databind.JsonNode datasetNode = new ObjectMapper().valueToTree(dataset);
        List<String> exactPages = List.of("p1", "에너지 0.4 kg CO2e 100%", "p3",
                "상세 계산 결과표 에너지 전력 1t 0.26 0.26 재생전력 1t 0.14 0.14");
        List<String> changedPages = List.of("p1", "에너지 0.4 kg CO2e 100%", "p3",
                "상세 계산 결과표 에너지 전력 9t 0.26 0.26 재생전력 1t 0.14 0.14");

        Map<String, Object> exact = (Map<String, Object>) detailScorer.invoke(service, exactPages, datasetNode);
        Map<String, Object> splitGlyphs = (Map<String, Object>) detailScorer.invoke(service, List.of(
                "p1", "에 너 지 0 . 4 kg CO2e 100%", "p3",
                "상세 계산 결과표 에 너 지 전 력 1t 0 . 26 0 . 26 재 생 전 력 1t 0 . 14 0 . 14"), datasetNode);
        Map<String, Object> changed = (Map<String, Object>) detailScorer.invoke(service, changedPages, datasetNode);
        assertTrue((Boolean) exact.get("detailRowsExactMatch"));
        assertTrue((Boolean) splitGlyphs.get("detailRowsExactMatch"));
        Map<String, Object> splitChart = (Map<String, Object>) chartScorer.invoke(service, List.of(
                "p1", "섹 션 별 탄 소 배 출 기 여 그 래 프 에 너 지 0 . 4 kg CO2e 100%", "p3", "p4"), datasetNode);
        assertTrue((Boolean) splitChart.get("sectionSummaryExactMatch"));
        assertFalse((Boolean) changed.get("detailRowsExactMatch"));
        List<Map<String, Object>> changedRows = (List<Map<String, Object>>) changed.get("fieldComparisons");
        assertFalse((Boolean) changedRows.get(0).get("amountMatched"));
        assertEquals("9", changedRows.get(0).get("amountActual"));
        assertTrue((Boolean) changedRows.get(1).get("amountMatched"));

        Map<String, Object> combined = new LinkedHashMap<>(exact);
        combined.putAll((Map<String, Object>) chartScorer.invoke(service, exactPages, datasetNode));
        unified.invoke(service, combined);
        assertEquals(11, combined.get("comparisonItemCount")); // detail 2*4 + chart 1*3
        assertEquals(11L, combined.get("matchedComparisonItemCount"));
        List<Map<String, Object>> details = (List<Map<String, Object>>) combined.get("comparisonDetails");
        assertEquals(8, details.stream().filter(item -> "DETAIL".equals(item.get("category"))).count());
        assertEquals(3, details.stream().filter(item -> "CHART".equals(item.get("category"))).count());
    }

    @Test
    @SuppressWarnings("unchecked")
    void allNineteenRowsAndSixChartSectionsRejectOneChangedValueAtATime() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method detailScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        Method chartScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        Method unified = ReportVerificationRegistryService.class.getDeclaredMethod(
                "appendUnifiedComparisonDetails", Map.class);
        detailScorer.setAccessible(true);
        chartScorer.setAccessible(true);
        unified.setAccessible(true);

        List<Map<String, Object>> rows = new ArrayList<>();
        List<Map<String, Object>> sections = new ArrayList<>();
        for (int sectionIndex = 0; sectionIndex < 6; sectionIndex++) {
            sections.add(section("S" + sectionIndex, "차트항목" + sectionIndex,
                    10 + sectionIndex, 10 + sectionIndex, 3));
        }
        for (int rowIndex = 0; rowIndex < 19; rowIndex++) {
            rows.add(detailRow("S" + (rowIndex % 6), "물질" + rowIndex,
                    1, 0.10 + rowIndex, 0.20 + rowIndex));
        }
        Map<String, Object> dataset = new LinkedHashMap<>();
        dataset.put("rows", rows);
        dataset.put("sectionSummaries", sections);
        com.fasterxml.jackson.databind.JsonNode datasetNode = new ObjectMapper().valueToTree(dataset);

        String chartPage = chartPage(sections, -1, false);
        String detailPage = detailPage(rows, -1, -1);
        List<String> exactPages = List.of("p1", chartPage, "p3", detailPage);
        Map<String, Object> exactRows = (Map<String, Object>) detailScorer.invoke(service, exactPages, datasetNode);
        Map<String, Object> exactChart = (Map<String, Object>) chartScorer.invoke(service, exactPages, datasetNode);
        assertTrue((Boolean) exactRows.get("detailRowsExactMatch"));
        assertTrue((Boolean) exactChart.get("sectionSummaryExactMatch"));

        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            for (int fieldIndex = 0; fieldIndex < 3; fieldIndex++) {
                List<String> changedPages = List.of("p1", chartPage, "p3",
                        detailPage(rows, rowIndex, fieldIndex));
                Map<String, Object> changed = (Map<String, Object>) detailScorer.invoke(service, changedPages, datasetNode);
                assertFalse((Boolean) changed.get("detailRowsExactMatch"),
                        "row=" + rowIndex + " field=" + fieldIndex);
                assertEquals(1, ((List<?>) changed.get("fieldMismatches")).size(),
                        "row=" + rowIndex + " field=" + fieldIndex);
            }
        }
        for (int sectionIndex = 0; sectionIndex < sections.size(); sectionIndex++) {
            for (boolean share : List.of(false, true)) {
                List<String> changedPages = List.of("p1", chartPage(sections, sectionIndex, share), "p3", detailPage);
                Map<String, Object> changed = (Map<String, Object>) chartScorer.invoke(service, changedPages, datasetNode);
                assertFalse((Boolean) changed.get("sectionSummaryExactMatch"),
                        "section=" + sectionIndex + " share=" + share);
            }
        }

        Map<String, Object> combined = new LinkedHashMap<>(exactRows);
        combined.putAll(exactChart);
        unified.invoke(service, combined);
        assertEquals(94, combined.get("comparisonItemCount"));
        assertEquals(94L, combined.get("matchedComparisonItemCount"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void zeroProductEmissionDisplayedAsDashIsAnExactDetailMatch() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method detailScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        detailScorer.setAccessible(true);

        Map<String, Object> product = detailRow("OUTPUT_PRODUCT", "e-케로신", 1, 0, 0);
        Map<String, Object> dataset = new LinkedHashMap<>();
        dataset.put("rows", List.of(product));
        com.fasterxml.jackson.databind.JsonNode datasetNode = new ObjectMapper().valueToTree(dataset);
        List<String> pages = List.of("p1", "p2", "p3",
                "상세 계산 결과표 제품 및 부산물 e-케로신 1t 0 -");

        Map<String, Object> result = (Map<String, Object>) detailScorer.invoke(service, pages, datasetNode);
        assertTrue((Boolean) result.get("detailRowsExactMatch"));
        List<Map<String, Object>> comparisons = (List<Map<String, Object>>) result.get("fieldComparisons");
        assertEquals("-", comparisons.get(0).get("totalEmissionDisplay"));
        assertEquals("-", comparisons.get(0).get("totalEmissionActual"));
        assertTrue((Boolean) comparisons.get(0).get("totalEmissionMatched"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void repeatedFactorAndEmissionUseTheSingleVisibleTableValue() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        scorer.setAccessible(true);
        Map<String, Object> dataset = Map.of("rows", List.of(
                detailRow("OUTPUT_AIR", "CO", 1, 0.03, 0.03),
                detailRow("OUTPUT_WASTE", "촉매 폐기물", 1, 0.01, 0.01)));
        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                List.of("상세 계산 결과표 co 1t 0.03 촉매 폐기물 1t 0.01"),
                new ObjectMapper().valueToTree(dataset));
        assertTrue((Boolean) result.get("detailRowsExactMatch"));
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("fieldComparisons");
        assertEquals("0.03", rows.get(0).get("emissionFactorActual"));
        assertEquals("0.03", rows.get(0).get("totalEmissionActual"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void chartCoordinatesUseTheExactLegendInsteadOfANearbyRepeatedBarValue() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method normalize = ReportVerificationRegistryService.class.getDeclaredMethod("normalizeOcrLinePages", Object.class);
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class, List.class);
        normalize.setAccessible(true);
        scorer.setAccessible(true);
        List<Map<String, Object>> rawPages = List.of(
                Map.of("pageNumber", 1, "ocrText", "", "lines", List.of()),
                Map.of("pageNumber", 2, "ocrText", "수계 배출물 1.62 kg co2e 0%", "lines", List.of(
                        ocrLine("수계 배출물", 350, 1300), ocrLine("1.62 kg co2e", 1900, 1300),
                        ocrLine("0%", 2050, 1410))),
                Map.of("pageNumber", 3, "ocrText", "수계 배출물 0%·0.36 kg c02e", "lines", List.of(
                        ocrLine("수계 배출물", 420, 2020),
                        ocrLine("0%", 470, 2090), ocrLine("0.36 kg c02e", 1100, 2090))));
        Object lines = normalize.invoke(service, rawPages);
        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                List.of("", "수계 배출물 1.62 kg co2e 0%", "수계 배출물 0% 0.36 kg co2e"),
                new ObjectMapper().valueToTree(Map.of("sectionSummaries",
                        List.of(section("OUTPUT_WATER", "수계 배출물", 0.36, 0, 2)))), lines);
        assertTrue((Boolean) result.get("sectionSummaryExactMatch"));
        List<Map<String, Object>> comparisons = (List<Map<String, Object>>) result.get("sectionSummaryComparisons");
        assertEquals("0.36", comparisons.get(0).get("actualTotalEmission"));
        assertEquals("0", comparisons.get(0).get("actualSharePercent"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void detailCoordinatesKeepEachVisibleValueOnItsOwnMaterialRow() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method normalize = ReportVerificationRegistryService.class.getDeclaredMethod("normalizeOcrLinePages", Object.class);
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class, List.class);
        normalize.setAccessible(true);
        scorer.setAccessible(true);
        List<Map<String, Object>> pageLines = List.of(
                ocrLine("CO", 240, 2050), ocrLine("1t", 1400, 2050), ocrLine("0.03", 1660, 2050),
                ocrLine("촉매 폐기물", 300, 2730), ocrLine("1t", 1400, 2730), ocrLine("0.01", 1660, 2730),
                ocrLine("최종 합계", 300, 3040), ocrLine("79,262.29", 1900, 3040));
        Object lines = normalize.invoke(service, List.of(
                Map.of("pageNumber", 1, "ocrText", "e-케로신 79,262.29", "lines", List.of(
                        ocrLine("e-케로신", 300, 300), ocrLine("79,262.29", 1900, 300))),
                Map.of("pageNumber", 2, "ocrText", "상세 계산 결과표", "lines", pageLines)));
        Map<String, Object> dataset = Map.of("rows", List.of(
                detailRow("OUTPUT_AIR", "CO", 1, 0.03, 0.03),
                detailRow("OUTPUT_WASTE", "촉매 폐기물", 1, 0.01, 0.01)));
        Map<String, Object> result = (Map<String, Object>) scorer.invoke(service,
                List.of("e-케로신 79,262.29", "상세 계산 결과표"),
                new ObjectMapper().valueToTree(dataset), lines);
        assertTrue((Boolean) result.get("detailRowsExactMatch"));
        assertTrue(((List<?>) result.get("fieldMismatches")).isEmpty());
    }

    @Test
    @SuppressWarnings("unchecked")
    void pdfNumbersMustEqualScreenDigitsWhileDatabaseMayHaveMoreDecimals() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method normalize = ReportVerificationRegistryService.class.getDeclaredMethod("normalizeOcrLinePages", Object.class);
        Method scorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class, List.class);
        normalize.setAccessible(true);
        scorer.setAccessible(true);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("sectionCode", "INPUT_MATERIAL");
        row.put("materialName", "정밀원료");
        row.put("originalAmount", new java.math.BigDecimal("1.2390"));
        row.put("originalAmountDisplay", "1.23");
        row.put("emissionFactor", new java.math.BigDecimal("79234.30009"));
        row.put("emissionFactorDisplay", "79,234.30");
        row.put("totalEmission", new java.math.BigDecimal("79234.30009"));
        row.put("totalEmissionDisplay", "79,234.30");
        com.fasterxml.jackson.databind.JsonNode dataset = new ObjectMapper().valueToTree(Map.of("rows", List.of(row)));

        Map<String, Object> exact = scoreDetailLines(service, normalize, scorer, dataset,
                "1.23", "79234.30", "79234.30");
        assertTrue((Boolean) exact.get("detailRowsExactMatch"));
        List<Map<String, Object>> exactRows = (List<Map<String, Object>>) exact.get("fieldComparisons");
        assertEquals("1.23", exactRows.get(0).get("amountActual"));
        assertEquals("79234.30", exactRows.get(0).get("emissionFactorActual"));

        Map<String, Object> changedDigit = scoreDetailLines(service, normalize, scorer, dataset,
                "1.24", "79234.30", "79234.30");
        assertFalse((Boolean) changedDigit.get("detailRowsExactMatch"));
        List<Map<String, Object>> changedRows = (List<Map<String, Object>>) changedDigit.get("fieldComparisons");
        assertFalse((Boolean) changedRows.get(0).get("amountMatched"));

        Map<String, Object> changedScale = scoreDetailLines(service, normalize, scorer, dataset,
                "1.230", "79234.3", "79234.30");
        assertFalse((Boolean) changedScale.get("detailRowsExactMatch"));
        List<Map<String, Object>> scaleRows = (List<Map<String, Object>>) changedScale.get("fieldComparisons");
        assertFalse((Boolean) scaleRows.get(0).get("amountMatched"));
        assertFalse((Boolean) scaleRows.get(0).get("emissionFactorMatched"));

        Map<String, Object> decimalPointLoss = scoreDetailLines(service, normalize, scorer, dataset,
                "1.23", "7923430", "79234.30");
        assertFalse((Boolean) decimalPointLoss.get("detailRowsExactMatch"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void detailRowsMatchByVisibleMaterialWhenOcrOrderDiffersFromDatasetOrder() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method detailScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        detailScorer.setAccessible(true);

        Map<String, Object> dataset = new LinkedHashMap<>();
        dataset.put("rows", List.of(
                detailRow("INPUT_MATERIAL", "산소", 2, 0.3, 0.6),
                detailRow("INPUT_MATERIAL", "질소", 1, 0.2, 0.2)));
        com.fasterxml.jackson.databind.JsonNode datasetNode = new ObjectMapper().valueToTree(dataset);
        List<String> pages = List.of("표지",
                "상세 계산 결과표 원료 물질 및 보조 물질 질소 1t 0.2 0.2 산소 2t 0.3 0.6");

        Map<String, Object> result = (Map<String, Object>) detailScorer.invoke(service, pages, datasetNode);
        assertTrue((Boolean) result.get("detailRowsExactMatch"));
        List<Map<String, Object>> comparisons = (List<Map<String, Object>>) result.get("fieldComparisons");
        assertEquals("질소", comparisons.get(1).get("actualMaterialName"));
        assertTrue((Boolean) comparisons.get(1).get("rowMatched"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void chartAndDetailPagesAreDetectedAfterInsertedPagesUpToTen() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method detailScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreDetailTablePage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        Method chartScorer = ReportVerificationRegistryService.class.getDeclaredMethod(
                "scoreSectionSummaryPage", List.class, com.fasterxml.jackson.databind.JsonNode.class);
        detailScorer.setAccessible(true);
        chartScorer.setAccessible(true);

        Map<String, Object> dataset = new LinkedHashMap<>();
        dataset.put("rows", List.of(
                detailRow("INPUT_ENERGY", "전력", 1, 0.26, 0.26),
                detailRow("INPUT_ENERGY", "재생전력", 1, 0.14, 0.14)));
        dataset.put("sectionSummaries", List.of(section("INPUT_ENERGY", "에너지", 0.4, 100, 2)));
        com.fasterxml.jackson.databind.JsonNode datasetNode = new ObjectMapper().valueToTree(dataset);
        List<String> tenPages = List.of(
                "표지", "추가 설명 1", "추가 설명 2", "추가 설명 3",
                "섹션별 탄소배출 기여 그래프 에너지 0.4 kg CO2e 100%",
                "추가 설명 4", "추가 설명 5",
                "상세 계산 결과표 에너지 전력 1t 0.26 0.26",
                "재생전력 1t 0.14 0.14", "검증 정보");

        Map<String, Object> detail = (Map<String, Object>) detailScorer.invoke(service, tenPages, datasetNode);
        Map<String, Object> chart = (Map<String, Object>) chartScorer.invoke(service, tenPages, datasetNode);
        assertTrue((Boolean) detail.get("detailRowsExactMatch"));
        assertTrue((Boolean) chart.get("sectionSummaryExactMatch"));
    }

    @Test
    void elevenOcrPagesAreRejectedBeforeRegistryLookup() {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        List<Map<String, Object>> pages = new ArrayList<>();
        for (int index = 1; index <= 11; index++) {
            pages.add(Map.of("pageNumber", index, "ocrText", "page " + index));
        }
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.verifyOcr(Map.of("ocrText", "report", "ocrPages", pages)));
        assertEquals("Report verification supports up to 10 pages.", error.getMessage());
    }

    @Test
    void semanticStatusSeparatesDataTamperingFromChartTampering() throws Exception {
        ReportVerificationRegistryService service = service(new FingerprintJdbcTemplate());
        Method classifier = ReportVerificationRegistryService.class.getDeclaredMethod(
                "classifySemanticStatus", boolean.class, boolean.class);
        classifier.setAccessible(true);

        assertEquals("CONTENT_EXACT", classifier.invoke(service, true, true));
        assertEquals("CHART_TAMPERED", classifier.invoke(service, true, false));
        assertEquals("DATA_TAMPERED", classifier.invoke(service, false, true));
        assertEquals("DATA_TAMPERED", classifier.invoke(service, false, false));
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

    private static Map<String, Object> detailRow(String sectionCode, String material,
                                                  double amount, double factor, double total) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("sectionCode", sectionCode);
        row.put("materialName", material);
        row.put("originalAmount", amount);
        row.put("amount", amount);
        row.put("emissionFactor", factor);
        row.put("totalEmission", total);
        return row;
    }

    private static String detailPage(List<Map<String, Object>> rows, int changedRow, int changedField) {
        StringBuilder text = new StringBuilder("상세 계산 결과표 ");
        for (int index = 0; index < rows.size(); index++) {
            Map<String, Object> row = rows.get(index);
            double amount = ((Number) row.get("originalAmount")).doubleValue();
            double factor = ((Number) row.get("emissionFactor")).doubleValue();
            double total = ((Number) row.get("totalEmission")).doubleValue();
            if (index == changedRow) {
                if (changedField == 0) amount += 7;
                if (changedField == 1) factor += 7;
                if (changedField == 2) total += 7;
            }
            text.append(row.get("materialName")).append(' ')
                    .append(screenNumber(amount)).append("t ")
                    .append(screenNumber(factor)).append(' ')
                    .append(screenNumber(total)).append(' ');
        }
        return text.toString();
    }

    private static String screenNumber(double value) {
        return java.math.BigDecimal.valueOf(value).setScale(2, java.math.RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    private static String chartPage(List<Map<String, Object>> sections, int changedSection, boolean share) {
        StringBuilder text = new StringBuilder("섹션별 탄소배출 기여 그래프 ");
        for (int index = 0; index < sections.size(); index++) {
            Map<String, Object> section = sections.get(index);
            double total = ((Number) section.get("totalEmission")).doubleValue();
            double percent = ((Number) section.get("sharePercent")).doubleValue();
            if (index == changedSection) {
                if (share) percent += 7;
                else total += 7;
            }
            text.append(section.get("sectionLabel")).append(' ')
                    .append(total).append("kg CO2e ").append(percent).append("% ");
        }
        return text.toString();
    }

    private static Map<String, Object> ocrLine(String text, double x, double y) {
        return Map.of("text", text, "polygon", List.of(
                List.of(x - 10, y - 10), List.of(x + 10, y - 10),
                List.of(x + 10, y + 10), List.of(x - 10, y + 10)));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> scoreDetailLines(ReportVerificationRegistryService service,
                                                         Method normalize, Method scorer,
                                                         com.fasterxml.jackson.databind.JsonNode dataset,
                                                         String amount, String factor, String emission) throws Exception {
        List<Map<String, Object>> pageLines = List.of(
                ocrLine("상세 계산 결과표", 300, 300),
                ocrLine("정밀원료", 250, 900), ocrLine(amount, 900, 900),
                ocrLine(factor, 1400, 900), ocrLine(emission, 1900, 900));
        Object lines = normalize.invoke(service, List.of(
                Map.of("pageNumber", 1, "ocrText", "상세 계산 결과표 정밀원료 "
                        + amount + " " + factor + " " + emission, "lines", pageLines)));
        return (Map<String, Object>) scorer.invoke(service,
                List.of("상세 계산 결과표 정밀원료 " + amount + " " + factor + " " + emission),
                dataset, lines);
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
