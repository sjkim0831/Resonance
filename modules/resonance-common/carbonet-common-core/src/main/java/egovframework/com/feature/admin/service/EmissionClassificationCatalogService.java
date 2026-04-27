package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.model.ComDefaultCodeVO;
import egovframework.com.common.service.CmmnDetailCode;
import egovframework.com.common.service.CommonCodeService;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
public class EmissionClassificationCatalogService {

    private static final String CODE_ID = "EMLCI";
    private static final Path SEED_PATH = Paths.get("data", "admin", "emission-classification", "lci-classification-seed.json");

    private final CommonCodeService commonCodeService;
    private final ObjectMapper objectMapper;

    public EmissionClassificationCatalogService(CommonCodeService commonCodeService,
                                                ObjectMapper objectMapper) {
        this.commonCodeService = commonCodeService;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> buildPayload(boolean isEn) {
        CatalogLoadResult loadResult = loadCatalogRows();
        List<Map<String, Object>> rows = loadResult.rows;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("codeId", CODE_ID);
        payload.put("catalogSource", loadResult.source);
        payload.put("catalogSourceLabel", isEn
                ? ("COMMON_CODE".equals(loadResult.source) ? "Common code" : "Seed file")
                : ("COMMON_CODE".equals(loadResult.source) ? "공통코드" : "시드 파일"));
        payload.put("title", isEn ? "LCI DB Classification Catalog" : "LCI DB 분류 체계");
        payload.put("description", isEn
                ? "Shared major, middle, and small classification catalog derived from the LCI DB spreadsheet."
                : "LCI DB 분류 정의 엑셀에서 정리한 대분류, 중분류, 소분류 공통 카탈로그입니다.");
        payload.put("summaryCards", buildSummaryCards(rows, isEn));
        payload.put("rows", rows);
        payload.put("tree", buildTree(rows));
        return payload;
    }

    public void enrichCategoryItems(Object itemsObject) {
        if (!(itemsObject instanceof List<?>)) {
            return;
        }
        Map<String, Map<String, Object>> aliasIndex = indexByAlias(loadCatalogRows().rows);
        for (Object item : (List<?>) itemsObject) {
            if (!(item instanceof EmissionCategoryVO)) {
                continue;
            }
            EmissionCategoryVO category = (EmissionCategoryVO) item;
            String alias = safe(category.getSubCode()).toUpperCase(Locale.ROOT);
            if (alias.isEmpty()) {
                continue;
            }
            Map<String, Object> matched = aliasIndex.get(alias);
            if (matched == null || matched.isEmpty()) {
                continue;
            }
            category.setClassificationCode(safe(stringValue(matched.get("code"))));
            category.setClassificationPath(safe(stringValue(matched.get("pathLabel"))));
            category.setClassificationTierLabel(safe(stringValue(matched.get("tierLabel"))));
        }
    }

    private CatalogLoadResult loadCatalogRows() {
        List<Map<String, Object>> commonCodeRows = loadRowsFromCommonCode();
        if (!commonCodeRows.isEmpty()) {
            return new CatalogLoadResult(commonCodeRows, "COMMON_CODE");
        }
        return new CatalogLoadResult(loadRowsFromSeed(), "SEED_FILE");
    }

    private List<Map<String, Object>> loadRowsFromCommonCode() {
        if (commonCodeService == null) {
            return Collections.emptyList();
        }
        try {
            ComDefaultCodeVO request = new ComDefaultCodeVO();
            request.setCodeId(CODE_ID);
            List<CmmnDetailCode> detailCodes = commonCodeService.selectCmmCodeDetail(request);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (CmmnDetailCode detailCode : detailCodes) {
                rows.add(normalizeRow(
                        safe(detailCode == null ? null : detailCode.getCode()),
                        safe(detailCode == null ? null : detailCode.getCodeNm()),
                        safe(detailCode == null ? null : detailCode.getUseAt()),
                        parseMetadata(detailCode == null ? null : detailCode.getCodeDc())
                ));
            }
            return rows;
        } catch (Exception e) {
            log.warn("Failed to load LCI classification catalog from common code. codeId={}", CODE_ID, e);
            return Collections.emptyList();
        }
    }

    private List<Map<String, Object>> loadRowsFromSeed() {
        if (!Files.exists(SEED_PATH)) {
            return Collections.emptyList();
        }
        try {
            List<Map<String, Object>> rows = objectMapper.readValue(
                    Files.readString(SEED_PATH),
                    new TypeReference<List<Map<String, Object>>>() { }
            );
            List<Map<String, Object>> normalized = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                normalized.add(normalizeRow(
                        safe(stringValue(row.get("code"))),
                        safe(stringValue(row.get("label"))),
                        safe(stringValue(row.get("useAt"))),
                        row
                ));
            }
            return normalized;
        } catch (IOException e) {
            log.warn("Failed to load LCI classification seed file. path={}", SEED_PATH, e);
            return Collections.emptyList();
        }
    }

