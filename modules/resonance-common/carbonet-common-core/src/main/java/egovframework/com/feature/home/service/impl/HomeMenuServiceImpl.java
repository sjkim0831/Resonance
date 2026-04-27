package egovframework.com.feature.home.service.impl;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.feature.home.model.vo.HomeMenuNode;
import egovframework.com.feature.home.service.HomeMenuService;
import egovframework.com.platform.read.MenuInfoReadPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;

@Slf4j
@Service("homeMenuService")
@RequiredArgsConstructor
public class HomeMenuServiceImpl implements HomeMenuService {

    private static final Map<String, String> HOME_MENU_LABEL_OVERRIDES_KO = buildMenuLabelOverridesKo();
    private static final Map<String, String> HOME_MENU_LABEL_OVERRIDES_EN = buildMenuLabelOverridesEn();

    private final MenuInfoReadPort menuInfoReadPort;
    private final Object snapshotMonitor = new Object();
    private volatile CachedHomeMenuSnapshot koreanSnapshot;
    private volatile CachedHomeMenuSnapshot englishSnapshot;

    @Override
    public List<HomeMenuNode> getHomeMenu(boolean isEn) {
        try {
            return resolveSnapshot(isEn);
        } catch (Exception e) {
            log.error("Failed to build home menu. isEn={}", isEn, e);
            return Collections.emptyList();
        }
    }

    private List<HomeMenuNode> resolveSnapshot(boolean isEn) {
        long version = menuInfoReadPort.getMenuTreeVersion();
        CachedHomeMenuSnapshot cached = isEn ? englishSnapshot : koreanSnapshot;
        if (cached != null && cached.version == version) {
            return cloneMenuNodes(cached.nodes);
        }
        synchronized (snapshotMonitor) {
            cached = isEn ? englishSnapshot : koreanSnapshot;
            if (cached != null && cached.version == version) {
                return cloneMenuNodes(cached.nodes);
            }
            List<HomeMenuNode> snapshot = buildHomeMenu(isEn);
            CachedHomeMenuSnapshot refreshed = new CachedHomeMenuSnapshot(version, cloneMenuNodes(snapshot));
            if (isEn) {
                englishSnapshot = refreshed;
            } else {
                koreanSnapshot = refreshed;
            }
            return cloneMenuNodes(refreshed.nodes);
        }
    }

