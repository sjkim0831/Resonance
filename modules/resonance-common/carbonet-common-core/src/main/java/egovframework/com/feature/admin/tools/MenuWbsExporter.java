package egovframework.com.feature.admin.tools;

import egovframework.com.CarbonetApplication;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MenuWbsExporter {

    public static void main(String[] args) throws Exception {
        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(CarbonetApplication.class)
                .web(WebApplicationType.NONE)
                .run(args)) {
            MenuInfoService menuInfoService = context.getBean(MenuInfoService.class);
            List<MenuInfoDTO> homeMenus = safeMenus(menuInfoService, "HMENU1");
            List<MenuInfoDTO> adminMenus = safeMenus(menuInfoService, "AMENU1");
            LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
            String dateToken = today.format(DateTimeFormatter.BASIC_ISO_DATE);
            Path docsDir = Path.of("docs", "operations");
            Files.createDirectories(docsDir);

            Path markdownPath = docsDir.resolve("db-menu-work-order-wbs-" + dateToken + ".md");
            Path csvPath = docsDir.resolve("db-menu-work-order-wbs-" + dateToken + ".csv");

            Files.writeString(markdownPath, buildMarkdown(today, homeMenus, adminMenus));
            Files.writeString(csvPath, buildCsv(homeMenus, adminMenus));

            System.out.println("WBS exported:");
            System.out.println(markdownPath.toAbsolutePath());
            System.out.println(csvPath.toAbsolutePath());
        }
    }

    private static List<MenuInfoDTO> safeMenus(MenuInfoService menuInfoService, String codeId) throws Exception {
        List<MenuInfoDTO> rows = new ArrayList<>(menuInfoService.selectMenuTreeList(codeId));
        rows.sort(Comparator
                .comparingInt((MenuInfoDTO row) -> row.getSortOrdr() == null ? Integer.MAX_VALUE : row.getSortOrdr())
                .thenComparing(row -> safe(row.getCode())));
        return rows;
    }

    private static String buildMarkdown(LocalDate today, List<MenuInfoDTO> homeMenus, List<MenuInfoDTO> adminMenus) {
        StringBuilder builder = new StringBuilder();
        builder.append("# Carbonet DB Menu Work Order WBS\n\n");
        builder.append("기준일: ").append(today).append("\n\n");
        builder.append("기준 소스:\n\n");
        builder.append("- DB `MenuInfoService.selectMenuTreeList(\"HMENU1\")`\n");
        builder.append("- DB `MenuInfoService.selectMenuTreeList(\"AMENU1\")`\n\n");

        builder.append("## 1. DB 메뉴 인벤토리 요약\n\n");
        builder.append("- HOME 전체 메뉴 행: ").append(homeMenus.size()).append("개\n");
        builder.append("- ADMIN 전체 메뉴 행: ").append(adminMenus.size()).append("개\n");
        builder.append("- HOME 페이지 메뉴(8자리): ").append(countPageMenus(homeMenus)).append("개\n");
        builder.append("- ADMIN 페이지 메뉴(8자리): ").append(countPageMenus(adminMenus)).append("개\n\n");

        builder.append("## 2. HOME 메뉴 전체 목록\n\n");
        appendInventoryTable(builder, homeMenus, "HOME");
        builder.append("\n## 3. ADMIN 메뉴 전체 목록\n\n");
        appendInventoryTable(builder, adminMenus, "ADMIN");

        List<WbsRow> homeWbsRows = buildWbsRows("HOME", homeMenus);
        List<WbsRow> adminWbsRows = buildWbsRows("ADMIN", adminMenus);

        builder.append("\n## 4. 추천 작업 순서\n\n");
        appendWaveSummary(builder, "HOME", homeWbsRows);
        appendWaveSummary(builder, "ADMIN", adminWbsRows);

        builder.append("\n## 5. 실행용 WBS\n\n");
        builder.append("| WBS | Scope | Wave | 메뉴코드 | 메뉴명 | URL | 작업유형 | 산출물 | 선행조건 | 우선순위 |\n");
        builder.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n");
        List<WbsRow> allRows = new ArrayList<>();
        allRows.addAll(homeWbsRows);
        allRows.addAll(adminWbsRows);
        allRows.sort(Comparator
                .comparingInt((WbsRow row) -> row.waveOrder)
                .thenComparing(row -> row.scope)
                .thenComparing(row -> row.menuCode));
        for (WbsRow row : allRows) {
            builder.append("| ")
                    .append(row.wbsId).append(" | ")
                    .append(row.scope).append(" | ")
                    .append(row.waveLabel).append(" | ")
                    .append(backtick(row.menuCode)).append(" | ")
                    .append(escapePipe(row.menuName)).append(" | ")
                    .append(backtick(row.menuUrl)).append(" | ")
                    .append(escapePipe(row.taskType)).append(" | ")
                    .append(escapePipe(row.deliverable)).append(" | ")
                    .append(escapePipe(row.predecessor)).append(" | ")
                    .append(escapePipe(row.priority)).append(" |\n");
        }

        builder.append("\n## 6. 작성 규칙\n\n");
        builder.append("- 이 문서는 DB에서 읽은 실제 메뉴를 기준으로 작성했습니다.\n");
        builder.append("- 페이지 메뉴(8자리 코드)는 모두 WBS 행으로 배정했습니다.\n");
        builder.append("- 4/6자리 상위 메뉴는 인벤토리 섹션에서 빠짐없이 유지하고, 작업 순서는 하위 페이지 메뉴 기준으로 정했습니다.\n");
        builder.append("- HOME/ADMIN 모두 메뉴 URL, 운영 영향도, 공통 선행조건 기준으로 wave를 배정했습니다.\n");
        return builder.toString();
    }

    private static String buildCsv(List<MenuInfoDTO> homeMenus, List<MenuInfoDTO> adminMenus) {
        StringBuilder builder = new StringBuilder();
        builder.append("wbs_id,scope,wave,wave_order,menu_code,parent_code,menu_name,menu_name_en,menu_url,task_type,deliverable,predecessor,priority\n");
        List<WbsRow> rows = new ArrayList<>();
        rows.addAll(buildWbsRows("HOME", homeMenus));
        rows.addAll(buildWbsRows("ADMIN", adminMenus));
        rows.sort(Comparator
                .comparingInt((WbsRow row) -> row.waveOrder)
                .thenComparing(row -> row.scope)
                .thenComparing(row -> row.menuCode));
        for (WbsRow row : rows) {
            builder.append(csv(row.wbsId)).append(',')
                    .append(csv(row.scope)).append(',')
                    .append(csv(row.waveLabel)).append(',')
                    .append(row.waveOrder).append(',')
                    .append(csv(row.menuCode)).append(',')
                    .append(csv(parentCode(row.menuCode))).append(',')
                    .append(csv(row.menuName)).append(',')
                    .append(csv(row.menuNameEn)).append(',')
                    .append(csv(row.menuUrl)).append(',')
                    .append(csv(row.taskType)).append(',')
                    .append(csv(row.deliverable)).append(',')
                    .append(csv(row.predecessor)).append(',')
                    .append(csv(row.priority)).append('\n');
        }
        return builder.toString();
    }

    private static void appendInventoryTable(StringBuilder builder, List<MenuInfoDTO> menus, String scope) {
        builder.append("| Scope | 코드 | 단계 | 메뉴명 | 영문명 | URL | 사용 | 정렬 |\n");
        builder.append("| --- | --- | --- | --- | --- | --- | --- | --- |\n");
        for (MenuInfoDTO row : menus) {
            builder.append("| ")
                    .append(scope).append(" | ")
                    .append(backtick(safe(row.getCode()))).append(" | ")
                    .append(codeStage(row.getCode())).append(" | ")
                    .append(escapePipe(safe(row.getCodeNm()))).append(" | ")
                    .append(escapePipe(safe(row.getCodeDc()))).append(" | ")
                    .append(backtick(safe(row.getMenuUrl()))).append(" | ")
                    .append(safe(row.getUseAt())).append(" | ")
                    .append(row.getSortOrdr() == null ? "" : row.getSortOrdr()).append(" |\n");
        }
    }

    private static void appendWaveSummary(StringBuilder builder, String scope, List<WbsRow> rows) {
        Map<Integer, List<WbsRow>> byWave = new LinkedHashMap<>();
        for (WbsRow row : rows) {
            byWave.computeIfAbsent(row.waveOrder, key -> new ArrayList<>()).add(row);
        }
        builder.append("### ").append(scope).append("\n\n");
        for (Map.Entry<Integer, List<WbsRow>> entry : byWave.entrySet()) {
            List<WbsRow> waveRows = entry.getValue();
            builder.append("- ").append(waveRows.get(0).waveLabel).append(": ");
            builder.append(waveRows.stream().map(row -> backtick(row.menuCode)).reduce((a, b) -> a + ", " + b).orElse("-"));
            builder.append('\n');
        }
        builder.append('\n');
    }

    private static List<WbsRow> buildWbsRows(String scope, List<MenuInfoDTO> menus) {
        List<WbsRow> rows = new ArrayList<>();
        Map<Integer, Integer> waveSequence = new LinkedHashMap<>();
        for (MenuInfoDTO menu : menus) {
            String menuCode = safe(menu.getCode()).toUpperCase(Locale.ROOT);
            if (menuCode.length() != 8) {
                continue;
            }
            WavePlan wavePlan = resolveWave(scope, safe(menu.getMenuUrl()), safe(menu.getCodeNm()));
            int sequence = waveSequence.getOrDefault(wavePlan.order, 0) + 1;
            waveSequence.put(wavePlan.order, sequence);
            rows.add(new WbsRow(
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

    private static WavePlan resolveWave(String scope, String menuUrl, String menuName) {
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
                || path.contains("/help-management")
                || path.contains("/sr-workbench")
                || path.contains("/codex-request")
                || name.contains("플랫폼")
                || name.contains("도움말")) {
            return new WavePlan("Wave 5. 플랫폼/거버넌스", 5, "메타/플랫폼 관리", "거버넌스/도구 메뉴 점검표", "Wave 4", "중간");
        }
        return new WavePlan("Wave 6. 기타 관리자", 6, "기타 관리자 메뉴", "개별 메뉴 readiness 점검표", "Wave 3", "낮음");
    }

    private static int countPageMenus(List<MenuInfoDTO> menus) {
        int count = 0;
        for (MenuInfoDTO menu : menus) {
            if (safe(menu.getCode()).length() == 8) {
                count++;
            }
        }
        return count;
    }

    private static String codeStage(String code) {
        int length = safe(code).length();
        if (length == 4) {
            return "TOP";
        }
        if (length == 6) {
            return "GROUP";
        }
        if (length == 8) {
            return "PAGE";
        }
        return "OTHER";
    }

    private static String parentCode(String code) {
        String normalized = safe(code);
        if (normalized.length() == 8) {
            return normalized.substring(0, 6);
        }
        if (normalized.length() == 6) {
            return normalized.substring(0, 4);
        }
        return "";
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String escapePipe(String value) {
        return safe(value).replace("|", "\\|").replace("\n", " ");
    }

    private static String backtick(String value) {
        String normalized = safe(value);
        return normalized.isEmpty() ? "" : "`" + normalized + "`";
    }

    private static String csv(String value) {
        String normalized = safe(value).replace("\"", "\"\"");
        return "\"" + normalized + "\"";
    }

    private static class WavePlan {
        private final String label;
        private final int order;
        private final String taskType;
        private final String deliverable;
        private final String predecessor;
        private final String priority;

        private WavePlan(String label,
                         int order,
                         String taskType,
                         String deliverable,
                         String predecessor,
                         String priority) {
            this.label = label;
            this.order = order;
            this.taskType = taskType;
            this.deliverable = deliverable;
            this.predecessor = predecessor;
            this.priority = priority;
        }
    }

    private static class WbsRow {
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

        private WbsRow(String wbsId,
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
