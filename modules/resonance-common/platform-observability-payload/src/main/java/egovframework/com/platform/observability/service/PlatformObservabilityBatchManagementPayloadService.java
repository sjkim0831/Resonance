package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.BatchManagementPagePayloadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityBatchManagementPayloadService implements BatchManagementPagePayloadPort {

    private final PlatformObservabilitySchedulerPayloadService schedulerPayloadService;

    @Override
    public Map<String, Object> buildBatchManagementPagePayload(boolean isEn) {
        Map<String, Object> schedulerPayload = schedulerPayloadService.buildSchedulerPagePayload("", "", isEn);
        List<Map<String, String>> batchJobRows = buildBatchJobRows(castStringRowList(schedulerPayload.get("schedulerJobRows")), isEn);
        List<Map<String, String>> batchNodeRows = buildBatchNodeRows(castStringRowList(schedulerPayload.get("schedulerNodeRows")), isEn);
        List<Map<String, String>> batchExecutionRows = castStringRowList(schedulerPayload.get("schedulerExecutionRows"));
        List<Map<String, String>> batchQueueRows = buildBatchQueueRows(isEn);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("refreshedAt", LocalDateTime.now().withSecond(0).withNano(0).toString().replace('T', ' '));
        payload.put("batchSummary", buildBatchSummary(batchJobRows, batchQueueRows, batchNodeRows, batchExecutionRows, isEn));
        payload.put("batchJobRows", batchJobRows);
        payload.put("batchQueueRows", batchQueueRows);
        payload.put("batchNodeRows", batchNodeRows);
        payload.put("batchExecutionRows", batchExecutionRows);
        payload.put("batchRunbooks", buildBatchRunbooks(isEn));
        payload.put("isEn", isEn);
        return payload;
    }

    private List<Map<String, String>> buildBatchSummary(List<Map<String, String>> jobRows,
                                                        List<Map<String, String>> queueRows,
                                                        List<Map<String, String>> nodeRows,
                                                        List<Map<String, String>> executionRows,
                                                        boolean isEn) {
        int activeJobs = 0;
        for (Map<String, String> row : jobRows) {
            if ("ACTIVE".equalsIgnoreCase(safeString(row.get("jobStatus")))) {
                activeJobs++;
            }
        }

        int backlogCount = 0;
        for (Map<String, String> row : queueRows) {
            backlogCount += parsePositiveInt(row.get("backlogCount"), 0);
        }

        int healthyNodes = 0;
        for (Map<String, String> row : nodeRows) {
            String status = safeString(row.get("status")).toUpperCase(Locale.ROOT);
            if ("HEALTHY".equals(status) || "STANDBY".equals(status)) {
                healthyNodes++;
            }
        }

        int failedExecutions = 0;
        for (Map<String, String> row : executionRows) {
            String result = safeString(row.get("result")).toUpperCase(Locale.ROOT);
            if ("FAILED".equals(result) || "REVIEW".equals(result)) {
                failedExecutions++;
            }
        }

        List<Map<String, String>> summary = new ArrayList<>();
        summary.add(summaryCard(isEn ? "Active Jobs" : "활성 잡", String.valueOf(activeJobs),
                isEn ? "Jobs currently enabled for scheduled or manual execution." : "정기 또는 수동 실행 대상으로 활성화된 잡 수입니다."));
        summary.add(summaryCard(isEn ? "Queue Backlog" : "큐 적체", String.valueOf(backlogCount),
                isEn ? "Pending batch messages that still need to be consumed." : "아직 소비되지 않은 배치 대기 메시지 수입니다."));
        summary.add(summaryCard(isEn ? "Healthy Nodes" : "정상 노드", String.valueOf(healthyNodes),
                isEn ? "Worker nodes that can safely accept new workloads." : "새 작업을 안전하게 받을 수 있는 워커 노드 수입니다."));
        summary.add(summaryCard(isEn ? "Failed / Review Runs" : "실패/재검토 실행", String.valueOf(failedExecutions),
                isEn ? "Recent batch runs that require follow-up." : "후속 조치가 필요한 최근 배치 실행 건수입니다."));
        return summary;
    }

    private List<Map<String, String>> buildBatchJobRows(List<Map<String, String>> schedulerRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> row : schedulerRows) {
            Map<String, String> batchRow = new LinkedHashMap<>(row);
            batchRow.put("queueName", resolveBatchQueueName(safeString(row.get("jobId")), isEn));
            batchRow.put("note", resolveBatchJobNote(safeString(row.get("jobId")), isEn));
            rows.add(batchRow);
        }
        return rows;
    }

    private List<Map<String, String>> buildBatchNodeRows(List<Map<String, String>> schedulerRows, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (Map<String, String> row : schedulerRows) {
            Map<String, String> nodeRow = new LinkedHashMap<>(row);
            nodeRow.put("affinity", resolveBatchNodeAffinity(safeString(row.get("nodeId")), isEn));
            rows.add(nodeRow);
        }
        return rows;
    }

    private List<Map<String, String>> buildBatchQueueRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(batchQueueRow("Q-SETTLEMENT", isEn ? "Settlement aggregation queue" : "정산 집계 큐", "124", "batch-node-01", "2026-03-13 11:46", "WARN"));
        rows.add(batchQueueRow("Q-CERT", isEn ? "Certificate sync queue" : "인증서 동기화 큐", "8", "batch-node-02", "2026-03-13 11:44", "HEALTHY"));
        rows.add(batchQueueRow("Q-TOKEN", isEn ? "External token refresh queue" : "외부 토큰 갱신 큐", "17", "batch-node-03", "2026-03-13 11:41", "DEGRADED"));
        rows.add(batchQueueRow("Q-BACKFILL", isEn ? "Manual backfill queue" : "수동 보정 큐", "3", "batch-node-03", "2026-03-12 18:10", "REVIEW"));
        return rows;
    }

    private Map<String, String> batchQueueRow(String queueId,
                                              String queueName,
                                              String backlogCount,
                                              String consumerNode,
                                              String lastMessageAt,
                                              String status) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("queueId", queueId);
        row.put("queueName", queueName);
        row.put("backlogCount", backlogCount);
        row.put("consumerNode", consumerNode);
        row.put("lastMessageAt", lastMessageAt);
        row.put("status", status);
        return row;
    }

    private List<Map<String, String>> buildBatchRunbooks(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(runbookRow(
                isEn ? "Backlog spike response" : "적체 급증 대응",
                isEn ? "Check queue owner, replay guard, and downstream DB pressure before forcing a consumer scale-up."
                        : "소비 노드, 재처리 가드, 하위 DB 부하를 먼저 확인한 뒤 소비자를 증설합니다."));
        rows.add(runbookRow(
                isEn ? "Manual rerun guardrail" : "수동 재실행 가드레일",
                isEn ? "Leave an execution reason and a rollback owner before rerunning settlement or token jobs manually."
                        : "정산/토큰 잡을 수동 재실행할 때는 실행 사유와 롤백 담당자를 먼저 남깁니다."));
        rows.add(runbookRow(
                isEn ? "Node degradation triage" : "노드 성능 저하 점검",
                isEn ? "Move heavy queues away from degraded nodes first, then inspect heartbeat lag and JVM pressure."
                        : "성능 저하 노드에서는 무거운 큐를 먼저 분리하고 heartbeat 지연과 JVM 압박을 점검합니다."));
        return rows;
    }

    private Map<String, String> runbookRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private String resolveBatchQueueName(String jobId, boolean isEn) {
        switch (safeString(jobId).toUpperCase(Locale.ROOT)) {
            case "SCH-001":
                return isEn ? "Settlement aggregation queue" : "정산 집계 큐";
            case "SCH-002":
                return isEn ? "Certificate sync queue" : "인증서 동기화 큐";
            case "SCH-003":
                return isEn ? "External token refresh queue" : "외부 토큰 갱신 큐";
            case "SCH-004":
                return isEn ? "Manual backfill queue" : "수동 보정 큐";
            default:
                return isEn ? "General batch queue" : "일반 배치 큐";
        }
    }

    private String resolveBatchJobNote(String jobId, boolean isEn) {
        switch (safeString(jobId).toUpperCase(Locale.ROOT)) {
            case "SCH-001":
                return isEn ? "High-volume settlement aggregation job." : "대용량 정산 집계 잡입니다.";
            case "SCH-002":
                return isEn ? "Certificate cache and expiry synchronization." : "인증서 캐시 및 만료 동기화 작업입니다.";
            case "SCH-003":
                return isEn ? "Integration token refresh with retry queue." : "재시도 큐를 가진 연계 토큰 갱신 작업입니다.";
            case "SCH-004":
                return isEn ? "Operator-approved manual correction flow." : "운영자 승인 후 수행하는 수동 보정 흐름입니다.";
            default:
                return "";
        }
    }

    private String resolveBatchNodeAffinity(String nodeId, boolean isEn) {
        switch (safeString(nodeId).toLowerCase(Locale.ROOT)) {
            case "batch-node-01":
                return isEn ? "Settlement / nightly aggregation" : "정산 / 야간 집계";
            case "batch-node-02":
                return isEn ? "Certificate / standby failover" : "인증서 / 대기 failover";
            case "batch-node-03":
                return isEn ? "Token refresh / manual backfill" : "토큰 갱신 / 수동 보정";
            default:
                return isEn ? "Shared batch queues" : "공용 배치 큐";
        }
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> castStringRowList(Object value) {
        if (!(value instanceof List<?>)) {
            return List.of();
        }
        List<Map<String, String>> rows = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (!(item instanceof Map<?, ?>)) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            ((Map<?, ?>) item).forEach((key, rawValue) -> row.put(safeString(key), safeString(rawValue)));
            rows.add(row);
        }
        return rows;
    }

    private int parsePositiveInt(String value, int defaultValue) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
