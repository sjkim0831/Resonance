package egovframework.com.framework.builder.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;
import egovframework.com.framework.builder.model.FrameworkBuilderComponentContractVO;
import egovframework.com.framework.builder.model.FrameworkBuilderContractVO;
import egovframework.com.framework.builder.model.FrameworkBuilderPageContractVO;
import egovframework.com.framework.builder.model.FrameworkBuilderProfilesVO;
import egovframework.com.framework.builder.model.FrameworkBuilderSurfaceContractVO;
import egovframework.com.framework.builder.support.FrameworkBuilderMetadataPort;
import egovframework.com.framework.builder.support.FrameworkBuilderObservabilityPort;
import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryItemVO;
import egovframework.com.platform.screenbuilder.service.ScreenBuilderDraftService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

@Service
public class FrameworkBuilderContractService {

    private static final Set<String> BUILDER_READY_COMPONENT_TYPES = Set.of("button", "input", "select", "textarea", "table", "pagination");

    private final FrameworkBuilderObservabilityPort frameworkBuilderObservabilityPort;
    private final ScreenBuilderDraftService screenBuilderDraftService;
    private final FrameworkBuilderMetadataPort frameworkBuilderMetadataPort;
    private final ObjectMapper objectMapper;

    public FrameworkBuilderContractService(FrameworkBuilderObservabilityPort frameworkBuilderObservabilityPort,
                                           ScreenBuilderDraftService screenBuilderDraftService,
                                           FrameworkBuilderMetadataPort frameworkBuilderMetadataPort,
                                           ObjectMapper objectMapper) {
        this.frameworkBuilderObservabilityPort = frameworkBuilderObservabilityPort;
        this.screenBuilderDraftService = screenBuilderDraftService;
        this.frameworkBuilderMetadataPort = frameworkBuilderMetadataPort;
        this.objectMapper = objectMapper;
    }

    public FrameworkBuilderContractVO getBuilderContract(boolean isEn) throws Exception {
        FrameworkContractMetadataVO metadata = frameworkBuilderMetadataPort.getMetadata();
        FrameworkBuilderContractVO contract = new FrameworkBuilderContractVO();
        contract.setFrameworkId(metadata.getFrameworkId());
        contract.setFrameworkName(metadata.getFrameworkName());
        contract.setContractVersion(metadata.getContractVersion());
        contract.setSource("backend-runtime-registry");
        contract.setGeneratedAt(OffsetDateTime.now().toString());
        contract.setPages(buildPages());
        contract.setComponents(buildComponents(isEn));
        contract.setBuilderProfiles(buildProfiles(metadata));
        validateContract(metadata, contract);
        return contract;
    }

    private List<FrameworkBuilderPageContractVO> buildPages() throws Exception {
        List<UiPageManifestVO> manifests = frameworkBuilderObservabilityPort.selectUiPageManifestList();
        if (manifests == null || manifests.isEmpty()) {
            return Collections.emptyList();
        }

        List<FrameworkBuilderPageContractVO> pages = new ArrayList<>();
        for (UiPageManifestVO manifest : manifests) {
            if (manifest == null) {
                continue;
            }
            List<UiPageComponentDetailVO> details = frameworkBuilderObservabilityPort.selectUiPageComponentDetails(safe(manifest.getPageId()));
            FrameworkBuilderPageContractVO page = new FrameworkBuilderPageContractVO();
            page.setPageId(safe(manifest.getPageId()));
            page.setLabel(firstNonBlank(manifest.getPageName(), manifest.getPageId()));
            page.setRoutePath(safe(manifest.getRoutePath()));
            page.setMenuCode(safe(manifest.getMenuCode()));
            page.setDomainCode(firstNonBlank(manifest.getDomainCode(), "admin"));
            page.setLayoutVersion(safe(manifest.getLayoutVersion()));
            page.setDesignTokenVersion(safe(manifest.getDesignTokenVersion()));
            page.setComponentCount(details == null ? 0 : details.size());
            page.setComponents(buildPageComponents(details));
            pages.add(page);
        }
        pages.sort((left, right) -> safe(left.getPageId()).compareTo(safe(right.getPageId())));
        return pages;
    }

    private List<FrameworkBuilderSurfaceContractVO> buildPageComponents(List<UiPageComponentDetailVO> details) {
        if (details == null || details.isEmpty()) {
            return Collections.emptyList();
        }
        List<FrameworkBuilderSurfaceContractVO> components = new ArrayList<>();
        for (UiPageComponentDetailVO detail : details) {
            if (detail == null) {
                continue;
            }
            FrameworkBuilderSurfaceContractVO component = new FrameworkBuilderSurfaceContractVO();
            component.setComponentId(safe(detail.getComponentId()));
            component.setInstanceKey(safe(detail.getInstanceKey()));
            component.setLayoutZone(safe(detail.getLayoutZone()));
            component.setDisplayOrder(detail.getDisplayOrder());
            component.setPropsSummary(parsePropsSummary(detail.getPropsSchemaJson()));
            component.setConditionalRuleSummary(safe(detail.getConditionalRuleSummary()));
            components.add(component);
        }
        return components;
    }

