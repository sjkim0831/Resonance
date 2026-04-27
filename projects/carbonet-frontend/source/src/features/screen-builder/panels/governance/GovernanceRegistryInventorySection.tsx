import type { Dispatch, SetStateAction } from "react";
import { buildLocalizedPath } from "../../../../lib/navigation/runtime";
import { GridToolbar, MemberButton, MemberButtonGroup, MemberLinkButton } from "../../../admin-ui/common";
import { resolveButtonVariant, resolveCatalogInventoryTitle, renderSystemCatalogPreview } from "../../shared/screenBuilderShared";
import type { ScreenBuilderComponentRegistryItem } from "../../../../lib/api/platformTypes";
import type { SystemCatalogInstance, VirtualWindow } from "./shared";

type Props = {
  registryInventoryView: "diagnostics" | "registry";
  setRegistryInventoryView: (view: "diagnostics" | "registry") => void;
  backendDeprecatedNodes: Array<{ nodeId: string; componentId?: string; label: string; replacementComponentId?: string }>;
  backendMissingNodes: Array<{ nodeId: string; componentId?: string; label: string; replacementComponentId?: string }>;
  backendUnregisteredNodes: Array<{ nodeId: string; componentType: string; label: string }>;
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  componentTypeOptions: string[];
  copyButtonStyleId: (styleGroupId: string) => Promise<void>;
  copiedButtonStyleId: string;
  en: boolean;
  filteredComponentRegistry: ScreenBuilderComponentRegistryItem[];
  onRegistryInventoryScroll: (scrollTop: number) => void;
  registryStatusFilter: "ALL" | "ACTIVE" | "DEPRECATED";
  registryTypeFilter: string;
  saving: boolean;
  selectedCatalogType: string;
  setRegistryStatusFilter: Dispatch<SetStateAction<"ALL" | "ACTIVE" | "DEPRECATED">>;
  setRegistryTypeFilter: Dispatch<SetStateAction<string>>;
  setReplacementComponentId: Dispatch<SetStateAction<string>>;
  setSelectedNodeId: Dispatch<SetStateAction<string>>;
  setSelectedRegistryComponentId: Dispatch<SetStateAction<string>>;
  handleAutoReplaceDeprecated: () => Promise<void>;
  handleDeprecateComponent: (item: ScreenBuilderComponentRegistryItem) => Promise<void>;
  handlePreviewAutoReplaceDeprecated: () => Promise<void>;
  handleScanRegistryDiagnostics: () => Promise<void>;
  systemCatalogInstances: SystemCatalogInstance[];
  uniqueUsageUrlsByComponent: Record<string, string[]>;
  visibleComponentRegistryItems: ScreenBuilderComponentRegistryItem[];
  registryInventoryWindow: VirtualWindow;
};

