import type { Dispatch, SetStateAction } from "react";
import type { ScreenBuilderComponentRegistryItem, ScreenBuilderComponentUsage } from "../../../../lib/api/platformTypes";
import { GridToolbar, MemberButton, MemberLinkButton } from "../../../admin-ui/common";
import { buildScreenBuilderPath, buildScreenRuntimePath } from "../../screenBuilderPaths";
import type { VirtualWindow } from "./shared";

type Props = {
  componentRegistry: ScreenBuilderComponentRegistryItem[];
  componentTypeOptions: string[];
  en: boolean;
  handleDeleteRegistryItem: () => Promise<void>;
  handleRemapRegistryUsage: () => Promise<void>;
  handleSaveRegistryItem: () => Promise<void>;
  onRegistryUsageScroll: (scrollTop: number) => void;
  registryEditorDescription: string;
  registryEditorLabel: string;
  registryEditorPropsJson: string;
  registryEditorReplacementId: string;
  registryEditorStatus: string;
  registryEditorType: string;
  registryUsageLoading: boolean;
  registryUsageRows: ScreenBuilderComponentUsage[];
  saving: boolean;
  selectedRegistryInventoryItem: ScreenBuilderComponentRegistryItem | null;
  setRegistryEditorDescription: Dispatch<SetStateAction<string>>;
  setRegistryEditorLabel: Dispatch<SetStateAction<string>>;
  setRegistryEditorPropsJson: Dispatch<SetStateAction<string>>;
  setRegistryEditorReplacementId: Dispatch<SetStateAction<string>>;
  setRegistryEditorStatus: Dispatch<SetStateAction<string>>;
  setRegistryEditorType: Dispatch<SetStateAction<string>>;
  visibleRegistryUsageRows: ScreenBuilderComponentUsage[];
  registryUsageWindow: VirtualWindow;
};

