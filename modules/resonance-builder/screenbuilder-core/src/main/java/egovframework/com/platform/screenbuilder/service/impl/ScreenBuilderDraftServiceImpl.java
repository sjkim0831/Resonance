package egovframework.com.platform.screenbuilder.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderAuthorityProfileVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryItemVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistrySaveRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryUpdateRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentUsageVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderEventBindingVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderSaveRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderVersionSummaryVO;
import egovframework.com.platform.screenbuilder.service.ScreenBuilderDraftService;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderAuthorityContractPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderComponentRegistryPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderDraftStoragePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderLegacyRegistrySourcePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuCatalogPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareRequest;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareResult;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScreenBuilderDraftServiceImpl implements ScreenBuilderDraftService {

    private static final Logger log = LoggerFactory.getLogger(ScreenBuilderDraftServiceImpl.class);

    private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss", Locale.KOREA);
    private static final String DEFAULT_TEMPLATE_TYPE = "EDIT_PAGE";
    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final List<Map<String, Object>> COMPONENT_PALETTE = Arrays.asList(
            palette("section", "Section", "섹션", "Form section container"),
            palette("heading", "Heading", "제목", "Section heading"),
            palette("text", "Text", "설명", "Static guidance text"),
            palette("input", "Input", "입력", "Single-line input field"),
            palette("textarea", "Textarea", "긴 입력", "Multi-line text input"),
            palette("select", "Select", "선택", "Option selector"),
            palette("checkbox", "Checkbox", "체크박스", "Boolean toggle"),
            palette("button", "Button", "버튼", "Submit or utility button"),
            palette("table", "Table", "테이블", "List or grid result block"),
            palette("pagination", "Pagination", "페이지네이션", "Paged list navigation")
    );

    private final ObjectMapper objectMapper;
    private final ScreenBuilderArtifactNamingPolicyPort screenBuilderArtifactNamingPolicyPort;
    private final ScreenBuilderComponentRegistryPort screenBuilderComponentRegistryPort;
    private final ScreenBuilderAuthorityContractPort screenBuilderAuthorityContractPort;
    private final ScreenBuilderDraftStoragePort screenBuilderDraftStoragePort;
    private final ScreenBuilderLegacyRegistrySourcePort screenBuilderLegacyRegistrySourcePort;
    private final ScreenBuilderMenuBindingPolicyPort screenBuilderMenuBindingPolicyPort;
    private final ScreenBuilderMenuCatalogPort screenBuilderMenuCatalogPort;
    private final ScreenBuilderCommandPagePort screenBuilderCommandPagePort;
    private final ScreenBuilderRuntimeComparePort screenBuilderRuntimeComparePort;
    private final ScreenBuilderRuntimeComparePolicyPort screenBuilderRuntimeComparePolicyPort;

    @Override
    public Map<String, Object> getPagePayload(String menuCode, String pageId, String menuTitle, String menuUrl, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, pageId, menuTitle, menuUrl);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("menuCode", safe(draft.getMenuCode()));
        payload.put("pageId", safe(draft.getPageId()));
        payload.put("menuTitle", safe(draft.getMenuTitle()));
        payload.put("menuUrl", safe(draft.getMenuUrl()));
        payload.put("builderId", safe(draft.getBuilderId()));
        payload.put("versionId", safe(draft.getVersionId()));
        payload.put("versionStatus", safe(draft.getVersionStatus().isEmpty() ? "DRAFT" : draft.getVersionStatus()));
        payload.put("templateType", safe(draft.getTemplateType().isEmpty() ? DEFAULT_TEMPLATE_TYPE : draft.getTemplateType()));
        payload.put("authorityProfile", draft.getAuthorityProfile());
        payload.put("componentPalette", COMPONENT_PALETTE);
        payload.put("componentRegistry", getComponentRegistry(isEn));
        payload.put("componentTypeOptions", getComponentRegistry(isEn).stream()
                .map(ScreenBuilderComponentRegistryItemVO::getComponentType)
                .filter(value -> !safe(value).isEmpty())
                .distinct()
                .sorted()
                .collect(Collectors.toList()));
        payload.put("registryDiagnostics", getRegistryDiagnostics(draft, isEn));
        payload.put("nodes", draft.getNodes());
        payload.put("events", draft.getEvents());
        List<ScreenBuilderVersionSummaryVO> versionHistory = getVersionHistory(menuCode);
        payload.put("versionHistory", versionHistory);
        ScreenBuilderVersionSummaryVO publishedVersion = findLatestPublishedVersion(versionHistory);
        payload.put("publishedVersionId", publishedVersion == null ? "" : safe(publishedVersion.getVersionId()));
        payload.put("publishedSavedAt", publishedVersion == null ? "" : safe(publishedVersion.getSavedAt()));
        String releaseUnitId = screenBuilderArtifactNamingPolicyPort.resolveReleaseUnitId(
                draft,
                publishedVersion == null ? "" : safe(publishedVersion.getVersionId()));
        payload.put("releaseUnitId", releaseUnitId);
        payload.put("artifactEvidence", screenBuilderArtifactNamingPolicyPort.buildArtifactEvidence(
                draft,
                releaseUnitId,
                publishedVersion == null ? "" : safe(publishedVersion.getVersionId()),
                publishedVersion == null ? "" : safe(publishedVersion.getSavedAt())));
        payload.put("previewAvailable", !draft.getNodes().isEmpty());
        payload.put("screenBuilderMessage", safe(menuCode).isEmpty()
                ? (isEn ? "Select a page menu from environment management to start the builder." : "환경관리 화면에서 페이지 메뉴를 선택한 뒤 빌더를 시작하세요.")
                : "");
        return payload;
    }

    @Override
    public Map<String, Object> getStatusSummary(List<String> menuCodes, boolean isEn) throws Exception {
        List<String> normalizedMenuCodes = normalizeMenuCodes(menuCodes);
        List<Map<String, Object>> items = new ArrayList<>();
        for (String menuCode : normalizedMenuCodes) {
            items.add(readOrBuildStatusSummaryProjection(menuCode, isEn));
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("items", items);
        response.put("count", items.size());
        response.put("projectId", screenBuilderRuntimeComparePolicyPort.resolveProjectId());
        return response;
    }

    @Override
    public Map<String, Object> rebuildStatusSummary(List<String> menuCodes, boolean isEn) throws Exception {
        List<String> normalizedMenuCodes = normalizeMenuCodes(menuCodes);
        if (normalizedMenuCodes.isEmpty()) {
            normalizedMenuCodes = resolveAllPageMenuCodes();
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (String menuCode : normalizedMenuCodes) {
            Map<String, Object> computed = buildStatusSummaryItem(menuCode, isEn);
            writeStatusSummaryProjection(menuCode, isEn, computed);
            items.add(computed);
        }
        return successResponse(
                isEn ? "Status summary projections rebuilt." : "상태 요약 프로젝션을 재생성했습니다.",
                "items", items,
                "count", items.size(),
                "projectId", screenBuilderRuntimeComparePolicyPort.resolveProjectId());
    }

    @Override
    public Map<String, Object> saveDraft(ScreenBuilderSaveRequestVO request, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = createNormalizedDraft(request);
        validateDraft(draft);
        persistDraftMutation(draft);

        return successResponse(
                isEn ? "Screen builder draft saved." : "화면 빌더 초안을 저장했습니다.",
                "menuCode", draft.getMenuCode(),
                "builderId", draft.getBuilderId(),
                "versionId", draft.getVersionId());
    }

    @Override
    public ScreenBuilderDraftDocumentVO getDraft(String menuCode, String pageId, String menuTitle, String menuUrl) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return createDefaultDraft(pageId, normalizedMenuCode, menuTitle, menuUrl);
        }
        ScreenBuilderDraftDocumentVO stored = screenBuilderDraftStoragePort.loadDraft(normalizedMenuCode);
        if (stored != null) {
            if (safe(stored.getMenuTitle()).isEmpty() || safe(stored.getMenuUrl()).isEmpty() || safe(stored.getPageId()).isEmpty()) {
                hydrateMenuMetadata(stored, pageId, menuTitle, menuUrl);
            }
            return stored;
        }
        return createDefaultDraft(pageId, normalizedMenuCode, menuTitle, menuUrl);
    }

    @Override
    public List<ScreenBuilderVersionSummaryVO> getVersionHistory(String menuCode) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        List<ScreenBuilderVersionSummaryVO> rows = new ArrayList<>();
        if (normalizedMenuCode.isEmpty()) {
            return rows;
        }
        for (ScreenBuilderDraftDocumentVO document : screenBuilderDraftStoragePort.listHistoryVersions(normalizedMenuCode)) {
            ScreenBuilderVersionSummaryVO item = new ScreenBuilderVersionSummaryVO();
            item.setVersionId(safe(document.getVersionId()));
            item.setVersionStatus(firstNonBlank(document.getVersionStatus(), "DRAFT"));
            item.setMenuCode(safe(document.getMenuCode()));
            item.setPageId(safe(document.getPageId()));
            item.setTemplateType(safe(document.getTemplateType()));
            item.setSavedAt(safe(document.getVersionId()));
            item.setNodeCount(document.getNodes() == null ? 0 : document.getNodes().size());
            item.setEventCount(document.getEvents() == null ? 0 : document.getEvents().size());
            rows.add(item);
        }
        return rows;
    }

    @Override
    public Map<String, Object> restoreDraftVersion(String menuCode, String versionId, boolean isEn) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        String normalizedVersionId = safe(versionId);
        if (normalizedMenuCode.isEmpty() || normalizedVersionId.isEmpty()) {
            throw new IllegalArgumentException("menuCode and versionId are required");
        }
        ScreenBuilderDraftDocumentVO restored = screenBuilderDraftStoragePort.loadHistoryVersion(normalizedMenuCode, normalizedVersionId);
        if (restored == null) {
            throw new IllegalArgumentException("Selected version does not exist");
        }
        if ("PUBLISHED".equalsIgnoreCase(safe(restored.getVersionStatus()))) {
            throw new IllegalArgumentException(isEn
                    ? "Published snapshots are protected and cannot be restored as draft."
                    : "Publish 스냅샷은 보호되어 있어 초안으로 복원할 수 없습니다.");
        }
        restored.setVersionId(UUID.randomUUID().toString());
        restored.setVersionStatus("DRAFT");
        persistDraftMutation(restored);
        return successResponse(
                isEn ? "Draft restored from selected version." : "선택한 버전으로 초안을 복원했습니다.",
                "menuCode", normalizedMenuCode,
                "versionId", restored.getVersionId());
    }

    @Override
    public Map<String, Object> publishDraft(String menuCode, boolean isEn) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            throw new IllegalArgumentException("menuCode is required");
        }
        ScreenBuilderDraftDocumentVO currentDraft = getDraft(normalizedMenuCode, "", "", "");
        Map<String, Object> diagnostics = getRegistryDiagnostics(currentDraft, isEn);
        int unregisteredCount = sizeOfList(diagnostics.get("unregisteredNodes"));
        int missingCount = sizeOfList(diagnostics.get("missingNodes"));
        int deprecatedCount = sizeOfList(diagnostics.get("deprecatedNodes"));
        List<String> authorityValidationErrors = validateAuthorityProfile(currentDraft, true);
        if (!authorityValidationErrors.isEmpty()) {
            throw new IllegalArgumentException(firstNonBlank(authorityValidationErrors.get(0), "Authority profile is invalid."));
        }
        List<String> authorityAlignmentErrors = validateAuthorityEventAlignment(currentDraft, true);
        if (!authorityAlignmentErrors.isEmpty()) {
            throw new IllegalArgumentException(firstNonBlank(authorityAlignmentErrors.get(0), "Authority profile is not aligned with builder actions."));
        }
        if (unregisteredCount > 0 || missingCount > 0 || deprecatedCount > 0) {
            throw new IllegalArgumentException(isEn
                    ? String.format("Publish is blocked. Unregistered=%d, Missing=%d, Deprecated=%d", unregisteredCount, missingCount, deprecatedCount)
                    : String.format("Publish가 차단되었습니다. 미등록=%d, 누락=%d, Deprecated=%d", unregisteredCount, missingCount, deprecatedCount));
        }
        currentDraft.setVersionId(UUID.randomUUID().toString());
        currentDraft.setVersionStatus("PUBLISHED");
        writeHistorySnapshot(currentDraft, false);
        invalidateStatusSummaryProjection(normalizedMenuCode);
        warmStatusSummaryProjection(normalizedMenuCode);
        return successResponse(
                isEn ? "Current draft published as a version snapshot." : "현재 초안을 publish 스냅샷으로 저장했습니다.",
                "menuCode", normalizedMenuCode,
                "versionId", currentDraft.getVersionId());
    }

    @Override
    public ScreenBuilderDraftDocumentVO getLatestPublishedDraft(String menuCode) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return null;
        }
        for (ScreenBuilderDraftDocumentVO document : screenBuilderDraftStoragePort.listHistoryVersions(normalizedMenuCode)) {
            if ("PUBLISHED".equalsIgnoreCase(safe(document.getVersionStatus()))) {
                return document;
            }
        }
        return null;
    }

    @Override
    public List<ScreenBuilderComponentRegistryItemVO> getComponentRegistry(boolean isEn) throws Exception {
        return readComponentRegistry(isEn);
    }

    @Override
    public ScreenBuilderComponentRegistryItemVO registerComponent(ScreenBuilderComponentRegistrySaveRequestVO request, boolean isEn) throws Exception {
        String componentType = safe(request == null ? null : request.getComponentType());
        String label = safe(request == null ? null : request.getLabel());
        if (componentType.isEmpty()) {
            throw new IllegalArgumentException("componentType is required");
        }
        if (label.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Component label is required." : "컴포넌트 이름은 필수입니다.");
        }

        List<ScreenBuilderComponentRegistryItemVO> items = readComponentRegistry(isEn);
        String componentId = firstNonBlank(
                request == null ? "" : request.getComponentId(),
                buildSuggestedComponentId(componentType, label)
        );
        String uniqueComponentId = componentId;
        int suffix = 2;
        Map<String, ScreenBuilderComponentRegistryItemVO> registryIndex = indexRegistryItems(items);
        while (containsComponentId(registryIndex, uniqueComponentId)) {
            uniqueComponentId = componentId + "-" + suffix;
            suffix++;
        }

        ScreenBuilderComponentRegistryItemVO item = new ScreenBuilderComponentRegistryItemVO();
        item.setComponentId(uniqueComponentId);
        item.setComponentType(componentType);
        item.setLabel(label);
        item.setLabelEn(safe(request == null ? null : request.getLabelEn()));
        item.setDescription(safe(request == null ? null : request.getDescription()));
        item.setStatus(ACTIVE_STATUS);
        item.setReplacementComponentId("");
        item.setSourceType("CUSTOM");
        item.setCreatedAt(LocalDateTime.now().format(TIMESTAMP_FORMAT));
        item.setUpdatedAt(item.getCreatedAt());
        item.setPropsTemplate(mutableMap(request == null ? null : request.getPropsTemplate()));
        upsertComponentRegistryItem(item);
        invalidateAllStatusSummaryProjections();
        return item;
    }

    @Override
    public ScreenBuilderComponentRegistryItemVO updateComponentRegistryItem(ScreenBuilderComponentRegistryUpdateRequestVO request, boolean isEn) throws Exception {
        String componentId = safe(request == null ? null : request.getComponentId());
        if (componentId.isEmpty()) {
            throw new IllegalArgumentException("componentId is required");
        }
        List<ScreenBuilderComponentRegistryItemVO> items = readComponentRegistry(isEn);
        ScreenBuilderComponentRegistryItemVO matched = findRegistryItem(indexRegistryItems(items), componentId);
        if (matched == null) {
            throw new IllegalArgumentException(isEn ? "Component does not exist." : "컴포넌트를 찾을 수 없습니다.");
        }
        matched.setComponentType(firstNonBlank(request == null ? "" : request.getComponentType(), matched.getComponentType()));
        matched.setLabel(firstNonBlank(request == null ? "" : request.getLabel(), matched.getLabel()));
        matched.setLabelEn(firstNonBlank(request == null ? "" : request.getLabelEn(), matched.getLabelEn()));
        matched.setDescription(firstNonBlank(request == null ? "" : request.getDescription(), matched.getDescription()));
        matched.setStatus(firstNonBlank(request == null ? "" : request.getStatus(), matched.getStatus(), ACTIVE_STATUS));
        matched.setReplacementComponentId(safe(request == null ? null : request.getReplacementComponentId()));
        if (request != null && request.getPropsTemplate() != null) {
            matched.setPropsTemplate(mutableMap(request.getPropsTemplate()));
        }
        matched.setUpdatedAt(LocalDateTime.now().format(TIMESTAMP_FORMAT));
        upsertComponentRegistryItem(matched);
        invalidateAllStatusSummaryProjections();
        return matched;
    }

    @Override
    public List<ScreenBuilderComponentUsageVO> getComponentRegistryUsage(String componentId, boolean isEn) throws Exception {
        String normalizedComponentId = safe(componentId);
        List<ScreenBuilderComponentUsageVO> usages = new ArrayList<>();
        if (normalizedComponentId.isEmpty()) {
            return usages;
        }
        for (UiComponentUsageVO usage : screenBuilderComponentRegistryPort.selectComponentUsageList(normalizedComponentId)) {
            ScreenBuilderComponentUsageVO row = new ScreenBuilderComponentUsageVO();
            row.setUsageSource("MANIFEST");
            row.setUsageStatus("ACTIVE");
            row.setMenuCode(safe(usage.getMenuCode()));
            row.setPageId(safe(usage.getPageId()));
            row.setMenuTitle(firstNonBlank(usage.getPageName(), usage.getPageId()));
            row.setMenuUrl(safe(usage.getRoutePath()));
            row.setLayoutZone(safe(usage.getLayoutZone()));
            row.setInstanceKey(safe(usage.getInstanceKey()));
            row.setComponentId(normalizedComponentId);
            usages.add(row);
        }
        usages.addAll(scanBuilderDraftUsage(normalizedComponentId, false));
        usages.addAll(scanBuilderDraftUsage(normalizedComponentId, true));
        usages.sort(Comparator.comparing(ScreenBuilderComponentUsageVO::getUsageSource, Comparator.nullsLast(String::compareTo))
                .thenComparing(ScreenBuilderComponentUsageVO::getMenuCode, Comparator.nullsLast(String::compareTo))
                .thenComparing(ScreenBuilderComponentUsageVO::getPageId, Comparator.nullsLast(String::compareTo))
                .thenComparing(ScreenBuilderComponentUsageVO::getNodeId, Comparator.nullsLast(String::compareTo)));
        return usages;
    }

    @Override
    public Map<String, Object> replaceComponentRegistryUsage(String fromComponentId, String toComponentId, boolean isEn) throws Exception {
        String normalizedFromComponentId = safe(fromComponentId);
        String normalizedToComponentId = safe(toComponentId);
        if (normalizedFromComponentId.isEmpty() || normalizedToComponentId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Both source and replacement componentId are required." : "기존/대체 componentId는 모두 필요합니다.");
        }
        if (normalizedFromComponentId.equalsIgnoreCase(normalizedToComponentId)) {
            throw new IllegalArgumentException(isEn ? "Replacement component must be different." : "대체 컴포넌트는 달라야 합니다.");
        }
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        Map<String, ScreenBuilderComponentRegistryItemVO> registryIndex = indexRegistryItems(registry);
        ScreenBuilderComponentRegistryItemVO fromItem = findRegistryItem(registryIndex, normalizedFromComponentId);
        ScreenBuilderComponentRegistryItemVO toItem = findRegistryItem(registryIndex, normalizedToComponentId);
        if (fromItem == null || toItem == null) {
            throw new IllegalArgumentException(isEn ? "Selected component does not exist in registry." : "선택한 컴포넌트가 레지스트리에 없습니다.");
        }
        screenBuilderComponentRegistryPort.remapComponentUsage(normalizedFromComponentId, normalizedToComponentId);

        int updatedDraftCount = replaceComponentIdAcrossDrafts(normalizedFromComponentId, normalizedToComponentId, false);
        int updatedPublishedCount = 0;
        invalidateAllStatusSummaryProjections();
        return successResponse(
                isEn ? "Component usages remapped." : "컴포넌트 사용처를 재매핑했습니다.",
                "fromComponentId", normalizedFromComponentId,
                "toComponentId", normalizedToComponentId,
                "updatedDraftCount", updatedDraftCount,
                "updatedPublishedCount", updatedPublishedCount);
    }

    @Override
    public Map<String, Object> deleteComponentRegistryItem(String componentId, boolean isEn) throws Exception {
        String normalizedComponentId = safe(componentId);
        if (normalizedComponentId.isEmpty()) {
            throw new IllegalArgumentException("componentId is required");
        }
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        ScreenBuilderComponentRegistryItemVO item = findRegistryItem(indexRegistryItems(registry), normalizedComponentId);
        if (item == null) {
            throw new IllegalArgumentException(isEn ? "Component does not exist." : "컴포넌트를 찾을 수 없습니다.");
        }
        if ("SYSTEM".equalsIgnoreCase(safe(item.getSourceType()))) {
            throw new IllegalArgumentException(isEn ? "System components cannot be deleted." : "시스템 컴포넌트는 삭제할 수 없습니다.");
        }
        List<ScreenBuilderComponentUsageVO> usages = getComponentRegistryUsage(normalizedComponentId, isEn);
        if (!usages.isEmpty()) {
            throw new IllegalArgumentException(isEn
                    ? String.format("Component is still used by %d screens. Remap usages first.", usages.size())
                    : String.format("이 컴포넌트는 아직 %d개 화면에서 사용 중입니다. 먼저 사용처를 재매핑하세요.", usages.size()));
        }
        screenBuilderComponentRegistryPort.deleteComponentRegistry(normalizedComponentId);
        invalidateAllStatusSummaryProjections();
        return successResponse(
                isEn ? "Component deleted from registry." : "레지스트리에서 컴포넌트를 삭제했습니다.",
                "componentId", normalizedComponentId);
    }

    @Override
    public Map<String, Object> autoReplaceDeprecatedComponents(String menuCode, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, "", "", "");
        Map<String, Object> plan = buildDeprecatedReplacementPlan(draft, isEn);
        int replacedCount = ((Number) plan.getOrDefault("replacedCount", 0)).intValue();
        @SuppressWarnings("unchecked")
        List<ScreenBuilderNodeVO> nextNodes = (List<ScreenBuilderNodeVO>) plan.get("nextNodes");
        draft.setNodes(nextNodes);
        persistDraftMutation(draft);
        return successResponse(
                isEn ? "Deprecated components replaced in draft." : "초안에서 deprecated 컴포넌트를 대체했습니다.",
                "menuCode", safe(menuCode),
                "replacedCount", replacedCount);
    }

    @Override
    public Map<String, Object> previewAutoReplaceDeprecatedComponents(String menuCode, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, "", "", "");
        Map<String, Object> plan = buildDeprecatedReplacementPlan(draft, isEn);
        return responseMap(
                "menuCode", safe(menuCode),
                "replacedCount", plan.getOrDefault("replacedCount", 0),
                "items", plan.get("items"));
    }

    @Override
    public Map<String, Object> scanAllDraftRegistryDiagnostics(boolean isEn) throws Exception {
        List<Map<String, Object>> items = new ArrayList<>();
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        for (ScreenBuilderDraftDocumentVO draft : screenBuilderDraftStoragePort.listAllDrafts()) {
            Map<String, Object> diagnostics = buildRegistryDiagnostics(draft, registry);
            items.add(responseMap(
                    "menuCode", safe(draft.getMenuCode()),
                    "pageId", safe(draft.getPageId()),
                    "menuTitle", safe(draft.getMenuTitle()),
                    "unregisteredCount", sizeOfList(diagnostics.get("unregisteredNodes")),
                    "missingCount", sizeOfList(diagnostics.get("missingNodes")),
                    "deprecatedCount", sizeOfList(diagnostics.get("deprecatedNodes"))));
        }
        return responseMap(
                "items", items,
                "totalCount", items.size());
    }

    @Override
    public Map<String, Object> addNodeFromComponent(String menuCode, String componentId, String parentNodeId, Map<String, Object> propsOverride, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, "", "", "");
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        ScreenBuilderComponentRegistryItemVO matched = findRegistryComponent(registry, componentId);
        if (matched == null) {
            throw new IllegalArgumentException(isEn ? "Component does not exist." : "컴포넌트를 찾을 수 없습니다.");
        }
        String targetParentNodeId = firstNonBlank(parentNodeId, findDefaultParentNodeId(draft, matched.getComponentType()));
        ScreenBuilderNodeVO node = createRegistryNode(matched, targetParentNodeId, propsOverride, draft.getNodes().size(), null);
        draft.getNodes().add(node);
        draft.setNodes(sortNodesForPersistence(draft.getNodes()));
        persistDraftMutation(draft);
        return successResponse(
                isEn ? "Node added from registered component." : "등록 컴포넌트로 노드를 추가했습니다.",
                "menuCode", safe(menuCode),
                "nodeId", safe(node.getNodeId()),
                "componentId", safe(node.getComponentId()));
    }

    @Override
    public Map<String, Object> addNodeTreeFromComponents(String menuCode, List<Map<String, Object>> items, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, "", "", "");
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        Map<String, ScreenBuilderComponentRegistryItemVO> registryMap = indexRegistryItems(registry);
        int addedCount = 0;
        Map<String, String> aliasNodeIds = new LinkedHashMap<>();
        List<ScreenBuilderNodeVO> nextNodes = new ArrayList<>(draft.getNodes());
        List<Map<String, Object>> addedItems = new ArrayList<>();
        if (items != null) {
            for (Map<String, Object> row : items) {
                if (row == null) {
                    continue;
                }
                String componentId = safe(String.valueOf(row.getOrDefault("componentId", "")));
                if (componentId.isEmpty() || !registryMap.containsKey(componentId)) {
                    continue;
                }
                ScreenBuilderComponentRegistryItemVO matched = registryMap.get(componentId);
                String alias = safe(String.valueOf(row.getOrDefault("alias", "")));
                String parentAlias = safe(String.valueOf(row.getOrDefault("parentAlias", "")));
                String parentNodeId = aliasNodeIds.getOrDefault(parentAlias, safe(String.valueOf(row.getOrDefault("parentNodeId", ""))));
                String resolvedParentNodeId = firstNonBlank(parentNodeId, findDefaultParentNodeId(draft, matched.getComponentType()));
                @SuppressWarnings("unchecked")
                Map<String, Object> propsOverride = row.get("props") instanceof Map ? mutableMap((Map<String, Object>) row.get("props")) : mutableMap(null);
                ScreenBuilderNodeVO node = createRegistryNode(matched, resolvedParentNodeId, propsOverride, nextNodes.size(), String.valueOf(addedCount));
                nextNodes.add(node);
                if (!alias.isEmpty()) {
                    aliasNodeIds.put(alias, node.getNodeId());
                }
                addedItems.add(nodeSummaryRow(node));
                addedCount++;
            }
        }
        draft.setNodes(sortNodesForPersistence(nextNodes));
        persistDraftMutation(draft);
        return successResponse(
                isEn ? "Node tree added from component contracts." : "컴포넌트 계약으로 노드 트리를 추가했습니다.",
                "menuCode", safe(menuCode),
                "addedCount", addedCount,
                "items", addedItems);
    }

    private ScreenBuilderComponentRegistryItemVO findRegistryComponent(List<ScreenBuilderComponentRegistryItemVO> registry, String componentId) {
        return findRegistryItem(indexRegistryItems(registry), componentId);
    }

    private ScreenBuilderNodeVO createRegistryNode(ScreenBuilderComponentRegistryItemVO item,
                                                   String parentNodeId,
                                                   Map<String, Object> propsOverride,
                                                   int sortOrder,
                                                   String uniqueSuffix) {
        String componentType = safe(item == null ? null : item.getComponentType());
        Map<String, Object> props = mutableMap(item == null ? null : item.getPropsTemplate());
        if (propsOverride != null && !propsOverride.isEmpty()) {
            props.putAll(propsOverride);
        }
        String nodeId = componentType + "-" + System.currentTimeMillis();
        if (!safe(uniqueSuffix).isEmpty()) {
            nodeId = nodeId + "-" + safe(uniqueSuffix);
        }
        ScreenBuilderNodeVO node = new ScreenBuilderNodeVO();
        node.setNodeId(nodeId);
        node.setComponentId(safe(item == null ? null : item.getComponentId()));
        node.setParentNodeId(safe(parentNodeId));
        node.setComponentType(componentType);
        node.setSlotName("button".equalsIgnoreCase(componentType) ? "actions" : "content");
        node.setSortOrder(sortOrder);
        node.setProps(props);
        return node;
    }

    private Map<String, ScreenBuilderComponentRegistryItemVO> indexRegistryItems(List<ScreenBuilderComponentRegistryItemVO> registry) {
        Map<String, ScreenBuilderComponentRegistryItemVO> registryIndex = new LinkedHashMap<>();
        if (registry == null) {
            return registryIndex;
        }
        for (ScreenBuilderComponentRegistryItemVO item : registry) {
            String componentId = safe(item == null ? null : item.getComponentId()).toLowerCase(Locale.ROOT);
            if (!componentId.isEmpty()) {
                registryIndex.put(componentId, item);
            }
        }
        return registryIndex;
    }

    private Map<String, Object> nodeSummaryRow(ScreenBuilderNodeVO node) {
        return responseMap(
                "nodeId", safe(node == null ? null : node.getNodeId()),
                "componentId", safe(node == null ? null : node.getComponentId()),
                "parentNodeId", safe(node == null ? null : node.getParentNodeId()));
    }

    @Override
    public Map<String, Object> getRegistryDiagnostics(ScreenBuilderDraftDocumentVO draft, boolean isEn) throws Exception {
        return buildRegistryDiagnostics(draft, getComponentRegistry(isEn));
    }

    private void hydrateMenuMetadata(ScreenBuilderDraftDocumentVO draft, String pageId, String menuTitle, String menuUrl) throws Exception {
        ScreenBuilderMenuDescriptor menu = findMenu(draft.getMenuCode());
        draft.setPageId(firstNonBlank(pageId, draft.getPageId(), screenBuilderMenuBindingPolicyPort.derivePageId(draft.getMenuCode(), menu)));
        draft.setMenuTitle(firstNonBlank(menuTitle, draft.getMenuTitle(), menu == null ? "" : menu.getMenuTitle()));
        draft.setMenuUrl(firstNonBlank(menuUrl, draft.getMenuUrl(), menu == null ? "" : menu.getMenuUrl()));
    }

    private ScreenBuilderDraftDocumentVO createNormalizedDraft(ScreenBuilderSaveRequestVO request) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(request == null ? "" : request.getMenuCode(), request == null ? "" : request.getPageId(), request == null ? "" : request.getMenuTitle(), request == null ? "" : request.getMenuUrl());
        draft.setTemplateType(firstNonBlank(request == null ? "" : request.getTemplateType(), draft.getTemplateType(), DEFAULT_TEMPLATE_TYPE));
        draft.setPageId(firstNonBlank(request == null ? "" : request.getPageId(), draft.getPageId()));
        draft.setMenuCode(firstNonBlank(request == null ? "" : request.getMenuCode(), draft.getMenuCode()));
        draft.setMenuTitle(firstNonBlank(request == null ? "" : request.getMenuTitle(), draft.getMenuTitle()));
        draft.setMenuUrl(firstNonBlank(request == null ? "" : request.getMenuUrl(), draft.getMenuUrl()));
        draft.setAuthorityProfile(normalizeAuthorityProfile(request == null ? null : request.getAuthorityProfile(), draft.getAuthorityProfile()));
        draft.setVersionStatus("DRAFT");
        draft.setVersionId(UUID.randomUUID().toString());
        draft.setNodes(normalizeNodes(request == null ? null : request.getNodes()));
        draft.setEvents(normalizeEvents(request == null ? null : request.getEvents()));
        return draft;
    }

    private void writeHistorySnapshot(ScreenBuilderDraftDocumentVO draft) throws IOException {
        writeHistorySnapshot(draft, true);
    }

    private void writeHistorySnapshot(ScreenBuilderDraftDocumentVO draft, boolean preferDraftCopy) throws IOException {
        try {
            screenBuilderDraftStoragePort.saveHistorySnapshot(draft, preferDraftCopy);
        } catch (Exception e) {
            throw new IOException(e);
        }
    }

    private void persistDraftMutation(ScreenBuilderDraftDocumentVO draft) throws Exception {
        persistDraftMutation(draft, true);
    }

    private void persistDraftMutation(ScreenBuilderDraftDocumentVO draft, boolean invalidateStatusSummary) throws Exception {
        screenBuilderDraftStoragePort.saveDraft(draft);
        writeHistorySnapshot(draft);
        if (invalidateStatusSummary) {
            invalidateStatusSummaryProjection(draft.getMenuCode());
        }
    }

    private void validateDraft(ScreenBuilderDraftDocumentVO draft) {
        if (safe(draft.getMenuCode()).isEmpty()) {
            throw new IllegalArgumentException("menuCode is required");
        }
        if (draft.getNodes().isEmpty()) {
            throw new IllegalArgumentException("At least one node is required");
        }
        long rootCount = draft.getNodes().stream()
                .filter(node -> "page".equalsIgnoreCase(safe(node.getComponentType())))
                .count();
        if (rootCount != 1) {
            throw new IllegalArgumentException("Exactly one page root node is required");
        }
        List<String> authorityErrors = validateAuthorityProfile(draft, false);
        if (!authorityErrors.isEmpty()) {
            throw new IllegalArgumentException(authorityErrors.get(0));
        }
    }

    private List<String> validateAuthorityProfile(ScreenBuilderDraftDocumentVO draft, boolean publishing) {
        ScreenBuilderAuthorityProfileVO profile = draft == null ? null : draft.getAuthorityProfile();
        if (profile == null || safe(profile.getAuthorCode()).isEmpty()) {
            return Collections.singletonList(publishing
                    ? "Publish is blocked until an authority profile is assigned."
                    : "authorityProfile.authorCode is required");
        }
        try {
            FrameworkAuthorityRoleContractVO contractRole = findAuthorityRoleByAuthorCode(profile.getAuthorCode());
            if (contractRole == null) {
                return Collections.singletonList("authorityProfile.authorCode is not registered in the framework authority contract");
            }
            List<String> errors = new ArrayList<>();
            if (!safe(profile.getRoleKey()).isEmpty() && !safe(profile.getRoleKey()).equalsIgnoreCase(safe(contractRole.getRoleKey()))) {
                errors.add("authorityProfile.roleKey does not match the framework authority contract");
            }
            if (!safe(profile.getTier()).isEmpty() && !safe(profile.getTier()).equalsIgnoreCase(safe(contractRole.getTier()))) {
                errors.add("authorityProfile.tier does not match the framework authority contract");
            }
            if (!safe(profile.getScopePolicy()).isEmpty() && !safe(profile.getScopePolicy()).equalsIgnoreCase(safe(contractRole.getScopePolicy()))) {
                errors.add("authorityProfile.scopePolicy does not match the framework authority contract");
            }
            List<String> requestedFeatureCodes = normalizedFeatureCodes(profile == null ? null : profile.getFeatureCodes());
            List<String> allowedFeatureCodes = normalizedFeatureCodes(contractRole == null ? null : contractRole.getFeatureCodes());
            boolean wildcard = hasWildcardFeatureCode(allowedFeatureCodes);
            for (String featureCode : requestedFeatureCodes) {
                if (!wildcard && !allowedFeatureCodes.contains(featureCode)) {
                    errors.add("authorityProfile.featureCodes contains codes not granted by the selected role");
                    break;
                }
            }
            return errors;
        } catch (Exception e) {
            return Collections.singletonList("Failed to validate authorityProfile against the framework authority contract");
        }
    }

    private List<String> validateAuthorityEventAlignment(ScreenBuilderDraftDocumentVO draft, boolean publishing) {
        ScreenBuilderAuthorityProfileVO profile = draft == null ? null : draft.getAuthorityProfile();
        List<String> featureCodes = normalizedFeatureCodes(profile == null ? null : profile.getFeatureCodes());
        boolean wildcard = hasWildcardAuthorityProfile(profile, featureCodes);
        if (draft == null || draft.getEvents() == null || draft.getEvents().isEmpty()) {
            return Collections.emptyList();
        }
        CommandAuthorityContext commandAuthorityContext = resolveCommandAuthorityContext(draft);
        List<String> errors = new ArrayList<>();
        for (ScreenBuilderEventBindingVO event : draft.getEvents()) {
            if (event == null) {
                continue;
            }
            String actionType = safe(event.getActionType()).toLowerCase(Locale.ROOT);
            Map<String, Object> actionConfig = event.getActionConfig() == null ? Collections.emptyMap() : event.getActionConfig();
            String explicitFeatureCode = upperCaseSafe(asString(actionConfig.get("featureCode")));
            String explicitRequiredFeatureCode = upperCaseSafe(asString(actionConfig.get("requiredFeatureCode")));
            String apiId = safe(asString(actionConfig.get("apiId")));
            boolean mutatingAction = isMutatingActionType(actionType);

            if (!apiId.isEmpty() && !commandAuthorityContext.allowedApiIds.isEmpty() && !commandAuthorityContext.allowedApiIds.contains(apiId)) {
                errors.add(publishing
                        ? "Publish is blocked because an event references an API that is not registered in the screen-command page."
                        : "event.actionConfig.apiId is not registered in the screen-command page");
                break;
            }
            if (!explicitFeatureCode.isEmpty() && !wildcard && !featureCodes.contains(explicitFeatureCode)) {
                errors.add(publishing
                        ? "Publish is blocked because an event requires a feature code outside the assigned authority profile."
                        : "event.actionConfig.featureCode is outside authorityProfile.featureCodes");
                break;
            }
            if (!explicitRequiredFeatureCode.isEmpty() && !wildcard && !featureCodes.contains(explicitRequiredFeatureCode)) {
                errors.add(publishing
                        ? "Publish is blocked because an event requires a requiredFeatureCode outside the assigned authority profile."
                        : "event.actionConfig.requiredFeatureCode is outside authorityProfile.featureCodes");
                break;
            }
            if ((mutatingAction || !apiId.isEmpty()) && !wildcard && featureCodes.isEmpty()) {
                errors.add(publishing
                        ? "Publish is blocked because API or mutating actions require an authority profile with feature grants."
                        : "authorityProfile.featureCodes must not be empty for API or mutating actions");
                break;
            }
            if ((mutatingAction || !apiId.isEmpty())
                    && !wildcard
                    && !commandAuthorityContext.menuFeatureCodes.isEmpty()
                    && Collections.disjoint(featureCodes, commandAuthorityContext.menuFeatureCodes)) {
                errors.add(publishing
                        ? "Publish is blocked because the authority profile does not overlap with the page menu permission feature set."
                        : "authorityProfile.featureCodes must overlap with screen-command menuPermission.featureCodes for API or mutating actions");
                break;
            }
        }
        return errors;
    }

    private CommandAuthorityContext resolveCommandAuthorityContext(ScreenBuilderDraftDocumentVO draft) {
        if (draft == null || safe(draft.getPageId()).isEmpty()) {
            return CommandAuthorityContext.empty();
        }
        try {
            Map<String, Object> response = screenBuilderCommandPagePort.getScreenCommandPage(draft.getPageId());
            Map<String, Object> page = safeMap(response.get("page"));
            Set<String> allowedApiIds = new LinkedHashSet<>();
            for (Map<String, Object> api : safeMapList(page.get("apis"))) {
                String apiId = safe(asString(api.get("apiId")));
                if (!apiId.isEmpty()) {
                    allowedApiIds.add(apiId);
                }
            }
            Map<String, Object> menuPermission = safeMap(page.get("menuPermission"));
            Set<String> menuFeatureCodes = new LinkedHashSet<>();
            for (String featureCode : safeStringList(menuPermission.get("featureCodes"))) {
                String normalized = upperCaseSafe(featureCode);
                if (!normalized.isEmpty()) {
                    menuFeatureCodes.add(normalized);
                }
            }
            String requiredViewFeatureCode = upperCaseSafe(asString(menuPermission.get("requiredViewFeatureCode")));
            if (!requiredViewFeatureCode.isEmpty()) {
                menuFeatureCodes.add(requiredViewFeatureCode);
            }
            return new CommandAuthorityContext(allowedApiIds, menuFeatureCodes);
        } catch (Exception e) {
            return CommandAuthorityContext.empty();
        }
    }

    private boolean isMutatingActionType(String actionType) {
        String normalized = safe(actionType).toLowerCase(Locale.ROOT);
        return "api_call".equals(normalized)
                || "submit".equals(normalized)
                || "set_state".equals(normalized)
                || "toggle_section".equals(normalized)
                || "open_modal".equals(normalized)
                || "close_modal".equals(normalized);
    }

    private FrameworkAuthorityRoleContractVO findAuthorityRoleByAuthorCode(String authorCode) throws Exception {
        String normalizedAuthorCode = upperCaseSafe(authorCode);
        if (normalizedAuthorCode.isEmpty()) {
            return null;
        }
        List<FrameworkAuthorityRoleContractVO> roles = screenBuilderAuthorityContractPort.getAuthorityRoles();
        if (roles == null || roles.isEmpty()) {
            return null;
        }
        for (FrameworkAuthorityRoleContractVO role : roles) {
            if (role != null && normalizedAuthorCode.equalsIgnoreCase(safe(role.getAuthorCode()))) {
                return role;
            }
        }
        return null;
    }

    private List<ScreenBuilderNodeVO> normalizeNodes(List<ScreenBuilderNodeVO> source) {
        if (source == null || source.isEmpty()) {
            return createEditPageNodes("Edit Page");
        }
        List<ScreenBuilderNodeVO> nodes = new ArrayList<>();
        int index = 0;
        for (ScreenBuilderNodeVO node : source) {
            ScreenBuilderNodeVO copy = new ScreenBuilderNodeVO();
            copy.setNodeId(firstNonBlank(node == null ? "" : node.getNodeId(), "node-" + index));
            copy.setComponentId(node == null ? "" : safe(node.getComponentId()));
            copy.setParentNodeId(node == null ? "" : safe(node.getParentNodeId()));
            copy.setComponentType(firstNonBlank(node == null ? "" : node.getComponentType(), "text"));
            copy.setSlotName(node == null ? "" : safe(node.getSlotName()));
            copy.setSortOrder(node == null ? index : node.getSortOrder());
            copy.setProps(mutableMap(node == null ? null : node.getProps()));
            nodes.add(copy);
            index++;
        }
        return nodes;
    }

    private List<ScreenBuilderEventBindingVO> normalizeEvents(List<ScreenBuilderEventBindingVO> source) {
        if (source == null) {
            return new ArrayList<>();
        }
        List<ScreenBuilderEventBindingVO> events = new ArrayList<>();
        int index = 0;
        for (ScreenBuilderEventBindingVO item : source) {
            ScreenBuilderEventBindingVO copy = new ScreenBuilderEventBindingVO();
            copy.setEventBindingId(firstNonBlank(item == null ? "" : item.getEventBindingId(), "event-" + index));
            copy.setNodeId(item == null ? "" : safe(item.getNodeId()));
            copy.setEventName(firstNonBlank(item == null ? "" : item.getEventName(), "onClick"));
            copy.setActionType(firstNonBlank(item == null ? "" : item.getActionType(), "set_state"));
            copy.setActionConfig(mutableMap(item == null ? null : item.getActionConfig()));
            events.add(copy);
            index++;
        }
        return events;
    }

    private ScreenBuilderDraftDocumentVO createDefaultDraft(String pageId, String menuCode, String menuTitle, String menuUrl) throws Exception {
        ScreenBuilderMenuDescriptor menu = findMenu(menuCode);
        ScreenBuilderDraftDocumentVO draft = new ScreenBuilderDraftDocumentVO();
        draft.setBuilderId(screenBuilderArtifactNamingPolicyPort.resolveBuilderId(menuCode));
        draft.setVersionId("draft-" + LocalDateTime.now().format(TIMESTAMP_FORMAT));
        draft.setPageId(firstNonBlank(pageId, screenBuilderMenuBindingPolicyPort.derivePageId(menuCode, menu)));
        draft.setMenuCode(safe(menuCode));
        draft.setMenuTitle(firstNonBlank(menuTitle, menu == null ? "" : menu.getMenuTitle()));
        draft.setMenuUrl(firstNonBlank(menuUrl, menu == null ? "" : menu.getMenuUrl()));
        draft.setTemplateType(resolveDefaultTemplateType(draft.getPageId(), draft.getMenuUrl()));
        draft.setAuthorityProfile(new ScreenBuilderAuthorityProfileVO());
        draft.setVersionStatus("DRAFT");
        draft.setNodes(createDefaultNodes(draft.getTemplateType(), draft.getPageId(), draft.getMenuTitle()));
        draft.setEvents(new ArrayList<>());
        return draft;
    }

    private ScreenBuilderAuthorityProfileVO normalizeAuthorityProfile(ScreenBuilderAuthorityProfileVO requested,
                                                                     ScreenBuilderAuthorityProfileVO current) {
        ScreenBuilderAuthorityProfileVO source = requested != null ? requested : current;
        ScreenBuilderAuthorityProfileVO profile = new ScreenBuilderAuthorityProfileVO();
        if (source == null) {
            return profile;
        }
        profile.setRoleKey(safe(source.getRoleKey()));
        profile.setAuthorCode(safe(source.getAuthorCode()).toUpperCase(Locale.ROOT));
        profile.setLabel(safe(source.getLabel()));
        profile.setDescription(safe(source.getDescription()));
        profile.setTier(safe(source.getTier()));
        profile.setActorType(safe(source.getActorType()));
        profile.setScopePolicy(safe(source.getScopePolicy()));
        profile.setHierarchyLevel(source.getHierarchyLevel() == null ? 0 : source.getHierarchyLevel());
        profile.setFeatureCodes(normalizedFeatureCodes(source.getFeatureCodes()));
        profile.setTags(normalizeStringList(source.getTags(), false));
        return profile;
    }

    private List<String> normalizedFeatureCodes(List<String> source) {
        return normalizeStringList(source, true);
    }

    private boolean hasWildcardFeatureCode(List<String> featureCodes) {
        return featureCodes != null && featureCodes.contains("*");
    }

    private boolean hasWildcardAuthorityProfile(ScreenBuilderAuthorityProfileVO profile, List<String> featureCodes) {
        return hasWildcardFeatureCode(featureCodes) || "ROLE_SYSTEM_MASTER".equals(upperCaseSafe(profile == null ? null : profile.getAuthorCode()));
    }

    private String upperCaseSafe(String value) {
        return safe(value).toUpperCase(Locale.ROOT);
    }

    private List<String> normalizeStringList(List<String> source, boolean uppercase) {
        if (source == null || source.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> items = new ArrayList<>();
        for (String item : source) {
            String normalized = safe(item);
            if (uppercase) {
                normalized = normalized.toUpperCase(Locale.ROOT);
            }
            if (!normalized.isEmpty() && !items.contains(normalized)) {
                items.add(normalized);
            }
        }
        return items;
    }

    private List<ScreenBuilderNodeVO> createDefaultNodes(String templateType, String pageId, String menuTitle) {
        if ("LIST_PAGE".equalsIgnoreCase(safe(templateType)) || isListPageCandidate(pageId)) {
            return createListPageNodes(menuTitle);
        }
        return createEditPageNodes(menuTitle);
    }

    private List<ScreenBuilderNodeVO> createEditPageNodes(String menuTitle) {
        List<ScreenBuilderNodeVO> nodes = new ArrayList<>();
        nodes.add(rootNode("root", 0, mapOf("title", firstNonBlank(menuTitle, "Edit Page"))));
        nodes.add(contentNode("section-1", "root", "section", 1, mapOf("title", "기본 섹션")));
        nodes.add(contentNode("heading-1", "section-1", "heading", 2, mapOf("text", "기본 정보")));
        nodes.add(contentNode("input-1", "section-1", "input", 3, mapOf("label", "필드명", "placeholder", "값 입력")));
        nodes.add(actionNode("button-1", "section-1", "button", 4, mapOf("label", "저장", "variant", "primary")));
        return nodes;
    }

    private List<ScreenBuilderNodeVO> createListPageNodes(String menuTitle) {
        List<ScreenBuilderNodeVO> nodes = new ArrayList<>();
        nodes.add(rootNode("root", 0, mapOf("title", firstNonBlank(menuTitle, "List Page"))));
        nodes.add(contentNode("search-section", "root", "section", 1, mapOf("title", "검색 조건")));
        nodes.add(contentNode("search-heading", "search-section", "heading", 2, mapOf("text", "회원 검색")));
        nodes.add(contentNode("search-type", "search-section", "select", 3, mapOf("label", "회원 유형", "placeholder", "회원 유형 선택")));
        nodes.add(contentNode("search-status", "search-section", "select", 4, mapOf("label", "상태", "placeholder", "상태 선택")));
        nodes.add(contentNode("search-keyword", "search-section", "input", 5, mapOf("label", "검색어", "placeholder", "신청자명, 아이디, 회사명 검색")));
        nodes.add(actionNode("search-button", "search-section", "button", 6, mapOf("label", "검색", "variant", "primary")));
        nodes.add(contentNode("toolbar-section", "root", "section", 7, mapOf("title", "목록 액션")));
        nodes.add(contentNode("toolbar-text", "toolbar-section", "text", 8, mapOf("text", "총 건수, 엑셀 다운로드, 신규 등록 액션")));
        nodes.add(contentNode("result-table", "root", "table", 9, mapOf("title", "회원 목록", "columns", "번호|성명 (아이디)|회원 유형|소속 기관|가입일|상태|관리", "emptyText", "조회된 회원이 없습니다.")));
        nodes.add(actionNode("result-pagination", "root", "pagination", 10, mapOf("summary", "페이지 이동 영역")));
        return nodes;
    }

    private ScreenBuilderNodeVO rootNode(String nodeId, int sortOrder, Map<String, Object> props) {
        return node(nodeId, "", "page", "root", sortOrder, props);
    }

    private ScreenBuilderNodeVO contentNode(String nodeId, String parentNodeId, String type, int sortOrder, Map<String, Object> props) {
        return node(nodeId, parentNodeId, type, "content", sortOrder, props);
    }

    private ScreenBuilderNodeVO actionNode(String nodeId, String parentNodeId, String type, int sortOrder, Map<String, Object> props) {
        return node(nodeId, parentNodeId, type, "actions", sortOrder, props);
    }

    private ScreenBuilderNodeVO node(String nodeId, String parentNodeId, String type, String slotName, int sortOrder, Map<String, Object> props) {
        ScreenBuilderNodeVO node = new ScreenBuilderNodeVO();
        node.setNodeId(nodeId);
        node.setComponentId("");
        node.setParentNodeId(parentNodeId);
        node.setComponentType(type);
        node.setSlotName(slotName);
        node.setSortOrder(sortOrder);
        node.setProps(mutableMap(props));
        return node;
    }

    private static Map<String, Object> palette(String type, String labelEn, String labelKo, String description) {
        return responseMapStatic(
                "componentType", type,
                "label", labelKo,
                "labelEn", labelEn,
                "description", description);
    }

    private Map<String, Object> mapOf(Object... values) {
        return responseMap(values);
    }

    private List<String> normalizeMenuCodes(List<String> menuCodes) {
        if (menuCodes == null || menuCodes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> deduped = new LinkedHashSet<>();
        for (String menuCode : menuCodes) {
            String normalized = safe(menuCode);
            if (!normalized.isEmpty()) {
                deduped.add(normalized);
            }
        }
        return new ArrayList<>(deduped);
    }

    private List<String> resolveAllPageMenuCodes() throws Exception {
        List<String> menuCodes = new ArrayList<>();
        for (String catalogRoot : screenBuilderMenuBindingPolicyPort.getMenuCatalogRoots()) {
            for (ScreenBuilderMenuDescriptor row : new ArrayList<>(screenBuilderMenuCatalogPort.selectMenuTreeList(catalogRoot))) {
                String menuCode = firstNonBlank(row == null ? "" : row.getMenuCode(), row == null ? "" : row.getCode());
                if (safe(menuCode).length() == 8) {
                    menuCodes.add(safe(menuCode));
                }
            }
        }
        return normalizeMenuCodes(menuCodes);
    }

    private Map<String, Object> readOrBuildStatusSummaryProjection(String menuCode, boolean isEn) throws Exception {
        try {
            Map<String, Object> stored = screenBuilderDraftStoragePort.loadStatusSummaryProjection(menuCode, isEn);
            if (stored != null && !stored.isEmpty()) {
                return stored;
            }
        } catch (Exception ignore) {
            // Rebuild the projection if the cached file is unreadable.
        }
        Map<String, Object> computed = buildStatusSummaryItem(menuCode, isEn);
        writeStatusSummaryProjection(menuCode, isEn, computed);
        return computed;
    }

    private void writeStatusSummaryProjection(String menuCode, boolean isEn, Map<String, Object> item) throws Exception {
        screenBuilderDraftStoragePort.saveStatusSummaryProjection(menuCode, isEn, item);
    }

    private void invalidateStatusSummaryProjection(String menuCode) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return;
        }
        screenBuilderDraftStoragePort.deleteStatusSummaryProjection(normalizedMenuCode, false);
        screenBuilderDraftStoragePort.deleteStatusSummaryProjection(normalizedMenuCode, true);
    }

    private void invalidateAllStatusSummaryProjections() throws Exception {
        screenBuilderDraftStoragePort.deleteAllStatusSummaryProjections();
    }

    private void warmStatusSummaryProjection(String menuCode) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return;
        }
        writeStatusSummaryProjection(normalizedMenuCode, false, buildStatusSummaryItem(normalizedMenuCode, false));
        writeStatusSummaryProjection(normalizedMenuCode, true, buildStatusSummaryItem(normalizedMenuCode, true));
    }

    private Map<String, Object> buildStatusSummaryItem(String menuCode, boolean isEn) throws Exception {
        ScreenBuilderDraftDocumentVO draft = getDraft(menuCode, "", "", "");
        List<ScreenBuilderVersionSummaryVO> versionHistory = getVersionHistory(menuCode);
        ScreenBuilderVersionSummaryVO publishedVersion = findLatestPublishedVersion(versionHistory);
        Map<String, Object> diagnostics = getRegistryDiagnostics(draft, isEn);
        int unregisteredCount = sizeOfList(diagnostics.get("unregisteredNodes"));
        int missingCount = sizeOfList(diagnostics.get("missingNodes"));
        int deprecatedCount = sizeOfList(diagnostics.get("deprecatedNodes"));
        String publishedVersionId = publishedVersion == null ? "" : safe(publishedVersion.getVersionId());
        String publishedSavedAt = publishedVersion == null ? "" : safe(publishedVersion.getSavedAt());
        String releaseUnitId = screenBuilderArtifactNamingPolicyPort.resolveReleaseUnitId(draft, publishedVersionId);
        Map<String, Object> artifactEvidence = screenBuilderArtifactNamingPolicyPort.buildArtifactEvidence(
                draft,
                releaseUnitId,
                publishedVersionId,
                publishedSavedAt);
        Map<String, Object> freshness = buildPublishFreshnessStatus(publishedVersionId, publishedSavedAt, isEn);
        Map<String, Object> parity = buildParitySummary(draft, releaseUnitId, publishedVersionId, isEn);

        return responseMap(
                "menuCode", safe(draft.getMenuCode()),
                "pageId", safe(draft.getPageId()),
                "menuTitle", safe(draft.getMenuTitle()),
                "menuUrl", safe(draft.getMenuUrl()),
                "publishedVersionId", publishedVersionId,
                "publishedSavedAt", publishedSavedAt,
                "releaseUnitId", releaseUnitId,
                "artifactTargetSystem", asString(artifactEvidence.get("artifactTargetSystem")),
                "runtimePackageId", asString(artifactEvidence.get("runtimePackageId")),
                "deployTraceId", asString(artifactEvidence.get("deployTraceId")),
                "publishFreshnessState", asString(freshness.get("publishFreshnessState")),
                "publishFreshnessLabel", asString(freshness.get("publishFreshnessLabel")),
                "publishFreshnessDetail", asString(freshness.get("publishFreshnessDetail")),
                "parityState", asString(parity.get("parityState")),
                "parityLabel", asString(parity.get("parityLabel")),
                "parityDetail", asString(parity.get("parityDetail")),
                "parityTraceId", asString(parity.get("parityTraceId")),
                "versionCount", versionHistory.size(),
                "unregisteredCount", unregisteredCount,
                "missingCount", missingCount,
                "deprecatedCount", deprecatedCount);
    }

    private Map<String, Object> buildPublishFreshnessStatus(String publishedVersionId, String publishedSavedAt, boolean isEn) {
        if (safe(publishedVersionId).isEmpty()) {
            return responseMap(
                    "publishFreshnessState", "UNPUBLISHED",
                    "publishFreshnessLabel", isEn ? "No publish yet" : "아직 발행 없음",
                    "publishFreshnessDetail", isEn ? "This menu is still operating from draft-only builder state." : "이 메뉴는 아직 draft 전용 빌더 상태입니다.");
        }
        long publishedAt = parseSummaryTime(publishedSavedAt);
        if (publishedAt < 0L) {
            return responseMap(
                    "publishFreshnessState", "UNKNOWN",
                    "publishFreshnessLabel", isEn ? "Publish time unknown" : "발행 시각 확인 필요",
                    "publishFreshnessDetail", safe(publishedSavedAt).isEmpty()
                            ? (isEn ? "Published version exists but timestamp is missing." : "발행 버전은 있으나 시각 정보가 없습니다.")
                            : safe(publishedSavedAt));
        }
        long ageHours = Math.max(0L, (System.currentTimeMillis() - publishedAt) / (60L * 60L * 1000L));
        if (ageHours <= 24L) {
            return responseMap(
                    "publishFreshnessState", "FRESH",
                    "publishFreshnessLabel", isEn ? "Fresh publish" : "최신 발행",
                    "publishFreshnessDetail", isEn
                            ? "Published " + formatAgeLabel(ageHours, true) + "."
                            : formatAgeLabel(ageHours, false) + " 발행됨");
        }
        if (ageHours <= 72L) {
            return responseMap(
                    "publishFreshnessState", "AGING",
                    "publishFreshnessLabel", isEn ? "Publish aging" : "발행 노후화 시작",
                    "publishFreshnessDetail", isEn
                            ? "Published " + formatAgeLabel(ageHours, true) + ". Recheck runtime parity before release."
                            : formatAgeLabel(ageHours, false) + " 발행됨. 배포 전 런타임 정합성 재확인이 필요합니다.");
        }
        return responseMap(
                "publishFreshnessState", "STALE",
                "publishFreshnessLabel", isEn ? "Publish stale" : "발행 노후화",
                "publishFreshnessDetail", isEn
                        ? "Published " + formatAgeLabel(ageHours, true) + ". Refresh builder output and verify parity drift."
                        : formatAgeLabel(ageHours, false) + " 발행됨. 빌더 산출물을 갱신하고 정합성 드리프트를 확인하세요.");
    }

    private Map<String, Object> buildParitySummary(ScreenBuilderDraftDocumentVO draft, String releaseUnitId, String publishedVersionId, boolean isEn) {
        if (safe(publishedVersionId).isEmpty()) {
            return buildUnavailableParityStatus(isEn, isEn ? "No publish yet." : "아직 발행이 없습니다.");
        }
        Map<String, String> context = resolveRuntimeCompareContext(draft);
        if (safe(context.get("guidedStateId")).isEmpty()
                || safe(context.get("templateLineId")).isEmpty()
                || safe(context.get("screenFamilyRuleId")).isEmpty()
                || safe(context.get("ownerLane")).isEmpty()
                || safe(context.get("selectedScreenId")).isEmpty()) {
            return buildUnavailableParityStatus(isEn, isEn ? "Compare context keys are incomplete for this menu." : "이 메뉴의 비교 컨텍스트 키가 아직 완전하지 않습니다.");
        }
        try {
            ScreenBuilderRuntimeCompareRequest request = new ScreenBuilderRuntimeCompareRequest();
            request.setProjectId(screenBuilderRuntimeComparePolicyPort.resolveProjectId());
            request.setGuidedStateId(context.get("guidedStateId"));
            request.setTemplateLineId(context.get("templateLineId"));
            request.setScreenFamilyRuleId(context.get("screenFamilyRuleId"));
            request.setOwnerLane(context.get("ownerLane"));
            request.setSelectedScreenId(context.get("selectedScreenId"));
            request.setReleaseUnitId(releaseUnitId);
            request.setCompareBaseline(screenBuilderRuntimeComparePolicyPort.resolveCompareBaseline());
            request.setRequestedBy(screenBuilderRuntimeComparePolicyPort.resolveRequestedBy());
            request.setRequestedByType(screenBuilderRuntimeComparePolicyPort.resolveRequestedByType());
            ScreenBuilderRuntimeCompareResult result = screenBuilderRuntimeComparePort.compare(request);
            return buildParityStatus(result.getMismatchCount(), result.getGapCount(), safe(result.getTraceId()), isEn);
        } catch (Exception e) {
            return buildUnavailableParityStatus(isEn, safe(e.getMessage()).isEmpty()
                    ? (isEn ? "Failed to load parity compare summary." : "정합성 비교 요약을 불러오지 못했습니다.")
                    : safe(e.getMessage()));
        }
    }

    private Map<String, Object> buildUnavailableParityStatus(boolean isEn, String detail) {
        return responseMap(
                "parityState", "UNAVAILABLE",
                "parityLabel", isEn ? "Parity not checked" : "정합성 미확인",
                "parityDetail", safe(detail),
                "parityTraceId", "");
    }

    private Map<String, Object> buildParityStatus(int mismatchCount, int gapCount, String traceId, boolean isEn) {
        if (gapCount > 0) {
            return responseMap(
                    "parityState", "GAP",
                    "parityLabel", isEn ? "Parity gap " + gapCount : "정합성 갭 " + gapCount,
                    "parityDetail", isEn
                            ? mismatchCount + " mismatch and " + gapCount + " gap rows detected against current runtime."
                            : "현재 런타임 기준으로 불일치 " + mismatchCount + "건, 갭 " + gapCount + "건이 확인됐습니다.",
                    "parityTraceId", safe(traceId));
        }
        if (mismatchCount > 0) {
            return responseMap(
                    "parityState", "DRIFT",
                    "parityLabel", isEn ? "Parity drift " + mismatchCount : "정합성 드리프트 " + mismatchCount,
                    "parityDetail", isEn
                            ? mismatchCount + " mismatch rows detected against current runtime."
                            : "현재 런타임 기준으로 불일치 " + mismatchCount + "건이 확인됐습니다.",
                    "parityTraceId", safe(traceId));
        }
        return responseMap(
                "parityState", "MATCH",
                "parityLabel", isEn ? "Parity match" : "정합성 일치",
                "parityDetail", isEn
                        ? "Current runtime and generated target are aligned for this compare scope."
                        : "현재 런타임과 generated target이 이 비교 범위에서 일치합니다.",
                "parityTraceId", safe(traceId));
    }

    private Map<String, Object> successResponse(String message, Object... fields) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        for (int i = 0; i + 1 < fields.length; i += 2) {
            response.put(String.valueOf(fields[i]), fields[i + 1]);
        }
        response.put("message", safe(message));
        return response;
    }

    private Map<String, Object> responseMap(Object... fields) {
        Map<String, Object> response = new LinkedHashMap<>();
        for (int i = 0; i + 1 < fields.length; i += 2) {
            response.put(String.valueOf(fields[i]), fields[i + 1]);
        }
        return response;
    }

    private static Map<String, Object> responseMapStatic(Object... fields) {
        Map<String, Object> response = new LinkedHashMap<>();
        for (int i = 0; i + 1 < fields.length; i += 2) {
            response.put(String.valueOf(fields[i]), fields[i + 1]);
        }
        return response;
    }

    private Map<String, Object> mutableMap(Map<String, Object> source) {
        return source == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source);
    }

    private Map<String, String> resolveRuntimeCompareContext(ScreenBuilderDraftDocumentVO draft) {
        Map<String, String> context = new LinkedHashMap<>();
        String menuUrl = safe(draft == null ? null : draft.getMenuUrl()).toLowerCase(Locale.ROOT);
        String templateType = safe(draft == null ? null : draft.getTemplateType()).toUpperCase(Locale.ROOT);
        boolean adminSurface = screenBuilderRuntimeComparePolicyPort.isAdminSurface(menuUrl);
        context.put("guidedStateId", screenBuilderRuntimeComparePolicyPort.resolveGuidedStateId(adminSurface));
        context.put("templateLineId", screenBuilderRuntimeComparePolicyPort.resolveTemplateLineId(adminSurface));
        context.put("screenFamilyRuleId", screenBuilderRuntimeComparePolicyPort.resolveScreenFamilyRuleId(adminSurface, templateType, menuUrl));
        context.put("ownerLane", screenBuilderRuntimeComparePolicyPort.resolveOwnerLane());
        context.put("selectedScreenId", screenBuilderRuntimeComparePolicyPort.resolveSelectedScreenId(
                safe(draft == null ? null : draft.getPageId()),
                safe(draft == null ? null : draft.getMenuCode())));
        return context;
    }

    private long parseSummaryTime(String publishedSavedAt) {
        String value = safe(publishedSavedAt);
        if (value.isEmpty()) {
            return -1L;
        }
        List<DateTimeFormatter> formatters = Arrays.asList(
                DateTimeFormatter.ISO_DATE_TIME,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
                DateTimeFormatter.ofPattern("yyyyMMddHHmmss")
        );
        for (DateTimeFormatter formatter : formatters) {
            try {
                return LocalDateTime.parse(value, formatter)
                        .atZone(java.time.ZoneId.systemDefault())
                        .toInstant()
                        .toEpochMilli();
            } catch (Exception ignore) {
                // Try the next known timestamp format.
            }
        }
        return -1L;
    }

    private String formatAgeLabel(long ageHours, boolean isEn) {
        if (ageHours < 1L) {
            return isEn ? "within 1 hour" : "1시간 이내";
        }
        if (ageHours < 24L) {
            return isEn ? ageHours + "h ago" : ageHours + "시간 전";
        }
        long days = ageHours / 24L;
        if (days < 7L) {
            return isEn ? days + "d ago" : days + "일 전";
        }
        long weeks = days / 7L;
        return isEn ? weeks + "w ago" : weeks + "주 전";
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castObjectList(Object value) {
        if (!(value instanceof List<?>)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (item instanceof Map<?, ?>) {
                rows.add((Map<String, Object>) item);
            }
        }
        return rows;
    }

    private String resolveDefaultTemplateType(String pageId, String menuUrl) {
        if (isListPageCandidate(pageId) || safe(menuUrl).endsWith("/list")) {
            return "LIST_PAGE";
        }
        return DEFAULT_TEMPLATE_TYPE;
    }

    private boolean isListPageCandidate(String pageId) {
        String normalized = safe(pageId).toLowerCase(Locale.ROOT);
        return normalized.endsWith("list") || normalized.contains("member-list") || normalized.contains("company-list");
    }

    private ScreenBuilderMenuDescriptor findMenu(String menuCode) throws Exception {
        String normalizedMenuCode = safe(menuCode);
        if (normalizedMenuCode.isEmpty()) {
            return null;
        }
        for (String catalogRoot : screenBuilderMenuBindingPolicyPort.getMenuCatalogRoots()) {
            List<ScreenBuilderMenuDescriptor> rows = new ArrayList<>(screenBuilderMenuCatalogPort.selectMenuTreeList(catalogRoot));
            for (ScreenBuilderMenuDescriptor row : rows) {
                if (normalizedMenuCode.equalsIgnoreCase(safe(row.getMenuCode()))) {
                    return row;
                }
                if (normalizedMenuCode.equalsIgnoreCase(safe(row.getCode()))) {
                    return row;
                }
            }
        }
        return null;
    }

    private List<ScreenBuilderComponentRegistryItemVO> readComponentRegistry(boolean isEn) throws Exception {
        try {
            seedDefaultRegistryItems(isEn);
            importLegacyComponentRegistryIfPresent(isEn);
            return screenBuilderComponentRegistryPort.selectComponentRegistryList().stream()
                    .map(this::mapRegistryRow)
                    .sorted(Comparator.comparing(ScreenBuilderComponentRegistryItemVO::getSourceType, Comparator.nullsLast(String::compareTo))
                            .thenComparing(ScreenBuilderComponentRegistryItemVO::getComponentId, Comparator.nullsLast(String::compareTo)))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Failed to read screen-builder component registry. Falling back to empty registry list.", e);
            return Collections.emptyList();
        }
    }

    private boolean containsComponentId(Map<String, ScreenBuilderComponentRegistryItemVO> registryIndex, String componentId) {
        String normalized = safe(componentId);
        if (normalized.isEmpty()) {
            return false;
        }
        return registryIndex.containsKey(normalized.toLowerCase(Locale.ROOT));
    }

    private String buildSuggestedComponentId(String componentType, String label) {
        String base = ("comp." + safe(componentType) + "." + safe(label))
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "")
                .replaceAll("-{2,}", "-");
        return base.isEmpty() ? "comp." + safe(componentType) + "." + UUID.randomUUID().toString().substring(0, 8) : base;
    }

    private List<ScreenBuilderComponentRegistryItemVO> createDefaultComponentRegistry(boolean isEn) {
        List<ScreenBuilderComponentRegistryItemVO> rows = new ArrayList<>();
        rows.add(defaultRegistryItem("core.page", "page", isEn ? "Page Root" : "페이지 루트", "System root container", mapOf("title", "Edit Page")));
        rows.add(defaultRegistryItem("core.section", "section", isEn ? "Section" : "섹션", "Reusable layout section", mapOf("title", isEn ? "Section" : "섹션")));
        rows.add(defaultRegistryItem("core.heading", "heading", isEn ? "Heading" : "제목", "Static heading text", mapOf("text", isEn ? "Heading" : "제목")));
        rows.add(defaultRegistryItem("core.text", "text", isEn ? "Text" : "설명", "Static description text", mapOf("text", isEn ? "Description" : "설명")));
        rows.add(defaultRegistryItem("core.input", "input", isEn ? "Input" : "입력", "Single line input field", mapOf("label", isEn ? "Input" : "입력", "placeholder", isEn ? "Type a value" : "값 입력")));
        rows.add(defaultRegistryItem("core.textarea", "textarea", isEn ? "Textarea" : "긴 입력", "Multiline text field", mapOf("label", isEn ? "Textarea" : "긴 입력", "placeholder", isEn ? "Type details" : "상세 입력")));
        rows.add(defaultRegistryItem("core.select", "select", isEn ? "Select" : "선택", "Selectable option input", mapOf("label", isEn ? "Select" : "선택", "placeholder", isEn ? "Choose one" : "옵션 선택")));
        rows.add(defaultRegistryItem("core.checkbox", "checkbox", isEn ? "Checkbox" : "체크박스", "Boolean agreement field", mapOf("label", isEn ? "Checkbox" : "체크박스", "required", false)));
        rows.add(defaultRegistryItem("core.button", "button", isEn ? "Button" : "버튼", "Action button", mapOf("label", isEn ? "Submit" : "저장", "variant", "primary")));
        rows.add(defaultRegistryItem("core.table", "table", isEn ? "Table" : "테이블", "List result block", mapOf("title", isEn ? "Result Table" : "목록 테이블", "columns", isEn ? "No.|Name|Type|Company|Joined|Status|Actions" : "번호|성명|회원 유형|소속 기관|가입일|상태|관리", "emptyText", isEn ? "No rows found." : "조회된 데이터가 없습니다.")));
        rows.add(defaultRegistryItem("core.pagination", "pagination", isEn ? "Pagination" : "페이지네이션", "Paged result navigator", mapOf("summary", isEn ? "Page 1 of 1" : "1 / 1 페이지")));
        return rows;
    }

    private ScreenBuilderComponentRegistryItemVO defaultRegistryItem(String componentId, String componentType, String label, String description, Map<String, Object> propsTemplate) {
        ScreenBuilderComponentRegistryItemVO item = new ScreenBuilderComponentRegistryItemVO();
        item.setComponentId(componentId);
        item.setComponentType(componentType);
        item.setLabel(label);
        item.setDescription(description);
        item.setStatus(ACTIVE_STATUS);
        item.setReplacementComponentId("");
        item.setSourceType("SYSTEM");
        item.setCreatedAt("SYSTEM");
        item.setUpdatedAt("SYSTEM");
        item.setPropsTemplate(mutableMap(propsTemplate));
        return item;
    }

    private ScreenBuilderComponentRegistryItemVO findRegistryItem(Map<String, ScreenBuilderComponentRegistryItemVO> registryIndex, String componentId) {
        String normalizedComponentId = safe(componentId).toLowerCase(Locale.ROOT);
        return normalizedComponentId.isEmpty() ? null : registryIndex.get(normalizedComponentId);
    }

    private void seedDefaultRegistryItems(boolean isEn) throws Exception {
        for (ScreenBuilderComponentRegistryItemVO item : createDefaultComponentRegistry(isEn)) {
            if (screenBuilderComponentRegistryPort.countComponentRegistry(item.getComponentId()) > 0) {
                continue;
            }
            upsertComponentRegistryItem(item);
        }
    }

    private void importLegacyComponentRegistryIfPresent(boolean isEn) throws Exception {
        for (ScreenBuilderComponentRegistryItemVO row : screenBuilderLegacyRegistrySourcePort.loadLegacyRegistryItems()) {
            if (row == null || safe(row.getComponentId()).isEmpty()) {
                continue;
            }
            if (screenBuilderComponentRegistryPort.countComponentRegistry(row.getComponentId()) > 0) {
                continue;
            }
            if (safe(row.getStatus()).isEmpty()) {
                row.setStatus(ACTIVE_STATUS);
            }
            if (safe(row.getSourceType()).isEmpty()) {
                row.setSourceType("CUSTOM");
            }
            upsertComponentRegistryItem(row);
        }
    }

    private void upsertComponentRegistryItem(ScreenBuilderComponentRegistryItemVO item) throws Exception {
        UiComponentRegistryVO row = new UiComponentRegistryVO();
        row.setComponentId(safe(item.getComponentId()));
        row.setComponentName(firstNonBlank(item.getLabel(), item.getComponentId()));
        row.setComponentType(firstNonBlank(item.getComponentType(), "button"));
        row.setOwnerDomain(firstNonBlank(item.getSourceType(), "CUSTOM"));
        row.setPropsSchemaJson(buildRegistryMetadataJson(item));
        row.setDesignReference(safe(item.getDescription()));
        row.setActiveYn("INACTIVE".equalsIgnoreCase(safe(item.getStatus())) ? "N" : "Y");
        screenBuilderComponentRegistryPort.upsertComponentRegistry(row);
    }

    private String buildRegistryMetadataJson(ScreenBuilderComponentRegistryItemVO item) throws Exception {
        Map<String, Object> metadata = responseMap(
                "propsTemplate", mutableMap(item.getPropsTemplate()),
                "labelEn", safe(item.getLabelEn()),
                "description", safe(item.getDescription()),
                "status", firstNonBlank(item.getStatus(), ACTIVE_STATUS),
                "replacementComponentId", safe(item.getReplacementComponentId()),
                "sourceType", firstNonBlank(item.getSourceType(), "CUSTOM"));
        return objectMapper.writeValueAsString(metadata);
    }

    private ScreenBuilderComponentRegistryItemVO mapRegistryRow(UiComponentRegistryVO row) {
        ScreenBuilderComponentRegistryItemVO item = new ScreenBuilderComponentRegistryItemVO();
        item.setComponentId(safe(row.getComponentId()));
        item.setComponentType(safe(row.getComponentType()));
        item.setLabel(firstNonBlank(row.getComponentName(), row.getComponentId()));
        item.setLabelEn("");
        item.setDescription(safe(row.getDesignReference()));
        item.setStatus("Y".equalsIgnoreCase(safe(row.getActiveYn())) ? ACTIVE_STATUS : "INACTIVE");
        item.setReplacementComponentId("");
        item.setSourceType(firstNonBlank(row.getOwnerDomain(), "CUSTOM"));
        item.setCreatedAt(safe(row.getCreatedAt()));
        item.setUpdatedAt(safe(row.getUpdatedAt()));
        item.setPropsTemplate(new LinkedHashMap<>());
        Map<String, Object> metadata = parseRegistryMetadata(row.getPropsSchemaJson());
        item.setLabelEn(safe(asString(metadata.get("labelEn"))));
        item.setDescription(firstNonBlank(asString(metadata.get("description")), item.getDescription()));
        item.setStatus(firstNonBlank(asString(metadata.get("status")), item.getStatus()));
        item.setReplacementComponentId(safe(asString(metadata.get("replacementComponentId"))));
        item.setSourceType(firstNonBlank(asString(metadata.get("sourceType")), item.getSourceType()));
        Object propsTemplate = metadata.get("propsTemplate");
        if (propsTemplate instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = mutableMap((Map<String, Object>) propsTemplate);
            item.setPropsTemplate(casted);
        }
        item.setUsageCount(getComponentUsageCount(item.getComponentId()));
        return item;
    }

    private Map<String, Object> parseRegistryMetadata(String json) {
        String normalized = safe(json);
        if (normalized.isEmpty()) {
            return mutableMap(null);
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = objectMapper.readValue(normalized.getBytes(StandardCharsets.UTF_8), LinkedHashMap.class);
            return mutableMap(metadata);
        } catch (IOException ignored) {
            return mutableMap(null);
        }
    }

    private int getComponentUsageCount(String componentId) {
        try {
            return screenBuilderComponentRegistryPort.selectComponentUsageList(componentId).size()
                    + scanBuilderDraftUsage(componentId, false).size()
                    + scanBuilderDraftUsage(componentId, true).size();
        } catch (Exception ignored) {
            return 0;
        }
    }

    private List<ScreenBuilderComponentUsageVO> scanBuilderDraftUsage(String componentId, boolean publishedOnly) throws Exception {
        List<ScreenBuilderComponentUsageVO> usages = new ArrayList<>();
        if (publishedOnly) {
            for (String menuCode : screenBuilderDraftStoragePort.listHistoryMenuCodes()) {
                ScreenBuilderDraftDocumentVO published = getLatestPublishedDraft(menuCode);
                if (published != null) {
                    usages.addAll(collectDocumentComponentUsage(published, componentId, "PUBLISHED"));
                }
            }
            return usages;
        }
        for (ScreenBuilderDraftDocumentVO draft : screenBuilderDraftStoragePort.listAllDrafts()) {
            usages.addAll(collectDocumentComponentUsage(draft, componentId, "DRAFT"));
        }
        return usages;
    }

    private List<ScreenBuilderComponentUsageVO> collectDocumentComponentUsage(ScreenBuilderDraftDocumentVO document, String componentId, String usageSource) {
        List<ScreenBuilderComponentUsageVO> usages = new ArrayList<>();
        if (document == null || document.getNodes() == null) {
            return usages;
        }
        for (ScreenBuilderNodeVO node : document.getNodes()) {
            if (!safe(componentId).equalsIgnoreCase(safe(node.getComponentId()))) {
                continue;
            }
            ScreenBuilderComponentUsageVO row = new ScreenBuilderComponentUsageVO();
            row.setUsageSource(usageSource);
            row.setUsageStatus(firstNonBlank(document.getVersionStatus(), usageSource));
            row.setMenuCode(safe(document.getMenuCode()));
            row.setPageId(safe(document.getPageId()));
            row.setMenuTitle(firstNonBlank(document.getMenuTitle(), document.getPageId()));
            row.setMenuUrl(safe(document.getMenuUrl()));
            row.setLayoutZone(safe(node.getSlotName()));
            row.setInstanceKey(firstNonBlank(asString(node.getProps().get("label")), asString(node.getProps().get("title")), asString(node.getProps().get("text")), node.getNodeId()));
            row.setNodeId(safe(node.getNodeId()));
            row.setComponentId(safe(node.getComponentId()));
            row.setVersionId(safe(document.getVersionId()));
            usages.add(row);
        }
        return usages;
    }

    private int replaceComponentIdAcrossDrafts(String fromComponentId, String toComponentId, boolean publishedOnly) throws Exception {
        int updatedDraftCount = 0;
        if (publishedOnly) {
            return 0;
        }
        for (ScreenBuilderDraftDocumentVO draft : screenBuilderDraftStoragePort.listAllDrafts()) {
            boolean changed = false;
            for (ScreenBuilderNodeVO node : draft.getNodes()) {
                if (safe(fromComponentId).equalsIgnoreCase(safe(node.getComponentId()))) {
                    node.setComponentId(toComponentId);
                    changed = true;
                }
            }
            if (changed) {
                draft.setVersionId(UUID.randomUUID().toString());
                draft.setVersionStatus("DRAFT");
                persistDraftMutation(draft, false);
                updatedDraftCount++;
            }
        }
        return updatedDraftCount;
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> safeMap(Object value) {
        if (!(value instanceof Map)) {
            return Collections.emptyMap();
        }
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> safeMapList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (item instanceof Map) {
                rows.add((Map<String, Object>) item);
            }
        }
        return rows;
    }

    private List<String> safeStringList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<String> rows = new ArrayList<>();
        for (Object item : (List<?>) value) {
            if (item != null) {
                rows.add(String.valueOf(item));
            }
        }
        return rows;
    }

    private static final class CommandAuthorityContext {
        private final Set<String> allowedApiIds;
        private final Set<String> menuFeatureCodes;

        private CommandAuthorityContext(Set<String> allowedApiIds, Set<String> menuFeatureCodes) {
            this.allowedApiIds = allowedApiIds == null ? Collections.emptySet() : allowedApiIds;
            this.menuFeatureCodes = menuFeatureCodes == null ? Collections.emptySet() : menuFeatureCodes;
        }

        private static CommandAuthorityContext empty() {
            return new CommandAuthorityContext(Collections.emptySet(), Collections.emptySet());
        }
    }

    private Map<String, Object> buildRegistryDiagnostics(ScreenBuilderDraftDocumentVO draft, List<ScreenBuilderComponentRegistryItemVO> registry) {
        Map<String, Object> diagnostics = new LinkedHashMap<>();
        Map<String, ScreenBuilderComponentRegistryItemVO> registryMap = indexRegistryItems(registry);
        List<Map<String, Object>> unregisteredNodes = new ArrayList<>();
        List<Map<String, Object>> missingNodes = new ArrayList<>();
        List<Map<String, Object>> deprecatedNodes = new ArrayList<>();
        for (ScreenBuilderNodeVO node : draft.getNodes()) {
            if ("page".equalsIgnoreCase(safe(node.getComponentType()))) {
                continue;
            }
            String componentId = safe(node.getComponentId());
            if (componentId.isEmpty()) {
                unregisteredNodes.add(nodeIssue(node, "UNREGISTERED", null));
                continue;
            }
            ScreenBuilderComponentRegistryItemVO item = registryMap.get(componentId);
            if (item == null) {
                missingNodes.add(nodeIssue(node, "MISSING", null));
                continue;
            }
            if ("DEPRECATED".equalsIgnoreCase(safe(item.getStatus()))) {
                deprecatedNodes.add(nodeIssue(node, "DEPRECATED", item.getReplacementComponentId()));
            }
        }
        diagnostics.put("unregisteredNodes", unregisteredNodes);
        diagnostics.put("missingNodes", missingNodes);
        diagnostics.put("deprecatedNodes", deprecatedNodes);
        diagnostics.put("componentPromptSurface", registry.stream().map(this::promptSurface).collect(Collectors.toList()));
        return diagnostics;
    }

    private Map<String, Object> buildDeprecatedReplacementPlan(ScreenBuilderDraftDocumentVO draft, boolean isEn) throws Exception {
        List<ScreenBuilderComponentRegistryItemVO> registry = getComponentRegistry(isEn);
        Map<String, ScreenBuilderComponentRegistryItemVO> registryMap = indexRegistryItems(registry);
        int replacedCount = 0;
        List<Map<String, Object>> items = new ArrayList<>();
        List<ScreenBuilderNodeVO> nextNodes = new ArrayList<>();
        for (ScreenBuilderNodeVO node : draft.getNodes()) {
            ScreenBuilderNodeVO next = node;
            String componentId = safe(node.getComponentId());
            ScreenBuilderComponentRegistryItemVO item = registryMap.get(componentId);
            if (item != null
                    && "DEPRECATED".equalsIgnoreCase(safe(item.getStatus()))
                    && !safe(item.getReplacementComponentId()).isEmpty()
                    && registryMap.containsKey(safe(item.getReplacementComponentId()))) {
                ScreenBuilderComponentRegistryItemVO replacement = registryMap.get(safe(item.getReplacementComponentId()));
                next = new ScreenBuilderNodeVO();
                next.setNodeId(node.getNodeId());
                next.setComponentId(replacement.getComponentId());
                next.setParentNodeId(node.getParentNodeId());
                next.setComponentType(firstNonBlank(replacement.getComponentType(), node.getComponentType()));
                next.setSlotName(node.getSlotName());
                next.setSortOrder(node.getSortOrder());
                next.setProps(replacement.getPropsTemplate() == null || replacement.getPropsTemplate().isEmpty()
                        ? mutableMap(node.getProps())
                        : mutableMap(replacement.getPropsTemplate()));
                items.add(responseMap(
                        "nodeId", safe(node.getNodeId()),
                        "fromComponentId", safe(node.getComponentId()),
                        "toComponentId", safe(replacement.getComponentId()),
                        "label", resolveNodeDisplayLabel(node)));
                replacedCount++;
            }
            nextNodes.add(next);
        }
        return responseMap(
                "replacedCount", replacedCount,
                "items", items,
                "nextNodes", nextNodes);
    }

    private int sizeOfList(Object value) {
        return value instanceof List ? ((List<?>) value).size() : 0;
    }

    private String findDefaultParentNodeId(ScreenBuilderDraftDocumentVO draft, String componentType) {
        if ("section".equalsIgnoreCase(safe(componentType))) {
            for (ScreenBuilderNodeVO node : draft.getNodes()) {
                if ("page".equalsIgnoreCase(safe(node.getComponentType()))) {
                    return safe(node.getNodeId());
                }
            }
        }
        for (ScreenBuilderNodeVO node : draft.getNodes()) {
            if ("section".equalsIgnoreCase(safe(node.getComponentType()))) {
                return safe(node.getNodeId());
            }
        }
        for (ScreenBuilderNodeVO node : draft.getNodes()) {
            if ("page".equalsIgnoreCase(safe(node.getComponentType()))) {
                return safe(node.getNodeId());
            }
        }
        return "";
    }

    private List<ScreenBuilderNodeVO> sortNodesForPersistence(List<ScreenBuilderNodeVO> nodes) {
        List<ScreenBuilderNodeVO> sorted = new ArrayList<>(nodes);
        sorted.sort(Comparator.comparingInt(ScreenBuilderNodeVO::getSortOrder).thenComparing(ScreenBuilderNodeVO::getNodeId, Comparator.nullsLast(String::compareTo)));
        for (int index = 0; index < sorted.size(); index++) {
            sorted.get(index).setSortOrder(index);
        }
        return sorted;
    }

    private Map<String, Object> nodeIssue(ScreenBuilderNodeVO node, String reason, String replacementComponentId) {
        return responseMap(
                "nodeId", safe(node.getNodeId()),
                "componentId", safe(node.getComponentId()),
                "componentType", safe(node.getComponentType()),
                "label", resolveNodeDisplayLabel(node),
                "reason", reason,
                "replacementComponentId", safe(replacementComponentId));
    }

    private Map<String, Object> promptSurface(ScreenBuilderComponentRegistryItemVO item) {
        return responseMap(
                "componentId", safe(item.getComponentId()),
                "componentType", safe(item.getComponentType()),
                "status", safe(item.getStatus()),
                "replacementComponentId", safe(item.getReplacementComponentId()),
                "label", safe(item.getLabel()),
                "description", safe(item.getDescription()),
                "allowedPropKeys", item.getPropsTemplate() == null ? new ArrayList<>() : new ArrayList<>(item.getPropsTemplate().keySet()),
                "propsTemplate", mutableMap(item.getPropsTemplate()));
    }

    private String resolveNodeDisplayLabel(ScreenBuilderNodeVO node) {
        if (node == null) {
            return "";
        }
        Map<String, Object> props = node.getProps() == null ? Collections.emptyMap() : node.getProps();
        return firstNonBlank(
                String.valueOf(props.getOrDefault("label", "")),
                String.valueOf(props.getOrDefault("title", "")),
                String.valueOf(props.getOrDefault("text", "")),
                safe(node.getNodeId()));
    }

    private ScreenBuilderVersionSummaryVO findLatestPublishedVersion(List<ScreenBuilderVersionSummaryVO> history) {
        if (history == null || history.isEmpty()) {
            return null;
        }
        for (ScreenBuilderVersionSummaryVO item : history) {
            if ("PUBLISHED".equalsIgnoreCase(safe(item.getVersionStatus()))) {
                return item;
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!safe(value).isEmpty()) {
                return safe(value);
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
