package egovframework.com.feature.admin.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.doubleValue;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.safe;
import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.stringValue;

final class DefinitionFormulaPreviewService {
    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "emission-definition-studio", "definitions.json");

    DefinitionFormulaPreviewService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    Map<String, Object> preview(EmissionCategoryVO category, Integer tier, CalculationContext context) {
        Map<String, Object> draft = findMatchingDraft(category, tier);
        List<Map<String, Object>> formulaTree = asMapList(draft.get("formulaTree"));
        if (formulaTree.isEmpty()) {
            return Collections.emptyMap();
        }
        List<Map<String, Object>> trace = new ArrayList<>();
        PreviewStats stats = new PreviewStats();
        double total = evaluateBlocks(formulaTree, context, trace, null, stats);
        Map<String, Object> preview = new LinkedHashMap<>();
        preview.put("draftId", safe(stringValue(draft.get("draftId"))));
        preview.put("formula", safe(stringValue(draft.get("formula"))));
        preview.put("total", total);
        preview.put("trace", trace);
        preview.put("unresolvedCount", stats.unresolvedCount);
        preview.put("traceCount", trace.size());
        preview.put("promotable", stats.unresolvedCount == 0 && !Double.isNaN(total) && !Double.isInfinite(total));
        preview.put("runtimeMode", safe(stringValue(draft.get("runtimeMode"))).isEmpty() ? "AUTO" : safe(stringValue(draft.get("runtimeMode"))).toUpperCase(Locale.ROOT));
        preview.put("publishedVersionId", safe(stringValue(draft.get("publishedVersionId"))));
        return preview;
    }

    Map<String, Object> findPublishedDefinition(EmissionCategoryVO category, Integer tier) {
        return new LinkedHashMap<>(findMatchingDraft(category, tier));
    }

    private Map<String, Object> findMatchingDraft(EmissionCategoryVO category, Integer tier) {
        String categoryCode = safe(category == null ? null : category.getSubCode()).toUpperCase(Locale.ROOT);
        String tierLabel = "TIER " + (tier == null ? 0 : tier);
        Map<String, Map<String, Object>> drafts = loadAll();
        Map<String, Object> matched = new LinkedHashMap<>();
        String bestSavedAt = "";
        for (Map<String, Object> draft : drafts.values()) {
            if (!"PUBLISHED".equalsIgnoreCase(safe(stringValue(draft.get("status"))))) {
                continue;
            }
            if (!categoryCode.equals(safe(stringValue(draft.get("categoryCode"))).toUpperCase(Locale.ROOT))) {
                continue;
            }
            if (!tierLabel.equals(safe(stringValue(draft.get("tierLabel"))).replaceAll("\\s+", " ").trim().toUpperCase(Locale.ROOT))) {
                continue;
            }
            String candidateSavedAt = safe(stringValue(draft.get("publishedSavedAt")));
            if (candidateSavedAt.isEmpty()) {
                candidateSavedAt = safe(stringValue(draft.get("lastSavedAt")));
            }
            if (matched.isEmpty() || candidateSavedAt.compareTo(bestSavedAt) >= 0) {
                matched = draft;
                bestSavedAt = candidateSavedAt;
            }
        }
        return matched;
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(registryPath)) {
            return Collections.emptyMap();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, Object>> value = objectMapper.readValue(inputStream, new TypeReference<LinkedHashMap<String, Map<String, Object>>>() {});
            return value == null ? Collections.emptyMap() : value;
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }

    private double evaluateBlocks(List<Map<String, Object>> blocks,
                                  CalculationContext context,
                                  List<Map<String, Object>> trace,
                                  Integer rowIndex,
                                  PreviewStats stats) {
        double total = 0d;
        boolean first = true;
        for (Map<String, Object> block : blocks) {
            double current = evaluateBlock(block, context, trace, rowIndex, stats);
            String joiner = safe(stringValue(block.get("joiner")));
            if (first) {
                total = current;
                first = false;
                continue;
            }
            if ("-".equals(joiner)) {
                total -= current;
            } else if ("×".equals(joiner)) {
                total *= current;
            } else if ("÷".equals(joiner)) {
                total = current == 0d ? Double.NaN : total / current;
            } else {
                total += current;
            }
        }
        return total;
    }

    private double evaluateBlock(Map<String, Object> block,
                                 CalculationContext context,
                                 List<Map<String, Object>> trace,
                                 Integer rowIndex,
                                 PreviewStats stats) {
        String kind = safe(stringValue(block.get("kind")));
        if ("sum".equals(kind)) {
            List<Map<String, Object>> items = asMapList(block.get("items"));
            String iterator = safe(stringValue(block.get("iterator")));
            int rowCount = iteratorRowCount(items, context, iterator);
            double sum = 0d;
            for (int index = 1; index <= rowCount; index += 1) {
                double lineTotal = evaluateBlocks(items, context, trace, index, stats);
                trace.add(traceEntry(iterator + "[" + index + "]", buildExpression(items), lineTotal, ""));
                sum += lineTotal;
            }
            trace.add(traceEntry("SUM " + iterator, buildExpression(Collections.singletonList(block)), sum, ""));
            return sum;
        }
        if ("group".equals(kind)) {
            double result = evaluateBlocks(asMapList(block.get("items")), context, trace, rowIndex, stats);
            trace.add(traceEntry("group", buildExpression(Collections.singletonList(block)), result, ""));
            return result;
        }
        if ("fraction".equals(kind)) {
            double numerator = evaluateBlocks(asMapList(block.get("numerator")), context, trace, rowIndex, stats);
            double denominator = evaluateBlocks(asMapList(block.get("denominator")), context, trace, rowIndex, stats);
            double result = denominator == 0d ? Double.NaN : numerator / denominator;
            trace.add(traceEntry("fraction", buildExpression(Collections.singletonList(block)), result, ""));
            return result;
        }
        String token = safe(stringValue(block.get("token")));
        TokenResolution resolved = resolveToken(token, context, rowIndex);
        if (resolved.unresolved) {
            stats.unresolvedCount += 1;
        }
        trace.add(traceEntry(token, token, resolved.value, resolved.note));
        return resolved.value;
    }

    private int iteratorRowCount(List<Map<String, Object>> items,
                                 CalculationContext context,
                                 String iterator) {
        int count = 1;
        for (String token : collectTokens(items)) {
            if (!token.endsWith("," + iterator)) {
                continue;
            }
            String code = aliasOf(token.substring(0, token.indexOf(',')));
            count = Math.max(count, context.lineValues.getOrDefault(code, Collections.<Integer, Double>emptyMap()).size());
        }
        return count;
    }

    private List<String> collectTokens(List<Map<String, Object>> items) {
        List<String> tokens = new ArrayList<>();
        for (Map<String, Object> item : items) {
            String kind = safe(stringValue(item.get("kind")));
            if ("token".equals(kind) && !safe(stringValue(item.get("token"))).isEmpty()) {
                tokens.add(safe(stringValue(item.get("token"))));
            }
            tokens.addAll(collectTokens(asMapList(item.get("items"))));
            tokens.addAll(collectTokens(asMapList(item.get("numerator"))));
            tokens.addAll(collectTokens(asMapList(item.get("denominator"))));
        }
        return tokens;
    }

    private String buildExpression(List<Map<String, Object>> blocks) {
        List<String> parts = new ArrayList<>();
        for (Map<String, Object> block : blocks) {
            String joiner = safe(stringValue(block.get("joiner")));
            String kind = safe(stringValue(block.get("kind")));
            String expression;
            if ("sum".equals(kind)) {
                expression = "SUM(" + buildExpression(asMapList(block.get("items"))) + ", " + safe(stringValue(block.get("iterator"))) + ")";
            } else if ("group".equals(kind)) {
                expression = "(" + buildExpression(asMapList(block.get("items"))) + ")";
            } else if ("fraction".equals(kind)) {
                expression = "(" + buildExpression(asMapList(block.get("numerator"))) + ") ÷ (" + buildExpression(asMapList(block.get("denominator"))) + ")";
            } else {
                expression = safe(stringValue(block.get("token")));
            }
            parts.add((joiner.isEmpty() ? "" : joiner + " ") + expression);
        }
        return String.join(" ", parts).trim();
    }

    private TokenResolution resolveToken(String token, CalculationContext context, Integer rowIndex) {
        String trimmed = safe(token);
        Double numeric = doubleValue(trimmed);
        if (numeric != null) {
            return new TokenResolution(numeric, "");
        }
        String baseToken = trimmed;
        if (trimmed.contains(",")) {
            baseToken = trimmed.substring(0, trimmed.indexOf(','));
        }
        String code = aliasOf(baseToken);
        if (rowIndex != null && rowIndex > 0) {
            Double lineValue = context.lineValues.getOrDefault(code, Collections.<Integer, Double>emptyMap()).get(rowIndex);
            if (lineValue != null) {
                return new TokenResolution(lineValue, "line input");
            }
        }
        Double scalarValue = context.scalarValues.get(code);
        if (scalarValue != null) {
            return new TokenResolution(scalarValue, "scalar input");
        }
        Double factorValue = context.factorValues.get(code);
        if (factorValue != null) {
            return new TokenResolution(factorValue, "factor");
        }
        return new TokenResolution(0d, "unresolved", true);
    }

    private String aliasOf(String token) {
        String normalized = safe(token).toLowerCase(Locale.ROOT);
        if ("mci".equals(normalized)) return "MCI";
        if ("ccli".equals(normalized)) return "CCLI";
        if ("im".equals(normalized)) return "IM";
        if ("ex".equals(normalized)) return "EX";
        if ("mcl".equals(normalized)) return "MCL";
        if ("efcl".equals(normalized)) return "EFCL";
        if ("efclc".equals(normalized)) return "EFCLC";
        if ("cfckd".equals(normalized)) return "CFCKD";
        if ("efi".equals(normalized)) return "EFI";
        if ("mi".equals(normalized)) return "MI";
        if ("fi".equals(normalized)) return "FI";
        if ("md".equals(normalized)) return "MD";
        if ("cd".equals(normalized)) return "CD";
        if ("fd".equals(normalized)) return "FD";
        if ("efd".equals(normalized)) return "EFD";
        if ("mk".equals(normalized)) return "MK";
        if ("xk".equals(normalized)) return "XK";
        if ("efk".equals(normalized)) return "EFK";
        if ("ef석회".equals(normalized)) return "EF_LIME";
        if ("ml".equals(normalized)) return "MLI";
        if ("cf_lkd".equals(normalized)) return "CF_LKD";
        if ("c_h".equals(normalized)) return "C_H";
        return safe(token).toUpperCase(Locale.ROOT);
    }

    private List<Map<String, Object>> asMapList(Object value) {
        if (!(value instanceof List<?>)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (item instanceof Map<?, ?>) {
                @SuppressWarnings("unchecked")
                Map<String, Object> row = (Map<String, Object>) item;
                result.add(row);
            }
        }
        return result;
    }

    private Map<String, Object> traceEntry(String label, String expression, double result, String note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", safe(label));
        row.put("expression", safe(expression));
        row.put("result", result);
        if (!safe(note).isEmpty()) {
            row.put("note", safe(note));
        }
        return row;
    }

    private static final class TokenResolution {
        final double value;
        final String note;
        final boolean unresolved;

        TokenResolution(double value, String note) {
            this(value, note, false);
        }

        TokenResolution(double value, String note, boolean unresolved) {
            this.value = value;
            this.note = note;
            this.unresolved = unresolved;
        }
    }

    private static final class PreviewStats {
        int unresolvedCount;
    }
}
