package egovframework.com.platform.workbench.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.workbench.model.SrTicketRecordVO;
import egovframework.com.platform.codex.model.SrTicketRunnerExecutionVO;
import egovframework.com.platform.workbench.model.SrWorkbenchStackItemVO;
import egovframework.com.platform.codex.service.ScreenCommandCenterService;
import egovframework.com.platform.codex.service.SrTicketCodexRunnerService;
import egovframework.com.platform.request.workbench.SrTicketApprovalRequest;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.request.workbench.SrWorkbenchStackItemCreateRequest;
import egovframework.com.platform.workbench.service.SrTicketWorkbenchService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.LinkOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service("srTicketWorkbenchService")
public class SrTicketWorkbenchServiceImpl implements SrTicketWorkbenchService {

    private static final Logger log = LoggerFactory.getLogger(SrTicketWorkbenchServiceImpl.class);

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int ARTIFACT_PREVIEW_LIMIT = 12000;

    private final ObjectMapper objectMapper;
    private final ScreenCommandCenterService screenCommandCenterService;
    private final SrTicketCodexRunnerService srTicketCodexRunnerService;

    @Value("${security.codex.enabled:false}")
    private boolean codexEnabled;

    @Value("${security.codex.history-file:/tmp/carbonet-codex-history.jsonl}")
    private String codexHistoryFilePath;

    @Value("${security.codex.sr-ticket-file:/tmp/carbonet-sr-tickets.jsonl}")
    private String srTicketFilePath;

    @Value("${security.codex.sr-workbench-stack-file:/tmp/carbonet-sr-workbench-stack.jsonl}")
    private String srWorkbenchStackFilePath;

    @Value("${security.codex.runner.repo-root:/opt/Resonance}")
    private String codexRunnerRepoRoot;

    @Value("${security.codex.runner.rollback-command:}")
    private String rollbackCommand;

    @Value("${security.codex.runner.parallel-lanes:3}")
    private int parallelLaneCount;

    private final ReentrantLock fileLock = new ReentrantLock();
    private final Object laneMonitor = new Object();
    private final Map<String, String> activeLaneTickets = new LinkedHashMap<String, String>();
    private ExecutorService laneExecutor;

    public SrTicketWorkbenchServiceImpl(ObjectMapper objectMapper,
                                        ScreenCommandCenterService screenCommandCenterService,
                                        SrTicketCodexRunnerService srTicketCodexRunnerService) {
        this.objectMapper = objectMapper;
        this.screenCommandCenterService = screenCommandCenterService;
        this.srTicketCodexRunnerService = srTicketCodexRunnerService;
    }

    @PostConstruct
    public void initializeLaneExecutor() {
        int laneCount = Math.max(parallelLaneCount, 1);
        this.laneExecutor = Executors.newFixedThreadPool(laneCount);
        synchronized (laneMonitor) {
            activeLaneTickets.clear();
            for (int idx = 1; idx <= laneCount; idx++) {
                String laneId = formatLaneId(idx);
                activeLaneTickets.put(laneId, "");
                ensureTmuxLaneSession(laneId);
            }
        }
        try {
            dispatchQueuedTickets();
        } catch (Exception e) {
            log.warn("Failed to resume queued SR tickets on startup.", e);
        }
    }

    @PreDestroy
    public void shutdownLaneExecutor() {
        if (laneExecutor != null) {
            laneExecutor.shutdownNow();
        }
    }

    @Override
    public Map<String, Object> getPage(String selectedPageId) throws Exception {
        List<Map<String, Object>> stackRows = readStackRows();
        return orderedMap(
                "selectedPageId", safe(selectedPageId),
                "codexEnabled", codexEnabled,
                "codexHistoryFile", safe(codexHistoryFilePath),
                "ticketCount", readTickets().size(),
                "tickets", readTicketRows(),
                "executionLaneCount", Math.max(parallelLaneCount, 1),
                "executionLanes", buildExecutionLaneRows(),
                "stackCount", stackRows.size(),
                "stackItems", stackRows,
                "screenOptions", screenCommandCenterService.getScreenCommandPage(selectedPageId).get("pages"));
    }

    @Override
    public Map<String, Object> createTicket(SrTicketCreateRequest request, String actorId) throws Exception {
        SrTicketRecordVO ticket = new SrTicketRecordVO();
        String now = now();
        List<SrWorkbenchStackItemVO> stackItems = resolveRequestedStackItems(request);
        String requestedTicketId = request != null ? request.getTicketId() : null;
        ticket.setTicketId(safe(requestedTicketId).isEmpty() 
            ? "SR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT)
            : requestedTicketId);
        ticket.setStatus("OPEN");
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        ticket.setCreatedBy(defaultActor(actorId));
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setExecutionStatus(codexEnabled ? "READY_FOR_APPROVAL" : "CODEX_DISABLED");
        ticket.setQueueStatus("IDLE");
        ticket.setQueueMode("");
        ticket.setQueueSubmittedAt("");
        ticket.setQueueStartedAt("");
        ticket.setQueueCompletedAt("");
        ticket.setQueueRequestedBy("");
        ticket.setQueueLaneId("");
        ticket.setQueueTmuxSessionName("");
        ticket.setQueueErrorMessage("");
        ticket.setPageId(safe(request == null ? null : request.getPageId()));
        ticket.setPageLabel(safe(request == null ? null : request.getPageLabel()));
        ticket.setRoutePath(safe(request == null ? null : request.getRoutePath()));
        ticket.setMenuCode(safe(request == null ? null : request.getMenuCode()));
        ticket.setMenuLookupUrl(safe(request == null ? null : request.getMenuLookupUrl()));
        ticket.setSurfaceId(safe(request == null ? null : request.getSurfaceId()));
        ticket.setSurfaceLabel(safe(request == null ? null : request.getSurfaceLabel()));
        ticket.setEventId(safe(request == null ? null : request.getEventId()));
        ticket.setEventLabel(safe(request == null ? null : request.getEventLabel()));
        ticket.setTargetId(safe(request == null ? null : request.getTargetId()));
        ticket.setTargetLabel(safe(request == null ? null : request.getTargetLabel()));
        ticket.setSummary(safe(request == null ? null : request.getSummary()));
        ticket.setInstruction(safe(request == null ? null : request.getInstruction()));
        ticket.setTechnicalContext(safe(request == null ? null : request.getTechnicalContext()));
        ticket.setGeneratedDirection(safe(request == null ? null : request.getGeneratedDirection()));
        ticket.setCommandPrompt(safe(request == null ? null : request.getCommandPrompt()));
        if (!stackItems.isEmpty()) {
            applyStackContextToTicket(ticket, request, stackItems);
        }
        ticket.setExecutionComment(codexEnabled
                ? "승인 후 실행 준비, 계획 수립, 실제 실행 단계로 진행할 수 있습니다."
                : "Codex 기능이 비활성화되어 있어 승인 후에도 수동 실행이 필요합니다.");
        appendTicket(ticket);
        if (!stackItems.isEmpty()) {
            removeStackItemsById(extractStackItemIds(stackItems));
        }

        return successResponse("SR 티켓을 발행했습니다.", "ticket", ticketRow(ticket));
    }

    @Override
    public Map<String, Object> quickExecuteTicket(SrTicketCreateRequest request, String actorId) throws Exception {
        Map<String, Object> created = createTicket(request, actorId);
        String ticketId = extractTicketId(created);
        if (ticketId.isEmpty()) {
            throw new IllegalStateException("즉시 실행용 SR 티켓 ID를 확인할 수 없습니다.");
        }

        SrTicketApprovalRequest approvalRequest = new SrTicketApprovalRequest();
        approvalRequest.setDecision("APPROVE");
        approvalRequest.setComment(firstNonBlank(
                request == null ? null : request.getInstruction(),
                request == null ? null : request.getSummary(),
                "우클릭 즉시 실행"
        ));
        updateApproval(ticketId, approvalRequest, actorId);
        prepareExecution(ticketId, actorId);
        planTicket(ticketId, actorId);
        Map<String, Object> executed = executeTicket(ticketId, actorId, null);
        executed.put("ticketId", ticketId);
        executed.put("message", "선택한 영역을 기준으로 즉시 수정 실행을 완료했습니다.");
        return executed;
    }

    @Override
    public Map<String, Object> addStackItem(SrWorkbenchStackItemCreateRequest request, String actorId) throws Exception {
        SrWorkbenchStackItemVO item = new SrWorkbenchStackItemVO();
        String now = now();
        item.setStackItemId("STACK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT));
        item.setCreatedAt(now);
        item.setUpdatedAt(now);
        item.setCreatedBy(defaultActor(actorId));
        item.setPageId(safe(request == null ? null : request.getPageId()));
        item.setPageLabel(safe(request == null ? null : request.getPageLabel()));
        item.setRoutePath(safe(request == null ? null : request.getRoutePath()));
        item.setMenuCode(safe(request == null ? null : request.getMenuCode()));
        item.setMenuLookupUrl(safe(request == null ? null : request.getMenuLookupUrl()));
        item.setSurfaceId(safe(request == null ? null : request.getSurfaceId()));
        item.setSurfaceLabel(safe(request == null ? null : request.getSurfaceLabel()));
        item.setSelector(safe(request == null ? null : request.getSelector()));
        item.setComponentId(safe(request == null ? null : request.getComponentId()));
        item.setEventId(safe(request == null ? null : request.getEventId()));
        item.setEventLabel(safe(request == null ? null : request.getEventLabel()));
        item.setTargetId(safe(request == null ? null : request.getTargetId()));
        item.setTargetLabel(safe(request == null ? null : request.getTargetLabel()));
        item.setSummary(firstNonBlank(
                safe(request == null ? null : request.getSummary()),
                buildDefaultStackSummary(item)
        ));
        item.setInstruction(safe(request == null ? null : request.getInstruction()));
        item.setTechnicalContext(safe(request == null ? null : request.getTechnicalContext()));
        item.setTraceId(safe(request == null ? null : request.getTraceId()));
        item.setRequestId(safe(request == null ? null : request.getRequestId()));
        appendStackItem(item);

        return successResponse("워크벤치 스택에 컨텍스트를 추가했습니다.", "stackItem", stackItemRow(item));
    }

    @Override
    public Map<String, Object> removeStackItem(String stackItemId, String actorId) throws Exception {
        int removed = removeStackItemsById(Collections.singleton(safe(stackItemId)));
        return successResponse(
                removed > 0 ? "워크벤치 스택 항목을 제거했습니다." : "제거할 스택 항목이 없습니다.",
                "removedCount", removed,
                "actorId", defaultActor(actorId));
    }

    @Override
    public Map<String, Object> clearStack(String actorId) throws Exception {
        saveStackItems(Collections.emptyList());
        return successResponse("워크벤치 스택을 비웠습니다.", "actorId", defaultActor(actorId));
    }

    @Override
    public Map<String, Object> updateApproval(String ticketId, SrTicketApprovalRequest request, String actorId) throws Exception {
        String decision = safe(request == null ? null : request.getDecision()).toUpperCase(Locale.ROOT);
        if (!"APPROVE".equals(decision) && !"REJECT".equals(decision)) {
            throw new IllegalArgumentException("승인 처리 값은 APPROVE 또는 REJECT 여야 합니다.");
        }

        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }

        String now = now();
        ticket.setStatus("APPROVE".equals(decision) ? "APPROVED" : "REJECTED");
        ticket.setUpdatedAt(now);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setApprovedBy(defaultActor(actorId));
        ticket.setApprovedAt(now);
        ticket.setApprovalComment(safe(request == null ? null : request.getComment()));
        if ("APPROVE".equals(decision)) {
            ticket.setExecutionStatus(codexEnabled ? "APPROVED_READY" : "APPROVED_MANUAL_ONLY");
        } else {
            ticket.setExecutionStatus("REJECTED");
        }
        saveTickets(readTicketsReplacing(ticket));

        return successResponse(
                "APPROVE".equals(decision) ? "SR 티켓을 승인했습니다." : "SR 티켓을 반려했습니다.",
                "ticket", ticketRow(ticket));
    }