    private List<HomeMenuNode> buildHomeMenu(boolean isEn) {
        List<MenuInfoDTO> rows = loadMenuTreeRows("HMENU1");
        if (rows.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
        for (MenuInfoDTO row : rows) {
            sortOrderMap.put(safeString(row.getCode()).toUpperCase(Locale.ROOT), row.getSortOrdr());
        }
        Map<String, HomeMenuNode> topMap = new LinkedHashMap<>();
        Map<String, HomeMenuNode> midMap = new LinkedHashMap<>();

        for (MenuInfoDTO row : rows) {
            if (!"Y".equalsIgnoreCase(safeString(row.getUseAt()))) {
                continue;
            }
            String value = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (value.isEmpty()) {
                continue;
            }
            String label = resolveHomeMenuLabel(row, isEn);
            String url = resolveMenuUrl(value, row.getMenuUrl(), isEn);
            if (value.length() == 4) {
                HomeMenuNode top = topMap.computeIfAbsent(value,
                        key -> createMenuNode(key, label, url));
                top.setLabel(label);
                top.setUrl(url);
            } else if (value.length() == 6) {
                String parent = value.substring(0, 4);
                HomeMenuNode top = topMap.computeIfAbsent(parent,
                        key -> createMenuNode(key, key, "#"));
                HomeMenuNode mid = createMenuNode(value, label, url);
                top.getSections().add(mid);
                midMap.put(value, mid);
            } else if (value.length() == 8) {
                String parent = value.substring(0, 6);
                HomeMenuNode mid = midMap.get(parent);
                if (mid == null) {
                    String topKey = value.substring(0, 4);
                    HomeMenuNode top = topMap.computeIfAbsent(topKey,
                            key -> createMenuNode(key, key, "#"));
                    mid = createMenuNode(parent, parent, "#");
                    top.getSections().add(mid);
                    midMap.put(parent, mid);
                }
                mid.getItems().add(createMenuNode(value, label, url));
            }
        }

        List<HomeMenuNode> result = new ArrayList<>(topMap.values());
        result.sort(menuNodeComparator(sortOrderMap));
        for (HomeMenuNode top : result) {
            top.getSections().sort(menuNodeComparator(sortOrderMap));
            for (HomeMenuNode section : top.getSections()) {
                section.getItems().sort(menuNodeComparator(sortOrderMap));
                normalizeSectionLabel(section, isEn);
            }
            normalizeTopLabel(top, isEn);
        }
        for (HomeMenuNode top : result) {
            String url = safeString(top.getUrl());
            if (!url.isEmpty() && !"#".equals(url)) {
                continue;
            }
            String resolved = firstChildUrl(top.getSections());
            if (!resolved.isEmpty()) {
                top.setUrl(resolved);
            }
        }
        return result;
    }

    private HomeMenuNode createMenuNode(String code, String label, String url) {
        HomeMenuNode node = new HomeMenuNode();
        node.setCode(code);
        node.setLabel(label);
        node.setUrl(url);
        return node;
    }

    private String resolveMenuUrl(String code, String rawUrl, boolean isEn) {
        String mapped = safeString(rawUrl);
        if (!mapped.isEmpty()) {
            return normalizeHomeMenuUrl(mapped, isEn);
        }
        if ("H008".equals(code) || "H0080101".equals(code)) {
            return isEn ? "/en/mypage/profile" : "/mypage/profile";
        }
        return "#";
    }

    private String firstChildUrl(List<HomeMenuNode> sections) {
        if (sections == null) {
            return "";
        }
        for (HomeMenuNode section : sections) {
            if (section.getItems() == null) {
                continue;
            }
            for (HomeMenuNode item : section.getItems()) {
                String url = safeString(item.getUrl());
                if (!url.isEmpty() && !"#".equals(url)) {
                    return url;
                }
            }
        }
        return "";
    }

    private String resolveHomeMenuLabel(MenuInfoDTO code, boolean isEn) {
        String label = isEn ? safeString(code.getCodeDc()) : safeString(code.getCodeNm());
        if (label.isEmpty()) {
            label = isEn ? safeString(code.getCodeNm()) : safeString(code.getCodeDc());
        }
        if (label.isEmpty() || isLikelyCodeLabel(label)) {
            String override = resolveHomeMenuLabelOverride(safeString(code.getCode()), isEn);
            if (!override.isEmpty()) {
                return override;
            }
        }
        return label.isEmpty() ? safeString(code.getCode()) : label;
    }

    private List<MenuInfoDTO> loadMenuTreeRows(String codeId) {
        try {
            return menuInfoReadPort.selectMenuTreeList(codeId);
        } catch (Exception e) {
            log.error("Failed to load menu tree rows. codeId={}", codeId, e);
            return Collections.emptyList();
        }
    }

    private String normalizeHomeMenuUrl(String value, boolean isEn) {
        String url = safeString(value);
        if (url.isEmpty()) {
            return "#";
        }
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("#")) {
            return url;
        }
        if (!url.startsWith("/")) {
            url = "/" + url;
        }
        if ("/mypage".equals(url) || url.startsWith("/mypage/")) {
            return isEn && !url.startsWith("/en/") ? "/en" + url : url;
        }
        String reactMapped = mapReactMigrationUrl(url, isEn);
        if (!reactMapped.isEmpty()) {
            return reactMapped;
        }
        if (isEn && !url.startsWith("/en/")) {
            url = "/en" + url;
        }
        return url;
    }

    private String mapReactMigrationUrl(String url, boolean isEn) {
        return ReactPageUrlMapper.toRuntimeUrl(url, isEn);
    }

    private Comparator<HomeMenuNode> menuNodeComparator(Map<String, Integer> sortOrderMap) {
        return Comparator
                .comparingInt((HomeMenuNode node) -> effectiveSort(node.getCode(), sortOrderMap))
                .thenComparing(HomeMenuNode::getCode, Comparator.nullsLast(String::compareTo));
    }

    private int normalizeSort(Integer sortOrdr) {
        return sortOrdr == null ? Integer.MAX_VALUE : sortOrdr;
    }

    private int effectiveSort(String code, Map<String, Integer> sortOrderMap) {
        Integer saved = sortOrderMap.get(code);
        if (saved != null) {
            return saved;
        }
        return fallbackCodeSort(code);
    }

