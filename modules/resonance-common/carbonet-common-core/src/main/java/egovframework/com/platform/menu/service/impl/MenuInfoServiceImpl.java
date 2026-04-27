package egovframework.com.platform.menu.service.impl;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.mapper.MenuInfoMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service("menuInfoService")
public class MenuInfoServiceImpl extends EgovAbstractServiceImpl implements MenuInfoService {

    private final MenuInfoMapper menuInfoMapper;
    private final Map<String, CachedMenuRows> menuTreeCache = new ConcurrentHashMap<>();
    private final AtomicLong menuTreeVersion = new AtomicLong();

    public MenuInfoServiceImpl(MenuInfoMapper menuInfoMapper) {
        this.menuInfoMapper = menuInfoMapper;
    }

    @Override
    public List<MenuInfoDTO> selectMenuUrlListByPrefix(String prefix) {
        return menuInfoMapper.selectMenuUrlListByPrefix(prefix);
    }

    @Override
    public List<MenuInfoDTO> selectAdminMenuDetailList(String codeId) {
        return sortMenuRows(menuInfoMapper.selectAdminMenuDetailList(codeId));
    }

    @Override
    public List<MenuInfoDTO> selectMenuTreeList(String codeId) {
        String normalizedCodeId = safeString(codeId).toUpperCase(Locale.ROOT);
        long version = menuTreeVersion.get();
        CachedMenuRows cached = menuTreeCache.get(normalizedCodeId);
        if (cached != null && cached.version == version) {
            return cloneMenuRows(cached.rows);
        }

        List<MenuInfoDTO> sortedRows = sortMenuRows(menuInfoMapper.selectMenuTreeList(codeId));
        List<MenuInfoDTO> cachedRows = cloneMenuRows(sortedRows);
        menuTreeCache.put(normalizedCodeId, new CachedMenuRows(version, cachedRows));
        return cloneMenuRows(cachedRows);
    }

    @Override
    public MenuInfoDTO selectMenuDetailByUrl(String menuUrl) {
        String normalized = ReactPageUrlMapper.toCanonicalMenuUrl(menuUrl);
        return menuInfoMapper.selectMenuDetailByUrl(normalized.isEmpty() ? menuUrl : normalized);
    }

    @Override
    public void saveMenuOrder(String menuCode, int sortOrdr) {
        if (menuInfoMapper.countMenuOrder(menuCode) > 0) {
            menuInfoMapper.updateMenuOrder(menuCode, sortOrdr);
        } else {
            menuInfoMapper.insertMenuOrder(menuCode, sortOrdr);
        }
        invalidateMenuTreeCache();
    }

    @Override
    public long getMenuTreeVersion() {
        return menuTreeVersion.get();
    }

    private List<MenuInfoDTO> sortMenuRows(List<MenuInfoDTO> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<MenuInfoDTO> sorted = new ArrayList<>(rows);
        Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
        for (MenuInfoDTO row : sorted) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (!code.isEmpty()) {
                sortOrderMap.put(code, row.getSortOrdr());
            }
        }
        sorted.sort(Comparator
                .comparingInt((MenuInfoDTO row) -> codeDepth(row.getCode()))
                .thenComparing(row -> domainCode(row.getCode()))
                .thenComparingInt(row -> parentDepthSort(row, sortOrderMap))
                .thenComparingInt(row -> effectiveSort(row.getCode(), row.getSortOrdr()))
                .thenComparing(row -> safeString(row.getCode())));
        return sorted;
    }

    private int codeDepth(String code) {
        return safeString(code).length();
    }

    private String domainCode(String code) {
        String normalized = safeString(code).toUpperCase(Locale.ROOT);
        return normalized.substring(0, Math.min(4, normalized.length()));
    }

    private int parentDepthSort(MenuInfoDTO row, Map<String, Integer> sortOrderMap) {
        String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
        if (code.length() == 6) {
            return normalizeSort(sortOrderMap.get(code.substring(0, 4)));
        }
        if (code.length() == 8) {
            Integer groupSort = sortOrderMap.get(code.substring(0, 6));
            if (groupSort != null) {
                return normalizeSort(groupSort);
            }
            return normalizeSort(sortOrderMap.get(code.substring(0, 4)));
        }
        return 0;
    }

    private int effectiveSort(String code, Integer sortOrdr) {
        if (sortOrdr != null) {
            return sortOrdr;
        }
        return fallbackCodeSort(code);
    }

    private int normalizeSort(Integer sortOrdr) {
        return sortOrdr == null ? Integer.MAX_VALUE : sortOrdr;
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

    private List<MenuInfoDTO> cloneMenuRows(List<MenuInfoDTO> rows) {
        if (rows == null || rows.isEmpty()) {
            return Collections.emptyList();
        }
        List<MenuInfoDTO> clones = new ArrayList<>(rows.size());
        for (MenuInfoDTO row : rows) {
            clones.add(cloneMenuRow(row));
        }
        return clones;
    }

    private MenuInfoDTO cloneMenuRow(MenuInfoDTO row) {
        MenuInfoDTO clone = new MenuInfoDTO();
        if (row == null) {
            return clone;
        }
        clone.setMenuCode(row.getMenuCode());
        clone.setMenuUrl(row.getMenuUrl());
        clone.setCode(row.getCode());
        clone.setCodeNm(row.getCodeNm());
        clone.setCodeDc(row.getCodeDc());
        clone.setMenuIcon(row.getMenuIcon());
        clone.setUseAt(row.getUseAt());
        clone.setSortOrdr(row.getSortOrdr());
        return clone;
    }

    private void invalidateMenuTreeCache() {
        menuTreeVersion.incrementAndGet();
        menuTreeCache.clear();
    }

    private static final class CachedMenuRows {
        private final long version;
        private final List<MenuInfoDTO> rows;

        private CachedMenuRows(long version, List<MenuInfoDTO> rows) {
            this.version = version;
            this.rows = rows;
        }
    }
}
