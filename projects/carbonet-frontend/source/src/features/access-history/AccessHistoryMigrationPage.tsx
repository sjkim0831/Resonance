import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { fetchAccessHistoryPage } from "../../lib/api/security";
import type { AccessHistoryPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberPagination, MemberSectionToolbar } from "../member/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  insttId: string;
};

const DEFAULT_FILTERS: Filters = {
  pageIndex: 1,
  searchKeyword: "",
  insttId: ""
};

function readInitialFilters(): Filters {
  if (typeof window === "undefined") {
    return DEFAULT_FILTERS;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    pageIndex: Number(params.get("pageIndex") || "1") || 1,
    searchKeyword: params.get("searchKeyword") || "",
    insttId: params.get("insttId") || ""
  };
}

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function statusBadge(status: number) {
  if (status >= 500) {
    return "bg-red-100 text-red-700";
  }
  if (status >= 400) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-emerald-100 text-emerald-700";
}

export function AccessHistoryMigrationPage() {
  const [filters, setFilters] = useState<Filters>(() => readInitialFilters());
  const [draftFilters, setDraftFilters] = useState<Filters>(() => readInitialFilters());
  const pageState = useAsyncValue<AccessHistoryPagePayload>(
    () => fetchAccessHistoryPage(filters),
    [filters.pageIndex, filters.searchKeyword, filters.insttId],
    {
      onSuccess(payload) {
        const next = {
          pageIndex: Number(payload.pageIndex || 1),
          searchKeyword: String(payload.searchKeyword || ""),
          insttId: String(payload.selectedInsttId || "")
        };
        setFilters(next);
        setDraftFilters(next);
      }
    }
  );
  const page = pageState.value;
  const error = pageState.error || String(page?.accessHistoryError || "");
  const totalPages = Math.max(1, Number(page?.totalPages || 1));
  const currentPage = Math.max(1, Number(page?.pageIndex || 1));
  const rows = (page?.accessHistoryList || []) as Array<Record<string, unknown>>;
  const companyOptions = (page?.companyOptions || []) as Array<Record<string, string>>;

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "access-history", {
      route: window.location.pathname,
      canView: !!page.canViewAccessHistory,
      canManageAllCompanies: !!page.canManageAllCompanies,
      selectedInsttId: filters.insttId,
      currentPage,
      totalCount: Number(page.totalCount || 0),
      searchKeyword: filters.searchKeyword
    });
    logGovernanceScope("COMPONENT", "access-history-table", {
      component: "access-history-table",
      rowCount: rows.length,
      companyOptionCount: companyOptions.length
    });
  }, [companyOptions.length, currentPage, filters.insttId, filters.searchKeyword, page, rows.length]);

  function updateDraft<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    logGovernanceScope("ACTION", "access-history-search", {
      pageIndex: nextPageIndex,
      insttId: draftFilters.insttId,
      searchKeyword: draftFilters.searchKeyword
    });
    setFilters({
      ...draftFilters,
      pageIndex: nextPageIndex
    });
  }

  function resetFilters() {
    const next = {
      ...DEFAULT_FILTERS,
      insttId: page?.canManageAllCompanies ? "" : String(page?.selectedInsttId || "")
    };
    setDraftFilters(next);
    setFilters(next);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "시스템" },
        { label: "접속 로그" }
      ]}
      subtitle="회원 목록형 레이아웃을 기준으로 회사별 관리자 접속 이력을 조회합니다."
      title="접속 로그"
      loading={pageState.loading && !page && !error}
      loadingLabel="접속 로그를 불러오는 중입니다."
    >
      {error ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">조회 중 오류: {error}</p>
        </section>
      ) : null}
      <CanView
        allowed={!!page?.canViewAccessHistory}
        fallback={(
          <section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-6 py-8">
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">접속 로그를 조회할 권한이 없습니다.</p>
          </section>
        )}
      >
        <div className="gov-card mb-8" data-help-id="access-history-search">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    현재 페이지 {currentPage} / {totalPages}
                  </span>
                </div>
              )}
              meta="회사와 검색어 기준으로 접속 로그를 빠르게 좁혀서 조회합니다."
              title="검색 조건"
            />
          </div>
          <form className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            applyFilters(1);
          }}>
            <div>
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">회사</span>
              <AdminSelect
                disabled={!page?.canManageAllCompanies}
                id="insttId"
                value={draftFilters.insttId}
                onChange={(event) => updateDraft("insttId", event.target.value)}
              >
                {page?.canManageAllCompanies ? <option value="">전체</option> : null}
                {companyOptions.map((option) => (
                  <option key={String(option.insttId || "")} value={String(option.insttId || "")}>
                    {String(option.cmpnyNm || option.insttId || "-")}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-3">
              <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">검색어</span>
              <AdminInput
                id="searchKeyword"
                placeholder="회사명, 계정 ID, 요청 URI, IP 검색"
                value={draftFilters.searchKeyword}
                onChange={(event) => updateDraft("searchKeyword", event.target.value)}
              />
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  마스터 관리자는 회사별로 조회할 수 있고, 시스템 관리자는 본인 회사 로그만 조회합니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">
                    초기화
                  </MemberButton>
                  <MemberButton icon="search" type="submit" variant="primary">
                    검색
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="gov-card p-0 overflow-hidden" data-help-id="access-history-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              meta="회원 목록형 화면과 동일하게 상단 요약과 결과 테이블 순서를 유지합니다."
              title={(
                <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                  전체 <span className="text-[var(--kr-gov-blue)]">{Number(page?.totalCount || 0).toLocaleString()}</span>건
                </span>
              )}
            />
          </div>
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="w-16 px-6 py-4 text-center">번호</th>
                  <th className="px-6 py-4">접속 일시</th>
                  <th className="px-6 py-4">회사</th>
                  <th className="px-6 py-4">사용자(ID)</th>
                  <th className="px-6 py-4">IP</th>
                  <th className="px-6 py-4">요청</th>
                  <th className="px-6 py-4 text-center">응답</th>
                  <th className="px-6 py-4 text-center">후속 조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={8}>조회된 접속 로그가 없습니다.</td>
                  </tr>
                ) : rows.map((row, index) => {
                  const rowNumber = Number(page?.totalCount || 0) - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                  const status = Number(row.responseStatus || 0);
                  const remoteAddr = stringOf(row, "remoteAddr");
                  return (
                    <tr className="transition-colors hover:bg-gray-50/50" key={`${stringOf(row, "executedAt", "actorUserId", "requestUri")}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : index + 1}</td>
                      <td className="px-6 py-4 text-gray-600">{stringOf(row, "executedAt") || "-"}</td>
                      <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">
                        <div>{stringOf(row, "companyName") || "-"}</div>
                        <div className="text-xs text-gray-400">{stringOf(row, "insttId") || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "actorUserId") || "-"}</div>
                        <div className="text-xs text-gray-400">{stringOf(row, "actorAuthorCode") || "-"}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{stringOf(row, "remoteAddr") || "-"}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-[var(--kr-gov-text-primary)]">{stringOf(row, "requestUri") || "-"}</div>
                        <div className="text-xs text-gray-400">{stringOf(row, "httpMethod")} / {stringOf(row, "featureType")} / {stringOf(row, "durationMs")}ms</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(status)}`}>
                          {status || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {remoteAddr ? (
                          <a
                            className="inline-flex h-9 min-w-[110px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-xs font-bold text-[var(--kr-gov-blue)] transition hover:bg-slate-50"
                            href={`${buildLocalizedPath("/admin/system/blocklist", "/en/admin/system/blocklist")}?searchKeyword=${encodeURIComponent(remoteAddr)}`}
                          >
                            차단목록 열기
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
          <MemberPagination currentPage={currentPage} onPageChange={(pageIndex) => applyFilters(pageIndex)} totalPages={totalPages} />
        </div>
      </CanView>
    </AdminPageShell>
  );
}
