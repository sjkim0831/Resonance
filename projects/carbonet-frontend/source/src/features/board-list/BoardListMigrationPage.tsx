import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBoardManagementPage } from "../../lib/api/content";
import type { BoardManagementPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";

function readFiltersFromLocation() {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    boardType: search.get("boardType") || "",
    selectedBoardId: search.get("selectedBoardId") || ""
  };
}

function buildBoardAddHref(selectedBoard: Record<string, string> | null) {
  const search = new URLSearchParams();
  const selectedBoardId = stringOf(selectedBoard?.id);
  const linkedPostId = stringOf(selectedBoard?.linkedPostId);
  if (selectedBoardId) {
    search.set("draftId", selectedBoardId);
    search.set("selectedBoardId", selectedBoardId);
  }
  if (linkedPostId) {
    search.set("linkedPostId", linkedPostId);
  }
  const query = search.toString();
  return buildLocalizedPath(
    `/admin/content/board_add${query ? `?${query}` : ""}`,
    `/en/admin/content/board_add${query ? `?${query}` : ""}`
  );
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function textOf(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean).join(", ");
  }
  return stringOf(value);
}

function statusTone(status: string) {
  if (status === "URGENT") return "bg-rose-100 text-rose-700";
  if (status === "READY") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-200 text-slate-700";
}