    private List<FrameworkBuilderComponentContractVO> buildComponents(boolean isEn) throws Exception {
        List<UiComponentRegistryVO> registryRows = frameworkBuilderObservabilityPort.selectUiComponentRegistryList();
        List<ScreenBuilderComponentRegistryItemVO> builderRows = screenBuilderDraftService.getComponentRegistry(isEn);

        Map<String, FrameworkBuilderComponentContractVO> merged = new LinkedHashMap<>();
        if (registryRows != null) {
            for (UiComponentRegistryVO row : registryRows) {
                if (row == null || safe(row.getComponentId()).isEmpty()) {
                    continue;
                }
                merged.put(safe(row.getComponentId()), fromRegistryRow(row));
            }
        }
        List<ScreenBuilderComponentRegistryItemVO> safeBuilderRows =
                builderRows == null ? Collections.<ScreenBuilderComponentRegistryItemVO>emptyList() : builderRows;
        for (ScreenBuilderComponentRegistryItemVO row : safeBuilderRows) {
            if (row == null || safe(row.getComponentId()).isEmpty()) {
                continue;
            }
            FrameworkBuilderComponentContractVO component = merged.computeIfAbsent(safe(row.getComponentId()), key -> new FrameworkBuilderComponentContractVO());
            mergeBuilderRow(component, row);
        }
        List<FrameworkBuilderComponentContractVO> components = new ArrayList<>(merged.values());
        components.sort((left, right) -> safe(left.getComponentId()).compareTo(safe(right.getComponentId())));
        return components;
    }

    private FrameworkBuilderComponentContractVO fromRegistryRow(UiComponentRegistryVO row) throws Exception {
        FrameworkBuilderComponentContractVO component = new FrameworkBuilderComponentContractVO();
        component.setComponentId(safe(row.getComponentId()));
        component.setLabel(firstNonBlank(row.getComponentName(), row.getComponentId()));
        component.setComponentType(safe(row.getComponentType()));
        component.setOwnerDomain(firstNonBlank(row.getOwnerDomain(), "admin"));
        component.setStatus("Y".equalsIgnoreCase(safe(row.getActiveYn())) ? "ACTIVE" : "INACTIVE");
        component.setSourceType("ui-manifest-registry");
        component.setReplacementComponentId("");
        component.setDesignReference(safe(row.getDesignReference()));
        component.setPropsSchemaJson(safe(row.getPropsSchemaJson()));
        component.setUsageCount(safeInt(frameworkBuilderObservabilityPort.countUiComponentUsage(safe(row.getComponentId()))));
        component.setRouteCount(component.getUsageCount());
        component.setInstanceCount(component.getUsageCount());
        component.setLabels(new ArrayList<>());
        component.setBuilderReady(BUILDER_READY_COMPONENT_TYPES.contains(safe(row.getComponentType()).toLowerCase(Locale.ROOT)));
        return component;
    }

    private void mergeBuilderRow(FrameworkBuilderComponentContractVO target, ScreenBuilderComponentRegistryItemVO row) {
        target.setComponentId(firstNonBlank(target.getComponentId(), row.getComponentId()));
        target.setLabel(firstNonBlank(row.getLabel(), target.getLabel(), row.getComponentId()));
        target.setComponentType(firstNonBlank(row.getComponentType(), target.getComponentType()));
        target.setOwnerDomain(firstNonBlank(target.getOwnerDomain(), "admin"));
        target.setStatus(firstNonBlank(row.getStatus(), target.getStatus(), "ACTIVE"));
        target.setSourceType(firstNonBlank(row.getSourceType(), target.getSourceType(), "screen-builder-registry"));
        target.setReplacementComponentId(firstNonBlank(row.getReplacementComponentId(), target.getReplacementComponentId()));
        target.setDesignReference(firstNonBlank(target.getDesignReference(), ""));
        target.setPropsSchemaJson(firstNonBlank(target.getPropsSchemaJson(), toPropsSchema(row)));
        target.setUsageCount(firstNonBlankInt(target.getUsageCount(), row.getUsageCount(), 0));
        target.setRouteCount(firstNonBlankInt(target.getRouteCount(), row.getUsageCount(), 0));
        target.setInstanceCount(firstNonBlankInt(target.getInstanceCount(), row.getUsageCount(), 0));
        target.setLabels(buildLabels(row));
        target.setBuilderReady(BUILDER_READY_COMPONENT_TYPES.contains(safe(target.getComponentType()).toLowerCase(Locale.ROOT)));
    }

