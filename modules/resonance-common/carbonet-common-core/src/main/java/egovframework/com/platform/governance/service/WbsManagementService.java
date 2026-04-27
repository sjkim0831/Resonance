package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.governance.dto.WbsManagementSaveRequest;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.read.FullStackGovernanceRegistryReadPort;
import egovframework.com.platform.read.MenuInfoReadPort;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class WbsManagementService {

    private static final String STATUS_NOT_STARTED = "NOT_STARTED";
    private static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    private static final String STATUS_BLOCKED = "BLOCKED";
    private static final String STATUS_DONE = "DONE";
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final ObjectMapper objectMapper;
    private final MenuInfoReadPort menuInfoReadPort;
    private final FullStackGovernanceRegistryReadPort fullStackGovernanceRegistryReadPort;
    private final Path registryPath = Paths.get("data", "wbs-management", "entries.json");

    public WbsManagementService(ObjectMapper objectMapper,
                                MenuInfoReadPort menuInfoReadPort,
                                FullStackGovernanceRegistryReadPort fullStackGovernanceRegistryReadPort) {
        this.objectMapper = objectMapper;
        this.menuInfoReadPort = menuInfoReadPort;
        this.fullStackGovernanceRegistryReadPort = fullStackGovernanceRegistryReadPort;
    }

    public synchronized Map<String, Object> buildPagePayload(String menuType) {
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = "USER".equals(normalizedMenuType) ? "HMENU1" : "AMENU1";
        String scope = "USER".equals(normalizedMenuType) ? "HOME" : "ADMIN";
        List<MenuInfoDTO> menuRows = loadMenus(codeId);
        List<MenuInfoDTO> pageMenus = filterPageMenus(menuRows);
        Map<String, Map<String, Object>> savedEntries = loadAll();

        List<Map<String, Object>> wbsRows = new ArrayList<>();
        int totalProgress = 0;
        for (WbsDraftRow row : buildDraftRows(scope, pageMenus)) {
            Map<String, Object> registryEntry = fullStackGovernanceRegistryReadPort.getEntry(row.menuCode);
            Map<String, Object> savedEntry = savedEntries.get(entryKey(normalizedMenuType, row.menuCode));
            Map<String, Object> merged = buildMergedRow(normalizedMenuType, row, registryEntry, savedEntry);
            totalProgress += safeInt(merged.get("progress"));
            wbsRows.add(merged);
        }
        wbsRows.sort(Comparator
                .comparing((Map<String, Object> row) -> sortAnchorDate(row), Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(row -> stringValue(row.get("wbsId"))));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("menuType", normalizedMenuType);
        payload.put("scope", scope);
        payload.put("menuRows", mapMenuRows(menuRows));
        payload.put("wbsRows", wbsRows);
        payload.put("inventorySummary", buildInventorySummary(scope, menuRows, wbsRows, totalProgress));
        payload.put("waveSummary", buildWaveSummary(wbsRows));
        payload.put("statusOptions", List.of(
                option(STATUS_NOT_STARTED, "미착수", "Not Started"),
                option(STATUS_IN_PROGRESS, "진행중", "In Progress"),
                option(STATUS_BLOCKED, "지연/차단", "Blocked"),
                option(STATUS_DONE, "완료", "Done")
        ));
        payload.put("timeline", buildTimeline(wbsRows));
        payload.put("today", LocalDate.now().format(DATE_FORMAT));
        return payload;
    }

    public synchronized byte[] buildExcel(String menuType, String statusFilter, String searchKeyword) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> wbsRows = (List<Map<String, Object>>) buildPagePayload(menuType).get("wbsRows");
        List<Map<String, Object>> filteredRows = filterRows(wbsRows, statusFilter, searchKeyword);
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("USER".equals(normalizeMenuType(menuType)) ? "HOME_WBS" : "ADMIN_WBS");

            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);

            String[] headers = {
                    "WBS ID", "메뉴구분", "메뉴코드", "메뉴명", "URL", "Wave", "담당자", "상태", "진행률",
                    "예상시작일", "예상종료일", "작업시작일", "작업종료일", "편차일수", "지연여부", "페이지ID",
                    "기능코드", "API", "Controller", "Service", "Mapper", "DB테이블", "메모", "Codex지시"
            };
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            int rowIndex = 1;
            for (Map<String, Object> row : filteredRows) {
                Row sheetRow = sheet.createRow(rowIndex++);
                int cellIndex = 0;
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("wbsId")));
                sheetRow.createCell(cellIndex++).setCellValue("USER".equals(normalizeMenuType(menuType)) ? "HOME" : "ADMIN");
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("menuCode")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("menuName")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("menuUrl")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("waveLabel")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("owner")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("status")));
                sheetRow.createCell(cellIndex++).setCellValue(safeInt(row.get("progress")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("plannedStartDate")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("plannedEndDate")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("actualStartDate")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("actualEndDate")));
                sheetRow.createCell(cellIndex++).setCellValue(safeInt(row.get("varianceDays")));
                sheetRow.createCell(cellIndex++).setCellValue(boolValue(row.get("overdue")) ? "Y" : "N");
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("pageId")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("featureCodes")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("apiIds")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("controllerActions")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("serviceMethods")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("mapperQueries")));
                sheetRow.createCell(cellIndex++).setCellValue(joinValues(row.get("tableNames")));
                sheetRow.createCell(cellIndex++).setCellValue(stringValue(row.get("notes")));
                sheetRow.createCell(cellIndex).setCellValue(stringValue(row.get("codexInstruction")));
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                int width = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.min(width + 1024, 256 * 60));
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to build WBS Excel export.", e);
        }
    }

    public synchronized Map<String, Object> saveEntry(WbsManagementSaveRequest request) {
        String menuType = normalizeMenuType(request == null ? null : request.getMenuType());
        String menuCode = normalize(request == null ? null : request.getMenuCode()).toUpperCase(Locale.ROOT);
        if (menuCode.length() != 8) {
            throw new IllegalArgumentException("menuCode must be an 8-digit page menu code.");
        }
        String plannedStartDate = firstNonBlank(normalize(request == null ? null : request.getPlannedStartDate()), normalize(request == null ? null : request.getStartDate()));
        String plannedEndDate = firstNonBlank(normalize(request == null ? null : request.getPlannedEndDate()), normalize(request == null ? null : request.getEndDate()));
        String actualStartDate = normalize(request == null ? null : request.getActualStartDate());
        String actualEndDate = normalize(request == null ? null : request.getActualEndDate());
        validateDate(plannedStartDate, "plannedStartDate");
        validateDate(plannedEndDate, "plannedEndDate");
        validateDate(actualStartDate, "actualStartDate");
        validateDate(actualEndDate, "actualEndDate");
        int progress = request != null && request.getProgress() != null ? request.getProgress() : 0;
        if (progress < 0 || progress > 100) {
            throw new IllegalArgumentException("progress must be between 0 and 100.");
        }

        Map<String, Map<String, Object>> entries = loadAll();
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("menuType", menuType);
        entry.put("menuCode", menuCode);
        entry.put("owner", normalize(request == null ? null : request.getOwner()));
        entry.put("status", normalizeStatus(request == null ? null : request.getStatus()));
        entry.put("progress", progress);
        entry.put("plannedStartDate", plannedStartDate);
        entry.put("plannedEndDate", plannedEndDate);
        entry.put("actualStartDate", actualStartDate);
        entry.put("actualEndDate", actualEndDate);
        entry.put("startDate", plannedStartDate);
        entry.put("endDate", plannedEndDate);
        entry.put("notes", normalize(request == null ? null : request.getNotes()));
        entry.put("codexInstruction", normalize(request == null ? null : request.getCodexInstruction()));
        entry.put("updatedAt", LocalDate.now().format(DATE_FORMAT));
        entries.put(entryKey(menuType, menuCode), entry);
        saveAll(entries);
        return new LinkedHashMap<>(entry);
    }

    private Map<String, Object> buildMergedRow(String menuType,
                                               WbsDraftRow draft,
                                               Map<String, Object> registryEntry,
                                               Map<String, Object> savedEntry) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("menuType", menuType);
        row.put("scope", draft.scope);
        row.put("wbsId", draft.wbsId);
        row.put("waveLabel", draft.waveLabel);
        row.put("waveOrder", draft.waveOrder);
        row.put("menuCode", draft.menuCode);
        row.put("parentCode", parentCode(draft.menuCode));
        row.put("menuName", draft.menuName);
        row.put("menuNameEn", draft.menuNameEn);
        row.put("menuUrl", draft.menuUrl);
        row.put("pageId", firstNonBlank(stringValue(registryEntry.get("pageId")), routeId(draft.menuUrl)));
        row.put("routeId", routeId(draft.menuUrl));
        row.put("taskType", draft.taskType);
        row.put("deliverable", draft.deliverable);
        row.put("predecessor", draft.predecessor);
        row.put("priority", draft.priority);
        LocalDate plannedStartDate = parseDate(savedEntry == null ? "" : firstNonBlank(stringValue(savedEntry.get("plannedStartDate")), stringValue(savedEntry.get("startDate"))));
        LocalDate plannedEndDate = parseDate(savedEntry == null ? "" : firstNonBlank(stringValue(savedEntry.get("plannedEndDate")), stringValue(savedEntry.get("endDate"))));
        LocalDate actualStartDate = parseDate(savedEntry == null ? "" : stringValue(savedEntry.get("actualStartDate")));
        LocalDate actualEndDate = parseDate(savedEntry == null ? "" : stringValue(savedEntry.get("actualEndDate")));
        String status = savedEntry == null ? STATUS_NOT_STARTED : normalizeStatus(stringValue(savedEntry.get("status")));
        row.put("status", status);
        row.put("owner", savedEntry == null ? "" : stringValue(savedEntry.get("owner")));
        row.put("progress", savedEntry == null ? 0 : safeInt(savedEntry.get("progress")));
        row.put("plannedStartDate", formatDate(plannedStartDate));
        row.put("plannedEndDate", formatDate(plannedEndDate));
        row.put("actualStartDate", formatDate(actualStartDate));
        row.put("actualEndDate", formatDate(actualEndDate));
        row.put("startDate", formatDate(plannedStartDate));
        row.put("endDate", formatDate(plannedEndDate));
        row.put("notes", savedEntry == null ? "" : stringValue(savedEntry.get("notes")));
        row.put("codexInstruction", savedEntry == null ? "" : stringValue(savedEntry.get("codexInstruction")));
        row.put("updatedAt", savedEntry == null ? "" : stringValue(savedEntry.get("updatedAt")));
        row.put("featureCodes", normalizeObjectList(registryEntry.get("featureCodes")));
        row.put("componentIds", normalizeObjectList(registryEntry.get("componentIds")));
        row.put("eventIds", normalizeObjectList(registryEntry.get("eventIds")));
        row.put("functionIds", normalizeObjectList(registryEntry.get("functionIds")));
        row.put("apiIds", normalizeObjectList(registryEntry.get("apiIds")));
        row.put("controllerActions", normalizeObjectList(registryEntry.get("controllerActions")));
        row.put("serviceMethods", normalizeObjectList(registryEntry.get("serviceMethods")));
        row.put("mapperQueries", normalizeObjectList(registryEntry.get("mapperQueries")));
        row.put("schemaIds", normalizeObjectList(registryEntry.get("schemaIds")));
        row.put("tableNames", normalizeObjectList(registryEntry.get("tableNames")));
        row.put("columnNames", normalizeObjectList(registryEntry.get("columnNames")));
        row.put("tags", normalizeObjectList(registryEntry.get("tags")));
        row.put("coverageScore", deriveCoverageScore(registryEntry));
        row.putAll(buildScheduleMetrics(status, plannedStartDate, plannedEndDate, actualStartDate, actualEndDate));
        row.put("codexPrompt", buildCodexPrompt(row));
        return row;
    }

    private List<Map<String, Object>> filterRows(List<Map<String, Object>> rows, String statusFilter, String searchKeyword) {
        String normalizedStatusFilter = normalize(statusFilter).toUpperCase(Locale.ROOT);
        String normalizedKeyword = normalize(searchKeyword).toLowerCase(Locale.ROOT);
        List<Map<String, Object>> filteredRows = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            if (!normalizedStatusFilter.isEmpty()
                    && !"ALL".equals(normalizedStatusFilter)
                    && !normalizedStatusFilter.equals(stringValue(row.get("status")))) {
                continue;
            }
            if (!normalizedKeyword.isEmpty()
                    && !stringValue(row.get("menuName")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !stringValue(row.get("menuCode")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !stringValue(row.get("menuUrl")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                    && !stringValue(row.get("owner")).toLowerCase(Locale.ROOT).contains(normalizedKeyword)) {
                continue;
            }
            filteredRows.add(row);
        }
        return filteredRows;
    }

    private Map<String, Object> buildInventorySummary(String scope,
                                                      List<MenuInfoDTO> menuRows,
                                                      List<Map<String, Object>> wbsRows,
                                                      int totalProgress) {
        Map<String, Object> summary = new LinkedHashMap<>();
        int completed = 0;
        int inProgress = 0;
        int blocked = 0;
        int overdue = 0;
        int noPlannedDate = 0;
        int completedOnTime = 0;
        int completedWithPlan = 0;
        int totalVarianceDays = 0;
        int varianceCount = 0;
        for (Map<String, Object> row : wbsRows) {
            String status = stringValue(row.get("status"));
            if (STATUS_DONE.equals(status)) {
                completed++;
                if (boolValue(row.get("completedOnTime"))) {
                    completedOnTime++;
                }
                if (boolValue(row.get("hasPlannedSchedule"))) {
                    completedWithPlan++;
                }
            } else if (STATUS_IN_PROGRESS.equals(status)) {
                inProgress++;
            } else if (STATUS_BLOCKED.equals(status)) {
                blocked++;
            }
            if (boolValue(row.get("overdue"))) {
                overdue++;
            }
            if (!boolValue(row.get("hasPlannedSchedule"))) {
                noPlannedDate++;
            }
            int varianceDays = safeInt(row.get("varianceDays"));
            if (varianceDays != 0) {
                totalVarianceDays += varianceDays;
                varianceCount++;
            }
        }
        summary.put("scope", scope);
        summary.put("totalMenus", menuRows.size());
        summary.put("pageMenus", wbsRows.size());
        summary.put("completed", completed);
        summary.put("inProgress", inProgress);
        summary.put("blocked", blocked);
        summary.put("overdue", overdue);
        summary.put("noPlannedDate", noPlannedDate);
        summary.put("onTimeCompletionRate", completedWithPlan == 0 ? 0 : (completedOnTime * 100 / completedWithPlan));
        summary.put("averageVarianceDays", varianceCount == 0 ? 0 : totalVarianceDays / varianceCount);
        summary.put("averageProgress", wbsRows.isEmpty() ? 0 : totalProgress / wbsRows.size());
        return summary;
    }

    private List<Map<String, Object>> buildWaveSummary(List<Map<String, Object>> wbsRows) {
        Map<Integer, Map<String, Object>> byWave = new LinkedHashMap<>();
        for (Map<String, Object> row : wbsRows) {
            int waveOrder = safeInt(row.get("waveOrder"));
            Map<String, Object> bucket = byWave.computeIfAbsent(waveOrder, key -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("waveOrder", waveOrder);
                item.put("waveLabel", stringValue(row.get("waveLabel")));
                item.put("count", 0);
                item.put("done", 0);
                item.put("overdue", 0);
                item.put("menus", new ArrayList<String>());
                return item;
            });
            bucket.put("count", safeInt(bucket.get("count")) + 1);
            if (STATUS_DONE.equals(stringValue(row.get("status")))) {
                bucket.put("done", safeInt(bucket.get("done")) + 1);
            }
            if (boolValue(row.get("overdue"))) {
                bucket.put("overdue", safeInt(bucket.get("overdue")) + 1);
            }
            @SuppressWarnings("unchecked")
            List<String> menus = (List<String>) bucket.get("menus");
            menus.add(stringValue(row.get("menuCode")));
        }
        return new ArrayList<>(byWave.values());
    }

    private Map<String, Object> buildTimeline(List<Map<String, Object>> wbsRows) {
        LocalDate minDate = null;
        LocalDate maxDate = null;
        for (Map<String, Object> row : wbsRows) {
            LocalDate start = parseDate(firstNonBlank(stringValue(row.get("plannedStartDate")), stringValue(row.get("actualStartDate"))));
            LocalDate end = parseDate(firstNonBlank(stringValue(row.get("actualEndDate")), stringValue(row.get("plannedEndDate"))));
            if (start != null && (minDate == null || start.isBefore(minDate))) {
                minDate = start;
            }
            if (end != null && (maxDate == null || end.isAfter(maxDate))) {
                maxDate = end;
            }
        }
        LocalDate today = LocalDate.now();
        if (minDate == null) {
            minDate = today.minusWeeks(1);
        }
        if (maxDate == null) {
            maxDate = today.plusWeeks(10);
        }
        LocalDate start = minDate.minusDays(minDate.getDayOfWeek().getValue() - 1L);
        LocalDate end = maxDate.plusDays(7L - maxDate.getDayOfWeek().getValue());
        List<Map<String, Object>> weeks = new ArrayList<>();
        List<Map<String, Object>> months = new ArrayList<>();
        LocalDate cursor = start;
        WeekFields weekFields = WeekFields.ISO;
        String currentMonth = "";
        int currentMonthSpan = 0;
        while (!cursor.isAfter(end)) {
            String monthLabel = cursor.getYear() + "-" + String.format(Locale.ROOT, "%02d", cursor.getMonthValue());
            if (!monthLabel.equals(currentMonth)) {
                if (!currentMonth.isEmpty()) {
                    Map<String, Object> month = new LinkedHashMap<>();
                    month.put("key", currentMonth);
                    month.put("label", currentMonth);
                    month.put("span", currentMonthSpan);
                    months.add(month);
                }
                currentMonth = monthLabel;
                currentMonthSpan = 0;
            }
            currentMonthSpan++;
            Map<String, Object> week = new LinkedHashMap<>();
            week.put("key", cursor.toString());
            week.put("startDate", cursor.toString());
            week.put("endDate", cursor.plusDays(6).toString());
            week.put("label", cursor.getYear() + "-W" + String.format(Locale.ROOT, "%02d", cursor.get(weekFields.weekOfWeekBasedYear())));
            weeks.add(week);
            cursor = cursor.plusWeeks(1);
        }
        if (!currentMonth.isEmpty()) {
            Map<String, Object> month = new LinkedHashMap<>();
            month.put("key", currentMonth);
            month.put("label", currentMonth);
            month.put("span", currentMonthSpan);
            months.add(month);
        }
        Map<String, Object> timeline = new LinkedHashMap<>();
        timeline.put("startDate", start.toString());
        timeline.put("endDate", end.toString());
        timeline.put("viewType", "WEEK");
        timeline.put("months", months);
        timeline.put("weeks", weeks);
        return timeline;
    }

    private String buildCodexPrompt(Map<String, Object> row) {
        List<String> featureCodes = normalizeObjectList(row.get("featureCodes"));
        List<String> apiIds = normalizeObjectList(row.get("apiIds"));
        List<String> controllerActions = normalizeObjectList(row.get("controllerActions"));
        List<String> serviceMethods = normalizeObjectList(row.get("serviceMethods"));
        List<String> mapperQueries = normalizeObjectList(row.get("mapperQueries"));
        List<String> tableNames = normalizeObjectList(row.get("tableNames"));
        StringBuilder builder = new StringBuilder();
        builder.append("작업 대상 메뉴: ").append(stringValue(row.get("menuName"))).append(" (").append(stringValue(row.get("menuCode"))).append(")\n");
        builder.append("URL: ").append(stringValue(row.get("menuUrl"))).append("\n");
        builder.append("WBS: ").append(stringValue(row.get("wbsId"))).append(" / ").append(stringValue(row.get("waveLabel"))).append("\n");
        builder.append("작업 유형: ").append(stringValue(row.get("taskType"))).append("\n");
        builder.append("산출물: ").append(stringValue(row.get("deliverable"))).append("\n");
        builder.append("우선순위: ").append(stringValue(row.get("priority"))).append("\n");
        builder.append("예상 일정: ").append(firstNonBlank(stringValue(row.get("plannedStartDate")), "미정"))
                .append(" ~ ")
                .append(firstNonBlank(stringValue(row.get("plannedEndDate")), "미정"))
                .append("\n");
        builder.append("실제 일정: ").append(firstNonBlank(stringValue(row.get("actualStartDate")), "미정"))
                .append(" ~ ")
                .append(firstNonBlank(stringValue(row.get("actualEndDate")), "미정"))
                .append("\n");
        builder.append("담당자: ").append(firstNonBlank(stringValue(row.get("owner")), "미정")).append("\n");
        builder.append("현 상태: ").append(stringValue(row.get("status"))).append(" / 진행률 ").append(safeInt(row.get("progress"))).append("%\n");
        builder.append("일정 편차: ").append(safeInt(row.get("varianceDays"))).append("일 / ")
                .append(boolValue(row.get("overdue")) ? "지연" : "정상").append("\n");
        if (!featureCodes.isEmpty()) {
            builder.append("기능 코드: ").append(String.join(", ", featureCodes)).append("\n");
        }
        if (!apiIds.isEmpty()) {
            builder.append("관련 API: ").append(String.join(", ", apiIds)).append("\n");
        }
        if (!controllerActions.isEmpty()) {
            builder.append("Controller: ").append(String.join(", ", controllerActions)).append("\n");
        }
        if (!serviceMethods.isEmpty()) {
            builder.append("Service: ").append(String.join(", ", serviceMethods)).append("\n");
        }
        if (!mapperQueries.isEmpty()) {
            builder.append("Mapper: ").append(String.join(", ", mapperQueries)).append("\n");
        }
        if (!tableNames.isEmpty()) {
            builder.append("DB Table: ").append(String.join(", ", tableNames)).append("\n");
        }
        String note = stringValue(row.get("codexInstruction"));
        if (!note.isEmpty()) {
            builder.append("추가 지시: ").append(note).append("\n");
        }
        builder.append("요청사항: 현재 저장소 구조를 먼저 확인하고, 메뉴 URL과 연결된 화면/컨트롤러/서비스/매퍼 범위를 식별한 뒤 기능을 구현하거나 보완하세요. 기존 동작을 깨지 말고, 변경 파일과 검증 결과를 함께 보고하세요.");
        return builder.toString();
    }

    private int deriveCoverageScore(Map<String, Object> registryEntry) {
        int score = 0;
        if (!stringValue(registryEntry.get("pageId")).isEmpty()) score += 10;
        if (!normalizeObjectList(registryEntry.get("componentIds")).isEmpty()) score += 15;
        if (!normalizeObjectList(registryEntry.get("eventIds")).isEmpty()) score += 10;
        if (!normalizeObjectList(registryEntry.get("apiIds")).isEmpty()) score += 15;
        if (!normalizeObjectList(registryEntry.get("controllerActions")).isEmpty()) score += 15;
        if (!normalizeObjectList(registryEntry.get("serviceMethods")).isEmpty()) score += 15;
        if (!normalizeObjectList(registryEntry.get("mapperQueries")).isEmpty()) score += 10;
        if (!normalizeObjectList(registryEntry.get("tableNames")).isEmpty()) score += 10;
        return score;
    }

    private Map<String, Object> buildScheduleMetrics(String status,
                                                     LocalDate plannedStartDate,
                                                     LocalDate plannedEndDate,
                                                     LocalDate actualStartDate,
                                                     LocalDate actualEndDate) {
        Map<String, Object> metrics = new LinkedHashMap<>();
        LocalDate today = LocalDate.now();
        boolean hasPlannedSchedule = plannedStartDate != null || plannedEndDate != null;
        LocalDate actualFinishOrToday = actualEndDate != null ? actualEndDate : today;
        int varianceDays = plannedEndDate == null ? 0 : (int) ChronoUnit.DAYS.between(plannedEndDate, actualFinishOrToday);
        boolean overdue = !STATUS_DONE.equals(status) && plannedEndDate != null && plannedEndDate.isBefore(today);
        boolean completedOnTime = STATUS_DONE.equals(status) && plannedEndDate != null && actualEndDate != null && !actualEndDate.isAfter(plannedEndDate);
        metrics.put("hasPlannedSchedule", hasPlannedSchedule);
        metrics.put("varianceDays", varianceDays);
        metrics.put("overdue", overdue);
        metrics.put("completedOnTime", completedOnTime);
        metrics.put("plannedDurationDays", durationDays(plannedStartDate, plannedEndDate));
        metrics.put("actualDurationDays", durationDays(actualStartDate, actualEndDate));
        return metrics;
    }

    private int durationDays(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            return 0;
        }
        return (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }

    private LocalDate sortAnchorDate(Map<String, Object> row) {
        LocalDate plannedStartDate = parseDate(stringValue(row.get("plannedStartDate")));
        if (plannedStartDate != null) {
            return plannedStartDate;
        }
        LocalDate actualStartDate = parseDate(stringValue(row.get("actualStartDate")));
        if (actualStartDate != null) {
            return actualStartDate;
        }
        return parseDate(stringValue(row.get("plannedEndDate")));
    }

    private boolean boolValue(Object value) {
        return value instanceof Boolean ? (Boolean) value : "true".equalsIgnoreCase(stringValue(value));
    }

    private String joinValues(Object value) {
        List<String> values = normalizeObjectList(value);
        return values.isEmpty() ? "" : String.join(" | ", values);
    }

    private String formatDate(LocalDate value) {
        return value == null ? "" : value.format(DATE_FORMAT);
    }

    private List<Map<String, Object>> mapMenuRows(List<MenuInfoDTO> menuRows) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (MenuInfoDTO menuRow : menuRows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("code", safe(menuRow.getCode()).toUpperCase(Locale.ROOT));
            item.put("codeNm", safe(menuRow.getCodeNm()));
            item.put("codeDc", safe(menuRow.getCodeDc()));
            item.put("menuUrl", safe(menuRow.getMenuUrl()));
            item.put("menuIcon", safe(menuRow.getMenuIcon()));
            item.put("useAt", safe(menuRow.getUseAt()));
            item.put("sortOrdr", menuRow.getSortOrdr() == null ? 0 : menuRow.getSortOrdr());
            result.add(item);
        }
        return result;
    }

    private List<MenuInfoDTO> loadMenus(String codeId) {
        try {
            List<MenuInfoDTO> rows = new ArrayList<>(menuInfoReadPort.selectMenuTreeList(codeId));
            rows.sort(Comparator
                    .comparingInt((MenuInfoDTO row) -> row.getSortOrdr() == null ? Integer.MAX_VALUE : row.getSortOrdr())
                    .thenComparing(row -> safe(row.getCode())));
            return rows;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private List<MenuInfoDTO> filterPageMenus(List<MenuInfoDTO> rows) {
        List<MenuInfoDTO> result = new ArrayList<>();
        for (MenuInfoDTO row : rows) {
            if (safe(row.getCode()).length() == 8) {
                result.add(row);
            }
        }
        return result;
    }

    private List<WbsDraftRow> buildDraftRows(String scope, List<MenuInfoDTO> pageMenus) {
        List<WbsDraftRow> rows = new ArrayList<>();
        Map<Integer, Integer> waveSequence = new LinkedHashMap<>();
        for (MenuInfoDTO menu : pageMenus) {
            String menuCode = safe(menu.getCode()).toUpperCase(Locale.ROOT);
            WavePlan wavePlan = resolveWave(scope, safe(menu.getMenuUrl()), safe(menu.getCodeNm()));
            int sequence = waveSequence.getOrDefault(wavePlan.order, 0) + 1;
            waveSequence.put(wavePlan.order, sequence);
            rows.add(new WbsDraftRow(
                    scope.substring(0, 1) + wavePlan.order + "." + String.format(Locale.ROOT, "%02d", sequence),
                    scope,
                    wavePlan.label,
                    wavePlan.order,
                    menuCode,
                    safe(menu.getCodeNm()),
                    safe(menu.getCodeDc()),
                    safe(menu.getMenuUrl()),
                    wavePlan.taskType,
                    wavePlan.deliverable,
                    wavePlan.predecessor,
                    wavePlan.priority
            ));
        }
        return rows;
    }

    private WavePlan resolveWave(String scope, String menuUrl, String menuName) {
        String path = safe(menuUrl).toLowerCase(Locale.ROOT);
        String name = safe(menuName).toLowerCase(Locale.ROOT);
        if ("HOME".equals(scope)) {
            if (path.equals("/home") || path.equals("/signin/loginview") || path.equals("/sitemap") || path.contains("placeholder")) {
                return new WavePlan("Wave 1. 공통 진입", 1, "공통 진입 안정화", "진입/새로고침/국문영문 점검표", "없음", "최고");
            }
            if (path.startsWith("/signin/")) {
                return new WavePlan("Wave 2. 인증/복구", 2, "공개 인증/계정복구", "세션/CSRF/예외 플로우 점검표", "Wave 1", "높음");
            }
            if (path.startsWith("/join/")) {
                return new WavePlan("Wave 3. 가입 플로우", 3, "회원가입/재신청", "단계별 입력/검증/완료 흐름표", "Wave 2", "높음");
            }
            if (path.startsWith("/mypage")) {
                return new WavePlan("Wave 4. 사용자 셀프서비스", 4, "마이페이지", "사용자 셀프서비스 점검표", "Wave 3", "중간");
            }
            return new WavePlan("Wave 5. 공개 기타", 5, "공개 기타 메뉴", "메뉴별 readiness 점검표", "Wave 1", "중간");
        }
        if (path.equals("/admin/") || path.contains("placeholder") || path.contains("/content/sitemap")) {
            return new WavePlan("Wave 1. 관리자 진입", 1, "관리자 진입/탐색", "관리자 공통 shell/탐색 점검표", "없음", "최고");
        }
        if (path.contains("/auth-group") || path.contains("/auth-change") || path.contains("/dept-role") || path.contains("/admin_account")) {
            return new WavePlan("Wave 2. 권한/계정", 2, "관리자 권한체계", "권한/계정 저장-조회 검증표", "Wave 1", "높음");
        }
        if (path.contains("/member/") || path.contains("/emission/")) {
            return new WavePlan("Wave 3. 회원/회원사 운영", 3, "회원/회원사 핵심 운영", "목록-상세-수정-승인 흐름표", "Wave 2", "높음");
        }
        if (path.contains("/system/code")
                || path.contains("/ip_whitelist")
                || path.contains("/system/security")
                || path.contains("/blocklist")
                || path.contains("/scheduler")
                || path.contains("/observability")) {
            return new WavePlan("Wave 4. 시스템 운영", 4, "보안/운영", "정책/감사/운영 점검표", "Wave 3", "중간");
        }
        if (path.contains("/page-management")
                || path.contains("/function-management")
                || path.contains("/menu-management")
                || path.contains("/full-stack-management")
                || path.contains("/platform-studio")
                || path.contains("/screen-elements-management")
                || path.contains("/event-management-console")
                || path.contains("/api-management-console")
                || path.contains("/controller-management-console")
                || path.contains("/db-table-management")
                || path.contains("/column-management-console")
                || path.contains("/automation-studio")
                || path.contains("/environment-management")
                || path.contains("/wbs-management")
                || path.contains("/help-management")
                || path.contains("/sr-workbench")
                || path.contains("/codex-request")
                || name.contains("플랫폼")
                || name.contains("도움말")
                || name.contains("wbs")) {
            return new WavePlan("Wave 5. 플랫폼/거버넌스", 5, "메타/플랫폼 관리", "거버넌스/도구 메뉴 점검표", "Wave 4", "중간");
        }
        return new WavePlan("Wave 6. 기타 관리자", 6, "기타 관리자 메뉴", "개별 메뉴 readiness 점검표", "Wave 3", "낮음");
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
            return new LinkedHashMap<>();
        }
    }

    private void saveAll(Map<String, Map<String, Object>> entries) {
        try {
            Files.createDirectories(registryPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(registryPath.toFile(), entries);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save WBS entries.", e);
        }
    }

    private String entryKey(String menuType, String menuCode) {
        return normalizeMenuType(menuType) + ":" + normalize(menuCode).toUpperCase(Locale.ROOT);
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(normalize(menuType)) ? "USER" : "ADMIN";
    }

    private String normalizeStatus(String value) {
        String normalized = normalize(value).toUpperCase(Locale.ROOT);
        if (STATUS_IN_PROGRESS.equals(normalized) || STATUS_BLOCKED.equals(normalized) || STATUS_DONE.equals(normalized)) {
            return normalized;
        }
        return STATUS_NOT_STARTED;
    }

    private void validateDate(String value, String fieldName) {
        String normalized = normalize(value);
        if (normalized.isEmpty()) {
            return;
        }
        try {
            LocalDate.parse(normalized, DATE_FORMAT);
        } catch (Exception e) {
            throw new IllegalArgumentException(fieldName + " must use yyyy-MM-dd format.");
        }
    }

    private LocalDate parseDate(String value) {
        if (normalize(value).isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(value, DATE_FORMAT);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String routeId(String menuUrl) {
        return normalize(ReactPageUrlMapper.resolveRouteIdForPath(menuUrl)).replace('_', '-');
    }

    private Map<String, String> option(String value, String label, String labelEn) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("value", value);
        option.put("label", label);
        option.put("labelEn", labelEn);
        return option;
    }

    private List<String> normalizeObjectList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        Set<String> unique = new LinkedHashSet<>();
        for (Object item : (List<?>) value) {
            String normalized = normalize(item == null ? null : String.valueOf(item));
            if (!normalized.isEmpty()) {
                unique.add(normalized);
            }
        }
        return new ArrayList<>(unique);
    }

    private int safeInt(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String parentCode(String code) {
        String normalized = normalize(code).toUpperCase(Locale.ROOT);
        if (normalized.length() == 8) {
            return normalized.substring(0, 6);
        }
        if (normalized.length() == 6) {
            return normalized.substring(0, 4);
        }
        return "";
    }

    private static class WavePlan {
        private final String label;
        private final int order;
        private final String taskType;
        private final String deliverable;
        private final String predecessor;
        private final String priority;

        private WavePlan(String label, int order, String taskType, String deliverable, String predecessor, String priority) {
            this.label = label;
            this.order = order;
            this.taskType = taskType;
            this.deliverable = deliverable;
            this.predecessor = predecessor;
            this.priority = priority;
        }
    }

    private static class WbsDraftRow {
        private final String wbsId;
        private final String scope;
        private final String waveLabel;
        private final int waveOrder;
        private final String menuCode;
        private final String menuName;
        private final String menuNameEn;
        private final String menuUrl;
        private final String taskType;
        private final String deliverable;
        private final String predecessor;
        private final String priority;

        private WbsDraftRow(String wbsId,
                            String scope,
                            String waveLabel,
                            int waveOrder,
                            String menuCode,
                            String menuName,
                            String menuNameEn,
                            String menuUrl,
                            String taskType,
                            String deliverable,
                            String predecessor,
                            String priority) {
            this.wbsId = wbsId;
            this.scope = scope;
            this.waveLabel = waveLabel;
            this.waveOrder = waveOrder;
            this.menuCode = menuCode;
            this.menuName = menuName;
            this.menuNameEn = menuNameEn;
            this.menuUrl = menuUrl;
            this.taskType = taskType;
            this.deliverable = deliverable;
            this.predecessor = predecessor;
            this.priority = priority;
        }
    }
}