    @Override
    public Map<String, Object> prepareExecution(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        if (!"APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            throw new IllegalArgumentException("승인된 티켓만 실행 준비 상태로 바꿀 수 있습니다.");
        }

        String now = now();
        ticket.setUpdatedAt(now);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setExecutionPreparedAt(now);
        ticket.setExecutionPreparedBy(defaultActor(actorId));
        ticket.setExecutionStatus(codexEnabled ? "READY_FOR_CODEX" : "READY_FOR_MANUAL_EXECUTION");
        ticket.setExecutionComment(codexEnabled
                ? "Codex CLI 연결 시 계획 수립과 실제 실행이 가능한 상태로 전환되었습니다."
                : "Codex 비활성 상태입니다. command prompt를 수동 실행 프로세스에 전달하세요.");
        saveTickets(readTicketsReplacing(ticket));

        return successResponse("실행 준비 상태로 전환했습니다.", "ticket", ticketRow(ticket));
    }

    @Override
    public Map<String, Object> planTicket(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if ("APPROVED_READY".equals(executionStatus) || "APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            prepareExecution(ticketId, actorId);
            ticket = findTicket(ticketId);
            if (ticket == null) {
                throw new IllegalArgumentException("실행 준비 전환 후 SR 티켓을 다시 찾을 수 없습니다.");
            }
            executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        }
        if (!"READY_FOR_CODEX".equals(executionStatus)
                && !"RUNNER_BLOCKED".equals(executionStatus)
                && !"PLAN_FAILED".equals(executionStatus)
                && !"PLAN_COMPLETED".equals(executionStatus)) {
            throw new IllegalArgumentException("현재 상태(" + safe(ticket.getExecutionStatus()) + ")에서는 계획 수립이 불가합니다. APPROVED_READY 또는 READY_FOR_CODEX 상태에서 다시 시도하세요.");
        }

        String startedAt = now();
        SrTicketRecordVO runnerTicket = copyTicket(ticket);
        SrTicketRunnerExecutionVO preparedExecution = srTicketCodexRunnerService.prepareExecution(runnerTicket, actorId, "PLAN");
        ticket.setUpdatedAt(startedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setPlanStartedAt(startedAt);
        ticket.setPlanRunId(safe(preparedExecution.getRunId()));
        ticket.setPlanLogPath(safe(preparedExecution.getStdoutLogPath()));
        ticket.setPlanStderrPath(safe(preparedExecution.getStderrLogPath()));
        ticket.setPlanResultPath(safe(preparedExecution.getResultFilePath()));
        ticket.setExecutionStatus("PLAN_RUNNING");
        ticket.setExecutionComment("승인된 SR 티켓에 대한 Codex plan 실행을 시작했습니다.");
        saveTickets(readTicketsReplacing(ticket));

        SrTicketRunnerExecutionVO execution;
        try {
            execution = srTicketCodexRunnerService.executePrepared(runnerTicket, actorId, null, preparedExecution);
        } catch (Exception e) {
            String failedAt = now();
            ticket.setUpdatedAt(failedAt);
            ticket.setLastActionBy(defaultActor(actorId));
            ticket.setPlanCompletedAt(failedAt);
            ticket.setExecutionStatus("PLAN_FAILED");
            ticket.setExecutionComment(safe(e.getMessage()).isEmpty() ? "Codex plan 실행 중 오류가 발생했습니다." : safe(e.getMessage()));
            saveTickets(readTicketsReplacing(ticket));
            throw e;
        }

        String completedAt = safe(execution.getCompletedAt()).isEmpty() ? now() : safe(execution.getCompletedAt());
        ticket.setUpdatedAt(completedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setPlanRunId(safe(execution.getRunId()));
        ticket.setPlanCompletedAt(completedAt);
        ticket.setPlanLogPath(safe(execution.getStdoutLogPath()));
        ticket.setPlanStderrPath(safe(execution.getStderrLogPath()));
        ticket.setPlanResultPath(safe(execution.getResultFilePath()));
        ticket.setExecutionStatus(mapPlanExecutionStatus(execution.getStatus()));
        ticket.setExecutionComment(buildExecutionComment(execution));
        saveTickets(readTicketsReplacing(ticket));

        return successResponse(
                "PLAN_COMPLETED".equalsIgnoreCase(safe(execution.getStatus()))
                        ? "SR Codex 계획 수립을 완료했습니다."
                        : "SR Codex 계획 수립 결과를 기록했습니다.",
                "ticket", ticketRow(ticket));
    }

    private List<Map<String, Object>> readTicketRows() throws Exception {
        List<SrTicketRecordVO> tickets = readTickets();
        tickets.sort(Comparator.comparing(SrTicketRecordVO::getCreatedAt, Comparator.nullsLast(String::compareTo)).reversed());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (SrTicketRecordVO ticket : tickets) {
            rows.add(ticketRow(ticket));
        }
        return rows;
    }

    private List<Map<String, Object>> readStackRows() throws Exception {
        List<SrWorkbenchStackItemVO> items = readStackItems();
        items.sort(Comparator.comparing(SrWorkbenchStackItemVO::getCreatedAt, Comparator.nullsLast(String::compareTo)).reversed());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (SrWorkbenchStackItemVO item : items) {
            rows.add(stackItemRow(item));
        }
        return rows;
    }

    private Map<String, Object> ticketRow(SrTicketRecordVO ticket) {
        return orderedMap(
                "ticketId", safe(ticket.getTicketId()),
                "status", safe(ticket.getStatus()),
                "createdAt", safe(ticket.getCreatedAt()),
                "updatedAt", safe(ticket.getUpdatedAt()),
                "createdBy", safe(ticket.getCreatedBy()),
                "lastActionBy", safe(ticket.getLastActionBy()),
                "approvedBy", safe(ticket.getApprovedBy()),
                "approvedAt", safe(ticket.getApprovedAt()),
                "approvalComment", safe(ticket.getApprovalComment()),
                "executionPreparedAt", safe(ticket.getExecutionPreparedAt()),
                "executionPreparedBy", safe(ticket.getExecutionPreparedBy()),
                "executionStatus", safe(ticket.getExecutionStatus()),
                "executionComment", safe(ticket.getExecutionComment()),
                "queueStatus", safe(ticket.getQueueStatus()),
                "queueMode", safe(ticket.getQueueMode()),
                "queueSubmittedAt", safe(ticket.getQueueSubmittedAt()),
                "queueStartedAt", safe(ticket.getQueueStartedAt()),
                "queueCompletedAt", safe(ticket.getQueueCompletedAt()),
                "queueRequestedBy", safe(ticket.getQueueRequestedBy()),
                "queueLaneId", safe(ticket.getQueueLaneId()),
                "queueTmuxSessionName", safe(ticket.getQueueTmuxSessionName()),
                "queueErrorMessage", safe(ticket.getQueueErrorMessage()),
                "pageId", safe(ticket.getPageId()),
                "pageLabel", safe(ticket.getPageLabel()),
                "routePath", safe(ticket.getRoutePath()),
                "menuCode", safe(ticket.getMenuCode()),
                "menuLookupUrl", safe(ticket.getMenuLookupUrl()),
                "surfaceId", safe(ticket.getSurfaceId()),
                "surfaceLabel", safe(ticket.getSurfaceLabel()),
                "eventId", safe(ticket.getEventId()),
                "eventLabel", safe(ticket.getEventLabel()),
                "targetId", safe(ticket.getTargetId()),
                "targetLabel", safe(ticket.getTargetLabel()),
                "summary", safe(ticket.getSummary()),
                "instruction", safe(ticket.getInstruction()),
                "technicalContext", safe(ticket.getTechnicalContext()),
                "generatedDirection", safe(ticket.getGeneratedDirection()),
                "commandPrompt", safe(ticket.getCommandPrompt()),
                "planRunId", safe(ticket.getPlanRunId()),
                "planStartedAt", safe(ticket.getPlanStartedAt()),
                "planCompletedAt", safe(ticket.getPlanCompletedAt()),
                "planLogPath", safe(ticket.getPlanLogPath()),
                "planStderrPath", safe(ticket.getPlanStderrPath()),
                "planResultPath", safe(ticket.getPlanResultPath()),
                "executionRunId", safe(ticket.getExecutionRunId()),
                "executionStartedAt", safe(ticket.getExecutionStartedAt()),
                "executionStartedBy", safe(ticket.getExecutionStartedBy()),
                "executionCompletedAt", safe(ticket.getExecutionCompletedAt()),
                "executionCompletedBy", safe(ticket.getExecutionCompletedBy()),
                "executionLogPath", safe(ticket.getExecutionLogPath()),
                "executionStderrPath", safe(ticket.getExecutionStderrPath()),
                "executionDiffPath", safe(ticket.getExecutionDiffPath()),
                "executionChangedFiles", safe(ticket.getExecutionChangedFiles()),
                "executionWorktreePath", safe(ticket.getExecutionWorktreePath()),
                "backendVerifyLogPath", safe(ticket.getBackendVerifyLogPath()),
                "backendVerifyStderrPath", safe(ticket.getBackendVerifyStderrPath()),
                "frontendVerifyLogPath", safe(ticket.getFrontendVerifyLogPath()),
                "frontendVerifyStderrPath", safe(ticket.getFrontendVerifyStderrPath()),
                "deployLogPath", safe(ticket.getDeployLogPath()),
                "deployStderrPath", safe(ticket.getDeployStderrPath()),
                "backendVerifyExitCode", ticket.getBackendVerifyExitCode(),
                "frontendVerifyExitCode", ticket.getFrontendVerifyExitCode(),
                "deployExitCode", ticket.getDeployExitCode(),
                "deployCommand", safe(ticket.getDeployCommand()),
                "healthCheckStatus", safe(ticket.getHealthCheckStatus()),
                "rollbackStatus", safe(ticket.getRollbackStatus()),
                "rollbackLogPath", safe(ticket.getRollbackLogPath()),
                "rollbackStderrPath", safe(ticket.getRollbackStderrPath()));
    }

    private Map<String, Object> stackItemRow(SrWorkbenchStackItemVO item) {
        return orderedMap(
                "stackItemId", safe(item.getStackItemId()),
                "createdAt", safe(item.getCreatedAt()),
                "updatedAt", safe(item.getUpdatedAt()),
                "createdBy", safe(item.getCreatedBy()),
                "pageId", safe(item.getPageId()),
                "pageLabel", safe(item.getPageLabel()),
                "routePath", safe(item.getRoutePath()),
                "menuCode", safe(item.getMenuCode()),
                "menuLookupUrl", safe(item.getMenuLookupUrl()),
                "surfaceId", safe(item.getSurfaceId()),
                "surfaceLabel", safe(item.getSurfaceLabel()),
                "selector", safe(item.getSelector()),
                "componentId", safe(item.getComponentId()),
                "eventId", safe(item.getEventId()),
                "eventLabel", safe(item.getEventLabel()),
                "targetId", safe(item.getTargetId()),
                "targetLabel", safe(item.getTargetLabel()),
                "summary", safe(item.getSummary()),
                "instruction", safe(item.getInstruction()),
                "technicalContext", safe(item.getTechnicalContext()),
                "traceId", safe(item.getTraceId()),
                "requestId", safe(item.getRequestId()));
    }

    @Override
    public Map<String, Object> executeTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if (!"PLAN_COMPLETED".equals(executionStatus)) {
            throw new IllegalArgumentException("PLAN_COMPLETED 상태의 티켓만 실제 실행할 수 있습니다.");
        }
        return runBuildTicket(ticket, actorId, approvalToken, false);
    }

    @Override
    public Map<String, Object> skipPlanExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        if (!"APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            throw new IllegalArgumentException("APPROVED 상태의 티켓만 계획 없이 바로 실행할 수 있습니다.");
        }
        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if ("PLAN_RUNNING".equals(executionStatus) || "RUNNING_CODEX".equals(executionStatus)) {
            throw new IllegalArgumentException("이미 실행 중인 티켓입니다.");
        }
        if ("APPROVED_READY".equals(executionStatus) || executionStatus.isEmpty()) {
            prepareExecution(ticketId, actorId);
            ticket = findTicket(ticketId);
        }
        return runBuildTicket(ticket, actorId, approvalToken, true);
    }

