import type { Dispatch, SetStateAction } from "react";
import type {
  ScreenBuilderAutoReplacePreviewItem,
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderComponentUsage,
  ScreenBuilderEventBinding,
  ScreenBuilderNode,
  ScreenBuilderPagePayload,
  ScreenBuilderRegistryScanItem
} from "../../../lib/api/platformTypes";
import {
  addScreenBuilderNodeFromComponent,
  addScreenBuilderNodeTreeFromComponents,
  autoReplaceDeprecatedScreenBuilderComponents,
  deleteScreenBuilderComponentRegistryItem,
  fetchScreenBuilderComponentRegistryUsage,
  fetchScreenBuilderPreview,
  previewAutoReplaceDeprecatedScreenBuilderComponents,
  publishScreenBuilderDraft,
  registerScreenBuilderComponent,
  remapScreenBuilderComponentRegistryUsage,
  restoreScreenBuilderDraft,
  saveScreenBuilderDraft,
  scanScreenBuilderRegistryDiagnostics,
  updateScreenBuilderComponentRegistry
} from "../../../lib/api/platform";
import { sortScreenBuilderNodes } from "../shared/screenBuilderUtils";
import type { AiNodeTreeInputRow, BuilderTemplateType } from "../shared/screenBuilderShared";

type Params = {
  aiNodeTreeRows: AiNodeTreeInputRow[];
  backendDeprecatedNodesLength: number;
  backendMissingNodesLength: number;
  backendUnregisteredNodesLength: number;
  componentDescription: string;
  componentLabel: string;
  en: boolean;
  events: ScreenBuilderEventBinding[];
  nodes: ScreenBuilderNode[];
  page: ScreenBuilderPagePayload | null;
  pageReload: () => Promise<unknown>;
  previewMode: "DRAFT" | "PUBLISHED";
  publishIssueCount: number;
  draftAuthorityProfile: ScreenBuilderPagePayload["authorityProfile"] | null;
  registryEditorDescription: string;
  registryEditorLabel: string;
  registryEditorPropsJson: string;
  registryEditorReplacementId: string;
  registryEditorStatus: string;
  registryEditorType: string;
  replacementComponentId: string;
  selectedNode: ScreenBuilderNode | null;
  selectedRegistryInventoryItem: ScreenBuilderComponentRegistryItem | null;
  selectedTemplateType: BuilderTemplateType;
  setAutoReplacePreviewItems: Dispatch<SetStateAction<ScreenBuilderAutoReplacePreviewItem[]>>;
  setComponentRegistry: Dispatch<SetStateAction<ScreenBuilderComponentRegistryItem[]>>;
  setMessage: Dispatch<SetStateAction<string>>;
  setNodes: Dispatch<SetStateAction<ScreenBuilderNode[]>>;
  setPreviewLoading: Dispatch<SetStateAction<boolean>>;
  setPreviewMessage: Dispatch<SetStateAction<string>>;
  setPreviewNodes: Dispatch<SetStateAction<ScreenBuilderNode[]>>;
  setRegistryScanRows: Dispatch<SetStateAction<ScreenBuilderRegistryScanItem[]>>;
  setRegistryUsageRows: Dispatch<SetStateAction<ScreenBuilderComponentUsage[]>>;
  setReplacementComponentId: Dispatch<SetStateAction<string>>;
  setSaveError: Dispatch<SetStateAction<string>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setSelectedRegistryComponentId: Dispatch<SetStateAction<string>>;
};

