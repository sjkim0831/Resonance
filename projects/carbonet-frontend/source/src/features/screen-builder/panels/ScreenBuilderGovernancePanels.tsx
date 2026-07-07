import { useDeferredValue, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FrameworkAuthorityOption, FrameworkAuthorityRoleContract, FrameworkAuthorityText } from "../../../framework";
import type {
  ScreenBuilderAutoReplacePreviewItem,
  ScreenBuilderComponentPromptSurface,
  ScreenBuilderComponentRegistryItem,
  ScreenBuilderComponentUsage,
  ScreenBuilderRegistryScanItem
} from "../../../lib/api/platformTypes";
import { type SystemComponentCatalogType } from "../catalog/buttonCatalogCore";
import { type AiNodeTreeInputRow } from "../shared/screenBuilderShared";
import GovernanceAuthoritySection from "./governance/GovernanceAuthoritySection";
import GovernanceCatalogSection from "./governance/GovernanceCatalogSection";
import GovernanceRegistryInventorySection from "./governance/GovernanceRegistryInventorySection";
import GovernanceRegistryUsageSection from "./governance/GovernanceRegistryUsageSection";
import GovernanceAutoReplacePreviewSection from "./governance/GovernanceAutoReplacePreviewSection";
import GovernanceDraftScanSection from "./governance/GovernanceDraftScanSection";
import GovernanceAiPromptSurfaceSection from "./governance/GovernanceAiPromptSurfaceSection";
import GovernanceAiNodeTreeSection from "./governance/GovernanceAiNodeTreeSection";
import type { SystemCatalogGroup, SystemCatalogInstance, VirtualWindow } from "./governance/shared";

const USAGE_INSTANCE_ROW_HEIGHT = 92;
const USAGE_INSTANCE_VIEWPORT_HEIGHT = 520;
const GROUPED_STYLE_ROW_HEIGHT = 320;
const GROUPED_STYLE_VIEWPORT_HEIGHT = 720;
const REGISTRY_ITEM_HEIGHT = 196;
const REGISTRY_VIEWPORT_HEIGHT = 280;
const REGISTRY_USAGE_ROW_HEIGHT = 76;
const REGISTRY_USAGE_VIEWPORT_HEIGHT = 420;
const VIRTUAL_OVERSCAN = 4;

function buildVirtualWindow(
  totalCount: number,
  scrollTop: number,
  itemHeight: number,
  viewportHeight: number
): VirtualWindow {
  if (totalCount <= 0) {
    return { startIndex: 0, endIndex: 0, topSpacerHeight: 0, bottomSpacerHeight: 0 };
  }
  const visibleCount = Math.max(1, Math.ceil(viewportHeight / itemHeight));
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - VIRTUAL_OVERSCAN);
  const endIndex = Math.min(totalCount, startIndex + visibleCount + VIRTUAL_OVERSCAN * 2);
  return {
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * itemHeight,
    bottomSpacerHeight: Math.max(0, (totalCount - endIndex) * itemHeight)
  };
}

function buildGridVirtualWindow(
  totalCount: number,
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  columns: number
): VirtualWindow {
  const safeColumns = Math.max(columns, 1);
  const totalRows = Math.ceil(totalCount / safeColumns);
  if (totalRows <= 0) {
    return { startIndex: 0, endIndex: 0, topSpacerHeight: 0, bottomSpacerHeight: 0 };
  }
  const visibleRowCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN);
  const endRow = Math.min(totalRows, startRow + visibleRowCount + VIRTUAL_OVERSCAN * 2);
  return {
    startIndex: startRow * safeColumns,
    endIndex: Math.min(totalCount, endRow * safeColumns),
    topSpacerHeight: startRow * rowHeight,
    bottomSpacerHeight: Math.max(0, (totalRows - endRow) * rowHeight)
  };
}

