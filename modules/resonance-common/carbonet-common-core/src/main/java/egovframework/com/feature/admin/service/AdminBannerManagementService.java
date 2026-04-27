package egovframework.com.feature.admin.service;

import egovframework.com.feature.admin.mapper.AdminBannerManagementMapper;
import egovframework.com.feature.admin.mapper.AdminBannerManagementMetaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminBannerManagementService {

    private static final Logger log = LoggerFactory.getLogger(AdminBannerManagementService.class);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final String DEFAULT_IMAGE = "banner-placeholder.png";
    private static final String DEFAULT_IMAGE_FILE = "banner-placeholder";

    private final AdminBannerManagementMapper adminBannerManagementMapper;
    private final AdminBannerManagementMetaMapper adminBannerManagementMetaMapper;
    private final AdminPagePayloadFactory adminPagePayloadFactory;
    private final Map<String, BannerItem> seedStore = new ConcurrentHashMap<>();
    private final Map<String, BannerOverlay> bannerOverlayStore = new ConcurrentHashMap<>();

    public AdminBannerManagementService(AdminBannerManagementMapper adminBannerManagementMapper,
                                        AdminBannerManagementMetaMapper adminBannerManagementMetaMapper,
                                        AdminPagePayloadFactory adminPagePayloadFactory) {
        this.adminBannerManagementMapper = adminBannerManagementMapper;
        this.adminBannerManagementMetaMapper = adminBannerManagementMetaMapper;
        this.adminPagePayloadFactory = adminPagePayloadFactory;
        seed(new BannerItem("BNR-240301", "2026 배출권 거래 집중 안내", "2026 Emission Trading Notice",
                "메인 상단", "Main Hero", "LIVE", "2026-03-25 09:00", "2026-04-30 18:00",
                1, 1248, "webmaster", "2026-03-31 09:18", "/home",
                "분기 메인 캠페인 배너로 고정 노출 중입니다.",
                "Pinned as the quarterly campaign banner on the main page."));
        seed(new BannerItem("BNR-240288", "회원사 실적 제출 마감 알림", "Submission Deadline Alert",
                "마이페이지", "My Page", "SCHEDULED", "2026-04-01 00:00", "2026-04-10 23:59",
                2, 0, "ops_admin", "2026-03-30 17:42", "/mypage",
                "4월 초 제출 독려용 예약 배너입니다.",
                "Scheduled reminder banner for the early April submission window."));
        seed(new BannerItem("BNR-240271", "외부 연계 점검 공지", "External Integration Maintenance",
                "공지형 사이드", "Side Notice", "PAUSED", "2026-03-20 09:00", "2026-04-05 18:00",
                4, 226, "monitor_admin", "2026-03-29 14:05", "/admin/external/monitoring",
                "점검 일정 변경으로 일시 중지되었습니다.",
                "Paused while the maintenance window is being rescheduled."));
        seed(new BannerItem("BNR-240199", "지난 이벤트 아카이브", "Past Event Archive",
                "이벤트 배너", "Event Banner", "ENDED", "2026-02-01 09:00", "2026-03-01 18:00",
                5, 870, "content_mgr", "2026-03-02 10:20", "/admin/content/banner_edit",
                "성과 확인 후 종료 처리된 배너입니다.",
                "Completed and archived after the campaign review."));
    }

    public synchronized Map<String, Object> buildListPayload(String searchKeyword,
                                                             String status,
                                                             String placement,
                                                             String selectedBannerId,
                                                             boolean isEn) {
        String keyword = safe(searchKeyword).toLowerCase(Locale.ROOT);
        String normalizedStatus = safe(status).toUpperCase(Locale.ROOT);
        String normalizedPlacement = safe(placement);

        List<BannerItem> catalog = loadBannerCatalog();
        catalog.sort((left, right) -> {
            if (left.priority != right.priority) {
                return Integer.compare(left.priority, right.priority);
            }
            return left.id.compareTo(right.id);
        });

        List<Map<String, Object>> rows = new ArrayList<>();
        for (BannerItem item : catalog) {
            if (!matchesKeyword(item, keyword, isEn)) {
                continue;
            }
            if (!normalizedStatus.isEmpty() && !normalizedStatus.equalsIgnoreCase(item.status)) {
                continue;
            }
            String placementValue = isEn ? item.placementEn : item.placementKo;
            if (!normalizedPlacement.isEmpty() && !normalizedPlacement.equals(placementValue)) {
                continue;
            }
            rows.add(toListRow(item, isEn));
        }

        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040201");
        payload.put("searchKeyword", safe(searchKeyword));
        payload.put("status", safe(status));
        payload.put("placement", safe(placement));
        payload.put("summaryCards", buildSummaryCards(catalog, rows.size(), isEn));
        payload.put("bannerRows", rows);
        payload.put("selectedBanner", resolveSelectedBanner(rows, selectedBannerId));
        payload.put("placementOptions", buildPlacementOptions(isEn));
        return payload;
    }

    public synchronized Map<String, Object> buildEditPayload(String bannerId, boolean isEn) {
        BannerItem item = resolveBanner(loadBannerCatalog(), bannerId);
        Map<String, Object> payload = adminPagePayloadFactory.create(isEn, "A0040202");
        payload.put("bannerId", item.id);
        payload.put("bannerDetail", toEditDetail(item, isEn));
        payload.put("statusOptions", buildStatusOptions(isEn));
        payload.put("placementOptions", buildPlacementOptions(isEn));
        payload.put("summaryCards", List.of(
                summaryCard(isEn ? "Publish status" : "게시 상태", statusLabel(item.status, isEn),
                        isEn ? "Current publication state." : "현재 게시 상태입니다."),
                summaryCard(isEn ? "Priority" : "우선순위", String.valueOf(item.priority),
                        isEn ? "Lower number means higher priority." : "숫자가 낮을수록 우선 노출됩니다."),
                summaryCard(isEn ? "Clicks" : "클릭 수", String.valueOf(item.clickCount),
                        isEn ? "Accumulated click count." : "누적 클릭 수입니다."),
                summaryCard(isEn ? "Updated by" : "수정자", item.updatedBy,
                        isEn ? "Last operator who edited this banner." : "마지막 수정 담당자입니다."))
        );
        return payload;
    }

    public synchronized Map<String, Object> saveBanner(String bannerId,
                                                       String title,
                                                       String targetUrl,
                                                       String status,
                                                       String startAt,
                                                       String endAt,
                                                       boolean isEn) {
        List<BannerItem> catalog = loadBannerCatalog();
        BannerItem item = resolveBanner(catalog, bannerId);
        if (!safe(title).isEmpty()) {
            if (isEn) {
                item.titleEn = safe(title);
            } else {
                item.titleKo = safe(title);
            }
        }
        if (!safe(targetUrl).isEmpty()) {
            item.targetUrl = safe(targetUrl);
        }
        if (!safe(status).isEmpty()) {
            item.status = safe(status).toUpperCase(Locale.ROOT);
        }
        if (!safe(startAt).isEmpty()) {
            item.startAt = safe(startAt);
        }
        if (!safe(endAt).isEmpty()) {
            item.endAt = safe(endAt);
        }
        item.updatedAt = LocalDateTime.now().format(DATE_TIME_FORMATTER);
        item.updatedBy = "codex-admin";
        persistBanner(item, isEn);

        Map<String, Object> response = adminPagePayloadFactory.createStatusResponse(
                "saved",
                true,
                "bannerId",
                item.id,
                isEn ? "Banner draft saved." : "배너 초안을 저장했습니다.");
        response.put("bannerDetail", toEditDetail(item, isEn));
        return response;
    }

    private void seed(BannerItem item) {
        seedStore.put(item.id, item);
    }

    private List<BannerItem> loadBannerCatalog() {
        try {
            List<Map<String, Object>> rows = adminBannerManagementMapper.selectBannerRows();
            if (rows == null || rows.isEmpty()) {
                return seededCatalog();
            }
            Map<String, Map<String, Object>> metaByBannerId = loadMetaByBannerId();
            List<BannerItem> catalog = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                BannerItem item = fromDatabaseRow(row, metaByBannerId.get(safe(stringValue(row.get("bannerId")))));
                applyOverlay(item);
                catalog.add(item);
            }
            return catalog;
        } catch (RuntimeException ex) {
            log.warn("Falling back to seeded banner payload because COMTNBANNER lookup failed: {}", ex.getMessage());
            return seededCatalog();
        }
    }

    private boolean matchesKeyword(BannerItem item, String keyword, boolean isEn) {
        if (keyword.isEmpty()) {
            return true;
        }
        return item.id.toLowerCase(Locale.ROOT).contains(keyword)
                || (isEn ? item.titleEn : item.titleKo).toLowerCase(Locale.ROOT).contains(keyword)
                || (isEn ? item.placementEn : item.placementKo).toLowerCase(Locale.ROOT).contains(keyword)
                || item.updatedBy.toLowerCase(Locale.ROOT).contains(keyword)
                || item.targetUrl.toLowerCase(Locale.ROOT).contains(keyword);
    }

    private BannerItem resolveBanner(List<BannerItem> catalog, String bannerId) {
        for (BannerItem item : catalog) {
            if (safe(bannerId).equals(item.id)) {
                return item;
            }
        }
        return catalog.stream()
                .sorted((left, right) -> Integer.compare(left.priority, right.priority))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No banner seed data available."));
    }

    private List<Map<String, String>> buildSummaryCards(List<BannerItem> catalog, int filteredCount, boolean isEn) {
        List<Map<String, String>> cards = new ArrayList<>();
        cards.add(summaryCard(isEn ? "Visible banners" : "조회 배너", String.valueOf(filteredCount),
                isEn ? "Rows matching the current filter." : "현재 조건에 맞는 배너 수입니다."));
        cards.add(summaryCard(isEn ? "Live" : "운영중", String.valueOf(countByStatus(catalog, "LIVE")),
                isEn ? "Currently visible banners." : "현재 노출 중인 배너입니다."));
        cards.add(summaryCard(isEn ? "Scheduled" : "예약", String.valueOf(countByStatus(catalog, "SCHEDULED")),
                isEn ? "Scheduled banners." : "예약 공개 대기 배너입니다."));
        cards.add(summaryCard(isEn ? "Paused" : "중지", String.valueOf(countByStatus(catalog, "PAUSED")),
                isEn ? "Paused banners." : "중지 상태 배너입니다."));
        return cards;
    }

    private int countByStatus(List<BannerItem> catalog, String status) {
        int count = 0;
        for (BannerItem item : catalog) {
            if (status.equalsIgnoreCase(item.status)) {
                count++;
            }
        }
        return count;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, Object> toListRow(BannerItem item, boolean isEn) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", item.id);
        row.put("title", isEn ? item.titleEn : item.titleKo);
        row.put("titleKo", item.titleKo);
        row.put("titleEn", item.titleEn);
        row.put("placement", isEn ? item.placementEn : item.placementKo);
        row.put("placementKo", item.placementKo);
        row.put("placementEn", item.placementEn);
        row.put("status", item.status);
        row.put("statusLabel", statusLabel(item.status, isEn));
        row.put("startAt", item.startAt);
        row.put("endAt", item.endAt);
        row.put("priority", item.priority);
        row.put("clickCount", item.clickCount);
        row.put("updatedBy", item.updatedBy);
        row.put("updatedAt", item.updatedAt);
        row.put("targetUrl", item.targetUrl);
        row.put("note", isEn ? item.noteEn : item.noteKo);
        row.put("noteKo", item.noteKo);
        row.put("noteEn", item.noteEn);
        return row;
    }

    private Map<String, Object> toEditDetail(BannerItem item, boolean isEn) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("bannerId", item.id);
        detail.put("title", isEn ? item.titleEn : item.titleKo);
        detail.put("titleKo", item.titleKo);
        detail.put("titleEn", item.titleEn);
        detail.put("targetUrl", item.targetUrl);
        detail.put("status", item.status);
        detail.put("statusLabel", statusLabel(item.status, isEn));
        detail.put("placement", isEn ? item.placementEn : item.placementKo);
        detail.put("placementKo", item.placementKo);
        detail.put("placementEn", item.placementEn);
        detail.put("startAt", item.startAt);
        detail.put("endAt", item.endAt);
        detail.put("priority", item.priority);
        detail.put("clickCount", item.clickCount);
        detail.put("updatedBy", item.updatedBy);
        detail.put("updatedAt", item.updatedAt);
        detail.put("note", isEn ? item.noteEn : item.noteKo);
        return detail;
    }

    private Object resolveSelectedBanner(List<Map<String, Object>> rows, String selectedBannerId) {
        for (Map<String, Object> row : rows) {
            if (safe(selectedBannerId).equals(row.get("id"))) {
                return row;
            }
        }
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Map<String, String>> buildStatusOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(optionRow("LIVE", statusLabel("LIVE", isEn)));
        options.add(optionRow("SCHEDULED", statusLabel("SCHEDULED", isEn)));
        options.add(optionRow("PAUSED", statusLabel("PAUSED", isEn)));
        options.add(optionRow("ENDED", statusLabel("ENDED", isEn)));
        return options;
    }

    private List<Map<String, String>> buildPlacementOptions(boolean isEn) {
        Set<String> optionsSet = new LinkedHashSet<>();
        for (BannerItem item : loadBannerCatalog()) {
            String label = isEn ? item.placementEn : item.placementKo;
            if (!label.isEmpty()) {
                optionsSet.add(label);
            }
        }
        List<Map<String, String>> options = new ArrayList<>();
        if (optionsSet.isEmpty()) {
            optionsSet.add(isEn ? "Main Hero" : "메인 상단");
            optionsSet.add(isEn ? "My Page" : "마이페이지");
            optionsSet.add(isEn ? "Side Notice" : "공지형 사이드");
            optionsSet.add(isEn ? "Event Banner" : "이벤트 배너");
        }
        for (String option : optionsSet) {
            options.add(optionRow(option, option));
        }
        return options;
    }

    private List<BannerItem> seededCatalog() {
        List<BannerItem> catalog = new ArrayList<>();
        for (BannerItem item : seedStore.values()) {
            catalog.add(copyOf(item));
        }
        return catalog;
    }

    private BannerItem fromDatabaseRow(Map<String, Object> row, Map<String, Object> metaRow) {
        String bannerId = safe(stringValue(row.get("bannerId")));
        String bannerName = safe(stringValue(row.get("bannerName")));
        String linkUrl = safe(stringValue(row.get("linkUrl")));
        String description = safe(stringValue(row.get("bannerDescription")));
        String updatedBy = safe(stringValue(row.get("updatedBy")));
        String createdBy = safe(stringValue(row.get("createdBy")));
        String updatedAt = safe(stringValue(row.get("updatedAt")));
        String createdAt = safe(stringValue(row.get("createdAt")));
        int sortOrder = numberValue(row.get("sortOrder"), 9999);

        BannerItem seeded = seedStore.get(bannerId);
        String titleEn = safe(stringValue(metaRow == null ? null : metaRow.get("bannerNameEn")));
        String placementKo = safe(stringValue(metaRow == null ? null : metaRow.get("placementKo")));
        String placementEn = safe(stringValue(metaRow == null ? null : metaRow.get("placementEn")));
        String statusCode = safe(stringValue(metaRow == null ? null : metaRow.get("statusCode")));
        String startAt = safe(stringValue(metaRow == null ? null : metaRow.get("startAt")));
        String endAt = safe(stringValue(metaRow == null ? null : metaRow.get("endAt")));
        String noteEn = safe(stringValue(metaRow == null ? null : metaRow.get("noteEn")));
        int clickCount = numberValue(metaRow == null ? null : metaRow.get("clickCount"), seeded != null ? seeded.clickCount : 0);

        BannerItem item = new BannerItem(
                bannerId,
                bannerName.isEmpty() && seeded != null ? seeded.titleKo : bannerName,
                !titleEn.isEmpty() ? titleEn : (seeded != null ? seeded.titleEn : bannerName),
                !placementKo.isEmpty() ? placementKo : (seeded != null ? seeded.placementKo : placementKo(sortOrder)),
                !placementEn.isEmpty() ? placementEn : (seeded != null ? seeded.placementEn : placementEn(sortOrder)),
                !statusCode.isEmpty() ? statusCode : deriveStatus(stringValue(row.get("reflectAt")), createdAt, seeded),
                !startAt.isEmpty() ? startAt : (seeded != null ? seeded.startAt : createdAt),
                !endAt.isEmpty() ? endAt : (seeded != null ? seeded.endAt : ""),
                sortOrder == 9999 ? (seeded != null ? seeded.priority : 9999) : sortOrder,
                clickCount,
                !updatedBy.isEmpty() ? updatedBy : (!createdBy.isEmpty() ? createdBy : "system"),
                !updatedAt.isEmpty() ? updatedAt : createdAt,
                linkUrl,
                description.isEmpty() && seeded != null ? seeded.noteKo : description,
                !noteEn.isEmpty() ? noteEn : (seeded != null ? seeded.noteEn : description)
        );
        if (item.titleKo.isEmpty()) {
            item.titleKo = bannerId;
        }
        if (item.titleEn.isEmpty()) {
            item.titleEn = item.titleKo;
        }
        return item;
    }

    private void persistBanner(BannerItem item, boolean isEn) {
        bannerOverlayStore.put(item.id, BannerOverlay.fromItem(item));
        try {
            Map<String, Object> existing = adminBannerManagementMapper.selectBannerById(item.id);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bannerId", item.id);
            row.put("bannerName", isEn
                    ? safe(stringValue(existing == null ? null : existing.get("bannerName")))
                    : item.titleKo);
            if (safe(stringValue(row.get("bannerName"))).isEmpty()) {
                row.put("bannerName", item.titleKo.isEmpty() ? item.titleEn : item.titleKo);
            }
            row.put("linkUrl", item.targetUrl);
            row.put("bannerImage", safe(stringValue(existing == null ? null : existing.get("bannerImage"))).isEmpty()
                    ? DEFAULT_IMAGE
                    : stringValue(existing.get("bannerImage")));
            row.put("bannerDescription", item.noteKo);
            row.put("reflectAt", toReflectAt(item.status));
            row.put("createdBy", safe(stringValue(existing == null ? null : existing.get("createdBy"))).isEmpty()
                    ? "codex-admin"
                    : stringValue(existing.get("createdBy")));
            row.put("updatedBy", item.updatedBy);
            row.put("bannerImageFile", safe(stringValue(existing == null ? null : existing.get("bannerImageFile"))).isEmpty()
                    ? DEFAULT_IMAGE_FILE
                    : stringValue(existing.get("bannerImageFile")));
            row.put("sortOrder", item.priority);

            if (adminBannerManagementMapper.countBannerById(item.id) > 0) {
                adminBannerManagementMapper.updateBannerRow(row);
            } else {
                adminBannerManagementMapper.insertBannerRow(row);
            }
            persistBannerMeta(item);
        } catch (RuntimeException ex) {
            log.warn("Banner save persisted only to runtime overlay for {} because COMTNBANNER save failed: {}", item.id, ex.getMessage());
            seedStore.put(item.id, copyOf(item));
        }
    }

    private void persistBannerMeta(BannerItem item) {
        try {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bannerId", item.id);
            row.put("bannerNameEn", item.titleEn);
            row.put("placementKo", item.placementKo);
            row.put("placementEn", item.placementEn);
            row.put("statusCode", item.status);
            row.put("startAt", item.startAt);
            row.put("endAt", item.endAt);
            row.put("clickCount", item.clickCount);
            row.put("noteEn", item.noteEn);
            row.put("updatedBy", item.updatedBy);
            if (adminBannerManagementMetaMapper.countBannerMetaById(item.id) > 0) {
                adminBannerManagementMetaMapper.updateBannerMetaRow(row);
            } else {
                adminBannerManagementMetaMapper.insertBannerMetaRow(row);
            }
        } catch (RuntimeException ex) {
            log.warn("Banner meta save stayed on runtime overlay for {} because COMTNBANNERMETA save failed: {}", item.id, ex.getMessage());
        }
    }

    private Map<String, Map<String, Object>> loadMetaByBannerId() {
        Map<String, Map<String, Object>> metaByBannerId = new LinkedHashMap<>();
        try {
            List<Map<String, Object>> rows = adminBannerManagementMetaMapper.selectBannerMetaRows();
            for (Map<String, Object> row : rows) {
                metaByBannerId.put(safe(stringValue(row.get("bannerId"))), row);
            }
        } catch (RuntimeException ex) {
            log.info("COMTNBANNERMETA lookup unavailable; using derived metadata only: {}", ex.getMessage());
        }
        return metaByBannerId;
    }

    private void applyOverlay(BannerItem item) {
        BannerOverlay overlay = bannerOverlayStore.get(item.id);
        if (overlay == null) {
            return;
        }
        if (!overlay.titleKo.isEmpty()) {
            item.titleKo = overlay.titleKo;
        }
        if (!overlay.titleEn.isEmpty()) {
            item.titleEn = overlay.titleEn;
        }
        if (!overlay.status.isEmpty()) {
            item.status = overlay.status;
        }
        if (!overlay.startAt.isEmpty()) {
            item.startAt = overlay.startAt;
        }
        if (!overlay.endAt.isEmpty()) {
            item.endAt = overlay.endAt;
        }
        if (!overlay.targetUrl.isEmpty()) {
            item.targetUrl = overlay.targetUrl;
        }
        if (!overlay.noteKo.isEmpty()) {
            item.noteKo = overlay.noteKo;
        }
        if (!overlay.noteEn.isEmpty()) {
            item.noteEn = overlay.noteEn;
        }
        if (!overlay.updatedBy.isEmpty()) {
            item.updatedBy = overlay.updatedBy;
        }
        if (!overlay.updatedAt.isEmpty()) {
            item.updatedAt = overlay.updatedAt;
        }
    }

    private BannerItem copyOf(BannerItem item) {
        return new BannerItem(
                item.id,
                item.titleKo,
                item.titleEn,
                item.placementKo,
                item.placementEn,
                item.status,
                item.startAt,
                item.endAt,
                item.priority,
                item.clickCount,
                item.updatedBy,
                item.updatedAt,
                item.targetUrl,
                item.noteKo,
                item.noteEn
        );
    }

    private String deriveStatus(String reflectAt, String createdAt, BannerItem seeded) {
        if (seeded != null && bannerOverlayStore.containsKey(seeded.id)) {
            String overlayStatus = bannerOverlayStore.get(seeded.id).status;
            if (!overlayStatus.isEmpty()) {
                return overlayStatus;
            }
        }
        if (!"Y".equalsIgnoreCase(safe(reflectAt))) {
            return "PAUSED";
        }
        if (createdAt.isEmpty()) {
            return "LIVE";
        }
        try {
            LocalDateTime created = LocalDateTime.parse(createdAt, DATE_TIME_FORMATTER);
            return created.isAfter(LocalDateTime.now()) ? "SCHEDULED" : "LIVE";
        } catch (RuntimeException ignored) {
            return "LIVE";
        }
    }

    private String toReflectAt(String status) {
        return "LIVE".equalsIgnoreCase(safe(status)) ? "Y" : "N";
    }

    private String placementKo(int priority) {
        if (priority <= 1) {
            return "메인 상단";
        }
        if (priority == 2) {
            return "마이페이지";
        }
        if (priority <= 4) {
            return "공지형 사이드";
        }
        return "이벤트 배너";
    }

    private String placementEn(int priority) {
        if (priority <= 1) {
            return "Main Hero";
        }
        if (priority == 2) {
            return "My Page";
        }
        if (priority <= 4) {
            return "Side Notice";
        }
        return "Event Banner";
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private int numberValue(Object value, int fallback) {
        try {
            return Integer.parseInt(stringValue(value));
        } catch (RuntimeException ex) {
            return fallback;
        }
    }

    private Map<String, String> optionRow(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }

    private String statusLabel(String status, boolean isEn) {
        String normalized = safe(status).toUpperCase(Locale.ROOT);
        if ("LIVE".equals(normalized)) {
            return isEn ? "Live" : "운영중";
        }
        if ("SCHEDULED".equals(normalized)) {
            return isEn ? "Scheduled" : "예약";
        }
        if ("PAUSED".equals(normalized)) {
            return isEn ? "Paused" : "중지";
        }
        return isEn ? "Ended" : "종료";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class BannerItem {
        private final String id;
        private String titleKo;
        private String titleEn;
        private final String placementKo;
        private final String placementEn;
        private String status;
        private String startAt;
        private String endAt;
        private final int priority;
        private final int clickCount;
        private String updatedBy;
        private String updatedAt;
        private String targetUrl;
        private String noteKo;
        private String noteEn;

        private BannerItem(String id,
                           String titleKo,
                           String titleEn,
                           String placementKo,
                           String placementEn,
                           String status,
                           String startAt,
                           String endAt,
                           int priority,
                           int clickCount,
                           String updatedBy,
                           String updatedAt,
                           String targetUrl,
                           String noteKo,
                           String noteEn) {
            this.id = id;
            this.titleKo = titleKo;
            this.titleEn = titleEn;
            this.placementKo = placementKo;
            this.placementEn = placementEn;
            this.status = status;
            this.startAt = startAt;
            this.endAt = endAt;
            this.priority = priority;
            this.clickCount = clickCount;
            this.updatedBy = updatedBy;
            this.updatedAt = updatedAt;
            this.targetUrl = targetUrl;
            this.noteKo = noteKo;
            this.noteEn = noteEn;
        }
    }

    private static final class BannerOverlay {
        private final String titleKo;
        private final String titleEn;
        private final String status;
        private final String startAt;
        private final String endAt;
        private final String targetUrl;
        private final String noteKo;
        private final String noteEn;
        private final String updatedBy;
        private final String updatedAt;

        private BannerOverlay(String titleKo,
                              String titleEn,
                              String status,
                              String startAt,
                              String endAt,
                              String targetUrl,
                              String noteKo,
                              String noteEn,
                              String updatedBy,
                              String updatedAt) {
            this.titleKo = titleKo;
            this.titleEn = titleEn;
            this.status = status;
            this.startAt = startAt;
            this.endAt = endAt;
            this.targetUrl = targetUrl;
            this.noteKo = noteKo;
            this.noteEn = noteEn;
            this.updatedBy = updatedBy;
            this.updatedAt = updatedAt;
        }

        private static BannerOverlay fromItem(BannerItem item) {
            return new BannerOverlay(
                    item.titleKo,
                    item.titleEn,
                    item.status,
                    item.startAt,
                    item.endAt,
                    item.targetUrl,
                    item.noteKo,
                    item.noteEn,
                    item.updatedBy,
                    item.updatedAt
            );
        }
    }
}