export default function GovernanceRegistryUsageSection(props: Props) {
  const {
    componentRegistry,
    componentTypeOptions,
    en,
    handleDeleteRegistryItem,
    handleRemapRegistryUsage,
    handleSaveRegistryItem,
    onRegistryUsageScroll,
    registryEditorDescription,
    registryEditorLabel,
    registryEditorPropsJson,
    registryEditorReplacementId,
    registryEditorStatus,
    registryEditorType,
    registryUsageLoading,
    registryUsageRows,
    saving,
    selectedRegistryInventoryItem,
    setRegistryEditorDescription,
    setRegistryEditorLabel,
    setRegistryEditorPropsJson,
    setRegistryEditorReplacementId,
    setRegistryEditorStatus,
    setRegistryEditorType,
    visibleRegistryUsageRows,
    registryUsageWindow
  } = props;
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        meta={selectedRegistryInventoryItem ? `${selectedRegistryInventoryItem.componentId} / ${registryUsageRows.length}${en ? " usage rows" : "개 사용처"}` : (en ? "Select a registry component to inspect usage and replace mappings." : "레지스트리 컴포넌트를 선택하면 사용 화면과 대체 매핑을 확인할 수 있습니다.")}
        title={en ? "Registry Component Management" : "레지스트리 컴포넌트 관리"}
      />
      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
          {selectedRegistryInventoryItem ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{selectedRegistryInventoryItem.componentId}</p>
                  <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? (selectedRegistryInventoryItem.labelEn || selectedRegistryInventoryItem.label) : selectedRegistryInventoryItem.label}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${registryEditorStatus === "DEPRECATED" ? "bg-amber-100 text-amber-800" : registryEditorStatus === "INACTIVE" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{registryEditorStatus}</span>
              </div>
              <label className="block"><span className="gov-label">{en ? "Component Type" : "컴포넌트 종류"}</span><select className="gov-select" value={registryEditorType} onChange={(event) => setRegistryEditorType(event.target.value)}>{componentTypeOptions.map((item) => <option key={`registry-editor-type-${item}`} value={item}>{item}</option>)}</select></label>
              <label className="block"><span className="gov-label">{en ? "Label" : "이름"}</span><input className="gov-input" value={registryEditorLabel} onChange={(event) => setRegistryEditorLabel(event.target.value)} /></label>
              <label className="block"><span className="gov-label">{en ? "Description" : "설명"}</span><textarea className="gov-input min-h-[90px] py-3" rows={4} value={registryEditorDescription} onChange={(event) => setRegistryEditorDescription(event.target.value)} /></label>
              <label className="block"><span className="gov-label">{en ? "Status" : "상태"}</span><select className="gov-select" value={registryEditorStatus} onChange={(event) => setRegistryEditorStatus(event.target.value)}><option value="ACTIVE">ACTIVE</option><option value="DEPRECATED">DEPRECATED</option><option value="INACTIVE">INACTIVE</option></select></label>
              <label className="block"><span className="gov-label">{en ? "Replacement Component" : "대체 컴포넌트"}</span><select className="gov-select" value={registryEditorReplacementId} onChange={(event) => setRegistryEditorReplacementId(event.target.value)}><option value="">{en ? "Select component" : "컴포넌트 선택"}</option>{componentRegistry.filter((item) => item.componentId !== selectedRegistryInventoryItem.componentId).map((item) => <option key={`registry-replacement-${item.componentId}`} value={item.componentId}>{item.componentId} / {en ? (item.labelEn || item.label) : item.label}</option>)}</select></label>
              <label className="block"><span className="gov-label">{en ? "Props Template JSON" : "Props 템플릿 JSON"}</span><textarea className="gov-input min-h-[180px] py-3 font-mono text-[12px]" rows={8} value={registryEditorPropsJson} onChange={(event) => setRegistryEditorPropsJson(event.target.value)} /></label>
              <div className="flex flex-wrap gap-2">
                <MemberButton disabled={saving} onClick={() => { void handleSaveRegistryItem(); }} size="xs" type="button" variant="primary">{en ? "Save component" : "컴포넌트 저장"}</MemberButton>
                <MemberButton disabled={saving || !registryEditorReplacementId} onClick={() => { void handleRemapRegistryUsage(); }} size="xs" type="button" variant="secondary">{en ? "Remap usages" : "사용처 재매핑"}</MemberButton>
                <MemberButton disabled={saving || selectedRegistryInventoryItem.sourceType === "SYSTEM"} onClick={() => { void handleDeleteRegistryItem(); }} size="xs" type="button" variant="dangerSecondary">{en ? "Delete if unused" : "미사용 시 삭제"}</MemberButton>
              </div>
            </div>
          ) : <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a registry component from the inventory first." : "먼저 인벤토리에서 레지스트리 컴포넌트를 선택하세요."}</p>}
        </article>
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white">
          <GridToolbar meta={registryUsageLoading ? (en ? "Loading usage..." : "사용 화면을 불러오는 중...") : (en ? `${registryUsageRows.length} usage rows` : `사용 화면 ${registryUsageRows.length}건`)} title={en ? "Screens Using This Component" : "이 컴포넌트를 사용하는 화면"} />
          <div className="overflow-x-auto max-h-[420px]" onScroll={(event) => onRegistryUsageScroll(event.currentTarget.scrollTop)}>
            <table className="w-full text-sm text-left border-collapse">
              <thead><tr className="gov-table-header"><th className="px-4 py-3">{en ? "Source" : "출처"}</th><th className="px-4 py-3">menuCode</th><th className="px-4 py-3">pageId</th><th className="px-4 py-3">{en ? "Title" : "메뉴명"}</th><th className="px-4 py-3">URL</th><th className="px-4 py-3">{en ? "Zone / Node" : "영역 / 노드"}</th><th className="px-4 py-3">{en ? "Open" : "바로가기"}</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {registryUsageRows.length ? (
                  <>
                    {registryUsageWindow.topSpacerHeight > 0 ? <tr aria-hidden="true"><td colSpan={7} style={{ height: `${registryUsageWindow.topSpacerHeight}px`, padding: 0 }} /></tr> : null}
                    {visibleRegistryUsageRows.map((row, index) => (
                      <tr key={`registry-usage-${row.usageSource}-${row.menuCode}-${row.pageId}-${row.nodeId || index}`}>
                        <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.usageSource === "PUBLISHED" ? "bg-blue-100 text-blue-800" : row.usageSource === "DRAFT" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{row.usageSource}</span></td>
                        <td className="px-4 py-3 font-mono text-[12px]">{row.menuCode || "-"}</td>
                        <td className="px-4 py-3">{row.pageId || "-"}</td>
                        <td className="px-4 py-3">{row.menuTitle || "-"}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{row.menuUrl || "-"}</td>
                        <td className="px-4 py-3 text-[12px] text-[var(--kr-gov-text-secondary)]">{row.layoutZone || row.nodeId || row.instanceKey || "-"}</td>
                        <td className="px-4 py-3">
                              {row.menuCode ? (
                            <div className="flex flex-wrap gap-2">
                              <MemberLinkButton href={buildScreenBuilderPath({
                                menuCode: row.menuCode,
                                pageId: row.pageId || "",
                                menuTitle: row.menuTitle || "",
                                menuUrl: row.menuUrl || ""
                              })} variant="secondary">{en ? "Builder" : "빌더"}</MemberLinkButton>
                              {row.usageSource === "PUBLISHED" ? <MemberLinkButton href={buildScreenRuntimePath({
                                menuCode: row.menuCode,
                                pageId: row.pageId || "",
                                menuTitle: row.menuTitle || "",
                                menuUrl: row.menuUrl || ""
                              })} variant="secondary">{en ? "Runtime" : "런타임"}</MemberLinkButton> : null}
                            </div>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                    {registryUsageWindow.bottomSpacerHeight > 0 ? <tr aria-hidden="true"><td colSpan={7} style={{ height: `${registryUsageWindow.bottomSpacerHeight}px`, padding: 0 }} /></tr> : null}
                  </>
                ) : (
                  <tr><td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={7}>{selectedRegistryInventoryItem ? (en ? "No screen currently uses this component." : "현재 이 컴포넌트를 사용하는 화면이 없습니다.") : (en ? "Select a registry component first." : "먼저 레지스트리 컴포넌트를 선택하세요.")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {registryUsageRows.length ? <div className="border-t border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-6 py-3 text-[11px] text-[var(--kr-gov-text-secondary)]">{en ? `Virtualized table active. Showing ${visibleRegistryUsageRows.length} usage rows out of ${registryUsageRows.length}.` : `가상 테이블 적용 중입니다. 사용처 ${registryUsageRows.length}건 중 ${visibleRegistryUsageRows.length}행만 렌더합니다.`}</div> : null}
        </article>
      </div>
    </section>
  );
}
