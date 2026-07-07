package com.resonance.common.menu.admin.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.resonance.common.menu.admin.dto.LayoutManagementPayload;
import com.resonance.common.menu.admin.dto.LayoutTemplatePayload;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class LayoutManagementService {

    private static final Logger log = LoggerFactory.getLogger(LayoutManagementService.class);
    private static final String DATA_DIR = "/opt/Resonance/data/layout-management";
    private static final String LAYOUTS_FILE = DATA_DIR + "/layouts.json";
    private static final String TEMPLATES_FILE = DATA_DIR + "/templates.json";
    private static final String THEMES_FILE = DATA_DIR + "/themes.json";

    private final Map<String, LayoutManagementPayload> layoutStore = new HashMap<>();
    private final Map<String, LayoutTemplatePayload> templateStore = new HashMap<>();
    private final Map<String, LayoutThemePayload> themeStore = new HashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LayoutManagementService() {
        objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
        objectMapper.findAndRegisterModules();
        loadData();
    }

    @PostConstruct
    public void init() {
        if (layoutStore.isEmpty()) {
            initDefaultData();
            saveAllData();
        }
    }

    private void loadData() {
        try {
            File dataDir = new File(DATA_DIR);
            if (!dataDir.exists()) {
                dataDir.mkdirs();
            }

            loadLayouts();
            loadTemplates();
            loadThemes();
            log.info("Loaded {} layouts, {} templates, {} themes from storage",
                layoutStore.size(), templateStore.size(), themeStore.size());
        } catch (Exception e) {
            log.error("Failed to load data from storage, using defaults", e);
            initDefaultData();
        }
    }

    private void loadLayouts() throws IOException {
        File file = new File(LAYOUTS_FILE);
        if (file.exists()) {
            String json = Files.readString(Paths.get(LAYOUTS_FILE));
            LayoutStorePayload store = objectMapper.readValue(json, LayoutStorePayload.class);
            if (store.layouts != null) {
                for (LayoutManagementPayload layout : store.layouts) {
                    layoutStore.put(layout.pageId, layout);
                }
            }
        }
    }

    private void loadTemplates() throws IOException {
        File file = new File(TEMPLATES_FILE);
        if (file.exists()) {
            String json = Files.readString(Paths.get(TEMPLATES_FILE));
            TemplateStorePayload store = objectMapper.readValue(json, TemplateStorePayload.class);
            if (store.templates != null) {
                for (LayoutTemplatePayload template : store.templates) {
                    templateStore.put(template.templateId, template);
                }
            }
        }
    }

    private void loadThemes() throws IOException {
        File file = new File(THEMES_FILE);
        if (file.exists()) {
            String json = Files.readString(Paths.get(THEMES_FILE));
            ThemeStorePayload store = objectMapper.readValue(json, ThemeStorePayload.class);
            if (store.themes != null) {
                for (LayoutThemePayload theme : store.themes) {
                    themeStore.put(theme.themeId, theme);
                }
            }
        }
    }

    private void saveAllData() {
        try {
            saveLayouts();
            saveTemplates();
            saveThemes();
            log.info("All data saved to storage");
        } catch (Exception e) {
            log.error("Failed to save data", e);
        }
    }

    private void saveLayouts() throws IOException {
        LayoutStorePayload store = new LayoutStorePayload();
        store.layouts = new ArrayList<>(layoutStore.values());
        String json = objectMapper.writeValueAsString(store);
        Files.writeString(Paths.get(LAYOUTS_FILE), json);
    }

    private void saveTemplates() throws IOException {
        TemplateStorePayload store = new TemplateStorePayload();
        store.templates = new ArrayList<>(templateStore.values());
        String json = objectMapper.writeValueAsString(store);
        Files.writeString(Paths.get(TEMPLATES_FILE), json);
    }

    private void saveThemes() throws IOException {
        ThemeStorePayload store = new ThemeStorePayload();
        store.themes = new ArrayList<>(themeStore.values());
        String json = objectMapper.writeValueAsString(store);
        Files.writeString(Paths.get(THEMES_FILE), json);
    }

    private void initDefaultData() {
        LayoutManagementPayload homeLayout = new LayoutManagementPayload();
        homeLayout.pageId = "home";
        homeLayout.routePath = "/home";
        homeLayout.menuCode = "HMENU_HOME";
        homeLayout.domainCode = "home";
        homeLayout.layoutVersion = "v2";
        homeLayout.designTokenVersion = "krds-current";
        homeLayout.status = "PUBLISHED";
        homeLayout.version = 1;
        homeLayout.createdAt = LocalDateTime.now().toString();
        homeLayout.updatedAt = LocalDateTime.now().toString();
        homeLayout.sections = new ArrayList<>();
        layoutStore.put("home", homeLayout);

        LayoutManagementPayload adminHomeLayout = new LayoutManagementPayload();
        adminHomeLayout.pageId = "admin-home";
        adminHomeLayout.routePath = "/admin/";
        adminHomeLayout.menuCode = "AMENU_ADMIN_HOME";
        adminHomeLayout.domainCode = "admin";
        adminHomeLayout.layoutVersion = "v2";
        adminHomeLayout.designTokenVersion = "krds-current";
        adminHomeLayout.status = "PUBLISHED";
        adminHomeLayout.version = 1;
        adminHomeLayout.createdAt = LocalDateTime.now().toString();
        adminHomeLayout.updatedAt = LocalDateTime.now().toString();
        adminHomeLayout.sections = new ArrayList<>();
        layoutStore.put("admin-home", adminHomeLayout);

        LayoutManagementPayload menuMgmtLayout = new LayoutManagementPayload();
        menuMgmtLayout.pageId = "menu-management";
        menuMgmtLayout.routePath = "/admin/system/menu-management";
        menuMgmtLayout.menuCode = "GOV002201";
        menuMgmtLayout.domainCode = "admin";
        menuMgmtLayout.layoutVersion = "v2";
        menuMgmtLayout.designTokenVersion = "krds-current";
        menuMgmtLayout.status = "PUBLISHED";
        menuMgmtLayout.version = 1;
        menuMgmtLayout.createdAt = LocalDateTime.now().toString();
        menuMgmtLayout.updatedAt = LocalDateTime.now().toString();
        menuMgmtLayout.sections = new ArrayList<>();
        layoutStore.put("menu-management", menuMgmtLayout);

        LayoutManagementPayload layoutMgmtLayout = new LayoutManagementPayload();
        layoutMgmtLayout.pageId = "layout-management";
        layoutMgmtLayout.routePath = "/admin/system/layout-management";
        layoutMgmtLayout.menuCode = "GOV002203";
        layoutMgmtLayout.domainCode = "admin";
        layoutMgmtLayout.layoutVersion = "v2";
        layoutMgmtLayout.designTokenVersion = "krds-current";
        layoutMgmtLayout.status = "DRAFT";
        layoutMgmtLayout.version = 1;
        layoutMgmtLayout.createdAt = LocalDateTime.now().toString();
        layoutMgmtLayout.updatedAt = LocalDateTime.now().toString();
        layoutMgmtLayout.sections = new ArrayList<>();
        layoutStore.put("layout-management", layoutMgmtLayout);

        log.info("Initialized default layout data: {} layouts", layoutStore.size());
    }

    public LayoutPagesPayload getLayoutPages(String menuType) {
        LayoutPagesPayload payload = new LayoutPagesPayload();
        payload.pages = layoutStore.values().stream()
                .filter(layout -> menuType == null || menuType.equals(layout.domainCode) || menuType.equals("ADMIN"))
                .collect(Collectors.toList());
        return payload;
    }

    public LayoutManagementPayload getLayoutPageData(String pageId, String menuCode) {
        if (pageId != null && layoutStore.containsKey(pageId)) {
            return layoutStore.get(pageId);
        }
        if (menuCode != null) {
            return layoutStore.values().stream()
                    .filter(layout -> menuCode.equals(layout.menuCode))
                    .findFirst()
                    .orElse(createDefaultLayout(pageId != null ? pageId : "new-page", menuCode));
        }
        return createDefaultLayout("new-page", null);
    }

    private LayoutManagementPayload createDefaultLayout(String pageId, String menuCode) {
        LayoutManagementPayload layout = new LayoutManagementPayload();
        layout.pageId = pageId;
        layout.routePath = menuCode != null ? "/" + menuCode.toLowerCase().replace("_", "-") : "/new-page";
        layout.menuCode = menuCode;
        layout.domainCode = "admin";
        layout.layoutVersion = "v2";
        layout.designTokenVersion = "krds-current";
        layout.status = "DRAFT";
        layout.version = 1;
        layout.createdAt = LocalDateTime.now().toString();
        layout.updatedAt = LocalDateTime.now().toString();
        layout.sections = new ArrayList<>();
        return layout;
    }

    public Map<String, Object> saveLayout(String layoutJson) {
        try {
            LayoutManagementPayload layout = objectMapper.readValue(layoutJson, LayoutManagementPayload.class);
            layout.updatedAt = LocalDateTime.now().toString();
            if (layout.createdAt == null) {
                layout.createdAt = LocalDateTime.now().toString();
            }
            layoutStore.put(layout.pageId, layout);
            saveLayouts();
            return Map.of("success", true, "pageId", layout.pageId);
        } catch (Exception e) {
            log.error("Failed to save layout", e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    public Map<String, Object> deleteLayout(String pageId) {
        LayoutManagementPayload removed = layoutStore.remove(pageId);
        if (removed != null) {
            try { saveLayouts(); } catch (java.io.IOException e) { throw new RuntimeException(e); }
        }
        return Map.of("success", removed != null);
    }

    public Map<String, Object> publishLayout(String pageId) {
        LayoutManagementPayload layout = layoutStore.get(pageId);
        if (layout != null) {
            layout.status = "PUBLISHED";
            layout.updatedAt = LocalDateTime.now().toString();
            try { saveLayouts(); } catch (java.io.IOException e) { throw new RuntimeException(e); }
            return Map.of("success", true);
        }
        return Map.of("success", false);
    }

    public LayoutTemplatesPayload getLayoutTemplates() {
        LayoutTemplatesPayload payload = new LayoutTemplatesPayload();
        payload.templates = templateStore.values().stream().collect(Collectors.toList());
        return payload;
    }

    public LayoutTemplatePayload getLayoutTemplate(String templateId) {
        return templateStore.getOrDefault(templateId, createDefaultTemplate(templateId));
    }

    private LayoutTemplatePayload createDefaultTemplate(String templateId) {
        LayoutTemplatePayload template = new LayoutTemplatePayload();
        template.templateId = templateId != null ? templateId : "new-template";
        template.templateName = "새 템플릿";
        template.templateNameEn = "New Template";
        template.category = "FORM";
        template.sections = new ArrayList<>();
        return template;
    }

    public Map<String, Object> saveLayoutTemplate(String templateJson) {
        try {
            LayoutTemplatePayload template = objectMapper.readValue(templateJson, LayoutTemplatePayload.class);
            if (template.templateId == null) {
                template.templateId = "template-" + System.currentTimeMillis();
            }
            if (template.createdAt == null) {
                template.createdAt = LocalDateTime.now().toString();
            }
            template.updatedAt = LocalDateTime.now().toString();
            templateStore.put(template.templateId, template);
            saveTemplates();
            return Map.of("success", true, "templateId", template.templateId);
        } catch (Exception e) {
            log.error("Failed to save template", e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    public Map<String, Object> deleteLayoutTemplate(String templateId) {
        LayoutTemplatePayload removed = templateStore.remove(templateId);
        if (removed != null) {
            try { saveTemplates(); } catch (java.io.IOException e) { throw new RuntimeException(e); }
        }
        return Map.of("success", removed != null);
    }

    public LayoutThemesPayload getLayoutThemes() {
        LayoutThemesPayload payload = new LayoutThemesPayload();
        payload.themes = themeStore.values().stream().collect(Collectors.toList());
        return payload;
    }

    public Map<String, Object> saveLayoutTheme(String themeJson) {
        try {
            LayoutThemePayload theme = objectMapper.readValue(themeJson, LayoutThemePayload.class);
            if (theme.themeId == null) {
                theme.themeId = "theme-" + System.currentTimeMillis();
            }
            themeStore.put(theme.themeId, theme);
            saveThemes();
            return Map.of("success", true, "themeId", theme.themeId);
        } catch (Exception e) {
            log.error("Failed to save theme", e);
            return Map.of("success", false, "error", e.getMessage());
        }
    }

    public AiSuggestionsPayload getAiSuggestions(String domainCode, String pageId, String menuCode) {
        AiSuggestionsPayload payload = new AiSuggestionsPayload();
        payload.suggestions = new ArrayList<>();

        AiSuggestionPayload suggestion1 = new AiSuggestionPayload();
        suggestion1.sectionId = "ai-section-1";
        suggestion1.suggestedComponents = Arrays.asList("HeaderSection", "ContentGrid", "ActionBar");
        suggestion1.confidence = 0.85;
        suggestion1.reason = "대시보드 형식의 페이지에 적합한 섹션 조합입니다.";
        payload.suggestions.add(suggestion1);

        AiSuggestionPayload suggestion2 = new AiSuggestionPayload();
        suggestion2.sectionId = "ai-section-2";
        suggestion2.suggestedComponents = Arrays.asList("HeroSection", "FeatureGrid", "TestimonialSection", "CTASection");
        suggestion2.confidence = 0.72;
        suggestion2.reason = "랜딩 페이지 형식의 요소들을 추천합니다.";
        payload.suggestions.add(suggestion2);

        AiSuggestionPayload suggestion3 = new AiSuggestionPayload();
        suggestion3.sectionId = "ai-section-3";
        suggestion3.suggestedComponents = Arrays.asList("DataTable", "FilterBar", "Pagination", "ExportActions");
        suggestion3.confidence = 0.78;
        suggestion3.reason = "목록/테이블 페이지에 최적화된 구성입니다.";
        payload.suggestions.add(suggestion3);

        return payload;
    }

    public Map<String, Object> applyAiSuggestion(String suggestionId, String targetPageId) {
        LayoutManagementPayload layout = layoutStore.get(targetPageId);
        if (layout != null) {
            layout.updatedAt = LocalDateTime.now().toString();
            try { saveLayouts(); } catch (java.io.IOException e) { throw new RuntimeException(e); }
            return Map.of("success", true, "updatedLayout", layout);
        }
        return Map.of("success", false);
    }

    public static class LayoutPagesPayload {
        public List<LayoutManagementPayload> pages;
    }

    public static class LayoutTemplatesPayload {
        public List<LayoutTemplatePayload> templates = new ArrayList<>();
        public LayoutTemplatesPayload() {}
    }

    public static class LayoutThemesPayload {
        public List<LayoutThemePayload> themes = new ArrayList<>();
        public LayoutThemesPayload() {}
    }

    public static class LayoutStorePayload {
        public List<LayoutManagementPayload> layouts;
    }

    public static class TemplateStorePayload {
        public List<LayoutTemplatePayload> templates;
    }

    public static class ThemeStorePayload {
        public List<LayoutThemePayload> themes;
    }

    public static class LayoutThemePayload {
        public String themeId;
        public String themeName;
        public Map<String, Object> tokens;
        public Boolean isDefault;
    }

    public static class AiSuggestionPayload {
        public String sectionId;
        public List<String> suggestedComponents;
        public Double confidence;
        public String reason;
    }

    public static class AiSuggestionsPayload {
        public List<AiSuggestionPayload> suggestions;
    }
}