    private Map<String, Object> parseMetadata(String codeDc) {
        String normalized = safe(codeDc);
        if (!normalized.startsWith("{")) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(normalized, new TypeReference<Map<String, Object>>() { });
        } catch (IOException e) {
            log.warn("Failed to parse LCI classification metadata: {}", normalized, e);
            return new LinkedHashMap<>();
        }
    }

    private Map<String, Object> normalizeRow(String code,
                                             String label,
                                             String useAt,
                                             Map<String, Object> metadata) {
        Map<String, Object> row = new LinkedHashMap<>();
        String normalizedCode = safe(code);
        String level = firstNonBlank(
                safe(stringValue(metadata.get("level"))),
                inferLevel(normalizedCode)
        );
        String majorCode = firstNonBlank(safe(stringValue(metadata.get("majorCode"))), normalizedCode.length() >= 2 ? normalizedCode.substring(0, 2) : "");
        String middleCode = firstNonBlank(safe(stringValue(metadata.get("middleCode"))), normalizedCode.length() >= 4 ? normalizedCode.substring(0, 4) : "");
        String smallCode = firstNonBlank(safe(stringValue(metadata.get("smallCode"))), normalizedCode.length() >= 6 ? normalizedCode.substring(0, 6) : "");
        String majorName = firstNonBlank(
                safe(stringValue(metadata.get("majorName"))),
                "MAJOR".equals(level) ? label : ""
        );
        String middleName = firstNonBlank(
                safe(stringValue(metadata.get("middleName"))),
                "MIDDLE".equals(level) ? label : ""
        );
        String smallName = firstNonBlank(
                safe(stringValue(metadata.get("smallName"))),
                "SMALL".equals(level) ? label : ""
        );
        row.put("code", normalizedCode);
        row.put("level", level);
        row.put("label", label);
        row.put("majorCode", majorCode);
        row.put("majorName", majorName);
        row.put("middleCode", middleCode);
        row.put("middleName", middleName);
        row.put("smallCode", smallCode);
        row.put("smallName", smallName);
        row.put("tierLabel", safe(stringValue(metadata.get("tierLabel"))));
        List<String> aliases = normalizeAliases(metadata.get("aliases"));
        row.put("aliases", aliases);
        row.put("useAt", firstNonBlank(safe(stringValue(metadata.get("useAt"))), firstNonBlank(useAt, "Y")));
        row.put("pathLabel", buildPathLabel(majorName, middleName, smallName));
        return row;
    }

    private List<Map<String, String>> buildSummaryCards(List<Map<String, Object>> rows, boolean isEn) {
        int majorCount = 0;
        int middleCount = 0;
        int smallCount = 0;
        for (Map<String, Object> row : rows) {
            String level = safe(stringValue(row.get("level"))).toUpperCase(Locale.ROOT);
            if ("MAJOR".equals(level)) {
                majorCount += 1;
            } else if ("MIDDLE".equals(level)) {
                middleCount += 1;
            } else if ("SMALL".equals(level)) {
                smallCount += 1;
            }
        }
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Major" : "대분류", String.valueOf(majorCount), isEn ? "Top-level industry groups" : "최상위 산업 분류"));
        cards.add(summaryCard(isEn ? "Middle" : "중분류", String.valueOf(middleCount), isEn ? "Operational categories" : "업무 대상 중분류"));
        cards.add(summaryCard(isEn ? "Small" : "소분류", String.valueOf(smallCount), isEn ? "Detailed production/process scopes" : "세부 생산물 또는 공정 범위"));
        cards.add(summaryCard(isEn ? "Code Group" : "공통코드", CODE_ID, isEn ? "Shared common-code group" : "공유 공통코드 그룹"));
        return cards;
    }

    private List<Map<String, Object>> buildTree(List<Map<String, Object>> rows) {
        Map<String, Map<String, Object>> majorMap = new LinkedHashMap<>();
        Map<String, Map<String, Object>> middleMap = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String level = safe(stringValue(row.get("level"))).toUpperCase(Locale.ROOT);
            if ("MAJOR".equals(level)) {
                Map<String, Object> major = new LinkedHashMap<>(row);
                major.put("middleRows", new ArrayList<Map<String, Object>>());
                majorMap.put(safe(stringValue(row.get("code"))), major);
            } else if ("MIDDLE".equals(level)) {
                Map<String, Object> middle = new LinkedHashMap<>(row);
                middle.put("smallRows", new ArrayList<Map<String, Object>>());
                middleMap.put(safe(stringValue(row.get("code"))), middle);
                Map<String, Object> major = majorMap.get(safe(stringValue(row.get("majorCode"))));
                if (major != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> middleRows = (List<Map<String, Object>>) major.get("middleRows");
                    middleRows.add(middle);
                }
            } else if ("SMALL".equals(level)) {
                Map<String, Object> middle = middleMap.get(safe(stringValue(row.get("middleCode"))));
                if (middle != null) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> smallRows = (List<Map<String, Object>>) middle.get("smallRows");
                    smallRows.add(new LinkedHashMap<>(row));
                }
            }
        }
        return new ArrayList<>(majorMap.values());
    }

    private Map<String, Map<String, Object>> indexByAlias(List<Map<String, Object>> rows) {
        Map<String, Map<String, Object>> index = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            for (String alias : normalizeAliases(row.get("aliases"))) {
                index.put(alias.toUpperCase(Locale.ROOT), row);
            }
        }
        return index;
    }

    private List<String> normalizeAliases(Object value) {
        Set<String> aliases = new LinkedHashSet<>();
        if (value instanceof List<?>) {
            for (Object item : (List<?>) value) {
                String alias = safe(stringValue(item)).toUpperCase(Locale.ROOT);
                if (!alias.isEmpty()) {
                    aliases.add(alias);
                }
            }
        } else {
            String alias = safe(stringValue(value)).toUpperCase(Locale.ROOT);
            if (!alias.isEmpty()) {
                aliases.add(alias);
            }
        }
        return new ArrayList<>(aliases);
    }

    private String inferLevel(String code) {
        if (code.length() >= 6) {
            return "SMALL";
        }
        if (code.length() >= 4) {
            return "MIDDLE";
        }
        return "MAJOR";
    }

    private String buildPathLabel(String majorName, String middleName, String smallName) {
        List<String> parts = new ArrayList<>();
        if (!safe(majorName).isEmpty()) {
            parts.add(majorName);
        }
        if (!safe(middleName).isEmpty()) {
            parts.add(middleName);
        }
        if (!safe(smallName).isEmpty()) {
            parts.add(smallName);
        }
        return String.join(" / ", parts);
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> card = new LinkedHashMap<>();
        card.put("title", title);
        card.put("value", value);
        card.put("description", description);
        return card;
    }

    private String firstNonBlank(String left, String right) {
        return safe(left).isEmpty() ? safe(right) : safe(left);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class CatalogLoadResult {
        private final List<Map<String, Object>> rows;
        private final String source;

        private CatalogLoadResult(List<Map<String, Object>> rows, String source) {
            this.rows = rows;
            this.source = source;
        }
    }
}
