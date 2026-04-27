package egovframework.com.common.trace;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.mapper.UiObservabilityRegistryMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class UiManifestRegistryService implements UiManifestRegistryPort {

    private final UiObservabilityRegistryMapper uiObservabilityRegistryMapper;
    private final ObjectMapper objectMapper;

    public UiManifestRegistryService(UiObservabilityRegistryMapper uiObservabilityRegistryMapper, ObjectMapper objectMapper) {
        this.uiObservabilityRegistryMapper = uiObservabilityRegistryMapper;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public Map<String, Object> syncPageRegistry(Map<String, Object> page) {
        if (page == null) {
            return defaultRegistry();
        }
        String pageId = stringValue(page.get("pageId"));
        if (pageId.isEmpty()) {
            return defaultRegistry();
        }

        UiPageManifestVO manifest = new UiPageManifestVO();
        manifest.setPageId(pageId);
        manifest.setPageName(firstNonBlank(stringValue(page.get("label")), pageId));
        manifest.setRoutePath(stringValue(page.get("routePath")));
        manifest.setDomainCode(firstNonBlank(stringValue(page.get("domainCode")), "admin"));
        manifest.setMenuCode(stringValue(page.get("menuCode")));
        manifest.setLayoutVersion("v1");
        manifest.setDesignTokenVersion("krds-current");
        manifest.setActiveYn("Y");

        if (uiObservabilityRegistryMapper.countUiPageManifest(pageId) > 0) {
            uiObservabilityRegistryMapper.updateUiPageManifest(manifest);
        } else {
            uiObservabilityRegistryMapper.insertUiPageManifest(manifest);
        }

        uiObservabilityRegistryMapper.deleteUiPageComponentMaps(pageId);
        List<Map<String, Object>> surfaces = safeMapList(page.get("surfaces"));
        int displayOrder = 1;
        for (Map<String, Object> surface : surfaces) {
            if (surface == null) {
                continue;
            }
            String componentId = stringValue(surface.get("componentId"));
            if (!componentId.isEmpty()) {
                UiComponentRegistryVO component = new UiComponentRegistryVO();
                component.setComponentId(componentId);
                component.setComponentName(firstNonBlank(componentId, stringValue(surface.get("label"))));
                component.setComponentType(firstNonBlank(stringValue(surface.get("layoutZone")), "content"));
                component.setOwnerDomain(manifest.getDomainCode());
                component.setPropsSchemaJson(toJson(buildComponentProps(surface)));
                component.setDesignReference(stringValue(surface.get("selector")));
                component.setActiveYn("Y");
                upsertUiComponentRegistry(component);
            }

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("mapId", nextId("PCM"));
            map.put("pageId", pageId);
            map.put("layoutZone", stringValue(surface.get("layoutZone")));
            map.put("componentId", componentId);
            map.put("instanceKey", firstNonBlank(stringValue(surface.get("surfaceId")), componentId));
            map.put("displayOrder", displayOrder++);
            map.put("conditionalRuleSummary", stringValue(surface.get("notes")));
            uiObservabilityRegistryMapper.insertUiPageComponentMap(map);
        }

        return buildRegistryResponseSafely(pageId, page);
    }

    @Override
    public Map<String, Object> ensureManagedPageDraft(String pageId,
                                                      String pageName,
                                                      String routePath,
                                                      String menuCode,
                                                      String domainCode) {
        return syncPageRegistry(buildManagedPageDraft(pageId, pageName, routePath, menuCode, domainCode));
    }

    @Override
    public List<Map<String, Object>> selectActivePageOptions() {
        List<UiPageManifestVO> manifests;
        try {
            manifests = uiObservabilityRegistryMapper.selectUiPageManifestList();
        } catch (Exception e) {
            log.warn("Failed to read UI page manifest list. Returning empty options.", e);
            return Collections.emptyList();
        }
        if (manifests == null || manifests.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> options = new ArrayList<>();
        for (UiPageManifestVO manifest : manifests) {
            if (manifest == null) {
                continue;
            }
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("pageId", stringValue(manifest.getPageId()));
            option.put("label", firstNonBlank(stringValue(manifest.getPageName()), stringValue(manifest.getPageId())));
            option.put("routePath", stringValue(manifest.getRoutePath()));
            option.put("menuCode", stringValue(manifest.getMenuCode()));
            option.put("domainCode", firstNonBlank(stringValue(manifest.getDomainCode()), "admin"));
            options.add(option);
        }
        return options;
    }

    @Override
    public Map<String, Object> getPageRegistry(String pageId) {
        String normalizedPageId = stringValue(pageId);
        if (normalizedPageId.isEmpty()) {
            return defaultRegistry();
        }
        return buildRegistryResponseSafely(normalizedPageId, null);
    }

    private Map<String, Object> buildManagedPageDraft(String pageId,
                                                      String pageName,
                                                      String routePath,
                                                      String menuCode,
                                                      String domainCode) {
        String normalizedPageId = firstNonBlank(pageId, buildPageId(routePath, menuCode));
        String normalizedPageName = firstNonBlank(pageName, normalizedPageId);
        String normalizedRoutePath = stringValue(routePath);
        String normalizedMenuCode = stringValue(menuCode);
        String normalizedDomainCode = firstNonBlank(domainCode, inferDomainCode(normalizedRoutePath, normalizedMenuCode));

        Map<String, Object> page = new LinkedHashMap<>();
        page.put("pageId", normalizedPageId);
        page.put("label", normalizedPageName);
        page.put("routePath", normalizedRoutePath);
        page.put("menuCode", normalizedMenuCode);
        page.put("domainCode", normalizedDomainCode);
        page.put("surfaces", List.of(
                surface("managed-page-header", normalizedPageName + " 헤더", "[data-help-id=\"managed-page-header\"]", "ManagedPageHeader", "header",
                        List.of("managed-page-view"), "자동 생성된 페이지 초안 헤더 영역"),
                surface("managed-page-actions", normalizedPageName + " 액션", "[data-help-id=\"managed-page-actions\"]", "ManagedPageActions", "actions",
                        List.of("managed-page-view"), "자동 생성된 페이지 초안 액션 영역"),
                surface("managed-page-content", normalizedPageName + " 본문", "[data-help-id=\"managed-page-content\"]", "ManagedPageContent", "content",
                        List.of("managed-page-view"), "자동 생성된 페이지 초안 본문 영역")
        ));
        return page;
    }

    private Map<String, Object> surface(String surfaceId,
                                        String label,
                                        String selector,
                                        String componentId,
                                        String layoutZone,
                                        List<String> eventIds,
                                        String notes) {
        Map<String, Object> surface = new LinkedHashMap<>();
        surface.put("surfaceId", surfaceId);
        surface.put("label", label);
        surface.put("selector", selector);
        surface.put("componentId", componentId);
        surface.put("layoutZone", layoutZone);
        surface.put("eventIds", eventIds);
        surface.put("notes", notes);
        return surface;
    }

    private String buildPageId(String routePath, String menuCode) {
        String normalizedRoutePath = stringValue(routePath).toLowerCase(Locale.ROOT);
        if (!normalizedRoutePath.isEmpty()) {
            String compact = normalizedRoutePath
                    .replaceFirst("^/en/", "/")
                    .replaceFirst("^/", "")
                    .replace('/', '-')
                    .replace('_', '-')
                    .replaceAll("[^a-z0-9\\-]", "")
                    .replaceAll("-{2,}", "-");
            if (!compact.isEmpty()) {
                return compact;
            }
        }
        String normalizedMenuCode = stringValue(menuCode).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "-");
        return normalizedMenuCode.isEmpty() ? "managed-page" : normalizedMenuCode;
    }

    private String inferDomainCode(String routePath, String menuCode) {
        String normalizedRoutePath = stringValue(routePath);
        String normalizedMenuCode = stringValue(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedRoutePath.startsWith("/admin/") || normalizedRoutePath.startsWith("/en/admin/") || normalizedMenuCode.startsWith("A")) {
            return "admin";
        }
        if (normalizedRoutePath.startsWith("/join/") || normalizedRoutePath.startsWith("/join/en/")) {
            return "join";
        }
        return "home";
    }

    private Map<String, Object> buildRegistryResponse(UiPageManifestVO manifest, List<UiPageComponentDetailVO> components) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pageId", manifest == null ? "" : stringValue(manifest.getPageId()));
        response.put("pageName", manifest == null ? "" : stringValue(manifest.getPageName()));
        response.put("routePath", manifest == null ? "" : stringValue(manifest.getRoutePath()));
        response.put("menuCode", manifest == null ? "" : stringValue(manifest.getMenuCode()));
        response.put("domainCode", manifest == null ? "" : stringValue(manifest.getDomainCode()));
        response.put("layoutVersion", manifest == null ? "" : stringValue(manifest.getLayoutVersion()));
        response.put("designTokenVersion", manifest == null ? "" : stringValue(manifest.getDesignTokenVersion()));
        response.put("componentCount", components == null ? 0 : components.size());
        response.put("components", components == null ? Collections.emptyList() : components);
        return response;
    }

    private Map<String, Object> buildRegistryResponseSafely(String pageId, Map<String, Object> fallbackPage) {
        UiPageManifestVO manifest = null;
        List<UiPageComponentDetailVO> components = Collections.emptyList();
        try {
            manifest = uiObservabilityRegistryMapper.selectUiPageManifest(pageId);
        } catch (Exception e) {
            log.warn("Failed to read UI page manifest. pageId={}", pageId, e);
        }
        try {
            components = uiObservabilityRegistryMapper.selectUiPageComponentDetails(pageId);
        } catch (Exception e) {
            log.warn("Failed to read UI page component details. pageId={}. Falling back to manifest-only registry.", pageId, e);
        }
        if (manifest == null && fallbackPage != null) {
            return fallbackRegistryFromPage(fallbackPage);
        }
        return buildRegistryResponse(manifest, components);
    }

    private Map<String, Object> fallbackRegistryFromPage(Map<String, Object> page) {
        Map<String, Object> response = defaultRegistry();
        response.put("pageId", stringValue(page.get("pageId")));
        response.put("pageName", firstNonBlank(stringValue(page.get("label")), stringValue(page.get("pageId"))));
        response.put("routePath", stringValue(page.get("routePath")));
        response.put("menuCode", stringValue(page.get("menuCode")));
        response.put("domainCode", firstNonBlank(stringValue(page.get("domainCode")), "admin"));
        response.put("layoutVersion", "v1");
        response.put("designTokenVersion", "krds-current");
        return response;
    }

    private Map<String, Object> buildComponentProps(Map<String, Object> surface) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("label", stringValue(surface.get("label")));
        props.put("selector", stringValue(surface.get("selector")));
        props.put("eventIds", surface.get("eventIds"));
        props.put("notes", stringValue(surface.get("notes")));
        return props;
    }

    private void upsertUiComponentRegistry(UiComponentRegistryVO component) {
        boolean exists = uiObservabilityRegistryMapper.countUiComponentRegistry(component.getComponentId()) > 0;
        try {
            if (exists) {
                uiObservabilityRegistryMapper.updateUiComponentRegistry(component);
            } else {
                uiObservabilityRegistryMapper.insertUiComponentRegistry(component);
            }
        } catch (Exception e) {
            log.warn("Failed to upsert UI component registry for componentId={}", component.getComponentId(), e);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize registry payload.", e);
            return "{}";
        }
    }

    private List<Map<String, Object>> safeMapList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<?> list = (List<?>) value;
        List<Map<String, Object>> items = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) item;
                items.add(map);
            }
        }
        return items;
    }

    private Map<String, Object> defaultRegistry() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pageId", "");
        response.put("pageName", "");
        response.put("routePath", "");
        response.put("menuCode", "");
        response.put("domainCode", "");
        response.put("layoutVersion", "");
        response.put("designTokenVersion", "");
        response.put("componentCount", 0);
        response.put("components", Collections.emptyList());
        return response;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String firstNonBlank(String primary, String fallback) {
        String first = stringValue(primary);
        return first.isEmpty() ? stringValue(fallback) : first;
    }

    private String nextId(String prefix) {
        String base = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return prefix + "-" + base.substring(0, 16);
    }
}
