import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBannerManagementPage } from "../../lib/api/content";
import type { BannerManagementPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

const PAGE_SIZE = 10;

function readFiltersFromLocation() {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "",
    placement: search.get("placement") || ""
  };
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusTone(status: string) {
  if (status === "LIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-700";
  if (status === "PAUSED") return "bg-amber-100 text-amber-700";
  return "bg-slate-200 text-slate-700";
}

export function BannerListMigrationPage() {
  const en = isEnglish();
  const initialFilters = readFiltersFromLocation();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const pageState = useAsyncValue<BannerManagementPagePayload>(
    () => fetchBannerManagementPage({ ...filters, selectedBannerId: selectedId }),
    [filters.searchKeyword, filters.status, filters.placement, selectedId],
    {
      onSuccess(payload) {
        const selectedBanner = (payload.selectedBanner || null) as Record<string, unknown> | null;
        const selectedBannerId = stringOf(selectedBanner?.id);
        if (selectedBannerId && selectedBannerId !== selectedId) {
          setSelectedId(selectedBannerId);
        }
      }
    }
  );
  const rows = ((pageState.value?.bannerRows || []) as Array<Record<string, unknown>>);
  const selectedBanner = ((pageState.value?.selectedBanner || null) as Record<string, unknown> | null);
  const placementOptions = ((pageState.value?.placementOptions || []) as Array<Record<string, string>>);
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.status) nextSearch.set("status", filters.status);
    if (filters.placement) nextSearch.set("placement", filters.placement);
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [filters]);

  useEffect(() => {
    if (!pageState.value) {
      return;
    }
    logGovernanceScope("PAGE", "banner-list", {
      route: window.location.pathname,
      totalCount: rows.length,
      currentPage,
      status: filters.status,
      placement: filters.placement,
      searchKeyword: filters.searchKeyword
    });
    logGovernanceScope("COMPONENT", "banner-list-table", {
      component: "banner-list-table",
      rowCount: visibleRows.length,
      selectedBannerId: stringOf(selectedBanner?.id)
    });
  }, [currentPage, filters, pageState.value, rows.length, selectedBanner, visibleRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Banner List" : "배너 목록" }
      ]}
      title={en ? "Banner List" : "배너 목록"}
      subtitle={en
        ? "Review banner exposure, schedule, and priority before opening the edit screen."
        : "배너 노출 상태, 일정, 우선순위를 한 화면에서 검토하고 편집 화면으로 이동합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading banners." : "배너 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-help-id="banner-list-summary">
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
            ? "Banner operations are organized as a list page first so operators can compare schedule collisions and placement priority before editing."
            : "배너 운영은 먼저 목록에서 노출 영역과 일정 충돌을 확인한 뒤 편집으로 들어가도록 정리합니다."}
          icon="view_list"
          title={en ? "Banner Operations Rule" : "배너 운영 기준"}
        >
          {en
            ? "Use status, placement, and keyword filters together, then open Banner Edit for the selected item."
            : "상태, 노출 영역, 검색어를 함께 조합해 대상 배너를 좁힌 뒤 필요한 항목만 배너 편집으로 이동합니다."}
        </CollectionResultPanel>

        <section className="gov-card" data-help-id="banner-list-filters">
          <GridToolbar
            meta={en ? "Search by title, placement, banner ID, or target URL." : "배너명, 노출 영역, 배너 ID, 연결 URL 기준으로 검색합니다."}
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
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="banner-search">
                {en ? "Keyword" : "검색어"}
              </label>
              <AdminInput
                id="banner-search"
                placeholder={en ? "Title, banner ID, URL" : "배너명, 배너 ID, URL"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft({ ...draft, searchKeyword: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="banner-status">
                {en ? "Status" : "상태"}
              </label>
              <AdminSelect
                id="banner-status"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                <option value="">{en ? "All" : "전체"}</option>
                <option value="LIVE">{en ? "Live" : "운영중"}</option>
                <option value="SCHEDULED">{en ? "Scheduled" : "예약"}</option>
                <option value="PAUSED">{en ? "Paused" : "중지"}</option>
                <option value="ENDED">{en ? "Ended" : "종료"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="banner-placement">
                {en ? "Placement" : "노출 영역"}
              </label>
              <AdminSelect
                id="banner-placement"
                value={draft.placement}
                onChange={(event) => setDraft({ ...draft, placement: event.target.value })}
              >
                <option value="">{en ? "All" : "전체"}</option>
                {placementOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "List-page behavior is intentionally separated from Banner Edit so schedule and placement conflicts can be reviewed before a write action."
                    : "목록과 편집을 분리해 저장 전에 일정 중복과 영역 충돌을 먼저 검토하도록 구성했습니다."}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const reset = { searchKeyword: "", status: "", placement: "" };
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
          <div className="gov-card overflow-hidden p-0" data-help-id="banner-list-table">
            <GridToolbar
              meta={en ? `${rows.length} banner rows matched the current filters.` : `현재 조건에 맞는 배너 ${rows.length}건입니다.`}
              title={<span>{en ? "Banner Rows" : "배너 목록"}</span>}
              actions={(
                <a
                  className="inline-flex items-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-4 py-2 text-sm font-bold text-white"
                  href={buildLocalizedPath(`/admin/content/banner_edit${selectedId ? `?bannerId=${encodeURIComponent(selectedId)}` : ""}`, `/en/admin/content/banner_edit${selectedId ? `?bannerId=${encodeURIComponent(selectedId)}` : ""}`)}
                >
                  {en ? "Open Banner Edit" : "배너 편집 열기"}
                </a>
              )}
            />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-5 py-4 text-center">{en ? "No." : "번호"}</th>
                    <th className="px-5 py-4">{en ? "Banner" : "배너명"}</th>
                    <th className="px-5 py-4">{en ? "Placement" : "노출 영역"}</th>
                    <th className="px-5 py-4 text-center">{en ? "Priority" : "우선순위"}</th>
                    <th className="px-5 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-5 py-4">{en ? "Schedule" : "노출 일정"}</th>
                    <th className="px-5 py-4 text-center">{en ? "Actions" : "관리"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {en ? "No banners matched the current filters." : "현재 조건에 맞는 배너가 없습니다."}
                      </td>
                    </tr>
                  ) : visibleRows.map((row, index) => {
                    const selected = stringOf(selectedBanner?.id) === stringOf(row.id);
                    const rowNumber = rows.length - ((currentPage - 1) * PAGE_SIZE + index);
                    return (
                      <tr className={selected ? "bg-blue-50/60" : "hover:bg-gray-50/60"} key={stringOf(row.id)}>
                        <td className="px-5 py-4 text-center text-gray-500">{rowNumber}</td>
                        <td className="px-5 py-4">
                          <button className="text-left" type="button" onClick={() => setSelectedId(stringOf(row.id))}>
                            <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row.title)}</div>
                            <div className="mt-1 text-xs text-gray-400">{stringOf(row.id)}</div>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.placement)}</td>
                        <td className="px-5 py-4 text-center font-semibold text-[var(--kr-gov-text-primary)]">{numberOf(row.priority)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(stringOf(row.status))}`}>
                            {stringOf(row.statusLabel)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
                          <div>{stringOf(row.startAt)}</div>
                          <div className="text-xs text-gray-400">~ {stringOf(row.endAt)}</div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <MemberButton type="button" variant="secondary" onClick={() => setSelectedId(stringOf(row.id))}>
                              {en ? "Preview" : "미리보기"}
                            </MemberButton>
                            <a
                              className="inline-flex items-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-3 py-2 text-xs font-bold text-white"
                              href={buildLocalizedPath(`/admin/content/banner_edit?bannerId=${encodeURIComponent(stringOf(row.id))}`, `/en/admin/content/banner_edit?bannerId=${encodeURIComponent(stringOf(row.id))}`)}
                            >
                              {en ? "Edit" : "편집"}
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminTable>
            </div>
            <MemberPagination currentPage={currentPage} onPageChange={setPage} totalPages={totalPages} />
          </div>

          <section className="space-y-6" data-help-id="banner-list-preview">
            <article className="gov-card">
              <MemberSectionToolbar meta={stringOf(selectedBanner?.id)} title={en ? "Selected Banner" : "선택 배너"} />
              {selectedBanner ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(33,123,214,0.1),rgba(255,255,255,0.98))] p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{stringOf(selectedBanner.placement)}</p>
                    <h3 className="mt-2 text-xl font-black text-[var(--kr-gov-text-primary)]">{stringOf(selectedBanner.title)}</h3>
                    <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedBanner.note)}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <SummaryMetricCard title={en ? "Clicks" : "클릭 수"} value={numberOf(selectedBanner.clickCount)} />
                    <SummaryMetricCard title={en ? "Priority" : "우선순위"} value={numberOf(selectedBanner.priority)} />
                  </div>
                  <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <dt className="font-bold">{en ? "Status" : "상태"}</dt>
                      <dd className="mt-1">{stringOf(selectedBanner.statusLabel)}</dd>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <dt className="font-bold">{en ? "Target URL" : "연결 URL"}</dt>
                      <dd className="mt-1 break-all">{stringOf(selectedBanner.targetUrl)}</dd>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <dt className="font-bold">{en ? "Updated By" : "수정자"}</dt>
                      <dd className="mt-1">{stringOf(selectedBanner.updatedBy)}</dd>
                    </div>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
                      <dt className="font-bold">{en ? "Updated At" : "수정일시"}</dt>
                      <dd className="mt-1">{stringOf(selectedBanner.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <PageStatusNotice tone="warning">{en ? "Select a banner row first." : "배너 행을 먼저 선택하세요."}</PageStatusNotice>
              )}
            </article>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
