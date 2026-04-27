import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { fetchCompanyListPage } from "../../lib/api/adminMember";
import type { CompanyListPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";
import { MEMBER_BUTTON_LABELS, MEMBER_LIST_LABELS } from "../member/labels";
import { resolveMemberStatusBadgeClass, resolveMemberStatusLabel } from "../member/status";
import { MemberCountSummary, MemberListEmptyRow, MemberListTopActions } from "../member/toolbar";
import { MemberStateCard } from "../member/sections";

type SearchFilters = {
  searchKeyword: string;
  status: string;
  pageIndex: number;
};

const DEFAULT_FILTERS: SearchFilters = {
  searchKeyword: "",
  status: "",
  pageIndex: 1
};

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "P", label: "활성" },
  { value: "A", label: "승인 대기" },
  { value: "R", label: "반려" },
  { value: "D", label: "삭제" },
  { value: "X", label: "차단" }
];

export function CompanyListMigrationPage() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [actionError, setActionError] = useState("");
  const pageState = useAsyncValue<CompanyListPagePayload>(
    () => fetchCompanyListPage({
      pageIndex: filters.pageIndex,
      searchKeyword: filters.searchKeyword,
      sbscrbSttus: filters.status
    }),
    [filters.pageIndex, filters.searchKeyword, filters.status],
    {
      onSuccess(payload) {
        const nextFilters = {
          searchKeyword: String(payload.searchKeyword || ""),
          status: String(payload.sbscrbSttus || ""),
          pageIndex: Number(payload.pageIndex || 1)
        };
        setFilters(nextFilters);
        setDraftFilters(nextFilters);
      }
    }
  );
  const page = pageState.value;
  const error = actionError || pageState.error;
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const currentPage = Math.max(1, Number(page?.pageIndex || filters.pageIndex || 1));
  const canView = !!page?.canViewCompanyList;
  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    const keyword = String(filters.searchKeyword || "").trim();
    const status = String(filters.status || "").trim();
    if (keyword) params.set("searchKeyword", keyword);
    if (status) params.set("sbscrbSttus", status);
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [filters.searchKeyword, filters.status]);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "company-list", {
      route: window.location.pathname,
      canView: !!page.canViewCompanyList,
      canUseActions: !!page.canUseCompanyListActions,
      currentPage,
      totalCount: Number(page.totalCount || 0),
      searchKeyword: filters.searchKeyword,
      status: filters.status
    });
    logGovernanceScope("COMPONENT", "company-list-table", {
      component: "company-list-table",
      rowCount: Array.isArray(page.company_list) ? page.company_list.length : 0,
      currentPage,
      totalPages
    });
  }, [currentPage, filters.searchKeyword, filters.status, page, totalPages]);

  function updateDraft<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    setActionError("");
    logGovernanceScope("ACTION", "company-list-search", {
      pageIndex: nextPageIndex,
      searchKeyword: draftFilters.searchKeyword,
      status: draftFilters.status
    });
    setFilters({
      ...draftFilters,
      pageIndex: nextPageIndex
    });
  }

  function movePage(nextPageIndex: number) {
    setActionError("");
    setFilters((current) => ({ ...current, pageIndex: nextPageIndex }));
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(1);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "회원사" },
        { label: "회원사 목록 조회" }
      ]}
      title="회원사 목록 조회"
      loading={pageState.loading && !page && !error}
      loadingLabel="회원사 목록을 불러오는 중입니다."
    >
      {error ? <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">조회 중 오류: {error}</section> : null}
      {!pageState.loading && !!page && !canView ? (
        <MemberStateCard description="현재 계정으로는 회원사 목록을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}
      <CanView allowed={canView} fallback={null}>
        <section className="gov-card mb-8 overflow-hidden p-0" data-help-id="company-list-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    현재 페이지 {currentPage} / {totalPages}
                  </span>
                </div>
              )}
              meta="회원 목록 화면과 같은 검색 카드 구조로 상태와 검색어를 조합해 회원사 목록을 조회합니다."
              title="검색 조건"
            />
          </div>
          <form className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" onSubmit={handleSearchSubmit}>
            <div>
              <span className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">상태</span>
              <AdminSelect value={draftFilters.status} onChange={(e) => updateDraft("status", e.target.value)}>
                {STATUS_OPTIONS.map((option) => <option key={option.value || "all"} value={option.value}>{option.label}</option>)}
              </AdminSelect>
            </div>
            <div className="md:col-span-3">
              <span className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">검색어</span>
              <div className="flex gap-2">
                <AdminInput className="flex-1" placeholder="기관명, 사업자등록번호 검색" value={draftFilters.searchKeyword} onChange={(e) => updateDraft("searchKeyword", e.target.value)} />
              </div>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  동일한 목록형 화면은 검색 카드, 상단 툴바, 결과 테이블 순서를 유지합니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton
                    onClick={() => {
                      setDraftFilters(DEFAULT_FILTERS);
                      setFilters(DEFAULT_FILTERS);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    {MEMBER_BUTTON_LABELS.reset}
                  </MemberButton>
                  <MemberButton icon="search" type="submit" variant="primary">
                    {MEMBER_BUTTON_LABELS.search}
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="gov-card p-0 overflow-hidden" data-help-id="company-list-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <MemberListTopActions
                  excelHref={buildLocalizedPath(`/admin/member/company_list/excel${exportQuery}`, `/en/admin/member/company_list/excel${exportQuery}`)}
                  registerHref={buildLocalizedPath("/admin/member/company_account", "/en/admin/member/company_account")}
                  registerLabel="신규 회원사 등록"
                />
              )}
              meta="전체 건수, 엑셀 다운로드, 신규 회원사 등록 동선을 회원 목록 화면과 같은 위치에 둡니다."
              title={<MemberCountSummary totalCount={Number(page?.totalCount || 0)} />}
            />
          </div>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-6 py-4 text-center w-16">번호</th>
                  <th className="px-6 py-4">기관명</th>
                  <th className="px-6 py-4">사업자등록번호</th>
                  <th className="px-6 py-4">대표자명</th>
                  <th className="px-6 py-4 text-center">상태</th>
                  <th className="px-6 py-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(page?.company_list || []).length === 0 ? (
                  <MemberListEmptyRow colSpan={6} message={MEMBER_LIST_LABELS.emptyCompanyList} />
                ) : (page?.company_list || []).map((row, index) => {
                  const insttId = String(row.insttId || "");
                  const rowNumber = Number(page?.totalCount || 0) - ((currentPage - 1) * 10 + index);
                  return (
                    <tr className="hover:bg-gray-50/50 transition-colors" key={`${insttId || "instt"}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : index + 1}</td>
                      <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">{String(row.cmpnyNm || "-")}</td>
                      <td className="px-6 py-4 text-gray-500">{String(row.bizrno || "-")}</td>
                      <td className="px-6 py-4 text-gray-500">{String(row.cxfc || "-")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${resolveMemberStatusBadgeClass(row.joinStat)}`}>{resolveMemberStatusLabel(row.joinStat)}</span>
                      </td>
                      <td className="px-6 py-4 text-center space-x-1">
                        <MemberLinkButton href={buildLocalizedPath(`/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`, `/en/admin/member/company_account?insttId=${encodeURIComponent(insttId)}`)} size="xs" variant="secondary">
                          {MEMBER_BUTTON_LABELS.edit}
                        </MemberLinkButton>
                        <MemberLinkButton href={buildLocalizedPath(`/admin/member/company_detail?insttId=${encodeURIComponent(insttId)}`, `/en/admin/member/company_detail?insttId=${encodeURIComponent(insttId)}`)} size="xs" variant="primary">
                          {MEMBER_BUTTON_LABELS.detail}
                        </MemberLinkButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
          <div data-help-id="company-list-pagination">
            <MemberPagination currentPage={currentPage} dataHelpId="company-list-pagination" onPageChange={movePage} totalPages={totalPages} />
          </div>
        </section>
      </CanView>
    </AdminPageShell>
  );
}