    @Override
    public Map<String, Object> rollbackTicket(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if ("PLAN_RUNNING".equals(executionStatus) || "RUNNING_CODEX".equals(executionStatus)) {
            throw new IllegalArgumentException("실행 중인 티켓은 롤백할 수 없습니다.");
        }
        if ("MANUAL_ROLLBACK_RUNNING".equalsIgnoreCase(safe(ticket.getRollbackStatus()))) {
            throw new IllegalArgumentException("이미 수동 롤백이 진행 중입니다.");
        }
        String deployLogPath = safe(ticket.getDeployLogPath());
        if (deployLogPath.isEmpty()) {
            throw new IllegalArgumentException("배포 이력이 없는 티켓은 롤백할 수 없습니다.");
        }
        Path artifactsRoot = Paths.get(deployLogPath).getParent();
        if (artifactsRoot == null || !Files.isDirectory(artifactsRoot)) {
            throw new IllegalArgumentException("배포 아티팩트 경로를 확인할 수 없습니다.");
        }
        Path backupInfoFile = artifactsRoot.resolve("deploy-backup.env");
        String backupJarPath = readBackupJarPath(backupInfoFile);
        if (backupJarPath.isEmpty()) {
            throw new IllegalArgumentException("롤백용 백업 JAR 정보를 찾을 수 없습니다.");
        }
        Path backupJar = Paths.get(backupJarPath).normalize();
        if (!Files.isRegularFile(backupJar)) {
            throw new IllegalArgumentException("롤백용 백업 JAR가 존재하지 않습니다: " + backupJar);
        }

        String startedAt = now();
        Path rollbackStdout = artifactsRoot.resolve("manual-rollback.stdout.log");
        Path rollbackStderr = artifactsRoot.resolve("manual-rollback.stderr.log");
        ticket.setUpdatedAt(startedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setRollbackStatus("MANUAL_ROLLBACK_RUNNING");
        ticket.setRollbackLogPath(rollbackStdout.toString());
        ticket.setRollbackStderrPath(rollbackStderr.toString());
        ticket.setExecutionComment("선택한 배포 실행에 대해 수동 롤백을 진행 중입니다.");
        saveTickets(readTicketsReplacing(ticket));

        Path repositoryRoot = resolveRepositoryRoot();
        try {
            runRollbackCommand(repositoryRoot, backupJar, artifactsRoot, rollbackStdout, rollbackStderr);
        } catch (Exception e) {
            String failedAt = now();
            ticket.setUpdatedAt(failedAt);
            ticket.setLastActionBy(defaultActor(actorId));
            ticket.setRollbackStatus("MANUAL_ROLLBACK_FAILED");
            ticket.setExecutionComment(safe(e.getMessage()).isEmpty() ? "수동 롤백 중 오류가 발생했습니다." : safe(e.getMessage()));
            saveTickets(readTicketsReplacing(ticket));
            throw e;
        }

        String completedAt = now();
        ticket.setUpdatedAt(completedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setRollbackStatus("MANUAL_ROLLBACK_COMPLETED");
        ticket.setHealthCheckStatus("ROLLED_BACK");
        ticket.setExecutionComment("선택한 배포 실행을 이전 백업 JAR 기준으로 수동 롤백했습니다.");
        saveTickets(readTicketsReplacing(ticket));

        return successResponse("선택한 SR 배포 실행을 이전 상태로 롤백했습니다.", "ticket", ticketRow(ticket));
    }

    private Map<String, Object> runBuildTicket(SrTicketRecordVO ticket, String actorId, String approvalToken, boolean skipPlanValidation) throws Exception {
        SrTicketRecordVO runnerTicket = copyTicket(ticket);
        if (skipPlanValidation && !"PLAN_COMPLETED".equalsIgnoreCase(safe(runnerTicket.getExecutionStatus()))) {
            runnerTicket.setExecutionStatus("PLAN_COMPLETED");
        }
        SrTicketRunnerExecutionVO preparedExecution = srTicketCodexRunnerService.prepareExecution(runnerTicket, actorId, "BUILD");

        String startedAt = now();
        ticket.setUpdatedAt(startedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setExecutionStartedAt(startedAt);
        ticket.setExecutionStartedBy(defaultActor(actorId));
        ticket.setExecutionRunId(safe(preparedExecution.getRunId()));
        ticket.setExecutionLogPath(safe(preparedExecution.getStdoutLogPath()));
        ticket.setExecutionStderrPath(safe(preparedExecution.getStderrLogPath()));
        ticket.setExecutionDiffPath(safe(preparedExecution.getDiffFilePath()));
        ticket.setExecutionWorktreePath(safe(preparedExecution.getWorktreePath()));
        ticket.setExecutionStatus("RUNNING_CODEX");
        ticket.setExecutionComment("승인된 SR 티켓에 대한 Codex runner 실행을 시작했습니다.");
        saveTickets(readTicketsReplacing(ticket));

        SrTicketRunnerExecutionVO execution;
        try {
            execution = srTicketCodexRunnerService.executePrepared(runnerTicket, actorId, approvalToken, preparedExecution);
        } catch (Exception e) {
            String failedAt = now();
            ticket.setUpdatedAt(failedAt);
            ticket.setLastActionBy(defaultActor(actorId));
            ticket.setExecutionCompletedAt(failedAt);
            ticket.setExecutionCompletedBy(defaultActor(actorId));
            ticket.setExecutionStatus("RUNNER_ERROR");
            ticket.setExecutionComment(safe(e.getMessage()).isEmpty() ? "Codex runner 실행 중 오류가 발생했습니다." : safe(e.getMessage()));
            saveTickets(readTicketsReplacing(ticket));
            throw e;
        }
        String completedAt = safe(execution.getCompletedAt()).isEmpty() ? now() : safe(execution.getCompletedAt());

        ticket.setUpdatedAt(completedAt);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setExecutionRunId(safe(execution.getRunId()));
        ticket.setExecutionCompletedAt(completedAt);
        ticket.setExecutionCompletedBy(defaultActor(actorId));
        ticket.setExecutionLogPath(safe(execution.getStdoutLogPath()));
        ticket.setExecutionStderrPath(safe(execution.getStderrLogPath()));
        ticket.setExecutionDiffPath(safe(execution.getDiffFilePath()));
        ticket.setExecutionChangedFiles(safe(execution.getChangedFilesSummary()));
        ticket.setExecutionWorktreePath(safe(execution.getWorktreePath()));
        ticket.setBackendVerifyLogPath(safe(execution.getBackendVerifyStdoutLogPath()));
        ticket.setBackendVerifyStderrPath(safe(execution.getBackendVerifyStderrLogPath()));
        ticket.setFrontendVerifyLogPath(safe(execution.getFrontendVerifyStdoutLogPath()));
        ticket.setFrontendVerifyStderrPath(safe(execution.getFrontendVerifyStderrLogPath()));
        ticket.setDeployLogPath(safe(execution.getDeployStdoutLogPath()));
        ticket.setDeployStderrPath(safe(execution.getDeployStderrLogPath()));
        ticket.setBackendVerifyExitCode(execution.getBackendVerifyExitCode());
        ticket.setFrontendVerifyExitCode(execution.getFrontendVerifyExitCode());
        ticket.setDeployExitCode(execution.getDeployExitCode());
        ticket.setDeployCommand(safe(execution.getDeployCommand()));
        ticket.setHealthCheckStatus(safe(execution.getHealthCheckStatus()));
        ticket.setRollbackStatus(safe(execution.getRollbackStatus()));
        ticket.setExecutionStatus(mapExecutionStatus(execution.getStatus()));
        ticket.setExecutionComment(buildExecutionComment(execution));
        saveTickets(readTicketsReplacing(ticket));

        return successResponse(
                "COMPLETED".equalsIgnoreCase(safe(execution.getStatus()))
                        ? "SR Codex runner 실행을 완료했습니다."
                        : "SR Codex runner 실행 결과를 기록했습니다.",
                "ticket", ticketRow(ticket));
    }

    private void runLoggedCommand(List<String> command, Path workingDirectory, Path stdoutPath, Path stderrPath) throws Exception {
        Files.createDirectories(stdoutPath.getParent());
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workingDirectory.toFile());
        builder.redirectErrorStream(false);
        Process process = builder.start();
        Thread stdoutThread = new Thread(new StreamCollector(process.getInputStream(), stdoutPath), "ticket-rollback-stdout");
        Thread stderrThread = new Thread(new StreamCollector(process.getErrorStream(), stderrPath), "ticket-rollback-stderr");
        stdoutThread.start();
        stderrThread.start();
        if (!process.waitFor(1800, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            stdoutThread.join(TimeUnit.SECONDS.toMillis(5));
            stderrThread.join(TimeUnit.SECONDS.toMillis(5));
            throw new IllegalStateException("롤백 명령이 시간 내에 완료되지 않았습니다.");
        }
        stdoutThread.join(TimeUnit.SECONDS.toMillis(5));
        stderrThread.join(TimeUnit.SECONDS.toMillis(5));
        if (process.exitValue() != 0) {
            throw new IllegalStateException("롤백 명령이 실패했습니다. exit=" + process.exitValue());
        }
    }

    @Override
    public Map<String, Object> directExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        if (!"APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            throw new IllegalArgumentException("APPROVED 상태의 티켓만 바로 실행할 수 있습니다.");
        }

        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if ("APPROVED_READY".equals(executionStatus) || "APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            prepareExecution(ticketId, actorId);
            ticket = findTicket(ticketId);
            executionStatus = safe(ticket == null ? null : ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        }
        if (!"PLAN_COMPLETED".equals(executionStatus)) {
            planTicket(ticketId, actorId);
        }
        return executeTicket(ticketId, actorId, approvalToken);
    }

    @Override
    public Map<String, Object> queueDirectExecuteTicket(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        if (!"APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            throw new IllegalArgumentException("APPROVED 상태의 티켓만 대기열 실행을 요청할 수 있습니다.");
        }
        String queueStatus = safe(ticket.getQueueStatus()).toUpperCase(Locale.ROOT);
        if ("QUEUED".equals(queueStatus) || "RUNNING".equals(queueStatus)) {
            throw new IllegalArgumentException("이미 대기열에 등록되었거나 실행 중인 티켓입니다.");
        }
        String now = now();
        ticket.setUpdatedAt(now);
        ticket.setLastActionBy(defaultActor(actorId));
        ticket.setQueueStatus("QUEUED");
        ticket.setQueueMode("DIRECT_EXECUTE");
        ticket.setQueueSubmittedAt(now);
        ticket.setQueueStartedAt("");
        ticket.setQueueCompletedAt("");
        ticket.setQueueRequestedBy(defaultActor(actorId));
        ticket.setQueueLaneId("");
        ticket.setQueueTmuxSessionName("");
        ticket.setQueueErrorMessage("");
        ticket.setExecutionComment("병렬 실행 대기열에 등록되었습니다.");
        saveTickets(readTicketsReplacing(ticket));
        dispatchQueuedTickets();

        return successResponse(
                "SR 티켓을 병렬 실행 대기열에 등록했습니다.",
                "ticket", ticketRow(findTicket(ticketId)),
                "executionLanes", buildExecutionLaneRows());
    }

    @Override
    public Map<String, Object> reissueTicket(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO source = findTicket(ticketId);
        if (source == null) {
            throw new IllegalArgumentException("재발행할 SR 티켓을 찾을 수 없습니다.");
        }
        SrTicketCreateRequest request = buildReissueCreateRequest(source);
        Map<String, Object> created = createTicket(request, actorId);
        created.put("sourceTicketId", safe(ticketId));
        created.put("message", "SR 티켓을 재발행했습니다.");
        return created;
    }

    private SrTicketRecordVO copyTicket(SrTicketRecordVO source) {
        if (source == null) {
            return null;
        }
        return objectMapper.convertValue(source, SrTicketRecordVO.class);
    }

    private SrTicketCreateRequest buildReissueCreateRequest(SrTicketRecordVO source) {
        SrTicketCreateRequest request = new SrTicketCreateRequest();
        request.setPageId(safe(source.getPageId()));
        request.setPageLabel(safe(source.getPageLabel()));
        request.setRoutePath(safe(source.getRoutePath()));
        request.setMenuCode(safe(source.getMenuCode()));
        request.setMenuLookupUrl(safe(source.getMenuLookupUrl()));
        request.setSurfaceId(safe(source.getSurfaceId()));
        request.setSurfaceLabel(safe(source.getSurfaceLabel()));
        request.setEventId(safe(source.getEventId()));
        request.setEventLabel(safe(source.getEventLabel()));
        request.setTargetId(safe(source.getTargetId()));
        request.setTargetLabel(safe(source.getTargetLabel()));
        request.setSummary(safe(source.getSummary()));
        request.setInstruction(safe(source.getInstruction()));
        request.setTechnicalContext(safe(source.getTechnicalContext()));
        request.setGeneratedDirection(safe(source.getGeneratedDirection()));
        request.setCommandPrompt(safe(source.getCommandPrompt()));
        return request;
    }

    @Override
    public Map<String, Object> deleteTicket(String ticketId, String actorId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }

        List<SrTicketRecordVO> tickets = readTickets();
        List<SrTicketRecordVO> filtered = new ArrayList<SrTicketRecordVO>();
        for (SrTicketRecordVO current : tickets) {
            if (!safe(current.getTicketId()).equalsIgnoreCase(safe(ticketId))) {
                filtered.add(current);
            }
        }
        saveTickets(filtered);

        return successResponse(
                "SR 티켓을 삭제했습니다.",
                "deletedTicketId", safe(ticketId),
                "actorId", defaultActor(actorId));
    }

    @Override
    public Map<String, Object> getTicketDetail(String ticketId) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        return successResponse(
                "",
                "ticket", ticketRow(ticket),
                "availableArtifacts", buildAvailableArtifacts(ticket),
                "reviewSummary", buildReviewSummary(ticket));
    }

    @Override
    public Map<String, Object> getTicketArtifact(String ticketId, String artifactType) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("SR 티켓을 찾을 수 없습니다.");
        }
        String normalizedArtifactType = safe(artifactType).toLowerCase(Locale.ROOT);
        ArtifactDescriptor artifact = resolveArtifact(ticket, normalizedArtifactType);
        Map<String, Object> response = successResponse(
                "",
                "ticketId", safe(ticketId),
                "artifactType", artifact.getArtifactType(),
                "label", artifact.getLabel(),
                "filePath", artifact.getPath());
        if (!artifact.getInlineContent().isEmpty()) {
            response.putAll(orderedMap(
                    "available", true,
                    "content", artifact.getInlineContent(),
                    "truncated", artifact.getInlineContent().length() > ARTIFACT_PREVIEW_LIMIT,
                    "message", "아티팩트 미리보기를 불러왔습니다."));
            return response;
        }
        if (artifact.getPath().isEmpty()) {
            response.putAll(orderedMap(
                    "available", false,
                    "content", "",
                    "truncated", false,
                    "message", "아직 생성된 아티팩트가 없습니다."));
            return response;
        }

