import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchPostManagementPage } from "../../lib/api/content";
import type { PostManagementPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

const PAGE_SIZE = 8;

function readFiltersFromLocation() {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    status: search.get("status") || "",
    category: search.get("category") || "",
    selectedPostId: search.get("selectedPostId") || ""
  };
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function statusTone(status: string) {
  if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-700";
  if (status === "REVIEW") return "bg-amber-100 text-amber-700";
  if (status === "DRAFT") return "bg-violet-100 text-violet-700";
  return "bg-slate-200 text-slate-700";
}

export function PostListMigrationPage() {
  const en = isEnglish();
  const initialFilters = readFiltersFromLocation();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(initialFilters.selectedPostId);

  const pageState = useAsyncValue<PostManagementPagePayload>(
    () => fetchPostManagementPage({ ...filters, selectedPostId: selectedId }),
    [filters.searchKeyword, filters.status, filters.category, selectedId],
    {
      onSuccess(payload) {
        const selectedPost = (payload.selectedPost || null) as Record<string, unknown> | null;
        const nextSelectedId = stringOf(selectedPost?.id);
        if (nextSelectedId && nextSelectedId !== selectedId) {
          setSelectedId(nextSelectedId);
        }
      }
    }
  );

  const rows = ((pageState.value?.postRows || []) as Array<Record<string, unknown>>);
  const selectedPost = ((pageState.value?.selectedPost || null) as Record<string, unknown> | null);
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const categoryOptions = ((pageState.value?.categoryOptions || []) as Array<Record<string, string>>);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.status) nextSearch.set("status", filters.status);
    if (filters.category) nextSearch.set("category", filters.category);
    if (selectedId) nextSearch.set("selectedPostId", selectedId);
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
    logGovernanceScope("PAGE", "post-list", {
      route: window.location.pathname,
      totalCount: rows.length,
      currentPage,
      status: filters.status,
      category: filters.category,
      searchKeyword: filters.searchKeyword
    });
    logGovernanceScope("COMPONENT", "post-list-table", {
      component: "post-list-table",
      rowCount: visibleRows.length,
      selectedPostId: stringOf(selectedPost?.id)
    });
  }, [currentPage, filters, pageState.value, rows.length, selectedPost, visibleRows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Post List" : "게시글 목록" }
      ]}
      title={en ? "Post List" : "게시글 목록"}
      subtitle={en
        ? "Review content notices, guides, and policy posts before connecting them to banners, popups, or help surfaces."
        : "공지, 가이드, 정책 게시글을 배너, 팝업, 도움말 노출면에 연결하기 전에 목록에서 먼저 검토합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading posts." : "게시글 목록을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-help-id="post-list-summary">
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
            ? "Keep a list-first workflow so operators can compare publication state, pinning, and downstream linkage before editing content."
            : "저장 전에 게시 상태, 고정 여부, 하위 노출면 연계를 먼저 비교할 수 있도록 목록 우선 운영 흐름으로 구성합니다."}
          icon="article"
          title={en ? "Post Operations Rule" : "게시글 운영 기준"}
        >
          {en
            ? "Use category, publication status, and keyword filters together, then review the selected post summary card before moving to downstream content work."
            : "분류, 게시 상태, 검색어를 함께 조합한 뒤 선택된 게시글 요약 카드를 검토하고 다음 콘텐츠 작업으로 이동합니다."}
        </CollectionResultPanel>

        <section className="gov-card" data-help-id="post-list-filters">
          <GridToolbar
            meta={en ? "Search by title, post ID, author, or content category." : "제목, 게시글 ID, 작성자, 콘텐츠 분류 기준으로 검색합니다."}
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
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="post-search">
                {en ? "Keyword" : "검색어"}
              </label>
              <AdminInput
                id="post-search"
                placeholder={en ? "Title, post ID, author" : "제목, 게시글 ID, 작성자"}
                value={draft.searchKeyword}
                onChange={(event) => setDraft({ ...draft, searchKeyword: event.target.value })}
              />
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="post-status">
                {en ? "Status" : "상태"}
              </label>
              <AdminSelect
                id="post-status"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value })}
              >
                <option value="">{en ? "All" : "전체"}</option>
                <option value="PUBLISHED">{en ? "Published" : "게시"}</option>
                <option value="REVIEW">{en ? "Review" : "검토"}</option>
                <option value="SCHEDULED">{en ? "Scheduled" : "예약"}</option>
                <option value="DRAFT">{en ? "Draft" : "초안"}</option>
                <option value="ARCHIVED">{en ? "Archived" : "보관"}</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="post-category">
                {en ? "Category" : "분류"}
              </label>
              <AdminSelect
                id="post-category"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "This list page is intentionally separate from downstream edit flows so pinned notices and archived records can be checked first."
                    : "고정 공지와 보관 이력을 먼저 확인할 수 있도록 게시글 목록과 하위 편집 흐름을 분리했습니다."}
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const reset = { searchKeyword: "", status: "", category: "", selectedPostId: "" };
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
          <div className="gov-card overflow-hidden p-0" data-help-id="post-list-table">
            <GridToolbar
              meta={en ? `${rows.length} posts matched the current filters.` : `현재 조건에 맞는 게시글 ${rows.length}건입니다.`}
              title={<span>{en ? "Post Rows" : "게시글 목록"}</span>}
            />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-center">ID</th>
                    <th className="px-6 py-4">제목</th>
                    <th className="px-6 py-4 text-center">{en ? "Category" : "분류"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Status" : "상태"}</th>
                    <th className="px-6 py-4 text-center">{en ? "Pinned" : "고정"}</th>
                    <th className="px-6 py-4 text-right">{en ? "Views" : "조회수"}</th>
                    <th className="px-6 py-4">{en ? "Updated" : "수정일"}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={7}>
                        {en ? "No posts matched the current filters." : "현재 조건에 맞는 게시글이 없습니다."}
                      </td>
                    </tr>
                  ) : visibleRows.map((row) => {
                    const rowId = stringOf(row.id);
                    const selected = rowId === stringOf(selectedPost?.id);
                    return (
                      <tr
                        key={rowId}
                        className={`cursor-pointer border-b border-[var(--kr-gov-border-light)] ${selected ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"}`}
                        onClick={() => setSelectedId(rowId)}
                      >
                        <td className="px-6 py-4 text-center text-sm font-semibold">{rowId}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(row.title)}</p>
                          <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row.author)}</p>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">{stringOf(row.categoryLabel)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(stringOf(row.status))}`}>
                            {stringOf(row.statusLabel)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-semibold">{stringOf(row.pinnedLabel)}</td>
                        <td className="px-6 py-4 text-right text-sm">{stringOf(row.viewCount)}</td>
                        <td className="px-6 py-4 text-sm">{stringOf(row.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </AdminTable>
            </div>
            <div className="border-t border-[var(--kr-gov-border-light)] px-6 py-5">
              <MemberPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>

          <section className="space-y-6" data-help-id="post-list-preview">
            <div className="gov-card p-0 overflow-hidden">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <MemberSectionToolbar
                  meta={en ? "Selected post summary and linkage review." : "선택한 게시글 요약 및 연계 검토"}
                  title={en ? "Selected Post" : "선택 게시글"}
                />
              </div>
              <div className="space-y-4 px-6 py-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stringOf(selectedPost?.id) || "-"}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone(stringOf(selectedPost?.status))}`}>
                    {stringOf(selectedPost?.statusLabel) || "-"}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {stringOf(selectedPost?.categoryLabel) || "-"}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">{stringOf(selectedPost?.title) || (en ? "No post selected" : "선택된 게시글이 없습니다.")}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(selectedPost?.summary) || (en ? "Select a row to review the post summary." : "행을 선택하면 게시글 요약을 볼 수 있습니다.")}</p>
                </div>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Author" : "작성자"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedPost?.author) || "-"}</dd>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Pinned" : "고정 여부"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedPost?.pinnedLabel) || "-"}</dd>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Views" : "조회수"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedPost?.viewCount) || "-"}</dd>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Updated At" : "수정일"}</dt>
                    <dd className="mt-1 font-semibold text-[var(--kr-gov-text-primary)]">{stringOf(selectedPost?.updatedAt) || "-"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
