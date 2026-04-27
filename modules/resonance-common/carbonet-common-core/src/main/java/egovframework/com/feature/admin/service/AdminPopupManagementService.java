package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.admin.dto.request.AdminPopupEditSaveRequestDTO;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminPopupManagementService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ObjectMapper objectMapper;
    private final Path registryPath = Paths.get("data", "admin", "popup-edit", "popups.json");

    public AdminPopupManagementService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized Map<String, Object> buildEditPayload(String popupId, boolean isEn) {
        Map<String, Map<String, String>> catalog = mergeCatalog(loadAll());
        Map<String, String> selected = selectPopup(catalog, safe(popupId));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0040204");
        payload.put("popupId", safe(selected.get("popupId")));
        payload.put("popupDetail", localizePopup(selected, isEn));
        payload.put("summaryCards", buildSummaryCards(selected, isEn));
        payload.put("popupTypeOptions", buildOptions(isEn ? "Notice" : "공지형", "NOTICE", isEn ? "Event" : "이벤트형", "EVENT", isEn ? "Consent" : "동의형", "CONSENT"));
        payload.put("priorityOptions", buildOptions(isEn ? "High" : "높음", "HIGH", isEn ? "Normal" : "보통", "NORMAL", isEn ? "Low" : "낮음", "LOW"));
        payload.put("exposureStatusOptions", buildOptions(isEn ? "Scheduled" : "예약", "SCHEDULED", isEn ? "Active" : "노출중", "ACTIVE", isEn ? "Paused" : "일시중지", "PAUSED", isEn ? "Ended" : "종료", "ENDED"));
        payload.put("useAtOptions", buildOptions(isEn ? "Use" : "사용", "Y", isEn ? "Do not use" : "미사용", "N"));
        payload.put("targetAudienceOptions", buildOptions(isEn ? "Administrators" : "관리자", "ADMIN", isEn ? "Members" : "회원", "MEMBER", isEn ? "All" : "전체", "ALL"));
        payload.put("displayScopeOptions", buildOptions(isEn ? "All admin pages" : "전체 관리자 화면", "ALL_ADMIN", isEn ? "Content pages only" : "콘텐츠 화면만", "CONTENT_ONLY", isEn ? "First login only" : "최초 로그인만", "FIRST_LOGIN"));
        payload.put("closePolicyOptions", buildOptions(isEn ? "Hide for one day" : "하루 동안 보지 않기", "ONE_DAY", isEn ? "Hide for session" : "세션 동안 숨김", "SESSION", isEn ? "Must confirm" : "필수 확인", "REQUIRED"));
        return payload;
    }

    public synchronized Map<String, Object> buildListPayload(String searchKeyword,
                                                             String status,
                                                             String targetAudience,
                                                             String selectedPopupId,
                                                             boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedAudience = safe(targetAudience).toUpperCase(Locale.ROOT);

        Map<String, Map<String, String>> catalog = mergeCatalog(loadAll());
        List<Map<String, String>> localizedRows = new ArrayList<>();
        for (Map<String, String> row : catalog.values()) {
            Map<String, String> localized = localizeListRow(row, isEn);
            if (!matchesKeyword(localized, keyword)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(safe(localized.get("exposureStatus")))) {
                continue;
            }
            if (!normalizedAudience.isEmpty() && !normalizedAudience.equalsIgnoreCase(safe(localized.get("targetAudience")))) {
                continue;
            }
            localizedRows.add(localized);
        }

        Map<String, String> selected = selectListPopup(localizedRows, catalog, safe(selectedPopupId), isEn);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", "A0040203");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("targetAudience", safe(targetAudience));
        payload.put("summaryCards", buildListSummaryCards(catalog, localizedRows, isEn));
        payload.put("statusOptions", buildOptions(
                isEn ? "All" : "전체", "",
                isEn ? "Scheduled" : "예약", "SCHEDULED",
                isEn ? "Active" : "노출중", "ACTIVE",
                isEn ? "Paused" : "일시중지", "PAUSED",
                isEn ? "Ended" : "종료", "ENDED"));
        payload.put("targetAudienceOptions", buildOptions(
                isEn ? "All" : "전체", "",
                isEn ? "Administrators" : "관리자", "ADMIN",
                isEn ? "Members" : "회원", "MEMBER",
                isEn ? "All users" : "전체 사용자", "ALL"));
        payload.put("popupRows", localizedRows);
        payload.put("selectedPopup", selected);
        payload.put("governanceNotes", buildGovernanceNotes(isEn));
        return payload;
    }

    public synchronized Map<String, Object> savePopup(AdminPopupEditSaveRequestDTO request, String actorId, boolean isEn) {
        String popupId = safe(request == null ? null : request.getPopupId());
        String popupTitleKo = safe(request == null ? null : request.getPopupTitle());
        String popupTitleEn = popupTitleKo;
        String headlineKo = safe(request == null ? null : request.getHeadline());
        String headlineEn = headlineKo;
        String bodyKo = safe(request == null ? null : request.getBody());
        String bodyEn = bodyKo;
        String ownerNameKo = safe(request == null ? null : request.getOwnerName());
        String ownerNameEn = ownerNameKo;
        String notesKo = safe(request == null ? null : request.getNotes());
        String notesEn = notesKo;

        if (popupId.isEmpty()) {
            throw new IllegalArgumentException("popupId is required.");
        }
        if (popupTitleKo.isEmpty()) {
            throw new IllegalArgumentException("popupTitle is required.");
        }
        if (headlineKo.isEmpty()) {
            throw new IllegalArgumentException("headline is required.");
        }
        if (bodyKo.isEmpty()) {
            throw new IllegalArgumentException("body is required.");
        }
        if (safe(request == null ? null : request.getOwnerContact()).isEmpty()) {
            throw new IllegalArgumentException("ownerContact is required.");
        }
        String startDate = safe(request == null ? null : request.getStartDate());
        String endDate = safe(request == null ? null : request.getEndDate());
        if (startDate.isEmpty() || endDate.isEmpty()) {
            throw new IllegalArgumentException("startDate and endDate are required.");
        }

        Map<String, Map<String, String>> entries = loadAll();
        Map<String, String> base = mergeCatalog(entries).getOrDefault(popupId, defaultPopup(popupId));
        Map<String, String> row = new LinkedHashMap<>(base);
        row.put("popupId", popupId);
        row.put("popupTitleKo", popupTitleKo);
        row.put("popupTitleEn", popupTitleEn);
        row.put("popupType", normalizePopupType(request == null ? null : request.getPopupType()));
        row.put("exposureStatus", normalizeExposureStatus(request == null ? null : request.getExposureStatus()));
        row.put("priority", normalizePriority(request == null ? null : request.getPriority()));
        row.put("useAt", normalizeUseAt(request == null ? null : request.getUseAt()));
        row.put("targetAudience", normalizeTargetAudience(request == null ? null : request.getTargetAudience()));
        row.put("displayScope", normalizeDisplayScope(request == null ? null : request.getDisplayScope()));
        row.put("startDate", startDate);
        row.put("startTime", normalizeTime(request == null ? null : request.getStartTime(), "09:00"));
        row.put("endDate", endDate);
        row.put("endTime", normalizeTime(request == null ? null : request.getEndTime(), "18:00"));
        row.put("closePolicy", normalizeClosePolicy(request == null ? null : request.getClosePolicy()));
        row.put("width", firstNonBlank(safe(request == null ? null : request.getWidth()), "720"));
        row.put("height", firstNonBlank(safe(request == null ? null : request.getHeight()), "560"));
        row.put("headlineKo", headlineKo);
        row.put("headlineEn", headlineEn);
        row.put("bodyKo", bodyKo);
        row.put("bodyEn", bodyEn);
        row.put("ctaLabelKo", firstNonBlank(safe(request == null ? null : request.getCtaLabel()), isEn ? "Open details" : "상세 공지 보기"));
        row.put("ctaLabelEn", firstNonBlank(safe(request == null ? null : request.getCtaLabel()), "Open details"));
        row.put("ctaUrl", firstNonBlank(safe(request == null ? null : request.getCtaUrl()), "/admin/system/notification"));
        row.put("ownerNameKo", ownerNameKo);
        row.put("ownerNameEn", ownerNameEn);
        row.put("ownerContact", safe(request == null ? null : request.getOwnerContact()));
        row.put("notesKo", notesKo);
        row.put("notesEn", notesEn);
        row.put("updatedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        row.put("updatedBy", firstNonBlank(actorId, "system"));

        entries.put(popupId, row);
        saveAll(entries);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("saved", true);
        response.put("popupId", popupId);
        response.put("message", isEn ? "Popup schedule saved." : "팝업 스케줄을 저장했습니다.");
        response.put("popupDetail", localizePopup(row, isEn));
        return response;
    }

    private Map<String, String> selectPopup(Map<String, Map<String, String>> catalog, String popupId) {
        if (!popupId.isEmpty() && catalog.containsKey(popupId)) {
            return catalog.get(popupId);
        }
        if (!catalog.isEmpty()) {
            return catalog.values().iterator().next();
        }
        return defaultPopup("POPUP-2026-031");
    }

    private Map<String, Map<String, String>> mergeCatalog(Map<String, Map<String, String>> overrides) {
        Map<String, Map<String, String>> rows = baseCatalog();
        for (Map.Entry<String, Map<String, String>> entry : overrides.entrySet()) {
            Map<String, String> merged = new LinkedHashMap<>(rows.getOrDefault(entry.getKey(), defaultPopup(entry.getKey())));
            merged.putAll(entry.getValue());
            merged.put("popupId", entry.getKey());
            rows.put(entry.getKey(), merged);
        }
        return rows;
    }

    private Map<String, Map<String, String>> baseCatalog() {
        Map<String, Map<String, String>> rows = new LinkedHashMap<>();
        rows.put("POPUP-2026-031", popupRow(
                "POPUP-2026-031",
                "분기 운영 공지 팝업", "Quarterly operator notice",
                "NOTICE", "SCHEDULED", "HIGH", "Y", "ADMIN", "ALL_ADMIN",
                "2026-04-01", "09:00", "2026-04-15", "18:00",
                "ONE_DAY", "720", "560",
                "플랫폼 점검 및 정책 변경 안내", "Platform maintenance and policy updates",
                "정기 점검 전에 관리자에게 노출할 팝업입니다. 정책 변경 사항, 예상 중단 영향, 긴급 문의 채널을 함께 안내합니다.",
                "Show this popup to administrators before scheduled maintenance. Include policy updates, downtime impact, and a contact point for urgent questions.",
                "상세 공지 보기", "Open details", "/admin/system/notification",
                "콘텐츠 운영팀", "Content Operations Team", "popup-ops@carbonet.local",
                "활성화 전에 연결 공지 내용을 최종 검토하세요.",
                "Review linked notice content before activation.",
                "2026-03-31 09:18", "webmaster"));
        rows.put("POPUP-2026-024", popupRow(
                "POPUP-2026-024",
                "정산 마감 알림 팝업", "Settlement deadline popup",
                "NOTICE", "ACTIVE", "NORMAL", "Y", "MEMBER", "CONTENT_ONLY",
                "2026-03-28", "00:00", "2026-04-05", "23:59",
                "SESSION", "680", "520",
                "월말 정산 서류 제출 안내", "Month-end settlement reminder",
                "정산 마감 전 필수 서류를 업로드하도록 회원사에 안내합니다.",
                "Guide members to upload required documents before the settlement deadline.",
                "제출 화면 이동", "Go to submission", "/mypage",
                "정산 운영팀", "Settlement Operations", "settlement@carbonet.local",
                "마감일 하루 전에는 배너와 중복 노출을 확인합니다.",
                "Check overlap with banners one day before the deadline.",
                "2026-03-30 14:05", "ops_admin"));
        return rows;
    }

    private Map<String, String> defaultPopup(String popupId) {
        return popupRow(
                popupId,
                "팝업 초안", "Popup draft",
                "NOTICE", "SCHEDULED", "HIGH", "Y", "ADMIN", "ALL_ADMIN",
                "2026-04-01", "09:00", "2026-04-15", "18:00",
                "ONE_DAY", "720", "560",
                "새 팝업 초안", "New popup draft",
                "팝업 본문을 입력하세요.",
                "Enter popup body content.",
                "상세 보기", "Open details", "/admin/system/notification",
                "콘텐츠 운영팀", "Content Operations Team", "popup-ops@carbonet.local",
                "",
                "",
                "", "");
    }

    private Map<String, String> popupRow(
            String popupId,
            String popupTitleKo,
            String popupTitleEn,
            String popupType,
            String exposureStatus,
            String priority,
            String useAt,
            String targetAudience,
            String displayScope,
            String startDate,
            String startTime,
            String endDate,
            String endTime,
            String closePolicy,
            String width,
            String height,
            String headlineKo,
            String headlineEn,
            String bodyKo,
            String bodyEn,
            String ctaLabelKo,
            String ctaLabelEn,
            String ctaUrl,
            String ownerNameKo,
            String ownerNameEn,
            String ownerContact,
            String notesKo,
            String notesEn,
            String updatedAt,
            String updatedBy) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("popupId", popupId);
        row.put("popupTitleKo", popupTitleKo);
        row.put("popupTitleEn", popupTitleEn);
        row.put("popupType", popupType);
        row.put("exposureStatus", exposureStatus);
        row.put("priority", priority);
        row.put("useAt", useAt);
        row.put("targetAudience", targetAudience);
        row.put("displayScope", displayScope);
        row.put("startDate", startDate);
        row.put("startTime", startTime);
        row.put("endDate", endDate);
        row.put("endTime", endTime);
        row.put("closePolicy", closePolicy);
        row.put("width", width);
        row.put("height", height);
        row.put("headlineKo", headlineKo);
        row.put("headlineEn", headlineEn);
        row.put("bodyKo", bodyKo);
        row.put("bodyEn", bodyEn);
        row.put("ctaLabelKo", ctaLabelKo);
        row.put("ctaLabelEn", ctaLabelEn);
        row.put("ctaUrl", ctaUrl);
        row.put("ownerNameKo", ownerNameKo);
        row.put("ownerNameEn", ownerNameEn);
        row.put("ownerContact", ownerContact);
        row.put("notesKo", notesKo);
        row.put("notesEn", notesEn);
        row.put("updatedAt", updatedAt);
        row.put("updatedBy", updatedBy);
        return row;
    }

    private Map<String, String> localizePopup(Map<String, String> source, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>(source);
        row.put("popupTitle", isEn ? safe(source.get("popupTitleEn")) : safe(source.get("popupTitleKo")));
        row.put("headline", isEn ? safe(source.get("headlineEn")) : safe(source.get("headlineKo")));
        row.put("body", isEn ? safe(source.get("bodyEn")) : safe(source.get("bodyKo")));
        row.put("ctaLabel", isEn ? safe(source.get("ctaLabelEn")) : safe(source.get("ctaLabelKo")));
        row.put("ownerName", isEn ? safe(source.get("ownerNameEn")) : safe(source.get("ownerNameKo")));
        row.put("notes", isEn ? safe(source.get("notesEn")) : safe(source.get("notesKo")));
        return row;
    }

    private Map<String, String> localizeListRow(Map<String, String> source, boolean isEn) {
        Map<String, String> row = localizePopup(source, isEn);
        row.put("popupTypeLabel", popupTypeLabel(safe(source.get("popupType")), isEn));
        row.put("exposureStatusLabel", exposureStatusLabel(safe(source.get("exposureStatus")), isEn));
        row.put("targetAudienceLabel", targetAudienceLabel(safe(source.get("targetAudience")), isEn));
        row.put("priorityLabel", priorityLabel(safe(source.get("priority")), isEn));
        row.put("displayScopeLabel", displayScopeLabel(safe(source.get("displayScope")), isEn));
        row.put("useAtLabel", "Y".equalsIgnoreCase(safe(source.get("useAt"))) ? (isEn ? "Use" : "사용") : (isEn ? "Do not use" : "미사용"));
        row.put("scheduleWindow", buildScheduleWindow(source));
        return row;
    }

    private List<Map<String, String>> buildSummaryCards(Map<String, String> popup, boolean isEn) {
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Exposure status" : "노출 상태", safe(popup.get("exposureStatus")),
                isEn ? "Current runtime scheduling state." : "현재 런타임 스케줄 상태입니다."));
        cards.add(summaryCard(isEn ? "Target audience" : "대상 사용자", safe(popup.get("targetAudience")),
                isEn ? "Audience segment receiving this popup." : "이 팝업을 받는 사용자 범위입니다."));
        cards.add(summaryCard(isEn ? "Updated by" : "수정자", firstNonBlank(safe(popup.get("updatedBy")), "-"),
                isEn ? "Last saved operator." : "마지막 저장 담당자입니다."));
        cards.add(summaryCard(isEn ? "Updated at" : "수정 시각", firstNonBlank(safe(popup.get("updatedAt")), "-"),
                isEn ? "Most recent save timestamp." : "가장 최근 저장 시각입니다."));
        return cards;
    }

    private List<Map<String, String>> buildListSummaryCards(Map<String, Map<String, String>> catalog,
                                                            List<Map<String, String>> filtered,
                                                            boolean isEn) {
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Visible rows" : "조회 팝업", String.valueOf(filtered.size()),
                isEn ? "Rows matching the current filters." : "현재 조건에 맞는 팝업 수입니다."));
        cards.add(summaryCard(isEn ? "Active" : "노출중",
                String.valueOf(countByValue(catalog, "exposureStatus", "ACTIVE")),
                isEn ? "Popups currently exposed to the target audience." : "현재 대상 사용자에게 노출 중인 팝업입니다."));
        cards.add(summaryCard(isEn ? "Scheduled" : "예약",
                String.valueOf(countByValue(catalog, "exposureStatus", "SCHEDULED")),
                isEn ? "Popups queued with a future exposure window." : "향후 노출 일정을 가진 예약 팝업입니다."));
        cards.add(summaryCard(isEn ? "Admin target" : "관리자 대상",
                String.valueOf(countByValue(catalog, "targetAudience", "ADMIN")),
                isEn ? "Popups scoped to admin workflows." : "관리자 업무 흐름에만 연결된 팝업입니다."));
        return cards;
    }

    private List<Map<String, String>> buildGovernanceNotes(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryCard(
                isEn ? "Keep popup and notice linkage explicit." : "팝업과 공지 연계는 명시적으로 유지",
                isEn ? "Linked content" : "연결 콘텐츠",
                isEn ? "Tie each popup to a live notice, guide, or action destination so operators can trace the message source."
                        : "각 팝업은 실제 공지, 가이드, 또는 액션 목적지와 연결해 운영자가 메시지 출처를 추적할 수 있어야 합니다."));
        rows.add(summaryCard(
                isEn ? "Review overlap before activation." : "활성화 전 중복 노출 점검",
                isEn ? "Collision check" : "충돌 점검",
                isEn ? "Check banner, popup, and first-login notices together before turning a schedule live."
                        : "예약 팝업을 활성화하기 전에 배너, 팝업, 최초 로그인 공지를 함께 비교해 중복 노출을 점검합니다."));
        rows.add(summaryCard(
                isEn ? "Use audience scope as a policy boundary." : "대상 범위를 정책 경계로 사용",
                isEn ? "Audience boundary" : "대상 경계",
                isEn ? "Do not reuse an admin-only popup for member journeys without reviewing copy, CTA, and close policy."
                        : "관리자 전용 팝업을 회원 여정에 재사용할 때는 문구, CTA, 닫기 정책을 다시 검토해야 합니다."));
        return rows;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private List<Map<String, String>> buildOptions(String... values) {
        List<Map<String, String>> rows = new ArrayList<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("label", values[index]);
            row.put("value", values[index + 1]);
            rows.add(row);
        }
        return rows;
    }

    private boolean matchesKeyword(Map<String, String> row, String keyword) {
        if (keyword.isEmpty()) {
            return true;
        }
        return safe(row.get("popupId")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("popupTitle")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("headline")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("ownerName")).toLowerCase(Locale.ROOT).contains(keyword)
                || safe(row.get("targetAudienceLabel")).toLowerCase(Locale.ROOT).contains(keyword);
    }

    private Map<String, String> selectListPopup(List<Map<String, String>> filtered,
                                                Map<String, Map<String, String>> catalog,
                                                String selectedPopupId,
                                                boolean isEn) {
        if (!selectedPopupId.isEmpty()) {
            for (Map<String, String> row : filtered) {
                if (selectedPopupId.equals(safe(row.get("popupId")))) {
                    return row;
                }
            }
            if (catalog.containsKey(selectedPopupId)) {
                return localizeListRow(catalog.get(selectedPopupId), isEn);
            }
        }
        if (!filtered.isEmpty()) {
            return filtered.get(0);
        }
        if (!catalog.isEmpty()) {
            return localizeListRow(catalog.values().iterator().next(), isEn);
        }
        return localizeListRow(defaultPopup("POPUP-2026-031"), isEn);
    }

    private int countByValue(Map<String, Map<String, String>> catalog, String key, String expected) {
        int count = 0;
        for (Map<String, String> row : catalog.values()) {
            if (expected.equalsIgnoreCase(safe(row.get(key)))) {
                count++;
            }
        }
        return count;
    }

    private String popupTypeLabel(String value, boolean isEn) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("EVENT".equals(normalized)) {
            return isEn ? "Event" : "이벤트형";
        }
        if ("CONSENT".equals(normalized)) {
            return isEn ? "Consent" : "동의형";
        }
        return isEn ? "Notice" : "공지형";
    }

    private String exposureStatusLabel(String value, boolean isEn) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("ACTIVE".equals(normalized)) {
            return isEn ? "Active" : "노출중";
        }
        if ("PAUSED".equals(normalized)) {
            return isEn ? "Paused" : "일시중지";
        }
        if ("ENDED".equals(normalized)) {
            return isEn ? "Ended" : "종료";
        }
        return isEn ? "Scheduled" : "예약";
    }

    private String targetAudienceLabel(String value, boolean isEn) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("MEMBER".equals(normalized)) {
            return isEn ? "Members" : "회원";
        }
        if ("ALL".equals(normalized)) {
            return isEn ? "All users" : "전체 사용자";
        }
        return isEn ? "Administrators" : "관리자";
    }

    private String priorityLabel(String value, boolean isEn) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("NORMAL".equals(normalized)) {
            return isEn ? "Normal" : "보통";
        }
        if ("LOW".equals(normalized)) {
            return isEn ? "Low" : "낮음";
        }
        return isEn ? "High" : "높음";
    }

    private String displayScopeLabel(String value, boolean isEn) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("CONTENT_ONLY".equals(normalized)) {
            return isEn ? "Content pages only" : "콘텐츠 화면만";
        }
        if ("FIRST_LOGIN".equals(normalized)) {
            return isEn ? "First login only" : "최초 로그인만";
        }
        return isEn ? "All admin pages" : "전체 관리자 화면";
    }

    private String buildScheduleWindow(Map<String, String> source) {
        String startDate = safe(source.get("startDate"));
        String startTime = safe(source.get("startTime"));
        String endDate = safe(source.get("endDate"));
        String endTime = safe(source.get("endTime"));
        return String.format("%s %s ~ %s %s", startDate, startTime, endDate, endTime).trim();
    }

    private Map<String, Map<String, String>> loadAll() {
        if (!Files.exists(registryPath)) {
            return new LinkedHashMap<>();
        }
        try (InputStream inputStream = Files.newInputStream(registryPath)) {
            Map<String, Map<String, String>> data = objectMapper.readValue(inputStream, new TypeReference<Map<String, Map<String, String>>>() {
            });
            return data == null ? new LinkedHashMap<>() : new LinkedHashMap<>(data);
        } catch (IOException e) {
            return new LinkedHashMap<>();
        }
    }

    private void saveAll(Map<String, Map<String, String>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save popup schedules.", e);
        }
    }

    private String normalizePopupType(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("EVENT".equals(normalized) || "CONSENT".equals(normalized)) {
            return normalized;
        }
        return "NOTICE";
    }

    private String normalizeExposureStatus(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("ACTIVE".equals(normalized) || "PAUSED".equals(normalized) || "ENDED".equals(normalized)) {
            return normalized;
        }
        return "SCHEDULED";
    }

    private String normalizePriority(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("NORMAL".equals(normalized) || "LOW".equals(normalized)) {
            return normalized;
        }
        return "HIGH";
    }

    private String normalizeUseAt(String value) {
        return "N".equalsIgnoreCase(safe(value)) ? "N" : "Y";
    }

    private String normalizeTargetAudience(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("MEMBER".equals(normalized) || "ALL".equals(normalized)) {
            return normalized;
        }
        return "ADMIN";
    }

    private String normalizeDisplayScope(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("CONTENT_ONLY".equals(normalized) || "FIRST_LOGIN".equals(normalized)) {
            return normalized;
        }
        return "ALL_ADMIN";
    }

    private String normalizeClosePolicy(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("SESSION".equals(normalized) || "REQUIRED".equals(normalized)) {
            return normalized;
        }
        return "ONE_DAY";
    }

    private String normalizeTime(String value, String fallback) {
        String normalized = safe(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private String firstNonBlank(String value, String fallback) {
        return safe(value).isEmpty() ? fallback : safe(value);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