        Path previewPath = Paths.get(artifact.getPath()).normalize();
        if (!Files.exists(previewPath, LinkOption.NOFOLLOW_LINKS) || !Files.isRegularFile(previewPath, LinkOption.NOFOLLOW_LINKS)) {
            response.putAll(orderedMap(
                    "available", false,
                    "content", "",
                    "truncated", false,
                    "message", "아티팩트 파일을 찾을 수 없습니다."));
            return response;
        }

        response.putAll(orderedMap(
                "available", true,
                "content", readArtifactPreview(previewPath),
                "truncated", Files.size(previewPath) > ARTIFACT_PREVIEW_LIMIT,
                "message", "아티팩트 미리보기를 불러왔습니다."));
        return response;
    }

    private List<Map<String, Object>> buildAvailableArtifacts(SrTicketRecordVO ticket) {
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(artifactSummary("plan-result", "Plan Result", safe(ticket.getPlanResultPath())));
        items.add(artifactSummary("plan-log", "Plan Stdout", safe(ticket.getPlanLogPath())));
        items.add(artifactSummary("plan-stderr", "Plan Stderr", safe(ticket.getPlanStderrPath())));
        items.add(artifactSummary("build-log", "Build Stdout", safe(ticket.getExecutionLogPath())));
        items.add(artifactSummary("build-stderr", "Build Stderr", safe(ticket.getExecutionStderrPath())));
        items.add(artifactSummary("build-diff", "Build Diff", safe(ticket.getExecutionDiffPath())));
        items.add(artifactSummary("backend-verify-log", "Backend Verify Stdout", safe(ticket.getBackendVerifyLogPath())));
        items.add(artifactSummary("backend-verify-stderr", "Backend Verify Stderr", safe(ticket.getBackendVerifyStderrPath())));
        items.add(artifactSummary("frontend-verify-log", "Frontend Verify Stdout", safe(ticket.getFrontendVerifyLogPath())));
        items.add(artifactSummary("frontend-verify-stderr", "Frontend Verify Stderr", safe(ticket.getFrontendVerifyStderrPath())));
        items.add(artifactSummary("build-result", "Codex Build Result", safe(ticket.getExecutionLogPath()).replace("codex-build.stdout.log", "codex-build-result.txt")));
        items.add(artifactSummary("deploy-log", "Deploy Stdout", safe(ticket.getDeployLogPath())));
        items.add(artifactSummary("deploy-stderr", "Deploy Stderr", safe(ticket.getDeployStderrPath())));
        items.add(artifactSummary("rollback-log", "Rollback Stdout", safe(ticket.getRollbackLogPath())));
        items.add(artifactSummary("rollback-stderr", "Rollback Stderr", safe(ticket.getRollbackStderrPath())));
        items.add(artifactSummary("build-changed-summary", "Changed Files", safe(ticket.getExecutionChangedFiles())));
        return items;
    }

    private Map<String, Object> artifactSummary(String artifactType, String label, String path) {
        return orderedMap(
                "artifactType", artifactType,
                "label", label,
                "filePath", safe(path),
                "available", !safe(path).isEmpty());
    }

    private ArtifactDescriptor resolveArtifact(SrTicketRecordVO ticket, String artifactType) {
        if ("plan-result".equals(artifactType)) {
            return new ArtifactDescriptor("plan-result", "Plan Result", safe(ticket.getPlanResultPath()));
        }
        if ("plan-log".equals(artifactType)) {
            return new ArtifactDescriptor("plan-log", "Plan Stdout", safe(ticket.getPlanLogPath()));
        }
        if ("plan-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("plan-stderr", "Plan Stderr", safe(ticket.getPlanStderrPath()));
        }
        if ("build-log".equals(artifactType)) {
            return new ArtifactDescriptor("build-log", "Build Stdout", safe(ticket.getExecutionLogPath()));
        }
        if ("build-result".equals(artifactType)) {
            return new ArtifactDescriptor("build-result", "Codex Build Result", resolveBuildResultPath(ticket));
        }
        if ("build-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("build-stderr", "Build Stderr", safe(ticket.getExecutionStderrPath()));
        }
        if ("build-diff".equals(artifactType)) {
            return new ArtifactDescriptor("build-diff", "Build Diff", safe(ticket.getExecutionDiffPath()));
        }
        if ("backend-verify-log".equals(artifactType)) {
            return new ArtifactDescriptor("backend-verify-log", "Backend Verify Stdout", safe(ticket.getBackendVerifyLogPath()));
        }
        if ("backend-verify-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("backend-verify-stderr", "Backend Verify Stderr", safe(ticket.getBackendVerifyStderrPath()));
        }
        if ("frontend-verify-log".equals(artifactType)) {
            return new ArtifactDescriptor("frontend-verify-log", "Frontend Verify Stdout", safe(ticket.getFrontendVerifyLogPath()));
        }
        if ("frontend-verify-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("frontend-verify-stderr", "Frontend Verify Stderr", safe(ticket.getFrontendVerifyStderrPath()));
        }
        if ("deploy-log".equals(artifactType)) {
            return new ArtifactDescriptor("deploy-log", "Deploy Stdout", safe(ticket.getDeployLogPath()));
        }
        if ("deploy-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("deploy-stderr", "Deploy Stderr", safe(ticket.getDeployStderrPath()));
        }
        if ("rollback-log".equals(artifactType)) {
            return new ArtifactDescriptor("rollback-log", "Rollback Stdout", safe(ticket.getRollbackLogPath()));
        }
        if ("rollback-stderr".equals(artifactType)) {
            return new ArtifactDescriptor("rollback-stderr", "Rollback Stderr", safe(ticket.getRollbackStderrPath()));
        }
        if ("build-changed-summary".equals(artifactType)) {
            return ArtifactDescriptor.inline("build-changed-summary", "Changed Files", safe(ticket.getExecutionChangedFiles()));
        }
        throw new IllegalArgumentException("지원하지 않는 아티팩트 유형입니다: " + safe(artifactType));
    }

    private String readArtifactPreview(Path file) throws Exception {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            char[] buffer = new char[2048];
            int read;
            while ((read = reader.read(buffer)) >= 0) {
                int remaining = ARTIFACT_PREVIEW_LIMIT - builder.length();
                if (remaining <= 0) {
                    break;
                }
                builder.append(buffer, 0, Math.min(read, remaining));
                if (builder.length() >= ARTIFACT_PREVIEW_LIMIT) {
                    break;
                }
            }
        }
        return builder.toString();
    }

    private Map<String, Object> buildReviewSummary(SrTicketRecordVO ticket) throws Exception {
        return orderedMap(
                "planStderrSnippet", readArtifactSnippet(safe(ticket.getPlanStderrPath())),
                "buildStderrSnippet", readArtifactSnippet(safe(ticket.getExecutionStderrPath())),
                "backendVerifySnippet", readArtifactSnippet(safe(ticket.getBackendVerifyStderrPath())),
                "frontendVerifySnippet", readArtifactSnippet(safe(ticket.getFrontendVerifyStderrPath())),
                "deploySnippet", readArtifactSnippet(safe(ticket.getDeployStderrPath())),
                "rollbackSnippet", readArtifactSnippet(firstNonBlank(safe(ticket.getRollbackStderrPath()), safe(ticket.getRollbackLogPath()))));
    }

    private String readArtifactSnippet(String filePath) throws Exception {
        if (safe(filePath).isEmpty()) {
            return "";
        }
        Path file = Paths.get(filePath).normalize();
        if (!Files.exists(file, LinkOption.NOFOLLOW_LINKS) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            return "";
        }
        String content = readArtifactPreview(file);
        String trimmed = safe(content);
        if (trimmed.isEmpty()) {
            return "";
        }
        String[] lines = trimmed.split("\\R");
        StringBuilder builder = new StringBuilder();
        int added = 0;
        for (String line : lines) {
            String next = safe(line);
            if (next.isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(System.lineSeparator());
            }
            builder.append(next);
            added++;
            if (added >= 6 || builder.length() >= 1200) {
                break;
            }
        }
        return builder.toString();
    }

    private String mapExecutionStatus(String runnerStatus) {
        String status = safe(runnerStatus).toUpperCase(Locale.ROOT);
        if ("COMPLETED".equals(status)) {
            return "CODEX_COMPLETED";
        }
        if ("RUNNER_BLOCKED".equals(status)) {
            return "RUNNER_BLOCKED";
        }
        if ("CHANGED_FILE_BLOCKED".equals(status)) {
            return "CHANGED_FILE_BLOCKED";
        }
        if ("BACKEND_VERIFY_FAILED".equals(status) || "FRONTEND_VERIFY_FAILED".equals(status)) {
            return "VERIFY_FAILED";
        }
        if ("DEPLOY_HOOK_FAILED".equals(status)
                || "DEPLOY_FAILED_ROLLED_BACK".equals(status)
                || "DEPLOY_FAILED_WITH_ROLLBACK_FAILED".equals(status)) {
            return "DEPLOY_FAILED";
        }
        if ("CODEX_FAILED".equals(status)) {
            return "CODEX_FAILED";
        }
        return "RUNNER_ERROR";
    }

    private String mapPlanExecutionStatus(String runnerStatus) {
        String status = safe(runnerStatus).toUpperCase(Locale.ROOT);
        if ("PLAN_COMPLETED".equals(status)) {
            return "PLAN_COMPLETED";
        }
        if ("RUNNER_BLOCKED".equals(status)) {
            return "RUNNER_BLOCKED";
        }
        return "PLAN_FAILED";
    }

    private String buildExecutionComment(SrTicketRunnerExecutionVO execution) {
        StringBuilder builder = new StringBuilder();
        builder.append("runnerStatus=").append(safe(execution.getStatus()).isEmpty() ? "-" : safe(execution.getStatus()));
        if (!safe(execution.getErrorMessage()).isEmpty()) {
            builder.append(" / ").append(safe(execution.getErrorMessage()));
        }
        if (!safe(execution.getChangedFilesSummary()).isEmpty()) {
            builder.append(" / changed=").append(safe(execution.getChangedFilesSummary()).replace('\n', ','));
        }
        if (execution.getBackendVerifyExitCode() != null) {
            builder.append(" / backendVerify=").append(execution.getBackendVerifyExitCode());
        }
        if (execution.getFrontendVerifyExitCode() != null) {
            builder.append(" / frontendVerify=").append(execution.getFrontendVerifyExitCode());
        }
        if (execution.getDeployExitCode() != null) {
            builder.append(" / deploy=").append(execution.getDeployExitCode());
        }
        if (!safe(execution.getHealthCheckStatus()).isEmpty()) {
            builder.append(" / health=").append(safe(execution.getHealthCheckStatus()));
        }
        if (!safe(execution.getRollbackStatus()).isEmpty()) {
            builder.append(" / rollback=").append(safe(execution.getRollbackStatus()));
        }
        return builder.toString();
    }

    private String readBackupJarPath(Path backupInfoFile) throws Exception {
        if (backupInfoFile == null || !Files.isRegularFile(backupInfoFile)) {
            return "";
        }
        try (BufferedReader reader = Files.newBufferedReader(backupInfoFile, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                String normalized = safe(line);
                if (normalized.startsWith("BACKUP_JAR_PATH=")) {
                    return safe(normalized.substring("BACKUP_JAR_PATH=".length()));
                }
            }
        }
        return "";
    }

    private void runRollbackCommand(Path repositoryRoot, Path backupJar, Path artifactsRoot,
                                    Path stdoutPath, Path stderrPath) throws Exception {
        List<String> command = buildRollbackCommand(repositoryRoot, backupJar, artifactsRoot, stdoutPath, stderrPath);
        runLoggedCommand(command, repositoryRoot, stdoutPath, stderrPath);
    }

    private List<String> buildRollbackCommand(Path repositoryRoot, Path backupJar, Path artifactsRoot,
                                              Path stdoutPath, Path stderrPath) {
        String template = safe(rollbackCommand);
        if (template.isEmpty()) {
            List<String> fallback = new ArrayList<>();
            fallback.add("bash");
            fallback.add(repositoryRoot.resolve("ops/scripts/codex-rollback-18000.sh").toString());
            fallback.add(repositoryRoot.toString());
            fallback.add(backupJar.toString());
            return fallback;
        }
        return tokenizeCommandTemplate(template, repositoryRoot, backupJar, artifactsRoot, stdoutPath, stderrPath);
    }

    private List<String> tokenizeCommandTemplate(String template, Path repositoryRoot, Path backupJar,
                                                 Path artifactsRoot, Path stdoutPath, Path stderrPath) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = Pattern.compile("([^\"]\\S*|\".+?\"|'[^']+')\\s*").matcher(template);
        while (matcher.find()) {
            String token = matcher.group(1);
            if (token == null) {
                continue;
            }
            String normalized = token.trim();
            if ((normalized.startsWith("\"") && normalized.endsWith("\""))
                    || (normalized.startsWith("'") && normalized.endsWith("'"))) {
                normalized = normalized.substring(1, normalized.length() - 1);
            }
            if (!normalized.isEmpty()) {
                tokens.add(applyRollbackPlaceholders(normalized, repositoryRoot, backupJar, artifactsRoot, stdoutPath, stderrPath));
            }
        }
        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Rollback command template is empty.");
        }
        String executable = tokens.get(0);
        if (!executable.startsWith("/") && executable.contains("/")) {
            tokens.set(0, repositoryRoot.resolve(executable).normalize().toString());
        }
        return tokens;
    }

    private String applyRollbackPlaceholders(String token, Path repositoryRoot, Path backupJar,
                                             Path artifactsRoot, Path stdoutPath, Path stderrPath) {
        return token
                .replace("{repoRoot}", repositoryRoot.toString())
                .replace("{backupJar}", backupJar.toString())
                .replace("{artifactsRoot}", artifactsRoot.toString())
                .replace("{stdoutLog}", stdoutPath.toString())
                .replace("{stderrLog}", stderrPath.toString());
    }

    private Path resolveRepositoryRoot() {
        return Paths.get(safe(codexRunnerRepoRoot).isEmpty() ? "/opt/Resonance" : safe(codexRunnerRepoRoot)).normalize();
    }

    private String resolveBuildResultPath(SrTicketRecordVO ticket) {
        String stdoutPath = safe(ticket.getExecutionLogPath());
        if (stdoutPath.isEmpty()) {
            return "";
        }
        return stdoutPath.replace("codex-build.stdout.log", "codex-build-result.txt");
    }

    private List<SrTicketRecordVO> readTicketsReplacing(SrTicketRecordVO replacement) throws Exception {
        List<SrTicketRecordVO> tickets = readTickets();
        boolean replaced = false;
        for (int i = 0; i < tickets.size(); i++) {
            SrTicketRecordVO current = tickets.get(i);
            if (safe(current.getTicketId()).equalsIgnoreCase(safe(replacement.getTicketId()))) {
                tickets.set(i, replacement);
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            tickets.add(replacement);
        }
        return tickets;
    }

    private List<SrWorkbenchStackItemVO> resolveRequestedStackItems(SrTicketCreateRequest request) throws Exception {
        List<String> requestedIds = request == null ? Collections.emptyList() : request.getStackItemIds();
        if (requestedIds == null || requestedIds.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> requestedIdSet = new LinkedHashSet<>();
        for (String stackItemId : requestedIds) {
            String normalized = safe(stackItemId);
            if (!normalized.isEmpty()) {
                requestedIdSet.add(normalized);
            }
        }
        if (requestedIdSet.isEmpty()) {
            return Collections.emptyList();
        }
        List<SrWorkbenchStackItemVO> selected = new ArrayList<>();
        for (SrWorkbenchStackItemVO item : readStackItems()) {
            if (requestedIdSet.contains(safe(item.getStackItemId()))) {
                selected.add(item);
            }
        }
        return selected;
    }

    private void applyStackContextToTicket(SrTicketRecordVO ticket,
                                           SrTicketCreateRequest request,
                                           List<SrWorkbenchStackItemVO> stackItems) {
        SrWorkbenchStackItemVO first = stackItems.get(0);
        boolean singlePage = isSinglePageStack(stackItems);
        ticket.setPageId(singlePage ? safe(first.getPageId()) : "stack-multi-page");
        ticket.setPageLabel(singlePage
                ? safe(first.getPageLabel())
                : "워크벤치 스택 (" + stackItems.size() + "건)");
        ticket.setRoutePath(singlePage ? safe(first.getRoutePath()) : buildStackRouteSummary(stackItems));
        ticket.setMenuCode(singlePage ? safe(first.getMenuCode()) : "STACK_MULTI");
        ticket.setMenuLookupUrl(singlePage ? safe(first.getMenuLookupUrl()) : "");
        ticket.setSurfaceId(stackItems.size() == 1 ? safe(first.getSurfaceId()) : "stack-selection");
        ticket.setSurfaceLabel(stackItems.size() == 1 ? safe(first.getSurfaceLabel()) : "워크벤치 스택 선택");
        ticket.setEventId(stackItems.size() == 1 ? safe(first.getEventId()) : "stack-selection");
        ticket.setEventLabel(stackItems.size() == 1 ? safe(first.getEventLabel()) : "다중 컨텍스트");
        ticket.setTargetId(firstNonBlank(safe(request == null ? null : request.getTargetId()), "stack-selection"));
        ticket.setTargetLabel(firstNonBlank(safe(request == null ? null : request.getTargetLabel()), "워크벤치 스택"));
        ticket.setSummary(firstNonBlank(safe(ticket.getSummary()), buildStackTicketSummary(stackItems)));
        ticket.setInstruction(buildStackInstruction(safe(ticket.getInstruction()), stackItems));
        ticket.setGeneratedDirection(firstNonBlank(safe(ticket.getGeneratedDirection()), buildStackDirection(ticket, stackItems)));
        ticket.setCommandPrompt(firstNonBlank(safe(ticket.getCommandPrompt()), buildStackCommandPrompt(ticket, stackItems)));
        ticket.setTechnicalContext(firstNonBlank(safe(ticket.getTechnicalContext()), buildStackTechnicalContext(stackItems)));
    }

    private boolean isSinglePageStack(List<SrWorkbenchStackItemVO> stackItems) {
        String pageId = "";
        for (SrWorkbenchStackItemVO item : stackItems) {
            String current = safe(item.getPageId());
            if (pageId.isEmpty()) {
                pageId = current;
                continue;
            }
            if (!pageId.equalsIgnoreCase(current)) {
                return false;
            }
        }
        return true;
    }

    private String buildStackRouteSummary(List<SrWorkbenchStackItemVO> stackItems) {
        Set<String> paths = new LinkedHashSet<>();
        for (SrWorkbenchStackItemVO item : stackItems) {
            String value = safe(item.getRoutePath());
            if (!value.isEmpty()) {
                paths.add(value);
            }
        }
        return String.join(", ", paths);
    }

    private String buildStackTicketSummary(List<SrWorkbenchStackItemVO> stackItems) {
        if (stackItems.size() == 1) {
            SrWorkbenchStackItemVO item = stackItems.get(0);
            return firstNonBlank(
                    safe(item.getSummary()),
                    joinNonBlank(" / ",
                            safe(item.getPageLabel()),
                            safe(item.getSurfaceLabel()),
                            safe(item.getEventLabel()))
            );
        }
        SrWorkbenchStackItemVO first = stackItems.get(0);
        return firstNonBlank(
                safe(first.getPageLabel()),
                safe(first.getPageId()),
                "워크벤치 스택"
        ) + " 외 " + (stackItems.size() - 1) + "건 컨텍스트";
    }

    private String buildStackInstruction(String baseInstruction, List<SrWorkbenchStackItemVO> stackItems) {
        if (stackItems.size() == 1) {
            SrWorkbenchStackItemVO item = stackItems.get(0);
            return firstNonBlank(
                    safe(baseInstruction),
                    safe(item.getInstruction()),
                    safe(item.getSummary()),
                    "선택한 컴포넌트 기준으로 필요한 수정만 반영합니다."
            );
        }
        StringBuilder builder = new StringBuilder();
        if (!safe(baseInstruction).isEmpty()) {
            builder.append(safe(baseInstruction)).append(System.lineSeparator()).append(System.lineSeparator());
        }
        builder.append("[워크벤치 스택 컨텍스트]").append(System.lineSeparator());
        int index = 1;
        for (SrWorkbenchStackItemVO item : stackItems) {
            builder.append(index++)
                    .append(". ")
                    .append(joinNonBlank(" / ",
                            safe(item.getPageLabel()),
                            safe(item.getSurfaceLabel()),
                            safe(item.getEventLabel()),
                            safe(item.getTargetLabel())))
                    .append(System.lineSeparator());
            if (!safe(item.getSelector()).isEmpty()) {
                builder.append("selector=").append(safe(item.getSelector())).append(System.lineSeparator());
            }
            if (!safe(item.getInstruction()).isEmpty()) {
                builder.append("note=").append(safe(item.getInstruction())).append(System.lineSeparator());
            }
        }
        return builder.toString().trim();
    }

    private String buildStackDirection(SrTicketRecordVO ticket, List<SrWorkbenchStackItemVO> stackItems) {
        if (stackItems.size() == 1) {
            SrWorkbenchStackItemVO item = stackItems.get(0);
            StringBuilder builder = new StringBuilder();
            builder.append("[SR 요약] ").append(safe(ticket.getSummary())).append(System.lineSeparator());
            builder.append("url=").append(firstNonBlank(safe(ticket.getRoutePath()), safe(item.getRoutePath()), "-")).append(System.lineSeparator());
            builder.append("target=").append(firstNonBlank(safe(item.getSurfaceLabel()), safe(item.getSelector()), safe(item.getPageLabel()), "-")).append(System.lineSeparator());
            builder.append("changeTarget=").append(firstNonBlank(safe(ticket.getTargetLabel()), safe(ticket.getTargetId()), "-")).append(System.lineSeparator());
            builder.append("실행 지시=").append(firstNonBlank(safe(ticket.getInstruction()), safe(item.getInstruction()), "선택한 컴포넌트 기준으로 필요한 수정만 반영합니다."));
            return builder.toString().trim();
        }
        StringBuilder builder = new StringBuilder();
        builder.append("[SR 요약] ").append(safe(ticket.getSummary())).append(System.lineSeparator());
        builder.append("대상 범위: 워크벤치 스택 ").append(stackItems.size()).append("건").append(System.lineSeparator());
        builder.append("수정 레이어: ").append(firstNonBlank(safe(ticket.getTargetLabel()), safe(ticket.getTargetId()), "워크벤치 스택")).append(System.lineSeparator());
        builder.append("선택 컨텍스트:").append(System.lineSeparator());
        int index = 1;
        for (SrWorkbenchStackItemVO item : stackItems) {
            builder.append("- [").append(index++).append("] ")
                    .append(joinNonBlank(" | ",
                            firstNonBlank(safe(item.getPageLabel()), safe(item.getPageId())),
                            firstNonBlank(safe(item.getSurfaceLabel()), safe(item.getSurfaceId())),
                            firstNonBlank(safe(item.getEventLabel()), safe(item.getEventId())),
                            firstNonBlank(safe(item.getTargetLabel()), safe(item.getTargetId()))));
            if (!safe(item.getSelector()).isEmpty()) {
                builder.append(" [").append(safe(item.getSelector())).append("]");
            }
            builder.append(System.lineSeparator());
        }
        builder.append("실행 지시:").append(System.lineSeparator())
                .append(firstNonBlank(safe(ticket.getInstruction()), "선택된 컨텍스트를 기준으로 실제 수정 범위를 정밀하게 판별하고 필요한 파일만 변경합니다."));
        return builder.toString().trim();
    }

    private String buildStackCommandPrompt(SrTicketRecordVO ticket, List<SrWorkbenchStackItemVO> stackItems) {
        StringBuilder builder = new StringBuilder();
        builder.append("Carbonet SR ticket").append(System.lineSeparator());
        builder.append("pageId=").append(safe(ticket.getPageId())).append(System.lineSeparator());
        builder.append("page=").append(safe(ticket.getPageLabel())).append(System.lineSeparator());
        builder.append("route=").append(safe(ticket.getRoutePath())).append(System.lineSeparator());
        builder.append("menuCode=").append(safe(ticket.getMenuCode())).append(System.lineSeparator());
        builder.append("summary=").append(safe(ticket.getSummary())).append(System.lineSeparator());
        builder.append("stackCount=").append(stackItems.size()).append(System.lineSeparator());
        builder.append("direction=").append(System.lineSeparator());
        builder.append(buildStackDirection(ticket, stackItems));
        return builder.toString().trim();
    }

    private String buildStackTechnicalContext(List<SrWorkbenchStackItemVO> stackItems) {
        StringBuilder builder = new StringBuilder();
        int index = 1;
        for (SrWorkbenchStackItemVO item : stackItems) {
            String technicalContext = safe(item.getTechnicalContext());
            if (technicalContext.isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(System.lineSeparator()).append(System.lineSeparator());
            }
            builder.append("[Context ").append(index++).append("]").append(System.lineSeparator())
                    .append(technicalContext);
        }
        return builder.toString().trim();
    }

    private String buildDefaultStackSummary(SrWorkbenchStackItemVO item) {
        return joinNonBlank(" / ",
                firstNonBlank(safe(item.getPageLabel()), safe(item.getPageId())),
                firstNonBlank(safe(item.getSurfaceLabel()), safe(item.getSurfaceId())),
                firstNonBlank(safe(item.getEventLabel()), safe(item.getEventId())));
    }

    private Set<String> extractStackItemIds(List<SrWorkbenchStackItemVO> stackItems) {
        Set<String> ids = new LinkedHashSet<>();
        for (SrWorkbenchStackItemVO item : stackItems) {
            String stackItemId = safe(item.getStackItemId());
            if (!stackItemId.isEmpty()) {
                ids.add(stackItemId);
            }
        }
        return ids;
    }

    private int removeStackItemsById(Set<String> stackItemIds) throws Exception {
        if (stackItemIds == null || stackItemIds.isEmpty()) {
            return 0;
        }
        List<SrWorkbenchStackItemVO> current = readStackItems();
        List<SrWorkbenchStackItemVO> filtered = new ArrayList<>();
        int removed = 0;
        for (SrWorkbenchStackItemVO item : current) {
            if (stackItemIds.contains(safe(item.getStackItemId()))) {
                removed++;
                continue;
            }
            filtered.add(item);
        }
        if (removed > 0) {
            saveStackItems(filtered);
        }
        return removed;
    }

    private String extractTicketId(Map<String, Object> response) {
        if (response == null) {
            return "";
        }
        Object ticket = response.get("ticket");
        if (ticket instanceof Map) {
            Object ticketId = ((Map<?, ?>) ticket).get("ticketId");
            return ticketId == null ? "" : ticketId.toString().trim();
        }
        return "";
    }

    private void dispatchQueuedTickets() throws Exception {
        synchronized (laneMonitor) {
            if (laneExecutor == null) {
                initializeLaneExecutor();
            }
            List<SrTicketRecordVO> tickets = readTickets();
            tickets.sort(Comparator.comparing(SrTicketRecordVO::getQueueSubmittedAt, Comparator.nullsLast(String::compareTo)));
            for (SrTicketRecordVO ticket : tickets) {
                if (!"QUEUED".equalsIgnoreCase(safe(ticket.getQueueStatus()))) {
                    continue;
                }
                if (hasActiveExecutionConflict(ticket, tickets)) {
                    ticket.setQueueErrorMessage("동일 화면/메뉴 경로 작업이 실행 중이어서 대기 중입니다.");
                    saveTickets(readTicketsReplacing(ticket));
                    continue;
                }
                String freeLaneId = findFreeLaneId();
                if (freeLaneId.isEmpty()) {
                    break;
                }
                activeLaneTickets.put(freeLaneId, safe(ticket.getTicketId()));
                ticket.setQueueStatus("RUNNING");
                ticket.setQueueStartedAt(now());
                ticket.setQueueLaneId(freeLaneId);
                ticket.setQueueTmuxSessionName(buildLaneSessionName(freeLaneId));
                ticket.setQueueErrorMessage("");
                ticket.setExecutionComment("병렬 lane " + freeLaneId + "에서 실행을 시작했습니다.");
                saveTickets(readTicketsReplacing(ticket));
                announceLaneTicket(freeLaneId, ticket);
                final String queuedTicketId = safe(ticket.getTicketId());
                final String queuedActorId = defaultActor(ticket.getQueueRequestedBy());
                final String laneId = freeLaneId;
                laneExecutor.submit(new Runnable() {
                    @Override
                    public void run() {
                        processQueuedDirectExecute(queuedTicketId, queuedActorId, laneId);
                    }
                });
            }
        }
    }

    private void processQueuedDirectExecute(String ticketId, String actorId, String laneId) {
        try {
            directExecuteTicket(ticketId, actorId, null);
            updateQueueCompletion(ticketId, "COMPLETED", "");
        } catch (Exception e) {
            log.error("Queued SR ticket execution failed. ticketId={} laneId={}", ticketId, laneId, e);
            try {
                updateQueueCompletion(ticketId, "FAILED", safe(e.getMessage()));
            } catch (Exception updateError) {
                log.error("Failed to update queued SR ticket failure state. ticketId={}", ticketId, updateError);
            }
        } finally {
            synchronized (laneMonitor) {
                activeLaneTickets.put(laneId, "");
            }
            try {
                dispatchQueuedTickets();
            } catch (Exception e) {
                log.error("Failed to dispatch next queued SR ticket.", e);
            }
        }
    }

    private void updateQueueCompletion(String ticketId, String status, String errorMessage) throws Exception {
        SrTicketRecordVO ticket = findTicket(ticketId);
        if (ticket == null) {
            return;
        }
        String now = now();
        ticket.setUpdatedAt(now);
        ticket.setQueueStatus(status);
        ticket.setQueueCompletedAt(now);
        ticket.setQueueErrorMessage(safe(errorMessage));
        if (!"RUNNING".equalsIgnoreCase(status)) {
            ticket.setQueueLaneId(safe(ticket.getQueueLaneId()));
            ticket.setQueueTmuxSessionName(safe(ticket.getQueueTmuxSessionName()));
        }
        if (!safe(errorMessage).isEmpty()) {
            ticket.setExecutionComment(errorMessage);
        }
        saveTickets(readTicketsReplacing(ticket));
    }

    private String findFreeLaneId() {
        for (Map.Entry<String, String> entry : activeLaneTickets.entrySet()) {
            if (safe(entry.getValue()).isEmpty()) {
                return entry.getKey();
            }
        }
        return "";
    }

    private List<Map<String, Object>> buildExecutionLaneRows() {
        List<Map<String, Object>> rows = new ArrayList<Map<String, Object>>();
        synchronized (laneMonitor) {
            for (Map.Entry<String, String> entry : activeLaneTickets.entrySet()) {
                rows.add(orderedMap(
                        "laneId", entry.getKey(),
                        "tmuxSessionName", buildLaneSessionName(entry.getKey()),
                        "activeTicketId", safe(entry.getValue()),
                        "status", safe(entry.getValue()).isEmpty() ? "IDLE" : "RUNNING"));
            }
        }
        return rows;
    }

    private String buildLaneSessionName(String laneId) {
        return "codex-" + safe(laneId).toLowerCase(Locale.ROOT);
    }

    private String formatLaneId(int laneNumber) {
        return String.format(Locale.ROOT, "LANE-%02d", laneNumber);
    }

    private boolean hasActiveExecutionConflict(SrTicketRecordVO candidate, List<SrTicketRecordVO> tickets) {
        String candidateKey = buildExecutionConflictKey(candidate);
        if (candidateKey.isEmpty()) {
            return false;
        }
        for (SrTicketRecordVO ticket : tickets) {
            if (ticket == null) {
                continue;
            }
            if (safe(ticket.getTicketId()).equalsIgnoreCase(safe(candidate.getTicketId()))) {
                continue;
            }
            if (!"RUNNING".equalsIgnoreCase(safe(ticket.getQueueStatus()))) {
                continue;
            }
            if (candidateKey.equals(buildExecutionConflictKey(ticket))) {
                return true;
            }
        }
        return false;
    }

    private String buildExecutionConflictKey(SrTicketRecordVO ticket) {
        return firstNonBlank(
                safe(ticket == null ? null : ticket.getRoutePath()),
                safe(ticket == null ? null : ticket.getMenuCode()),
                safe(ticket == null ? null : ticket.getPageId())).toUpperCase(Locale.ROOT);
    }

    private void ensureTmuxLaneSession(String laneId) {
        String sessionName = buildLaneSessionName(laneId);
        String idleMessage = "Codex lane " + laneId + " is idle.";
        try {
            if (!runCommandAllowFailure(resolveRepositoryRoot(), "tmux", "has-session", "-t", sessionName)) {
                runCommand(resolveRepositoryRoot(), "tmux", "new-session", "-d", "-s", sessionName,
                        "-c", resolveRepositoryRoot().toString(), "bash", "-lc",
                        "printf '%s\\n' " + shellQuote(idleMessage) + "; exec bash");
            }
        } catch (Exception e) {
            log.warn("Failed to ensure tmux lane session. laneId={}", laneId, e);
        }
    }

    private void announceLaneTicket(String laneId, SrTicketRecordVO ticket) {
        String sessionName = buildLaneSessionName(laneId);
        String message = "["
                + now()
                + "] "
                + safe(ticket.getTicketId())
                + " "
                + firstNonBlank(safe(ticket.getSummary()), safe(ticket.getPageLabel()), "-")
                + " route="
                + firstNonBlank(safe(ticket.getRoutePath()), safe(ticket.getMenuCode()), safe(ticket.getPageId()), "-");
        try {
            runCommand(resolveRepositoryRoot(), "tmux", "send-keys", "-t", sessionName, "C-c", "Enter");
            runCommand(resolveRepositoryRoot(), "tmux", "send-keys", "-t", sessionName,
                    "clear && echo " + shellQuote(message) + " && echo " + shellQuote("lane=" + laneId) + " && exec bash",
                    "Enter");
        } catch (Exception e) {
            log.warn("Failed to announce tmux lane ticket. laneId={} ticketId={}", laneId, safe(ticket.getTicketId()), e);
        }
    }

    private void runCommand(Path workdir, String... command) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workdir.toFile());
        builder.redirectErrorStream(true);
        Process process = builder.start();
        try (InputStream inputStream = process.getInputStream()) {
            byte[] buffer = new byte[1024];
            while (inputStream.read(buffer) >= 0) {
                // drain
            }
        }
        if (!process.waitFor(30, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Shell command timeout");
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException("Shell command failed. exit=" + process.exitValue());
        }
    }

    private boolean runCommandAllowFailure(Path workdir, String... command) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workdir.toFile());
        builder.redirectErrorStream(true);
        Process process = builder.start();
        try (InputStream inputStream = process.getInputStream()) {
            byte[] buffer = new byte[1024];
            while (inputStream.read(buffer) >= 0) {
                // drain
            }
        }
        if (!process.waitFor(15, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            return false;
        }
        return process.exitValue() == 0;
    }

    private String shellQuote(String value) {
        return "'" + safe(value).replace("'", "'\"'\"'") + "'";
    }

    private SrTicketRecordVO findTicket(String ticketId) throws Exception {
        for (SrTicketRecordVO ticket : readTickets()) {
            if (safe(ticket.getTicketId()).equalsIgnoreCase(safe(ticketId))) {
                return ticket;
            }
        }
        return null;
    }

    private void appendTicket(SrTicketRecordVO ticket) throws Exception {
        fileLock.lock();
        try {
            Path file = resolveTicketFile();
            Files.createDirectories(file.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND)) {
                writer.write(objectMapper.writeValueAsString(ticket));
                writer.newLine();
            }
        } finally {
            fileLock.unlock();
        }
    }

    private void appendStackItem(SrWorkbenchStackItemVO item) throws Exception {
        fileLock.lock();
        try {
            Path file = resolveStackFile();
            Files.createDirectories(file.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND)) {
                writer.write(objectMapper.writeValueAsString(item));
                writer.newLine();
            }
        } finally {
            fileLock.unlock();
        }
    }

    private List<SrTicketRecordVO> readTickets() throws Exception {
        fileLock.lock();
        try {
            Path file = resolveTicketFile();
            if (!Files.exists(file)) {
                return new ArrayList<>();
            }
            List<SrTicketRecordVO> items = new ArrayList<>();
            try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = safe(line);
                    if (trimmed.isEmpty()) {
                        continue;
                    }
                    try {
                        items.add(objectMapper.readValue(trimmed, SrTicketRecordVO.class));
                    } catch (Exception e) {
                        log.warn("Failed to parse SR ticket row.", e);
                    }
                }
            }
            return items;
        } finally {
            fileLock.unlock();
        }
    }

    private List<SrWorkbenchStackItemVO> readStackItems() throws Exception {
        fileLock.lock();
        try {
            Path file = resolveStackFile();
            if (!Files.exists(file)) {
                return new ArrayList<>();
            }
            List<SrWorkbenchStackItemVO> items = new ArrayList<>();
            try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String trimmed = safe(line);
                    if (trimmed.isEmpty()) {
                        continue;
                    }
                    try {
                        items.add(objectMapper.readValue(trimmed, SrWorkbenchStackItemVO.class));
                    } catch (Exception e) {
                        log.warn("Failed to parse SR workbench stack row.", e);
                    }
                }
            }
            return items;
        } finally {
            fileLock.unlock();
        }
    }

    private void saveTickets(List<SrTicketRecordVO> tickets) throws Exception {
        fileLock.lock();
        try {
            Path file = resolveTicketFile();
            Files.createDirectories(file.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING)) {
                for (SrTicketRecordVO ticket : tickets == null ? Collections.<SrTicketRecordVO>emptyList() : tickets) {
                    writer.write(objectMapper.writeValueAsString(ticket));
                    writer.newLine();
                }
            }
        } finally {
            fileLock.unlock();
        }
    }

    private void saveStackItems(List<SrWorkbenchStackItemVO> items) throws Exception {
        fileLock.lock();
        try {
            Path file = resolveStackFile();
            Files.createDirectories(file.getParent());
            try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING)) {
                for (SrWorkbenchStackItemVO item : items == null ? Collections.<SrWorkbenchStackItemVO>emptyList() : items) {
                    writer.write(objectMapper.writeValueAsString(item));
                    writer.newLine();
                }
            }
        } finally {
            fileLock.unlock();
        }
    }

    private Path resolveTicketFile() {
        String resolved = safe(srTicketFilePath);
        if (resolved.isEmpty()) {
            resolved = "/tmp/carbonet-sr-tickets.jsonl";
        }
        return Paths.get(resolved);
    }

    private Path resolveStackFile() {
        String resolved = safe(srWorkbenchStackFilePath);
        if (resolved.isEmpty()) {
            resolved = "/tmp/carbonet-sr-workbench-stack.jsonl";
        }
        return Paths.get(resolved);
    }

    private String defaultActor(String actorId) {
        return safe(actorId).isEmpty() ? "SYSTEM" : safe(actorId);
    }

    private String now() {
        return LocalDateTime.now().format(TS_FORMAT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class StreamCollector implements Runnable {
        private final InputStream source;
        private final Path destination;

        private StreamCollector(InputStream source, Path destination) {
            this.source = source;
            this.destination = destination;
        }

        @Override
        public void run() {
            try (InputStream input = source;
                 BufferedWriter writer = Files.newBufferedWriter(destination, StandardCharsets.UTF_8,
                         java.nio.file.StandardOpenOption.CREATE,
                         java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                         java.nio.file.StandardOpenOption.WRITE)) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    writer.write(new String(buffer, 0, read, StandardCharsets.UTF_8));
                    writer.flush();
                }
            } catch (Exception ignored) {
                // Rollback log collection is best-effort.
            }
        }
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

    private Map<String, Object> successResponse(String message, Object... fields) {
        Map<String, Object> response = orderedMap("success", true);
        if (fields != null) {
            for (int index = 0; index + 1 < fields.length; index += 2) {
                response.put(String.valueOf(fields[index]), fields[index + 1]);
            }
        }
        if (!safe(message).isEmpty()) {
            response.put("message", safe(message));
        }
        return response;
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> response = new LinkedHashMap<>();
        if (fields == null) {
            return response;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            response.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return response;
    }

    private String joinNonBlank(String separator, String... values) {
        StringBuilder builder = new StringBuilder();
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safe(value);
            if (normalized.isEmpty()) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(separator);
            }
            builder.append(normalized);
        }
        return builder.toString();
    }

    private static final class ArtifactDescriptor {

        private final String artifactType;
        private final String label;
        private final String path;
        private final String inlineContent;

        private ArtifactDescriptor(String artifactType, String label, String path) {
            this(artifactType, label, path, "");
        }

        private ArtifactDescriptor(String artifactType, String label, String path, String inlineContent) {
            this.artifactType = artifactType;
            this.label = label;
            this.path = path == null ? "" : path.trim();
            this.inlineContent = inlineContent == null ? "" : inlineContent.trim();
        }

        private static ArtifactDescriptor inline(String artifactType, String label, String inlineContent) {
            return new ArtifactDescriptor(artifactType, label, "", inlineContent);
        }

        private String getArtifactType() {
            return artifactType;
        }

        private String getLabel() {
            return label;
        }

        private String getPath() {
            return path;
        }

        private String getInlineContent() {
            return inlineContent;
        }
    }
}
// agent note: updated by FreeAgent Ultra
