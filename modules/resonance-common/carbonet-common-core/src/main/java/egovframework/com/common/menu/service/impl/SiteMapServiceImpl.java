package egovframework.com.common.menu.service.impl;

import egovframework.com.common.menu.model.SiteMapNode;
import egovframework.com.common.menu.service.SiteMapService;
import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.framework.authority.service.FrameworkAuthorityPolicyService;
import egovframework.com.platform.read.MenuInfoReadPort;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SiteMapServiceImpl implements SiteMapService {

    private static final int PUBLIC_ENTRY_SORT = 5;
    private static final int PUBLIC_SIGNIN_SORT = 10;
    private static final int PUBLIC_JOIN_SORT = 20;
    private static final int PUBLIC_COMPANY_SORT = 30;
    private static final int PUBLIC_MYPAGE_SORT = 40;

    private final MenuInfoReadPort menuInfoReadPort;
    private final AuthGroupManageService authGroupManageService;
    private final JwtTokenProvider jwtTokenProvider;
    private final FrameworkAuthorityPolicyService frameworkAuthorityPolicyService;
    private final Object snapshotMonitor = new Object();
    private volatile CachedSiteMapSnapshot userKoreanSnapshot;
    private volatile CachedSiteMapSnapshot userEnglishSnapshot;
    private volatile CachedCompiledAdminSnapshot adminKoreanSnapshot;
    private volatile CachedCompiledAdminSnapshot adminEnglishSnapshot;

    @Override
    public List<SiteMapNode> getUserSiteMap(boolean isEn) {
        return resolveUserSnapshot(isEn);
    }

    @Override
    public List<SiteMapNode> getAdminSiteMap(boolean isEn, HttpServletRequest request) {
        CompiledAdminSiteMapSnapshot snapshot = resolveAdminSnapshot(isEn);
        return filterAdminSnapshot(snapshot, buildAuthorPermissionContext(resolveAuthorCode(request)));
    }

    private List<SiteMapNode> resolveUserSnapshot(boolean isEn) {
        long version = menuInfoReadPort.getMenuTreeVersion();
        CachedSiteMapSnapshot cached = isEn ? userEnglishSnapshot : userKoreanSnapshot;
        if (cached != null && cached.version == version) {
            return cloneSiteMapNodes(cached.nodes);
        }
        synchronized (snapshotMonitor) {
            cached = isEn ? userEnglishSnapshot : userKoreanSnapshot;
            if (cached != null && cached.version == version) {
                return cloneSiteMapNodes(cached.nodes);
            }
            List<SiteMapNode> snapshot = appendUserPublicFlows(buildSiteMap("HMENU1", isEn));
            CachedSiteMapSnapshot refreshed = new CachedSiteMapSnapshot(version, cloneSiteMapNodes(snapshot));
            if (isEn) {
                userEnglishSnapshot = refreshed;
            } else {
                userKoreanSnapshot = refreshed;
            }
            return cloneSiteMapNodes(refreshed.nodes);
        }
    }

    private CompiledAdminSiteMapSnapshot resolveAdminSnapshot(boolean isEn) {
        long version = menuInfoReadPort.getMenuTreeVersion();
        CachedCompiledAdminSnapshot cached = isEn ? adminEnglishSnapshot : adminKoreanSnapshot;
        if (cached != null && cached.version == version) {
            return cached.snapshot;
        }
        synchronized (snapshotMonitor) {
            cached = isEn ? adminEnglishSnapshot : adminKoreanSnapshot;
            if (cached != null && cached.version == version) {
                return cached.snapshot;
            }
            CompiledAdminSiteMapSnapshot snapshot = buildCompiledAdminSiteMap("AMENU1", isEn);
            CachedCompiledAdminSnapshot refreshed = new CachedCompiledAdminSnapshot(version, snapshot);
            if (isEn) {
                adminEnglishSnapshot = refreshed;
            } else {
                adminKoreanSnapshot = refreshed;
            }
            return snapshot;
        }
    }

    private List<SiteMapNode> buildSiteMap(String codeId, boolean isEn) {
        List<MenuTreeRow> rows = loadSiteMapRows(codeId, isEn, false);
        if (rows.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
        Map<String, SiteMapNode> topMap = new LinkedHashMap<>();
        Map<String, SiteMapNode> midMap = new LinkedHashMap<>();

        for (MenuTreeRow row : rows) {
            String code = row.code;
            sortOrderMap.put(code, row.sortOrder);
            if (code.length() == 4) {
                SiteMapNode top = topMap.computeIfAbsent(code, key -> createNode(key, row.label, row.url, row.icon));
                top.setLabel(row.label);
                top.setUrl(row.url);
                if (!row.icon.isEmpty()) {
                    top.setIcon(row.icon);
                }
            } else if (code.length() == 6) {
                String parentCode = code.substring(0, 4);
                SiteMapNode top = topMap.computeIfAbsent(parentCode, key -> createNode(key, parentCode, "#", ""));
                SiteMapNode mid = createNode(code, row.label, row.url, row.icon);
                top.getChildren().add(mid);
                midMap.put(code, mid);
            } else if (code.length() == 8) {
                String parentCode = code.substring(0, 6);
                SiteMapNode mid = midMap.get(parentCode);
                if (mid == null) {
                    String topCode = code.substring(0, 4);
                    SiteMapNode top = topMap.computeIfAbsent(topCode, key -> createNode(key, topCode, "#", ""));
                    mid = createNode(parentCode, parentCode, "#", "");
                    top.getChildren().add(mid);
                    midMap.put(parentCode, mid);
                }
                mid.getChildren().add(createNode(code, row.label, row.url, row.icon));
            }
        }

        List<SiteMapNode> topNodes = new ArrayList<>(topMap.values());
        sortNodes(topNodes, sortOrderMap);
        return pruneEmptyNodes(topNodes);
    }

    private CompiledAdminSiteMapSnapshot buildCompiledAdminSiteMap(String codeId, boolean isEn) {
        List<MenuTreeRow> rows = loadSiteMapRows(codeId, isEn, true);
        if (rows.isEmpty()) {
            return new CompiledAdminSiteMapSnapshot(Collections.emptyList());
        }

        Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
        Map<String, CompiledSiteMapNode> topMap = new LinkedHashMap<>();
        Map<String, CompiledSiteMapNode> midMap = new LinkedHashMap<>();

        for (MenuTreeRow row : rows) {
            String code = row.code;
            sortOrderMap.put(code, row.sortOrder);
            if (code.length() == 4) {
                CompiledSiteMapNode top = topMap.computeIfAbsent(code, key -> createCompiledNode(key, row.label, row.url, row.icon, "", false));
                top.label = row.label;
                top.url = row.url;
                if (!row.icon.isEmpty()) {
                    top.icon = row.icon;
                }
            } else if (code.length() == 6) {
                String parentCode = code.substring(0, 4);
                CompiledSiteMapNode top = topMap.computeIfAbsent(parentCode, key -> createCompiledNode(key, parentCode, "#", "", "", false));
                CompiledSiteMapNode mid = createCompiledNode(code, row.label, row.url, row.icon, "", false);
                top.children.add(mid);
                midMap.put(code, mid);
            } else if (code.length() == 8) {
                String parentCode = code.substring(0, 6);
                CompiledSiteMapNode mid = midMap.get(parentCode);
                if (mid == null) {
                    String topCode = code.substring(0, 4);
                    CompiledSiteMapNode top = topMap.computeIfAbsent(topCode, key -> createCompiledNode(key, topCode, "#", "", "", false));
                    mid = createCompiledNode(parentCode, parentCode, "#", "", "", false);
                    top.children.add(mid);
                    midMap.put(parentCode, mid);
                }
                mid.children.add(createCompiledNode(
                        code,
                        row.label,
                        row.url,
                        row.icon,
                        row.requiredFeatureCode,
                        row.globalOnlyRoute));
            }
        }

        List<CompiledSiteMapNode> topNodes = new ArrayList<>(topMap.values());
        sortCompiledNodes(topNodes, sortOrderMap);
        return new CompiledAdminSiteMapSnapshot(pruneEmptyCompiledNodes(topNodes));
    }

    private List<SiteMapNode> pruneEmptyNodes(List<SiteMapNode> topNodes) {
        List<SiteMapNode> result = new ArrayList<>();
        for (SiteMapNode top : topNodes) {
            List<SiteMapNode> sections = new ArrayList<>();
            for (SiteMapNode section : top.getChildren()) {
                if (!section.getChildren().isEmpty()) {
                    sections.add(section);
                }
            }
            top.setChildren(sections);
            if (!top.getChildren().isEmpty()) {
                result.add(top);
            }
        }
        return result;
    }

    private List<SiteMapNode> appendUserPublicFlows(List<SiteMapNode> topNodes) {
        List<SiteMapNode> result = new ArrayList<>();
        result.add(buildUserPublicFlowNode(false));
        result.addAll(topNodes);
        return result;
    }

    private SiteMapNode buildUserPublicFlowNode(boolean unused) {
        SiteMapNode top = createNode("H000", unused ? "Start" : "시작하기", "#", "travel_explore");

        SiteMapNode signin = createNode("H00010", unused ? "Sign In" : "로그인·계정찾기", "#", "login");
        signin.getChildren().add(createNode("H0001001", unused ? "Login" : "로그인", mapMenuUrl("/signin/loginView", unused), ""));
        signin.getChildren().add(createNode("H0001002", unused ? "Choose Authentication" : "인증방식 선택", mapMenuUrl("/signin/authChoice", unused), ""));
        signin.getChildren().add(createNode("H0001003", unused ? "Find ID" : "아이디 찾기", mapMenuUrl("/signin/findId", unused), ""));
        signin.getChildren().add(createNode("H0001004", unused ? "Find ID Result" : "아이디 찾기 결과", mapMenuUrl("/signin/findId/result", unused), ""));
        signin.getChildren().add(createNode("H0001005", unused ? "Reset Password" : "비밀번호 찾기", mapMenuUrl("/signin/findPassword", unused), ""));
        signin.getChildren().add(createNode("H0001006", unused ? "Reset Password Result" : "비밀번호 찾기 결과", mapMenuUrl("/signin/findPassword/result", unused), ""));

        SiteMapNode join = createNode("H00020", unused ? "Join" : "회원가입", "#", "how_to_reg");
        join.getChildren().add(createNode("H0002001", unused ? "Step 1. Member Type" : "1단계. 회원유형 선택", mapMenuUrl("/join/step1", unused), ""));
        join.getChildren().add(createNode("H0002002", unused ? "Step 2. Terms Agreement" : "2단계. 약관 동의", mapMenuUrl("/join/step2", unused), ""));
        join.getChildren().add(createNode("H0002003", unused ? "Step 3. Identity Verification" : "3단계. 본인인증", mapMenuUrl("/join/step3", unused), ""));
        join.getChildren().add(createNode("H0002004", unused ? "Step 4. Member Information" : "4단계. 회원정보 입력", mapMenuUrl("/join/step4", unused), ""));
        join.getChildren().add(createNode("H0002005", unused ? "Step 5. Complete" : "5단계. 가입 완료", mapMenuUrl("/join/step5", unused), ""));

        SiteMapNode company = createNode("H00030", unused ? "Company Membership" : "회원사 가입", "#", "domain_add");
        company.getChildren().add(createNode("H0003001", unused ? "Company Registration" : "회원사 가입 신청", mapMenuUrl("/join/companyRegister", unused), ""));
        company.getChildren().add(createNode("H0003002", unused ? "Registration Complete" : "회원사 가입 신청 완료", mapMenuUrl("/join/companyRegisterComplete", unused), ""));
        company.getChildren().add(createNode("H0003003", unused ? "Status Search" : "가입현황 조회", mapMenuUrl("/join/companyJoinStatusSearch", unused), ""));
        company.getChildren().add(createNode("H0003004", unused ? "Status Guide" : "가입현황 안내", mapMenuUrl("/join/companyJoinStatusGuide", unused), ""));
        company.getChildren().add(createNode("H0003005", unused ? "Status Detail" : "가입현황 상세", mapMenuUrl("/join/companyJoinStatusDetail", unused), ""));
        company.getChildren().add(createNode("H0003006", unused ? "Reapply" : "재신청", mapMenuUrl("/join/companyReapply", unused), ""));

        SiteMapNode mypage = createNode("H00040", unused ? "My Page" : "마이페이지", "#", "person");
        mypage.getChildren().add(createNode("H0004001", unused ? "My Page" : "마이페이지", mapMenuUrl("/mypage", unused), ""));
        mypage.getChildren().add(createNode("H0004002", unused ? "Membership Status Overview" : "회원 가입현황", mapMenuUrl("/mypage", unused), ""));

        top.getChildren().add(signin);
        top.getChildren().add(join);
        top.getChildren().add(company);
        top.getChildren().add(mypage);
        return top;
    }

    private void sortNodes(List<SiteMapNode> nodes, Map<String, Integer> sortOrderMap) {
        nodes.sort(Comparator
                .comparingInt((SiteMapNode node) -> effectiveSort(node.getCode(), sortOrderMap))
                .thenComparing(SiteMapNode::getCode, Comparator.nullsLast(String::compareTo)));
        for (SiteMapNode node : nodes) {
            sortNodes(node.getChildren(), sortOrderMap);
            if ("#".equals(safeString(node.getUrl()))) {
                String firstChildUrl = firstChildUrl(node.getChildren());
                if (!firstChildUrl.isEmpty()) {
                    node.setUrl(firstChildUrl);
                }
            }
        }
    }

    private List<MenuTreeRow> loadSiteMapRows(String codeId, boolean isEn, boolean includeAdminMetadata) {
        List<MenuInfoDTO> rows = loadMenuTreeRows(codeId);
        if (rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<MenuTreeRow> normalizedRows = new ArrayList<>(rows.size());
        for (MenuInfoDTO row : rows) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (code.isEmpty() || !"Y".equalsIgnoreCase(safeString(row.getUseAt()))) {
                continue;
            }
            String rawUrl = normalizeMenuUrl(row.getMenuUrl());
            String canonicalUrl = includeAdminMetadata ? ReactPageUrlMapper.toCanonicalMenuUrl(rawUrl) : "";
            normalizedRows.add(new MenuTreeRow(
                    code,
                    resolveLabel(row, isEn),
                    mapMenuUrl(rawUrl, isEn),
                    safeString(row.getMenuIcon()),
                    row.getSortOrdr(),
                    includeAdminMetadata ? resolveRequiredViewFeatureCode(rawUrl) : "",
                    includeAdminMetadata && isGlobalOnlyRoute(canonicalUrl)));
        }
        return normalizedRows;
    }

    private String firstChildUrl(List<SiteMapNode> children) {
        for (SiteMapNode child : children) {
            String url = safeString(child.getUrl());
            if (!url.isEmpty() && !"#".equals(url)) {
                return url;
            }
            String nestedUrl = firstChildUrl(child.getChildren());
            if (!nestedUrl.isEmpty()) {
                return nestedUrl;
            }
        }
        return "";
    }

    private SiteMapNode createNode(String code, String label, String url, String icon) {
        SiteMapNode node = new SiteMapNode();
        node.setCode(code);
        node.setLabel(label);
        node.setUrl(url.isEmpty() ? "#" : url);
        node.setIcon(icon);
        return node;
    }

    private String resolveLabel(MenuInfoDTO row, boolean isEn) {
        String primary = isEn ? safeString(row.getCodeDc()) : safeString(row.getCodeNm());
        String fallback = isEn ? safeString(row.getCodeNm()) : safeString(row.getCodeDc());
        return primary.isEmpty() ? (fallback.isEmpty() ? safeString(row.getCode()) : fallback) : primary;
    }

    private List<MenuInfoDTO> loadMenuTreeRows(String codeId) {
        try {
            return new ArrayList<>(menuInfoReadPort.selectMenuTreeList(codeId));
        } catch (Exception e) {
            log.error("Failed to load sitemap menu tree. codeId={}", codeId, e);
            return Collections.emptyList();
        }
    }

    private List<SiteMapNode> filterAdminSnapshot(CompiledAdminSiteMapSnapshot snapshot, AuthorPermissionContext permissionContext) {
        if (snapshot == null || snapshot.nodes.isEmpty()) {
            return Collections.emptyList();
        }
        List<SiteMapNode> filtered = new ArrayList<>();
        for (CompiledSiteMapNode top : snapshot.nodes) {
            SiteMapNode filteredTop = filterCompiledNode(top, permissionContext);
            if (filteredTop != null) {
                filtered.add(filteredTop);
            }
        }
        refreshDerivedUrls(filtered);
        return pruneEmptyNodes(filtered);
    }

    private SiteMapNode filterCompiledNode(CompiledSiteMapNode source, AuthorPermissionContext permissionContext) {
        if (source == null) {
            return null;
        }
        if (source.children.isEmpty()) {
            return canExposeAdminLeaf(source, permissionContext)
                    ? createNode(source.code, source.label, source.url, source.icon)
                    : null;
        }
        SiteMapNode node = createNode(source.code, source.label, source.url, source.icon);
        List<SiteMapNode> children = new ArrayList<>();
        for (CompiledSiteMapNode child : source.children) {
            SiteMapNode filteredChild = filterCompiledNode(child, permissionContext);
            if (filteredChild != null) {
                children.add(filteredChild);
            }
        }
        node.setChildren(children);
        return children.isEmpty() ? null : node;
    }

    private boolean canExposeAdminLeaf(CompiledSiteMapNode node, AuthorPermissionContext permissionContext) {
        if (node == null || permissionContext == null) {
            return false;
        }
        if (permissionContext.systemMaster) {
            return true;
        }
        if (isMasterOnlyRoute(node.url)) {
            return false;
        }
        if (isCompanyAdminOnlyRoute(node.url) && permissionContext.operationAdmin) {
            return false;
        }
        if (safeString(node.requiredFeatureCode).isEmpty()) {
            return !permissionContext.authorCode.isEmpty();
        }
        return permissionContext.authorFeatureCodes.contains(node.requiredFeatureCode);
    }

    private AuthorPermissionContext buildAuthorPermissionContext(String authorCode) {
        FrameworkAuthorityPolicyService.AuthorityPolicyContext policyContext;
        try {
            policyContext = frameworkAuthorityPolicyService.buildContext(authorCode);
        } catch (Exception e) {
            log.warn("Failed to load authority policy context for sitemap. authorCode={}", safeString(authorCode), e);
            return new AuthorPermissionContext("", Collections.emptySet(), false, false);
        }
        if (policyContext.getAuthorCode().isEmpty()) {
            return new AuthorPermissionContext("", Collections.emptySet(), false, false);
        }
        return new AuthorPermissionContext(
                policyContext.getAuthorCode(),
                policyContext.getFeatureCodes(),
                policyContext.isSystemMaster(),
                policyContext.isOperationAdmin());
    }

    private String resolveRequiredViewFeatureCode(String menuUrl) {
        try {
            return safeString(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(
                    ReactPageUrlMapper.toCanonicalMenuUrl(normalizeMenuUrl(menuUrl)))).toUpperCase(Locale.ROOT);
        } catch (Exception e) {
            log.warn("Failed to resolve sitemap menu feature code. menuUrl={}", menuUrl, e);
            return "";
        }
    }

    private String mapMenuUrl(String value, boolean isEn) {
        String url = normalizeMenuUrl(value);
        if (url.isEmpty()) {
            return "#";
        }
        String mapped = ReactPageUrlMapper.toRuntimeUrl(url, isEn);
        if (!mapped.isEmpty()) {
            return mapped;
        }
        if (isEn && !url.startsWith("/en/")) {
            return "/en" + url;
        }
        return url;
    }

    private String normalizeMenuUrl(String value) {
        String url = safeString(value);
        if (url.isEmpty() || "#".equals(url)) {
            return "";
        }
        if ("/admin/member/admin-list".equals(url)) {
            return "/admin/member/admin_list";
        }
        if ("/en/admin/member/admin-list".equals(url)) {
            return "/en/admin/member/admin_list";
        }
        if (!url.startsWith("/")) {
            return "/" + url;
        }
        return url;
    }

    private boolean isGlobalOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        if ("/admin/system/access_history".equals(value)
                || "/admin/system/error-log".equals(value)
                || "/admin/system/security".equals(value)
                || "/admin/system/security-audit".equals(value)
                || "/admin/system/observability".equals(value)
                || "/admin/system/help-management".equals(value)
                || "/admin/system/sr-workbench".equals(value)
                || "/admin/system/wbs-management".equals(value)
                || "/admin/system/new-page".equals(value)
                || "/admin/system/codex-request".equals(value)) {
            return false;
        }
        return "/admin/member/company-approve".equals(value)
                || "/admin/certificate/pending_list".equals(value)
                || "/admin/member/company_list".equals(value)
                || "/admin/member/company_detail".equals(value)
                || "/admin/member/company_account".equals(value)
                || "/admin/member/security".equals(value)
                || "/admin/member/company-file".equals(value)
                || value.startsWith("/admin/content/")
                || value.startsWith("/admin/external/")
                || value.startsWith("/admin/system/");
    }

    private boolean isMasterOnlyRoute(String normalizedUri) {
        return isGlobalOnlyRoute(normalizedUri);
    }

    private boolean isCompanyAdminOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin/member/admin_list".equals(value)
                || "/admin/member/admin-list".equals(value)
                || "/admin/member/admin_account".equals(value)
                || "/admin/member/admin_account/permissions".equals(value)
                || isMasterOnlyRoute(value);
    }

    private String resolveAuthorCode(HttpServletRequest request) {
        try {
            String accessToken = jwtTokenProvider.getCookie(request, "accessToken");
            if (ObjectUtils.isEmpty(accessToken) || jwtTokenProvider.accessValidateToken(accessToken) != 200) {
                return "";
            }
            Claims claims = jwtTokenProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            String userId = safeString(jwtTokenProvider.decrypt(encryptedUserId.toString()));
            if (userId.isEmpty()) {
                return "";
            }
            return safeString(authGroupManageService.selectAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
        } catch (Exception e) {
            log.warn("Failed to resolve author code for sitemap.", e);
            return "";
        }
    }

    private int effectiveSort(String code, Map<String, Integer> sortOrderMap) {
        Integer saved = sortOrderMap.get(safeString(code).toUpperCase(Locale.ROOT));
        if (saved != null) {
            return saved;
        }
        return fallbackCodeSort(code);
    }

    private int fallbackCodeSort(String code) {
        String normalized = safeString(code);
        if ("H000".equals(normalized)) {
            return PUBLIC_ENTRY_SORT;
        }
        if ("H00010".equals(normalized)) {
            return PUBLIC_SIGNIN_SORT;
        }
        if ("H00020".equals(normalized)) {
            return PUBLIC_JOIN_SORT;
        }
        if ("H00030".equals(normalized)) {
            return PUBLIC_COMPANY_SORT;
        }
        if ("H00040".equals(normalized)) {
            return PUBLIC_MYPAGE_SORT;
        }
        if (normalized.length() == 4) {
            return parseSort(normalized.substring(1));
        }
        if (normalized.length() >= 6) {
            return parseSort(normalized.substring(normalized.length() - 2));
        }
        return Integer.MAX_VALUE;
    }

    private int parseSort(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE;
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private void sortCompiledNodes(List<CompiledSiteMapNode> nodes, Map<String, Integer> sortOrderMap) {
        nodes.sort(Comparator
                .comparingInt((CompiledSiteMapNode node) -> effectiveSort(node.code, sortOrderMap))
                .thenComparing(node -> node.code, Comparator.nullsLast(String::compareTo)));
        for (CompiledSiteMapNode node : nodes) {
            sortCompiledNodes(node.children, sortOrderMap);
            if ("#".equals(safeString(node.url))) {
                String firstChildUrl = firstCompiledChildUrl(node.children);
                if (!firstChildUrl.isEmpty()) {
                    node.url = firstChildUrl;
                }
            }
        }
    }

    private String firstCompiledChildUrl(List<CompiledSiteMapNode> children) {
        for (CompiledSiteMapNode child : children) {
            String url = safeString(child.url);
            if (!url.isEmpty() && !"#".equals(url)) {
                return url;
            }
            String nestedUrl = firstCompiledChildUrl(child.children);
            if (!nestedUrl.isEmpty()) {
                return nestedUrl;
            }
        }
        return "";
    }

    private List<CompiledSiteMapNode> pruneEmptyCompiledNodes(List<CompiledSiteMapNode> topNodes) {
        List<CompiledSiteMapNode> result = new ArrayList<>();
        for (CompiledSiteMapNode top : topNodes) {
            List<CompiledSiteMapNode> sections = new ArrayList<>();
            for (CompiledSiteMapNode section : top.children) {
                if (!section.children.isEmpty()) {
                    sections.add(section);
                }
            }
            top.children = sections;
            if (!top.children.isEmpty()) {
                result.add(top);
            }
        }
        return result;
    }

    private void refreshDerivedUrls(List<SiteMapNode> nodes) {
        for (SiteMapNode node : nodes) {
            refreshDerivedUrls(node.getChildren());
            if ("#".equals(safeString(node.getUrl()))) {
                String firstChildUrl = firstChildUrl(node.getChildren());
                if (!firstChildUrl.isEmpty()) {
                    node.setUrl(firstChildUrl);
                }
            }
        }
    }

    private List<SiteMapNode> cloneSiteMapNodes(List<SiteMapNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return Collections.emptyList();
        }
        List<SiteMapNode> clones = new ArrayList<>(nodes.size());
        for (SiteMapNode node : nodes) {
            clones.add(cloneSiteMapNode(node));
        }
        return clones;
    }

    private SiteMapNode cloneSiteMapNode(SiteMapNode node) {
        SiteMapNode clone = new SiteMapNode();
        if (node == null) {
            return clone;
        }
        clone.setCode(node.getCode());
        clone.setLabel(node.getLabel());
        clone.setUrl(node.getUrl());
        clone.setIcon(node.getIcon());
        clone.setChildren(cloneSiteMapNodes(node.getChildren()));
        return clone;
    }

    private CompiledSiteMapNode createCompiledNode(String code, String label, String url, String icon,
                                                   String requiredFeatureCode, boolean globalOnlyRoute) {
        CompiledSiteMapNode node = new CompiledSiteMapNode();
        node.code = code;
        node.label = label;
        node.url = url.isEmpty() ? "#" : url;
        node.icon = icon;
        node.requiredFeatureCode = requiredFeatureCode;
        node.globalOnlyRoute = globalOnlyRoute;
        return node;
    }

    private static final class CachedSiteMapSnapshot {
        private final long version;
        private final List<SiteMapNode> nodes;

        private CachedSiteMapSnapshot(long version, List<SiteMapNode> nodes) {
            this.version = version;
            this.nodes = nodes;
        }
    }

    private static final class CachedCompiledAdminSnapshot {
        private final long version;
        private final CompiledAdminSiteMapSnapshot snapshot;

        private CachedCompiledAdminSnapshot(long version, CompiledAdminSiteMapSnapshot snapshot) {
            this.version = version;
            this.snapshot = snapshot;
        }
    }

    private static final class CompiledAdminSiteMapSnapshot {
        private final List<CompiledSiteMapNode> nodes;

        private CompiledAdminSiteMapSnapshot(List<CompiledSiteMapNode> nodes) {
            this.nodes = nodes;
        }
    }

    private static final class CompiledSiteMapNode {
        private String code;
        private String label;
        private String url;
        private String icon;
        private String requiredFeatureCode;
        private boolean globalOnlyRoute;
        private List<CompiledSiteMapNode> children = new ArrayList<>();
    }

    private static final class MenuTreeRow {
        private final String code;
        private final String label;
        private final String url;
        private final String icon;
        private final Integer sortOrder;
        private final String requiredFeatureCode;
        private final boolean globalOnlyRoute;

        private MenuTreeRow(String code, String label, String url, String icon, Integer sortOrder,
                            String requiredFeatureCode, boolean globalOnlyRoute) {
            this.code = code;
            this.label = label;
            this.url = url;
            this.icon = icon;
            this.sortOrder = sortOrder;
            this.requiredFeatureCode = requiredFeatureCode;
            this.globalOnlyRoute = globalOnlyRoute;
        }
    }

    private static final class AuthorPermissionContext {
        private final String authorCode;
        private final Set<String> authorFeatureCodes;
        private final boolean systemMaster;
        private final boolean operationAdmin;

        private AuthorPermissionContext(String authorCode, Set<String> authorFeatureCodes,
                                        boolean systemMaster, boolean operationAdmin) {
            this.authorCode = authorCode;
            this.authorFeatureCodes = authorFeatureCodes;
            this.systemMaster = systemMaster;
            this.operationAdmin = operationAdmin;
        }
    }
}
