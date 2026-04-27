package egovframework.com.framework.builder.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityCheckResponseVO;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityDeclarationVO;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityResultItemVO;
import egovframework.com.framework.builder.model.FrameworkBuilderMigrationPlanVO;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class FrameworkBuilderCompatibilityRecordMapper {

    private final ObjectMapper objectMapper;

    public FrameworkBuilderCompatibilityRecordMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<FrameworkBuilderCompatibilityDeclarationVO> toDeclarations(List<Map<String, Object>> rows) {
        List<FrameworkBuilderCompatibilityDeclarationVO> items = new ArrayList<>();
        for (Map<String, Object> row : emptyRows(rows)) {
            if (row == null || row.isEmpty()) {
                continue;
            }
            FrameworkBuilderCompatibilityDeclarationVO item = new FrameworkBuilderCompatibilityDeclarationVO();
            item.setCompatibilityDeclarationId(stringValue(row, "compatibilityDeclarationId"));
            item.setBuilderVersion(stringValue(row, "builderVersion"));
            item.setBuilderRulePackVersion(stringValue(row, "builderRulePackVersion"));
            item.setTemplatePackVersion(stringValue(row, "templatePackVersion"));
            item.setSupportedSourceContractVersions(parseVersionRange(row.get("supportedSourceContractRange")));
            item.setSupportedOverlaySchemaVersions(parseVersionRange(row.get("supportedOverlaySchemaRange")));
            item.setEmittedManifestContractVersion(stringValue(row, "emittedManifestContractVersion"));
            item.setEmittedAuthorityContractVersion(stringValue(row, "emittedAuthorityContractVersion"));
            item.setReleaseCompatibilityVersion(stringValue(row, "releaseCompatibilityVersion"));
            item.setCompatibilityVerdict(stringValue(row, "compatibilityVerdict"));
            item.setBreakingChangeYn(isYes(row, "breakingChangeYn"));
            item.setStatus(stringValue(row, "status"));
            items.add(item);
        }
        return items;
    }

    public List<FrameworkBuilderMigrationPlanVO> toMigrationPlans(List<Map<String, Object>> rows) {
        List<FrameworkBuilderMigrationPlanVO> items = new ArrayList<>();
        for (Map<String, Object> row : emptyRows(rows)) {
            if (row == null || row.isEmpty()) {
                continue;
            }
            FrameworkBuilderMigrationPlanVO item = new FrameworkBuilderMigrationPlanVO();
            item.setMigrationPlanId(stringValue(row, "migrationPlanId"));
            item.setFromBuilderVersion(stringValue(row, "fromBuilderVersion"));
            item.setToBuilderVersion(stringValue(row, "toBuilderVersion"));
            item.setFromSourceContractVersions(parseVersionRange(row.get("fromSourceContractRange")));
            item.setToSourceContractVersions(parseVersionRange(row.get("toSourceContractRange")));
            item.setFromOverlaySchemaVersions(parseVersionRange(row.get("fromOverlaySchemaRange")));
            item.setToOverlaySchemaVersions(parseVersionRange(row.get("toOverlaySchemaRange")));
            item.setManualReviewRequiredYn(isYes(row, "manualReviewRequiredYn"));
            item.setStatus(stringValue(row, "status"));
            items.add(item);
        }
        return items;
    }

    public FrameworkBuilderCompatibilityCheckResponseVO toCompatibilityCheckResponse(
            Map<String, Object> run,
            List<Map<String, Object>> resultRows) {
        if (run == null || run.isEmpty()) {
            return null;
        }
        FrameworkBuilderCompatibilityCheckResponseVO response = new FrameworkBuilderCompatibilityCheckResponseVO();
        response.setCompatibilityCheckRunId(stringValue(run, "compatibilityCheckRunId"));
        response.setProjectId(stringValue(run, "projectId"));
        response.setBuilderVersion(stringValue(run, "builderVersion"));
        response.setBuilderRulePackVersion(stringValue(run, "builderRulePackVersion"));
        response.setTemplatePackVersion(stringValue(run, "templatePackVersion"));
        response.setSourceContractVersion(stringValue(run, "sourceContractVersion"));
        response.setOverlaySchemaVersion(stringValue(run, "overlaySchemaVersion"));
        response.setOverlaySetId(stringValue(run, "overlaySetId"));
        response.setMigrationPlanId(stringValue(run, "migrationPlanId"));
        response.setCheckScope(stringValue(run, "checkScope"));
        response.setCompatibilityVerdict(stringValue(run, "compatibilityVerdict"));
        response.setBlockingIssueCount(asInteger(run.get("blockingIssueCount")));
        response.setRequestedBy(stringValue(run, "requestedBy"));
        response.setStartedAt(stringValue(run, "startedAt"));
        response.setCompletedAt(stringValue(run, "completedAt"));

        List<FrameworkBuilderCompatibilityResultItemVO> items = new ArrayList<>();
        int warningCount = 0;
        for (Map<String, Object> row : emptyRows(resultRows)) {
            if (row == null || row.isEmpty()) {
                continue;
            }
            FrameworkBuilderCompatibilityResultItemVO item = new FrameworkBuilderCompatibilityResultItemVO();
            item.setResultType(stringValue(row, "resultType"));
            item.setTargetScope(stringValue(row, "targetScope"));
            item.setTargetKey(stringValue(row, "targetKey"));
            item.setSeverity(stringValue(row, "severity"));
            item.setRuleCode(stringValue(row, "ruleCode"));
            item.setSummary(stringValue(row, "summary"));
            item.setBlockingYn(isYes(row, "blockingYn"));
            if ("WARN".equalsIgnoreCase(item.getSeverity())) {
                warningCount++;
            }
            items.add(item);
        }
        response.setResultItems(items);
        response.setWarningCount(warningCount);
        return response;
    }

    public Map<String, Object> toCompatibilityCheckRunParams(FrameworkBuilderCompatibilityCheckResponseVO response) {
        return orderedMap(
                "compatibilityCheckRunId", safe(response == null ? null : response.getCompatibilityCheckRunId()),
                "projectId", safe(response == null ? null : response.getProjectId()),
                "builderVersion", safe(response == null ? null : response.getBuilderVersion()),
                "builderRulePackVersion", safe(response == null ? null : response.getBuilderRulePackVersion()),
                "templatePackVersion", safe(response == null ? null : response.getTemplatePackVersion()),
                "sourceContractVersion", safe(response == null ? null : response.getSourceContractVersion()),
                "overlaySchemaVersion", safe(response == null ? null : response.getOverlaySchemaVersion()),
                "overlaySetId", safe(response == null ? null : response.getOverlaySetId()),
                "migrationPlanId", safe(response == null ? null : response.getMigrationPlanId()),
                "checkScope", safe(response == null ? null : response.getCheckScope()),
                "compatibilityVerdict", safe(response == null ? null : response.getCompatibilityVerdict()),
                "blockingIssueCount", response == null ? null : response.getBlockingIssueCount(),
                "startedAt", safe(response == null ? null : response.getStartedAt()),
                "completedAt", safe(response == null ? null : response.getCompletedAt()),
                "requestedBy", safe(response == null ? null : response.getRequestedBy()));
    }

    public Map<String, Object> toCompatibilityCheckResultParams(
            String compatibilityCheckRunId,
            String completedAt,
            FrameworkBuilderCompatibilityResultItemVO item,
            String compatibilityResultId) {
        return orderedMap(
                "compatibilityResultId", safe(compatibilityResultId),
                "compatibilityCheckRunId", safe(compatibilityCheckRunId),
                "resultType", safe(item == null ? null : item.getResultType()),
                "targetScope", safe(item == null ? null : item.getTargetScope()),
                "targetKey", safe(item == null ? null : item.getTargetKey()),
                "severity", safe(item == null ? null : item.getSeverity()),
                "ruleCode", safe(item == null ? null : item.getRuleCode()),
                "summary", safe(item == null ? null : item.getSummary()),
                "detailsJson", toJson(item),
                "blockingYn", yn(item != null && Boolean.TRUE.equals(item.getBlockingYn())),
                "createdAt", safe(completedAt));
    }

    private List<Map<String, Object>> emptyRows(List<Map<String, Object>> rows) {
        return rows == null ? Collections.emptyList() : rows;
    }

    private String stringValue(Map<String, Object> row, String key) {
        return safe(asString(row == null ? null : row.get(key)));
    }

    private boolean isYes(Map<String, Object> row, String key) {
        return "Y".equalsIgnoreCase(stringValue(row, key));
    }

    private Map<String, Object> orderedMap(Object... entries) {
        Map<String, Object> values = new LinkedHashMap<>();
        for (int index = 0; index + 1 < entries.length; index += 2) {
            values.put(String.valueOf(entries[index]), entries[index + 1]);
        }
        return values;
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        String normalized = safe(asString(value));
        if (normalized.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "";
        }
    }

    private String yn(boolean value) {
        return value ? "Y" : "N";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private List<String> parseVersionRange(Object value) {
        String normalized = safe(asString(value));
        if (normalized.isEmpty()) {
            return new ArrayList<>();
        }
        String flattened = normalized
                .replace("[", "")
                .replace("]", "")
                .replace("(", "")
                .replace(")", "")
                .replace("\"", "")
                .replace("'", "");
        String[] parts = flattened.split("[,\\s]+");
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            String token = safe(part);
            if (!token.isEmpty()) {
                result.add(token);
            }
        }
        return result;
    }
}
