package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.AdminBoardDistributionSaveRequestDTO;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminBoardDistributionService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String DEFAULT_DRAFT_ID = "BOARD_ADD_DEFAULT";

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "board-add", "drafts.json");
    private final AdminPostManagementService adminPostManagementService;
    private final AdminPagePayloadFactory adminPagePayloadFactory;

    public AdminBoardDistributionService(ObjectMapper objectMapper,
                                        AdminPostManagementService adminPostManagementService,
                                        AdminPagePayloadFactory adminPagePayloadFactory) {
        this.objectMapper = objectMapper;
        this.adminPostManagementService = adminPostManagementService;
        this.adminPagePayloadFactory = adminPagePayloadFactory;
    }

    public synchronized Map<String, Object> buildPagePayload(boolean isEn) {
        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> draft = mergeDraft(entries.get(DEFAULT_DRAFT_ID));

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040103");
        payload.put("draftId", DEFAULT_DRAFT_ID);
        payload.put("draftDetail", localizeDraft(draft, isEn));
        payload.put("summaryCards", buildSummaryCards(draft, isEn));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized Map<String, Object> buildListPayload(boolean isEn) {
        Map<String, Map<String, Object>> entries = loadAll();
        List<Map<String, Object>> boardRows = new ArrayList<>();
        for (Map<String, Object> stored : entries.values()) {
            boardRows.add(toListRow(mergeDraft(stored), isEn));
        }
        if (boardRows.isEmpty()) {
            boardRows.add(toListRow(defaultDraft(), isEn));
        }

        Map<String, Object> selectedBoard = boardRows.get(0);
        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040102");
        payload.put("boardRows", boardRows);
        payload.put("selectedBoard", selectedBoard);
        payload.put("summaryCards", buildListSummaryCards(boardRows, isEn));
        payload.put("boardTypeOptions", buildBoardTypeOptions(isEn));
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized Map<String, Object> saveDraft(AdminBoardDistributionSaveRequestDTO request,
                                                      String actorId,
                                                      boolean isEn) {
        if (request == null) {
            throw new IllegalArgumentException("request is required.");
        }
        String title = safe(request.getTitle());
        String summary = safe(request.getSummary());
        String body = safe(request.getBody());
        List<String> channels = normalizeChannels(request.getChannels());

        if (title.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Notice title is required." : "공지 제목은 필수입니다.");
        }
        if (summary.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Summary is required." : "요약 문구는 필수입니다.");
        }
        if (body.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Notice body is required." : "공지 본문은 필수입니다.");
        }
        if (channels.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Select at least one delivery channel." : "최소 한 개 이상의 배포 채널을 선택하세요.");
        }

        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> row = mergeDraft(entries.get(DEFAULT_DRAFT_ID));
        row.put("draftId", DEFAULT_DRAFT_ID);
        row.put("boardType", normalizeBoardType(request.getBoardType()));
        row.put("audience", normalizeAudience(request.getAudience()));
        row.put("titleKo", title);
        row.put("titleEn", title);
        row.put("summaryKo", summary);
        row.put("summaryEn", summary);
        row.put("bodyKo", body);
        row.put("bodyEn", body);
        row.put("publishAt", firstNonBlank(safe(request.getPublishAt()), safe(row.get("publishAt"))));
        row.put("expireAt", firstNonBlank(safe(request.getExpireAt()), safe(row.get("expireAt"))));
        row.put("channels", channels);
        row.put("tags", normalizeTags(request.getTags()));
        row.put("pinned", String.valueOf(Boolean.TRUE.equals(request.getPinned())));
        row.put("urgent", String.valueOf(Boolean.TRUE.equals(request.getUrgent())));
        row.put("allowComments", String.valueOf(Boolean.TRUE.equals(request.getAllowComments())));
        row.put("lastSavedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("lastSavedBy", firstNonBlank(actorId, "system"));
        row.put("linkedPostId", firstNonBlank(safe(row.get("linkedPostId")), "POST_BOARD_ADD_001"));

        entries.put(DEFAULT_DRAFT_ID, row);
        saveAll(entries);
        adminPostManagementService.upsertManagedNoticeFromBoardDraft(row, actorId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("draftId", DEFAULT_DRAFT_ID);
        response.put("message", isEn ? "Notice distribution draft saved." : "공지 배포 초안을 저장했습니다.");
        response.put("draftDetail", localizeDraft(row, isEn));
        return response;
    }

    private Map<String, Object> mergeDraft(Map<String, Object> stored) {
        Map<String, Object> row = defaultDraft();
        if (stored != null) {
            row.putAll(stored);
        }
        row.put("draftId", DEFAULT_DRAFT_ID);
        row.put("channels", normalizeChannels(asStringList(row.get("channels"))));
        row.put("tags", normalizeTags(asStringList(row.get("tags"))));
        return row;
    }

    private Map<String, Object> defaultDraft() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("draftId", DEFAULT_DRAFT_ID);
        row.put("boardType", "NOTICE");
        row.put("audience", "ALL");
        row.put("titleKo", "4월 정기 점검 및 운영 공지");
        row.put("titleEn", "April maintenance and operations notice");
        row.put("summaryKo", "정기 점검 시간, 영향 범위, 긴급 문의 채널을 함께 안내합니다.");
        row.put("summaryEn", "Announce maintenance timing, impact scope, and urgent contact channels.");
        row.put("bodyKo", "정기 점검 전 시스템 접속 제한 시간과 정책 변경 사항을 공지합니다.\n운영 담당자는 점검 전 체크리스트를 함께 확인해 주세요.");
        row.put("bodyEn", "Announce maintenance access limits and policy updates before the scheduled window.\nOperators should review the checklist before release.");
        row.put("publishAt", "2026-04-01T09:00");
        row.put("expireAt", "2026-04-08T18:00");
        row.put("channels", new ArrayList<>(Arrays.asList("PORTAL", "EMAIL")));
        row.put("tags", new ArrayList<>(Arrays.asList("점검", "정책안내")));
        row.put("pinned", "true");
        row.put("urgent", "false");
        row.put("allowComments", "false");
        row.put("linkedPostId", "POST_BOARD_ADD_001");
        row.put("lastSavedAt", "2026-03-31 09:20");
        row.put("lastSavedBy", "content_ops");
        return row;
    }

    private Map<String, Object> localizeDraft(Map<String, Object> source, boolean isEn) {
        Map<String, Object> row = new LinkedHashMap<>(source);
        row.put("title", isEn ? safe(source.get("titleEn")) : safe(source.get("titleKo")));
        row.put("summary", isEn ? safe(source.get("summaryEn")) : safe(source.get("summaryKo")));
        row.put("body", isEn ? safe(source.get("bodyEn")) : safe(source.get("bodyKo")));
        row.put("audienceLabel", audienceLabel(safe(source.get("audience")), isEn));
        row.put("boardTypeLabel", boardTypeLabel(safe(source.get("boardType")), isEn));
        row.put("channelLabels", channelLabels(asStringList(source.get("channels")), isEn));
        row.put("recipientEstimate", String.valueOf(recipientEstimate(safe(source.get("audience")), parseBoolean(source.get("urgent")))));
        return row;
    }

    private Map<String, Object> toListRow(Map<String, Object> source, boolean isEn) {
        Map<String, Object> row = localizeDraft(source, isEn);
        row.put("id", safe(source.get("draftId")));
        row.put("status", parseBoolean(source.get("urgent")) ? "URGENT" : "READY");
        row.put("statusLabel", isEn
                ? (parseBoolean(source.get("urgent")) ? "Urgent" : "Ready")
                : (parseBoolean(source.get("urgent")) ? "긴급" : "준비"));
        row.put("channelCount", String.valueOf(asStringList(source.get("channels")).size()));
        row.put("tagCount", String.valueOf(asStringList(source.get("tags")).size()));
        row.put("lastSavedAt", safe(source.get("lastSavedAt")));
        row.put("lastSavedBy", safe(source.get("lastSavedBy")));
        return row;
    }

    private List<Map<String, String>> buildSummaryCards(Map<String, Object> draft, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(
                isEn ? "Recipient Estimate" : "예상 수신자",
                String.valueOf(recipientEstimate(safe(draft.get("audience")), parseBoolean(draft.get("urgent")))),
                isEn ? "Audience and urgency based estimate." : "대상과 긴급도 기준 추정치입니다."));
        rows.add(summaryCard(
                isEn ? "Channels" : "배포 채널",
                String.valueOf(asStringList(draft.get("channels")).size()),
                String.join(", ", channelLabels(asStringList(draft.get("channels")), isEn))));
        rows.add(summaryCard(
                isEn ? "Pinned Exposure" : "상단 고정",
                parseBoolean(draft.get("pinned")) ? (isEn ? "Enabled" : "사용") : (isEn ? "Disabled" : "미사용"),
                isEn ? "Controls top-area exposure on board list." : "게시판 목록 상단 노출 여부입니다."));
        rows.add(summaryCard(
                isEn ? "Comment Policy" : "댓글 정책",
                parseBoolean(draft.get("allowComments")) ? (isEn ? "Open" : "허용") : (isEn ? "Closed" : "차단"),
                isEn ? "Member reply policy after publish." : "배포 후 사용자 댓글 정책입니다."));
        return rows;
    }

    private List<Map<String, String>> buildListSummaryCards(List<Map<String, Object>> boardRows, boolean isEn) {
        int urgentCount = 0;
        int pinnedCount = 0;
        int portalCount = 0;
        for (Map<String, Object> row : boardRows) {
            if (parseBoolean(row.get("urgent"))) {
                urgentCount++;
            }
            if (parseBoolean(row.get("pinned"))) {
                pinnedCount++;
            }
            if (asStringList(row.get("channels")).contains("PORTAL")) {
                portalCount++;
            }
        }

        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(
                isEn ? "Draft Rows" : "배포 초안",
                String.valueOf(boardRows.size()),
                isEn ? "Notice drafts currently visible in board management." : "현재 게시판 관리에서 확인 가능한 공지 초안 수입니다."));
        rows.add(summaryCard(
                isEn ? "Urgent Queue" : "긴급 큐",
                String.valueOf(urgentCount),
                isEn ? "Urgent notices require narrower operator review before publish." : "긴급 공지는 배포 전에 운영 검토 범위를 더 엄격히 확인해야 합니다."));
        rows.add(summaryCard(
                isEn ? "Pinned Exposure" : "상단 고정",
                String.valueOf(pinnedCount),
                isEn ? "Pinned notices occupy the top board area." : "상단 고정 공지는 게시판 최상단 노출 영역을 사용합니다."));
        rows.add(summaryCard(
                isEn ? "Portal Visible" : "포털 노출",
                String.valueOf(portalCount),
                isEn ? "Drafts configured for portal exposure." : "포털 공지 노출이 설정된 초안 수입니다."));
        return rows;
    }

    private List<Map<String, String>> buildBoardTypeOptions(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(optionRow("", isEn ? "All Types" : "전체 유형"));
        rows.add(optionRow("NOTICE", isEn ? "General Notice" : "일반 공지"));
        rows.add(optionRow("POLICY", isEn ? "Policy Update" : "정책 안내"));
        rows.add(optionRow("MAINTENANCE", isEn ? "Maintenance Alert" : "점검 공지"));
        return rows;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(noteRow(
                isEn ? "Align notice type with target surface." : "공지 유형과 노출면을 맞춤",
                isEn ? "Policy and maintenance notices should remain explicit because they drive pinned exposure and operator review."
                        : "정책/점검 공지는 상단 고정과 운영 검토에 직접 연결되므로 유형을 명확히 유지해야 합니다."));
        rows.add(noteRow(
                isEn ? "Do not over-expand urgent delivery." : "긴급 배포는 과도하게 확장하지 않음",
                isEn ? "Urgent mode widens recipient count and should be reserved for real incidents or service-impact announcements."
                        : "긴급 모드는 수신 대상을 넓히므로 실제 장애나 서비스 영향 공지에만 사용해야 합니다."));
        return rows;
    }

    private int recipientEstimate(String audience, boolean urgent) {
        int base;
        if ("OPERATORS".equalsIgnoreCase(audience)) {
            base = 46;
        } else if ("COMPANIES".equalsIgnoreCase(audience)) {
            base = 612;
        } else if ("MEMBERS".equalsIgnoreCase(audience)) {
            base = 2183;
        } else {
            base = 2841;
        }
        return urgent ? base + Math.round(base * 0.08f) : base;
    }

    private List<String> normalizeChannels(List<String> values) {
        List<String> rows = new ArrayList<>();
        List<String> source = values == null ? new ArrayList<String>() : values;
        for (String value : source) {
            String normalized = safe(value).toUpperCase(Locale.ROOT);
            if (!"PORTAL".equals(normalized) && !"EMAIL".equals(normalized) && !"PUSH".equals(normalized)) {
                continue;
            }
            if (!rows.contains(normalized)) {
                rows.add(normalized);
            }
        }
        return rows;
    }

    private List<String> normalizeTags(List<String> values) {
        List<String> rows = new ArrayList<>();
        List<String> source = values == null ? new ArrayList<String>() : values;
        for (String value : source) {
            String normalized = safe(value);
            if (normalized.isEmpty() || rows.contains(normalized)) {
                continue;
            }
            rows.add(normalized);
        }
        return rows;
    }

    private List<String> channelLabels(List<String> channels, boolean isEn) {
        List<String> rows = new ArrayList<>();
        for (String channel : channels) {
            if ("PORTAL".equalsIgnoreCase(channel)) {
                rows.add(isEn ? "Portal Notice" : "포털 공지");
            } else if ("EMAIL".equalsIgnoreCase(channel)) {
                rows.add(isEn ? "Email Delivery" : "이메일 발송");
            } else if ("PUSH".equalsIgnoreCase(channel)) {
                rows.add(isEn ? "Operator Push" : "운영 푸시");
            }
        }
        return rows;
    }

    private String boardTypeLabel(String boardType, boolean isEn) {
        String normalized = safe(boardType).toUpperCase(Locale.ROOT);
        if ("POLICY".equals(normalized)) {
            return isEn ? "Policy Update" : "정책 안내";
        }
        if ("MAINTENANCE".equals(normalized)) {
            return isEn ? "Maintenance Alert" : "점검 공지";
        }
        return isEn ? "General Notice" : "일반 공지";
    }

    private String audienceLabel(String audience, boolean isEn) {
        String normalized = safe(audience).toUpperCase(Locale.ROOT);
        if ("OPERATORS".equals(normalized)) {
            return isEn ? "Operators" : "운영 관리자";
        }
        if ("COMPANIES".equals(normalized)) {
            return isEn ? "Company Managers" : "회원사 담당자";
        }
        if ("MEMBERS".equals(normalized)) {
            return isEn ? "General Members" : "일반 사용자";
        }
        return isEn ? "All Members" : "전체 회원";
    }

    private String normalizeBoardType(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("POLICY".equals(normalized) || "MAINTENANCE".equals(normalized)) {
            return normalized;
        }
        return "NOTICE";
    }

    private String normalizeAudience(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("OPERATORS".equals(normalized) || "COMPANIES".equals(normalized) || "MEMBERS".equals(normalized)) {
            return normalized;
        }
        return "ALL";
    }

    private boolean parseBoolean(Object value) {
        return "true".equalsIgnoreCase(safe(value)) || Boolean.TRUE.equals(value);
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> noteRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private Map<String, String> optionRow(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }

    private Map<String, Map<String, Object>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, Object>> data = objectMapper.readValue(inputStream, new TypeReference<Map<String, Map<String, Object>>>() {
            });
            return data == null ? new LinkedHashMap<>() : new LinkedHashMap<>(data);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read board draft registry", e);
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to write board draft registry", e);
        }
    }

    private List<String> asStringList(Object value) {
        if (!(value instanceof List<?>)) {
            return new ArrayList<>();
        }
        List<?> list = (List<?>) value;
        List<String> rows = new ArrayList<>();
        for (Object item : list) {
            String normalized = safe(item);
            if (!normalized.isEmpty()) {
                rows.add(normalized);
            }
        }
        return rows;
    }

    private String firstNonBlank(String primary, String fallback) {
        return safe(primary).isEmpty() ? safe(fallback) : safe(primary);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