    private int fallbackCodeSort(String code) {
        String normalized = safeString(code);
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

    private boolean isLikelyCodeLabel(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return true;
        }
        return normalized.matches("^[A-Z]\\d{3,}$")
                || normalized.matches("^[A-Z][A-Z0-9_]{3,}$");
    }

    private String resolveHomeMenuLabelOverride(String code, boolean isEn) {
        String normalizedCode = safeString(code).toUpperCase(Locale.ROOT);
        if (normalizedCode.isEmpty()) {
            return "";
        }
        return isEn
                ? HOME_MENU_LABEL_OVERRIDES_EN.getOrDefault(normalizedCode, "")
                : HOME_MENU_LABEL_OVERRIDES_KO.getOrDefault(normalizedCode, "");
    }

    private void normalizeSectionLabel(HomeMenuNode section, boolean isEn) {
        if (section == null || section.getItems() == null || section.getItems().isEmpty()) {
            return;
        }
        if (isLikelyCodeLabel(section.getLabel())) {
            String override = resolveHomeMenuLabelOverride(section.getCode(), isEn);
            if (!override.isEmpty()) {
                section.setLabel(override);
                return;
            }
            String fallback = safeString(section.getItems().get(0).getLabel());
            if (!fallback.isEmpty()) {
                section.setLabel(fallback);
            }
        }
    }

    private void normalizeTopLabel(HomeMenuNode top, boolean isEn) {
        if (top == null) {
            return;
        }
        if (isLikelyCodeLabel(top.getLabel())) {
            String override = resolveHomeMenuLabelOverride(top.getCode(), isEn);
            if (!override.isEmpty()) {
                top.setLabel(override);
                return;
            }
            if (top.getSections() != null && !top.getSections().isEmpty()) {
                String fallback = safeString(top.getSections().get(0).getLabel());
                if (!fallback.isEmpty()) {
                    top.setLabel(fallback);
                }
            }
        }
    }

    private static Map<String, String> buildMenuLabelOverridesKo() {
        Map<String, String> labels = new HashMap<>();
        labels.put("H001", "서비스");
        labels.put("H00101", "서비스");
        labels.put("H002", "정보마당");
        labels.put("H00201", "정보마당");
        labels.put("H003", "통계");
        labels.put("H00301", "통계");
        labels.put("H004", "참여");
        labels.put("H00401", "참여");
        labels.put("H005", "고객지원");
        labels.put("H00501", "고객지원");
        labels.put("H008", "마이페이지");
        labels.put("H00801", "마이페이지");
        return labels;
    }

    private static Map<String, String> buildMenuLabelOverridesEn() {
        Map<String, String> labels = new HashMap<>();
        labels.put("H001", "Services");
        labels.put("H00101", "Services");
        labels.put("H002", "Information");
        labels.put("H00201", "Information");
        labels.put("H003", "Statistics");
        labels.put("H00301", "Statistics");
        labels.put("H004", "Participation");
        labels.put("H00401", "Participation");
        labels.put("H005", "Support");
        labels.put("H00501", "Support");
        labels.put("H008", "My Page");
        labels.put("H00801", "My Page");
        return labels;
    }

    private List<HomeMenuNode> cloneMenuNodes(List<HomeMenuNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return Collections.emptyList();
        }
        List<HomeMenuNode> clones = new ArrayList<>(nodes.size());
        for (HomeMenuNode node : nodes) {
            clones.add(cloneMenuNode(node));
        }
        return clones;
    }

    private HomeMenuNode cloneMenuNode(HomeMenuNode node) {
        HomeMenuNode clone = new HomeMenuNode();
        if (node == null) {
            return clone;
        }
        clone.setCode(node.getCode());
        clone.setLabel(node.getLabel());
        clone.setUrl(node.getUrl());
        clone.setSections(cloneMenuNodes(node.getSections()));
        clone.setItems(cloneMenuNodes(node.getItems()));
        return clone;
    }

    private static final class CachedHomeMenuSnapshot {
        private final long version;
        private final List<HomeMenuNode> nodes;

        private CachedHomeMenuSnapshot(long version, List<HomeMenuNode> nodes) {
            this.version = version;
            this.nodes = nodes;
        }
    }
}
