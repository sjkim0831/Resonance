import { buildLocalizedPath } from "../../../../lib/navigation/runtime";
import { GridToolbar, MemberButton, MemberButtonGroup, MemberLinkButton } from "../../../admin-ui/common";
import {
  renderSystemCatalogPreview,
  resolveCatalogTitle
} from "../../shared/screenBuilderShared";
import type { SystemCatalogGroup, SystemCatalogInstance, VirtualWindow } from "./shared";
import type { SystemComponentCatalogType } from "../../catalog/buttonCatalogCore";

type Props = {
  catalogView: "instances" | "styles";
  setCatalogView: (view: "instances" | "styles") => void;
  en: boolean;
  filteredSystemCatalog: SystemCatalogGroup[];
  systemCatalogInstances: SystemCatalogInstance[];
  selectedCatalogType: SystemComponentCatalogType | "ALL" | "";
  copyButtonStyleId: (styleGroupId: string) => Promise<void>;
  copiedButtonStyleId: string;
  onUsageInstanceScroll: (scrollTop: number) => void;
  visibleSystemCatalogInstances: SystemCatalogInstance[];
  usageInstanceWindow: VirtualWindow;
  onGroupedStyleScroll: (scrollTop: number) => void;
  visibleGroupedSystemCatalog: SystemCatalogGroup[];
  groupedStyleWindow: VirtualWindow;
};

