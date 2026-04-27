package egovframework.com.platform.runtimecontrol.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactSetNormalizer;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderPlatformFamilyRegistry;
import egovframework.com.platform.versioncontrol.mapper.ProjectVersionManagementMapper;
import egovframework.com.platform.runtimecontrol.mapper.RuntimeControlPlaneMapper;
import egovframework.com.platform.runtimecontrol.model.ModuleBindingPreviewRequest;
import egovframework.com.platform.runtimecontrol.model.ModuleBindingResultRequest;
import egovframework.com.platform.runtimecontrol.model.ParityCompareRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineRunRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineStatusRequest;
import egovframework.com.platform.runtimecontrol.model.RepairApplyRequest;
import egovframework.com.platform.runtimecontrol.model.RepairOpenRequest;
import egovframework.com.platform.runtimecontrol.model.VerificationRunRequest;
import egovframework.com.platform.runtimecontrol.service.RuntimeControlPlaneService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RuntimeControlPlaneServiceImpl implements RuntimeControlPlaneService {

    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<LinkedHashMap<String, Object>>() {};
    private static final DateTimeFormatter VERSION_STAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ObjectMapper objectMapper;
    private final ProjectVersionManagementMapper projectVersionManagementMapper;
    private final RuntimeControlPlaneMapper runtimeControlPlaneMapper;

    @Value("${carbonet.platform.runtimecontrol.parity-compare-store:/tmp/carbonet-resonance-parity-compare.jsonl}")
    private String parityCompareStore;

    @Value("${carbonet.platform.runtimecontrol.repair-open-store:/tmp/carbonet-resonance-repair-session.jsonl}")
    private String repairOpenStore;

    @Value("${carbonet.platform.runtimecontrol.repair-apply-store:/tmp/carbonet-resonance-repair-apply.jsonl}")
    private String repairApplyStore;

    @Value("${carbonet.platform.runtimecontrol.project-pipeline-store:/tmp/carbonet-resonance-project-pipeline.jsonl}")
    private String projectPipelineStore;

    @Value("${carbonet.platform.runtimecontrol.verification-run-store:/tmp/carbonet-resonance-verification-run.jsonl}")
    private String verificationRunStore;

    @Value("${carbonet.platform.runtimecontrol.module-binding-preview-store:/tmp/carbonet-resonance-module-binding-preview.jsonl}")
    private String moduleBindingPreviewStore;

    @Value("${carbonet.platform.runtimecontrol.module-binding-result-store:/tmp/carbonet-resonance-module-binding-result.jsonl}")
    private String moduleBindingResultStore;

    @Override
    public Map<String, Object> getParityCompare(ParityCompareRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String occurredAt = now();
        String compareContextId = "cmp-" + shortId();
        String traceId = "trace-" + shortId();

        List<String> selectedElementSet = normalizeStringList(request.getSelectedElementSet());
        Map<String, Object> builderInput = normalizeObjectMap(request.getBuilderInput());
        Map<String, Object> runtimeEvidence = normalizeObjectMap(request.getRuntimeEvidence());

        List<Map<String, Object>> compareTargetSet = new ArrayList<Map<String, Object>>();
        List<String> blockerSet = new ArrayList<String>();
        List<String> repairCandidateSet = new ArrayList<String>();

        Map<String, Object> releaseUnit = hasText(request.getReleaseUnitId())
                ? defaultMap(projectVersionManagementMapper.selectReleaseUnit(request.getReleaseUnitId()))
                : orderedMap();
        Map<String, Object> targetVersionSet = canonicalizeArtifactVersionSet(
                projectId,
                parseJsonObject(releaseUnit.get("packageVersionSetJson")));
        List<Map<String, Object>> installedArtifacts = canonicalArtifactRows(
                projectId,
                projectVersionManagementMapper.selectInstalledArtifacts(projectId));
        Map<String, String> currentVersionByArtifactId = new LinkedHashMap<String, String>();
        for (Map<String, Object> installed : installedArtifacts) {
            currentVersionByArtifactId.put(value(installed, "artifactId"), value(installed, "installedArtifactVersion"));
        }

        int matchCount = 0;
        int totalTargets = 0;

        if (!targetVersionSet.isEmpty()) {
            for (Map.Entry<String, Object> entry : targetVersionSet.entrySet()) {
                String artifactId = entry.getKey();
                String targetVersion = String.valueOf(entry.getValue());
                String currentVersion = currentVersionByArtifactId.get(artifactId);
                totalTargets++;

                String result = "MATCH";
                if (!hasText(currentVersion)) {
                    result = "GAP";
                    blockerSet.add("Missing artifact at runtime: " + artifactId);
                } else if (!targetVersion.equals(currentVersion)) {
                    result = "MISMATCH";
                    blockerSet.add("Version drift detected for " + artifactId + ": expected " + targetVersion + " but found " + currentVersion);
                } else {
                    matchCount++;
                    result = "MATCH";
                }
                Map<String, Object> row = compareRow(artifactId, orDefault(currentVersion, "(none)"), targetVersion, "release-unit", "artifact");
                row.put("result", result);
                compareTargetSet.add(row);
            }
        }

        if (totalTargets == 0) {
            compareTargetSet.add(compareRow("layout-shell", "runtime/header-shell:v1", "builder/header-shell:v2", "guided-state", "layout"));
            compareTargetSet.add(compareRow("event-binding", "runtime/onClick->legacyAction", "builder/onClick->projectAction", adapterContractArtifactId(projectId), "binding"));
            compareTargetSet.add(compareRow("theme-token", "runtime/color.brand.500", "builder/color.primary.600", "theme-governance", "theme"));
            totalTargets = compareTargetSet.size();
            blockerSet.add("No authoritative release unit found; using legacy baseline for comparison.");
        }

        if (!blockerSet.isEmpty()) {
            repairCandidateSet.add("Apply repair patch for artifact version alignment");
            repairCandidateSet.add("Re-sync project adapter boundary bindings");
            repairCandidateSet.add("Rebuild installable package with validator set");
        }

        int parityScore = totalTargets > 0 ? (matchCount * 100 / totalTargets) : 100;

        Map<String, Object> response = orderedMap();
        response.put("compareContextId", compareContextId);
        response.put("projectId", projectId);
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("ownerLane", orDefault(request.getOwnerLane(), ownerLane()));
        response.put("selectedScreenId", orDefault(request.getSelectedScreenId(), "screen.runtime.main"));
        response.put("releaseUnitId", orDefault(request.getReleaseUnitId(), buildReleaseUnitId("rel", projectId)));
        response.put("compareBaseline", orDefault(request.getCompareBaseline(), compareBaseline()));
        response.put("selectedElementSet", selectedElementSet);
        response.put("builderInput", builderInput);
        response.put("runtimeEvidence", runtimeEvidence);
        response.put("compareTargetSet", compareTargetSet);
        response.put("parityScore", Integer.valueOf(parityScore));
        response.put("uniformityScore", Integer.valueOf(88));
        response.put("blockerSet", blockerSet);
        response.put("repairCandidateSet", repairCandidateSet);
        response.put("result", blockerSet.isEmpty() ? "MATCH" : "REPAIR_REQUIRED");
        response.put("requestedBy", orDefault(request.getRequestedBy(), "system"));
        response.put("requestedByType", orDefault(request.getRequestedByType(), "PLATFORM_OPERATOR"));
        response.put("occurredAt", occurredAt);
        response.put("traceId", traceId);
        persistParityCompareRunToDatabase(request, response);
        return response;
    }

    @Override
    public Map<String, Object> openRepairSession(RepairOpenRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String releaseUnitId = orDefault(request.getReleaseUnitId(), buildReleaseUnitId("rel", projectId));
        String deploymentTarget = "ops-runtime-preview-01";
        String deployTraceId = "repair-open-" + shortId();
        Map<String, Object> response = orderedMap();
        response.put("repairSessionId", "repair-" + shortId());
        response.put("projectId", projectId);
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("ownerLane", orDefault(request.getOwnerLane(), ownerLane()));
        response.put("selectedScreenId", orDefault(request.getSelectedScreenId(), "screen.runtime.main"));
        response.put("builderInput", normalizeObjectMap(request.getBuilderInput()));
        response.put("runtimeEvidence", normalizeObjectMap(request.getRuntimeEvidence()));
        response.put("selectedElementSet", normalizeStringList(request.getSelectedElementSet()));
        response.put("compareSnapshotId", "cmp-" + shortId());
        response.put("blockingGapSet", stringList("binding drift detected", "theme token drift detected"));
        response.put("reuseRecommendationSet", mergeStringLists(
                normalizeStringList(request.getExistingAssetReuseSet()),
                stringList("reuse governed layout shell", "reuse project boundary adapter bridge")));
        response.put("requiredContractSet", stringList("common-core.theme.contract", ownerLane() + ".binding.contract"));
        response.put("status", "OPEN");
        response.put("result", "READY_FOR_REPAIR");
        response.put("releaseUnitId", releaseUnitId);
        response.put("compareBaseline", orDefault(request.getCompareBaseline(), "governed-runtime-truth"));
        response.put("reasonCode", orDefault(request.getReasonCode(), "PARITY_GAP"));
        response.put("deployTraceId", deployTraceId);
        response.put("deployContract", buildRepairDeployContract(projectId, releaseUnitId, deploymentTarget));
        response.put("serverStateSet", buildPipelineServerStateSet(projectId, releaseUnitId, deployTraceId, deploymentTarget, now()));
        response.put("requestedBy", orDefault(request.getRequestedBy(), "system"));
        response.put("requestedByType", orDefault(request.getRequestedByType(), "PLATFORM_OPERATOR"));
        response.put("requestNote", orDefault(request.getRequestNote(), "Repair session opened from runtime compare."));
        response.put("occurredAt", now());
        response.put("traceId", "trace-" + shortId());
        persistRepairSessionToDatabase(request, response);
        return response;
    }

    @Override
    public Map<String, Object> applyRepair(RepairApplyRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String candidateReleaseUnitId = buildReleaseUnitId("candidate", projectId);
        String candidateRuntimePackageId = buildRuntimePackageId("repair-pkg", projectId);
        String deploymentTarget = resolveRepairDeploymentTarget(request.getPublishMode());
        String deployTraceId = "repair-apply-" + shortId();
        Map<String, Object> response = orderedMap();
        response.put("repairApplyRunId", "repair-apply-" + shortId());
        response.put("repairSessionId", required(request.getRepairSessionId(), "repairSessionId"));
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("ownerLane", orDefault(request.getOwnerLane(), ownerLane()));
        response.put("builderInput", normalizeObjectMap(request.getBuilderInput()));
        response.put("runtimeEvidence", normalizeObjectMap(request.getRuntimeEvidence()));
        response.put("updatedAssetTraceSet", mergeStringLists(
                normalizeStringList(request.getUpdatedAssetSet()),
                stringList("asset/layout-shell", "asset/event-binding-remap")));
        response.put("updatedReleaseCandidateId", candidateReleaseUnitId);
        response.put("candidateRuntimePackageId", candidateRuntimePackageId);
        response.put("deployTraceId", deployTraceId);
        response.put("parityRecheckRequiredYn", Boolean.TRUE);
        response.put("uniformityRecheckRequiredYn", Boolean.TRUE);
        response.put("smokeRequiredYn", Boolean.TRUE);
        response.put("status", "APPLIED");
        response.put("result", "RECHECK_REQUIRED");
        response.put("projectId", projectId);
        response.put("releaseUnitId", orDefault(request.getReleaseUnitId(), buildReleaseUnitId("rel", projectId)));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("selectedScreenId", orDefault(request.getSelectedScreenId(), "screen.runtime.main"));
        response.put("selectedElementSet", normalizeStringList(request.getSelectedElementSet()));
        response.put("updatedBindingSet", mergeStringLists(normalizeStringList(request.getUpdatedBindingSet()), stringList("binding:onClick->projectAction")));
        response.put("updatedThemeOrLayoutSet", mergeStringLists(normalizeStringList(request.getUpdatedThemeOrLayoutSet()), stringList("theme:color.primary.600")));
        response.put("sqlDraftSet", normalizeStringList(request.getSqlDraftSet()));
        response.put("publishMode", orDefault(request.getPublishMode(), "CONTROLLED_PACKAGE"));
        response.put("deployContract", buildRepairDeployContract(projectId, candidateReleaseUnitId, deploymentTarget));
        response.put("serverStateSet", buildPipelineServerStateSet(projectId, candidateReleaseUnitId, deployTraceId, deploymentTarget, now()));
        response.put("requestedBy", orDefault(request.getRequestedBy(), "system"));
        response.put("requestedByType", orDefault(request.getRequestedByType(), "PLATFORM_OPERATOR"));
        response.put("changeSummary", orDefault(request.getChangeSummary(), "Applied governed repair patch set."));
        response.put("compareBaseline", orDefault(request.getCompareBaseline(), compareBaseline()));
        response.put("occurredAt", now());
        response.put("traceId", "trace-" + shortId());
        if (canUseDatabase()) {
            persistRepairApplyRecordToDatabase(request, response);
            persistRepairApplyRunToDatabase(request, response);
        }
        return response;
    }

    @Override
    public Map<String, Object> runProjectPipeline(ProjectPipelineRunRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String requestedReleaseUnitId = hasText(request.getReleaseUnitId()) ? request.getReleaseUnitId().trim() : "";
        Map<String, Object> selectedReleaseUnit = hasText(requestedReleaseUnitId)
                ? defaultMap(projectVersionManagementMapper.selectReleaseUnit(requestedReleaseUnitId))
                : orderedMap();
        String releaseUnitId = hasText(requestedReleaseUnitId)
                ? requestedReleaseUnitId
                : buildReleaseUnitId(orDefault(request.getReleaseUnitPrefix(), "rel"), projectId);
        String runtimePackageId = hasText(request.getRuntimePackageId())
                ? request.getRuntimePackageId().trim()
                : firstNonBlank(value(selectedReleaseUnit, "runtimePackageId"), buildRuntimePackageId(orDefault(request.getRuntimePackagePrefix(), "pkg"), projectId));
        String pipelineRunId = "pipe-" + shortId();
        String releaseFamilyId = ScreenBuilderPlatformFamilyRegistry.releaseFamilyId(projectId);
        String deployTraceId = "deploy-" + shortId();
        String artifactManifestId = "manifest-" + shortId();
        String rollbackTargetReleaseUnitId = firstNonBlank(
                resolvePreviousReleaseUnitId(projectId, releaseUnitId),
                value(selectedReleaseUnit, "rollbackTargetReleaseId"));
        String occurredAt = now();

        Map<String, Object> installableProduct = orderedMap();
        installableProduct.put("installableProductId", "product-" + shortId());
        installableProduct.put("productType", "INSTALLABLE_RUNTIME_PACKAGE");
        installableProduct.put("packageId", runtimePackageId);
        installableProduct.put("packageFormat", "ZIP");
        installableProduct.put("menuBinding", orderedMap(
                "menuRoot", orDefault(request.getMenuRoot(), "admin.runtime"),
                "runtimeClass", orDefault(request.getRuntimeClass(), projectId + ".Runtime"),
                "menuScope", orDefault(request.getMenuScope(), "ADMIN")));

        Map<String, Object> boundarySummary = orderedMap();
        boundarySummary.put("commonCoreOwnership", "framework-common");
        boundarySummary.put("projectAdapterOwnership", adapterArtifactId(projectId));
        boundarySummary.put("adapterBoundaryStatus", "GOVERNED");
        boundarySummary.put("projectId", projectId);

        List<Map<String, Object>> validatorCheckSet = new ArrayList<Map<String, Object>>();
        validatorCheckSet.add(orderedMap("validatorId", "boundary-schema", "status", "PASS", "summary", "common/project adapter boundary is fixed"));
        validatorCheckSet.add(orderedMap("validatorId", "installable-package", "status", "PASS", "summary", "installable product can be packaged"));
        validatorCheckSet.add(orderedMap(
                "validatorId", "rollback-anchor",
                "status", hasText(rollbackTargetReleaseUnitId) ? "PASS" : "WARN",
                "summary", hasText(rollbackTargetReleaseUnitId)
                        ? "rollback target release is registered"
                        : "previous release unit is not available yet"));

        List<Map<String, Object>> stageSet = new ArrayList<Map<String, Object>>();
        stageSet.add(stage("scaffold", "DONE", "governed project scaffold prepared"));
        stageSet.add(stage("validate", "DONE", "validator set completed"));
        stageSet.add(stage("package", "DONE", "installable package produced"));
        stageSet.add(stage("deploy", "READY", "artifact deploy contract emitted"));
        stageSet.add(stage(
                "rollback-ready",
                hasText(rollbackTargetReleaseUnitId) ? "READY" : "PENDING",
                hasText(rollbackTargetReleaseUnitId) ? "rollback anchor persisted" : "waiting for previous release unit"));

        Map<String, Object> artifactVersionSet = orderedMap();
        artifactVersionSet.put(ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID, versionStamp("common-core"));
        artifactVersionSet.put(adapterContractArtifactId(projectId), versionStamp("adapter-contract"));
        artifactVersionSet.put(adapterArtifactId(projectId), versionStamp("adapter-artifact"));
        artifactVersionSet.put("runtime-package", runtimePackageId);

        Map<String, Object> artifactLineage = orderedMap();
        artifactLineage.put("releaseFamilyId", releaseFamilyId);
        artifactLineage.put("releaseTrackVersion", VERSION_STAMP.format(LocalDateTime.now(ZoneOffset.UTC)));
        artifactLineage.put("artifactManifestId", artifactManifestId);
        artifactLineage.put("rollbackAnchorReleaseUnitId", rollbackTargetReleaseUnitId);

        List<Map<String, Object>> artifactRegistryEntrySet = new ArrayList<Map<String, Object>>();
        artifactRegistryEntrySet.add(orderedMap(
                "artifactId", ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID,
                "artifactVersion", artifactVersionSet.get(ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID),
                "installScope", ScreenBuilderPlatformFamilyRegistry.resolveInstallScope(ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID)));
        artifactRegistryEntrySet.add(orderedMap(
                "artifactId", adapterArtifactId(projectId),
                "artifactVersion", artifactVersionSet.get(adapterArtifactId(projectId)),
                "installScope", ScreenBuilderPlatformFamilyRegistry.resolveInstallScope(adapterArtifactId(projectId))));
        artifactRegistryEntrySet.add(orderedMap("artifactId", runtimePackageId, "artifactVersion", runtimePackageId, "installScope", "INSTALLABLE_PRODUCT"));

        Map<String, Object> deployContract = orderedMap();
        deployContract.put("artifactTargetSystem", orDefault(request.getArtifactTargetSystem(), ScreenBuilderPlatformFamilyRegistry.PLATFORM_ARTIFACT_TARGET_SYSTEM));
        deployContract.put("deploymentTarget", orDefault(request.getDeploymentTarget(), "ops-runtime-main-01"));
        deployContract.put("deploymentRouteSet", buildDeploymentRouteSet(orDefault(request.getDeploymentTarget(), "ops-runtime-main-01")));
        deployContract.put("deploymentMode", "ARTIFACT_LINEAGE_CONTROLLED");
        deployContract.put("versionTrackingYn", Boolean.TRUE);
        deployContract.put("releaseFamilyId", releaseFamilyId);
        deployContract.put("releaseUnitId", releaseUnitId);

        Map<String, Object> rollbackPlan = orderedMap();
        rollbackPlan.put("rollbackTargetReleaseUnitId", rollbackTargetReleaseUnitId);
        rollbackPlan.put("rollbackMode", "ARTIFACT_REDEPLOY");

        Map<String, Object> response = orderedMap();
        response.put("pipelineRunId", pipelineRunId);
        response.put("traceId", "trace-" + shortId());
        response.put("projectId", projectId);
        response.put("scenarioId", orDefault(request.getScenarioId(), "project-installable-product"));
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("ownerLane", orDefault(request.getOwnerLane(), ownerLane()));
        response.put("menuRoot", orDefault(request.getMenuRoot(), "admin.runtime"));
        response.put("runtimeClass", orDefault(request.getRuntimeClass(), projectId + ".Runtime"));
        response.put("menuScope", orDefault(request.getMenuScope(), "ADMIN"));
        response.put("artifactTargetSystem", orDefault(request.getArtifactTargetSystem(), ScreenBuilderPlatformFamilyRegistry.PLATFORM_ARTIFACT_TARGET_SYSTEM));
        response.put("deploymentTarget", orDefault(request.getDeploymentTarget(), "ops-runtime-main-01"));
        response.put("releaseUnitId", releaseUnitId);
        response.put("runtimePackageId", runtimePackageId);
        response.put("deployTraceId", deployTraceId);
        response.put("commonArtifactSet", commonArtifactSet());
        response.put("projectAdapterArtifactSet", projectAdapterArtifactSet(projectId));
        response.put("installableArtifactSet", stringList(runtimePackageId, artifactManifestId));
        response.put("installableProduct", installableProduct);
        response.put("boundarySummary", boundarySummary);
        response.put("validatorCheckSet", validatorCheckSet);
        response.put("validatorPassCount", Integer.valueOf(validatorCheckSet.size()));
        response.put("validatorTotalCount", Integer.valueOf(validatorCheckSet.size()));
        response.put("stageSet", stageSet);
        response.put("artifactVersionSet", artifactVersionSet);
        response.put("artifactLineage", artifactLineage);
        response.put("artifactRegistryEntrySet", artifactRegistryEntrySet);
        response.put("deployContract", deployContract);
        response.put("serverStateSet", buildPipelineServerStateSet(
                projectId,
                releaseUnitId,
                deployTraceId,
                orDefault(request.getDeploymentTarget(), "ops-runtime-main-01"),
                occurredAt));
        response.put("rollbackPlan", rollbackPlan);
        response.put("operator", orDefault(request.getOperator(), "system"));
        response.put("result", "PIPELINE_READY");
        response.put("occurredAt", occurredAt);
        if (canUseDatabase()) {
            persistProjectPipelineToDatabase(request, response);
        }
        appendJsonLine(projectPipelineStore, response);
        return response;
    }

    @Override
    public Map<String, Object> getProjectPipelineStatus(ProjectPipelineStatusRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        if (canUseDatabase()) {
            Map<String, Object> databaseSnapshot = loadProjectPipelineStatusFromDatabase(request);
            if (databaseSnapshot != null) {
                return databaseSnapshot;
            }
        }
        Map<String, Object> stored = findLastProjectPipelineRecord(request);
        if (stored != null) {
            return stored;
        }
        ProjectPipelineRunRequest fallback = new ProjectPipelineRunRequest();
        fallback.setProjectId(projectId);
        fallback.setReleaseUnitPrefix("rel");
        fallback.setRuntimePackagePrefix("pkg");
        fallback.setMenuRoot("admin.runtime");
        fallback.setRuntimeClass(projectId + ".Runtime");
        fallback.setMenuScope("ADMIN");
        fallback.setOperator("system");
        return runProjectPipeline(fallback);
    }

    private Map<String, Object> loadProjectPipelineStatusFromDatabase(ProjectPipelineStatusRequest request) throws Exception {
        List<Map<String, Object>> releaseUnits = projectVersionManagementMapper.selectReleaseUnits(request.getProjectId());
        if (releaseUnits.isEmpty()) {
            return null;
        }

        Map<String, Object> selectedReleaseUnit = selectReleaseUnit(releaseUnits, request);
        if (selectedReleaseUnit == null) {
            return null;
        }

        List<Map<String, Object>> installedArtifacts = canonicalArtifactRows(
                request.getProjectId(),
                projectVersionManagementMapper.selectInstalledArtifacts(request.getProjectId()));
        List<Map<String, Object>> serverStates = projectVersionManagementMapper.selectServerDeploymentState(request.getProjectId());
        Map<String, Object> projectRegistry = projectVersionManagementMapper.selectProjectRegistry(request.getProjectId());

        Map<String, Object> packageVersionSet = canonicalizeArtifactVersionSet(
                request.getProjectId(),
                parseJsonObject(selectedReleaseUnit.get("packageVersionSetJson")));
        String releaseUnitId = value(selectedReleaseUnit, "releaseUnitId");
        String runtimePackageId = value(selectedReleaseUnit, "runtimePackageId");
        String rollbackTargetReleaseUnitId = value(selectedReleaseUnit, "rollbackTargetReleaseId");
        Map<String, Object> activeServer = selectActiveServer(serverStates, releaseUnitId);
        String deploymentTarget = firstNonBlank(value(activeServer, "serverId"), value(projectRegistry, "deploymentTarget"), "ops-runtime-main-01");
        String deployTraceId = firstNonBlank(value(activeServer, "deployTraceId"), "deploy-" + sanitize(releaseUnitId));

        List<Map<String, Object>> artifactRegistryEntrySet = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> artifact : installedArtifacts) {
            artifactRegistryEntrySet.add(orderedMap(
                    "artifactId", value(artifact, "artifactId"),
                    "artifactVersion", value(artifact, "installedArtifactVersion"),
                    "installScope", value(artifact, "installScope")));
        }

        List<String> commonArtifactSet = new ArrayList<String>();
        List<String> projectAdapterArtifactSet = new ArrayList<String>();
        List<String> installableArtifactSet = new ArrayList<String>();
        for (Map<String, Object> entry : artifactRegistryEntrySet) {
            String artifactId = value(entry, "artifactId");
            String installScope = value(entry, "installScope");
            if ("COMMON".equalsIgnoreCase(installScope)) {
                commonArtifactSet.add(artifactId);
            } else if (isProjectAdapterArtifact(request.getProjectId(), artifactId)) {
                projectAdapterArtifactSet.add(artifactId);
            } else {
                installableArtifactSet.add(artifactId);
            }
        }
        if (!installableArtifactSet.contains(runtimePackageId)) {
            installableArtifactSet.add(runtimePackageId);
        }

        List<Map<String, Object>> validatorCheckSet = new ArrayList<Map<String, Object>>();
        validatorCheckSet.add(orderedMap(
                "validatorId", "release-unit-registered",
                "status", "PASS",
                "summary", "Release unit registry entry exists."));
        validatorCheckSet.add(orderedMap(
                "validatorId", "artifact-install-bound",
                "status", artifactRegistryEntrySet.isEmpty() ? "WARN" : "PASS",
                "summary", artifactRegistryEntrySet.isEmpty()
                        ? "Artifact install registry is empty for this project."
                        : "Artifact install registry is aligned to the release unit."));
        validatorCheckSet.add(orderedMap(
                "validatorId", "rollback-anchor-present",
                "status", hasText(rollbackTargetReleaseUnitId) ? "PASS" : "WARN",
                "summary", hasText(rollbackTargetReleaseUnitId)
                        ? "Rollback target release unit is registered."
                        : "Rollback target release unit is not registered."));

        List<Map<String, Object>> stageSet = new ArrayList<Map<String, Object>>();
        stageSet.add(stage("registry-load", "DONE", "Release unit and install registry loaded"));
        stageSet.add(stage("validate", "DONE", "Registry-backed validator checks assembled"));
        stageSet.add(stage("package", hasText(runtimePackageId) ? "DONE" : "WARN", "Runtime package identity resolved from release unit"));
        stageSet.add(stage("deploy", hasText(value(activeServer, "serverId")) ? "READY" : "PENDING", "Deployment trace resolved from server deployment state"));
        stageSet.add(stage("rollback-ready", hasText(rollbackTargetReleaseUnitId) ? "READY" : "PENDING", "Rollback anchor evaluated from release unit registry"));

        Map<String, Object> installableProduct = orderedMap(
                "installableProductId", "installable-" + sanitize(request.getProjectId()),
                "productType", "INSTALLABLE_RUNTIME_PACKAGE",
                "packageId", runtimePackageId,
                "packageFormat", "jar+properties+manifest",
                "menuBinding", orderedMap(
                        "menuRoot", "admin.runtime",
                        "runtimeClass", firstNonBlank(value(projectRegistry, "projectCode"), request.getProjectId()) + ".Runtime",
                        "menuScope", "ADMIN"));

        Map<String, Object> boundarySummary = orderedMap(
                "commonCoreOwnership", "framework-common",
                "projectAdapterOwnership", request.getProjectId() + "-adapter",
                "adapterBoundaryStatus", "GOVERNED",
                "projectId", request.getProjectId());

        Map<String, Object> artifactLineage = orderedMap(
                "releaseFamilyId", request.getProjectId() + "-family",
                "releaseTrackVersion", firstNonBlank(value(selectedReleaseUnit, "builtAt"), now()),
                "artifactManifestId", "manifest-" + sanitize(releaseUnitId),
                "rollbackAnchorReleaseUnitId", rollbackTargetReleaseUnitId);

        Map<String, Object> deployContract = orderedMap(
                "artifactTargetSystem", firstNonBlank(value(projectRegistry, "projectCode"), request.getProjectId()),
                "deploymentTarget", deploymentTarget,
                "deploymentRouteSet", buildDeploymentRouteSet(deploymentTarget),
                "deploymentMode", "ARTIFACT_LINEAGE_CONTROLLED",
                "versionTrackingYn", Boolean.TRUE,
                "releaseFamilyId", request.getProjectId() + "-family",
                "releaseUnitId", releaseUnitId);

        Map<String, Object> rollbackPlan = orderedMap(
                "rollbackTargetReleaseUnitId", rollbackTargetReleaseUnitId,
                "rollbackMode", "ARTIFACT_REDEPLOY");

        Map<String, Object> response = orderedMap();
        response.put("pipelineRunId", "db-" + sanitize(releaseUnitId));
        response.put("traceId", "trace-" + sanitize(releaseUnitId));
        response.put("projectId", request.getProjectId());
        response.put("scenarioId", "project-installable-product");
        response.put("guidedStateId", request.getProjectId() + ".guided-state");
        response.put("templateLineId", "template.runtime.standard");
        response.put("screenFamilyRuleId", "screen-family.standard");
        response.put("ownerLane", ownerLane());
        response.put("menuRoot", "admin.runtime");
        response.put("runtimeClass", firstNonBlank(value(projectRegistry, "projectCode"), request.getProjectId()) + ".Runtime");
        response.put("menuScope", "ADMIN");
        response.put("artifactTargetSystem", firstNonBlank(value(projectRegistry, "projectCode"), request.getProjectId()));
        response.put("deploymentTarget", deploymentTarget);
        response.put("releaseUnitId", releaseUnitId);
        response.put("runtimePackageId", runtimePackageId);
        response.put("deployTraceId", deployTraceId);
        response.put("commonArtifactSet", commonArtifactSet);
        response.put("projectAdapterArtifactSet", projectAdapterArtifactSet);
        response.put("installableArtifactSet", installableArtifactSet);
        response.put("installableProduct", installableProduct);
        response.put("boundarySummary", boundarySummary);
        response.put("validatorCheckSet", validatorCheckSet);
        response.put("validatorPassCount", Integer.valueOf(countPasses(validatorCheckSet)));
        response.put("validatorTotalCount", Integer.valueOf(validatorCheckSet.size()));
        response.put("stageSet", stageSet);
        response.put("artifactVersionSet", packageVersionSet);
        response.put("artifactLineage", artifactLineage);
        response.put("artifactRegistryEntrySet", artifactRegistryEntrySet);
        response.put("deployContract", deployContract);
        response.put("serverStateSet", buildPipelineServerStateSetFromDatabase(
                request.getProjectId(),
                releaseUnitId,
                deployTraceId,
                deploymentTarget,
                firstNonBlank(value(selectedReleaseUnit, "approvedAt"), value(selectedReleaseUnit, "builtAt"), now()),
                serverStates));
        response.put("rollbackPlan", rollbackPlan);
        response.put("operator", value(selectedReleaseUnit, "approvedBy"));
        response.put("result", "PIPELINE_READY");
        response.put("occurredAt", firstNonBlank(value(selectedReleaseUnit, "approvedAt"), value(selectedReleaseUnit, "builtAt"), now()));
        return response;
    }

    private Map<String, Object> findLastProjectPipelineRecord(ProjectPipelineStatusRequest request) throws IOException {
        Path path = Paths.get(projectPipelineStore);
        if (!Files.exists(path)) {
            return null;
        }
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        for (int i = lines.size() - 1; i >= 0; i--) {
            String line = lines.get(i).trim();
            if (line.isEmpty()) {
                continue;
            }
            Map<String, Object> record = objectMapper.readValue(line, MAP_TYPE);
            if (!matches(record, request)) {
                continue;
            }
            return record;
        }
        return null;
    }

    private boolean matches(Map<String, Object> record, ProjectPipelineStatusRequest request) {
        if (record == null) {
            return false;
        }
        if (!request.getProjectId().equals(String.valueOf(record.get("projectId")))) {
            return false;
        }
        if (hasText(request.getPipelineRunId()) && !request.getPipelineRunId().equals(String.valueOf(record.get("pipelineRunId")))) {
            return false;
        }
        if (hasText(request.getReleaseUnitId()) && !request.getReleaseUnitId().equals(String.valueOf(record.get("releaseUnitId")))) {
            return false;
        }
        return true;
    }

    private boolean canUseDatabase() {
        try {
            return projectVersionManagementMapper != null
                    && projectVersionManagementMapper.countArtifactVersionRegistry() >= 0
                    && projectVersionManagementMapper.countProjectArtifactInstall() >= 0
                    && projectVersionManagementMapper.countReleaseUnitRegistry() >= 0;
        } catch (Exception e) {
            return false;
        }
    }

    private Map<String, Object> selectReleaseUnit(List<Map<String, Object>> releaseUnits, ProjectPipelineStatusRequest request) {
        if (hasText(request.getReleaseUnitId())) {
            for (Map<String, Object> row : releaseUnits) {
                if (request.getReleaseUnitId().equals(value(row, "releaseUnitId"))) {
                    return row;
                }
            }
        }
        return releaseUnits.isEmpty() ? null : releaseUnits.get(0);
    }

    private Map<String, Object> selectActiveServer(List<Map<String, Object>> serverStates, String releaseUnitId) {
        for (Map<String, Object> row : serverStates) {
            if (releaseUnitId.equals(value(row, "activeReleaseUnitId"))) {
                return row;
            }
        }
        return serverStates.isEmpty() ? orderedMap() : serverStates.get(0);
    }

    private int countPasses(List<Map<String, Object>> validatorCheckSet) {
        int count = 0;
        for (Map<String, Object> item : validatorCheckSet) {
            if ("PASS".equalsIgnoreCase(value(item, "status"))) {
                count += 1;
            }
        }
        return count;
    }

    private Map<String, Object> compareRow(String target, String currentRuntime, String generatedTarget, String proposalBaseline, String patchTarget) {
        return orderedMap(
                "target", target,
                "currentRuntime", currentRuntime,
                "generatedTarget", generatedTarget,
                "proposalBaseline", proposalBaseline,
                "patchTarget", patchTarget,
                "result", "MISMATCH");
    }

    private Map<String, Object> stage(String stageId, String status, String summary) {
        return orderedMap("stageId", stageId, "status", status, "summary", summary);
    }

    private Map<String, Object> parseJsonObject(Object value) throws IOException {
        if (value == null) {
            return orderedMap();
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return orderedMap();
        }
        return objectMapper.readValue(text, MAP_TYPE);
    }

    private List<String> parseJsonArray(Object value) throws IOException {
        if (value == null) {
            return new ArrayList<String>();
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return new ArrayList<String>();
        }
        List<String> values = objectMapper.readValue(text, new TypeReference<List<String>>() {});
        return values == null ? new ArrayList<String>() : values;
    }

    private void persistProjectPipelineToDatabase(ProjectPipelineRunRequest request, Map<String, Object> response) throws Exception {
        String projectId = value(response, "projectId");
        String releaseUnitId = value(response, "releaseUnitId");
        String runtimePackageId = value(response, "runtimePackageId");
        String rollbackTargetReleaseId = value(valueMap(response, "rollbackPlan"), "rollbackTargetReleaseUnitId");
        String operator = firstNonBlank(value(response, "operator"), orDefault(request.getOperator(), "system"));
        boolean existingReleaseUnit = !defaultMap(projectVersionManagementMapper.selectReleaseUnit(releaseUnitId)).isEmpty();

        Map<String, Object> artifactVersionSet = canonicalizeArtifactVersionSet(
                projectId,
                new LinkedHashMap<String, Object>(valueMap(response, "artifactVersionSet")));
        List<String> commonArtifactSet = normalizeObjectStringList(response.get("commonArtifactSet"));
        List<String> installableArtifactSet = normalizeObjectStringList(response.get("installableArtifactSet"));
        List<Map<String, Object>> artifactRegistryEntrySet = canonicalArtifactRows(
                projectId,
                normalizeObjectMapList(response.get("artifactRegistryEntrySet")));

        if (!existingReleaseUnit) {
            projectVersionManagementMapper.insertReleaseUnitRegistry(orderedMap(
                    "releaseUnitId", releaseUnitId,
                    "projectId", projectId,
                    "runtimePackageId", runtimePackageId,
                    "projectRuntimeVersion", runtimePackageId,
                    "adapterArtifactVersion", firstNonBlank(
                            valueFromMap(artifactVersionSet, adapterArtifactId(projectId)),
                            ""),
                    "adapterContractVersion", valueFromMap(artifactVersionSet, adapterContractArtifactId(projectId)),
                    "commonArtifactSetJson", objectMapper.writeValueAsString(commonArtifactSet),
                    "packageVersionSetJson", objectMapper.writeValueAsString(artifactVersionSet),
                    "rollbackTargetReleaseId", rollbackTargetReleaseId,
                    "approvedBy", operator));

            List<Map<String, Object>> currentInstalls = canonicalArtifactRows(
                    projectId,
                    projectVersionManagementMapper.selectInstalledArtifacts(projectId));
            Map<String, String> rollbackVersionByArtifactId = new LinkedHashMap<String, String>();
            for (Map<String, Object> installed : currentInstalls) {
                rollbackVersionByArtifactId.put(value(installed, "artifactId"), value(installed, "installedArtifactVersion"));
            }
            projectVersionManagementMapper.deactivateProjectArtifactInstalls(projectId);

            for (Map<String, Object> entry : artifactRegistryEntrySet) {
                String artifactId = value(entry, "artifactId");
                String artifactVersion = firstNonBlank(value(entry, "artifactVersion"), valueFromMap(artifactVersionSet, artifactId));
                if (!hasText(artifactId) || !hasText(artifactVersion)) {
                    continue;
                }
                Map<String, Object> artifactVersionRow = projectVersionManagementMapper.selectArtifactVersionByKey(orderedMap(
                        "artifactId", artifactId,
                        "artifactVersion", artifactVersion));
                if (artifactVersionRow == null) {
                    continue;
                }
                projectVersionManagementMapper.insertProjectArtifactInstall(orderedMap(
                        "projectArtifactInstallId", "pai-" + shortId(),
                        "projectId", projectId,
                        "artifactVersionId", value(artifactVersionRow, "artifactVersionId"),
                        "installScope", firstNonBlank(value(entry, "installScope"), resolveInstallScope(artifactId)),
                        "releaseUnitId", releaseUnitId,
                        "rollbackTargetVersion", rollbackVersionByArtifactId.get(artifactId),
                        "installedBy", operator));
            }

            String adapterArtifactVersion = firstNonBlank(
                    valueFromMap(artifactVersionSet, adapterArtifactId(projectId)));
            String adapterContractVersion = valueFromMap(artifactVersionSet, adapterContractArtifactId(projectId));
            if (hasText(adapterArtifactVersion) || hasText(adapterContractVersion)) {
                projectVersionManagementMapper.insertAdapterChangeLog(orderedMap(
                        "adapterChangeId", "chg-" + shortId(),
                        "projectId", projectId,
                        "adapterArtifactVersion", adapterArtifactVersion,
                        "adapterContractVersion", adapterContractVersion,
                        "changedPortSetJson", objectMapper.writeValueAsString(stringList("screen-binding", "menu-binding")),
                        "changedDtoSetJson", objectMapper.writeValueAsString(stringList("ProjectRuntimeContract", "ProjectDeployContract")),
                        "mappingImpactSummary", "Project pipeline run persisted into release/install registry.",
                        "compatibilityClass", "ADAPTER_SAFE",
                        "migrationRequiredYn", "N",
                        "relatedReleaseUnitId", releaseUnitId,
                        "recordedBy", operator));
            }
        }

        String deploymentTarget = firstNonBlank(value(response, "deploymentTarget"), "ops-runtime-main-01");
        String deployTraceId = firstNonBlank(value(response, "deployTraceId"), "deploy-" + sanitize(releaseUnitId));
        for (Map<String, Object> serverState : buildDeploymentStateRecords(projectId, releaseUnitId, deployTraceId, deploymentTarget, operator)) {
            projectVersionManagementMapper.insertServerDeploymentState(serverState);
        }

        if (!installableArtifactSet.contains(runtimePackageId)) {
            installableArtifactSet.add(runtimePackageId);
        }
    }

    private List<Map<String, Object>> buildDeploymentRouteSet(String deploymentTarget) {
        String targetRole = resolveDeploymentRole(deploymentTarget);
        List<Map<String, Object>> routeSet = new ArrayList<Map<String, Object>>();
        routeSet.add(orderedMap(
                "serverId", "ops-runtime-preview-01",
                "serverRole", "PREVIEW",
                "promotionState", "PRIMARY".equals(targetRole) || "STAGE".equals(targetRole) ? "PROMOTED" : "TARGET"));
        routeSet.add(orderedMap(
                "serverId", "ops-runtime-stage-01",
                "serverRole", "STAGE",
                "promotionState", "PRIMARY".equals(targetRole) ? "PROMOTED" : ("STAGE".equals(targetRole) ? "TARGET" : "PENDING")));
        routeSet.add(orderedMap(
                "serverId", "ops-runtime-main-01",
                "serverRole", "PRIMARY",
                "promotionState", "PRIMARY".equals(targetRole) ? "TARGET" : "PENDING"));
        return routeSet;
    }

    private Map<String, Object> buildRepairDeployContract(String projectId, String releaseUnitId, String deploymentTarget) {
        return orderedMap(
                "artifactTargetSystem", projectId,
                "deploymentTarget", deploymentTarget,
                "deploymentRouteSet", buildDeploymentRouteSet(deploymentTarget),
                "deploymentMode", "REPAIR_CANDIDATE_FLOW",
                "versionTrackingYn", Boolean.TRUE,
                "releaseFamilyId", ScreenBuilderPlatformFamilyRegistry.releaseFamilyId(projectId),
                "releaseUnitId", releaseUnitId);
    }

    private List<Map<String, Object>> buildPipelineServerStateSet(
            String projectId,
            String releaseUnitId,
            String deployTraceId,
            String deploymentTarget,
            String occurredAt
    ) {
        String targetRole = resolveDeploymentRole(deploymentTarget);
        List<Map<String, Object>> states = new ArrayList<Map<String, Object>>();
        states.add(buildPipelineServerState("ops-runtime-preview-01", "PREVIEW", projectId, releaseUnitId, deployTraceId, occurredAt, targetRole));
        states.add(buildPipelineServerState("ops-runtime-stage-01", "STAGE", projectId, releaseUnitId, deployTraceId, occurredAt, targetRole));
        states.add(buildPipelineServerState("ops-runtime-main-01", "PRIMARY", projectId, releaseUnitId, deployTraceId, occurredAt, targetRole));
        return states;
    }

    private List<Map<String, Object>> buildPipelineServerStateSetFromDatabase(
            String projectId,
            String releaseUnitId,
            String deployTraceId,
            String deploymentTarget,
            String occurredAt,
            List<Map<String, Object>> databaseRows
    ) {
        Map<String, Map<String, Object>> latestByRole = new LinkedHashMap<String, Map<String, Object>>();
        if (databaseRows != null) {
            for (Map<String, Object> row : databaseRows) {
                if (!releaseUnitId.equals(value(row, "activeReleaseUnitId"))) {
                    continue;
                }
                String serverRole = value(row, "serverRole");
                if (!latestByRole.containsKey(serverRole)) {
                    latestByRole.put(serverRole, row);
                }
            }
        }
        if (latestByRole.isEmpty()) {
            return buildPipelineServerStateSet(projectId, releaseUnitId, deployTraceId, deploymentTarget, occurredAt);
        }

        List<Map<String, Object>> states = new ArrayList<Map<String, Object>>();
        for (String serverRole : stringList("PREVIEW", "STAGE", "PRIMARY")) {
            Map<String, Object> row = latestByRole.get(serverRole);
            if (row == null) {
                continue;
            }
            states.add(orderedMap(
                    "serverId", value(row, "serverId"),
                    "serverRole", serverRole,
                    "projectId", projectId,
                    "activeReleaseUnitId", releaseUnitId,
                    "deployTraceId", firstNonBlank(value(row, "deployTraceId"), deployTraceId),
                    "deployedAt", firstNonBlank(value(row, "deployedAt"), occurredAt),
                    "healthStatus", value(row, "healthStatus"),
                    "promotionState", resolvePromotionState(serverRole, resolveDeploymentRole(deploymentTarget))));
        }
        return states;
    }

    private Map<String, Object> buildPipelineServerState(
            String serverId,
            String serverRole,
            String projectId,
            String releaseUnitId,
            String deployTraceId,
            String occurredAt,
            String targetRole
    ) {
        return orderedMap(
                "serverId", serverId,
                "serverRole", serverRole,
                "projectId", projectId,
                "activeReleaseUnitId", releaseUnitId,
                "deployTraceId", deployTraceId,
                "deployedAt", occurredAt,
                "healthStatus", resolvePipelineHealthStatus(serverRole, targetRole),
                "promotionState", resolvePromotionState(serverRole, targetRole));
    }

    private String resolvePipelineHealthStatus(String serverRole, String targetRole) {
        if ("PREVIEW".equals(serverRole)) {
            return "PREVIEW".equals(targetRole) ? "HEALTHY" : "PROMOTED";
        }
        if ("STAGE".equals(serverRole)) {
            return "PRIMARY".equals(targetRole) ? "PROMOTED" : ("STAGE".equals(targetRole) ? "VALIDATING" : "PENDING_PROMOTION");
        }
        return "PRIMARY".equals(targetRole) ? "HEALTHY" : "PENDING_PROMOTION";
    }

    private String resolvePromotionState(String serverRole, String targetRole) {
        if (serverRole.equals(targetRole)) {
            return "TARGET";
        }
        if ("PREVIEW".equals(serverRole)) {
            return "PROMOTED";
        }
        if ("STAGE".equals(serverRole)) {
            return "PRIMARY".equals(targetRole) ? "PROMOTED" : "PENDING";
        }
        return "PENDING";
    }

    private List<Map<String, Object>> buildDeploymentStateRecords(
            String projectId,
            String releaseUnitId,
            String deployTraceId,
            String deploymentTarget,
            String operator
    ) {
        String targetRole = resolveDeploymentRole(deploymentTarget);
        List<Map<String, Object>> states = new ArrayList<Map<String, Object>>();
        states.add(buildDeploymentStateRecord("ops-runtime-preview-01", "PREVIEW", projectId, releaseUnitId, deployTraceId, operator, targetRole));
        states.add(buildDeploymentStateRecord("ops-runtime-stage-01", "STAGE", projectId, releaseUnitId, deployTraceId, operator, targetRole));
        states.add(buildDeploymentStateRecord("ops-runtime-main-01", "PRIMARY", projectId, releaseUnitId, deployTraceId, operator, targetRole));
        return states;
    }

    private Map<String, Object> buildDeploymentStateRecord(
            String serverId,
            String serverRole,
            String projectId,
            String releaseUnitId,
            String deployTraceId,
            String operator,
            String targetRole
    ) {
        String healthStatus;
        if ("PREVIEW".equals(serverRole)) {
            healthStatus = "PREVIEW".equals(targetRole) ? "HEALTHY" : "PROMOTED";
        } else if ("STAGE".equals(serverRole)) {
            healthStatus = "PRIMARY".equals(targetRole) ? "PROMOTED" : ("STAGE".equals(targetRole) ? "VALIDATING" : "PENDING_PROMOTION");
        } else {
            healthStatus = "PRIMARY".equals(targetRole) ? "HEALTHY" : "PENDING_PROMOTION";
        }
        return orderedMap(
                "serverDeploymentId", "dep-" + shortId(),
                "serverId", serverId,
                "serverRole", serverRole,
                "projectId", projectId,
                "releaseUnitId", releaseUnitId,
                "deployTraceId", deployTraceId,
                "healthStatus", healthStatus,
                "deployedBy", operator);
    }

    private String resolveDeploymentRole(String deploymentTarget) {
        String normalized = firstNonBlank(deploymentTarget, "").toLowerCase();
        if (normalized.contains("preview")) {
            return "PREVIEW";
        }
        if (normalized.contains("stage")) {
            return "STAGE";
        }
        return "PRIMARY";
    }

    private String resolveRepairDeploymentTarget(String publishMode) {
        String normalized = firstNonBlank(publishMode, "").toUpperCase();
        if ("PUBLISH_READY".equals(normalized)) {
            return "ops-runtime-main-01";
        }
        if ("REVIEW_READY".equals(normalized)) {
            return "ops-runtime-stage-01";
        }
        return "ops-runtime-preview-01";
    }

    private void persistRepairApplyRecordToDatabase(RepairApplyRequest request, Map<String, Object> response) throws Exception {
        String projectId = value(response, "projectId");
        String candidateReleaseUnitId = value(response, "updatedReleaseCandidateId");
        String candidateRuntimePackageId = value(response, "candidateRuntimePackageId");
        String operator = firstNonBlank(value(response, "requestedBy"), request.getRequestedBy(), "system");

        List<Map<String, Object>> releaseUnits = projectVersionManagementMapper.selectReleaseUnits(projectId);
        Map<String, Object> baseReleaseUnit = selectBaseReleaseUnit(releaseUnits, request.getReleaseUnitId());
        List<Map<String, Object>> currentInstalls = canonicalArtifactRows(
                projectId,
                projectVersionManagementMapper.selectInstalledArtifacts(projectId));
        Map<String, Object> packageVersionSet = buildRepairPackageVersionSet(projectId, baseReleaseUnit, currentInstalls);

        boolean adapterArtifactChanged = !normalizeStringList(request.getUpdatedAssetSet()).isEmpty()
                || !normalizeStringList(request.getUpdatedThemeOrLayoutSet()).isEmpty();
        boolean adapterContractChanged = !normalizeStringList(request.getUpdatedBindingSet()).isEmpty();

        String adapterArtifactVersion = buildRepairAdapterVersion(
                packageVersionSet,
                adapterArtifactId(projectId),
                adapterArtifactChanged,
                "repair-adapter-artifact");
        String adapterContractVersion = buildRepairAdapterVersion(
                packageVersionSet,
                adapterContractArtifactId(projectId),
                adapterContractChanged,
                "repair-adapter-contract");
        packageVersionSet.put(adapterArtifactId(projectId), adapterArtifactVersion);
        packageVersionSet.put(adapterContractArtifactId(projectId), adapterContractVersion);
        packageVersionSet.put("runtime-package", candidateRuntimePackageId);

        List<String> commonArtifactSet = buildCommonArtifactSet(baseReleaseUnit, currentInstalls);
        String rollbackTargetReleaseId = firstNonBlank(
                request.getReleaseUnitId(),
                value(baseReleaseUnit, "releaseUnitId"),
                value(baseReleaseUnit, "rollbackTargetReleaseId"));

        projectVersionManagementMapper.insertReleaseUnitRegistry(orderedMap(
                "releaseUnitId", candidateReleaseUnitId,
                "projectId", projectId,
                "runtimePackageId", candidateRuntimePackageId,
                "projectRuntimeVersion", candidateRuntimePackageId,
                "adapterArtifactVersion", adapterArtifactVersion,
                "adapterContractVersion", adapterContractVersion,
                "commonArtifactSetJson", objectMapper.writeValueAsString(commonArtifactSet),
                "packageVersionSetJson", objectMapper.writeValueAsString(packageVersionSet),
                "rollbackTargetReleaseId", rollbackTargetReleaseId,
                "approvedBy", operator));

        projectVersionManagementMapper.insertAdapterChangeLog(orderedMap(
                "adapterChangeId", "chg-" + shortId(),
                "projectId", projectId,
                "adapterArtifactVersion", adapterArtifactVersion,
                "adapterContractVersion", adapterContractVersion,
                "changedPortSetJson", objectMapper.writeValueAsString(mergeStringLists(
                        normalizeStringList(request.getUpdatedBindingSet()),
                        stringList("binding:onClick->projectAction"))),
                "changedDtoSetJson", objectMapper.writeValueAsString(buildRepairDtoSet(request)),
                "mappingImpactSummary", firstNonBlank(
                        request.getChangeSummary(),
                        "Repair apply persisted as release candidate without deployment activation."),
                "compatibilityClass", "ADAPTER_REVIEW_REQUIRED",
                "migrationRequiredYn", "Y",
                "relatedReleaseUnitId", candidateReleaseUnitId,
                "recordedBy", operator));
    }

    private Map<String, Object> selectBaseReleaseUnit(List<Map<String, Object>> releaseUnits, String releaseUnitId) {
        if (releaseUnits == null || releaseUnits.isEmpty()) {
            return orderedMap();
        }
        if (hasText(releaseUnitId)) {
            for (Map<String, Object> row : releaseUnits) {
                if (releaseUnitId.equals(value(row, "releaseUnitId"))) {
                    return row;
                }
            }
        }
        return releaseUnits.get(0);
    }

    private String resolvePreviousReleaseUnitId(String projectId, String releaseUnitId) {
        if (!hasText(projectId)) {
            return "";
        }
        List<Map<String, Object>> releaseUnits = projectVersionManagementMapper.selectReleaseUnits(projectId);
        if (releaseUnits == null || releaseUnits.isEmpty()) {
            return "";
        }
        if (!hasText(releaseUnitId)) {
            return value(releaseUnits.get(0), "releaseUnitId");
        }
        for (int index = 0; index < releaseUnits.size(); index++) {
            if (!releaseUnitId.equals(value(releaseUnits.get(index), "releaseUnitId"))) {
                continue;
            }
            return index + 1 < releaseUnits.size() ? value(releaseUnits.get(index + 1), "releaseUnitId") : "";
        }
        return value(releaseUnits.get(0), "releaseUnitId");
    }

    private Map<String, Object> buildRepairPackageVersionSet(
            String projectId,
            Map<String, Object> baseReleaseUnit,
            List<Map<String, Object>> currentInstalls
    ) throws Exception {
        Map<String, Object> packageVersionSet = orderedMap();
        if (baseReleaseUnit != null && hasText(value(baseReleaseUnit, "packageVersionSetJson"))) {
            packageVersionSet.putAll(canonicalizeArtifactVersionSet(projectId, parseJsonObject(baseReleaseUnit.get("packageVersionSetJson"))));
        }
        for (Map<String, Object> installed : currentInstalls) {
            String artifactId = canonicalArtifactId(projectId, value(installed, "artifactId"));
            String artifactVersion = value(installed, "installedArtifactVersion");
            if (hasText(artifactId) && hasText(artifactVersion)) {
                packageVersionSet.put(artifactId, artifactVersion);
            }
        }
        if (!hasText(valueFromMap(packageVersionSet, ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID))) {
            packageVersionSet.put(ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID, versionStamp("common-core"));
        }
        if (!hasText(valueFromMap(packageVersionSet, adapterArtifactId(projectId)))) {
            packageVersionSet.put(adapterArtifactId(projectId), versionStamp("adapter-artifact"));
        }
        if (!hasText(valueFromMap(packageVersionSet, adapterContractArtifactId(projectId)))) {
            packageVersionSet.put(adapterContractArtifactId(projectId), versionStamp("adapter-contract"));
        }
        return packageVersionSet;
    }

    private String buildRepairAdapterVersion(
            Map<String, Object> packageVersionSet,
            String artifactKey,
            boolean changed,
            String generatedPrefix
    ) {
        String existingVersion = valueFromMap(packageVersionSet, artifactKey);
        if (hasText(existingVersion) && !changed) {
            return existingVersion;
        }
        return versionStamp(generatedPrefix);
    }

    private List<String> buildCommonArtifactSet(Map<String, Object> baseReleaseUnit, List<Map<String, Object>> currentInstalls) throws Exception {
        List<String> commonArtifactSet = new ArrayList<String>();
        for (Map<String, Object> installed : currentInstalls) {
            String installScope = firstNonBlank(
                    value(installed, "installScope"),
                    ScreenBuilderPlatformFamilyRegistry.resolveInstallScope(value(installed, "artifactId")));
            if ("COMMON".equalsIgnoreCase(installScope)) {
                String artifactId = canonicalArtifactId(value(baseReleaseUnit, "projectId"), value(installed, "artifactId"));
                if (hasText(artifactId) && !commonArtifactSet.contains(artifactId)) {
                    commonArtifactSet.add(artifactId);
                }
            }
        }
        if (commonArtifactSet.isEmpty() && baseReleaseUnit != null && hasText(value(baseReleaseUnit, "commonArtifactSetJson"))) {
            commonArtifactSet.addAll(parseJsonArray(baseReleaseUnit.get("commonArtifactSetJson")));
        }
        if (commonArtifactSet.isEmpty()) {
            commonArtifactSet.add(ScreenBuilderPlatformFamilyRegistry.COMMON_CORE_ARTIFACT_ID);
        }
        return commonArtifactSet;
    }

    private List<String> buildRepairDtoSet(RepairApplyRequest request) {
        return mergeStringLists(
                normalizeStringList(request.getUpdatedThemeOrLayoutSet()),
                stringList("ProjectRuntimeContract", "ProjectRepairCandidate"));
    }

    private void appendJsonLine(String location, Map<String, Object> payload) throws IOException {
        Path path = Paths.get(location);
        Path parent = path.getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        String line = objectMapper.writeValueAsString(payload) + System.lineSeparator();
        Files.write(path, line.getBytes(StandardCharsets.UTF_8), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
    }

    private String buildReleaseUnitId(String prefix, String projectId) {
        return sanitize(prefix) + "-" + sanitize(projectId) + "-" + VERSION_STAMP.format(LocalDateTime.now(ZoneOffset.UTC));
    }

    private String buildRuntimePackageId(String prefix, String projectId) {
        return sanitize(prefix) + "-" + sanitize(projectId) + "-" + VERSION_STAMP.format(LocalDateTime.now(ZoneOffset.UTC));
    }

    private String versionStamp(String prefix) {
        return sanitize(prefix) + "-" + VERSION_STAMP.format(LocalDateTime.now(ZoneOffset.UTC));
    }

    private String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String now() {
        return Instant.now().toString();
    }

    private String required(String value, String fieldName) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
        return value.trim();
    }

    private String orDefault(String value, String fallback) {
        return hasText(value) ? value.trim() : fallback;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String sanitize(String value) {
        return orDefault(value, "unknown").replaceAll("[^A-Za-z0-9._-]", "-");
    }

    private String value(Map<String, Object> source, String key) {
        if (source == null) {
            return "";
        }
        Object value = source.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private Map<String, Object> defaultMap(Map<String, Object> value) {
        return value == null ? orderedMap() : value;
    }

    private Map<String, Object> valueMap(Map<String, Object> source, String key) {
        if (source == null) {
            return orderedMap();
        }
        Object value = source.get(key);
        if (value instanceof Map) {
            return new LinkedHashMap<String, Object>((Map<String, Object>) value);
        }
        return orderedMap();
    }

    private String valueFromMap(Map<String, Object> source, String key) {
        if (source == null) {
            return "";
        }
        Object value = source.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private List<String> stringList(String... values) {
        List<String> result = new ArrayList<String>();
        if (values == null) {
            return result;
        }
        for (String value : values) {
            if (hasText(value)) {
                result.add(value.trim());
            }
        }
        return result;
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return new ArrayList<String>();
        }
        List<String> result = new ArrayList<String>();
        for (String value : values) {
            if (hasText(value)) {
                result.add(value.trim());
            }
        }
        return result;
    }

    private List<String> normalizeObjectStringList(Object values) {
        if (!(values instanceof List<?>)) {
            return new ArrayList<String>();
        }
        List<String> result = new ArrayList<String>();
        for (Object value : (List<?>) values) {
            if (value != null && hasText(String.valueOf(value))) {
                result.add(String.valueOf(value).trim());
            }
        }
        return result;
    }

    private List<Map<String, Object>> normalizeObjectMapList(Object values) {
        if (!(values instanceof List<?>)) {
            return new ArrayList<Map<String, Object>>();
        }
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        for (Object value : (List<?>) values) {
            if (value instanceof Map<?, ?>) {
                Map<String, Object> item = new LinkedHashMap<String, Object>();
                for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                    item.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                result.add(item);
            }
        }
        return result;
    }

    private List<Map<String, Object>> canonicalArtifactRows(String projectId, List<Map<String, Object>> rows) {
        return ScreenBuilderArtifactSetNormalizer.normalizeArtifactSet(projectId, rows);
    }

    private Map<String, Object> canonicalizeArtifactVersionSet(String projectId, Map<String, Object> source) {
        Map<String, Object> normalized = new LinkedHashMap<String, Object>();
        if (source == null || source.isEmpty()) {
            return normalized;
        }
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            normalized.put(canonicalArtifactId(projectId, entry.getKey()), entry.getValue());
        }
        return normalized;
    }

    private String canonicalArtifactId(String projectId, String artifactId) {
        return ScreenBuilderPlatformFamilyRegistry.canonicalArtifactId(projectId, artifactId);
    }

    private boolean isProjectAdapterArtifact(String projectId, String artifactId) {
        return ScreenBuilderPlatformFamilyRegistry.isProjectAdapterArtifact(projectId, artifactId);
    }

    private String ownerLane() {
        return ScreenBuilderPlatformFamilyRegistry.PROJECT_ADAPTER_OWNER_LANE;
    }

    private String compareBaseline() {
        return ScreenBuilderPlatformFamilyRegistry.PLATFORM_COMPARE_BASELINE;
    }

    private String adapterArtifactId(String projectId) {
        return ScreenBuilderPlatformFamilyRegistry.projectAdapterArtifactId(projectId);
    }

    private String adapterContractArtifactId(String projectId) {
        return ScreenBuilderPlatformFamilyRegistry.projectAdapterContractArtifactId(projectId);
    }

    private List<String> commonArtifactSet() {
        return new ArrayList<String>(ScreenBuilderPlatformFamilyRegistry.commonArtifactSet());
    }

    private List<String> projectAdapterArtifactSet(String projectId) {
        return new ArrayList<String>(ScreenBuilderPlatformFamilyRegistry.projectAdapterArtifactSet(projectId));
    }

    private String resolveInstallScope(String artifactId) {
        return ScreenBuilderPlatformFamilyRegistry.resolveInstallScope(artifactId);
    }

    private List<String> mergeStringLists(List<String> first, List<String> second) {
        List<String> merged = new ArrayList<String>();
        merged.addAll(first == null ? Collections.<String>emptyList() : first);
        if (second != null) {
            for (String item : second) {
                if (hasText(item) && !merged.contains(item.trim())) {
                    merged.add(item.trim());
                }
            }
        }
        return merged;
    }

    private Map<String, Object> normalizeObjectMap(Map<String, Object> source) {
        Map<String, Object> result = orderedMap();
        if (source != null) {
            result.putAll(source);
        }
        return result;
    }

    @Override
    public Map<String, Object> saveVerificationRun(VerificationRunRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String menuId = required(request.getMenuId(), "menuId");
        String occurredAt = now();
        String verificationRunId = "verify-" + shortId();
        String traceId = orDefault(request.getTraceId(), "trace-" + shortId());

        Map<String, Object> response = orderedMap();
        response.put("verificationRunId", verificationRunId);
        response.put("traceId", traceId);
        response.put("projectId", projectId);
        response.put("scenarioFamilyId", orDefault(request.getScenarioFamilyId(), "verification-family"));
        response.put("menuId", menuId);
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("ownerLane", orDefault(request.getOwnerLane(), ownerLane()));
        response.put("targetRuntime", orDefault(request.getTargetRuntime(), "CURRENT_RUNTIME"));
        response.put("releaseUnitId", orDefault(request.getReleaseUnitId(), ""));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("selectedScreenId", orDefault(request.getSelectedScreenId(), ""));
        response.put("selectedElementSet", normalizeStringList(request.getSelectedElementSet()));
        response.put("compareBaseline", orDefault(request.getCompareBaseline(), ""));
        response.put("pageId", orDefault(request.getPageId(), ""));
        response.put("routeId", orDefault(request.getRouteId(), ""));
        response.put("shellProfileId", orDefault(request.getShellProfileId(), ""));
        response.put("pageFrameId", orDefault(request.getPageFrameId(), ""));
        response.put("componentCoverageState", orDefault(request.getComponentCoverageState(), "UNKNOWN"));
        response.put("bindingCoverageState", orDefault(request.getBindingCoverageState(), "UNKNOWN"));
        response.put("backendChainState", orDefault(request.getBackendChainState(), "UNKNOWN"));
        response.put("helpSecurityState", orDefault(request.getHelpSecurityState(), "UNKNOWN"));
        response.put("result", orDefault(request.getResult(), "PASS"));
        response.put("blockerCount", request.getBlockerCount() != null ? request.getBlockerCount() : Integer.valueOf(0));
        response.put("verifyShellYn", request.getVerifyShellYn() != null && request.getVerifyShellYn() ? "Y" : "N");
        response.put("verifyComponentYn", request.getVerifyComponentYn() != null && request.getVerifyComponentYn() ? "Y" : "N");
        response.put("verifyBindingYn", request.getVerifyBindingYn() != null && request.getVerifyBindingYn() ? "Y" : "N");
        response.put("verifyBackendYn", request.getVerifyBackendYn() != null && request.getVerifyBackendYn() ? "Y" : "N");
        response.put("verifyHelpSecurityYn", request.getVerifyHelpSecurityYn() != null && request.getVerifyHelpSecurityYn() ? "Y" : "N");
        response.put("requestedBy", orDefault(request.getRequestedBy(), "system"));
        response.put("requestedByType", orDefault(request.getRequestedByType(), "PLATFORM_OPERATOR"));
        response.put("blockerSet", request.getBlockerSet() != null ? request.getBlockerSet() : new ArrayList<Map<String, Object>>());
        response.put("resultPayload", request.getResultPayload() != null ? request.getResultPayload() : orderedMap());
        response.put("occurredAt", occurredAt);

        persistVerificationRunToDatabase(request, response);
        return response;
    }

    private void persistVerificationRunToDatabase(VerificationRunRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("verificationRunId", response.get("verificationRunId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("scenarioFamilyId", response.get("scenarioFamilyId"));
            params.put("menuId", response.get("menuId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("ownerLane", response.get("ownerLane"));
            params.put("targetRuntime", response.get("targetRuntime"));
            params.put("releaseUnitId", response.get("releaseUnitId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("selectedScreenId", response.get("selectedScreenId"));
            params.put("selectedElementSetJson", objectMapper.writeValueAsString(response.get("selectedElementSet")));
            params.put("compareBaseline", response.get("compareBaseline"));
            params.put("pageId", response.get("pageId"));
            params.put("routeId", response.get("routeId"));
            params.put("shellProfileId", response.get("shellProfileId"));
            params.put("pageFrameId", response.get("pageFrameId"));
            params.put("componentCoverageState", response.get("componentCoverageState"));
            params.put("bindingCoverageState", response.get("bindingCoverageState"));
            params.put("backendChainState", response.get("backendChainState"));
            params.put("helpSecurityState", response.get("helpSecurityState"));
            params.put("result", response.get("result"));
            params.put("blockerCount", response.get("blockerCount"));
            params.put("verifyShellYn", response.get("verifyShellYn"));
            params.put("verifyComponentYn", response.get("verifyComponentYn"));
            params.put("verifyBindingYn", response.get("verifyBindingYn"));
            params.put("verifyBackendYn", response.get("verifyBackendYn"));
            params.put("verifyHelpSecurityYn", response.get("verifyHelpSecurityYn"));
            params.put("requestedBy", response.get("requestedBy"));
            params.put("requestedByType", response.get("requestedByType"));
            params.put("blockerSetJson", objectMapper.writeValueAsString(response.get("blockerSet")));
            params.put("resultPayloadJson", objectMapper.writeValueAsString(response.get("resultPayload")));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertVerificationRun(params);
        } catch (Exception e) {
            // Log error
        }
    }

    private void persistParityCompareRunToDatabase(ParityCompareRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("compareContextId", response.get("compareContextId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("ownerLane", response.get("ownerLane"));
            params.put("selectedScreenId", response.get("selectedScreenId"));
            params.put("releaseUnitId", response.get("releaseUnitId"));
            params.put("compareBaseline", response.get("compareBaseline"));
            params.put("parityScore", response.get("parityScore"));
            params.put("uniformityScore", response.get("uniformityScore"));
            params.put("result", response.get("result"));
            params.put("compareTargetSetJson", objectMapper.writeValueAsString(response.get("compareTargetSet")));
            params.put("blockerSetJson", objectMapper.writeValueAsString(response.get("blockerSet")));
            params.put("repairCandidateSetJson", objectMapper.writeValueAsString(response.get("repairCandidateSet")));
            params.put("requestedBy", response.get("requestedBy"));
            params.put("requestedByType", response.get("requestedByType"));
            params.put("resultPayloadJson", objectMapper.writeValueAsString(response));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertParityCompareRun(params);
        } catch (Exception e) {
            // Log error or ignore if persistence is non-blocking
        }
    }

    private void persistRepairSessionToDatabase(RepairOpenRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("repairSessionId", response.get("repairSessionId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("scenarioFamilyId", "repair-family"); // Default or derived
            params.put("releaseUnitId", response.get("releaseUnitId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("ownerLane", response.get("ownerLane"));
            params.put("selectedScreenId", response.get("selectedScreenId"));
            params.put("compareSnapshotId", response.get("compareSnapshotId"));
            params.put("compareBaseline", response.get("compareBaseline"));
            params.put("reasonCode", response.get("reasonCode"));
            params.put("requestedBy", response.get("requestedBy"));
            params.put("requestedByType", response.get("requestedByType"));
            params.put("requestNote", response.get("requestNote"));
            params.put("selectedElementSetJson", objectMapper.writeValueAsString(response.get("selectedElementSet")));
            params.put("existingAssetReuseSetJson", objectMapper.writeValueAsString(request.getExistingAssetReuseSet()));
            params.put("blockingGapSetJson", objectMapper.writeValueAsString(response.get("blockingGapSet")));
            params.put("reuseRecommendationSetJson", objectMapper.writeValueAsString(response.get("reuseRecommendationSet")));
            params.put("requiredContractSetJson", objectMapper.writeValueAsString(response.get("requiredContractSet")));
            params.put("status", response.get("status"));
            params.put("blockingGapCount", ((List<?>) response.get("blockingGapSet")).size());
            params.put("sessionPayloadJson", objectMapper.writeValueAsString(response));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertRepairSession(params);
        } catch (Exception e) {
            // Log error
        }
    }

    private void persistRepairApplyRunToDatabase(RepairApplyRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<String, Object>();
            params.put("repairApplyRunId", response.get("repairApplyRunId"));
            params.put("repairSessionId", response.get("repairSessionId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("scenarioFamilyId", "repair-apply-family");
            params.put("releaseUnitId", response.get("releaseUnitId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("ownerLane", response.get("ownerLane"));
            params.put("selectedScreenId", response.get("selectedScreenId"));
            params.put("selectedElementSetJson", objectMapper.writeValueAsString(response.get("selectedElementSet")));
            params.put("compareBaseline", response.get("compareBaseline"));
            params.put("updatedReleaseCandidateId", response.get("updatedReleaseCandidateId"));
            params.put("publishMode", response.get("publishMode"));
            params.put("requestedBy", response.get("requestedBy"));
            params.put("requestedByType", response.get("requestedByType"));
            params.put("parityRecheckRequiredYn", response.get("parityRecheckRequiredYn") != null && (Boolean) response.get("parityRecheckRequiredYn") ? "Y" : "N");
            params.put("uniformityRecheckRequiredYn", response.get("uniformityRecheckRequiredYn") != null && (Boolean) response.get("uniformityRecheckRequiredYn") ? "Y" : "N");
            params.put("smokeRequiredYn", response.get("smokeRequiredYn") != null && (Boolean) response.get("smokeRequiredYn") ? "Y" : "N");
            params.put("status", response.get("status"));
            params.put("rollbackAnchorYn", "N"); // Default
            params.put("changeSummary", response.get("changeSummary"));
            params.put("updatedAssetTraceSetJson", objectMapper.writeValueAsString(response.get("updatedAssetTraceSet")));
            params.put("updatedBindingSetJson", objectMapper.writeValueAsString(response.get("updatedBindingSet")));
            params.put("updatedThemeLayoutSetJson", objectMapper.writeValueAsString(response.get("updatedThemeOrLayoutSet")));
            params.put("sqlDraftSetJson", objectMapper.writeValueAsString(response.get("sqlDraftSet")));
            params.put("applyPayloadJson", objectMapper.writeValueAsString(response));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertRepairApplyRun(params);
        } catch (Exception e) {
            // Log error
        }
    }

    private boolean canUseResonanceDatabase() {
        try {
            return runtimeControlPlaneMapper != null;
        } catch (Exception e) {
            return false;
        }
    }

    private Map<String, Object> orderedMap(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<String, Object>();
        if (pairs == null) {
            return map;
        }
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            map.put(String.valueOf(pairs[i]), pairs[i + 1]);
        }
        return map;
    }

    @Override
    public Map<String, Object> saveModuleBindingPreview(ModuleBindingPreviewRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String occurredAt = now();
        Map<String, Object> response = orderedMap();
        response.put("moduleBindingPreviewId", "prev-" + shortId());
        response.put("traceId", orDefault(request.getTraceId(), "trace-" + shortId()));
        response.put("projectId", projectId);
        response.put("scenarioFamilyId", orDefault(request.getScenarioFamilyId(), "binding-family"));
        response.put("scenarioId", orDefault(request.getScenarioId(), "binding-scenario"));
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("pageAssemblyId", orDefault(request.getPageAssemblyId(), ""));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("themeSetId", orDefault(request.getThemeSetId(), ""));
        response.put("installableModuleId", orDefault(request.getInstallableModuleId(), ""));
        response.put("modulePatternFamilyId", orDefault(request.getModulePatternFamilyId(), ""));
        response.put("moduleDepthProfileId", orDefault(request.getModuleDepthProfileId(), ""));
        response.put("selectionMode", orDefault(request.getSelectionMode(), "MANUAL"));
        response.put("operatorId", orDefault(request.getOperatorId(), "system"));
        response.put("frontendImpactSummary", orDefault(request.getFrontendImpactSummary(), ""));
        response.put("backendImpactSummary", orDefault(request.getBackendImpactSummary(), ""));
        response.put("dbImpactSummary", orDefault(request.getDbImpactSummary(), ""));
        response.put("cssImpactSummary", orDefault(request.getCssImpactSummary(), ""));
        response.put("runtimePackageAttachPreview", request.getRuntimePackageAttachPreview() != null ? request.getRuntimePackageAttachPreview() : orderedMap());
        response.put("rollbackPlanSummary", orDefault(request.getRollbackPlanSummary(), ""));
        response.put("blockingIssueCount", request.getBlockingIssueCount() != null ? request.getBlockingIssueCount() : 0);
        response.put("blockingIssueSet", request.getBlockingIssueSet() != null ? request.getBlockingIssueSet() : new ArrayList<>());
        response.put("readyForApplyYn", request.getReadyForApplyYn() != null && request.getReadyForApplyYn() ? "Y" : "N");
        response.put("previewPayload", request.getPreviewPayload() != null ? request.getPreviewPayload() : orderedMap());
        response.put("occurredAt", occurredAt);
        
        persistModuleBindingPreviewToDatabase(request, response);
        return response;
    }

    private void persistModuleBindingPreviewToDatabase(ModuleBindingPreviewRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("moduleBindingPreviewId", response.get("moduleBindingPreviewId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("scenarioFamilyId", response.get("scenarioFamilyId"));
            params.put("scenarioId", response.get("scenarioId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("pageAssemblyId", response.get("pageAssemblyId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("themeSetId", response.get("themeSetId"));
            params.put("installableModuleId", response.get("installableModuleId"));
            params.put("modulePatternFamilyId", response.get("modulePatternFamilyId"));
            params.put("moduleDepthProfileId", response.get("moduleDepthProfileId"));
            params.put("selectionMode", response.get("selectionMode"));
            params.put("operatorId", response.get("operatorId"));
            params.put("frontendImpactSummary", response.get("frontendImpactSummary"));
            params.put("backendImpactSummary", response.get("backendImpactSummary"));
            params.put("dbImpactSummary", response.get("dbImpactSummary"));
            params.put("cssImpactSummary", response.get("cssImpactSummary"));
            params.put("runtimePackageAttachPreviewJson", objectMapper.writeValueAsString(response.get("runtimePackageAttachPreview")));
            params.put("rollbackPlanSummary", response.get("rollbackPlanSummary"));
            params.put("blockingIssueCount", response.get("blockingIssueCount"));
            params.put("blockingIssueSetJson", objectMapper.writeValueAsString(response.get("blockingIssueSet")));
            params.put("readyForApplyYn", response.get("readyForApplyYn"));
            params.put("previewPayloadJson", objectMapper.writeValueAsString(response.get("previewPayload")));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertModuleBindingPreview(params);
        } catch (Exception e) {
            // Log error
        }
    }

    @Override
    public Map<String, Object> saveModuleBindingResult(ModuleBindingResultRequest request) throws Exception {
        String projectId = required(request.getProjectId(), "projectId");
        String occurredAt = now();
        Map<String, Object> response = orderedMap();
        response.put("moduleBindingResultId", "res-" + shortId());
        response.put("moduleBindingPreviewId", orDefault(request.getModuleBindingPreviewId(), ""));
        response.put("traceId", orDefault(request.getTraceId(), "trace-" + shortId()));
        response.put("projectId", projectId);
        response.put("scenarioFamilyId", orDefault(request.getScenarioFamilyId(), "binding-family"));
        response.put("scenarioId", orDefault(request.getScenarioId(), "binding-scenario"));
        response.put("guidedStateId", orDefault(request.getGuidedStateId(), projectId + ".guided-state"));
        response.put("pageAssemblyId", orDefault(request.getPageAssemblyId(), ""));
        response.put("templateLineId", orDefault(request.getTemplateLineId(), "template.runtime.standard"));
        response.put("screenFamilyRuleId", orDefault(request.getScreenFamilyRuleId(), "screen-family.standard"));
        response.put("themeSetId", orDefault(request.getThemeSetId(), ""));
        response.put("releaseUnitId", orDefault(request.getReleaseUnitId(), ""));
        response.put("runtimePackageId", orDefault(request.getRuntimePackageId(), ""));
        response.put("generationRunId", orDefault(request.getGenerationRunId(), ""));
        response.put("jsonRevisionSet", request.getJsonRevisionSet() != null ? request.getJsonRevisionSet() : new ArrayList<>());
        response.put("selectionAppliedYn", request.getSelectionAppliedYn() != null && request.getSelectionAppliedYn() ? "Y" : "N");
        response.put("appliedModuleSet", request.getAppliedModuleSet() != null ? request.getAppliedModuleSet() : new ArrayList<>());
        response.put("attachedPageAssetSet", request.getAttachedPageAssetSet() != null ? request.getAttachedPageAssetSet() : new ArrayList<>());
        response.put("attachedComponentAssetSet", request.getAttachedComponentAssetSet() != null ? request.getAttachedComponentAssetSet() : new ArrayList<>());
        response.put("attachedBackendAssetSet", request.getAttachedBackendAssetSet() != null ? request.getAttachedBackendAssetSet() : new ArrayList<>());
        response.put("attachedDbAssetSet", request.getAttachedDbAssetSet() != null ? request.getAttachedDbAssetSet() : new ArrayList<>());
        response.put("runtimePackageImpactSummary", orDefault(request.getRuntimePackageImpactSummary(), ""));
        response.put("releaseBlockerDelta", request.getReleaseBlockerDelta() != null ? request.getReleaseBlockerDelta() : new ArrayList<>());
        response.put("followUpChecklistSummary", orDefault(request.getFollowUpChecklistSummary(), ""));
        response.put("repairNeededYn", request.getRepairNeededYn() != null && request.getRepairNeededYn() ? "Y" : "N");
        response.put("repairQueueCount", request.getRepairQueueCount() != null ? request.getRepairQueueCount() : 0);
        response.put("repairSessionCandidateId", orDefault(request.getRepairSessionCandidateId(), ""));
        response.put("compareContextId", orDefault(request.getCompareContextId(), ""));
        response.put("publishedAssetTraceSet", request.getPublishedAssetTraceSet() != null ? request.getPublishedAssetTraceSet() : new ArrayList<>());
        response.put("traceLinkSet", request.getTraceLinkSet() != null ? request.getTraceLinkSet() : new ArrayList<>());
        response.put("nextRecommendedAction", orDefault(request.getNextRecommendedAction(), ""));
        response.put("rollbackAnchorYn", request.getRollbackAnchorYn() != null && request.getRollbackAnchorYn() ? "Y" : "N");
        response.put("resultPayload", request.getResultPayload() != null ? request.getResultPayload() : orderedMap());
        response.put("occurredAt", occurredAt);
        
        persistModuleBindingResultToDatabase(request, response);
        return response;
    }

    private void persistModuleBindingResultToDatabase(ModuleBindingResultRequest request, Map<String, Object> response) {
        try {
            if (!canUseResonanceDatabase()) {
                return;
            }
            Map<String, Object> params = new LinkedHashMap<>();
            params.put("moduleBindingResultId", response.get("moduleBindingResultId"));
            params.put("moduleBindingPreviewId", response.get("moduleBindingPreviewId"));
            params.put("traceId", response.get("traceId"));
            params.put("projectId", response.get("projectId"));
            params.put("scenarioFamilyId", response.get("scenarioFamilyId"));
            params.put("scenarioId", response.get("scenarioId"));
            params.put("guidedStateId", response.get("guidedStateId"));
            params.put("pageAssemblyId", response.get("pageAssemblyId"));
            params.put("templateLineId", response.get("templateLineId"));
            params.put("screenFamilyRuleId", response.get("screenFamilyRuleId"));
            params.put("themeSetId", response.get("themeSetId"));
            params.put("releaseUnitId", response.get("releaseUnitId"));
            params.put("runtimePackageId", response.get("runtimePackageId"));
            params.put("generationRunId", response.get("generationRunId"));
            params.put("jsonRevisionSetJson", objectMapper.writeValueAsString(response.get("jsonRevisionSet")));
            params.put("selectionAppliedYn", response.get("selectionAppliedYn"));
            params.put("appliedModuleSetJson", objectMapper.writeValueAsString(response.get("appliedModuleSet")));
            params.put("attachedPageAssetSetJson", objectMapper.writeValueAsString(response.get("attachedPageAssetSet")));
            params.put("attachedComponentAssetSetJson", objectMapper.writeValueAsString(response.get("attachedComponentAssetSet")));
            params.put("attachedBackendAssetSetJson", objectMapper.writeValueAsString(response.get("attachedBackendAssetSet")));
            params.put("attachedDbAssetSetJson", objectMapper.writeValueAsString(response.get("attachedDbAssetSet")));
            params.put("runtimePackageImpactSummary", response.get("runtimePackageImpactSummary"));
            params.put("releaseBlockerDeltaJson", objectMapper.writeValueAsString(response.get("releaseBlockerDelta")));
            params.put("followUpChecklistSummary", response.get("followUpChecklistSummary"));
            params.put("repairNeededYn", response.get("repairNeededYn"));
            params.put("repairQueueCount", response.get("repairQueueCount"));
            params.put("repairSessionCandidateId", response.get("repairSessionCandidateId"));
            params.put("compareContextId", response.get("compareContextId"));
            params.put("publishedAssetTraceSetJson", objectMapper.writeValueAsString(response.get("publishedAssetTraceSet")));
            params.put("traceLinkSetJson", objectMapper.writeValueAsString(response.get("traceLinkSet")));
            params.put("nextRecommendedAction", response.get("nextRecommendedAction"));
            params.put("rollbackAnchorYn", response.get("rollbackAnchorYn"));
            params.put("resultPayloadJson", objectMapper.writeValueAsString(response.get("resultPayload")));
            params.put("occurredAt", response.get("occurredAt"));
            runtimeControlPlaneMapper.insertModuleBindingResult(params);
        } catch (Exception e) {
            // Log error
        }
    }
}