    private FrameworkBuilderProfilesVO buildProfiles(FrameworkContractMetadataVO metadata) {
        FrameworkBuilderProfilesVO profiles = new FrameworkBuilderProfilesVO();
        profiles.setPageFrameProfileIds(new ArrayList<>(metadata.getBuilderProfiles().getPageFrameProfileIds()));
        profiles.setLayoutZoneIds(new ArrayList<>(metadata.getBuilderProfiles().getLayoutZoneIds()));
        profiles.setComponentTypeIds(new ArrayList<>(metadata.getBuilderProfiles().getComponentTypeIds()));
        profiles.setArtifactUnitIds(new ArrayList<>(metadata.getBuilderProfiles().getArtifactUnitIds()));
        return profiles;
    }

    private List<String> parsePropsSummary(String propsSchemaJson) {
        String source = safe(propsSchemaJson).trim();
        if (source.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> props = new ArrayList<>();
        if (source.contains("\"label\"")) {
            props.add("label");
        }
        if (source.contains("\"selector\"")) {
            props.add("selector");
        }
        if (source.contains("\"eventIds\"")) {
            props.add("eventIds");
        }
        if (source.contains("\"notes\"")) {
            props.add("notes");
        }
        return props;
    }

    private String toPropsSchema(ScreenBuilderComponentRegistryItemVO row) {
        Map<String, Object> props = row == null || row.getPropsTemplate() == null
                ? Collections.emptyMap()
                : row.getPropsTemplate();
        try {
            return objectMapper.writeValueAsString(props);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize component props schema. componentId="
                    + (row == null ? "" : safe(row.getComponentId())), e);
        }
    }

    private List<String> buildLabels(ScreenBuilderComponentRegistryItemVO row) {
        Set<String> labels = new LinkedHashSet<>();
        if (row != null) {
            if (!safe(row.getLabel()).isEmpty()) {
                labels.add(safe(row.getLabel()));
            }
            if (!safe(row.getLabelEn()).isEmpty()) {
                labels.add(safe(row.getLabelEn()));
            }
        }
        return new ArrayList<>(labels);
    }

    private Integer firstNonBlankInt(Integer primary, Integer fallback, Integer defaultValue) {
        if (primary != null) {
            return primary;
        }
        if (fallback != null) {
            return fallback;
        }
        return defaultValue;
    }

    private Integer safeInt(int value) {
        return value;
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

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private void validateContract(FrameworkContractMetadataVO metadata, FrameworkBuilderContractVO contract) {
        if (!safe(metadata.getFrameworkId()).equals(safe(contract.getFrameworkId()))) {
            throw new IllegalStateException("Framework builder contract frameworkId mismatch.");
        }
        if (!safe(metadata.getFrameworkName()).equals(safe(contract.getFrameworkName()))) {
            throw new IllegalStateException("Framework builder contract frameworkName mismatch.");
        }
        if (!safe(metadata.getContractVersion()).equals(safe(contract.getContractVersion()))) {
            throw new IllegalStateException("Framework builder contract version mismatch.");
        }

        Set<String> allowedLayoutZones = new HashSet<>();
        for (String value : metadata.getBuilderProfiles().getLayoutZoneIds()) {
            if (!safe(value).isEmpty()) {
                allowedLayoutZones.add(safe(value));
            }
        }
        Set<String> allowedComponentTypes = new HashSet<>();
        for (String value : metadata.getBuilderProfiles().getComponentTypeIds()) {
            if (!safe(value).isEmpty()) {
                allowedComponentTypes.add(safe(value).toLowerCase(Locale.ROOT));
            }
        }

        for (FrameworkBuilderPageContractVO page : contract.getPages()) {
            if (page == null || page.getComponents() == null) {
                continue;
            }
            for (FrameworkBuilderSurfaceContractVO component : page.getComponents()) {
                if (component == null) {
                    continue;
                }
                String layoutZone = safe(component.getLayoutZone());
                if (!layoutZone.isEmpty() && !allowedLayoutZones.contains(layoutZone)) {
                    throw new IllegalStateException("Unsupported framework layout zone: " + layoutZone
                            + " pageId=" + safe(page.getPageId())
                            + " componentId=" + safe(component.getComponentId()));
                }
            }
        }

        for (FrameworkBuilderComponentContractVO component : contract.getComponents()) {
            if (component == null) {
                continue;
            }
            String componentType = safe(component.getComponentType()).toLowerCase(Locale.ROOT);
            if (!componentType.isEmpty() && !allowedComponentTypes.contains(componentType)) {
                throw new IllegalStateException("Unsupported framework component type: " + componentType
                        + " componentId=" + safe(component.getComponentId()));
            }
        }
    }
}