export function BoardListMigrationPage() {
  const en = isEnglish();
  const initialFilters = readFiltersFromLocation();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState(initialFilters.selectedBoardId);

  const pageState = useAsyncValue<BoardManagementPagePayload>(
    () => fetchBoardManagementPage(),
    [],
    {
      onSuccess(payload) {
        const selectedBoard = (payload.selectedBoard || null) as Record<string, unknown> | null;
        const nextSelectedId = stringOf(selectedBoard?.id);
        if (!selectedId && nextSelectedId) {
          setSelectedId(nextSelectedId);
        }
      }
    }
  );

  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const boardTypeOptions = ((pageState.value?.boardTypeOptions || []) as Array<Record<string, string>>);
  const allRows = ((pageState.value?.boardRows || []) as Array<Record<string, string>>);
  const rows = allRows.filter((row) => {
    const keyword = filters.searchKeyword.trim().toLowerCase();
    const matchesKeyword = !keyword
      || stringOf(row.title).toLowerCase().includes(keyword)
      || stringOf(row.id).toLowerCase().includes(keyword)
      || stringOf(row.lastSavedBy).toLowerCase().includes(keyword);
    const matchesType = !filters.boardType || stringOf(row.boardType) === filters.boardType;
    return matchesKeyword && matchesType;
  });
  const selectedBoard = rows.find((row) => stringOf(row.id) === selectedId) || rows[0] || null;

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.boardType) nextSearch.set("boardType", filters.boardType);
    if (selectedId) nextSearch.set("selectedBoardId", selectedId);
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [filters, selectedId]);

  useEffect(() => {
    logGovernanceScope("PAGE", "board-list", {
      route: window.location.pathname,
      searchKeyword: filters.searchKeyword,
      boardType: filters.boardType,
      rowCount: rows.length,
      selectedBoardId: stringOf(selectedBoard?.id)
    });
  }, [filters.boardType, filters.searchKeyword, rows.length, selectedBoard]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Board Management" : "게시판 관리" }
      ]}
      title={en ? "Board Management" : "게시판 관리"}
      subtitle={en
        ? "Review notice distribution drafts before moving into edit, publish, and downstream post linkage."
        : "공지 배포 초안을 목록에서 먼저 검토한 뒤 수정, 배포, 게시글 연계 흐름으로 이동합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading board rows." : "게시판 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          data-help-id="admin-menu-placeholder-card"
          description={en
            ? "Keep board review separate from the edit form so pinned and urgent notices are compared first."
            : "고정 공지와 긴급 공지를 먼저 비교할 수 있도록 목록 검토와 편집 폼을 분리합니다."}
          icon="dashboard"
          title={en ? "Board Review Rule" : "게시판 운영 기준"}
        >
          {en
            ? "Use this list to compare notice type, urgency, and portal exposure before entering the distribution form."
            : "배포 폼으로 들어가기 전에 공지 유형, 긴급도, 포털 노출 여부를 이 목록에서 먼저 비교합니다."}
        </CollectionResultPanel>

        <section className="gov-card">
          <GridToolbar
            meta={en ? "Search by title, draft ID, or owner." : "제목, 초안 ID, 저장 담당자 기준으로 검색합니다."}
            title={en ? "Filters" : "조회 조건"}
          />
          <form
            className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters(draft);
            }}
          >
            <div className="md:col-span-2">
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="board-search">
                {en ? "Keyword" : "검색어"}
              </label>
              <AdminInput
                id="board-search"
                placeholder={en ? "Title, draft ID, owner" : "제목, 초안 ID, 저장 담당자"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft({ ...draft, searchKeyword: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="board-type">
                {en ? "Board Type" : "게시 유형"}
              </label>
              <AdminSelect
                id="board-type"
                value={draft.boardType}
                onChange={(event) => setDraft({ ...draft, boardType: event.target.value })}
              >
                {boardTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="flex items-end justify-end">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MemberButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const reset = { searchKeyword: "", boardType: "", selectedBoardId: "" };
                    setDraft(reset);
                    setFilters(reset);
                    setSelectedId("");
                  }}
                >
                  {en ? "Reset" : "초기화"}
                </MemberButton>
                <MemberButton type="submit" variant="primary" icon="search">
                  {en ? "Search" : "검색"}
                </MemberButton>
              </div>
            </div>
          </form>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
          <div className="gov-card overflow-hidden p-0">
            <GridToolbar
              meta={en ? `${rows.length} rows matched the current filters.` : `현재 조건에 맞는 초안 ${rows.length}건입니다.`}
              title={en ? "Board Rows" : "게시판 목록"}
            />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-center">ID</th>
                    <th className="px-6 py-4">{en ? "Title" : "제목"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Type" : "유형"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Channels" : "채널"}</th>
                    <th className="px-6 py-4">{en ? "Saved At" : "저장 일시"}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                        {en ? "No board drafts matched the current filters." : "현재 조건에 맞는 게시판 초안이 없습니다."}
                      </td>
                    </tr>
                  ) : rows.map((row) => {
                    const rowId = stringOf(row.id);
                    const selected = rowId === stringOf(selectedBoard?.id);
                    return (
                      <tr
                        key={rowId}
                        className={`cursor-pointer border-b border-[var(--kr-gov-border-light)] ${selected ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(rowId)}
                      >
                        <td className="px-6 py-4 text-center text-sm font-semibold">{rowId}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.title)}</p>
                          <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row.summary)}</p>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">{stringOf(row.boardTypeLabel)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(stringOf(row.status))}`}>
                            {stringOf(row.statusLabel)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">{stringOf(row.channelCount)}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(row.lastSavedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminTable>
            </div>
          </div>

          <aside className="gov-card">
            <MemberSectionToolbar
              title={en ? "Selected Draft" : "선택된 초안"}
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <MemberLinkButton href={buildBoardAddHref(selectedBoard)} variant="primary">
                    {en ? "Open Editor" : "편집 열기"}
                  </MemberLinkButton>
                  <MemberLinkButton
                    href={buildLocalizedPath(
                      `/admin/content/post_list${selectedBoard ? `?selectedPostId=${encodeURIComponent(stringOf(selectedBoard.linkedPostId))}` : ""}`,
                      `/en/admin/content/post_list${selectedBoard ? `?selectedPostId=${encodeURIComponent(stringOf(selectedBoard.linkedPostId))}` : ""}`
                    )}
                    variant="secondary"
                  >
                    {en ? "Open Post List" : "게시글 목록"}
                  </MemberLinkButton>
                </div>
              )}
            />
            {selectedBoard ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[var(--kr-gov-border)] bg-slate-50 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--kr-gov-text-secondary)]">
                        {stringOf(selectedBoard.id)}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedBoard.title)}</h3>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(stringOf(selectedBoard.status))}`}>
                      {stringOf(selectedBoard.statusLabel)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedBoard.summary)}</p>
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--kr-gov-border)] px-4 py-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Audience" : "대상"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedBoard.audienceLabel)}</dd>
                  </div>
                  <div className="rounded-2xl border border-[var(--kr-gov-border)] px-4 py-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Channels" : "채널"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{textOf(selectedBoard.channelLabels)}</dd>
                  </div>
                  <div className="rounded-2xl border border-[var(--kr-gov-border)] px-4 py-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Recipient Estimate" : "예상 수신자"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedBoard.recipientEstimate)}</dd>
                  </div>
                  <div className="rounded-2xl border border-[var(--kr-gov-border)] px-4 py-3">
                    <dt className="text-[var(--kr-gov-text-secondary)]">{en ? "Linked Post" : "연결 게시글"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedBoard.linkedPostId)}</dd>
                  </div>
                </dl>

                <div className="rounded-2xl border border-[var(--kr-gov-border)] px-4 py-4">
                  <h4 className="text-sm font-semibold text-[var(--kr-gov-text-primary)]">{en ? "Body Preview" : "본문 미리보기"}</h4>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedBoard.body)}</p>
                </div>
              </div>
            ) : (
              <PageStatusNotice tone="warning">
                {en ? "Select a board draft to review its details." : "게시판 초안을 선택하면 상세 내용을 확인할 수 있습니다."}
              </PageStatusNotice>
            )}
          </aside>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
