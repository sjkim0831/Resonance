import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchPopupListPage } from "../../lib/api/content";
import type { PopupListPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";

const PAGE_SIZE = 8;
const NEW_POPUP_ID = "POPUP-2026-DRAFT";

function readFiltersFromLocation() {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "",
    targetAudience: search.get("targetAudience") || "",
    selectedPopupId: search.get("selectedPopupId") || ""
  };
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-700";
  if (status === "PAUSED") return "bg-amber-100 text-amber-700";
  if (status === "ENDED") return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-700";
}

export function PopupListMigrationPage() {
  const en = isEnglish();
  const initialFilters = readFiltersFromLocation();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialFilters.selectedPopupId);

  const pageState = useAsyncValue<PopupListPagePayload>(
    () => fetchPopupListPage({ ...filters, selectedPopupId: selectedId }),
    [filters.searchKeyword, filters.status, filters.targetAudience, selectedId],
    {
      onSuccess(payload) {
        const selectedPopup = (payload.selectedPopup || null) as Record<string, unknown> | null;
        const nextSelectedId = stringOf(selectedPopup?.popupId);
        if (nextSelectedId && nextSelectedId !== selectedId) {
          setSelectedId(nextSelectedId);
        }
      }
    }
  );

  const rows = ((pageState.value?.popupRows || []) as Array<Record<string, unknown>>);
  const selectedPopup = ((pageState.value?.selectedPopup || null) as Record<string, unknown> | null);
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const governanceNotes = ((pageState.value?.governanceNotes || []) as Array<Record<string, string>>);
  const statusOptions = ((pageState.value?.statusOptions || []) as Array<Record<string, string>>);
  const targetAudienceOptions = ((pageState.value?.targetAudienceOptions || []) as Array<Record<string, string>>);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedPopupId = stringOf(selectedPopup?.popupId);
  const selectedEditHref = buildLocalizedPath(
    `/admin/content/popup_edit${selectedPopupId ? `?popupId=${encodeURIComponent(selectedPopupId)}` : ""}`,
    `/en/admin/content/popup_edit${selectedPopupId ? `?popupId=${encodeURIComponent(selectedPopupId)}` : ""}`
  );
  const newEditHref = buildLocalizedPath(
    `/admin/content/popup_edit?popupId=${encodeURIComponent(NEW_POPUP_ID)}`,
    `/en/admin/content/popup_edit?popupId=${encodeURIComponent(NEW_POPUP_ID)}`
  );

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.status) nextSearch.set("status", filters.status);
    if (filters.targetAudience) nextSearch.set("targetAudience", filters.targetAudience);
    if (selectedId) nextSearch.set("selectedPopupId", selectedId);
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [filters, selectedId]);

  useEffect(() => {
    if (!pageState.value) {
      return;
    }
    logGovernanceScope("PAGE", "popup-list", {
      route: window.location.pathname,
      totalCount: rows.length,
      currentPage,
      status: filters.status,
      targetAudience: filters.targetAudience,
      searchKeyword: filters.searchKeyword
    });
    logGovernanceScope("COMPONENT", "popup-list-table", {
      component: "popup-list-table",
      rowCount: visibleRows.length,
      selectedPopupId
    });
  }, [currentPage, filters, pageState.value, rows.length, selectedPopupId, visibleRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Popup List" : "팝업 목록" }
      ]}
      title={en ? "Popup List" : "팝업 목록"}
      subtitle={en
        ? "Compare popup schedules, audience scope, and downstream notice linkage before opening the edit screen."
        : "팝업 일정, 대상 범위, 하위 공지 연계를 목록에서 먼저 비교한 뒤 편집 화면으로 이동합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading popups." : "팝업 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-help-id="popup-list-summary">
          {summaryCards.map((card) => (
            <SummaryMetricCard
              key={`${card.title}-${card.value}`}
              title={stringOf(card.title)}
              value={stringOf(card.value)}
              description={stringOf(card.description)}
            />
          ))}
        </section>

        <CollectionResultPanel
          description={en
            ? "Popup operations stay list-first so schedule collisions and audience policy can be reviewed before a write action."
            : "팝업 운영은 저장 전에 일정 충돌과 대상 정책을 먼저 검토할 수 있도록 목록 우선 흐름으로 유지합니다."}
          icon="web_asset"
          title={en ? "Popup Operations Rule" : "팝업 운영 기준"}
        >
          {en
            ? "Filter by status, audience, and keyword together, then open the selected popup schedule only after checking linkage and overlap."
            : "상태, 대상, 검색어를 함께 조합하고 연계 공지와 중복 노출 여부를 확인한 뒤 선택된 팝업 스케줄을 엽니다."}
        </CollectionResultPanel>

        <section className="gov-card" data-help-id="popup-list-filters">
          <GridToolbar
            meta={en ? "Search by popup ID, title, headline, owner, or target audience." : "팝업 ID, 제목, 헤드라인, 담당자, 대상 사용자 기준으로 검색합니다."}
            title={en ? "Filters" : "조회 조건"}
          />
          <form
            className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters(draft);
              setPage(1);
            }}
          >
            <div className="md:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="popup-search">
                {en ? "Keyword" : "검색어"}
              </label>
              <AdminInput
                id="popup-search"
                placeholder={en ? "Popup ID, title, headline, owner" : "팝업 ID, 제목, 헤드라인, 담당자"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft({ ...draft, searchKeyword: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="popup-status">
                {en ? "Status" : "상태"}
              </label>
              <AdminSelect
                id="popup-status"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                {statusOptions.map((option) => (
                  <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="popup-audience">
                {en ? "Audience" : "대상 사용자"}
              </label>
              <AdminSelect
                id="popup-audience"
                value={draft.targetAudience}
                onChange={(event) => setDraft({ ...draft, targetAudience: event.target.value })}
              >
                {targetAudienceOptions.map((option) => (
                  <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This list page stays separate from popup editing so operators can compare live, scheduled, and paused windows before saving."
                    : "팝업 목록과 편집을 분리해 저장 전에 노출중, 예약, 일시중지 팝업의 기간과 대상을 먼저 비교하도록 구성했습니다."}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const reset = { searchKeyword: "", status: "", targetAudience: "", selectedPopupId: "" };
                      setDraft(reset);
                      setFilters(reset);
                      setSelectedId("");
                      setPage(1);
                    }}
                  >
                    {en ? "Reset" : "초기화"}
                  </MemberButton>
                  <MemberButton type="submit" variant="primary" icon="search">
                    {en ? "Search" : "검색"}
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
          <div className="gov-card overflow-hidden p-0" data-help-id="popup-list-table">
            <GridToolbar
              meta={en ? `${rows.length} popups matched the current filters.` : `현재 조건에 맞는 팝업 ${rows.length}건입니다.`}
              title={<span>{en ? "Popup Rows" : "팝업 목록"}</span>}
            />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-center">ID</th>
                    <th className="px-6 py-4">{en ? "Title" : "제목"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Type" : "유형"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Audience" : "대상"}</th>
                    <th className="px-6 py-4">{en ? "Window" : "노출 기간"}</th>
                    <th className="px-6 py-4">{en ? "Updated" : "수정일"}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {en ? "No popups matched the current filters." : "현재 조건에 맞는 팝업이 없습니다."}
                      </td>
                    </tr>
                  ) : visibleRows.map((row) => {
                    const rowId = stringOf(row.popupId);
                    const selected = rowId === selectedPopupId;
                    return (
                      <tr
                        key={rowId}
                        className={`cursor-pointer border-b border-[var(--kr-gov-border-light)] ${selected ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(rowId)}
                      >
                        <td className="px-6 py-4 text-center text-sm font-semibold">{rowId}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.popupTitle)}</p>
                          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)] line-clamp-2">{stringOf(row.headline)}</p>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">{stringOf(row.popupTypeLabel)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(stringOf(row.exposureStatus))}`}>
                            {stringOf(row.exposureStatusLabel)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">{stringOf(row.targetAudienceLabel)}</td>
                        <td className="px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.scheduleWindow)}</td>
                        <td className="px-6 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminTable>
            </div>
            <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-4">
              <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>

          <div className="space-y-6" data-help-id="popup-list-preview">
            <section className="gov-card">
              <MemberSectionToolbar
                actions={(
                  <div className="flex flex-wrap gap-2">
                    <MemberLinkButton href={newEditHref} variant="primary">
                      {en ? "New Popup" : "팝업 등록"}
                    </MemberLinkButton>
                    {selectedPopupId ? (
                      <MemberLinkButton href={selectedEditHref} variant="secondary">
                        {en ? "Open Schedule" : "스케줄 열기"}
                      </MemberLinkButton>
                    ) : null}
                  </div>
                )}
                title={en ? "Selected Popup" : "선택 팝업"}
              />
              {selectedPopup ? (
                <div className="space-y-5 px-6 pb-6">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{stringOf(selectedPopup.popupId)}</p>
                        <h3 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.popupTitle)}</h3>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(stringOf(selectedPopup.exposureStatus))}`}>
                        {stringOf(selectedPopup.exposureStatusLabel)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedPopup.headline)}</p>
                  </div>

                  <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Audience" : "대상"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.targetAudienceLabel)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Priority" : "우선순위"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.priorityLabel)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Display Scope" : "노출 범위"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.displayScopeLabel)}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "담당자"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.ownerName)} / {stringOf(selectedPopup.ownerContact)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Window" : "노출 기간"}</dt>
                      <dd className="mt-1 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.scheduleWindow)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Notes" : "운영 메모"}</dt>
                      <dd className="mt-1 whitespace-pre-wrap leading-6 text-[var(--kr-gov-text-primary)]">{stringOf(selectedPopup.notes) || "-"}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="px-6 pb-6 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Select a popup row to review schedule and linkage details." : "팝업 행을 선택하면 일정과 연계 상세를 검토할 수 있습니다."}
                </div>
              )}
            </section>

            <section className="gov-card">
              <MemberSectionToolbar title={en ? "Governance Notes" : "운영 점검 메모"} />
              <div className="space-y-4 px-6 pb-6">
                {governanceNotes.map((note, index) => (
                  <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4" key={`${note.title}-${index}`}>
                    <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(note.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(note.description)}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