type Props = {
  authorityLoading: boolean;
  authorityAssignmentAuthorities: FrameworkAuthorityText[];
  authorityRoleCategories: FrameworkAuthorityText[];
  authorityRoleCategoryOptions: FrameworkAuthorityOption[];
  authorityRoleTemplates: FrameworkAuthorityRoleContract[];
  draftAuthorityAuthorCode: string;
  applyAuthorityRoleToDraft: (role: FrameworkAuthorityRoleContract) => void;
  en: boolean;
  saving: boolean;
  filteredSystemCatalog: SystemCatalogGroup[];
  systemCatalogInstances: SystemCatalogInstance[];
  selectedCatalogType: SystemComponentCatalogType | "ALL" | "";
  copiedButtonStyleId: string;
  copyButtonStyleId: (styleGroupId: string) => Promise<void>;
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  backendUnregisteredNodes: Array<{ nodeId: string; componentType: string; label: string }>;
  backendMissingNodes: Array<{ nodeId: string; componentId?: string; label: string; replacementComponentId?: string }>;
  backendDeprecatedNodes: Array<{ nodeId: string; componentId?: string; label: string; replacementComponentId?: string }>;
  componentTypeOptions: string[];
  registryTypeFilter: string;
  setRegistryTypeFilter: Dispatch<SetStateAction<string>>;
  registryStatusFilter: "ALL" | "ACTIVE" | "DEPRECATED";
  setRegistryStatusFilter: Dispatch<SetStateAction<"ALL" | "ACTIVE" | "DEPRECATED">>;
  filteredComponentRegistry: ScreenBuilderComponentRegistryItem[];
  uniqueUsageUrlsByComponent: Record<string, string[]>;
  setSelectedNodeId: Dispatch<SetStateAction<string>>;
  setSelectedRegistryComponentId: Dispatch<SetStateAction<string>>;
  setReplacementComponentId: Dispatch<SetStateAction<string>>;
  handleDeprecateComponent: (item: ScreenBuilderComponentRegistryItem) => Promise<void>;
  selectedRegistryInventoryItem: ScreenBuilderComponentRegistryItem | null;
  registryUsageRows: ScreenBuilderComponentUsage[];
  registryUsageLoading: boolean;
  registryEditorType: string;
  setRegistryEditorType: Dispatch<SetStateAction<string>>;
  registryEditorLabel: string;
  setRegistryEditorLabel: Dispatch<SetStateAction<string>>;
  registryEditorDescription: string;
  setRegistryEditorDescription: Dispatch<SetStateAction<string>>;
  registryEditorStatus: string;
  setRegistryEditorStatus: Dispatch<SetStateAction<string>>;
  registryEditorReplacementId: string;
  setRegistryEditorReplacementId: Dispatch<SetStateAction<string>>;
  registryEditorPropsJson: string;
  setRegistryEditorPropsJson: Dispatch<SetStateAction<string>>;
  handleSaveRegistryItem: () => Promise<void>;
  handleRemapRegistryUsage: () => Promise<void>;
  handleDeleteRegistryItem: () => Promise<void>;
  autoReplacePreviewItems: ScreenBuilderAutoReplacePreviewItem[];
  registryScanRows: ScreenBuilderRegistryScanItem[];
  componentPromptSurface: ScreenBuilderComponentPromptSurface[];
  handleAddNodeFromComponent: (componentId: string) => Promise<void>;
  handlePreviewAutoReplaceDeprecated: () => Promise<void>;
  handleAutoReplaceDeprecated: () => Promise<void>;
  handleScanRegistryDiagnostics: () => Promise<void>;
  aiNodeTreeRows: AiNodeTreeInputRow[];
  updateAiNodeTreeRow: (index: number, field: keyof AiNodeTreeInputRow, value: string) => void;
  addAiNodeTreeRow: () => void;
  removeAiNodeTreeRow: (index: number) => void;
  handleAddNodeTreeFromAiSurface: () => Promise<void>;
};

