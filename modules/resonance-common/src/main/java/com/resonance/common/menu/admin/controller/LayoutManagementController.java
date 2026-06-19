package com.resonance.common.menu.admin.controller;

import com.resonance.common.menu.admin.service.LayoutManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/admin/layout")
public class LayoutManagementController {

    private final LayoutManagementService layoutService;

    public LayoutManagementController(LayoutManagementService layoutService) {
        this.layoutService = layoutService;
    }

    @GetMapping("/pages")
    public ResponseEntity<LayoutManagementService.LayoutPagesPayload> getLayoutPages(
            @RequestParam(required = false) String menuType) {
        return ResponseEntity.ok(layoutService.getLayoutPages(menuType));
    }

    @GetMapping("/page-data")
    public ResponseEntity<com.resonance.common.menu.admin.dto.LayoutManagementPayload> getLayoutPageData(
            @RequestParam(required = false) String pageId,
            @RequestParam(required = false) String menuCode) {
        return ResponseEntity.ok(layoutService.getLayoutPageData(pageId, menuCode));
    }

    @PostMapping("/save")
    public ResponseEntity<Map<String, Object>> saveLayout(
            @RequestParam String layoutJson) {
        return ResponseEntity.ok(layoutService.saveLayout(layoutJson));
    }

    @PostMapping("/delete")
    public ResponseEntity<Map<String, Object>> deleteLayout(
            @RequestParam String pageId) {
        return ResponseEntity.ok(layoutService.deleteLayout(pageId));
    }

    @PostMapping("/publish")
    public ResponseEntity<Map<String, Object>> publishLayout(
            @RequestParam String pageId) {
        return ResponseEntity.ok(layoutService.publishLayout(pageId));
    }

    @GetMapping("/templates")
    public ResponseEntity<LayoutTemplatesPayload> getLayoutTemplates() {
        return ResponseEntity.ok(layoutService.getLayoutTemplates());
    }

    @GetMapping("/template")
    public ResponseEntity<com.resonance.common.menu.admin.dto.LayoutTemplatePayload> getLayoutTemplate(
            @RequestParam String templateId) {
        return ResponseEntity.ok(layoutService.getLayoutTemplate(templateId));
    }

    @PostMapping("/save-template")
    public ResponseEntity<Map<String, Object>> saveLayoutTemplate(
            @RequestParam String templateJson) {
        return ResponseEntity.ok(layoutService.saveLayoutTemplate(templateJson));
    }

    @PostMapping("/delete-template")
    public ResponseEntity<Map<String, Object>> deleteLayoutTemplate(
            @RequestParam String templateId) {
        return ResponseEntity.ok(layoutService.deleteLayoutTemplate(templateId));
    }

    @GetMapping("/themes")
    public ResponseEntity<LayoutThemesPayload> getLayoutThemes() {
        return ResponseEntity.ok(layoutService.getLayoutThemes());
    }

    @PostMapping("/save-theme")
    public ResponseEntity<Map<String, Object>> saveLayoutTheme(
            @RequestParam String themeJson) {
        return ResponseEntity.ok(layoutService.saveLayoutTheme(themeJson));
    }

    @GetMapping("/ai-suggestions")
    public ResponseEntity<LayoutManagementService.AiSuggestionsPayload> getAiSuggestions(
            @RequestParam String domainCode,
            @RequestParam(required = false) String pageId,
            @RequestParam(required = false) String menuCode) {
        return ResponseEntity.ok(layoutService.getAiSuggestions(domainCode, pageId, menuCode));
    }

    @PostMapping("/apply-ai-suggestion")
    public ResponseEntity<Map<String, Object>> applyAiSuggestion(
            @RequestParam String suggestionId,
            @RequestParam String targetPageId) {
        return ResponseEntity.ok(layoutService.applyAiSuggestion(suggestionId, targetPageId));
    }

    public static class LayoutTemplatesPayload {
        public java.util.List<com.resonance.common.menu.admin.dto.LayoutTemplatePayload> templates;
    }

    public static class LayoutThemesPayload {
        public java.util.List<LayoutManagementService.LayoutThemePayload> themes;
    }
}