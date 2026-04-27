package egovframework.com.feature.admin.service;

import egovframework.com.feature.admin.dto.request.AdminEmissionGwpValueSaveRequestDTO;
import egovframework.com.feature.admin.mapper.AdminEmissionGwpValueMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class AdminEmissionGwpValueService {

    private static final String TABLE_NAME = "ADMIN_EMISSION_GWP_VALUE";
    private static final String DOCUMENT_NAME = "Global-Warming-Potential-Values (August 2024).pdf";
    private static final String DOCUMENT_TARGET_PATH = "/opt/reference/수식 설계/" + DOCUMENT_NAME;
    private static final String EXPECTED_DOCUMENT_SHA256 = "5f0bbd46600e0b27ea4eda97932d683aaef9b6e70a88830e8b219c885aeea387";
    private static final Path PDF_REFERENCE_CACHE_PATH = Path.of("/opt/Resonance/var/cache/emission-gwp-pdf-catalog-cache.psv");
    private static final int EXPECTED_ROW_COUNT = 266;
    private static final String OCR_COMMAND = "tesseract";
    private static final String OCR_LANG = "kor+eng";
    private static final float OCR_DPI = 200f;
    private static final String PDF_COMPARE_POLICY_AUTO = "AUTO";
    private static final String PDF_COMPARE_POLICY_TEXT_ONLY = "TEXT_ONLY";
    private static final String PDF_COMPARE_POLICY_OCR_PREFERRED = "OCR_PREFERRED";
    private static final String PDF_COMPARE_SCOPE_SELECTED = "SELECTED";
    private static final String PDF_COMPARE_SCOPE_ALL = "ALL";
    private static final int MAX_PDF_CANDIDATE_WIDTH = 4;

    private final AdminEmissionGwpValueMapper adminEmissionGwpValueMapper;
    private final JdbcTemplate jdbcTemplate;

    private volatile boolean databaseReady;
    private volatile PdfReferenceCatalog pdfReferenceCatalog;
    private volatile List<Map<String, String>> seedRowsCache;
    private volatile Boolean documentFingerprintOkCache;
    private volatile boolean pdfCatalogWarmupStarted;

    public AdminEmissionGwpValueService(AdminEmissionGwpValueMapper adminEmissionGwpValueMapper,
                                        DataSource dataSource) {
        this.adminEmissionGwpValueMapper = adminEmissionGwpValueMapper;
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeCatalogOnStartup() {
        try {
            ensureDatabaseReady();
            Map<String, Object> snapshot = buildDataIntegritySnapshot(localizeRows(loadAll(), false), false);
            triggerPdfReferenceCatalogWarmup();
            log.info("Emission GWP catalog startup init complete. table={}, rows={}, pdfFingerprint={}, seedCountOk={}, sectionCountOk={}",
                    TABLE_NAME,
                    snapshot.get("dbRowCount"),
                    snapshot.get("pdfFingerprintOk"),
                    snapshot.get("seedRowCountOk"),
                    snapshot.get("sectionDistributionOk"));
        } catch (Exception e) {
            log.error("Emission GWP catalog startup init failed.", e);
        }
    }

    private void triggerPdfReferenceCatalogWarmup() {
        if (pdfCatalogWarmupStarted) {
            return;
        }
        synchronized (this) {
            if (pdfCatalogWarmupStarted) {
                return;
            }
            pdfCatalogWarmupStarted = true;
        }
        CompletableFuture.runAsync(() -> {
            try {
                PdfReferenceCatalog catalog = loadPdfReferenceCatalog();
                log.info("Emission GWP PDF reference warmup complete. available={}, lines={}, ocrStatus={}",
                        catalog.available,
                        catalog.lines == null ? 0 : catalog.lines.size(),
                        catalog.ocrStatus);
            } catch (Exception e) {
                log.warn("Emission GWP PDF reference warmup failed.", e);
            }
        });
    }

    public Map<String, Object> buildPagePayload(String searchKeyword,
                                                String sectionCode,
                                                String rowId,
                                                String pdfComparePolicy,
                                                boolean includePdfCompare,
                                                String pdfCompareScope,
                                                boolean isEn) {
        ensureDatabaseReady();

        String normalizedKeyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedSectionCode = safe(sectionCode).toUpperCase(Locale.ROOT);
        String normalizedPdfComparePolicy = normalizePdfComparePolicy(pdfComparePolicy);
        String normalizedPdfCompareScope = normalizePdfCompareScope(pdfCompareScope);
        List<Map<String, String>> localizedRows = localizeRows(loadAll(), isEn);
        Map<String, Map<String, String>> seedIndex = indexSeedRows(loadSeedRows());
        List<Map<String, String>> baseCatalog = annotateComparison(
                localizedRows,
                seedIndex,
                normalizedPdfComparePolicy,
                false,
                "",
                isEn);
        List<Map<String, String>> filtered = new ArrayList<>();
        for (Map<String, String> row : baseCatalog) {
            if (!matchesKeyword(row, normalizedKeyword)) {
                continue;
            }
            if (!normalizedSectionCode.isEmpty() && !"ALL".equals(normalizedSectionCode)
                    && !normalizedSectionCode.equalsIgnoreCase(safe(row.get("sectionCode")))) {
                continue;
            }
            filtered.add(row);
        }

        Map<String, String> selectedBase = selectRow(filtered, baseCatalog, safe(rowId));
        String pdfCompareRowId = includePdfCompare && PDF_COMPARE_SCOPE_SELECTED.equals(normalizedPdfCompareScope)
                ? safe(selectedBase.get("rowId"))
                : "";
        List<Map<String, String>> catalog = baseCatalog;
        if (includePdfCompare) {
            if (PDF_COMPARE_SCOPE_ALL.equals(normalizedPdfCompareScope)) {
                enrichPdfEvidence(catalog, normalizedPdfComparePolicy, "", isEn);
            } else {
                enrichPdfEvidence(catalog, normalizedPdfComparePolicy, pdfCompareRowId, isEn);
            }
        }

        Map<String, String> selected = selectRow(filtered, catalog, safe(rowId));

        PdfReferenceCatalog pdfCatalog = includePdfCompare ? loadPdfReferenceCatalog() : PdfReferenceCatalog.deferred();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0020109");
        payload.put("menuUrl", isEn ? "/en/admin/emission/gwp-values" : "/admin/emission/gwp-values");
        payload.put("documentName", DOCUMENT_NAME);
        payload.put("documentSourcePath", "/mnt/c/Users/jwchoo/Downloads/" + DOCUMENT_NAME);
        payload.put("documentTargetPath", "/opt/reference/수식 설계/" + DOCUMENT_NAME);
        payload.put("tableName", TABLE_NAME);
        payload.put("pdfOcrStatus", pdfCatalog.ocrStatus);
        payload.put("pdfOcrStatusLabel", resolvePdfOcrStatusLabel(pdfCatalog.ocrStatus, isEn));
        payload.put("pdfOcrStatusDetail", resolvePdfOcrStatusDetailLabel(pdfCatalog.ocrStatusDetail, isEn));
        payload.put("pdfOcrInstallHint", resolvePdfOcrInstallHint(isEn));
        payload.put("pdfComparePolicy", normalizedPdfComparePolicy);
        payload.put("pdfComparePolicyLabel", resolvePdfComparePolicyLabel(normalizedPdfComparePolicy, isEn));
        payload.put("pdfComparePolicyOptions", buildPdfComparePolicyOptions(isEn));
        payload.put("pdfCompareLoaded", includePdfCompare);
        payload.put("pdfCompareScope", normalizedPdfCompareScope);
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("sectionCode", safe(sectionCode));
        payload.put("selectedRowId", safe(selected.get("rowId")));
        payload.put("summaryCards", buildSummaryCards(catalog, isEn));
        payload.put("sectionOptions", buildSectionOptions(catalog, isEn));
        payload.put("tableHeaderMeta", buildTableHeaderMeta(isEn));
        payload.put("dimensionCards", buildDimensionCards(catalog, isEn));
        payload.put("comparisonSummary", buildComparisonSummary(catalog, isEn));
        payload.put("pdfComparisonSummary", includePdfCompare ? buildPdfComparisonSummary(catalog, isEn) : new ArrayList<Map<String, String>>());
        payload.put("dataIntegrity", buildDataIntegritySnapshot(catalog, isEn));
        payload.put("gwpRows", filtered);
        payload.put("selectedRow", selected);
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        payload.put("methaneGuidance", buildMethaneGuidance(isEn));
        return payload;
    }

    public synchronized Map<String, Object> save(AdminEmissionGwpValueSaveRequestDTO request, String actorId, boolean isEn) {
        ensureDatabaseReady();

        String commonName = safe(request == null ? null : request.getCommonName());
        String formula = safe(request == null ? null : request.getFormula());
        String sectionCode = normalizeSectionCode(request == null ? null : request.getSectionCode());
        String rowId = safe(request == null ? null : request.getRowId());
        if (commonName.isEmpty()) {
            throw new IllegalArgumentException("commonName is required.");
        }
        if (formula.isEmpty()) {
            throw new IllegalArgumentException("formula is required.");
        }
        if (sectionCode.isEmpty()) {
            throw new IllegalArgumentException("sectionCode is required.");
        }

        String resolvedRowId = rowId.isEmpty() ? nextRowId() : rowId;
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("rowId", resolvedRowId);
        params.put("sectionCode", sectionCode);
        params.put("sectionOrder", resolveSectionOrder(sectionCode));
        params.put("commonName", commonName);
        params.put("formula", formula);
        params.put("ar4Value", safe(request == null ? null : request.getAr4Value()));
        params.put("ar5Value", safe(request == null ? null : request.getAr5Value()));
        params.put("ar6Value", safe(request == null ? null : request.getAr6Value()));
        params.put("source", safe(request == null ? null : request.getSource()));
        params.put("manualInputValue", safe(request == null ? null : request.getManualInputValue()));
        params.put("note", safe(request == null ? null : request.getNote()));
        params.put("sourceDocumentName", DOCUMENT_NAME);
        params.put("sourcePageNo", resolveSourcePage(sectionCode));
        params.put("sortOrder", request != null && request.getSortOrder() != null
                ? request.getSortOrder()
                : adminEmissionGwpValueMapper.selectNextSortOrderBySection(sectionCode));
        params.put("actorId", firstNonBlank(actorId, "system"));

        if (adminEmissionGwpValueMapper.countByRowId(resolvedRowId) > 0) {
            adminEmissionGwpValueMapper.updateRow(params);
        } else {
            adminEmissionGwpValueMapper.insertRow(params);
        }

        Map<String, String> savedRow = buildAnnotatedRow(findLocalizedRow(resolvedRowId, isEn), loadSeedRowIndex(), PDF_COMPARE_POLICY_AUTO, true, "", isEn);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("rowId", resolvedRowId);
        response.put("message", isEn ? "GWP value row saved." : "GWP 값 행을 저장했습니다.");
        response.put("row", savedRow);
        response.put("compareStatus", safe(savedRow.get("compareStatus")));
        response.put("compareStatusLabel", safe(savedRow.get("compareStatusLabel")));
        response.put("compareMismatchLabels", safe(savedRow.get("compareMismatchLabels")));
        response.put("compareMismatchFields", buildMismatchFieldList(savedRow));
        response.put("pdfCompareStatus", safe(savedRow.get("pdfCompareStatus")));
        response.put("pdfCompareStatusLabel", safe(savedRow.get("pdfCompareStatusLabel")));
        response.put("pdfComparePage", safe(savedRow.get("pdfComparePage")));
        response.put("pdfCompareSource", safe(savedRow.get("pdfCompareSource")));
        response.put("pdfCompareSourceLabel", safe(savedRow.get("pdfCompareSourceLabel")));
        response.put("pdfCompareDetail", safe(savedRow.get("pdfCompareDetail")));
        return response;
    }

    public synchronized Map<String, Object> delete(String rowId, boolean isEn) {
        ensureDatabaseReady();
        String normalizedRowId = safe(rowId);
        if (normalizedRowId.isEmpty()) {
            throw new IllegalArgumentException("rowId is required.");
        }
        if (adminEmissionGwpValueMapper.countByRowId(normalizedRowId) == 0) {
            throw new IllegalArgumentException("row not found.");
        }
        adminEmissionGwpValueMapper.deleteRow(normalizedRowId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("rowId", normalizedRowId);
        response.put("message", isEn ? "GWP value row deleted." : "GWP 값 행을 삭제했습니다.");
        return response;
    }

    private synchronized void ensureDatabaseReady() {
        if (databaseReady) {
            return;
        }
        Integer tableCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM db_class WHERE LOWER(class_name) = LOWER(?)",
                Integer.class,
                TABLE_NAME);
        if (tableCount == null || tableCount == 0) {
            jdbcTemplate.execute("CREATE TABLE " + TABLE_NAME + " ("
                    + "ROW_ID VARCHAR(20) NOT NULL,"
                    + "SECTION_CODE VARCHAR(40) NOT NULL,"
                    + "SECTION_ORDR INTEGER NOT NULL,"
                    + "COMMON_NAME VARCHAR(500) NOT NULL,"
                    + "FORMULA VARCHAR(250) NOT NULL,"
                    + "AR4_VALUE VARCHAR(60),"
                    + "AR5_VALUE VARCHAR(60),"
                    + "AR6_VALUE VARCHAR(60),"
                    + "SOURCE_TXT VARCHAR(200),"
                    + "MANUAL_INPUT_VALUE VARCHAR(120),"
                    + "NOTE_TXT VARCHAR(4000),"
                    + "SOURCE_DOCUMENT_NM VARCHAR(200) NOT NULL,"
                    + "SOURCE_PAGE_NO INTEGER,"
                    + "SORT_ORDR INTEGER NOT NULL,"
                    + "FRST_REGIST_PNTTM DATETIME DEFAULT CURRENT_DATETIME NOT NULL,"
                    + "FRST_REGISTER_ID VARCHAR(100),"
                    + "LAST_UPDT_PNTTM DATETIME DEFAULT CURRENT_DATETIME NOT NULL,"
                    + "LAST_UPDUSR_ID VARCHAR(100),"
                    + "PRIMARY KEY (ROW_ID)"
                    + ")");
            jdbcTemplate.execute("CREATE INDEX IDX_ADMIN_EMISSION_GWP_VALUE_01 ON " + TABLE_NAME + " (SECTION_CODE, SECTION_ORDR, SORT_ORDR)");
            jdbcTemplate.execute("CREATE INDEX IDX_ADMIN_EMISSION_GWP_VALUE_02 ON " + TABLE_NAME + " (COMMON_NAME)");
            log.info("Created table {}", TABLE_NAME);
        }
        ensureColumn("SOURCE_TXT", "ALTER TABLE " + TABLE_NAME + " ADD COLUMN SOURCE_TXT VARCHAR(200)");
        ensureColumn("MANUAL_INPUT_VALUE", "ALTER TABLE " + TABLE_NAME + " ADD COLUMN MANUAL_INPUT_VALUE VARCHAR(120)");

        int inserted = 0;
        int updated = 0;
        for (Map<String, String> row : loadSeedRows()) {
            Map<String, Object> params = canonicalSeedParams(row, adminEmissionGwpValueMapper.countByRowId(safe(row.get("rowId"))) == 0 ? "seed" : "seed-sync");
            if (adminEmissionGwpValueMapper.countByRowId(safe(row.get("rowId"))) == 0) {
                adminEmissionGwpValueMapper.insertRow(params);
                inserted++;
                continue;
            }
            Map<String, Object> existing = adminEmissionGwpValueMapper.selectByRowId(safe(row.get("rowId")));
            if (seedRowNeedsUpdate(existing, row)) {
                adminEmissionGwpValueMapper.updateRow(params);
                updated++;
            }
        }
        if (inserted > 0 || updated > 0) {
            log.info("Seed synchronization applied to {}. inserted={}, updated={}, total={}",
                    TABLE_NAME, inserted, updated, adminEmissionGwpValueMapper.countAll());
        } else {
            log.info("Seed synchronization already up to date for {}. total={}", TABLE_NAME, adminEmissionGwpValueMapper.countAll());
        }
        databaseReady = true;
    }

    private Map<String, Object> canonicalSeedParams(Map<String, String> row, String actorId) {
        Map<String, Object> params = new LinkedHashMap<>(row);
        params.put("sectionOrder", resolveSectionOrder(safe(row.get("sectionCode"))));
        params.put("sourceDocumentName", DOCUMENT_NAME);
        params.put("sourcePageNo", resolveSourcePage(safe(row.get("sectionCode"))));
        params.put("sortOrder", safeInt(row.get("sortOrder")));
        params.put("actorId", actorId);
        return params;
    }

    private boolean seedRowNeedsUpdate(Map<String, Object> existing, Map<String, String> seedRow) {
        if (existing == null || existing.isEmpty()) {
            return true;
        }
        return !safe(stringValue(existing.get("sectionCode"))).equals(safe(seedRow.get("sectionCode")))
                || !safe(stringValue(existing.get("commonName"))).equals(safe(seedRow.get("commonName")))
                || !safe(stringValue(existing.get("formula"))).equals(safe(seedRow.get("formula")))
                || !safe(stringValue(existing.get("ar4Value"))).equals(safe(seedRow.get("ar4Value")))
                || !safe(stringValue(existing.get("ar5Value"))).equals(safe(seedRow.get("ar5Value")))
                || !safe(stringValue(existing.get("ar6Value"))).equals(safe(seedRow.get("ar6Value")))
                || !safe(stringValue(existing.get("note"))).equals(safe(seedRow.get("note")))
                || safeInt(stringValue(existing.get("sortOrder"))) != safeInt(seedRow.get("sortOrder"))
                || safeInt(stringValue(existing.get("sourcePageNo"))) != resolveSourcePage(safe(seedRow.get("sectionCode")));
    }

    private void ensureColumn(String columnName, String alterSql) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM db_attribute WHERE LOWER(class_name) = LOWER(?) AND LOWER(attr_name) = LOWER(?)",
                Integer.class,
                TABLE_NAME,
                columnName);
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.execute(alterSql);
        log.info("Added column {} to {}", columnName, TABLE_NAME);
    }

    private Map<String, Map<String, String>> loadSeedRowIndex() {
        return indexSeedRows(loadSeedRows());
    }

    private synchronized PdfReferenceCatalog loadPdfReferenceCatalog() {
        if (pdfReferenceCatalog != null) {
            return pdfReferenceCatalog;
        }
        pdfReferenceCatalog = parsePdfReferenceCatalog();
        return pdfReferenceCatalog;
    }

    private PdfReferenceCatalog parsePdfReferenceCatalog() {
        Path path = Path.of(DOCUMENT_TARGET_PATH);
        if (!Files.exists(path)) {
            return PdfReferenceCatalog.unavailable();
        }
        OcrAvailability ocrAvailability = detectOcrAvailability();
        PdfReferenceCatalog cachedCatalog = loadPdfReferenceCatalogCache(path, ocrAvailability);
        if (cachedCatalog != null) {
            return cachedCatalog;
        }
        try (PDDocument document = PDDocument.load(path.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            PDFRenderer renderer = new PDFRenderer(document);
            List<PdfCatalogLine> lines = new ArrayList<>();
            for (int page = 1; page <= document.getNumberOfPages(); page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = safe(stripper.getText(document));
                for (String rawLine : pageText.split("\\R")) {
                    String normalized = normalizePdfLine(rawLine);
                    if (!normalized.isEmpty()) {
                        lines.add(new PdfCatalogLine(String.valueOf(page), normalized, "TEXT"));
                    }
                }
                if (ocrAvailability.available) {
                    lines.addAll(extractOcrLines(renderer, page));
                }
            }
            PdfReferenceCatalog catalog = new PdfReferenceCatalog(true, lines, ocrAvailability.available ? "ENABLED" : "UNAVAILABLE", ocrAvailability.detail);
            storePdfReferenceCatalogCache(path, catalog);
            return catalog;
        } catch (IOException e) {
            log.warn("Failed to parse PDF reference catalog from {}", DOCUMENT_TARGET_PATH, e);
            return PdfReferenceCatalog.unavailable();
        }
    }

    private PdfReferenceCatalog loadPdfReferenceCatalogCache(Path pdfPath, OcrAvailability ocrAvailability) {
        try {
            if (!Files.exists(PDF_REFERENCE_CACHE_PATH)) {
                return null;
            }
            List<String> rows = Files.readAllLines(PDF_REFERENCE_CACHE_PATH, StandardCharsets.UTF_8);
            if (rows.size() < 4) {
                return null;
            }
            String fingerprint = readCacheMeta(rows.get(0), "fingerprint");
            String cachedOcrStatus = readCacheMeta(rows.get(1), "ocrStatus");
            String cachedOcrDetail = readCacheMeta(rows.get(2), "ocrDetail");
            if (fingerprint.isEmpty() || !fingerprint.equals(documentFingerprintHex(pdfPath))) {
                return null;
            }
            String expectedOcrStatus = ocrAvailability.available ? "ENABLED" : "UNAVAILABLE";
            if (!expectedOcrStatus.equals(cachedOcrStatus) || !safe(ocrAvailability.detail).equals(cachedOcrDetail)) {
                return null;
            }
            List<PdfCatalogLine> lines = new ArrayList<>();
            for (int index = 4; index < rows.size(); index++) {
                String line = rows.get(index);
                if (line.isEmpty()) {
                    continue;
                }
                String[] parts = line.split("\\|", 3);
                if (parts.length < 3) {
                    continue;
                }
                lines.add(new PdfCatalogLine(unescapeCacheValue(parts[0]), unescapeCacheValue(parts[1]), unescapeCacheValue(parts[2])));
            }
            if (lines.isEmpty()) {
                return null;
            }
            log.info("Loaded emission GWP PDF reference catalog cache. path={}, lines={}", PDF_REFERENCE_CACHE_PATH, lines.size());
            return new PdfReferenceCatalog(true, lines, cachedOcrStatus, cachedOcrDetail);
        } catch (Exception e) {
            log.warn("Failed to load emission GWP PDF reference cache from {}", PDF_REFERENCE_CACHE_PATH, e);
            return null;
        }
    }

    private void storePdfReferenceCatalogCache(Path pdfPath, PdfReferenceCatalog catalog) {
        try {
            Files.createDirectories(PDF_REFERENCE_CACHE_PATH.getParent());
            List<String> rows = new ArrayList<>();
            rows.add("# fingerprint=" + documentFingerprintHex(pdfPath));
            rows.add("# ocrStatus=" + safe(catalog.ocrStatus));
            rows.add("# ocrDetail=" + safe(catalog.ocrStatusDetail));
            rows.add("# page|text|sourceType");
            for (PdfCatalogLine line : catalog.lines) {
                rows.add(escapeCacheValue(line.pageLabel) + "|" + escapeCacheValue(line.text) + "|" + escapeCacheValue(line.sourceType));
            }
            Files.write(PDF_REFERENCE_CACHE_PATH, rows, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Failed to store emission GWP PDF reference cache to {}", PDF_REFERENCE_CACHE_PATH, e);
        }
    }

    private String readCacheMeta(String line, String key) {
        String prefix = "# " + key + "=";
        return line.startsWith(prefix) ? line.substring(prefix.length()).trim() : "";
    }

    private String documentFingerprintHex(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(Files.readAllBytes(path));
            return HexFormat.of().formatHex(hash);
        } catch (IOException | NoSuchAlgorithmException e) {
            log.warn("Failed to calculate PDF fingerprint for {}", path, e);
            return "";
        }
    }

    private String escapeCacheValue(String value) {
        return safe(value)
                .replace("\\", "\\\\")
                .replace("|", "\\p")
                .replace("\r", "\\r")
                .replace("\n", "\\n");
    }

    private String unescapeCacheValue(String value) {
        String normalized = safe(value);
        StringBuilder builder = new StringBuilder(normalized.length());
        boolean escaping = false;
        for (int index = 0; index < normalized.length(); index++) {
            char current = normalized.charAt(index);
            if (escaping) {
                if (current == 'p') {
                    builder.append('|');
                } else if (current == 'r') {
                    builder.append('\r');
                } else if (current == 'n') {
                    builder.append('\n');
                } else {
                    builder.append(current);
                }
                escaping = false;
                continue;
            }
            if (current == '\\') {
                escaping = true;
                continue;
            }
            builder.append(current);
        }
        if (escaping) {
            builder.append('\\');
        }
        return builder.toString();
    }

    private OcrAvailability detectOcrAvailability() {
        try {
            Process process = new ProcessBuilder(OCR_COMMAND, "--version").start();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                return new OcrAvailability(false, "COMMAND_FAILED");
            }
            Process langProcess = new ProcessBuilder(OCR_COMMAND, "--list-langs").redirectErrorStream(true).start();
            String output;
            try (InputStream inputStream = langProcess.getInputStream()) {
                output = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            }
            int langExitCode = langProcess.waitFor();
            if (langExitCode != 0) {
                return new OcrAvailability(false, "LANG_CHECK_FAILED");
            }
            if (!output.toLowerCase(Locale.ROOT).contains("kor")) {
                return new OcrAvailability(false, "KOR_LANG_MISSING");
            }
            return new OcrAvailability(true, "READY");
        } catch (Exception e) {
            return new OcrAvailability(false, "COMMAND_MISSING");
        }
    }

    private List<PdfCatalogLine> extractOcrLines(PDFRenderer renderer, int page) {
        List<PdfCatalogLine> lines = new ArrayList<>();
        Path imagePath = null;
        try {
            BufferedImage rendered = renderer.renderImageWithDPI(page - 1, OCR_DPI);
            imagePath = Files.createTempFile("carbonet-gwp-ocr-" + page + "-", ".png");
            ImageIO.write(rendered, "png", imagePath.toFile());
            Process process = new ProcessBuilder(
                    OCR_COMMAND,
                    imagePath.toString(),
                    "stdout",
                    "-l",
                    OCR_LANG,
                    "--psm",
                    "6"
            ).redirectErrorStream(true).start();
            String output;
            try (InputStream inputStream = process.getInputStream()) {
                output = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            }
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                return lines;
            }
            for (String rawLine : output.split("\\R")) {
                String normalized = normalizePdfLine(rawLine);
                if (!normalized.isEmpty()) {
                    lines.add(new PdfCatalogLine(String.valueOf(page), normalized, "OCR"));
                }
            }
            return lines;
        } catch (Exception e) {
            log.debug("PDF OCR skipped on page {}", page, e);
            return lines;
        } finally {
            if (imagePath != null) {
                try {
                    Files.deleteIfExists(imagePath);
                } catch (IOException ignored) {
                    log.debug("Failed to delete temp OCR image {}", imagePath);
                }
            }
        }
    }

    private String normalizePdfLine(String rawLine) {
        return safe(rawLine).replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private boolean containsPdfToken(String candidate, String token) {
        String normalizedToken = safe(token);
        if (normalizedToken.isEmpty()) {
            return false;
        }
        if (candidate.contains(normalizedToken)) {
            return true;
        }
        String normalizedNameToken = normalizeComparableName(normalizedToken);
        if (!normalizedNameToken.isEmpty() && normalizeComparableName(candidate).contains(normalizedNameToken)) {
            return true;
        }
        String normalizedFormulaToken = normalizeComparableFormula(normalizedToken);
        if (!normalizedFormulaToken.isEmpty() && normalizeComparableFormula(candidate).contains(normalizedFormulaToken)) {
            return true;
        }
        String normalizedNumericToken = normalizeComparableNumber(normalizedToken);
        if (normalizedNumericToken.isEmpty()) {
            return false;
        }
        return normalizeComparableNumber(candidate).contains(normalizedNumericToken);
    }

    private String normalizeComparableNumber(String value) {
        String normalized = safe(value).replace('\u00A0', ' ');
        if (!normalized.matches(".*\\d.*")) {
            return "";
        }
        return normalized.replaceAll("[^0-9.\\-]", "");
    }

    private String normalizeComparableFormula(String value) {
        String normalized = safe(value)
                .replace('\u00A0', ' ')
                .replace('·', '.')
                .replace('⋅', '.')
                .replace('•', '.');
        if (!normalized.matches(".*[A-Za-z].*") || !normalized.matches(".*\\d.*")) {
            return "";
        }
        return normalized.replaceAll("[\\s\\-_/(),\\[\\]{}]", "").toUpperCase(Locale.ROOT);
    }

    private String normalizeComparableName(String value) {
        String normalized = safe(value)
                .replace('\u00A0', ' ')
                .replaceAll("\\([^)]*\\)", " ")
                .replace('&', ' ')
                .replace('/', ' ')
                .replace('-', ' ');
        if (normalized.isEmpty() || !normalized.matches(".*[A-Za-z].*")) {
            return "";
        }
        return normalized.replaceAll("[^A-Za-z0-9 ]", " ")
                .replaceAll("\\s+", " ")
                .trim()
                .toUpperCase(Locale.ROOT);
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, String>> rows, boolean isEn) {
        long ar6Count = rows.stream().filter(row -> !safe(row.get("ar6Value")).isEmpty()).count();
        long changedRows = rows.stream().filter(row -> hasRevisionShift(row)).count();
        Set<String> sections = new LinkedHashSet<>();
        for (Map<String, String> row : rows) {
            sections.add(safe(row.get("sectionCode")));
        }
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "DB Rows" : "DB 행 수", String.valueOf(rows.size()),
                isEn ? "Loaded from CUBRID-backed management table" : "CUBRID 기반 관리 테이블 적재 행 수"));
        cards.add(summaryCard(isEn ? "AR6 Rows" : "AR6 포함", String.valueOf(ar6Count),
                isEn ? "Rows carrying AR6 values" : "AR6 값이 있는 행 수"));
        cards.add(summaryCard(isEn ? "Revision Shift" : "개정 차이 행", String.valueOf(changedRows),
                isEn ? "Rows where AR4/AR5/AR6 values differ" : "AR4·AR5·AR6 값 차이가 있는 행 수"));
        cards.add(summaryCard(isEn ? "Sections" : "섹션 수", String.valueOf(sections.size()),
                isEn ? "PDF section families" : "PDF 섹션 계열 수"));
        return cards;
    }

    private boolean hasRevisionShift(Map<String, String> row) {
        String ar4 = safe(row.get("ar4Value"));
        String ar5 = safe(row.get("ar5Value"));
        String ar6 = safe(row.get("ar6Value"));
        return (!ar4.isEmpty() && !ar5.isEmpty() && !ar4.equals(ar5))
                || (!ar5.isEmpty() && !ar6.isEmpty() && !ar5.equals(ar6))
                || (!ar4.isEmpty() && !ar6.isEmpty() && !ar4.equals(ar6));
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private List<Map<String, String>> buildSectionOptions(List<Map<String, String>> rows, boolean isEn) {
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, String>> options = new ArrayList<>();
        options.add(optionRow("ALL", isEn ? "All Sections" : "전체"));
        for (Map<String, String> row : rows) {
            String sectionCode = safe(row.get("sectionCode"));
            if (sectionCode.isEmpty() || !seen.add(sectionCode)) {
                continue;
            }
            options.add(optionRow(sectionCode, safe(row.get("sectionLabel"))));
        }
        return options;
    }

    private Map<String, String> optionRow(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }

    private List<Map<String, String>> buildTableHeaderMeta(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(headerRow(isEn ? "Common chemical name or industrial designation" : "일반명 또는 산업 표기", "row"));
        rows.add(headerRow(isEn ? "Chemical formula" : "화학식", "row"));
        rows.add(headerRow(isEn ? "GWP values for 100-year time horizon" : "100년 기준 GWP 값", "group"));
        rows.add(headerRow(isEn ? "Fourth Assessment Report (AR4)" : "제4차 평가보고서 (AR4)", "leaf"));
        rows.add(headerRow(isEn ? "Fifth Assessment Report (AR5)" : "제5차 평가보고서 (AR5)", "leaf"));
        rows.add(headerRow(isEn ? "Sixth Assessment Report (AR6)" : "제6차 평가보고서 (AR6)", "leaf"));
        return rows;
    }

    private Map<String, String> headerRow(String label, String type) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("type", type);
        return row;
    }

    private List<Map<String, String>> buildDimensionCards(List<Map<String, String>> rows, boolean isEn) {
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(dimensionCard(
                isEn ? "Source Axis" : "출처 축",
                isEn ? "GHG Protocol August 2024 PDF" : "GHG Protocol 2024-08 PDF",
                isEn ? "Every row remains tied back to the official document and source page." : "모든 행이 공식 문서와 출처 페이지에 다시 연결됩니다."));
        cards.add(dimensionCard(
                isEn ? "Revision Axis" : "개정 축",
                isEn ? "AR4 -> AR5 -> AR6" : "AR4 -> AR5 -> AR6",
                isEn ? "Read values as revision deltas instead of a flat single metric." : "단일 값이 아니라 개정 간 차이로 읽을 수 있게 구성합니다."));
        cards.add(dimensionCard(
                isEn ? "Substance Axis" : "물질 축",
                isEn ? "Section families" : "섹션 계열",
                isEn ? "Major gases, HFC/HFO, fully fluorinated species, and Annex families are grouped for human scanning." : "주요가스, HFC/HFO, 완전불소화종, 부록 계열로 묶어 사람이 빠르게 읽을 수 있게 합니다."));
        return cards;
    }

    private Map<String, Object> buildDataIntegritySnapshot(List<Map<String, String>> rows, boolean isEn) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("tableName", TABLE_NAME);
        snapshot.put("documentTargetPath", DOCUMENT_TARGET_PATH);
        snapshot.put("expectedDocumentSha256", EXPECTED_DOCUMENT_SHA256);
        snapshot.put("dbRowCount", rows.size());
        snapshot.put("expectedRowCount", EXPECTED_ROW_COUNT);
        snapshot.put("seedRowCountOk", rows.size() == EXPECTED_ROW_COUNT);

        Map<String, Integer> expectedSectionCounts = expectedSectionCounts();
        Map<String, Integer> actualSectionCounts = new LinkedHashMap<>();
        for (Map<String, String> row : rows) {
            String sectionCode = safe(row.get("sectionCode"));
            if (sectionCode.isEmpty()) {
                continue;
            }
            actualSectionCounts.put(sectionCode, actualSectionCounts.getOrDefault(sectionCode, 0) + 1);
        }
        snapshot.put("sectionDistributionOk", expectedSectionCounts.equals(actualSectionCounts));

        List<Map<String, String>> checks = new ArrayList<>();
        checks.add(integrityCheck(
                isEn ? "PDF fingerprint" : "PDF 지문",
                expectedDocumentSha256Short(),
                verifyDocumentFingerprint() ? (isEn ? "Match" : "일치") : (isEn ? "Mismatch" : "불일치"),
                verifyDocumentFingerprint(),
                isEn ? "Source document hash matches the reference PDF copied into /opt/reference."
                        : "/opt/reference에 복사된 기준 PDF 해시가 참조값과 일치합니다."));
        checks.add(integrityCheck(
                isEn ? "Seed row count" : "시드 행 수",
                String.valueOf(EXPECTED_ROW_COUNT),
                String.valueOf(rows.size()),
                rows.size() == EXPECTED_ROW_COUNT,
                isEn ? "The working DB row count matches the curated August 2024 seed."
                        : "운영 DB 행 수가 2024-08 기준 시드와 일치합니다."));
        checks.add(integrityCheck(
                isEn ? "Section distribution" : "섹션 분포",
                String.valueOf(expectedSectionCounts.size()),
                String.valueOf(actualSectionCounts.size()),
                expectedSectionCounts.equals(actualSectionCounts),
                isEn ? "Section family counts match the curated PDF migration distribution."
                        : "섹션 계열별 행 수가 PDF 마이그레이션 기준 분포와 일치합니다."));

        List<Map<String, String>> anchorRows = new ArrayList<>();
        addAnchorRow(anchorRows, rows, "Carbon dioxide", "CO2", "1", "1", "1");
        addAnchorRow(anchorRows, rows, "Methane - non-fossil", "CH4", "25", "28", "27.0");
        addAnchorRow(anchorRows, rows, "Methane - fossil", "CH4", "", "30", "29.8");
        addAnchorRow(anchorRows, rows, "Nitrous oxide", "N2O", "298", "265", "273");
        addAnchorRow(anchorRows, rows, "Sulfur hexafluoride", "SF6", "22,800", "23,500", "24,300");
        addAnchorRow(anchorRows, rows, "HFC-23", "CHF3", "14,800", "12,400", "14,600");
        addAnchorRow(anchorRows, rows, "CFC-11", "CCl3F", "4,750", "4,660", "6,230");
        addAnchorRow(anchorRows, rows, "HCFC-22", "CHClF2", "1,810", "1,760", "1,960");
        addAnchorRow(anchorRows, rows, "(E)-1-chloro-3,3,3-trifluoroprop-1-ene", "trans-CF3CH=CHCl", "", "1", "");

        snapshot.put("pdfFingerprintOk", verifyDocumentFingerprint());
        snapshot.put("checks", checks);
        snapshot.put("sectionCounts", toCountRows(expectedSectionCounts, actualSectionCounts, isEn));
        snapshot.put("anchorRows", anchorRows);
        return snapshot;
    }

    private void addAnchorRow(List<Map<String, String>> anchorRows,
                              List<Map<String, String>> rows,
                              String commonName,
                              String formula,
                              String ar4,
                              String ar5,
                              String ar6) {
        Map<String, String> actual = null;
        for (Map<String, String> row : rows) {
            if (commonName.equals(safe(row.get("commonName")))) {
                actual = row;
                break;
            }
        }
        boolean match = actual != null
                && formula.equals(safe(actual.get("formula")))
                && ar4.equals(safe(actual.get("ar4Value")))
                && ar5.equals(safe(actual.get("ar5Value")))
                && ar6.equals(safe(actual.get("ar6Value")));

        Map<String, String> anchor = new LinkedHashMap<>();
        anchor.put("commonName", commonName);
        anchor.put("expectedFormula", formula);
        anchor.put("expectedAr4Value", ar4);
        anchor.put("expectedAr5Value", ar5);
        anchor.put("expectedAr6Value", ar6);
        anchor.put("actualFormula", actual == null ? "" : safe(actual.get("formula")));
        anchor.put("actualAr4Value", actual == null ? "" : safe(actual.get("ar4Value")));
        anchor.put("actualAr5Value", actual == null ? "" : safe(actual.get("ar5Value")));
        anchor.put("actualAr6Value", actual == null ? "" : safe(actual.get("ar6Value")));
        anchor.put("ok", match ? "Y" : "N");
        anchorRows.add(anchor);
    }

    private List<Map<String, String>> toCountRows(Map<String, Integer> expected, Map<String, Integer> actual, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : expected.entrySet()) {
            String sectionCode = entry.getKey();
            Map<String, String> row = new LinkedHashMap<>();
            row.put("sectionCode", sectionCode);
            row.put("sectionLabel", resolveSectionLabel(sectionCode, isEn));
            row.put("expectedCount", String.valueOf(entry.getValue()));
            row.put("actualCount", String.valueOf(actual.getOrDefault(sectionCode, 0)));
            row.put("ok", entry.getValue().equals(actual.getOrDefault(sectionCode, 0)) ? "Y" : "N");
            rows.add(row);
        }
        return rows;
    }

    private Map<String, Integer> expectedSectionCounts() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        counts.put("MAJOR_GHG", 6);
        counts.put("HFC_HFO", 50);
        counts.put("FULLY_FLUORINATED", 27);
        counts.put("CFC", 14);
        counts.put("HCFC", 23);
        counts.put("CHLOROCARBON", 11);
        counts.put("BROMO_HALON", 16);
        counts.put("HALOGENATED_OXYGENATES", 119);
        return counts;
    }

    private Map<String, String> integrityCheck(String title, String expected, String actual, boolean ok, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("expected", expected);
        row.put("actual", actual);
        row.put("ok", ok ? "Y" : "N");
        row.put("description", description);
        return row;
    }

    private boolean verifyDocumentFingerprint() {
        if (documentFingerprintOkCache != null) {
            return documentFingerprintOkCache;
        }
        try {
            Path path = Path.of(DOCUMENT_TARGET_PATH);
            if (!Files.exists(path)) {
                return false;
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(Files.readAllBytes(path));
            boolean fingerprintOk = EXPECTED_DOCUMENT_SHA256.equalsIgnoreCase(HexFormat.of().formatHex(hash));
            documentFingerprintOkCache = fingerprintOk;
            return fingerprintOk;
        } catch (IOException | NoSuchAlgorithmException e) {
            log.warn("Failed to verify PDF fingerprint for {}", DOCUMENT_TARGET_PATH, e);
            return false;
        }
    }

    private String expectedDocumentSha256Short() {
        return EXPECTED_DOCUMENT_SHA256.substring(0, 12) + "...";
    }

    private Map<String, String> dimensionCard(String title, String value, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("body", body);
        return row;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> notes = new ArrayList<>();
        notes.add(noteRow(
                isEn ? "DB is the runtime source" : "실행 기준은 DB",
                isEn ? "The management page now seeds and reads from the CUBRID table ADMIN_EMISSION_GWP_VALUE instead of a local JSON working file."
                        : "관리 화면은 이제 로컬 JSON 작업 파일이 아니라 CUBRID 테이블 ADMIN_EMISSION_GWP_VALUE를 기준으로 시드·조회합니다."));
        notes.add(noteRow(
                isEn ? "PDF structure is preserved" : "PDF 표 구조 유지",
                isEn ? "The table keeps the official section breaks and the 100-year horizon header grouping from the source PDF."
                        : "표는 원문 PDF의 섹션 구분과 100년 기준 헤더 그룹 구조를 유지합니다."));
        notes.add(noteRow(
                isEn ? "Blank values remain intentional" : "빈 값은 의도된 공란",
                isEn ? "Blank columns mean the substance was not listed in that IPCC assessment report."
                        : "빈 열은 해당 물질이 그 IPCC 평가보고서에 수록되지 않았음을 의미합니다."));
        return notes;
    }

    private List<Map<String, String>> buildMethaneGuidance(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(isEn ? "Methane - non-fossil" : "메탄 - 비화석",
                isEn ? "Use for combustion and all other non-fugitive sources. AR6 27.0."
                        : "연소 및 일반 배출원에 사용합니다. AR6 값은 27.0입니다."));
        rows.add(noteRow(isEn ? "Methane - fossil" : "메탄 - 화석",
                isEn ? "Use for fossil-origin fugitive and process emissions. AR6 29.8."
                        : "화석기원 비산 및 공정배출에 사용합니다. AR6 값은 29.8입니다."));
        return rows;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("commonName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("formula")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("sectionLabel")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("ar4Value")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("ar5Value")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("ar6Value")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectRow(List<Map<String, String>> filtered, List<Map<String, String>> catalog, String rowId) {
        if (!rowId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (rowId.equals(safe(row.get("rowId")))) {
                    return row;
                }
            }
            for (Map<String, String> row : catalog) {
                if (rowId.equals(safe(row.get("rowId")))) {
                    return row;
                }
            }
        }
        return filtered.isEmpty() ? (catalog.isEmpty() ? new LinkedHashMap<>() : catalog.get(0)) : filtered.get(0);
    }

    private Map<String, Map<String, String>> indexSeedRows(List<Map<String, String>> seedRows) {
        Map<String, Map<String, String>> index = new LinkedHashMap<>();
        for (Map<String, String> row : seedRows) {
            String rowId = safe(row.get("rowId"));
            if (!rowId.isEmpty()) {
                index.put(rowId, row);
            }
        }
        return index;
    }

    private List<Map<String, String>> annotateComparison(List<Map<String, String>> rows,
                                                         Map<String, Map<String, String>> seedIndex,
                                                         String pdfComparePolicy,
                                                         boolean includePdfCompare,
                                                         String pdfCompareRowId,
                                                         boolean isEn) {
        List<Map<String, String>> annotated = new ArrayList<>();
        for (Map<String, String> source : rows) {
            annotated.add(buildAnnotatedRow(source, seedIndex, pdfComparePolicy, includePdfCompare, pdfCompareRowId, isEn));
        }
        return annotated;
    }

    private void enrichPdfEvidence(List<Map<String, String>> rows,
                                   String pdfComparePolicy,
                                   String pdfCompareRowId,
                                   boolean isEn) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        String normalizedRowId = safe(pdfCompareRowId);
        for (Map<String, String> row : rows) {
            if (!normalizedRowId.isEmpty() && !normalizedRowId.equals(safe(row.get("rowId")))) {
                continue;
            }
            annotatePdfEvidence(row, pdfComparePolicy, isEn);
            if (!normalizedRowId.isEmpty()) {
                return;
            }
        }
    }

    private Map<String, String> buildAnnotatedRow(Map<String, String> source,
                                                  Map<String, Map<String, String>> seedIndex,
                                                  String pdfComparePolicy,
                                                  boolean includePdfCompare,
                                                  String pdfCompareRowId,
                                                  boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>(source);
        Map<String, String> seedRow = seedIndex.getOrDefault(safe(row.get("rowId")), null);
        annotateFieldComparison(row, seedRow, "sectionCode");
        annotateFieldComparison(row, seedRow, "commonName");
        annotateFieldComparison(row, seedRow, "formula");
        annotateFieldComparison(row, seedRow, "ar4Value");
        annotateFieldComparison(row, seedRow, "ar5Value");
        annotateFieldComparison(row, seedRow, "ar6Value");
        annotateFieldComparison(row, seedRow, "note");

        List<String> mismatchLabels = new ArrayList<>();
        collectMismatchLabel(row, "sectionCode", isEn ? "Section" : "섹션", mismatchLabels);
        collectMismatchLabel(row, "commonName", isEn ? "Common name" : "물질명", mismatchLabels);
        collectMismatchLabel(row, "formula", isEn ? "Formula" : "화학식", mismatchLabels);
        collectMismatchLabel(row, "ar4Value", "AR4", mismatchLabels);
        collectMismatchLabel(row, "ar5Value", "AR5", mismatchLabels);
        collectMismatchLabel(row, "ar6Value", "AR6", mismatchLabels);
        collectMismatchLabel(row, "note", isEn ? "Note" : "비고", mismatchLabels);

        boolean hasSeedRow = seedRow != null;
        row.put("compareHasReference", hasSeedRow ? "Y" : "N");
        row.put("compareMismatchCount", String.valueOf(mismatchLabels.size()));
        row.put("compareMismatchLabels", String.join(", ", mismatchLabels));
        row.put("compareStatus", !hasSeedRow
                ? "EXTRA"
                : mismatchLabels.isEmpty() ? "MATCH" : "DIFF");
        row.put("compareStatusLabel",
                !hasSeedRow
                        ? (isEn ? "Extra row" : "정본 외 행")
                        : mismatchLabels.isEmpty()
                        ? (isEn ? "Matches reference" : "정본 일치")
                        : (isEn ? "Mismatch" : "불일치"));
        boolean shouldLoadPdfEvidence = includePdfCompare
                && (pdfCompareRowId.isEmpty() || pdfCompareRowId.equals(safe(row.get("rowId"))));
        if (shouldLoadPdfEvidence) {
            annotatePdfEvidence(row, pdfComparePolicy, isEn);
        } else {
            annotateDeferredPdfEvidence(row, pdfComparePolicy, isEn);
        }
        return row;
    }

    private void annotateDeferredPdfEvidence(Map<String, String> row, String pdfComparePolicy, boolean isEn) {
        row.put("pdfCompareStatus", "");
        row.put("pdfCompareStatusLabel", "");
        row.put("pdfComparePage", "");
        row.put("pdfCompareSnippet", "");
        row.put("pdfCompareSource", "");
        row.put("pdfCompareSourceLabel", "");
        row.put("pdfCompareDetail", "");
        row.put("pdfComparePolicy", normalizePdfComparePolicy(pdfComparePolicy));
        row.put("pdfComparePolicyLabel", resolvePdfComparePolicyLabel(pdfComparePolicy, isEn));
    }

    private void annotateFieldComparison(Map<String, String> row, Map<String, String> seedRow, String key) {
        String actual = safe(row.get(key));
        String reference = seedRow == null ? "" : safe(seedRow.get(key));
        row.put("reference" + capitalize(key), reference);
        row.put("diff" + capitalize(key), seedRow != null && !actual.equals(reference) ? "Y" : "N");
    }

    private void collectMismatchLabel(Map<String, String> row, String key, String label, List<String> mismatchLabels) {
        if ("Y".equals(row.get("diff" + capitalize(key)))) {
            mismatchLabels.add(label);
        }
    }

    private List<String> buildMismatchFieldList(Map<String, String> row) {
        List<String> fields = new ArrayList<>();
        if ("Y".equals(row.get("diffSectionCode"))) fields.add("sectionCode");
        if ("Y".equals(row.get("diffCommonName"))) fields.add("commonName");
        if ("Y".equals(row.get("diffFormula"))) fields.add("formula");
        if ("Y".equals(row.get("diffAr4Value"))) fields.add("ar4Value");
        if ("Y".equals(row.get("diffAr5Value"))) fields.add("ar5Value");
        if ("Y".equals(row.get("diffAr6Value"))) fields.add("ar6Value");
        if ("Y".equals(row.get("diffNote"))) fields.add("note");
        return fields;
    }

    private void annotatePdfEvidence(Map<String, String> row, String pdfComparePolicy, boolean isEn) {
        PdfReferenceCatalog catalog = loadPdfReferenceCatalog();
        if (!catalog.available) {
            row.put("pdfCompareStatus", "UNAVAILABLE");
            row.put("pdfCompareStatusLabel", isEn ? "PDF unavailable" : "PDF 없음");
            row.put("pdfComparePage", "");
            row.put("pdfCompareSnippet", "");
            row.put("pdfCompareSource", "");
            row.put("pdfCompareSourceLabel", "");
            row.put("pdfComparePolicy", normalizePdfComparePolicy(pdfComparePolicy));
            row.put("pdfComparePolicyLabel", resolvePdfComparePolicyLabel(pdfComparePolicy, isEn));
            return;
        }
        String normalizedPolicy = normalizePdfComparePolicy(pdfComparePolicy);
        PdfLineMatch match = findPdfLineMatch(row, catalog.lines, normalizedPolicy);
        row.put("pdfCompareStatus", match.status);
        row.put("pdfCompareStatusLabel", resolvePdfCompareStatusLabel(match.status, isEn));
        row.put("pdfComparePage", match.pageLabel);
        row.put("pdfCompareSnippet", match.snippet);
        row.put("pdfCompareSource", match.sourceType);
        row.put("pdfCompareSourceLabel", resolvePdfCompareSourceLabel(match.sourceType, isEn));
        row.put("pdfCompareDetail", resolvePdfCompareDetailLabel(match.detail, isEn));
        row.put("pdfComparePolicy", normalizedPolicy);
        row.put("pdfComparePolicyLabel", resolvePdfComparePolicyLabel(normalizedPolicy, isEn));
    }

    private PdfLineMatch findPdfLineMatch(Map<String, String> row, List<PdfCatalogLine> lines, String pdfComparePolicy) {
        String commonName = safe(row.get("commonName"));
        String formula = safe(row.get("formula"));
        String ar4 = safe(row.get("ar4Value"));
        String ar5 = safe(row.get("ar5Value"));
        String ar6 = safe(row.get("ar6Value"));
        PdfLineMatch bestMatch = null;
        int bestScore = -1;
        String normalizedPolicy = normalizePdfComparePolicy(pdfComparePolicy);
        for (int index = 0; index < lines.size(); index++) {
            PdfCatalogLine current = lines.get(index);
            if (!supportsPdfComparePolicy(normalizedPolicy, current.sourceType)) {
                continue;
            }
            for (int width = 1; width <= MAX_PDF_CANDIDATE_WIDTH; width++) {
                String candidate = buildPdfCandidate(lines, index, width);
                if (candidate.isEmpty()) {
                    continue;
                }
                boolean nameHit = containsPdfToken(candidate, commonName);
                boolean formulaHit = containsPdfToken(candidate, formula);
                int valueHitCount = 0;
                if (containsPdfToken(candidate, ar4)) valueHitCount++;
                if (containsPdfToken(candidate, ar5)) valueHitCount++;
                if (containsPdfToken(candidate, ar6)) valueHitCount++;
                int score = (nameHit ? 4 : 0) + (formulaHit ? 3 : 0) + valueHitCount;
                if (score <= 0) {
                    continue;
                }
                String status = score >= 6 || ((nameHit || formulaHit) && valueHitCount >= 2)
                        ? "MATCH"
                        : ((nameHit || formulaHit) || valueHitCount >= 1 ? "PARTIAL" : "MISSING");
                String detail = resolvePdfMatchDetail(nameHit, formulaHit, valueHitCount);
                if (isBetterPdfLineMatch(score, status, current.sourceType, bestScore, bestMatch, normalizedPolicy)) {
                    bestScore = score;
                    bestMatch = new PdfLineMatch(status, current.pageLabel, candidate, detail, current.sourceType);
                }
            }
        }
        return bestMatch == null ? new PdfLineMatch("MISSING", "", "", "NO_TOKEN_MATCH", "") : bestMatch;
    }

    private boolean supportsPdfComparePolicy(String policy, String sourceType) {
        if (PDF_COMPARE_POLICY_TEXT_ONLY.equals(policy)) {
            return "TEXT".equals(safe(sourceType));
        }
        return true;
    }

    private boolean isBetterPdfLineMatch(int score,
                                         String status,
                                         String sourceType,
                                         int bestScore,
                                         PdfLineMatch bestMatch,
                                         String policy) {
        if (score > bestScore) {
            return true;
        }
        if (score < bestScore) {
            return false;
        }
        if (bestMatch == null) {
            return true;
        }
        if ("MATCH".equals(status) && !"MATCH".equals(bestMatch.status)) {
            return true;
        }
        if ("MATCH".equals(bestMatch.status) && !"MATCH".equals(status)) {
            return false;
        }
        if (PDF_COMPARE_POLICY_OCR_PREFERRED.equals(policy)) {
            return "OCR".equals(safe(sourceType)) && !"OCR".equals(safe(bestMatch.sourceType));
        }
        return false;
    }

    private String buildPdfCandidate(List<PdfCatalogLine> lines, int startIndex, int width) {
        if (startIndex < 0 || startIndex >= lines.size()) {
            return "";
        }
        PdfCatalogLine first = lines.get(startIndex);
        List<String> parts = new ArrayList<>();
        for (int offset = 0; offset < width && startIndex + offset < lines.size(); offset++) {
            PdfCatalogLine line = lines.get(startIndex + offset);
            if (!first.pageLabel.equals(line.pageLabel)) {
                break;
            }
            parts.add(line.text);
        }
        return String.join(" / ", parts);
    }

    private String resolvePdfCompareStatusLabel(String status, boolean isEn) {
        switch (status) {
            case "MATCH":
                return isEn ? "PDF matched" : "PDF 일치";
            case "PARTIAL":
                return isEn ? "PDF partial" : "PDF 부분 일치";
            case "MISSING":
                return isEn ? "PDF unmatched" : "PDF 미일치";
            case "UNAVAILABLE":
                return isEn ? "PDF unavailable" : "PDF 없음";
            default:
                return status;
        }
    }

    private String resolvePdfMatchDetail(boolean nameHit, boolean formulaHit, int valueHitCount) {
        if (nameHit && formulaHit && valueHitCount >= 2) {
            return "NAME_FORMULA_MULTI_VALUE";
        }
        if (nameHit && formulaHit && valueHitCount == 1) {
            return "NAME_FORMULA_SINGLE_VALUE";
        }
        if (nameHit && !formulaHit && valueHitCount >= 1) {
            return "NAME_AND_VALUE";
        }
        if (!nameHit && formulaHit && valueHitCount >= 1) {
            return "FORMULA_AND_VALUE";
        }
        if (nameHit) {
            return "NAME_ONLY";
        }
        if (formulaHit) {
            return "FORMULA_ONLY";
        }
        if (valueHitCount >= 2) {
            return "VALUE_MULTI_ONLY";
        }
        if (valueHitCount == 1) {
            return "VALUE_ONLY";
        }
        return "NO_TOKEN_MATCH";
    }

    private String resolvePdfCompareDetailLabel(String detail, boolean isEn) {
        switch (safe(detail)) {
            case "NAME_FORMULA_MULTI_VALUE":
                return isEn ? "Name, formula, and multiple values matched" : "물질명, 화학식, 복수 값 일치";
            case "NAME_FORMULA_SINGLE_VALUE":
                return isEn ? "Name, formula, and one value matched" : "물질명, 화학식, 단일 값 일치";
            case "NAME_AND_VALUE":
                return isEn ? "Name and value matched" : "물질명과 값 일치";
            case "FORMULA_AND_VALUE":
                return isEn ? "Formula and value matched" : "화학식과 값 일치";
            case "NAME_ONLY":
                return isEn ? "Name only matched" : "물질명만 일치";
            case "FORMULA_ONLY":
                return isEn ? "Formula only matched" : "화학식만 일치";
            case "VALUE_MULTI_ONLY":
                return isEn ? "Multiple values matched" : "복수 값만 일치";
            case "VALUE_ONLY":
                return isEn ? "Single value matched" : "단일 값만 일치";
            case "NO_TOKEN_MATCH":
                return isEn ? "No reliable token match" : "신뢰할 만한 토큰 일치 없음";
            default:
                return "";
        }
    }

    private String resolvePdfCompareSourceLabel(String sourceType, boolean isEn) {
        switch (safe(sourceType)) {
            case "OCR":
                return isEn ? "OCR image" : "OCR 이미지";
            case "TEXT":
                return isEn ? "PDF text" : "PDF 본문";
            default:
                return "";
        }
    }

    private List<Map<String, String>> buildPdfComparePolicyOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(option(PDF_COMPARE_POLICY_AUTO, isEn ? "Auto (text first, OCR fallback)" : "자동 (본문 우선, OCR 보조)"));
        options.add(option(PDF_COMPARE_POLICY_TEXT_ONLY, isEn ? "PDF text only" : "PDF 본문만"));
        options.add(option(PDF_COMPARE_POLICY_OCR_PREFERRED, isEn ? "OCR preferred" : "OCR 우선"));
        return options;
    }

    private Map<String, String> option(String value, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("value", value);
        option.put("label", label);
        return option;
    }

    private String normalizePdfComparePolicy(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        switch (normalized) {
            case PDF_COMPARE_POLICY_TEXT_ONLY:
            case PDF_COMPARE_POLICY_OCR_PREFERRED:
                return normalized;
            case PDF_COMPARE_POLICY_AUTO:
            default:
                return PDF_COMPARE_POLICY_AUTO;
        }
    }

    private String normalizePdfCompareScope(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if (PDF_COMPARE_SCOPE_ALL.equals(normalized)) {
            return PDF_COMPARE_SCOPE_ALL;
        }
        return PDF_COMPARE_SCOPE_SELECTED;
    }

    private String resolvePdfComparePolicyLabel(String policy, boolean isEn) {
        switch (normalizePdfComparePolicy(policy)) {
            case PDF_COMPARE_POLICY_TEXT_ONLY:
                return isEn ? "PDF text only" : "PDF 본문만";
            case PDF_COMPARE_POLICY_OCR_PREFERRED:
                return isEn ? "OCR preferred" : "OCR 우선";
            case PDF_COMPARE_POLICY_AUTO:
            default:
                return isEn ? "Auto (text first, OCR fallback)" : "자동 (본문 우선, OCR 보조)";
        }
    }

    private List<Map<String, String>> buildComparisonSummary(List<Map<String, String>> rows, boolean isEn) {
        int matchCount = 0;
        int mismatchCount = 0;
        int extraCount = 0;
        for (Map<String, String> row : rows) {
            String compareStatus = safe(row.get("compareStatus"));
            if ("MATCH".equals(compareStatus)) {
                matchCount++;
            } else if ("EXTRA".equals(compareStatus)) {
                extraCount++;
            } else if ("DIFF".equals(compareStatus)) {
                mismatchCount++;
            }
        }
        List<Map<String, String>> summary = new ArrayList<>();
        summary.add(summaryCard(
                isEn ? "Reference matches" : "정본 일치",
                String.valueOf(matchCount),
                isEn ? "Rows identical to the curated seed catalog." : "정본 시드와 동일한 행 수"));
        summary.add(summaryCard(
                isEn ? "Mismatched rows" : "불일치 행",
                String.valueOf(mismatchCount),
                isEn ? "Rows whose stored values differ from the seed reference." : "저장값이 정본 시드와 다른 행 수"));
        summary.add(summaryCard(
                isEn ? "Extra rows" : "추가 행",
                String.valueOf(extraCount),
                isEn ? "Rows that do not exist in the seed reference catalog." : "정본 시드에 없는 추가 행 수"));
        return summary;
    }

    private List<Map<String, String>> buildPdfComparisonSummary(List<Map<String, String>> rows, boolean isEn) {
        int matchCount = 0;
        int partialCount = 0;
        int missingCount = 0;
        int unavailableCount = 0;
        for (Map<String, String> row : rows) {
            String status = safe(row.get("pdfCompareStatus"));
            if ("MATCH".equals(status)) {
                matchCount++;
            } else if ("PARTIAL".equals(status)) {
                partialCount++;
            } else if ("MISSING".equals(status)) {
                missingCount++;
            } else if ("UNAVAILABLE".equals(status)) {
                unavailableCount++;
            }
        }
        List<Map<String, String>> summary = new ArrayList<>();
        summary.add(summaryCard(
                isEn ? "PDF matched" : "PDF 일치",
                String.valueOf(matchCount),
                isEn ? "Rows matched by the PDF parser with enough evidence." : "PDF 파서가 충분한 근거로 일치시킨 행 수"));
        summary.add(summaryCard(
                isEn ? "PDF partial" : "PDF 부분 일치",
                String.valueOf(partialCount),
                isEn ? "Rows with partial PDF evidence only." : "PDF 근거가 일부만 잡힌 행 수"));
        summary.add(summaryCard(
                isEn ? "PDF unmatched" : "PDF 미일치",
                String.valueOf(missingCount),
                isEn ? "Rows with no reliable PDF line match." : "신뢰할 만한 PDF 행 매칭이 없는 행 수"));
        if (unavailableCount > 0) {
            summary.add(summaryCard(
                    isEn ? "PDF unavailable" : "PDF 없음",
                    String.valueOf(unavailableCount),
                    isEn ? "Rows evaluated while the PDF was unavailable." : "PDF를 읽을 수 없는 상태에서 평가된 행 수"));
        }
        return summary;
    }

    private String resolvePdfOcrStatusLabel(String status, boolean isEn) {
        switch (safe(status)) {
            case "DEFERRED":
                return isEn ? "Image OCR loads on demand" : "이미지 OCR은 필요 시 로드";
            case "ENABLED":
                return isEn ? "Image OCR enabled (kor+eng)" : "이미지 OCR 사용 중 (kor+eng)";
            case "UNAVAILABLE":
                return isEn ? "Image OCR unavailable" : "이미지 OCR 사용 불가";
            default:
                return "";
        }
    }

    private String resolvePdfOcrStatusDetailLabel(String detail, boolean isEn) {
        switch (safe(detail)) {
            case "NOT_REQUESTED":
                return isEn ? "Reference comparison will parse the PDF only after you enable it." : "정본 대조를 켠 뒤에만 PDF를 파싱합니다.";
            case "READY":
                return isEn ? "Tesseract and Korean language data are ready." : "Tesseract와 한국어 언어 데이터가 준비되었습니다.";
            case "COMMAND_MISSING":
                return isEn ? "Tesseract command is not installed on this server." : "이 서버에 Tesseract 명령이 설치되어 있지 않습니다.";
            case "KOR_LANG_MISSING":
                return isEn ? "Tesseract exists but Korean language data is missing." : "Tesseract는 있으나 한국어 언어 데이터가 없습니다.";
            case "LANG_CHECK_FAILED":
                return isEn ? "Tesseract language check failed." : "Tesseract 언어 확인에 실패했습니다.";
            case "COMMAND_FAILED":
                return isEn ? "Tesseract command exists but did not start correctly." : "Tesseract 명령은 있으나 정상 실행되지 않았습니다.";
            default:
                return "";
        }
    }

    private String resolvePdfOcrInstallHint(boolean isEn) {
        return isEn
                ? "Install command: sudo apt-get install -y tesseract-ocr tesseract-ocr-kor"
                : "설치 명령: sudo apt-get install -y tesseract-ocr tesseract-ocr-kor";
    }

    private String capitalize(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private List<Map<String, String>> localizeRows(List<Map<String, Object>> rows, boolean isEn) {
        List<Map<String, String>> localized = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            localized.add(localizeRow(row, isEn));
        }
        localized.sort(Comparator
                .comparingInt((Map<String, String> row) -> safeInt(row.get("sectionOrder")))
                .thenComparingInt(row -> safeInt(row.get("sortOrder")))
                .thenComparing(row -> safe(row.get("commonName"))));
        return localized;
    }

    private Map<String, String> localizeRow(Map<String, Object> source, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("rowId", safe(stringValue(source.get("rowId"))));
        row.put("sectionCode", safe(stringValue(source.get("sectionCode"))));
        row.put("sectionOrder", safe(stringValue(source.get("sectionOrder"))));
        row.put("sectionLabel", resolveSectionLabel(safe(stringValue(source.get("sectionCode"))), isEn));
        row.put("commonName", safe(stringValue(source.get("commonName"))));
        row.put("formula", safe(stringValue(source.get("formula"))));
        row.put("ar4Value", safe(stringValue(source.get("ar4Value"))));
        row.put("ar5Value", safe(stringValue(source.get("ar5Value"))));
        row.put("ar6Value", safe(stringValue(source.get("ar6Value"))));
        row.put("source", safe(stringValue(source.get("source"))));
        row.put("manualInputValue", safe(stringValue(source.get("manualInputValue"))));
        row.put("note", safe(stringValue(source.get("note"))));
        row.put("sortOrder", safe(stringValue(source.get("sortOrder"))));
        row.put("sourcePageNo", safe(stringValue(source.get("sourcePageNo"))));
        row.put("lastChangedAt", safe(stringValue(source.get("lastChangedAt"))));
        row.put("lastChangedBy", safe(stringValue(source.get("lastChangedBy"))));
        return row;
    }

    private Map<String, String> findLocalizedRow(String rowId, boolean isEn) {
        Map<String, Object> row = adminEmissionGwpValueMapper.selectByRowId(rowId);
        return row == null ? new LinkedHashMap<>() : localizeRow(row, isEn);
    }

    private List<Map<String, Object>> loadAll() {
        return adminEmissionGwpValueMapper.selectAll();
    }

    private List<Map<String, String>> loadSeedRows() {
        if (seedRowsCache != null) {
            return seedRowsCache;
        }
        try (InputStream inputStream = getClass().getResourceAsStream("/data/admin/emission-gwp-values/seed.psv")) {
            if (inputStream == null) {
                throw new IllegalStateException("seed.psv not found");
            }
            String raw = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
            List<Map<String, String>> rows = new ArrayList<>();
            int order = 1;
            for (String line : raw.split("\\R")) {
                String normalized = line.trim();
                if (normalized.isEmpty() || normalized.startsWith("#")) {
                    continue;
                }
                String[] parts = normalized.split("\\|", -1);
                if (parts.length < 7) {
                    continue;
                }
                Map<String, String> row = new LinkedHashMap<>();
                row.put("rowId", parts[0].trim());
                row.put("sectionCode", parts[1].trim());
                row.put("commonName", parts[2].trim());
                row.put("formula", parts[3].trim());
                row.put("ar4Value", parts[4].trim());
                row.put("ar5Value", parts[5].trim());
                row.put("ar6Value", parts[6].trim());
                row.put("note", parts.length > 7 ? parts[7].trim() : "");
                row.put("sortOrder", String.valueOf(order++));
                row.put("lastChangedAt", "2024-08-07 00:00");
                row.put("lastChangedBy", "seed");
                rows.add(row);
            }
            seedRowsCache = rows;
            return rows;
        } catch (IOException e) {
            throw new IllegalStateException("failed to load emission GWP seed", e);
        }
    }

    private String resolveSectionLabel(String sectionCode, boolean isEn) {
        switch (sectionCode) {
            case "MAJOR_GHG":
                return isEn ? "Major Greenhouse Gases" : "주요 온실가스";
            case "HFC_HFO":
                return isEn ? "Hydrofluorocarbons (includes unsaturated hydrofluorocarbons)" : "수소불화탄소 및 불포화 HFC";
            case "FULLY_FLUORINATED":
                return isEn ? "Fully Fluorinated Species" : "완전 불소화 종";
            case "CFC":
                return isEn ? "Chlorofluorocarbons" : "염화불화탄소";
            case "HCFC":
                return isEn ? "Hydrochlorofluorocarbon (includes unsaturated species)" : "수소염화불화탄소";
            case "CHLOROCARBON":
                return isEn ? "Chlorocarbons and Hydrochlorocarbons" : "염소계 탄화수소 및 수소염화탄화수소";
            case "BROMO_HALON":
                return isEn ? "Bromocarbons, Hydrobromocarbons and Halons" : "브롬계 탄화수소 및 할론";
            case "HALOGENATED_OXYGENATES":
                return isEn ? "Halogenated Alcohols, Ethers, Furans, Aldehydes and Ketones"
                        : "할로겐화 알코올, 에테르, 퓨란, 알데하이드 및 케톤";
            default:
                return sectionCode;
        }
    }

    private int resolveSectionOrder(String sectionCode) {
        switch (sectionCode) {
            case "MAJOR_GHG":
                return 1;
            case "HFC_HFO":
                return 2;
            case "FULLY_FLUORINATED":
                return 3;
            case "CFC":
                return 4;
            case "HCFC":
                return 5;
            case "CHLOROCARBON":
                return 6;
            case "BROMO_HALON":
                return 7;
            case "HALOGENATED_OXYGENATES":
                return 8;
            default:
                return 99;
        }
    }

    private int resolveSourcePage(String sectionCode) {
        switch (sectionCode) {
            case "MAJOR_GHG":
            case "HFC_HFO":
                return 2;
            case "FULLY_FLUORINATED":
                return 3;
            case "CFC":
            case "HCFC":
                return 5;
            case "CHLOROCARBON":
            case "BROMO_HALON":
                return 6;
            case "HALOGENATED_OXYGENATES":
                return 7;
            default:
                return 0;
        }
    }

    private String nextRowId() {
        int max = adminEmissionGwpValueMapper.selectMaxRowNumber();
        return "GWP_" + String.format(Locale.ROOT, "%04d", max + 1);
    }

    private int safeInt(String value) {
        try {
            return Integer.parseInt(safe(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String normalizeSectionCode(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        switch (normalized) {
            case "MAJOR_GHG":
            case "HFC_HFO":
            case "FULLY_FLUORINATED":
            case "CFC":
            case "HCFC":
            case "CHLOROCARBON":
            case "BROMO_HALON":
            case "HALOGENATED_OXYGENATES":
                return normalized;
            default:
                return "";
        }
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class PdfReferenceCatalog {
        private final boolean available;
        private final List<PdfCatalogLine> lines;
        private final String ocrStatus;
        private final String ocrStatusDetail;

        private PdfReferenceCatalog(boolean available, List<PdfCatalogLine> lines, String ocrStatus, String ocrStatusDetail) {
            this.available = available;
            this.lines = lines;
            this.ocrStatus = ocrStatus;
            this.ocrStatusDetail = ocrStatusDetail;
        }

        private static PdfReferenceCatalog unavailable() {
            return new PdfReferenceCatalog(false, new ArrayList<PdfCatalogLine>(), "UNAVAILABLE", "COMMAND_MISSING");
        }

        private static PdfReferenceCatalog deferred() {
            return new PdfReferenceCatalog(false, new ArrayList<PdfCatalogLine>(), "DEFERRED", "NOT_REQUESTED");
        }
    }

    private static final class OcrAvailability {
        private final boolean available;
        private final String detail;

        private OcrAvailability(boolean available, String detail) {
            this.available = available;
            this.detail = detail;
        }
    }

    private static final class PdfCatalogLine {
        private final String pageLabel;
        private final String text;
        private final String sourceType;

        private PdfCatalogLine(String pageLabel, String text, String sourceType) {
            this.pageLabel = pageLabel;
            this.text = text;
            this.sourceType = sourceType;
        }
    }

    private static final class PdfLineMatch {
        private final String status;
        private final String pageLabel;
        private final String snippet;
        private final String detail;
        private final String sourceType;

        private PdfLineMatch(String status, String pageLabel, String snippet, String detail, String sourceType) {
            this.status = status;
            this.pageLabel = pageLabel;
            this.snippet = snippet;
            this.detail = detail;
            this.sourceType = sourceType;
        }
    }
}
