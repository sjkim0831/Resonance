package egovframework.com.platform.dbchange.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.dbchange.mapper.DbChangeCaptureMapper;
import egovframework.com.platform.dbchange.service.DbChangeQueueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DbChangeQueueServiceImpl implements DbChangeQueueService {

    private static final DateTimeFormatter PATCH_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<Map<String, Object>>() {};
    private static final TypeReference<List<Object>> LIST_TYPE = new TypeReference<List<Object>>() {};
    private static final Set<String> CONTROLLED_REFERENCE_TABLES = Set.of(
            "COMTCCMMNCLCODE",
            "COMTCCMMNCODE",
            "COMTCCMMNDETAILCODE",
            "COMTNMENUINFO",
            "COMTNMENUFUNCTIONINFO",
            "COMTNAUTHORINFO",
            "COMTNAUTHORFUNCTIONRELATE",
            "COMTNDEPTAUTHORRELATE"
    );

    private final DbChangeCaptureMapper dbChangeCaptureMapper;
    private final ObjectMapper objectMapper;

    @Override
    public List<Map<String, Object>> getRecentBusinessChangeLogs(String projectId, int limit) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("projectId", defaultProjectId(projectId));
        params.put("limit", normalizeLimit(limit, 20));
        return dbChangeCaptureMapper.selectRecentBusinessChangeLogs(params);
    }

    @Override
    public List<Map<String, Object>> getDeployableQueueList(String projectId, int limit) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("projectId", defaultProjectId(projectId));
        params.put("limit", normalizeLimit(limit, 20));
        return dbChangeCaptureMapper.selectDeployableDbPatchQueueList(params);
    }

    @Override
    public List<Map<String, Object>> getDeployableResultList(String projectId, int limit) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("projectId", defaultProjectId(projectId));
        params.put("limit", normalizeLimit(limit, 20));
        return dbChangeCaptureMapper.selectDeployableDbPatchResultList(params);
    }

    @Override
    @Transactional
    public Map<String, Object> queueChangeLog(String changeLogId, String actorId, Map<String, Object> options) {
        Map<String, Object> changeLog = requiredChangeLog(changeLogId);
        String policyCode = safe(changeLog.get("promotionPolicyCode")).toUpperCase(Locale.ROOT);
        boolean forceQueue = truthy(value(options, "forceQueue"));
        String overrideReason = safe(value(options, "policyOverrideReason"));
        if ("BLOCKED".equals(policyCode) && !forceQueue) {
            throw new IllegalArgumentException("Blocked changes require forceQueue=true and a policy override reason.");
        }
        if ("BLOCKED".equals(policyCode) && overrideReason.isEmpty()) {
            throw new IllegalArgumentException("Policy override reason is required for blocked changes.");
        }

        String existingQueueId = safe(changeLog.get("queueId"));
        if (!existingQueueId.isEmpty()) {
            Map<String, Object> existingQueue = dbChangeCaptureMapper.selectDeployableDbPatchQueueById(existingQueueId);
            if (existingQueue != null) {
                return success("Already linked to an existing queue.", existingQueueId, safe(existingQueue.get("approvalStatus")), safe(existingQueue.get("applyStatus")));
            }
        }

        String queueId = "dbq-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String renderedSql = renderSqlForChange(changeLog, actorId);
        Map<String, Object> queueParams = new LinkedHashMap<String, Object>();
        queueParams.put("queueId", queueId);
        queueParams.put("projectId", defaultProjectId(changeLog.get("projectId")));
        queueParams.put("sourceChangeIdsJson", jsonOf(Collections.singletonList(safe(changeLog.get("changeLogId")))));
        queueParams.put("targetEnv", defaultIfBlank(value(options, "targetEnv"), "REMOTE_MAIN"));
        queueParams.put("patchFormatCode", "SQL_FILE");
        queueParams.put("patchKindCode", normalizePatchKind(changeLog.get("changeType")));
        queueParams.put("targetTableName", safe(changeLog.get("targetTableName")).toUpperCase(Locale.ROOT));
        queueParams.put("targetKeysJson", safe(changeLog.get("targetPkJson")));
        queueParams.put("patchPayloadJson", resolveQueuePayload(changeLog));
        queueParams.put("renderedSqlPreview", renderedSql);
        queueParams.put("checksumSha256", sha256(renderedSql));
        queueParams.put("riskLevel", inferRiskLevel(changeLog, options));
        queueParams.put("approvalStatus", "BLOCKED".equals(policyCode) ? "OVERRIDE_PENDING" : "PENDING");
        queueParams.put("applyStatus", "PENDING");
        queueParams.put("blockReason", buildQueueNote(policyCode, overrideReason, options));
        queueParams.put("approvedBy", "");
        queueParams.put("rejectedBy", "");
        queueParams.put("createdBy", defaultActor(actorId));
        queueParams.put("updatedBy", defaultActor(actorId));
        dbChangeCaptureMapper.insertDeployableDbPatchQueue(queueParams);

        Map<String, Object> changeLogParams = new LinkedHashMap<String, Object>();
        changeLogParams.put("changeLogId", safe(changeLog.get("changeLogId")));
        changeLogParams.put("queueRequestedYn", "Y");
        changeLogParams.put("queueId", queueId);
        changeLogParams.put("queueDecisionCode", "BLOCKED".equals(policyCode) ? "POLICY_OVERRIDE_REQUIRED" : "APPROVAL_REQUIRED");
        changeLogParams.put("approvalRequiredYn", "Y");
        changeLogParams.put("approvalStatus", "BLOCKED".equals(policyCode) ? "OVERRIDE_PENDING" : "PENDING");
        dbChangeCaptureMapper.updateBusinessChangeLogQueueLink(changeLogParams);
        return success("Queued change for approval.", queueId, safe(queueParams.get("approvalStatus")), "PENDING");
    }

    @Override
    @Transactional
    public Map<String, Object> approveQueue(String queueId, String actorId) {
        Map<String, Object> queue = requiredQueue(queueId);
        if ("EXECUTED".equalsIgnoreCase(safe(queue.get("applyStatus")))) {
            throw new IllegalArgumentException("Executed queue items cannot be approved again.");
        }
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("queueId", safe(queue.get("queueId")));
        params.put("approvalStatus", "APPROVED");
        params.put("blockReason", safe(queue.get("blockReason")));
        params.put("approvedBy", defaultActor(actorId));
        params.put("rejectedBy", "");
        params.put("updatedBy", defaultActor(actorId));
        dbChangeCaptureMapper.updateDeployableDbPatchQueueApproval(params);
        dbChangeCaptureMapper.updateBusinessChangeLogApprovalByQueueId(statusLinkParams(safe(queue.get("queueId")), "APPROVED", "APPROVAL_GRANTED"));
        return success("Queue approved.", safe(queue.get("queueId")), "APPROVED", defaultIfBlank(queue.get("applyStatus"), "PENDING"));
    }

    @Override
    @Transactional
    public Map<String, Object> rejectQueue(String queueId, String actorId, String reason) {
        Map<String, Object> queue = requiredQueue(queueId);
        if ("EXECUTED".equalsIgnoreCase(safe(queue.get("applyStatus")))) {
            throw new IllegalArgumentException("Executed queue items cannot be rejected.");
        }
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("queueId", safe(queue.get("queueId")));
        params.put("approvalStatus", "REJECTED");
        params.put("blockReason", defaultIfBlank(reason, "Rejected by operator."));
        params.put("approvedBy", "");
        params.put("rejectedBy", defaultActor(actorId));
        params.put("updatedBy", defaultActor(actorId));
        dbChangeCaptureMapper.updateDeployableDbPatchQueueApproval(params);
        dbChangeCaptureMapper.updateBusinessChangeLogApprovalByQueueId(statusLinkParams(safe(queue.get("queueId")), "REJECTED", "APPROVAL_REJECTED"));
        return success("Queue rejected.", safe(queue.get("queueId")), "REJECTED", defaultIfBlank(queue.get("applyStatus"), "PENDING"));
    }

    @Override
    @Transactional
    public Map<String, Object> executeQueue(String queueId, String actorId, Map<String, Object> options) {
        Map<String, Object> queue = requiredQueue(queueId);
        String approvalStatus = safe(queue.get("approvalStatus")).toUpperCase(Locale.ROOT);
        boolean allowOverride = truthy(value(options, "allowPolicyOverrideYn"));
        String overrideReason = safe(value(options, "policyOverrideReason"));
        if (!"APPROVED".equals(approvalStatus)) {
            if (!allowOverride) {
                throw new IllegalArgumentException("Only approved queue items can be executed.");
            }
            if (overrideReason.isEmpty()) {
                throw new IllegalArgumentException("Policy override reason is required when executing without approval.");
            }
        }
        String applyStatus = safe(queue.get("applyStatus")).toUpperCase(Locale.ROOT);
        if ("EXECUTED".equals(applyStatus)) {
            return success("Queue already executed.", safe(queue.get("queueId")), approvalStatus, applyStatus);
        }

        String executionBatchId = "dbx-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String resultId = "dbr-" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        Map<String, Object> executionPlan = resolveExecutionPlan(queue, actorId);
        String renderedSql = safe(executionPlan.get("renderedSql"));
        if (renderedSql.isEmpty()) {
            throw new IllegalArgumentException("Executable SQL could not be resolved for this queue item.");
        }
        String patchScope = safe(executionPlan.get("patchScope"));
        if ("BUSINESS_DATA".equals(patchScope) && !truthy(value(options, "allowBusinessDataPatchYn"))) {
            throw new IllegalArgumentException("Business-data patches are blocked by default. Only schema/controlled metadata patches can be promoted without allowBusinessDataPatchYn=true and an override reason.");
        }
        if ("BUSINESS_DATA".equals(patchScope) && overrideReason.isEmpty()) {
            throw new IllegalArgumentException("Business-data patch execution requires a policy override reason.");
        }
        if (truthy(executionPlan.get("conflictDetected")) && !allowOverride) {
            throw new IllegalArgumentException("Conflicting LOCAL/REMOTE change chain detected. Review execution plan and execute again with a policy override reason if this is intentional.");
        }
        if (truthy(executionPlan.get("conflictDetected")) && overrideReason.isEmpty()) {
            throw new IllegalArgumentException("Conflict override reason is required when executing a mixed-environment patch chain.");
        }

        Path patchFile;
        try {
            patchFile = writeBatchPatchFile(executionBatchId, queue, renderedSql, actorId, options, executionPlan);
        } catch (Exception e) {
            throw new IllegalArgumentException(safe(e.getMessage()).isEmpty() ? "Failed to prepare DB patch file." : safe(e.getMessage()), e);
        }
        String executionMode = normalizeExecutionMode(value(options, "executionMode"));
        Map<String, Object> effectiveOptions = new LinkedHashMap<String, Object>();
        if (options != null) {
            effectiveOptions.putAll(options);
        }
        effectiveOptions.put("patchScope", patchScope);
        String executionStatus = "SUCCESS";
        String executionMessage;
        try {
            executionMessage = runExecution(executionMode, patchFile, actorId, effectiveOptions);
        } catch (Exception e) {
            executionStatus = "FAILED";
            executionMessage = safe(e.getMessage());
            if (executionMessage.isEmpty()) {
                executionMessage = "Remote execution failed.";
            }
        }

        Map<String, Object> queueParams = new LinkedHashMap<String, Object>();
        queueParams.put("queueId", safe(queue.get("queueId")));
        queueParams.put("applyStatus", "SUCCESS".equals(executionStatus) ? "EXECUTED" : "FAILED");
        queueParams.put("blockReason", mergeExecutionNote(queue, effectiveOptions, executionMessage, executionPlan));
        queueParams.put("updatedBy", defaultActor(actorId));
        dbChangeCaptureMapper.updateDeployableDbPatchQueueApply(queueParams);

        if ("SUCCESS".equals(executionStatus)) {
            dbChangeCaptureMapper.updateBusinessChangeLogApprovalByQueueId(statusLinkParams(safe(queue.get("queueId")), "APPROVED", "EXECUTED"));
        }

        Map<String, Object> resultParams = new LinkedHashMap<String, Object>();
        resultParams.put("resultId", resultId);
        resultParams.put("queueId", safe(queue.get("queueId")));
        resultParams.put("executionBatchId", executionBatchId);
        resultParams.put("projectId", defaultProjectId(queue.get("projectId")));
        resultParams.put("targetEnv", defaultIfBlank(queue.get("targetEnv"), "REMOTE_MAIN"));
        resultParams.put("executionStatus", executionStatus);
        resultParams.put("executionMessage", buildExecutionMessage(executionMode, executionMessage, effectiveOptions, executionPlan));
        resultParams.put("resultSqlPreview", renderedSql);
        resultParams.put("checksumSha256", sha256(renderedSql));
        resultParams.put("dbPatchHistoryId", "");
        resultParams.put("executedBy", defaultActor(actorId));
        dbChangeCaptureMapper.insertDeployableDbPatchResult(resultParams);

        if (!"SUCCESS".equals(executionStatus)) {
            throw new IllegalArgumentException(executionMessage);
        }
        return success("Queue executed.", safe(queue.get("queueId")), allowOverride ? "OVERRIDE_EXECUTED" : "APPROVED", "EXECUTED");
    }

    private String runExecution(String executionMode, Path patchFile, String actorId, Map<String, Object> options) throws Exception {
        if ("DB_ONLY_PREDEPLOY".equals(executionMode) || "FULL_REMOTE_DEPLOY".equals(executionMode)) {
            return runDeployScript(patchFile, actorId, options, "FULL_REMOTE_DEPLOY".equals(executionMode));
        }
        throw new IllegalArgumentException("Unsupported execution mode: " + executionMode);
    }

    private String runDeployScript(Path patchFile, String actorId, Map<String, Object> options, boolean fullRemoteDeploy) throws Exception {
        List<String> command = new ArrayList<String>();
        command.add("bash");
        command.add("ops/scripts/windows-db-sync-push-and-fresh-deploy-221.sh");

        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);

        Map<String, String> env = builder.environment();
        env.put("SQL_FILE_LIST", patchFile.toAbsolutePath().normalize().toString());
        env.put("SKIP_LOCAL_BUILD_PACKAGE", fullRemoteDeploy ? "false" : "true");
        env.put("SKIP_GIT_PUSH", fullRemoteDeploy ? "false" : "true");
        env.put("SKIP_REMOTE_DEPLOY", fullRemoteDeploy ? "false" : "true");
        env.put("APPLY_MODE", "sql-files");
        env.put("APPLY_DB_DIFF_TO_REMOTE", truthy(value(options, "applyDbDiffToRemoteYn")) ? "true" : "false");
        env.put("APPLY_DB_DIFF_TO_LOCAL", truthy(value(options, "applyDbDiffToLocalYn")) ? "true" : "false");
        env.put("SKIP_DB_SCHEMA_DIFF", truthy(value(options, "skipDbSchemaDiffYn")) ? "true" : "false");
        env.put("FORCE_DESTRUCTIVE_DB_DIFF", truthy(value(options, "forceDestructiveDiffYn")) ? "true" : "false");
        env.put("FAIL_ON_DB_DIFF_REMAINS", truthyOrDefault(value(options, "failOnDbDiffRemainsYn"), true) ? "true" : "false");
        env.put("FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF", truthy(value(options, "failOnUntrackedDestructiveDiffYn")) ? "true" : "false");
        env.put("REMOTE_DEPLOY_MODE", defaultIfBlank(value(options, "remoteDeployMode"), "pull"));
        env.put("COMMIT_MESSAGE", "dbchange queue " + patchFile.getFileName() + " by " + defaultActor(actorId));
        env.put("DB_PATCH_APPLIED_BY", defaultActor(actorId));
        env.put("DB_PATCH_ID", defaultIfBlank(value(options, "dbPatchId"), "queue-" + patchFile.getFileName().toString().replace(".sql", "")));
        env.put("DB_PATCH_NAME", defaultIfBlank(value(options, "dbPatchName"), "dbchange queue " + safe(patchFile.getFileName())));
        env.put("DB_PATCH_SOURCE_ENV", defaultIfBlank(value(options, "sourceEnv"), "local"));
        env.put("DB_PATCH_TARGET_ENV", defaultIfBlank(value(options, "targetEnv"), defaultIfBlank(value(options, "executionTargetEnv"), "remote")));
        env.put("DB_PATCH_DIRECTION", defaultIfBlank(value(options, "dbPatchDirection"), "LOCAL_TO_REMOTE"));
        env.put("DB_PATCH_RISK_LEVEL", defaultIfBlank(value(options, "riskLevel"), "HIGH"));
        env.put("DB_PATCH_SCOPE", defaultIfBlank(value(options, "patchScope"), "CONTROLLED_REFERENCE_DATA"));
        env.put("REQUIRE_DB_PATCH_HISTORY", truthyOrDefault(value(options, "requireDbPatchHistoryYn"), true) ? "true" : "false");

        Process process = builder.start();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (InputStream input = process.getInputStream()) {
            input.transferTo(output);
        }
        int exitCode = process.waitFor();
        String result = output.toString(StandardCharsets.UTF_8);
        if (exitCode != 0) {
            throw new IllegalStateException(result.isEmpty() ? "Deploy script failed." : result);
        }
        return result;
    }

    private Path writeBatchPatchFile(String executionBatchId,
                                     Map<String, Object> queue,
                                     String renderedSql,
                                     String actorId,
                                     Map<String, Object> options,
                                     Map<String, Object> executionPlan) throws Exception {
        Path directory = Paths.get("var", "dbchange-patches");
        Files.createDirectories(directory);
        Path patchFile = directory.resolve(executionBatchId + "-" + PATCH_STAMP.format(LocalDateTime.now()) + ".sql");
        StringBuilder builder = new StringBuilder();
        builder.append("-- Carbonet DB change queue patch").append(System.lineSeparator());
        builder.append("-- queueId=").append(safe(queue.get("queueId"))).append(System.lineSeparator());
        builder.append("-- projectId=").append(defaultProjectId(queue.get("projectId"))).append(System.lineSeparator());
        builder.append("-- targetTable=").append(safe(queue.get("targetTableName"))).append(System.lineSeparator());
        builder.append("-- sourceChangeIds=").append(safe(queue.get("sourceChangeIdsJson"))).append(System.lineSeparator());
        builder.append("-- executionPlan=").append(jsonOf(executionPlan == null ? Collections.emptyMap() : executionPlan)).append(System.lineSeparator());
        builder.append("-- backup=").append("script-managed remote/local backup before apply").append(System.lineSeparator());
        builder.append("-- executedBy=").append(defaultActor(actorId)).append(System.lineSeparator());
        builder.append("-- options=").append(jsonOf(options == null ? Collections.emptyMap() : options)).append(System.lineSeparator());
        builder.append(System.lineSeparator());
        builder.append(renderedSql);
        if (!renderedSql.endsWith(System.lineSeparator())) {
            builder.append(System.lineSeparator());
        }
        Files.writeString(patchFile, builder.toString(), StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        return patchFile;
    }

    private String renderSqlForChange(Map<String, Object> changeLog, String actorId) {
        String tableName = safe(changeLog.get("targetTableName")).toUpperCase(Locale.ROOT);
        String changeType = safe(changeLog.get("changeType")).toUpperCase(Locale.ROOT);
        String targetPkJson = safe(changeLog.get("targetPkJson"));
        Map<String, Object> targetKeys = parseMap(targetPkJson);
        Map<String, Object> after = parseMap(safe(changeLog.get("afterSummaryJson")));
        Map<String, Object> before = parseMap(safe(changeLog.get("beforeSummaryJson")));
        if ("COMTCCMMNCLCODE".equals(tableName)) {
            return renderCommonClassCodeSql(changeType, targetKeys, after, before);
        }
        if ("COMTCCMMNCODE".equals(tableName)) {
            return renderCommonCodeSql(changeType, targetKeys, after, before);
        }
        if ("COMTNMENUINFO".equals(tableName)) {
            return renderMenuInfoSql(changeType, targetKeys, after, before);
        }
        if ("COMTNMENUFUNCTIONINFO".equals(tableName)) {
            return renderMenuFeatureSql(changeType, targetKeys, after, before);
        }
        if ("COMTNAUTHORINFO".equals(tableName)) {
            return renderAuthorInfoSql(changeType, targetKeys, after, before);
        }
        if ("COMTNAUTHORFUNCTIONRELATE".equals(tableName)) {
            return renderAuthorFeatureRelationSql(targetKeys, safe(changeLog.get("afterSummaryJson")));
        }
        if ("COMTNDEPTAUTHORRELATE".equals(tableName)) {
            return renderDepartmentRoleMappingSql(changeType, targetKeys, after, before, actorId);
        }
        throw new IllegalArgumentException("SQL rendering is not supported yet for table: " + tableName);
    }

    private Map<String, Object> resolveExecutionPlan(Map<String, Object> queue, String actorId) {
        List<Map<String, Object>> seedChangeLogs = loadSourceChangeLogs(queue);
        if (seedChangeLogs.isEmpty()) {
            Map<String, Object> fallback = new LinkedHashMap<String, Object>();
            fallback.put("renderedSql", safe(queue.get("renderedSqlPreview")));
            fallback.put("orderedChangeIds", parseList(safe(queue.get("sourceChangeIdsJson"))));
            fallback.put("supersededByLatest", false);
            fallback.put("backupMode", "SCRIPT_MANAGED");
            return fallback;
        }
        List<Map<String, Object>> orderedChangeLogs = resolveOrderedChangeChain(queue, seedChangeLogs);
        StringBuilder renderedSql = new StringBuilder();
        List<String> orderedChangeIds = new ArrayList<String>();
        for (Map<String, Object> changeLog : orderedChangeLogs) {
            String chunk = renderSqlForChange(changeLog, actorId);
            if (chunk.isEmpty()) {
                continue;
            }
            if (renderedSql.length() > 0) {
                renderedSql.append(System.lineSeparator()).append(System.lineSeparator());
            }
            renderedSql.append(chunk);
            orderedChangeIds.add(safe(changeLog.get("changeLogId")));
        }
        Map<String, Object> plan = new LinkedHashMap<String, Object>();
        plan.put("renderedSql", renderedSql.toString());
        plan.put("orderedChangeIds", orderedChangeIds);
        plan.put("orderedChangeCount", orderedChangeIds.size());
        plan.put("logicalAliases", collectLogicalAliases(orderedChangeLogs));
        plan.put("logicalObjectIds", collectLogicalObjectIds(orderedChangeLogs));
        plan.put("sourceEnvironments", collectSourceEnvironments(orderedChangeLogs));
        plan.put("baseRevisions", collectBaseRevisions(orderedChangeLogs));
        plan.put("seedChangeIds", extractChangeLogIds(seedChangeLogs));
        plan.put("supersededByLatest", orderedChangeLogs.size() > seedChangeLogs.size());
        plan.put("conflictDetected", detectMixedEnvironmentConflict(orderedChangeLogs));
        plan.put("patchScope", resolvePatchScope(seedChangeLogs.get(seedChangeLogs.size() - 1)));
        plan.put("backupMode", "SCRIPT_MANAGED");
        return plan;
    }

    private String renderCommonClassCodeSql(String changeType, Map<String, Object> targetKeys, Map<String, Object> after, Map<String, Object> before) {
        String clCode = firstNonBlank(value(after, "clCode"), value(before, "clCode"), value(targetKeys, "CL_CODE"), value(targetKeys, "clCode"));
        String beforeCode = firstNonBlank(value(before, "clCode"), value(targetKeys, "CL_CODE"), value(targetKeys, "clCode"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTCCMMNCLCODE WHERE CL_CODE = '" + escapeSql(firstNonBlank(beforeCode, clCode)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        String deleteKey = firstNonBlank(beforeCode, clCode);
        return ""
                + "DELETE FROM COMTCCMMNCLCODE WHERE CL_CODE = '" + escapeSql(deleteKey) + "';\n"
                + "INSERT INTO COMTCCMMNCLCODE (CL_CODE, CL_CODE_NM, CL_CODE_DC, USE_AT, FRST_REGIST_PNTTM, FRST_REGISTER_ID)\n"
                + "VALUES ('" + escapeSql(clCode) + "', '" + escapeSql(value(row, "clCodeNm")) + "', "
                + nullableSqlLiteral(value(row, "clCodeDc")) + ", '" + yesNo(value(row, "useAt")) + "', CURRENT_DATETIME, '"
                + escapeSql(defaultActor(value(row, "lastUpdusrId"))) + "');";
    }

    private String renderCommonCodeSql(String changeType, Map<String, Object> targetKeys, Map<String, Object> after, Map<String, Object> before) {
        String codeId = firstNonBlank(value(after, "codeId"), value(before, "codeId"), value(targetKeys, "CODE_ID"), value(targetKeys, "codeId"));
        String beforeCodeId = firstNonBlank(value(before, "codeId"), value(targetKeys, "CODE_ID"), value(targetKeys, "codeId"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTCCMMNCODE WHERE CODE_ID = '" + escapeSql(firstNonBlank(beforeCodeId, codeId)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        return ""
                + "DELETE FROM COMTCCMMNCODE WHERE CODE_ID = '" + escapeSql(firstNonBlank(beforeCodeId, codeId)) + "';\n"
                + "INSERT INTO COMTCCMMNCODE (CODE_ID, CODE_ID_NM, CODE_ID_DC, CL_CODE, USE_AT, FRST_REGIST_PNTTM, FRST_REGISTER_ID)\n"
                + "VALUES ('" + escapeSql(codeId) + "', '" + escapeSql(value(row, "codeIdNm")) + "', "
                + nullableSqlLiteral(value(row, "codeIdDc")) + ", '" + escapeSql(value(row, "clCode")) + "', '" + yesNo(value(row, "useAt")) + "', CURRENT_DATETIME, '"
                + escapeSql(defaultActor(value(row, "lastUpdusrId"))) + "');";
    }

    private String renderMenuInfoSql(String changeType, Map<String, Object> targetKeys, Map<String, Object> after, Map<String, Object> before) {
        String menuCode = firstNonBlank(value(after, "code"), value(before, "code"), value(targetKeys, "menuCode"), value(targetKeys, "MENU_CODE"));
        String beforeMenuCode = firstNonBlank(value(before, "code"), value(targetKeys, "menuCode"), value(targetKeys, "MENU_CODE"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTNMENUINFO WHERE MENU_CODE = '" + escapeSql(firstNonBlank(beforeMenuCode, menuCode)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        return ""
                + "DELETE FROM COMTNMENUINFO WHERE MENU_CODE = '" + escapeSql(firstNonBlank(beforeMenuCode, menuCode)) + "';\n"
                + "INSERT INTO COMTNMENUINFO (MENU_CODE, MENU_NM, MENU_NM_EN, MENU_URL, MENU_ICON, USE_AT, FRST_REGIST_PNTTM, LAST_UPDT_PNTTM)\n"
                + "VALUES ('" + escapeSql(menuCode) + "', '" + escapeSql(value(row, "codeNm")) + "', "
                + nullableSqlLiteral(value(row, "codeDc")) + ", " + nullableSqlLiteral(value(row, "menuUrl")) + ", "
                + nullableSqlLiteral(value(row, "menuIcon")) + ", '" + yesNo(value(row, "useAt")) + "', CURRENT_DATETIME, CURRENT_DATETIME);";
    }

    private String renderMenuFeatureSql(String changeType, Map<String, Object> targetKeys, Map<String, Object> after, Map<String, Object> before) {
        String featureCode = firstNonBlank(value(after, "featureCode"), value(before, "featureCode"), value(targetKeys, "featureCode"), value(targetKeys, "FEATURE_CODE"));
        String beforeFeatureCode = firstNonBlank(value(before, "featureCode"), value(targetKeys, "featureCode"), value(targetKeys, "FEATURE_CODE"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTNMENUFUNCTIONINFO WHERE FEATURE_CODE = '" + escapeSql(firstNonBlank(beforeFeatureCode, featureCode)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        return ""
                + "DELETE FROM COMTNMENUFUNCTIONINFO WHERE FEATURE_CODE = '" + escapeSql(firstNonBlank(beforeFeatureCode, featureCode)) + "';\n"
                + "INSERT INTO COMTNMENUFUNCTIONINFO (MENU_CODE, FEATURE_CODE, FEATURE_NM, FEATURE_NM_EN, FEATURE_DC, USE_AT, FRST_REGIST_PNTTM, LAST_UPDT_PNTTM)\n"
                + "VALUES ('" + escapeSql(value(row, "menuCode")) + "', '" + escapeSql(featureCode) + "', "
                + "'" + escapeSql(value(row, "featureNm")) + "', " + nullableSqlLiteral(value(row, "featureNmEn")) + ", "
                + nullableSqlLiteral(value(row, "featureDc")) + ", '" + yesNo(value(row, "useAt")) + "', CURRENT_DATETIME, CURRENT_DATETIME);";
    }

    private String renderAuthorInfoSql(String changeType, Map<String, Object> targetKeys, Map<String, Object> after, Map<String, Object> before) {
        String authorCode = firstNonBlank(value(after, "authorCode"), value(before, "authorCode"), value(targetKeys, "authorCode"), value(targetKeys, "AUTHOR_CODE"));
        String beforeAuthorCode = firstNonBlank(value(before, "authorCode"), value(targetKeys, "authorCode"), value(targetKeys, "AUTHOR_CODE"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTNAUTHORINFO WHERE AUTHOR_CODE = '" + escapeSql(firstNonBlank(beforeAuthorCode, authorCode)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        return ""
                + "DELETE FROM COMTNAUTHORINFO WHERE AUTHOR_CODE = '" + escapeSql(firstNonBlank(beforeAuthorCode, authorCode)) + "';\n"
                + "INSERT INTO COMTNAUTHORINFO (AUTHOR_CODE, AUTHOR_NM, AUTHOR_DC, AUTHOR_CREAT_DE)\n"
                + "VALUES ('" + escapeSql(authorCode) + "', '" + escapeSql(value(row, "authorNm")) + "', "
                + nullableSqlLiteral(value(row, "authorDc")) + ", " + nullableSqlLiteral(value(row, "authorCreatDe")) + ");";
    }

    private String renderAuthorFeatureRelationSql(Map<String, Object> targetKeys, String afterSummaryJson) {
        String authorCode = firstNonBlank(value(targetKeys, "authorCode"), value(targetKeys, "AUTHOR_CODE"));
        List<Object> featureCodes = parseList(afterSummaryJson);
        StringBuilder builder = new StringBuilder();
        builder.append("DELETE FROM COMTNAUTHORFUNCTIONRELATE WHERE AUTHOR_CODE = '").append(escapeSql(authorCode)).append("';");
        for (Object featureCode : featureCodes) {
            String feature = safe(featureCode);
            if (feature.isEmpty()) {
                continue;
            }
            builder.append(System.lineSeparator())
                    .append("INSERT INTO COMTNAUTHORFUNCTIONRELATE (AUTHOR_CODE, FEATURE_CODE, GRANT_AUTHORITY_YN, CREAT_DT)\n")
                    .append("VALUES ('").append(escapeSql(authorCode)).append("', '").append(escapeSql(feature))
                    .append("', 'N', CURRENT_DATETIME);");
        }
        return builder.toString();
    }

    private String renderDepartmentRoleMappingSql(String changeType,
                                                  Map<String, Object> targetKeys,
                                                  Map<String, Object> after,
                                                  Map<String, Object> before,
                                                  String actorId) {
        String insttId = firstNonBlank(value(after, "insttId"), value(before, "insttId"), value(targetKeys, "insttId"), value(targetKeys, "INSTT_ID"));
        String deptNm = firstNonBlank(value(after, "deptNm"), value(before, "deptNm"), value(targetKeys, "deptNm"), value(targetKeys, "DEPT_NM"));
        String beforeInsttId = firstNonBlank(value(before, "insttId"), value(targetKeys, "insttId"), value(targetKeys, "INSTT_ID"));
        String beforeDeptNm = firstNonBlank(value(before, "deptNm"), value(targetKeys, "deptNm"), value(targetKeys, "DEPT_NM"));
        if ("DELETE".equals(changeType)) {
            return "DELETE FROM COMTNDEPTAUTHORRELATE WHERE INSTT_ID = '" + escapeSql(firstNonBlank(beforeInsttId, insttId)) + "' AND DEPT_NM = '" + escapeSql(firstNonBlank(beforeDeptNm, deptNm)) + "';";
        }
        Map<String, Object> row = after.isEmpty() ? before : after;
        return ""
                + "DELETE FROM COMTNDEPTAUTHORRELATE WHERE INSTT_ID = '" + escapeSql(firstNonBlank(beforeInsttId, insttId)) + "' AND DEPT_NM = '" + escapeSql(firstNonBlank(beforeDeptNm, deptNm)) + "';\n"
                + "INSERT INTO COMTNDEPTAUTHORRELATE (INSTT_ID, CMPNY_NM, DEPT_NM, AUTHOR_CODE, USE_AT, FRST_REGISTER_ID, FRST_REGIST_DT, LAST_UPDUSR_ID, LAST_UPDT_DT)\n"
                + "VALUES ('" + escapeSql(insttId) + "', " + nullableSqlLiteral(value(row, "cmpnyNm")) + ", '"
                + escapeSql(deptNm) + "', '" + escapeSql(value(row, "authorCode")) + "', '" + yesNo(value(row, "useAt"))
                + "', '" + escapeSql(defaultActor(actorId)) + "', CURRENT_DATETIME, '" + escapeSql(defaultActor(actorId)) + "', CURRENT_DATETIME);";
    }

    private List<Map<String, Object>> loadSourceChangeLogs(Map<String, Object> queue) {
        List<Map<String, Object>> changeLogs = new ArrayList<Map<String, Object>>();
        for (Object sourceChangeId : parseList(safe(queue.get("sourceChangeIdsJson")))) {
            String changeLogId = safe(sourceChangeId);
            if (changeLogId.isEmpty()) {
                continue;
            }
            Map<String, Object> changeLog = dbChangeCaptureMapper.selectBusinessChangeLogById(changeLogId);
            if (changeLog != null && !changeLog.isEmpty()) {
                changeLogs.add(changeLog);
            }
        }
        return changeLogs;
    }

    private List<Map<String, Object>> resolveOrderedChangeChain(Map<String, Object> queue, List<Map<String, Object>> seedChangeLogs) {
        Map<String, Object> seed = seedChangeLogs.get(seedChangeLogs.size() - 1);
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("projectId", defaultProjectId(queue.get("projectId")));
        params.put("targetTableName", safe(seed.get("targetTableName")).toUpperCase(Locale.ROOT));
        params.put("limit", 500);
        List<Map<String, Object>> candidates = dbChangeCaptureMapper.selectBusinessChangeLogsForProjectTable(params);
        if (candidates == null || candidates.isEmpty()) {
            return seedChangeLogs;
        }

        Set<String> relatedAliases = new LinkedHashSet<String>(collectLogicalAliases(seedChangeLogs));
        String latestSeedId = safe(seed.get("changeLogId"));
        List<Map<String, Object>> ordered = new ArrayList<Map<String, Object>>();
        for (Map<String, Object> candidate : candidates) {
            if (!isEligibleForReplay(candidate, latestSeedId)) {
                continue;
            }
            Set<String> candidateAliases = extractLogicalAliases(candidate);
            if (candidateAliases.isEmpty()) {
                continue;
            }
            if (!intersects(relatedAliases, candidateAliases)) {
                continue;
            }
            ordered.add(candidate);
            relatedAliases.addAll(candidateAliases);
        }
        if (ordered.isEmpty()) {
            return seedChangeLogs;
        }
        return ordered;
    }

    private boolean isEligibleForReplay(Map<String, Object> changeLog, String latestSeedId) {
        String approvalStatus = safe(changeLog.get("approvalStatus")).toUpperCase(Locale.ROOT);
        String queueDecision = safe(changeLog.get("queueDecisionCode")).toUpperCase(Locale.ROOT);
        String changeLogId = safe(changeLog.get("changeLogId"));
        if ("REJECTED".equals(approvalStatus) || "APPROVAL_REJECTED".equals(queueDecision)) {
            return false;
        }
        if ("EXECUTED".equals(approvalStatus) || "EXECUTED".equals(queueDecision)) {
            return latestSeedId.equals(changeLogId);
        }
        return true;
    }

    private Set<String> collectLogicalAliases(List<Map<String, Object>> changeLogs) {
        Set<String> aliases = new LinkedHashSet<String>();
        for (Map<String, Object> changeLog : changeLogs) {
            aliases.addAll(extractLogicalAliases(changeLog));
        }
        return aliases;
    }

    private Set<String> extractLogicalAliases(Map<String, Object> changeLog) {
        Set<String> aliases = new LinkedHashSet<String>();
        String tableName = safe(changeLog.get("targetTableName")).toUpperCase(Locale.ROOT);
        Map<String, Object> targetKeys = parseMap(safe(changeLog.get("targetPkJson")));
        Map<String, Object> before = parseMap(safe(changeLog.get("beforeSummaryJson")));
        Map<String, Object> after = parseMap(safe(changeLog.get("afterSummaryJson")));
        addAlias(aliases, tableName, value(targetKeys, "__logicalObjectId"));
        addAlias(aliases, tableName, safe(changeLog.get("entityId")));
        for (Object aliasValue : nestedMap(targetKeys, "__renameFrom").values()) {
            addAlias(aliases, tableName, safe(aliasValue));
        }
        for (Object aliasValue : nestedMap(targetKeys, "__renameTo").values()) {
            addAlias(aliases, tableName, safe(aliasValue));
        }

        if ("COMTCCMMNCLCODE".equals(tableName)) {
            addAlias(aliases, tableName, firstNonBlank(value(after, "clCode"), value(before, "clCode"), value(targetKeys, "CL_CODE"), value(targetKeys, "clCode")));
            addAlias(aliases, tableName, firstNonBlank(value(before, "clCode"), value(targetKeys, "CL_CODE"), value(targetKeys, "clCode")));
            return aliases;
        }
        if ("COMTCCMMNCODE".equals(tableName)) {
            addAlias(aliases, tableName, firstNonBlank(value(after, "codeId"), value(before, "codeId"), value(targetKeys, "CODE_ID"), value(targetKeys, "codeId")));
            addAlias(aliases, tableName, firstNonBlank(value(before, "codeId"), value(targetKeys, "CODE_ID"), value(targetKeys, "codeId")));
            return aliases;
        }
        if ("COMTNMENUINFO".equals(tableName)) {
            addAlias(aliases, tableName, firstNonBlank(value(after, "code"), value(before, "code"), value(targetKeys, "menuCode"), value(targetKeys, "MENU_CODE")));
            addAlias(aliases, tableName, firstNonBlank(value(before, "code"), value(targetKeys, "menuCode"), value(targetKeys, "MENU_CODE")));
            return aliases;
        }
        if ("COMTNMENUFUNCTIONINFO".equals(tableName)) {
            addAlias(aliases, tableName, firstNonBlank(value(after, "featureCode"), value(before, "featureCode"), value(targetKeys, "featureCode"), value(targetKeys, "FEATURE_CODE")));
            addAlias(aliases, tableName, firstNonBlank(value(before, "featureCode"), value(targetKeys, "featureCode"), value(targetKeys, "FEATURE_CODE")));
            return aliases;
        }
        if ("COMTNAUTHORINFO".equals(tableName) || "COMTNAUTHORFUNCTIONRELATE".equals(tableName)) {
            addAlias(aliases, tableName, firstNonBlank(value(after, "authorCode"), value(before, "authorCode"), value(targetKeys, "authorCode"), value(targetKeys, "AUTHOR_CODE"), safe(changeLog.get("entityId"))));
            addAlias(aliases, tableName, firstNonBlank(value(before, "authorCode"), value(targetKeys, "authorCode"), value(targetKeys, "AUTHOR_CODE")));
            return aliases;
        }
        if ("COMTNDEPTAUTHORRELATE".equals(tableName)) {
            addCompositeAlias(aliases, tableName,
                    firstNonBlank(value(after, "insttId"), value(before, "insttId"), value(targetKeys, "insttId"), value(targetKeys, "INSTT_ID")),
                    firstNonBlank(value(after, "deptNm"), value(before, "deptNm"), value(targetKeys, "deptNm"), value(targetKeys, "DEPT_NM")));
            addCompositeAlias(aliases, tableName,
                    firstNonBlank(value(before, "insttId"), value(targetKeys, "insttId"), value(targetKeys, "INSTT_ID")),
                    firstNonBlank(value(before, "deptNm"), value(targetKeys, "deptNm"), value(targetKeys, "DEPT_NM")));
            return aliases;
        }
        addAlias(aliases, tableName, safe(changeLog.get("entityId")));
        return aliases;
    }

    private List<String> extractChangeLogIds(List<Map<String, Object>> changeLogs) {
        List<String> ids = new ArrayList<String>();
        for (Map<String, Object> changeLog : changeLogs) {
            String changeLogId = safe(changeLog.get("changeLogId"));
            if (!changeLogId.isEmpty()) {
                ids.add(changeLogId);
            }
        }
        return ids;
    }

    private Set<String> collectLogicalObjectIds(List<Map<String, Object>> changeLogs) {
        Set<String> logicalObjectIds = new LinkedHashSet<String>();
        for (Map<String, Object> changeLog : changeLogs) {
            String logicalObjectId = resolveLogicalObjectId(changeLog);
            if (!logicalObjectId.isEmpty()) {
                logicalObjectIds.add(logicalObjectId);
            }
        }
        return logicalObjectIds;
    }

    private Set<String> collectSourceEnvironments(List<Map<String, Object>> changeLogs) {
        Set<String> sourceEnvironments = new LinkedHashSet<String>();
        for (Map<String, Object> changeLog : changeLogs) {
            String sourceEnvironment = resolveSourceEnvironment(changeLog);
            if (!sourceEnvironment.isEmpty()) {
                sourceEnvironments.add(sourceEnvironment);
            }
        }
        return sourceEnvironments;
    }

    private List<String> collectBaseRevisions(List<Map<String, Object>> changeLogs) {
        List<String> baseRevisions = new ArrayList<String>();
        for (Map<String, Object> changeLog : changeLogs) {
            String baseRevision = resolveBaseRevision(changeLog);
            if (!baseRevision.isEmpty()) {
                baseRevisions.add(baseRevision);
            }
        }
        return baseRevisions;
    }

    private boolean detectMixedEnvironmentConflict(List<Map<String, Object>> changeLogs) {
        return collectLogicalObjectIds(changeLogs).size() == 1 && collectSourceEnvironments(changeLogs).size() > 1;
    }

    private String resolveLogicalObjectId(Map<String, Object> changeLog) {
        Map<String, Object> targetKeys = parseMap(safe(changeLog.get("targetPkJson")));
        return firstNonBlank(value(targetKeys, "__logicalObjectId"), safe(changeLog.get("entityId")));
    }

    private String resolveSourceEnvironment(Map<String, Object> changeLog) {
        Map<String, Object> targetKeys = parseMap(safe(changeLog.get("targetPkJson")));
        return value(targetKeys, "__sourceEnv");
    }

    private String resolveBaseRevision(Map<String, Object> changeLog) {
        Map<String, Object> targetKeys = parseMap(safe(changeLog.get("targetPkJson")));
        return value(targetKeys, "__baseRevision");
    }

    private boolean intersects(Set<String> left, Set<String> right) {
        if (left.isEmpty() || right.isEmpty()) {
            return false;
        }
        for (String value : right) {
            if (left.contains(value)) {
                return true;
            }
        }
        return false;
    }

    private void addAlias(Set<String> aliases, String tableName, String key) {
        String normalized = safe(key);
        if (normalized.isEmpty()) {
            return;
        }
        aliases.add(tableName + "|" + normalized);
    }

    private void addCompositeAlias(Set<String> aliases, String tableName, String first, String second) {
        String left = safe(first);
        String right = safe(second);
        if (left.isEmpty() || right.isEmpty()) {
            return;
        }
        aliases.add(tableName + "|" + left + "|" + right);
    }

    private Map<String, Object> nestedMap(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return new LinkedHashMap<String, Object>();
        }
        Object value = row.get(key);
        if (!(value instanceof Map<?, ?>)) {
            return new LinkedHashMap<String, Object>();
        }
        Map<String, Object> converted = new LinkedHashMap<String, Object>();
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
            converted.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return converted;
    }

    private String inferRiskLevel(Map<String, Object> row, Map<String, Object> options) {
        String explicit = safe(value(options, "riskLevel"));
        if (!explicit.isEmpty()) {
            return explicit.toUpperCase(Locale.ROOT);
        }
        if ("BUSINESS_DATA".equals(resolvePatchScope(row))) {
            return "CRITICAL";
        }
        String tableName = safe(row.get("targetTableName")).toUpperCase(Locale.ROOT);
        if ("COMTCCMMNCLCODE".equals(tableName) || "COMTCCMMNCODE".equals(tableName)) {
            return "LOW";
        }
        if ("COMTNEMPLYRSCRTYESTBS".equals(tableName)) {
            return "CRITICAL";
        }
        return "HIGH";
    }

    private String buildQueueNote(String policyCode, String overrideReason, Map<String, Object> options) {
        Map<String, Object> note = new LinkedHashMap<String, Object>();
        note.put("policyCode", policyCode);
        note.put("overrideReason", overrideReason);
        note.put("requestedPatchScope", defaultIfBlank(value(options, "patchScope"), ""));
        note.put("options", options == null ? Collections.emptyMap() : options);
        return jsonOf(note);
    }

    private String resolvePatchScope(Map<String, Object> row) {
        String tableName = safe(row.get("targetTableName")).toUpperCase(Locale.ROOT);
        if (CONTROLLED_REFERENCE_TABLES.contains(tableName)) {
            return "CONTROLLED_REFERENCE_DATA";
        }
        return "BUSINESS_DATA";
    }

    private String buildExecutionMessage(String executionMode, String executionMessage, Map<String, Object> options, Map<String, Object> executionPlan) {
        Map<String, Object> message = new LinkedHashMap<String, Object>();
        message.put("executionMode", executionMode);
        message.put("options", options == null ? Collections.emptyMap() : options);
        message.put("executionPlan", executionPlan == null ? Collections.emptyMap() : executionPlan);
        message.put("detail", executionMessage);
        return jsonOf(message);
    }

    private String mergeExecutionNote(Map<String, Object> queue, Map<String, Object> options, String executionMessage, Map<String, Object> executionPlan) {
        Map<String, Object> note = new LinkedHashMap<String, Object>();
        note.put("queueNote", safe(queue.get("blockReason")));
        note.put("executionOptions", options == null ? Collections.emptyMap() : options);
        note.put("executionPlan", executionPlan == null ? Collections.emptyMap() : executionPlan);
        note.put("executionMessage", executionMessage);
        return jsonOf(note);
    }

    private String normalizeExecutionMode(Object value) {
        String mode = safe(value).toUpperCase(Locale.ROOT);
        return mode.isEmpty() ? "DB_ONLY_PREDEPLOY" : mode;
    }

    private String normalizePatchKind(Object changeTypeValue) {
        String changeType = safe(changeTypeValue).toUpperCase(Locale.ROOT);
        if ("DELETE".equals(changeType)) {
            return "ROW_DELETE";
        }
        if ("INSERT".equals(changeType)) {
            return "ROW_INSERT";
        }
        return "ROW_UPSERT";
    }

    private Map<String, Object> requiredChangeLog(String changeLogId) {
        Map<String, Object> row = dbChangeCaptureMapper.selectBusinessChangeLogById(safe(changeLogId));
        if (row == null || row.isEmpty()) {
            throw new IllegalArgumentException("Business change log was not found.");
        }
        return row;
    }

    private Map<String, Object> requiredQueue(String queueId) {
        Map<String, Object> row = dbChangeCaptureMapper.selectDeployableDbPatchQueueById(safe(queueId));
        if (row == null || row.isEmpty()) {
            throw new IllegalArgumentException("Deployable DB patch queue item was not found.");
        }
        return row;
    }

    private Map<String, Object> success(String message, String queueId, String approvalStatus, String applyStatus) {
        Map<String, Object> response = new LinkedHashMap<String, Object>();
        response.put("success", true);
        response.put("message", message);
        response.put("queueId", queueId);
        response.put("approvalStatus", approvalStatus);
        response.put("applyStatus", applyStatus);
        return response;
    }

    private Map<String, Object> statusLinkParams(String queueId, String approvalStatus, String queueDecisionCode) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("queueId", queueId);
        params.put("approvalStatus", approvalStatus);
        params.put("queueDecisionCode", queueDecisionCode);
        return params;
    }

    private int normalizeLimit(int requested, int fallback) {
        if (requested <= 0) {
            return fallback;
        }
        return Math.min(requested, 100);
    }

    private String resolveQueuePayload(Map<String, Object> row) {
        String payload = safe(row.get("afterSummaryJson"));
        if (!payload.isEmpty() && !"{}".equals(payload)) {
            return payload;
        }
        return safe(row.get("beforeSummaryJson"));
    }

    private String yesNo(Object value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : "Y";
    }

    private String nullableSqlLiteral(Object value) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            return "NULL";
        }
        return "'" + escapeSql(normalized) + "'";
    }

    private String escapeSql(String value) {
        return safe(value).replace("'", "''");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private Map<String, Object> parseMap(String json) {
        if (json == null || json.trim().isEmpty() || "null".equalsIgnoreCase(json.trim())) {
            return new LinkedHashMap<String, Object>();
        }
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception ignored) {
            return new LinkedHashMap<String, Object>();
        }
    }

    private List<Object> parseList(String json) {
        if (json == null || json.trim().isEmpty() || "null".equalsIgnoreCase(json.trim())) {
            return new ArrayList<Object>();
        }
        try {
            return objectMapper.readValue(json, LIST_TYPE);
        } catch (Exception ignored) {
            return new ArrayList<Object>();
        }
    }

    private String value(Map<String, Object> row, String key) {
        if (row == null || row.isEmpty()) {
            return "";
        }
        Object value = row.get(key);
        return value == null ? "" : safe(value);
    }

    private String defaultProjectId(Object value) {
        return defaultIfBlank(value, "carbonet");
    }

    private String defaultActor(String actorId) {
        return defaultIfBlank(actorId, "system");
    }

    private boolean truthy(Object value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        return "Y".equals(normalized) || "TRUE".equals(normalized) || "1".equals(normalized);
    }

    private boolean truthyOrDefault(Object value, boolean fallback) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            return fallback;
        }
        return truthy(normalized);
    }

    private String defaultIfBlank(Object value, String fallback) {
        String normalized = safe(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String jsonOf(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize DB change queue payload.", e);
            return "";
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(defaultIfBlank(value, "").getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hashed) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
