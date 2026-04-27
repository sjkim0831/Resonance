package egovframework.com.feature.admin.tools;

import egovframework.com.CarbonetApplication;
import egovframework.com.platform.governance.dto.WbsManagementSaveRequest;
import egovframework.com.platform.governance.service.WbsManagementService;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class WbsManagementBulkSeedTool {

    private static final Set<LocalDate> HOLIDAYS_2026 = new HashSet<>(List.of(
            LocalDate.of(2026, 1, 1),
            LocalDate.of(2026, 2, 16),
            LocalDate.of(2026, 2, 17),
            LocalDate.of(2026, 2, 18),
            LocalDate.of(2026, 3, 1),
            LocalDate.of(2026, 3, 2),
            LocalDate.of(2026, 5, 5),
            LocalDate.of(2026, 5, 24),
            LocalDate.of(2026, 5, 25),
            LocalDate.of(2026, 6, 6),
            LocalDate.of(2026, 8, 15),
            LocalDate.of(2026, 8, 17),
            LocalDate.of(2026, 9, 24),
            LocalDate.of(2026, 9, 25),
            LocalDate.of(2026, 9, 26),
            LocalDate.of(2026, 10, 3),
            LocalDate.of(2026, 10, 5),
            LocalDate.of(2026, 10, 9),
            LocalDate.of(2026, 12, 25)
    ));

    public static void main(String[] args) throws Exception {
        String owner = property("wbs.seed.owner", "김성준");
        String status = property("wbs.seed.status", "IN_PROGRESS");
        int progress = parseInt(property("wbs.seed.progress", "0"));
        LocalDate startDate = LocalDate.parse(property("wbs.seed.start-date", LocalDate.now().toString()));

        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(CarbonetApplication.class)
                .web(WebApplicationType.NONE)
                .run(args)) {
            WbsManagementService wbsManagementService = context.getBean(WbsManagementService.class);
            LocalDate cursor = nextWorkingDay(startDate);

            cursor = seedMenuType(wbsManagementService, "ADMIN", owner, status, progress, cursor);
            cursor = seedMenuType(wbsManagementService, "USER", owner, status, progress, cursor);

            System.out.println("WBS bulk seed completed.");
            System.out.println("owner=" + owner);
            System.out.println("status=" + status);
            System.out.println("progress=" + progress);
            System.out.println("nextDate=" + cursor);
        }
    }

    private static LocalDate seedMenuType(WbsManagementService wbsManagementService,
                                          String menuType,
                                          String owner,
                                          String status,
                                          int progress,
                                          LocalDate cursor) {
        Map<String, Object> payload = wbsManagementService.buildPagePayload(menuType);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) payload.get("wbsRows");
        if (rows == null) {
            return cursor;
        }
        for (Map<String, Object> row : rows) {
            WbsManagementSaveRequest request = new WbsManagementSaveRequest();
            request.setMenuType(menuType);
            request.setMenuCode(stringValue(row.get("menuCode")));
            request.setOwner(owner);
            request.setStatus(status);
            request.setProgress(progress);
            request.setPlannedStartDate(cursor.toString());
            request.setPlannedEndDate(cursor.toString());
            request.setActualStartDate("");
            request.setActualEndDate("");
            request.setNotes("");
            request.setCodexInstruction("");
            wbsManagementService.saveEntry(request);
            cursor = nextWorkingDay(cursor.plusDays(1));
        }
        return cursor;
    }

    private static LocalDate nextWorkingDay(LocalDate date) {
        LocalDate cursor = date;
        while (isHoliday(cursor) || isWeekend(cursor)) {
            cursor = cursor.plusDays(1);
        }
        return cursor;
    }

    private static boolean isWeekend(LocalDate date) {
        DayOfWeek dayOfWeek = date.getDayOfWeek();
        return dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY;
    }

    private static boolean isHoliday(LocalDate date) {
        return HOLIDAYS_2026.contains(date);
    }

    private static int parseInt(String value) {
        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return 0;
        }
    }

    private static String property(String key, String defaultValue) {
        String value = System.getProperty(key, "");
        return value == null || value.trim().isEmpty() ? defaultValue : value.trim();
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