export function useScreenBuilderMutations({
  aiNodeTreeRows,
  backendDeprecatedNodesLength,
  backendMissingNodesLength,
  backendUnregisteredNodesLength,
  componentDescription,
  componentLabel,
  en,
  events,
  nodes,
  page,
  pageReload,
  previewMode,
  publishIssueCount,
  draftAuthorityProfile,
  registryEditorDescription,
  registryEditorLabel,
  registryEditorPropsJson,
  registryEditorReplacementId,
  registryEditorStatus,
  registryEditorType,
  replacementComponentId,
  selectedNode,
  selectedRegistryInventoryItem,
  selectedTemplateType,
  setAutoReplacePreviewItems,
  setComponentRegistry,
  setMessage,
  setNodes,
  setPreviewLoading,
  setPreviewMessage,
  setPreviewNodes,
  setRegistryScanRows,
  setRegistryUsageRows,
  setReplacementComponentId,
  setSaveError,
  setSaving,
  setSelectedRegistryComponentId
}: Params) {
  async function handlePreviewRefresh(savedDraft = false) {
    if (!page) {
      return;
    }
    setPreviewLoading(true);
    setPreviewMessage("");
    try {
      const preview = await fetchScreenBuilderPreview({
        menuCode: page.menuCode,
        pageId: page.pageId,
        menuTitle: page.menuTitle,
        menuUrl: page.menuUrl,
        versionStatus: previewMode
      });
      setPreviewNodes(sortScreenBuilderNodes(preview.nodes || []));
      setPreviewMessage(savedDraft
        ? (en ? "Preview refreshed from the saved draft." : "저장된 초안 기준으로 미리보기를 갱신했습니다.")
        : (previewMode === "PUBLISHED"
          ? (en ? "Preview refreshed from the latest published snapshot." : "최근 publish 스냅샷 기준으로 미리보기를 갱신했습니다.")
          : (en ? "Preview refreshed." : "미리보기를 갱신했습니다.")));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to refresh preview." : "미리보기 갱신 중 오류가 발생했습니다."));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSave() {
    if (!page) {
      return;
    }
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await saveScreenBuilderDraft({
        menuCode: page.menuCode,
        pageId: page.pageId,
        menuTitle: page.menuTitle,
        menuUrl: page.menuUrl,
        templateType: selectedTemplateType,
        authorityProfile: draftAuthorityProfile || undefined,
        nodes,
        events
      });
      setMessage(String(response.message || (en ? "Screen builder draft saved." : "화면 빌더 초안을 저장했습니다.")));
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to save screen builder draft." : "화면 빌더 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreVersion(versionId: string) {
    if (!page?.menuCode || !versionId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await restoreScreenBuilderDraft({
        menuCode: page.menuCode,
        versionId
      });
      setMessage(String(response.message || (en ? "Draft restored." : "초안을 복원했습니다.")));
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to restore draft." : "초안 복원 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!page?.menuCode) {
      return;
    }
    if (publishIssueCount > 0) {
      setSaveError(
        en
          ? `Publish is blocked until validation issues are resolved. Unregistered=${backendUnregisteredNodesLength}, Missing=${backendMissingNodesLength}, Deprecated=${backendDeprecatedNodesLength}`
          : `검증 이슈가 해결되기 전에는 Publish 할 수 없습니다. 미등록=${backendUnregisteredNodesLength}, 누락=${backendMissingNodesLength}, Deprecated=${backendDeprecatedNodesLength}`
      );
      return;
    }
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await publishScreenBuilderDraft({ menuCode: page.menuCode });
      setMessage(String(response.message || (en ? "Published version snapshot created." : "publish 버전 스냅샷을 만들었습니다.")));
      await pageReload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to publish draft." : "초안 publish 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterSelectedComponent() {
    if (!page || !selectedNode || selectedNode.componentType === "page") {
      return;
    }
    setSaving(true);
    setSaveError("");
    setMessage("");
    try {
      const response = await registerScreenBuilderComponent({
        menuCode: page.menuCode,
        pageId: page.pageId,
        nodeId: selectedNode.nodeId,
        componentType: selectedNode.componentType,
        label: componentLabel || String(selectedNode.props?.label || selectedNode.props?.title || selectedNode.props?.text || selectedNode.nodeId),
        description: componentDescription,
        propsTemplate: { ...(selectedNode.props || {}) }
      });
      setComponentRegistry((current) => {
        const next = current.filter((item) => item.componentId !== response.item.componentId);
        next.push(response.item);
        return next.sort((left, right) => String(left.componentId || "").localeCompare(String(right.componentId || "")));
      });
      setNodes((current) => current.map((node) => node.nodeId === selectedNode.nodeId
        ? { ...node, componentId: response.item.componentId }
        : node));
      setReplacementComponentId(response.item.componentId);
      setMessage(String(response.message || (en ? "Component registered." : "컴포넌트를 등록했습니다.")));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to register component." : "컴포넌트 등록 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeprecateComponent(item: ScreenBuilderComponentRegistryItem) {
    if (!item?.componentId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await updateScreenBuilderComponentRegistry({
        componentId: item.componentId,
        status: "DEPRECATED",
        replacementComponentId: replacementComponentId || item.replacementComponentId || "",
        menuCode: page?.menuCode || ""
      });
      setComponentRegistry((current) => current.map((row) => row.componentId === response.item.componentId ? response.item : row));
      setMessage(String(response.message || (en ? "Component deprecated." : "컴포넌트를 deprecated 처리했습니다.")));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to update component." : "컴포넌트 수정 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRegistryItem() {
    if (!selectedRegistryInventoryItem?.componentId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const parsedProps = registryEditorPropsJson.trim() ? JSON.parse(registryEditorPropsJson) as Record<string, unknown> : {};
      const response = await updateScreenBuilderComponentRegistry({
        componentId: selectedRegistryInventoryItem.componentId,
        componentType: registryEditorType,
        label: registryEditorLabel,
        description: registryEditorDescription,
        status: registryEditorStatus,
        replacementComponentId: registryEditorReplacementId,
        propsTemplate: parsedProps,
        menuCode: page?.menuCode || ""
      });
      setComponentRegistry((current) => current.map((row) => row.componentId === response.item.componentId ? response.item : row));
      setMessage(String(response.message || (en ? "Component updated." : "컴포넌트를 수정했습니다.")));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to save component." : "컴포넌트 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRegistryItem() {
    if (!selectedRegistryInventoryItem?.componentId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await deleteScreenBuilderComponentRegistryItem({
        componentId: selectedRegistryInventoryItem.componentId
      });
      setComponentRegistry((current) => current.filter((row) => row.componentId !== selectedRegistryInventoryItem.componentId));
      setSelectedRegistryComponentId((current) => current === selectedRegistryInventoryItem.componentId ? "" : current);
      setRegistryUsageRows([]);
      setMessage(String(response.message || (en ? "Component deleted." : "컴포넌트를 삭제했습니다.")));
      await pageReload();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to delete component." : "컴포넌트 삭제 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemapRegistryUsage() {
    if (!selectedRegistryInventoryItem?.componentId || !registryEditorReplacementId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await remapScreenBuilderComponentRegistryUsage({
        fromComponentId: selectedRegistryInventoryItem.componentId,
        toComponentId: registryEditorReplacementId
      });
      setMessage(String(response.message || (en ? "Component usage remapped." : "컴포넌트 사용처를 재매핑했습니다.")));
      const usageResponse = await fetchScreenBuilderComponentRegistryUsage(selectedRegistryInventoryItem.componentId);
      setRegistryUsageRows(usageResponse.items || []);
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to remap component usage." : "컴포넌트 사용처 재매핑 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoReplaceDeprecated() {
    if (!page?.menuCode) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await autoReplaceDeprecatedScreenBuilderComponents({ menuCode: page.menuCode });
      setMessage(String(response.message || (en ? "Deprecated components replaced." : "deprecated 컴포넌트를 대체했습니다.")));
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to auto replace deprecated components." : "deprecated 컴포넌트 자동 대체 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewAutoReplaceDeprecated() {
    if (!page?.menuCode) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await previewAutoReplaceDeprecatedScreenBuilderComponents({ menuCode: page.menuCode });
      setAutoReplacePreviewItems(response.items || []);
      setMessage(en ? "Loaded replacement diff preview." : "대체 diff 미리보기를 불러왔습니다.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to preview replacement diff." : "대체 diff 미리보기 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleScanRegistryDiagnostics() {
    setSaving(true);
    setSaveError("");
    try {
      const response = await scanScreenBuilderRegistryDiagnostics();
      setRegistryScanRows(response.items || []);
      setMessage(en ? "Registry diagnostics scanned." : "레지스트리 진단을 스캔했습니다.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to scan registry diagnostics." : "레지스트리 진단 스캔 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNodeFromComponent(componentId: string) {
    if (!page?.menuCode || !componentId) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const response = await addScreenBuilderNodeFromComponent({
        menuCode: page.menuCode,
        componentId,
        parentNodeId: selectedNode?.nodeId || ""
      });
      setMessage(String(response.message || (en ? "Node added from component." : "컴포넌트로 노드를 추가했습니다.")));
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to add node from component." : "컴포넌트 노드 추가 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNodeTreeFromAiSurface() {
    if (!page?.menuCode) {
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const parsed = aiNodeTreeRows.map((row) => ({
        componentId: row.componentId.trim(),
        alias: row.alias.trim() || undefined,
        parentAlias: row.parentAlias.trim() || undefined,
        props: row.propsJson.trim() ? JSON.parse(row.propsJson) as Record<string, unknown> : {}
      })).filter((row) => row.componentId);
      const response = await addScreenBuilderNodeTreeFromComponents({
        menuCode: page.menuCode,
        items: parsed
      });
      setMessage(String(response.message || (en ? "Node tree added from AI component contracts." : "AI 컴포넌트 계약으로 노드 트리를 추가했습니다.")));
      await pageReload();
      await handlePreviewRefresh(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : (en ? "Failed to add node tree from AI component contracts." : "AI 컴포넌트 계약 노드 트리 추가 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return {
    handleAddNodeFromComponent,
    handleAddNodeTreeFromAiSurface,
    handleAutoReplaceDeprecated,
    handleDeleteRegistryItem,
    handleDeprecateComponent,
    handlePreviewAutoReplaceDeprecated,
    handlePreviewRefresh,
    handlePublish,
    handleRegisterSelectedComponent,
    handleRemapRegistryUsage,
    handleRestoreVersion,
    handleSave,
    handleSaveRegistryItem,
    handleScanRegistryDiagnostics
  };
}
