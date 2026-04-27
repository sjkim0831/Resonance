package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.codex.model.FeatureReferenceCountVO;
import egovframework.com.platform.governance.model.vo.PageManagementVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.read.MenuInfoReadPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminPageManagementPageService {

    private static final Logger log = LoggerFactory.getLogger(AdminPageManagementPageService.class);

    private final AdminCodeManageService adminCodeManageService;
    private final AuthGroupManageService authGroupManageService;
    private final MenuInfoReadPort menuInfoReadPort;
    private final AdminReactRouteSupport adminReactRouteSupport;

    public Map<String, Object> buildPageManagementPageData(
            String menuType,
            String searchKeyword,
            String searchUrl,
            String autoFeature,
            String updated,
            String deleted,
            String deletedRoleRefs,
            String deletedUserOverrides,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        Map<String, Object> payload = new LinkedHashMap<>();

        List<PageManagementVO> pageRows = loadPageManagementRows(codeId, searchKeyword, searchUrl);
        applyPageManagementPermissionImpact(pageRows);
        if ("USER".equals(normalizedMenuType)) {
            pageRows = mergeUserPublicCatalogRows(pageRows, isEn, searchKeyword, searchUrl);
        }

        payload.put("pageRows", pageRows);
        payload.put("menuType", normalizedMenuType);
        payload.put("domainOptions", loadPageDomainOptions(isEn, codeId));
        payload.put("iconOptions", buildPageIconOptions());
        payload.put("useAtOptions", List.of("Y", "N"));
        payload.put("searchKeyword", safeString(searchKeyword));
        payload.put("searchUrl", safeString(searchUrl));
        applyPageManagementMessage(payload, isEn, autoFeature, updated, deleted, deletedRoleRefs, deletedUserOverrides);
        applyQueryError(payload, "pageMgmtError", request);
        return payload;
    }

    private List<PageManagementVO> loadPageManagementRows(String codeId, String searchKeyword, String searchUrl) {
        try {
            List<PageManagementVO> rows = adminCodeManageService.selectPageManagementList(codeId, searchKeyword, searchUrl);
            for (PageManagementVO row : rows) {
                row.setMenuUrl(canonicalMenuUrl(row.getMenuUrl()));
            }
            return rows;
        } catch (Exception e) {
            log.error("Failed to load page management rows.", e);
            return Collections.emptyList();
        }
    }

    private void applyPageManagementPermissionImpact(List<PageManagementVO> pageRows) {
        if (pageRows == null || pageRows.isEmpty()) {
            return;
        }
        List<String> featureCodes = new ArrayList<>();
        for (PageManagementVO row : pageRows) {
            String pageCode = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (pageCode.isEmpty()) {
                row.setDefaultViewRoleRefCount(0);
                row.setDefaultViewUserOverrideCount(0);
                continue;
            }
            featureCodes.add(buildDefaultViewFeatureCode(pageCode));
        }
        if (featureCodes.isEmpty()) {
            return;
        }

        Map<String, Integer> roleRefCountMap = Collections.emptyMap();
        Map<String, Integer> userOverrideCountMap = Collections.emptyMap();
        try {
            roleRefCountMap = toReferenceCountMap(authGroupManageService.selectAuthorFeatureRelationCounts(featureCodes));
            userOverrideCountMap = toReferenceCountMap(authGroupManageService.selectUserFeatureOverrideCounts(featureCodes));
        } catch (Exception e) {
            log.error("Failed to load page permission impact batch. featureCodes={}", featureCodes, e);
        }

        for (PageManagementVO row : pageRows) {
            String pageCode = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (pageCode.isEmpty()) {
                continue;
            }
            String featureCode = buildDefaultViewFeatureCode(pageCode);
            row.setDefaultViewRoleRefCount(roleRefCountMap.getOrDefault(featureCode, 0));
            row.setDefaultViewUserOverrideCount(userOverrideCountMap.getOrDefault(featureCode, 0));
        }
    }

    private Map<String, Integer> toReferenceCountMap(List<FeatureReferenceCountVO> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, Integer> counts = new HashMap<>();
        for (FeatureReferenceCountVO row : rows) {
            String featureCode = safeString(row.getFeatureCode()).toUpperCase(Locale.ROOT);
            if (!featureCode.isEmpty()) {
                counts.put(featureCode, row.getReferenceCount());
            }
        }
        return counts;
    }

    private List<Map<String, String>> loadPageDomainOptions(boolean isEn, String codeId) {
        try {
            List<MenuInfoDTO> rows = menuInfoReadPort.selectAdminMenuDetailList(codeId);
            List<Map<String, String>> options = new ArrayList<>();
            for (MenuInfoDTO row : rows) {
                String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
                if (code.length() != 6) {
                    continue;
                }
                Map<String, String> option = new LinkedHashMap<>();
                option.put("value", code);
                option.put("label", code + " · " + (isEn ? safeString(row.getCodeDc()) : safeString(row.getCodeNm())));
                option.put("menuUrlPrefix", canonicalMenuUrl(row.getMenuUrl()));
                options.add(option);
            }
            return options;
        } catch (Exception e) {
            log.error("Failed to load page domain options. codeId={}", codeId, e);
            return Collections.emptyList();
        }
    }

    private List<PageManagementVO> mergeUserPublicCatalogRows(List<PageManagementVO> pageRows, boolean isEn, String searchKeyword, String searchUrl) {
        Map<String, PageManagementVO> rowByUrl = new LinkedHashMap<>();
        for (PageManagementVO row : pageRows) {
            rowByUrl.put(safeString(row.getMenuUrl()), row);
        }

        List<PageManagementVO> merged = new ArrayList<>(pageRows);
        for (PageManagementVO catalogRow : buildUserPublicCatalogRows(isEn)) {
            String url = safeString(catalogRow.getMenuUrl());
            PageManagementVO existing = rowByUrl.get(url);
            if (existing != null) {
                existing.setCatalogManaged(true);
                existing.setCatalogRegistered(true);
                existing.setManagementNote(isEn ? "Public flow catalog synced" : "공개 플로우 카탈로그 반영");
                continue;
            }
            if (matchesPageManagementSearch(catalogRow, searchKeyword, searchUrl)) {
                merged.add(catalogRow);
            }
        }

        merged.sort(Comparator
                .comparing(PageManagementVO::getDomainName, Comparator.nullsLast(String::compareTo))
                .thenComparing(PageManagementVO::getMenuUrl, Comparator.nullsLast(String::compareTo))
                .thenComparing(PageManagementVO::getCode, Comparator.nullsLast(String::compareTo)));
        return merged;
    }

    private boolean matchesPageManagementSearch(PageManagementVO row, String searchKeyword, String searchUrl) {
        String keyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String urlKeyword = safeString(searchUrl).toLowerCase(Locale.ROOT);
        if (!keyword.isEmpty()) {
            String code = safeString(row.getCode()).toLowerCase(Locale.ROOT);
            String codeNm = safeString(row.getCodeNm()).toLowerCase(Locale.ROOT);
            String codeDc = safeString(row.getCodeDc()).toLowerCase(Locale.ROOT);
            if (!code.contains(keyword) && !codeNm.contains(keyword) && !codeDc.contains(keyword)) {
                return false;
            }
        }
        return urlKeyword.isEmpty() || safeString(row.getMenuUrl()).toLowerCase(Locale.ROOT).contains(urlKeyword);
    }

    private List<PageManagementVO> buildUserPublicCatalogRows(boolean isEn) {
        return Arrays.asList(
                catalogRow("CAT-SIGNIN-01", "로그인", "Login", "/signin/loginView", "로그인·계정찾기", "Sign In", "login", isEn),
                catalogRow("CAT-SIGNIN-02", "인증방식 선택", "Choose Authentication", "/signin/authChoice", "로그인·계정찾기", "Sign In", "verified_user", isEn),
                catalogRow("CAT-SIGNIN-03", "아이디 찾기", "Find ID", "/signin/findId", "로그인·계정찾기", "Sign In", "search", isEn),
                catalogRow("CAT-SIGNIN-04", "아이디 찾기 결과", "Find ID Result", "/signin/findId/result", "로그인·계정찾기", "Sign In", "fact_check", isEn),
                catalogRow("CAT-SIGNIN-05", "비밀번호 찾기", "Reset Password", "/signin/findPassword", "로그인·계정찾기", "Sign In", "vpn_key", isEn),
                catalogRow("CAT-SIGNIN-06", "비밀번호 찾기 결과", "Reset Password Result", "/signin/findPassword/result", "로그인·계정찾기", "Sign In", "task_alt", isEn),
                catalogRow("CAT-JOIN-01", "1단계. 회원유형 선택", "Step 1. Member Type", "/join/step1", "회원가입", "Join", "how_to_reg", isEn),
                catalogRow("CAT-JOIN-02", "2단계. 약관 동의", "Step 2. Terms Agreement", "/join/step2", "회원가입", "Join", "article", isEn),
                catalogRow("CAT-JOIN-03", "3단계. 본인인증", "Step 3. Identity Verification", "/join/step3", "회원가입", "Join", "verified", isEn),
                catalogRow("CAT-JOIN-04", "4단계. 회원정보 입력", "Step 4. Member Information", "/join/step4", "회원가입", "Join", "edit_note", isEn),
                catalogRow("CAT-JOIN-05", "5단계. 가입 완료", "Step 5. Complete", "/join/step5", "회원가입", "Join", "check_circle", isEn),
                catalogRow("CAT-COMPANY-01", "회원사 가입 신청", "Company Registration", "/join/companyRegister", "회원사 가입", "Company Membership", "apartment", isEn),
                catalogRow("CAT-COMPANY-02", "회원사 가입 신청 완료", "Registration Complete", "/join/companyRegisterComplete", "회원사 가입", "Company Membership", "task", isEn),
                catalogRow("CAT-COMPANY-03", "가입현황 조회", "Status Search", "/join/companyJoinStatusSearch", "회원사 가입", "Company Membership", "travel_explore", isEn),
                catalogRow("CAT-COMPANY-04", "가입현황 안내", "Status Guide", "/join/companyJoinStatusGuide", "회원사 가입", "Company Membership", "info", isEn),
                catalogRow("CAT-COMPANY-05", "가입현황 상세", "Status Detail", "/join/companyJoinStatusDetail", "회원사 가입", "Company Membership", "description", isEn),
                catalogRow("CAT-COMPANY-06", "재신청", "Reapply", "/join/companyReapply", "회원사 가입", "Company Membership", "sync", isEn),
                catalogRow("CAT-MEMBER-01", "마이페이지", "My Page", "/mypage", "회원 공통", "Member Common", "person", isEn),
                catalogRow("CAT-SITEMAP-01", "사이트맵", "Site Map", "/sitemap", "회원 공통", "Member Common", "account_tree", isEn)
        );
    }

    private PageManagementVO catalogRow(String code, String codeNm, String codeDc, String menuUrl,
                                        String domainNameKo, String domainNameEn, String menuIcon, boolean isEn) {
        PageManagementVO row = new PageManagementVO();
        row.setCode(code);
        row.setCodeNm(codeNm);
        row.setCodeDc(codeDc);
        row.setMenuUrl(isEn ? mapEnglishPublicUrl(menuUrl) : menuUrl);
        row.setMenuIcon(menuIcon);
        row.setUseAt("Y");
        row.setDomainName(domainNameKo);
        row.setDomainNameEn(domainNameEn);
        row.setCatalogManaged(true);
        row.setCatalogRegistered(false);
        row.setManagementNote(isEn ? "Catalog-only public flow" : "카탈로그 기준 공개 플로우");
        return row;
    }

    private String mapEnglishPublicUrl(String menuUrl) {
        String normalized = safeString(menuUrl);
        if (normalized.startsWith("/signin/")) {
            return "/en" + normalized;
        }
        if (normalized.startsWith("/join/")) {
            if (normalized.startsWith("/join/en/")) {
                return normalized;
            }
            if ("/join/step1".equals(normalized)) {
                return "/join/en/step1";
            }
            return normalized.replaceFirst("^/join/", "/join/en/");
        }
        if ("/mypage".equals(normalized)) {
            return "/en/mypage";
        }
        if ("/sitemap".equals(normalized)) {
            return "/en/sitemap";
        }
        return normalized;
    }

    private List<String> buildPageIconOptions() {
        return List.of(
                "web", "category", "settings", "dashboard", "admin_panel_settings",
                "monitoring", "api", "list_alt", "article", "folder",
                "manage_accounts", "groups", "person_search", "how_to_reg", "history",
                "bar_chart", "search", "badge", "co2", "verified",
                "fact_check", "receipt_long", "payments", "currency_exchange", "ad",
                "open_in_new", "hub", "dns", "security", "backup",
                "sensors", "apartment", "support_agent", "dataset", "description",
                "inventory", "menu", "menu_open", "home", "settings_applications",
                "tune", "display_settings", "terminal", "storage", "database",
                "view_list", "table_rows", "edit_note", "edit_square", "note_add",
                "delete", "delete_forever", "check_circle", "cancel", "warning",
                "error", "info", "notifications", "mail", "call",
                "public", "language", "travel_explore", "account_tree", "schema",
                "lan", "link", "integration_instructions", "sync", "sync_alt",
                "cloud", "cloud_sync", "cloud_done", "download", "upload",
                "download_for_offline", "upload_file", "attach_file", "image",
                "photo", "smart_display", "campaign", "flag", "help",
                "help_center", "extension", "widgets", "apps", "grid_view",
                "filter_alt", "sort", "calendar_month", "schedule", "today",
                "assignment", "assignment_ind", "assignment_turned_in", "task",
                "rule", "policy", "gavel", "shield", "shield_lock",
                "lock", "lock_open", "key", "vpn_key", "fingerprint",
                "bolt", "construction", "build", "build_circle", "engineering",
                "science", "psychology", "precision_manufacturing", "settings_ethernet", "router",
                "wifi", "memory", "developer_board", "devices", "desktop_windows",
                "laptop", "phone_iphone", "print", "qr_code", "sell",
                "shopping_cart", "request_quote", "account_balance", "insights", "timeline"
        );
    }

    private void applyPageManagementMessage(Map<String, Object> target,
                                            boolean isEn,
                                            String autoFeature,
                                            String updated,
                                            String deleted,
                                            String deletedRoleRefs,
                                            String deletedUserOverrides) {
        if ("Y".equalsIgnoreCase(safeString(autoFeature))) {
            target.put("pageMgmtMessage", isEn
                    ? "The page was saved and the default VIEW feature was generated."
                    : "페이지를 저장했고 기본 VIEW 기능도 함께 생성했습니다.");
            return;
        }
        if ("Y".equalsIgnoreCase(safeString(updated))) {
            target.put("pageMgmtMessage", isEn
                    ? "The page was updated and the default VIEW feature metadata was synchronized."
                    : "페이지를 수정했고 기본 VIEW 기능 메타데이터도 함께 동기화했습니다.");
            return;
        }
        if ("Y".equalsIgnoreCase(safeString(deleted))) {
            int deletedRoleRefCount = safeParseInt(deletedRoleRefs);
            int deletedUserOverrideCount = safeParseInt(deletedUserOverrides);
            target.put("pageMgmtMessage", isEn
                    ? "The page was deleted and default VIEW permission references were cleaned up. Role mappings: "
                    + deletedRoleRefCount + ", user overrides: " + deletedUserOverrideCount + "."
                    : "페이지를 삭제했고 기본 VIEW 권한 참조도 함께 정리했습니다. 권한그룹 매핑 "
                    + deletedRoleRefCount + "건, 사용자 예외권한 " + deletedUserOverrideCount + "건.");
        }
    }

    private void applyQueryError(Map<String, Object> target, String attributeName, HttpServletRequest request) {
        String errorMessage = safeString(request == null ? null : request.getParameter("errorMessage"));
        if (!errorMessage.isEmpty()) {
            target.put(attributeName, errorMessage);
        }
    }

    private String buildDefaultViewFeatureCode(String pageCode) {
        String normalizedPageCode = safeString(pageCode).toUpperCase(Locale.ROOT);
        if (normalizedPageCode.isEmpty()) {
            return "";
        }
        return normalizedPageCode + "_VIEW";
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(safeString(menuType)) ? "USER" : "ADMIN";
    }

    private String resolveMenuCodeId(String menuType) {
        return "USER".equals(menuType) ? "HMENU1" : "AMENU1";
    }

    private String canonicalMenuUrl(String menuUrl) {
        String normalized = safeString(menuUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(normalized);
        return canonical.isEmpty() ? normalized : canonical;
    }

    private int safeParseInt(String value) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
