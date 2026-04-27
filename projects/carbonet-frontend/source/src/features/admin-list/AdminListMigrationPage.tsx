import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchAdminListPage } from "../../lib/api/adminMember";
import type { AdminListPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar, PageStatusNotice } from "../member/common";
import { CollectionResultPanel, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MEMBER_BUTTON_LABELS } from "../member/labels";
import { MemberStateCard } from "../member/sections";
import { MemberCountSummary, MemberListEmptyRow, MemberListTopActions } from "../member/toolbar";

function statusLabel(code: string) {
  switch (code) {
    case "P":
      return "활성";
    case "A":
      return "승인 대기";
    case "R":
      return "반려";
    case "D":
      return "삭제";
    case "X":
      return "차단";
    default:
      return code || "-";
  }
}

function statusBadgeClass(code: string) {
  switch (code) {
    case "P":
      return "bg-emerald-100 text-emerald-700";
    case "A":
      return "bg-blue-100 text-blue-700";
    case "R":
      return "bg-amber-100 text-amber-700";
    case "D":
      return "bg-slate-200 text-slate-700";
    case "X":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function AdminListMigrationPage() {
  const [page, setPage] = useState<AdminListPagePayload | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const loading = !page && !error;
  const canView = !!page?.canViewAdminList;
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "admin-list", {
      route: window.location.pathname,
      canView: !!page.canViewAdminList,
      canUseActions: !!page.canUseAdminListActions,
      currentPage,
      totalCount: Number(page.totalCount || 0),
      searchKeyword,
      status
    });
    logGovernanceScope("COMPONENT", "admin-list-table", {
      component: "admin-list-table",
      rowCount: Array.isArray(page.member_list) ? page.member_list.length : 0,
      currentPage,
      totalPages
    });
  }, [currentPage, page, searchKeyword, status, totalPages]);

  async function load(next?: { pageIndex?: number; searchKeyword?: string; sbscrbSttus?: string; }) {
    logGovernanceScope("ACTION", "admin-list-load", {
      pageIndex: next?.pageIndex || 1,
      searchKeyword: next?.searchKeyword || "",
      status: next?.sbscrbSttus || ""
    });
    const payload = await fetchAdminListPage(next);
    setPage(payload);
    setSearchKeyword(String(payload.searchKeyword || next?.searchKeyword || ""));
    setStatus(String(payload.sbscrbSttus || next?.sbscrbSttus || ""));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "관리자" },
        { label: "관리자 회원 목록 조회" }
      ]}
      title="관리자 회원 목록 조회"
      loading={loading}
      loadingLabel="관리자 목록을 불러오는 중입니다."
    >
      {error ? <PageStatusNotice tone="error">조회 중 오류: {error}</PageStatusNotice> : null}
      {!loading && page && !canView ? (
        <MemberStateCard
          description="현재 계정으로는 관리자 회원 목록을 조회할 수 없습니다."
          icon="lock"
          title="권한이 없습니다."
          tone="warning"
        />
      ) : null}
      {canView ? (
        <AdminWorkspacePageFrame>
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard title="전체 관리자" value={Number(page?.totalCount || 0)} description="검색 조건 기준 총 건수" />
          <SummaryMetricCard title="현재 페이지" value={`${currentPage} / ${totalPages}`} description="페이지 네비게이션 상태" />
          <SummaryMetricCard title="상태 필터" value={status ? statusLabel(status) : "전체"} description="현재 적용 상태" />
          <SummaryMetricCard title="검색어" value={searchKeyword || "-"} description="성명, 아이디, 조직ID, 이메일" />
        </section>
        <CollectionResultPanel description="회원 목록 화면과 같은 검색 카드와 결과 테이블 패턴으로 관리자 계정 조회 흐름을 맞춥니다." title="관리자 목록 운영 기준">
          권한 관리와 계정 조회 동선을 같은 위치에 두고, 상태 필터와 검색어를 한 카드 안에서 조합합니다.
        </CollectionResultPanel>
        <section className="gov-card mb-8" data-help-id="admin-list-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    현재 페이지 {currentPage} / {totalPages}
                  </span>
                </div>
              )}
              meta="상태와 검색어를 같은 카드에서 조합해 관리자 계정 목록을 조회합니다."
              title="검색 조건"
            />
          </div>
          <form
            className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              load({ pageIndex: 1, searchKeyword, sbscrbSttus: status }).catch((err: Error) => setError(err.message));
            }}
          >
            <div>
              <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="status">상태</label>
              <AdminSelect id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">전체</option>
                <option value="P">활성</option>
                <option value="A">승인 대기</option>
                <option value="R">반려</option>
                <option value="D">삭제</option>
                <option value="X">차단</option>
              </AdminSelect>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="keyword">검색어</label>
              <div className="flex gap-2">
                <AdminInput
                  className="flex-1"
                  id="keyword"
                  placeholder="성명, 아이디, 조직ID, 이메일 검색"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
                <MemberButton icon="search" type="submit" variant="primary">검색</MemberButton>
              </div>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  회원 목록 화면과 같은 검색 카드, 상단 툴바, 결과 테이블 구조로 관리자 목록을 정렬합니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton
                    onClick={() => {
                      setSearchKeyword("");
                      setStatus("");
                      load({ pageIndex: 1, searchKeyword: "", sbscrbSttus: "" }).catch((err: Error) => setError(err.message));
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
        <div className="gov-card p-0 overflow-hidden" data-help-id="admin-list-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <MemberListTopActions
                  excelHref={`/admin/member/admin_list/excel?searchKeyword=${encodeURIComponent(searchKeyword)}&sbscrbSttus=${encodeURIComponent(status)}`}
                  registerHref={buildLocalizedPath("/admin/member/admin_account", "/en/admin/member/admin_account")}
                  registerLabel="신규 관리자 등록"
                />
              )}
              meta="전체 건수, 엑셀 다운로드, 신규 관리자 등록 동선을 회원 목록 화면과 같은 위치에 둡니다."
              title={<MemberCountSummary totalCount={Number(page?.totalCount || 0)} />}
            />
          </div>
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                    <th className="px-6 py-4 text-center w-16">번호</th>
                    <th className="px-6 py-4">성명 (아이디)</th>
                    <th className="px-6 py-4">조직 ID</th>
                    <th className="px-6 py-4">이메일</th>
                    <th className="px-6 py-4">가입일</th>
                    <th className="px-6 py-4 text-center">상태</th>
                    <th className="px-6 py-4 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(page?.member_list || []).length === 0 ? (
                    <MemberListEmptyRow colSpan={7} message="조회된 관리자 계정이 없습니다." />
                  ) : (page?.member_list || []).map((row, index) => (
                    <tr className="hover:bg-gray-50/50 transition-colors" key={`${String(row.emplyrId || "admin")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{Number(page?.totalCount || 0) - (((Number(page?.pageIndex || 1) - 1) * 10) + index)}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.userNm || "-")}</div>
                        <div className="text-xs text-gray-400">{String(row.emplyrId || "-")}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">{String(row.orgnztId || "-")}</td>
                      <td className="px-6 py-4 text-gray-500">{String(row.emailAdres || "-")}</td>
                      <td className="px-6 py-4 text-gray-500">{String(row.sbscrbDe || "-")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(String(row.emplyrStusCode || ""))}`}>
                          {statusLabel(String(row.emplyrStusCode || ""))}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center space-x-1">
                        <a className="inline-flex px-3 py-1.5 border border-[var(--kr-gov-border-light)] text-[12px] font-bold rounded-[var(--kr-gov-radius)] hover:bg-gray-100" href={buildLocalizedPath(`/admin/member/admin_account/permissions?emplyrId=${encodeURIComponent(String(row.emplyrId || ""))}`, `/en/admin/member/admin_account/permissions?emplyrId=${encodeURIComponent(String(row.emplyrId || ""))}`)}>수정</a>
                        <a className="inline-flex px-3 py-1.5 bg-[var(--kr-gov-blue)] text-white text-[12px] font-bold rounded-[var(--kr-gov-radius)] hover:bg-[var(--kr-gov-blue-hover)]" href={buildLocalizedPath(`/admin/member/admin_account/permissions?emplyrId=${encodeURIComponent(String(row.emplyrId || ""))}&mode=detail`, `/en/admin/member/admin_account/permissions?emplyrId=${encodeURIComponent(String(row.emplyrId || ""))}&mode=detail`)}>상세</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          <MemberPagination currentPage={currentPage} onPageChange={(nextPage) => load({ pageIndex: nextPage, searchKeyword, sbscrbSttus: status }).catch((err: Error) => setError(err.message))} totalPages={totalPages} />
        </div>
        </AdminWorkspacePageFrame>
      ) : null}
    </AdminPageShell>
  );
}