export default function GovernanceRegistryInventorySection(props: Props) {
  const {
    registryInventoryView,
    setRegistryInventoryView,
    backendDeprecatedNodes,
    backendMissingNodes,
    backendUnregisteredNodes,
    componentRegistry,
    componentTypeOptions,
    en,
    filteredComponentRegistry,
    onRegistryInventoryScroll,
    registryStatusFilter,
    registryTypeFilter,
    saving,
    selectedCatalogType,
    setRegistryStatusFilter,
    setRegistryTypeFilter,
    setReplacementComponentId,
    setSelectedNodeId,
    setSelectedRegistryComponentId,
    handleAutoReplaceDeprecated,
    handleDeprecateComponent,
    handlePreviewAutoReplaceDeprecated,
    handleScanRegistryDiagnostics,
    systemCatalogInstances,
    uniqueUsageUrlsByComponent,
    visibleComponentRegistryItems,
    registryInventoryWindow
  } = props;
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        actions={(
          <MemberButtonGroup>
            <MemberButton onClick={() => setRegistryInventoryView("diagnostics")} size="xs" type="button" variant={registryInventoryView === "diagnostics" ? "primary" : "secondary"}>{en ? "Diagnostics" : "진단"}</MemberButton>
            <MemberButton onClick={() => setRegistryInventoryView("registry")} size="xs" type="button" variant={registryInventoryView === "registry" ? "primary" : "secondary"}>{en ? "Registry List" : "레지스트리 목록"}</MemberButton>
            <MemberButton disabled={!backendDeprecatedNodes.length || saving} onClick={() => { void handlePreviewAutoReplaceDeprecated(); }} size="xs" type="button" variant="secondary">{en ? "Preview replace diff" : "대체 diff 미리보기"}</MemberButton>
            <MemberButton disabled={!backendDeprecatedNodes.length || saving} onClick={() => { void handleAutoReplaceDeprecated(); }} size="xs" type="button" variant="secondary">{en ? "Auto replace deprecated" : "Deprecated 자동 대체"}</MemberButton>
            <MemberButton disabled={saving} onClick={() => { void handleScanRegistryDiagnostics(); }} size="xs" type="button" variant="secondary">{en ? "Scan all drafts" : "전체 draft 스캔"}</MemberButton>
            <label className="inline-flex items-center gap-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-2 py-1 text-xs text-[var(--kr-gov-text-secondary)]">
              <span>{en ? "Type" : "종류"}</span>
              <select className="bg-transparent text-xs outline-none" value={registryTypeFilter} onChange={(event) => setRegistryTypeFilter(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                {componentTypeOptions.map((item) => <option key={`registry-type-${item}`} value={item}>{item}</option>)}
              </select>
            </label>
            <MemberButton onClick={() => setRegistryStatusFilter("ALL")} size="xs" type="button" variant={registryStatusFilter === "ALL" ? "primary" : "secondary"}>{en ? "All" : "전체"}</MemberButton>
            <MemberButton onClick={() => setRegistryStatusFilter("ACTIVE")} size="xs" type="button" variant={registryStatusFilter === "ACTIVE" ? "primary" : "secondary"}>ACTIVE</MemberButton>
            <MemberButton onClick={() => setRegistryStatusFilter("DEPRECATED")} size="xs" type="button" variant={registryStatusFilter === "DEPRECATED" ? "primary" : "secondary"}>DEPRECATED</MemberButton>
          </MemberButtonGroup>
        )}
        meta={en ? `${componentRegistry.length} registry items / ${backendUnregisteredNodes.length} unregistered candidates` : `레지스트리 ${componentRegistry.length}건 / 미등록 후보 ${backendUnregisteredNodes.length}건`}
        title={en ? "Component Registry Inventory" : "컴포넌트 레지스트리 인벤토리"}
      />
      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        {registryInventoryView === "diagnostics" ? (
          <>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Unregistered nodes" : "미등록 노드"}</p>
              <div className="mt-3 space-y-2">
                {backendUnregisteredNodes.length ? backendUnregisteredNodes.map((node) => (
                  <button className="w-full rounded border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-100" key={`unregistered-${node.nodeId}`} onClick={() => setSelectedNodeId(node.nodeId)} type="button">
                    <span className="font-mono text-[11px]">{node.componentType}</span>
                    <span className="ml-2">{node.label}</span>
                  </button>
                )) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No unregistered nodes." : "미등록 노드가 없습니다."}</p>}
              </div>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Broken references" : "깨진 참조"}</p>
              <div className="mt-3 space-y-2">
                {[...backendMissingNodes, ...backendDeprecatedNodes].length ? [...backendMissingNodes, ...backendDeprecatedNodes].map((node) => (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-800" key={`broken-${node.nodeId}`}>
                    <button className="w-full text-left" onClick={() => setSelectedNodeId(node.nodeId)} type="button">
                      <span className="font-mono text-[11px]">{String(node.componentId || "-")}</span>
                      <span className="ml-2">{node.label}</span>
                    </button>
                    {node.replacementComponentId ? <div className="mt-2 text-[11px] text-red-700">{en ? "Suggested replacement" : "권장 대체"}: <span className="font-mono">{node.replacementComponentId}</span></div> : null}
                  </div>
                )) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No broken references." : "깨진 참조가 없습니다."}</p>}
              </div>
            </article>
          </>
        ) : (
          <article className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] p-4 xl:col-span-2">
            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Registry List Focus" : "레지스트리 목록 집중 보기"}</p>
            <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Diagnostics panels are hidden in this tab so the registry list can mount faster and use more screen space." : "이 탭에서는 진단 패널을 숨겨 레지스트리 목록이 더 빨리 마운트되고 화면을 더 넓게 쓰도록 했습니다."}
            </p>
          </article>
        )}
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{selectedCatalogType && selectedCatalogType !== "ALL" ? resolveCatalogInventoryTitle(selectedCatalogType, en) : (en ? "Registered components" : "등록 컴포넌트")}</p>
            {selectedCatalogType && selectedCatalogType !== "ALL" ? <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">{en ? `${systemCatalogInstances.length} detected` : `${systemCatalogInstances.length}건 감지`}</span> : null}
          </div>
          {selectedCatalogType && selectedCatalogType !== "ALL" ? (
            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-900">
              {en ? "This area shows all detected component usage instances in the current system first. Registered components are listed below as a secondary section." : "이 영역은 현재 시스템에서 감지된 전체 컴포넌트 사용 인스턴스를 먼저 보여주고, 등록된 컴포넌트는 아래 보조 섹션으로 보여줍니다."}
            </div>
          ) : null}
          {selectedCatalogType && selectedCatalogType !== "ALL" ? (
            <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "All Component Usage Instances" : "전체 컴포넌트 사용 인스턴스"}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? `${systemCatalogInstances.length} items` : `${systemCatalogInstances.length}건`}</span>
              </div>
              <div className="mt-3 max-h-[260px] space-y-2 overflow-auto">
                {systemCatalogInstances.length ? systemCatalogInstances.slice(0, 80).map((item) => (
                  <div className="rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-3" key={item.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--kr-gov-text-primary)]">{item.label || (en ? "Button" : "버튼")} · {item.route.label}</p>
                        <p className="truncate font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{item.route.koPath}</p>
                      </div>
                      <MemberLinkButton href={buildLocalizedPath(item.route.koPath, item.route.enPath)} size="xs" variant="secondary">{en ? "Open" : "열기"}</MemberLinkButton>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {renderSystemCatalogPreview(item, en)}
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-[10px] text-indigo-800">{item.styleGroupId}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">{item.componentName}</span>
                    </div>
                  </div>
                )) : <p className="rounded border border-dashed border-[var(--kr-gov-border-light)] bg-white px-3 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "No component usage instances were detected." : "감지된 컴포넌트 사용 인스턴스가 없습니다."}</p>}
              </div>
            </div>
          ) : null}
          <div className="mt-3 max-h-[280px] space-y-2 overflow-auto" onScroll={(event) => onRegistryInventoryScroll(event.currentTarget.scrollTop)}>
            {registryInventoryWindow.topSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: `${registryInventoryWindow.topSpacerHeight}px` }} /> : null}
            {visibleComponentRegistryItems.map((item) => (
              <div className="w-full rounded border border-[var(--kr-gov-border-light)] px-3 py-2 text-left text-sm" key={item.componentId}>
                <button className="w-full text-left hover:bg-gray-50" onClick={() => { setSelectedRegistryComponentId(item.componentId); setReplacementComponentId(item.componentId); }} type="button">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{item.componentId}</span>
                    <div className="flex items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "DEPRECATED" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>{item.status || "ACTIVE"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.sourceType === "SYSTEM" ? "bg-slate-100 text-slate-700" : "bg-sky-100 text-sky-700"}`}>{item.sourceType || "CUSTOM"}</span>
                    </div>
                  </div>
                  <p className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{en ? (item.labelEn || item.label) : item.label}</p>
                  {item.description ? <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p> : null}
                  {item.componentType === "button" ? (
                    <div className="mt-3 space-y-2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <MemberButton size="xs" type="button" variant={resolveButtonVariant(item.propsTemplate?.variant)}>{String(item.propsTemplate?.label || item.label || (en ? "Button" : "버튼"))}</MemberButton>
                        <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] text-[var(--kr-gov-text-secondary)]">variant: {String(item.propsTemplate?.variant || "secondary")}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-[var(--kr-gov-text-primary)]">{en ? "Included URLs" : "포함 URL"}</p>
                        {uniqueUsageUrlsByComponent[item.componentId]?.length ? uniqueUsageUrlsByComponent[item.componentId].slice(0, 4).map((menuUrl) => (
                          <p className="truncate font-mono text-[11px] text-[var(--kr-gov-text-secondary)]" key={`${item.componentId}-${menuUrl}`}>{menuUrl}</p>
                        )) : <p className="text-[11px] text-[var(--kr-gov-text-secondary)]">{en ? "No linked screen URLs yet." : "연결된 화면 URL이 아직 없습니다."}</p>}
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[var(--kr-gov-text-secondary)]">{en ? "Usage screens" : "사용 화면"}: {item.usageCount ?? 0}</p>
                  {item.replacementComponentId ? <p className="mt-1 font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">replacement: {item.replacementComponentId}</p> : null}
                </button>
                <div className="mt-2 flex flex-wrap gap-2">
                  <MemberButton disabled={item.sourceType === "SYSTEM" || item.status === "DEPRECATED"} onClick={() => { void handleDeprecateComponent(item); }} size="xs" type="button" variant="dangerSecondary">{en ? "Deprecate" : "Deprecated 처리"}</MemberButton>
                </div>
              </div>
            ))}
            {registryInventoryWindow.bottomSpacerHeight > 0 ? <div aria-hidden="true" style={{ height: `${registryInventoryWindow.bottomSpacerHeight}px` }} /> : null}
            <p className="rounded border border-dashed border-[var(--kr-gov-border-light)] bg-white px-3 py-4 text-[11px] text-[var(--kr-gov-text-secondary)]">
              {en ? `Virtualized rendering active. Showing ${visibleComponentRegistryItems.length} registry items out of ${filteredComponentRegistry.length} based on scroll position.` : `가상 렌더링 적용 중입니다. 스크롤 위치 기준으로 ${filteredComponentRegistry.length}건 중 ${visibleComponentRegistryItems.length}건만 렌더합니다.`}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
