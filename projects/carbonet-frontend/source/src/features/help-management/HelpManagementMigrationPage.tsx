import { useEffect, useMemo, useState } from "react";
import { findManifestByPageId, listPageManifestOptions } from "../../platform/screen-registry/pageManifestIndex";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHelpManagementPage, saveHelpManagementPage } from "../../lib/api/platform";
import type { AuditEventSearchPayload, HelpManagementItem, HelpManagementPagePayload } from "../../lib/api/platformTypes";
import { fetchAuditEvents } from "../../platform/observability/observability";
import { buildLocalizedPath, getSearchParam, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { DiagnosticCard, GridToolbar, MemberButton } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { ScreenCommandCenterPanel } from "./ScreenCommandCenterPanel";

type HelpManagementTab = "help" | "command";

function resolveInitialPageId() {
  if (typeof window === "undefined") {
    return "observability";
  }
  return getSearchParam("pageId") || "observability";
}

function createEmptyItem(displayOrder: number): HelpManagementItem {
  return {
    itemId: `draft-${displayOrder}`,
    title: "",
    body: "",
    anchorSelector: "",
    displayOrder,
    activeYn: "Y",
    placement: "top",
    imageUrl: "",
    iconName: "",
    highlightStyle: "focus",
    ctaLabel: "",
    ctaUrl: ""
  };
}

export function HelpManagementMigrationPage() {
  const en = isEnglish();
  const manifestOptions = useMemo(() => listPageManifestOptions(), []);
  const initialPageId = resolveInitialPageId();
  const [tab, setTab] = useState<HelpManagementTab>("help");
  const [selectedPageId, setSelectedPageId] = useState(initialPageId);
  const selectedManifest = useMemo(() => findManifestByPageId(selectedPageId), [selectedPageId]);
  const [payload, setPayload] = useState<HelpManagementPagePayload | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [helpVersion, setHelpVersion] = useState("v1");
  const [activeYn, setActiveYn] = useState("Y");
  const [items, setItems] = useState<HelpManagementItem[]>([]);
  const [auditPage, setAuditPage] = useState<AuditEventSearchPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(pageId: string) {
    const [next, auditPayload] = await Promise.all([
      fetchHelpManagementPage(pageId),
      fetchAuditEvents({
        pageIndex: 1,
        pageSize: 10,
        pageId: "help-management",
        actionCode: "HELP_CONTENT_SAVE",
        searchKeyword: pageId
      }).catch(() => null)
    ]);
    setPayload(next);
    setAuditPage(auditPayload);
    setTitle(String(next.title || ""));
    setSummary(String(next.summary || ""));
    setHelpVersion(String(next.helpVersion || "v1"));
    setActiveYn(String(next.activeYn || "Y"));
    setItems((next.items || []).map((item, index) => ({
      itemId: String(item.itemId || `draft-${index + 1}`),
      title: String(item.title || ""),
      body: String(item.body || ""),
      anchorSelector: String(item.anchorSelector || ""),
      displayOrder: Number(item.displayOrder || index + 1),
      activeYn: String(item.activeYn || "Y"),
      placement: String(item.placement || "top"),
      imageUrl: String(item.imageUrl || ""),
      iconName: String(item.iconName || ""),
      highlightStyle: String(item.highlightStyle || "focus"),
      ctaLabel: String(item.ctaLabel || ""),
      ctaUrl: String(item.ctaUrl || "")
    })));
  }

  useEffect(() => {
    load(initialPageId).catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!payload) {
      return;
    }
    logGovernanceScope("PAGE", "help-management", {
      route: window.location.pathname,
      tab,
      selectedPageId,
      itemCount: items.length,
      auditRowCount: Number(auditPage?.items?.length || 0)
    });
    logGovernanceScope("COMPONENT", tab === "help" ? "help-management-editor" : "help-management-command", {
      component: tab === "help" ? "help-management-editor" : "help-management-command",
      selectedPageId,
      itemCount: items.length
    });
  }, [auditPage?.items?.length, items.length, payload, selectedPageId, tab]);

  function updateItem(index: number, key: keyof HelpManagementItem, value: string | number) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function addItem() {
    setItems((current) => [...current, createEmptyItem(current.length + 1)]);
  }

  function removeItem(index: number) {
    setItems((current) => current
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item, itemIndex) => ({ ...item, displayOrder: itemIndex + 1 })));
  }

  async function handleLoad() {
    logGovernanceScope("ACTION", "help-management-load", {
      selectedPageId,
      tab
    });
    setError("");
    setMessage("");
    await load(selectedPageId);
  }

  async function handleSave() {
    logGovernanceScope("ACTION", "help-management-save", {
      selectedPageId,
      itemCount: items.length,
      helpVersion,
      activeYn
    });
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const normalizedItems = items
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((item, index) => ({
          ...item,
          displayOrder: index + 1
        }));
      const response = await saveHelpManagementPage({
        pageId: selectedPageId,
        title,
        summary,
        helpVersion,
        activeYn,
        items: normalizedItems
      });
      setMessage(response.message || (en ? "Help content saved." : "도움말을 저장했습니다."));
      await load(selectedPageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to save help content." : "도움말 저장 중 오류가 발생했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Automation Ops" : "운영자동화" },
        { label: en ? "Help Management" : "도움말 운영" }
      ]}
      title={en ? "Help Management" : "화면 도움말 운영"}
      subtitle={en ? "Manage per-page help metadata and publish overlay content immediately." : "페이지별 도움말 title, summary, step, anchor selector와 이미지, 아이콘, 버튼, 강조 스타일을 관리하고 overlay에 즉시 반영합니다."}
    >
      {error ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </section>
      ) : null}
      {message ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </section>
      ) : null}

      <AdminWorkspacePageFrame>
      <DiagnosticCard
        actions={(
          <>
            <MemberButton onClick={() => setTab("help")} type="button" variant={tab === "help" ? "primary" : "secondary"}>
              {en ? "Help Editor" : "도움말 운영"}
            </MemberButton>
            <MemberButton onClick={() => setTab("command")} type="button" variant={tab === "command" ? "primary" : "secondary"}>
              {en ? "Command Guide" : "수정 디렉션"}
            </MemberButton>
          </>
        )}
        description={en ? "Switch between overlay help editing and screen command guidance." : "overlay 도움말 편집과 화면 수정 디렉션 탐색을 한 화면에서 전환합니다."}
        title={en ? "Workspace" : "운영 작업공간"}
      />

      {tab === "help" ? (
        <div className="space-y-6">
          <section className="gov-card" data-help-id="help-management-select">
            <GridToolbar
              actions={(
                <>
                  <MemberButton onClick={handleLoad} type="button" variant="secondary">
                    {en ? "Reload" : "불러오기"}
                  </MemberButton>
                  <MemberButton disabled={saving} onClick={handleSave} type="button" variant="primary">
                    {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Help" : "저장")}
                  </MemberButton>
                </>
              )}
              meta={selectedPageId}
              title={en ? "Target Page" : "대상 화면"}
            />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <label className="block xl:col-span-2">
                <span className="gov-label">pageId</span>
                <select className="gov-select" value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)}>
                  {manifestOptions.map((manifest) => (
                    <option key={manifest.pageId} value={manifest.pageId}>
                      {manifest.pageId} ({manifest.routePath})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Source</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)] break-all">{payload?.source || "-"}</p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Route</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)] break-all">{selectedManifest?.routePath || "-"}</p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Menu Code</p>
                  <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)] break-all">{selectedManifest?.menuCode || "-"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="gov-card" data-help-id="help-management-page-form">
            <GridToolbar meta={en ? "Set default title, summary, and active version for the selected page." : "선택한 페이지의 기본 title, summary, 활성 버전을 설정합니다."} title={en ? "Page Metadata" : "기본 도움말 정보"} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <label className="block">
                <span className="gov-label">Title</span>
                <input className="gov-input" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="block">
                <span className="gov-label">Help Version</span>
                <input className="gov-input" value={helpVersion} onChange={(event) => setHelpVersion(event.target.value)} />
              </label>
              <label className="block">
                <span className="gov-label">Active</span>
                <select className="gov-select" value={activeYn} onChange={(event) => setActiveYn(event.target.value)}>
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </label>
              <label className="block xl:col-span-3">
                <span className="gov-label">Summary</span>
                <textarea className="gov-input min-h-[110px] py-3" rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="gov-card" data-help-id="help-management-items">
            <GridToolbar
              actions={<MemberButton onClick={addItem} type="button" variant="secondary">{en ? "Add Step" : "단계 추가"}</MemberButton>}
              meta={en ? `${items.length} steps configured for the current page.` : `현재 페이지에 ${items.length}개 단계가 설정되어 있습니다.`}
              title={en ? "Help Steps" : "도움말 단계"}
            />

            {items.length === 0 ? (
              <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-gray-50 px-5 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No help steps are registered yet." : "등록된 단계가 없습니다. 단계 추가로 새 도움말을 시작할 수 있습니다."}
              </div>
            ) : null}

            <div className="space-y-5">
              {items.map((item, index) => (
                <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm" key={`${item.itemId}-${index}`}>
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Step {index + 1}</p>
                      <h4 className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{item.title || (en ? "New Help Step" : "새 도움말 단계")}</h4>
                    </div>
                    <button className="gov-btn gov-btn-outline !text-red-600" onClick={() => removeItem(index)} type="button">
                      {en ? "Delete" : "삭제"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
                    <label className="block">
                      <span className="gov-label">Item ID</span>
                      <input className="gov-input" value={item.itemId} onChange={(event) => updateItem(index, "itemId", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">Display Order</span>
                      <input
                        className="gov-input"
                        type="number"
                        value={item.displayOrder}
                        onChange={(event) => updateItem(index, "displayOrder", Number(event.target.value || index + 1))}
                      />
                    </label>
                    <label className="block">
                      <span className="gov-label">Active</span>
                      <select className="gov-select" value={item.activeYn} onChange={(event) => updateItem(index, "activeYn", event.target.value)}>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </label>
                    <label className="block xl:col-span-1">
                      <span className="gov-label">Placement</span>
                      <select className="gov-select" value={item.placement} onChange={(event) => updateItem(index, "placement", event.target.value)}>
                        <option value="top">top</option>
                        <option value="right">right</option>
                        <option value="bottom">bottom</option>
                        <option value="left">left</option>
                      </select>
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="gov-label">Title</span>
                      <input className="gov-input" value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} />
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="gov-label">Anchor Selector</span>
                      <input className="gov-input" value={item.anchorSelector} onChange={(event) => updateItem(index, "anchorSelector", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">Highlight Style</span>
                      <select className="gov-select" value={item.highlightStyle} onChange={(event) => updateItem(index, "highlightStyle", event.target.value)}>
                        <option value="focus">focus</option>
                        <option value="warning">warning</option>
                        <option value="success">success</option>
                        <option value="neutral">neutral</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="gov-label">Icon Name</span>
                      <input className="gov-input" value={item.iconName} onChange={(event) => updateItem(index, "iconName", event.target.value)} />
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="gov-label">Image URL</span>
                      <input className="gov-input" value={item.imageUrl} onChange={(event) => updateItem(index, "imageUrl", event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="gov-label">CTA Label</span>
                      <input className="gov-input" value={item.ctaLabel} onChange={(event) => updateItem(index, "ctaLabel", event.target.value)} />
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="gov-label">CTA URL</span>
                      <input className="gov-input" value={item.ctaUrl} onChange={(event) => updateItem(index, "ctaUrl", event.target.value)} />
                    </label>
                    <label className="block xl:col-span-3">
                      <span className="gov-label">Body</span>
                      <textarea className="gov-input min-h-[140px] py-3" value={item.body} onChange={(event) => updateItem(index, "body", event.target.value)} rows={5} />
                    </label>
                    <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4 xl:col-span-1">
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                        {en ? "Preview" : "미리보기"}
                      </p>
                      <dl className="mt-3 space-y-3 text-sm">
                        <div>
                          <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Placement" : "위치"}</dt>
                          <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{item.placement}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Tone" : "강조 스타일"}</dt>
                          <dd className="mt-1 text-[var(--kr-gov-text-secondary)]">{item.highlightStyle}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-[var(--kr-gov-text-primary)]">CTA</dt>
                          <dd className="mt-1 break-all text-[var(--kr-gov-text-secondary)]">{item.ctaLabel ? `${item.ctaLabel} -> ${item.ctaUrl || "-"}` : "-"}</dd>
                        </div>
                      </dl>
                    </article>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="gov-card">
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Recent Saves" : "최근 저장 이력"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? `Recent help-save audit history for ${selectedPageId}.` : `${selectedPageId} 기준 최근 도움말 저장 이력입니다.`}
                </p>
              </div>
              <div className="text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Total" : "전체"} <span className="font-bold text-[var(--kr-gov-blue)]">{auditPage?.totalCount || 0}</span>{en ? " rows" : "건"}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-5 py-4">createdAt</th>
                    <th className="px-5 py-4">actorId</th>
                    <th className="px-5 py-4">entityId</th>
                    <th className="px-5 py-4">result</th>
                    <th className="px-5 py-4">traceId</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(auditPage?.items || []).length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-gray-500" colSpan={5}>
                        {en ? "No save history." : "저장 이력이 없습니다."}
                      </td>
                    </tr>
                  ) : (auditPage?.items || []).map((item, index) => (
                    <tr key={`${String(item.auditId || "audit")}-${index}`} className="hover:bg-gray-50/60">
                      <td className="px-5 py-4">{String(item.createdAt || "-")}</td>
                      <td className="px-5 py-4 font-bold">{String(item.actorId || "-")}</td>
                      <td className="px-5 py-4">{String(item.entityId || "-")}</td>
                      <td className="px-5 py-4">{String(item.resultStatus || "-")}</td>
                      <td className="px-5 py-4 font-mono text-xs">{String(item.traceId || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <ScreenCommandCenterPanel initialPageId={selectedPageId} />
      )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
