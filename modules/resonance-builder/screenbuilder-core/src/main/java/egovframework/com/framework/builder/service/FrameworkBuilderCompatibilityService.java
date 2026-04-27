package egovframework.com.framework.builder.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityCheckRequestVO;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityCheckResponseVO;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityDeclarationVO;
import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityResultItemVO;
import egovframework.com.framework.builder.model.FrameworkBuilderMigrationPlanVO;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityRecordMapper;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityPersistencePort;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityRecordStoragePort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class FrameworkBuilderCompatibilityService {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE =
            new TypeReference<LinkedHashMap<String, Object>>() {};

    private final ObjectMapper objectMapper;
    private final FrameworkBuilderCompatibilityRecordMapper frameworkBuilderCompatibilityRecordMapper;
    private final FrameworkBuilderCompatibilityPersistencePort frameworkBuilderCompatibilityPersistencePort;
    private final FrameworkBuilderCompatibilityRecordStoragePort frameworkBuilderCompatibilityRecordStoragePort;

    public FrameworkBuilderCompatibilityService(ObjectMapper objectMapper,
                                                FrameworkBuilderCompatibilityRecordMapper frameworkBuilderCompatibilityRecordMapper,
                                                FrameworkBuilderCompatibilityPersistencePort frameworkBuilderCompatibilityPersistencePort,
                                                FrameworkBuilderCompatibilityRecordStoragePort frameworkBuilderCompatibilityRecordStoragePort) {
        this.objectMapper = objectMapper;
        this.frameworkBuilderCompatibilityRecordMapper = frameworkBuilderCompatibilityRecordMapper;
        this.frameworkBuilderCompatibilityPersistencePort = frameworkBuilderCompatibilityPersistencePort;
        this.frameworkBuilderCompatibilityRecordStoragePort = frameworkBuilderCompatibilityRecordStoragePort;
    }

    public FrameworkBuilderCompatibilityCheckResponseVO runCompatibilityCheck(
            FrameworkBuilderCompatibilityCheckRequestVO request) throws Exception {
        String projectId = requestValue(request == null ? null : request.getProjectId());
        String pageId = requestValue(request == null ? null : request.getPageId());
        String scenarioId = requestValue(request == null ? null : request.getScenarioId());
        String guidedStateId = requestValue(request == null ? null : request.getGuidedStateId());
        String screenFamilyRuleId = requestValue(request == null ? null : request.getScreenFamilyRuleId());
        String templateLineId = requestValue(request == null ? null : request.getTemplateLineId());
        String builderVersion = requestValue(request == null ? null : request.getBuilderVersion());
        String builderRulePackVersion = requestValue(request == null ? null : request.getBuilderRulePackVersion());
        String templatePackVersion = requestValue(request == null ? null : request.getTemplatePackVersion());
        String sourceContractVersion = requestValue(request == null ? null : request.getSourceContractVersion());
        String overlaySchemaVersion = requestValue(request == null ? null : request.getOverlaySchemaVersion());
        String overlaySetId = requestValue(request == null ? null : request.getOverlaySetId());
        String migrationPlanId = requestValue(request == null ? null : request.getMigrationPlanId());
        String checkScope = requestValue(request == null ? null : request.getCheckScope());
        String requestedBy = requestValue(request == null ? null : request.getRequestedBy());

        requireField(projectId, "projectId");
        requireField(builderVersion, "builderVersion");
        requireField(sourceContractVersion, "sourceContractVersion");
        requireField(checkScope, "checkScope");

        List<FrameworkBuilderCompatibilityDeclarationVO> declarations = getCompatibilityDeclarations(null, "ACTIVE");
        FrameworkBuilderCompatibilityDeclarationVO declaration = findDeclaration(declarations, builderVersion);
        FrameworkBuilderMigrationPlanVO migrationPlan = findMigrationPlan(
                migrationPlanId,
                builderVersion);

        FrameworkBuilderCompatibilityCheckResponseVO response = new FrameworkBuilderCompatibilityCheckResponseVO();
        response.setCompatibilityCheckRunId(buildId("fbcc"));
        response.setProjectId(projectId);
        response.setPageId(pageId);
        response.setScenarioId(scenarioId);
        response.setGuidedStateId(guidedStateId);
        response.setScreenFamilyRuleId(screenFamilyRuleId);
        response.setTemplateLineId(templateLineId);
        response.setBuilderVersion(builderVersion);
        response.setBuilderRulePackVersion(firstNonBlank(
                builderRulePackVersion,
                declaration == null ? "" : declaration.getBuilderRulePackVersion()));
        response.setTemplatePackVersion(firstNonBlank(
                templatePackVersion,
                declaration == null ? "" : declaration.getTemplatePackVersion()));
        response.setSourceContractVersion(sourceContractVersion);
        response.setOverlaySchemaVersion(overlaySchemaVersion);
        response.setOverlaySetId(overlaySetId);
        response.setMigrationPlanId(migrationPlanId);
        response.setCheckScope(checkScope.toUpperCase(Locale.ROOT));
        response.setRequestedBy(requestedBy);
        response.setStartedAt(now());

        List<FrameworkBuilderCompatibilityResultItemVO> resultItems = new ArrayList<>();
        addDeclarationResult(resultItems, declaration, response.getBuilderVersion());
        addSourceVersionResult(resultItems, declaration, response.getSourceContractVersion());
        addOverlayVersionResult(resultItems, declaration, response.getOverlaySchemaVersion(), response.getCheckScope());
        addIdentityResult(resultItems, request);
        addExtensionPointResult(resultItems, request);
        addEmitResult(resultItems, declaration);
        addReplayResult(resultItems, request, migrationPlan);

        String verdict = resolveVerdict(resultItems, declaration, migrationPlan, request);
        int blockingCount = countBy(resultItems, true);
        int warningCount = countWarnings(resultItems);

        response.setCompatibilityVerdict(verdict);
        response.setBlockingIssueCount(blockingCount);
        response.setWarningCount(warningCount);
        response.setCompletedAt(now());
        response.setResultItems(resultItems);

        insertCompatibilityCheckDb(response);
        frameworkBuilderCompatibilityRecordStoragePort.appendRecord(objectMapper.convertValue(response, MAP_TYPE));
        return response;
    }

    public FrameworkBuilderCompatibilityCheckResponseVO getCompatibilityCheck(String compatibilityCheckRunId) throws Exception {
        requireField(compatibilityCheckRunId, "compatibilityCheckRunId");
        FrameworkBuilderCompatibilityCheckResponseVO dbRecord = findCompatibilityCheckDb(compatibilityCheckRunId);
        if (dbRecord != null) {
            return dbRecord;
        }
        Map<String, Object> record = frameworkBuilderCompatibilityRecordStoragePort.findLastRecord(
                "compatibilityCheckRunId",
                safe(compatibilityCheckRunId));
        if (record.isEmpty()) {
            throw new IllegalArgumentException("compatibilityCheckRunId was not found.");
        }
        return objectMapper.convertValue(record, FrameworkBuilderCompatibilityCheckResponseVO.class);
    }

    public List<FrameworkBuilderCompatibilityDeclarationVO> getCompatibilityDeclarations(String builderVersion, String status) {
        List<FrameworkBuilderCompatibilityDeclarationVO> declarations = loadCompatibilityDeclarations();
        List<FrameworkBuilderCompatibilityDeclarationVO> filtered = new ArrayList<>();
        String normalizedBuilderVersion = safe(builderVersion);
        String normalizedStatus = safe(status);
        for (FrameworkBuilderCompatibilityDeclarationVO declaration : declarations) {
            if (declaration == null) {
                continue;
            }
            if (!matchesExact(normalizedBuilderVersion, declaration.getBuilderVersion())) {
                continue;
            }
            if (!matchesIgnoreCase(normalizedStatus, declaration.getStatus())) {
                continue;
            }
            filtered.add(declaration);
        }
        return filtered;
    }

    public List<FrameworkBuilderMigrationPlanVO> getMigrationPlans(String fromBuilderVersion,
                                                                   String toBuilderVersion,
                                                                   String status) {
        List<FrameworkBuilderMigrationPlanVO> plans = loadMigrationPlans();
        List<FrameworkBuilderMigrationPlanVO> filtered = new ArrayList<>();
        String normalizedFromBuilderVersion = safe(fromBuilderVersion);
        String normalizedToBuilderVersion = safe(toBuilderVersion);
        String normalizedStatus = safe(status);
        for (FrameworkBuilderMigrationPlanVO plan : plans) {
            if (plan == null) {
                continue;
            }
            if (!matchesExact(normalizedFromBuilderVersion, plan.getFromBuilderVersion())) {
                continue;
            }
            if (!matchesExact(normalizedToBuilderVersion, plan.getToBuilderVersion())) {
                continue;
            }
            if (!matchesIgnoreCase(normalizedStatus, plan.getStatus())) {
                continue;
            }
            filtered.add(plan);
        }
        return filtered;
    }

    private void addDeclarationResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                      FrameworkBuilderCompatibilityDeclarationVO declaration,
                                      String builderVersion) {
        if (declaration == null) {
            items.add(buildResult("SOURCE_RANGE", "BUILDER", builderVersion, "ERROR",
                    "DECLARATION_MISSING", "No compatibility declaration matched builderVersion.", true));
            return;
        }
        items.add(buildResult("SOURCE_RANGE", "BUILDER", builderVersion, "INFO",
                "DECLARATION_FOUND", "Compatibility declaration matched builderVersion.", false));
    }

    private void addSourceVersionResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                        FrameworkBuilderCompatibilityDeclarationVO declaration,
                                        String sourceContractVersion) {
        if (declaration == null) {
            return;
        }
        boolean supported = declaration.getSupportedSourceContractVersions().contains(sourceContractVersion);
        items.add(buildResult("SOURCE_RANGE", "SOURCE_CONTRACT", sourceContractVersion,
                supported ? "INFO" : "ERROR",
                supported ? "SOURCE_SUPPORTED" : "SOURCE_UNSUPPORTED",
                supported ? "Source contract version is supported."
                        : "Source contract version is outside the supported range.",
                !supported));
    }

    private void addOverlayVersionResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                         FrameworkBuilderCompatibilityDeclarationVO declaration,
                                         String overlaySchemaVersion,
                                         String checkScope) {
        boolean overlayRequired = !"SOURCE_ONLY".equalsIgnoreCase(safe(checkScope));
        if (!overlayRequired && safe(overlaySchemaVersion).isEmpty()) {
            items.add(buildResult("OVERLAY_RANGE", "OVERLAY", "", "INFO",
                    "OVERLAY_NOT_REQUIRED", "Overlay schema is not required for SOURCE_ONLY checks.", false));
            return;
        }
        if (safe(overlaySchemaVersion).isEmpty()) {
            items.add(buildResult("OVERLAY_RANGE", "OVERLAY", "", "WARN",
                    "OVERLAY_VERSION_MISSING", "overlaySchemaVersion was not supplied.", false));
            return;
        }
        boolean supported = declaration != null
                && declaration.getSupportedOverlaySchemaVersions().contains(overlaySchemaVersion);
        items.add(buildResult("OVERLAY_RANGE", "OVERLAY", overlaySchemaVersion,
                supported ? "INFO" : "ERROR",
                supported ? "OVERLAY_SUPPORTED" : "OVERLAY_UNSUPPORTED",
                supported ? "Overlay schema version is supported."
                        : "Overlay schema version is outside the supported range.",
                overlayRequired && !supported));
    }

    private void addIdentityResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                   FrameworkBuilderCompatibilityCheckRequestVO request) {
        boolean complete = !safe(request == null ? null : request.getGuidedStateId()).isEmpty()
                && !safe(request == null ? null : request.getScreenFamilyRuleId()).isEmpty()
                && !safe(request == null ? null : request.getTemplateLineId()).isEmpty();
        items.add(buildResult("IDENTITY_STABILITY", "IDENTITY_KEYS",
                safe(request == null ? null : request.getPageId()),
                complete ? "INFO" : "WARN",
                complete ? "IDENTITY_KEYS_PRESENT" : "IDENTITY_KEYS_PARTIAL",
                complete ? "Stable identity keys were supplied for replay-safe regeneration."
                        : "guidedStateId, screenFamilyRuleId, or templateLineId is missing.",
                false));
    }

    private void addExtensionPointResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                         FrameworkBuilderCompatibilityCheckRequestVO request) {
        boolean hasOverlaySet = !safe(request == null ? null : request.getOverlaySetId()).isEmpty();
        items.add(buildResult("EXTENSION_POINT", "OVERLAY_SET", safe(request == null ? null : request.getOverlaySetId()),
                hasOverlaySet ? "INFO" : "WARN",
                hasOverlaySet ? "OVERLAY_SET_BOUND" : "OVERLAY_SET_NOT_BOUND",
                hasOverlaySet ? "Overlay set is bound for compatibility evaluation."
                        : "No overlaySetId was provided. Overlay-heavy replay was not fully evaluated.",
                false));
    }

    private void addEmitResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                               FrameworkBuilderCompatibilityDeclarationVO declaration) {
        if (declaration == null) {
            return;
        }
        items.add(buildResult("MANIFEST_EMIT", "MANIFEST_CONTRACT", declaration.getEmittedManifestContractVersion(),
                "INFO", "MANIFEST_EMIT_READY", "Builder line declares an emitted manifest contract.", false));
        items.add(buildResult("AUTHORITY_EMIT", "AUTHORITY_CONTRACT", declaration.getEmittedAuthorityContractVersion(),
                "INFO", "AUTHORITY_EMIT_READY", "Builder line declares an emitted authority contract.", false));
    }

    private void addReplayResult(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                 FrameworkBuilderCompatibilityCheckRequestVO request,
                                 FrameworkBuilderMigrationPlanVO migrationPlan) {
        boolean replayCheck = "REPLAY_VALIDATION".equalsIgnoreCase(safe(request == null ? null : request.getCheckScope()));
        if (!replayCheck) {
            items.add(buildResult("REPLAY_DIFF", "REPLAY", "", "INFO",
                    "REPLAY_NOT_REQUESTED", "Replay validation was not requested for this check.", false));
            return;
        }
        if (!safe(request == null ? null : request.getMigrationPlanId()).isEmpty() && migrationPlan == null) {
            items.add(buildResult("REPLAY_DIFF", "REPLAY", safe(request.getMigrationPlanId()), "ERROR",
                    "MIGRATION_PLAN_NOT_FOUND", "migrationPlanId was supplied but no migration plan matched.", true));
            return;
        }
        items.add(buildResult("REPLAY_DIFF", "REPLAY", safe(request == null ? null : request.getPageId()), "INFO",
                "REPLAY_READY", "Replay validation can proceed under the current skeleton contract.", false));
    }

    private String resolveVerdict(List<FrameworkBuilderCompatibilityResultItemVO> items,
                                  FrameworkBuilderCompatibilityDeclarationVO declaration,
                                  FrameworkBuilderMigrationPlanVO migrationPlan,
                                  FrameworkBuilderCompatibilityCheckRequestVO request) {
        if (declaration == null || countBy(items, true) > 0) {
            return "BLOCKED";
        }
        if (!safe(request == null ? null : request.getMigrationPlanId()).isEmpty()) {
            return migrationPlan == null ? "BLOCKED" : "SUPPORTED_WITH_MIGRATION";
        }
        if ("READ_ONLY".equalsIgnoreCase(safe(request == null ? null : request.getCheckScope()))) {
            return "READ_ONLY_IMPORT_ONLY";
        }
        return "FULLY_SUPPORTED";
    }

    private int countBy(List<FrameworkBuilderCompatibilityResultItemVO> items, boolean blocking) {
        int count = 0;
        for (FrameworkBuilderCompatibilityResultItemVO item : items) {
            if (item != null && Boolean.valueOf(blocking).equals(item.getBlockingYn())) {
                count++;
            }
        }
        return count;
    }

    private int countWarnings(List<FrameworkBuilderCompatibilityResultItemVO> items) {
        int count = 0;
        for (FrameworkBuilderCompatibilityResultItemVO item : items) {
            if (item != null && "WARN".equalsIgnoreCase(safe(item.getSeverity()))) {
                count++;
            }
        }
        return count;
    }

    private FrameworkBuilderCompatibilityResultItemVO buildResult(String resultType,
                                                                  String targetScope,
                                                                  String targetKey,
                                                                  String severity,
                                                                  String ruleCode,
                                                                  String summary,
                                                                  boolean blockingYn) {
        FrameworkBuilderCompatibilityResultItemVO item = new FrameworkBuilderCompatibilityResultItemVO();
        item.setResultType(resultType);
        item.setTargetScope(targetScope);
        item.setTargetKey(targetKey);
        item.setSeverity(severity);
        item.setRuleCode(ruleCode);
        item.setSummary(summary);
        item.setBlockingYn(blockingYn);
        return item;
    }

    private FrameworkBuilderCompatibilityDeclarationVO findDeclaration(
            List<FrameworkBuilderCompatibilityDeclarationVO> declarations,
            String builderVersion) {
        for (FrameworkBuilderCompatibilityDeclarationVO declaration : declarations) {
            if (declaration != null && builderVersion.equals(safe(declaration.getBuilderVersion()))) {
                return declaration;
            }
        }
        return null;
    }

    private FrameworkBuilderMigrationPlanVO findMigrationPlan(String migrationPlanId, String toBuilderVersion) {
        if (migrationPlanId.isEmpty() && toBuilderVersion.isEmpty()) {
            return null;
        }
        for (FrameworkBuilderMigrationPlanVO plan : loadMigrationPlans()) {
            if (plan == null) {
                continue;
            }
            if (!migrationPlanId.isEmpty() && migrationPlanId.equals(safe(plan.getMigrationPlanId()))) {
                return plan;
            }
            if (migrationPlanId.isEmpty() && toBuilderVersion.equals(safe(plan.getToBuilderVersion()))) {
                return plan;
            }
        }
        return null;
    }

    private List<FrameworkBuilderCompatibilityDeclarationVO> loadCompatibilityDeclarations() {
        List<FrameworkBuilderCompatibilityDeclarationVO> dbDeclarations = findCompatibilityDeclarationsDb();
        if (!dbDeclarations.isEmpty()) {
            return dbDeclarations;
        }
        return buildDeclarations();
    }

    private List<FrameworkBuilderMigrationPlanVO> loadMigrationPlans() {
        List<FrameworkBuilderMigrationPlanVO> dbPlans = findMigrationPlansDb();
        if (!dbPlans.isEmpty()) {
            return dbPlans;
        }
        return buildMigrationPlans();
    }

    private List<FrameworkBuilderCompatibilityDeclarationVO> buildDeclarations() {
        FrameworkBuilderCompatibilityDeclarationVO stable = declaration(
                "builder-comp-2026-03-24",
                "2026-03-24",
                "2026-03-24",
                "2026-03-24",
                List.of("2026-03-23", "2026-03-24"),
                List.of("2026-03-24"),
                "2026-03-24",
                "2026-03-24",
                "2026-03-line",
                "FULLY_SUPPORTED",
                false,
                "ACTIVE");

        FrameworkBuilderCompatibilityDeclarationVO migrationLine = declaration(
                "builder-comp-2026-04-01",
                "2026-04-01",
                "2026-04-01",
                "2026-04-01",
                List.of("2026-03-24", "2026-04-01"),
                List.of("2026-03-24", "2026-04-01"),
                "2026-04-01",
                "2026-04-01",
                "2026-04-line",
                "SUPPORTED_WITH_MIGRATION",
                true,
                "ACTIVE");

        return new ArrayList<>(List.of(stable, migrationLine));
    }

    private List<FrameworkBuilderMigrationPlanVO> buildMigrationPlans() {
        FrameworkBuilderMigrationPlanVO plan = migrationPlan(
                "builder-mig-2026-03-24-to-2026-04-01",
                "2026-03-24",
                "2026-04-01",
                List.of("2026-03-23", "2026-03-24"),
                List.of("2026-04-01"),
                List.of("2026-03-24"),
                List.of("2026-04-01"),
                true,
                "ACTIVE");
        return new ArrayList<>(Collections.singletonList(plan));
    }

    private List<FrameworkBuilderCompatibilityDeclarationVO> findCompatibilityDeclarationsDb() {
        try {
            return frameworkBuilderCompatibilityRecordMapper.toDeclarations(
                    frameworkBuilderCompatibilityPersistencePort.selectCompatibilityDeclarations());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<FrameworkBuilderMigrationPlanVO> findMigrationPlansDb() {
        try {
            return frameworkBuilderCompatibilityRecordMapper.toMigrationPlans(
                    frameworkBuilderCompatibilityPersistencePort.selectMigrationPlans());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private void insertCompatibilityCheckDb(FrameworkBuilderCompatibilityCheckResponseVO response) {
        try {
            frameworkBuilderCompatibilityPersistencePort.insertCompatibilityCheckRun(
                    frameworkBuilderCompatibilityRecordMapper.toCompatibilityCheckRunParams(response));

            List<FrameworkBuilderCompatibilityResultItemVO> resultItems =
                    response == null ? Collections.emptyList() : response.getResultItems();
            for (FrameworkBuilderCompatibilityResultItemVO item : resultItems) {
                if (item == null) {
                    continue;
                }
                frameworkBuilderCompatibilityPersistencePort.insertCompatibilityCheckResult(
                        frameworkBuilderCompatibilityRecordMapper.toCompatibilityCheckResultParams(
                                safe(response.getCompatibilityCheckRunId()),
                                safe(response.getCompletedAt()),
                                item,
                                buildId("fbcr")));
            }
        } catch (Exception e) {
            // Keep the skeleton service operational even when control-plane tables are not provisioned yet.
        }
    }

    private FrameworkBuilderCompatibilityCheckResponseVO findCompatibilityCheckDb(String compatibilityCheckRunId) {
        try {
            Map<String, Object> run = frameworkBuilderCompatibilityPersistencePort.selectCompatibilityCheckRun(compatibilityCheckRunId);
            List<Map<String, Object>> rows =
                    frameworkBuilderCompatibilityPersistencePort.selectCompatibilityCheckResults(compatibilityCheckRunId);
            return frameworkBuilderCompatibilityRecordMapper.toCompatibilityCheckResponse(run, rows);
        } catch (Exception e) {
            return null;
        }
    }

    private void requireField(String value, String fieldName) {
        if (safe(value).isEmpty()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
    }

    private String buildId(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().replace("-", "");
    }

    private String now() {
        return LocalDateTime.now().format(TS_FORMAT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String requestValue(String value) {
        return safe(value);
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private boolean matchesExact(String expected, String actual) {
        return expected.isEmpty() || expected.equals(safe(actual));
    }

    private boolean matchesIgnoreCase(String expected, String actual) {
        return expected.isEmpty() || expected.equalsIgnoreCase(safe(actual));
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (!safe(value).isEmpty()) {
                return safe(value);
            }
        }
        return "";
    }

    private FrameworkBuilderCompatibilityDeclarationVO declaration(String compatibilityDeclarationId,
                                                                   String builderVersion,
                                                                   String builderRulePackVersion,
                                                                   String templatePackVersion,
                                                                   List<String> supportedSourceContractVersions,
                                                                   List<String> supportedOverlaySchemaVersions,
                                                                   String emittedManifestContractVersion,
                                                                   String emittedAuthorityContractVersion,
                                                                   String releaseCompatibilityVersion,
                                                                   String compatibilityVerdict,
                                                                   boolean breakingChangeYn,
                                                                   String status) {
        FrameworkBuilderCompatibilityDeclarationVO item = new FrameworkBuilderCompatibilityDeclarationVO();
        item.setCompatibilityDeclarationId(compatibilityDeclarationId);
        item.setBuilderVersion(builderVersion);
        item.setBuilderRulePackVersion(builderRulePackVersion);
        item.setTemplatePackVersion(templatePackVersion);
        item.setSupportedSourceContractVersions(new ArrayList<>(supportedSourceContractVersions));
        item.setSupportedOverlaySchemaVersions(new ArrayList<>(supportedOverlaySchemaVersions));
        item.setEmittedManifestContractVersion(emittedManifestContractVersion);
        item.setEmittedAuthorityContractVersion(emittedAuthorityContractVersion);
        item.setReleaseCompatibilityVersion(releaseCompatibilityVersion);
        item.setCompatibilityVerdict(compatibilityVerdict);
        item.setBreakingChangeYn(breakingChangeYn);
        item.setStatus(status);
        return item;
    }

    private FrameworkBuilderMigrationPlanVO migrationPlan(String migrationPlanId,
                                                          String fromBuilderVersion,
                                                          String toBuilderVersion,
                                                          List<String> fromSourceContractVersions,
                                                          List<String> toSourceContractVersions,
                                                          List<String> fromOverlaySchemaVersions,
                                                          List<String> toOverlaySchemaVersions,
                                                          boolean manualReviewRequiredYn,
                                                          String status) {
        FrameworkBuilderMigrationPlanVO item = new FrameworkBuilderMigrationPlanVO();
        item.setMigrationPlanId(migrationPlanId);
        item.setFromBuilderVersion(fromBuilderVersion);
        item.setToBuilderVersion(toBuilderVersion);
        item.setFromSourceContractVersions(new ArrayList<>(fromSourceContractVersions));
        item.setToSourceContractVersions(new ArrayList<>(toSourceContractVersions));
        item.setFromOverlaySchemaVersions(new ArrayList<>(fromOverlaySchemaVersions));
        item.setToOverlaySchemaVersions(new ArrayList<>(toOverlaySchemaVersions));
        item.setManualReviewRequiredYn(manualReviewRequiredYn);
        item.setStatus(status);
        return item;
    }

}