export default function ScreenBuilderGovernancePanels({
  authorityLoading,
  authorityAssignmentAuthorities,
  authorityRoleCategories,
  authorityRoleCategoryOptions,
  authorityRoleTemplates,
  draftAuthorityAuthorCode,
  applyAuthorityRoleToDraft,
  en,
  saving,
  filteredSystemCatalog,
  systemCatalogInstances,
  selectedCatalogType,
  copiedButtonStyleId,
  copyButtonStyleId,
  componentRegistry,
  backendUnregisteredNodes,
  backendMissingNodes,
  backendDeprecatedNodes,
  componentTypeOptions,
  registryTypeFilter,
  setRegistryTypeFilter,
  registryStatusFilter,
  setRegistryStatusFilter,
  filteredComponentRegistry,
  uniqueUsageUrlsByComponent,
  setSelectedNodeId,
  setSelectedRegistryComponentId,
  setReplacementComponentId,
  handleDeprecateComponent,
  selectedRegistryInventoryItem,
  registryUsageRows,
  registryUsageLoading,
  registryEditorType,
  setRegistryEditorType,
  registryEditorLabel,
  setRegistryEditorLabel,
  registryEditorDescription,
  setRegistryEditorDescription,
  registryEditorStatus,
  setRegistryEditorStatus,
  registryEditorReplacementId,
  setRegistryEditorReplacementId,
  registryEditorPropsJson,
  setRegistryEditorPropsJson,
  handleSaveRegistryItem,
  handleRemapRegistryUsage,
  handleDeleteRegistryItem,
  autoReplacePreviewItems,
  registryScanRows,
  componentPromptSurface,
  handleAddNodeFromComponent,
  handlePreviewAutoReplaceDeprecated,
  handleAutoReplaceDeprecated,
  handleScanRegistryDiagnostics,
  aiNodeTreeRows,
  updateAiNodeTreeRow,
  addAiNodeTreeRow,
  removeAiNodeTreeRow,
  handleAddNodeTreeFromAiSurface
}: Props) {
  const [catalogView, setCatalogView] = useState<"instances" | "styles">("instances");
  const [registryInventoryView, setRegistryInventoryView] = useState<"diagnostics" | "registry">("diagnostics");
  const [usageInstanceScrollTop, setUsageInstanceScrollTop] = useState(0);
  const [groupedStyleScrollTop, setGroupedStyleScrollTop] = useState(0);
  const [registryInventoryScrollTop, setRegistryInventoryScrollTop] = useState(0);
  const [registryUsageScrollTop, setRegistryUsageScrollTop] = useState(0);

  const deferredAuthorityRoleTemplates = useDeferredValue(authorityRoleTemplates);
  const deferredSystemCatalogInstances = useDeferredValue(systemCatalogInstances);
  const deferredFilteredSystemCatalog = useDeferredValue(filteredSystemCatalog);
  const deferredFilteredComponentRegistry = useDeferredValue(filteredComponentRegistry);

  const authorityRoleTemplatePreview = useMemo(
    () => deferredAuthorityRoleTemplates.slice(0, 12),
    [deferredAuthorityRoleTemplates]
  );
  const usageInstanceWindow = useMemo(
    () => buildVirtualWindow(
      deferredSystemCatalogInstances.length,
      usageInstanceScrollTop,
      USAGE_INSTANCE_ROW_HEIGHT,
      USAGE_INSTANCE_VIEWPORT_HEIGHT
    ),
    [deferredSystemCatalogInstances.length, usageInstanceScrollTop]
  );
  const visibleSystemCatalogInstances = useMemo(
    () => deferredSystemCatalogInstances.slice(usageInstanceWindow.startIndex, usageInstanceWindow.endIndex),
    [deferredSystemCatalogInstances, usageInstanceWindow]
  );
  const groupedStyleWindow = useMemo(
    () => buildGridVirtualWindow(
      deferredFilteredSystemCatalog.length,
      groupedStyleScrollTop,
      GROUPED_STYLE_ROW_HEIGHT,
      GROUPED_STYLE_VIEWPORT_HEIGHT,
      2
    ),
    [deferredFilteredSystemCatalog.length, groupedStyleScrollTop]
  );
  const visibleGroupedSystemCatalog = useMemo(
    () => deferredFilteredSystemCatalog.slice(groupedStyleWindow.startIndex, groupedStyleWindow.endIndex),
    [deferredFilteredSystemCatalog, groupedStyleWindow]
  );
  const registryInventoryWindow = useMemo(
    () => buildVirtualWindow(
      deferredFilteredComponentRegistry.length,
      registryInventoryScrollTop,
      REGISTRY_ITEM_HEIGHT,
      REGISTRY_VIEWPORT_HEIGHT
    ),
    [deferredFilteredComponentRegistry.length, registryInventoryScrollTop]
  );
  const visibleComponentRegistryItems = useMemo(
    () => deferredFilteredComponentRegistry.slice(registryInventoryWindow.startIndex, registryInventoryWindow.endIndex),
    [deferredFilteredComponentRegistry, registryInventoryWindow]
  );
  const registryUsageWindow = useMemo(
    () => buildVirtualWindow(
      registryUsageRows.length,
      registryUsageScrollTop,
      REGISTRY_USAGE_ROW_HEIGHT,
      REGISTRY_USAGE_VIEWPORT_HEIGHT
    ),
    [registryUsageRows.length, registryUsageScrollTop]
  );
  const visibleRegistryUsageRows = useMemo(
    () => registryUsageRows.slice(registryUsageWindow.startIndex, registryUsageWindow.endIndex),
    [registryUsageRows, registryUsageWindow]
  );

  return (
    <>
      <GovernanceAuthoritySection
        applyAuthorityRoleToDraft={applyAuthorityRoleToDraft}
        authorityAssignmentAuthorities={authorityAssignmentAuthorities}
        authorityLoading={authorityLoading}
        authorityRoleCategories={authorityRoleCategories}
        authorityRoleCategoryOptions={authorityRoleCategoryOptions}
        authorityRoleTemplates={authorityRoleTemplatePreview}
        draftAuthorityAuthorCode={draftAuthorityAuthorCode}
        en={en}
      />

      <GovernanceCatalogSection
        catalogView={catalogView}
        copiedButtonStyleId={copiedButtonStyleId}
        copyButtonStyleId={copyButtonStyleId}
        en={en}
        filteredSystemCatalog={filteredSystemCatalog}
        groupedStyleWindow={groupedStyleWindow}
        onGroupedStyleScroll={setGroupedStyleScrollTop}
        onUsageInstanceScroll={setUsageInstanceScrollTop}
        selectedCatalogType={selectedCatalogType}
        setCatalogView={setCatalogView}
        systemCatalogInstances={systemCatalogInstances}
        usageInstanceWindow={usageInstanceWindow}
        visibleGroupedSystemCatalog={visibleGroupedSystemCatalog}
        visibleSystemCatalogInstances={visibleSystemCatalogInstances}
      />

      <GovernanceRegistryInventorySection
        backendDeprecatedNodes={backendDeprecatedNodes}
        backendMissingNodes={backendMissingNodes}
        backendUnregisteredNodes={backendUnregisteredNodes}
        componentRegistry={componentRegistry}
        componentTypeOptions={componentTypeOptions}
        copiedButtonStyleId={copiedButtonStyleId}
        copyButtonStyleId={copyButtonStyleId}
        en={en}
        filteredComponentRegistry={filteredComponentRegistry}
        handleAutoReplaceDeprecated={handleAutoReplaceDeprecated}
        handleDeprecateComponent={handleDeprecateComponent}
        handlePreviewAutoReplaceDeprecated={handlePreviewAutoReplaceDeprecated}
        handleScanRegistryDiagnostics={handleScanRegistryDiagnostics}
        onRegistryInventoryScroll={setRegistryInventoryScrollTop}
        registryInventoryView={registryInventoryView}
        registryInventoryWindow={registryInventoryWindow}
        registryStatusFilter={registryStatusFilter}
        registryTypeFilter={registryTypeFilter}
        saving={saving}
        selectedCatalogType={selectedCatalogType}
        setRegistryInventoryView={setRegistryInventoryView}
        setRegistryStatusFilter={setRegistryStatusFilter}
        setRegistryTypeFilter={setRegistryTypeFilter}
        setReplacementComponentId={setReplacementComponentId}
        setSelectedNodeId={setSelectedNodeId}
        setSelectedRegistryComponentId={setSelectedRegistryComponentId}
        systemCatalogInstances={systemCatalogInstances}
        uniqueUsageUrlsByComponent={uniqueUsageUrlsByComponent}
        visibleComponentRegistryItems={visibleComponentRegistryItems}
      />

      <GovernanceRegistryUsageSection
        componentRegistry={componentRegistry}
        componentTypeOptions={componentTypeOptions}
        en={en}
        handleDeleteRegistryItem={handleDeleteRegistryItem}
        handleRemapRegistryUsage={handleRemapRegistryUsage}
        handleSaveRegistryItem={handleSaveRegistryItem}
        onRegistryUsageScroll={setRegistryUsageScrollTop}
        registryEditorDescription={registryEditorDescription}
        registryEditorLabel={registryEditorLabel}
        registryEditorPropsJson={registryEditorPropsJson}
        registryEditorReplacementId={registryEditorReplacementId}
        registryEditorStatus={registryEditorStatus}
        registryEditorType={registryEditorType}
        registryUsageLoading={registryUsageLoading}
        registryUsageRows={registryUsageRows}
        registryUsageWindow={registryUsageWindow}
        saving={saving}
        selectedRegistryInventoryItem={selectedRegistryInventoryItem}
        setRegistryEditorDescription={setRegistryEditorDescription}
        setRegistryEditorLabel={setRegistryEditorLabel}
        setRegistryEditorPropsJson={setRegistryEditorPropsJson}
        setRegistryEditorReplacementId={setRegistryEditorReplacementId}
        setRegistryEditorStatus={setRegistryEditorStatus}
        setRegistryEditorType={setRegistryEditorType}
        visibleRegistryUsageRows={visibleRegistryUsageRows}
      />

      <GovernanceAutoReplacePreviewSection autoReplacePreviewItems={autoReplacePreviewItems} en={en} />

      <GovernanceDraftScanSection en={en} registryScanRows={registryScanRows} />

      <GovernanceAiPromptSurfaceSection
        componentPromptSurface={componentPromptSurface}
        en={en}
        handleAddNodeFromComponent={handleAddNodeFromComponent}
        saving={saving}
      />

      <GovernanceAiNodeTreeSection
        addAiNodeTreeRow={addAiNodeTreeRow}
        aiNodeTreeRows={aiNodeTreeRows}
        en={en}
        handleAddNodeTreeFromAiSurface={handleAddNodeTreeFromAiSurface}
        removeAiNodeTreeRow={removeAiNodeTreeRow}
        saving={saving}
        updateAiNodeTreeRow={updateAiNodeTreeRow}
      />
    </>
  );
}