export default function GovernanceCatalogSection(props: Props) {
  const {
    catalogView,
    setCatalogView,
    en,
    filteredSystemCatalog,
    systemCatalogInstances,
    selectedCatalogType,
    copyButtonStyleId,
    copiedButtonStyleId,
    onUsageInstanceScroll,
    visibleSystemCatalogInstances,
    usageInstanceWindow,
    onGroupedStyleScroll,
    visibleGroupedSystemCatalog,
    groupedStyleWindow
  } = props;
  if (!filteredSystemCatalog.length) {
    return null;
  }
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        actions={(
          <MemberButtonGroup>
            <MemberButton onClick={() => setCatalogView("instances")} size="xs" type="button" variant={catalogView === "instances" ? "primary" : "secondary"}>
              {en ? "Usage Instances" : "사용 인스턴스"}
            </MemberButton>
            <MemberButton onClick={() => setCatalogView("styles")} size="xs" type="button" variant={catalogView === "styles" ? "primary" : "secondary"}>
              {en ? "Grouped Styles" : "그룹 스타일"}
            </MemberButton>
          </MemberButtonGroup>
        )}
        meta={en
          ? `${filteredSystemCatalog.length} detected styles / ${systemCatalogInstances.length} total component uses across React pages.`
          : `React 화면 기준 감지 스타일 ${filteredSystemCatalog.length}종 / 전체 사용 ${systemCatalogInstances.length}건입니다.`}
        title={resolveCatalogTitle(selectedCatalogType || "button", en)}
      />
      {catalogView === "instances" ? (
        <div className="border-t border-[var(--kr-gov-border-light)]">
          <GridToolbar
            meta={en ? `Every detected component use is listed below first. ${systemCatalogInstances.length} raw source-based instances.` : `아래에 감지된 컴포넌트 사용 인스턴스를 먼저 모두 나열합니다. 원본 기준 ${systemCatalogInstances.length}건입니다.`}
            title={en ? "All Component Usage Instances" : "전체 컴포넌트 사용 인스턴스"}
          />
          <div className="max-h-[520px] overflow-auto" onScroll={(event) => onUsageInstanceScroll(event.currentTarget.scrollTop)}>
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">styleGroupId</th>
                  <th className="px-4 py-3">{en ? "Preview" : "프리뷰"}</th>
                  <th className="px-4 py-3">{en ? "Component" : "컴포넌트"}</th>
                  <th className="px-4 py-3">{en ? "Label" : "라벨"}</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">{en ? "Open" : "열기"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usageInstanceWindow.topSpacerHeight > 0 ? (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: `${usageInstanceWindow.topSpacerHeight}px`, padding: 0 }} />
                  </tr>
                ) : null}
                {visibleSystemCatalogInstances.map((item) => (
                  <tr key={item.key}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{item.styleGroupId}</span>
                        <MemberButton onClick={() => { void copyButtonStyleId(item.styleGroupId); }} size="xs" type="button" variant="secondary">
                          {copiedButtonStyleId === item.styleGroupId ? (en ? "Copied" : "복사됨") : (en ? "Copy" : "복사")}
                        </MemberButton>
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderSystemCatalogPreview(item, en)}</td>
                    <td className="px-4 py-3 text-[12px]">
                      <div className="font-semibold text-[var(--kr-gov-text-primary)]">{item.componentName}</div>
                      <div className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">
                        {item.componentType}
                        {item.variant ? ` / ${item.variant}` : ""}
                        {item.size ? ` / ${item.size}` : ""}
                        {item.className ? ` / class=${item.className}` : ""}
                        {item.icon ? ` / icon=${item.icon}` : ""}
                        {item.placeholder ? ` / placeholder=${item.placeholder}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{item.label || item.placeholder || "-"}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{item.route.koPath}</td>
                    <td className="px-4 py-3">
                      <MemberLinkButton href={buildLocalizedPath(item.route.koPath, item.route.enPath)} size="xs" variant="secondary">
                        {en ? "Open" : "열기"}
                      </MemberLinkButton>
                    </td>
                  </tr>
                ))}
                {usageInstanceWindow.bottomSpacerHeight > 0 ? (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: `${usageInstanceWindow.bottomSpacerHeight}px`, padding: 0 }} />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-6 py-3 text-[11px] text-[var(--kr-gov-text-secondary)]">
            {en
              ? `Virtualized rendering active. Showing ${visibleSystemCatalogInstances.length} rows out of ${systemCatalogInstances.length} based on scroll position.`
              : `가상 렌더링 적용 중입니다. 스크롤 위치 기준으로 ${systemCatalogInstances.length}건 중 ${visibleSystemCatalogInstances.length}행만 렌더합니다.`}
          </div>
        </div>
      ) : null}
      {catalogView === "styles" ? (
        <div className="border-t border-[var(--kr-gov-border-light)]">
          <GridToolbar
            meta={en ? "Grouped styles are summarized below. Same variant with different className, icon, or placeholder is separated." : "아래는 묶어서 본 스타일 요약입니다. 같은 variant여도 className, icon, placeholder가 다르면 별도 스타일로 분리합니다."}
            title={en ? "Grouped Component Styles" : "그룹형 컴포넌트 스타일 요약"}
          />
          <div className="max-h-[720px] overflow-auto p-6" onScroll={(event) => onGroupedStyleScroll(event.currentTarget.scrollTop)}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {groupedStyleWindow.topSpacerHeight > 0 ? <div aria-hidden="true" className="xl:col-span-2" style={{ height: `${groupedStyleWindow.topSpacerHeight}px` }} /> : null}
              {visibleGroupedSystemCatalog.map((item) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={item.key}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{item.componentType}</p>
                      <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{item.componentName}</p>
                      <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">
                        {[item.variant, item.size, item.placeholder].filter(Boolean).join(" / ") || (en ? "base style" : "기본 스타일")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{en ? `${item.instanceCount} uses` : `${item.instanceCount}회 사용`}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{en ? `${item.routeCount} screens` : `${item.routeCount}개 화면`}</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-4">
                    {renderSystemCatalogPreview(item, en)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 font-mono text-indigo-800">{item.styleGroupId}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-700">{item.componentName}</span>
                    {item.className ? <span className="rounded-full bg-amber-50 px-2 py-1 font-mono text-amber-800">class: {item.className}</span> : null}
                    {item.icon ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-mono text-emerald-800">icon: {item.icon}</span> : null}
                    {item.placeholder ? <span className="rounded-full bg-cyan-50 px-2 py-1 font-mono text-cyan-800">placeholder: {item.placeholder}</span> : null}
                  </div>
                  <div className="mt-3">
                    <MemberButton onClick={() => { void copyButtonStyleId(item.styleGroupId); }} size="xs" type="button" variant="secondary">
                      {copiedButtonStyleId === item.styleGroupId ? (en ? "Copied" : "복사됨") : (en ? "Copy styleGroupId" : "styleGroupId 복사")}
                    </MemberButton>
                  </div>
                </article>
              ))}
              {groupedStyleWindow.bottomSpacerHeight > 0 ? <div aria-hidden="true" className="xl:col-span-2" style={{ height: `${groupedStyleWindow.bottomSpacerHeight}px` }} /> : null}
            </div>
          </div>
          <div className="border-t border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-6 py-3 text-[11px] text-[var(--kr-gov-text-secondary)]">
            {en
              ? `Virtualized grid active. Showing ${visibleGroupedSystemCatalog.length} styles out of ${filteredSystemCatalog.length} based on scroll position.`
              : `가상 그리드 적용 중입니다. 스크롤 위치 기준으로 ${filteredSystemCatalog.length}건 중 ${visibleGroupedSystemCatalog.length}개 스타일만 렌더합니다.`}
          </div>
        </div>
      ) : null}
    </section>
  );
}
