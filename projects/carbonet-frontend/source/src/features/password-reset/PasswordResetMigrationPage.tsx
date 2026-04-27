import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { PermissionButton } from "../../components/access/CanUse";
import { resetMemberPasswordAction } from "../../lib/api/adminActions";
import { fetchPasswordResetPage } from "../../lib/api/member";
import type { PasswordResetPagePayload } from "../../lib/api/memberTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberPagination } from "../member/common";
import { MemberStateCard } from "../member/sections";

type PasswordResetHistoryRow = {
  resetAt?: string;
  targetUserId?: string;
  targetUserSeLabel?: string;
  resetBy?: string;
  resetIp?: string;
  resetSource?: string;
  detailUrl?: string;
};

function syncPasswordResetQuery(params: {
  memberId: string;
  searchKeyword: string;
  resetSource: string;
  insttId: string;
  pageIndex: number;
}) {
  const search = new URLSearchParams();
  if (params.memberId) search.set("memberId", params.memberId);
  if (params.searchKeyword) search.set("searchKeyword", params.searchKeyword);
  if (params.resetSource) search.set("resetSource", params.resetSource);
  if (params.insttId) search.set("insttId", params.insttId);
  if (params.pageIndex > 1) search.set("pageIndex", String(params.pageIndex));
  const nextUrl = `${window.location.pathname}${search.toString() ? `?${search.toString()}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function getInitialSearchParams() {
  if (typeof window === "undefined") {
    return {
      memberId: "",
      searchKeyword: "",
      resetSource: "",
      pageIndex: 1
    };
  }

  const params = new URLSearchParams(window.location.search);
  const pageIndex = Number.parseInt(params.get("pageIndex") || "1", 10);
  return {
    memberId: params.get("memberId") || "",
    searchKeyword: params.get("searchKeyword") || "",
    resetSource: params.get("resetSource") || "",
    insttId: params.get("insttId") || "",
    pageIndex: Number.isFinite(pageIndex) && pageIndex > 0 ? pageIndex : 1
  };
}

function resolvePageError(page: PasswordResetPagePayload | null) {
  if (!page) {
    return "";
  }
  const candidate = page.passwordResetError || (page.member_resetPasswordError as string | undefined);
  return candidate || "";
}

export function PasswordResetMigrationPage() {
  const initial = getInitialSearchParams();
  const [memberId, setMemberId] = useState(initial.memberId);
  const [searchKeyword, setSearchKeyword] = useState(initial.searchKeyword);
  const [resetSource, setResetSource] = useState(initial.resetSource);
  const [insttId, setInsttId] = useState(initial.insttId);
  const [draftMemberId, setDraftMemberId] = useState(initial.memberId);
  const [draftSearchKeyword, setDraftSearchKeyword] = useState(initial.searchKeyword);
  const [draftResetSource, setDraftResetSource] = useState(initial.resetSource);
  const [draftInsttId, setDraftInsttId] = useState(initial.insttId);
  const [pageIndex, setPageIndex] = useState(initial.pageIndex);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const en = typeof window !== "undefined" && window.location.pathname.startsWith("/en/");

  const sessionState = useFrontendSession();
  const pageState = useAsyncValue(
    () => fetchPasswordResetPage({ memberId, searchKeyword, resetSource, insttId, pageIndex }),
    [memberId, searchKeyword, resetSource, insttId, pageIndex],
    {
      initialValue: null,
      onError: () => undefined
    }
  );

  const page = pageState.value;
  const backendError = resolvePageError(page);
  const error = actionError || backendError || sessionState.error || pageState.error;
  const historyRows = (page?.passwordResetHistoryList as PasswordResetHistoryRow[] | undefined) || [];
  const companyOptions = (page?.companyOptions as Array<Record<string, string>> | undefined) || [];
  const totalCount = Number(page?.totalCount || 0);
  const currentPage = Number(page?.pageIndex || pageIndex || 1);
  const totalPages = Number(page?.totalPages || 1);
  const adminResetCount = historyRows.filter((row) => row.resetSource === "ADMIN_MEMBER_RESET").length;
  const selfServiceCount = historyRows.filter((row) => row.resetSource === "SELF_SERVICE").length;
  const uniqueTargetCount = new Set(historyRows.map((row) => row.targetUserId || "").filter(Boolean)).size;
  const uniqueIpCount = new Set(historyRows.map((row) => row.resetIp || "").filter(Boolean)).size;
  const selectedRow = historyRows.find((row, index) => `${row.targetUserId || "row"}-${index}` === selectedRowKey) || null;

  useEffect(() => {
    if (!page) {
      return;
    }
    const selectedInsttId = String(page.selectedInsttId || insttId || "");
    syncPasswordResetQuery({
      memberId,
      searchKeyword,
      resetSource,
      insttId: selectedInsttId,
      pageIndex: currentPage
    });
    logGovernanceScope("PAGE", "password-reset", {
      route: window.location.pathname,
      actorUserId: sessionState.value?.userId || "",
      actorAuthorCode: sessionState.value?.authorCode || "",
      actorInsttId: sessionState.value?.insttId || "",
      canView: !!page.canViewResetHistory,
      canUseResetPassword: !!page.canUseResetPassword,
      memberId,
      searchKeyword,
      resetSource,
      selectedInsttId
    });
    logGovernanceScope("COMPONENT", "password-reset-history", {
      component: "password-reset-history",
      rowCount: historyRows.length,
      currentPage,
      totalPages
    });
  }, [currentPage, historyRows.length, insttId, memberId, page, resetSource, searchKeyword, sessionState.value, totalPages]);

  useEffect(() => {
    setSelectedRowKey("");
  }, [currentPage, insttId, memberId, resetSource, searchKeyword]);

  async function reload() {
    setActionError("");
    if (!await pageState.reload()) {
      setActionError(en ? "Failed to load password reset history." : "비밀번호 초기화 이력을 불러오지 못했습니다.");
    }
  }

  async function handleReset() {
    const session = sessionState.value;
    if (!session) {
      return;
    }
    logGovernanceScope("ACTION", "password-reset-submit", {
      actorInsttId: session.insttId || "",
      memberId: memberId.trim(),
      resetSource
    });
    if (!memberId.trim()) {
      setActionError(en ? "Enter a member ID to reset the password." : "비밀번호를 초기화할 회원 ID를 입력하세요.");
      return;
    }
    setActionError("");
    setMessage("");
    try {
      const result = await resetMemberPasswordAction(session, memberId.trim());
      setMessage(en
        ? `Temporary password issued: ${result.temporaryPassword}`
        : `임시 비밀번호가 발급되었습니다: ${result.temporaryPassword}`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : (en ? "Password reset failed." : "비밀번호 초기화에 실패했습니다."));
    }
  }

  function handleSearch() {
    logGovernanceScope("ACTION", "password-reset-search", {
      memberId: draftMemberId.trim(),
      searchKeyword: draftSearchKeyword,
      resetSource: draftResetSource,
      insttId: draftInsttId,
      pageIndex: 1
    });
    setActionError("");
    setMessage("");
    setMemberId(draftMemberId);
    setSearchKeyword(draftSearchKeyword);
    setResetSource(draftResetSource);
    setInsttId(draftInsttId);
    setPageIndex(1);
  }

  function movePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) {
      return;
    }
    setPageIndex(nextPage);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: en ? "/en/admin/" : "/admin/" },
        { label: en ? "Member / Permissions" : "회원·권한 관리" },
        { label: en ? "Password Reset History" : "비밀번호 초기화 이력" }
      ]}
      subtitle={en ? "Review administrator-triggered password reset history." : "관리자 비밀번호 초기화 실행 이력을 조회합니다."}
      title={en ? "Password Reset History" : "비밀번호 초기화 이력"}
    >
      <section className="gov-card mb-6 border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))]" data-help-id="password-reset-guidance">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-lg font-bold">{en ? "Reset Control Guidance" : "초기화 운영 가이드"}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Verify company scope, target member ID, and recent reset history before issuing a temporary password. Temporary passwords should be delivered out-of-band."
                : "임시 비밀번호 발급 전 회원사 범위, 대상 회원 ID, 최근 초기화 이력을 확인해야 합니다. 임시 비밀번호는 별도 안전 채널로 전달하는 것이 원칙입니다."}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "Recommended order: filter -> inspect history -> reset -> notify member" : "권장 순서: 조회 필터 -> 이력 확인 -> 초기화 -> 회원 통보"}
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Visible Resets" : "조회 건수"}</p>
          <p className="mt-3 text-3xl font-black text-[var(--kr-gov-blue)]">{totalCount.toLocaleString()}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Current filter result count" : "현재 필터 기준 결과 건수"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Admin / Self" : "관리자 / 사용자"}</p>
          <p className="mt-3 text-3xl font-black text-slate-800">{adminResetCount}<span className="mx-2 text-gray-300">/</span><span className="text-emerald-600">{selfServiceCount}</span></p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Counts on this page" : "현재 페이지 기준 집계"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Members" : "대상 회원"}</p>
          <p className="mt-3 text-3xl font-black text-amber-600">{uniqueTargetCount.toLocaleString()}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Distinct target IDs on this page" : "현재 페이지의 고유 대상 회원 수"}</p>
        </article>
        <article className="gov-card">
          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Source IPs" : "수행 IP"}</p>
          <p className="mt-3 text-3xl font-black text-rose-600">{uniqueIpCount.toLocaleString()}</p>
          <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Distinct reset client IPs" : "중복 제거 수행 IP 수"}</p>
        </article>
      </section>

      {error ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {message ? (
        <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </section>
      ) : null}
      {!pageState.loading && !!page && !page?.canViewResetHistory ? (
        <MemberStateCard description={en ? "You do not have permission to view password reset history." : "현재 계정으로는 비밀번호 초기화 이력을 조회할 수 없습니다."} icon="lock" title={en ? "Permission denied." : "권한이 없습니다."} tone="warning" />
      ) : null}

      <CanView
        allowed={!!page?.canViewResetHistory}
        fallback={null}
      >
        <section className="mb-6 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm" data-help-id="password-reset-search">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {page?.canManageAllCompanies ? (
              <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)]">
                <span className="mb-2 block">회원사</span>
                <select
                  className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                  value={draftInsttId}
                  onChange={(event) => setDraftInsttId(event.target.value)}
                >
                  <option value="">전체 회원사</option>
                  {companyOptions.map((option, index) => {
                    const value = String(option.value || option.insttId || "");
                    const label = String(option.cmpnyNm || option.label || option.insttNm || option.insttName || value);
                    return <option key={`${value}-${index}`} value={value}>{label}</option>;
                  })}
                </select>
              </label>
            ) : null}
            <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <span className="mb-2 block">{en ? "Reset Type" : "유형"}</span>
              <select
                className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                value={draftResetSource}
                onChange={(event) => setDraftResetSource(event.target.value)}
              >
                <option value="">{en ? "All" : "전체"}</option>
                <option value="ADMIN_MEMBER_RESET">{en ? "Admin Reset" : "관리자 초기화"}</option>
                <option value="SELF_SERVICE">{en ? "Self Service" : "사용자 직접 변경"}</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <span className="mb-2 block">{en ? "Member ID" : "회원 ID"}</span>
              <input
                className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                placeholder={en ? "Optional member ID" : "선택 입력"}
                value={draftMemberId}
                onChange={(event) => setDraftMemberId(event.target.value)}
              />
            </label>

            <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] md:col-span-2">
              <span className="mb-2 block">{en ? "Keyword" : "검색어"}</span>
              <input
                className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                placeholder={en ? "Search member ID, actor ID, or IP" : "회원 ID, 수행자 ID, IP 검색"}
                value={draftSearchKeyword}
                onChange={(event) => setDraftSearchKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </label>

            <div className="flex items-end gap-2 md:justify-end">
              <button className="gov-btn gov-btn-primary" type="button" onClick={handleSearch}>
                {en ? "Search" : "검색"}
              </button>
              <button
                className="gov-btn gov-btn-secondary"
                onClick={() => {
                  setMemberId("");
                  setSearchKeyword("");
                  setResetSource("");
                  setInsttId("");
                  setDraftMemberId("");
                  setDraftSearchKeyword("");
                  setDraftResetSource("");
                  setDraftInsttId("");
                  setPageIndex(1);
                  setActionError("");
                  setMessage("");
                }}
                type="button"
              >
                {en ? "Reset" : "초기화"}
              </button>
              <PermissionButton
                allowed={!!page?.canUseResetPassword}
                className="gov-btn gov-btn-outline-blue"
                onClick={handleReset}
                reason={en ? "Company-scoped administrators must enter a target member ID." : "회사 범위 관리자는 대상 회원 ID가 필요합니다."}
                type="button"
              >
                {en ? "Reset Password" : "비밀번호 초기화"}
              </PermissionButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
        <section className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm" data-help-id="password-reset-history">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="gov-table-header">
                  <th className="px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                  <th className="px-6 py-4">{en ? "Reset At" : "초기화 일시"}</th>
                  <th className="px-6 py-4">{en ? "Member ID" : "회원 ID"}</th>
                  <th className="px-6 py-4">{en ? "Member Type" : "회원 구분"}</th>
                  <th className="px-6 py-4">{en ? "Actor" : "수행자"}</th>
                  <th className="px-6 py-4">{en ? "IP" : "IP"}</th>
                  <th className="px-6 py-4">{en ? "Type" : "유형"}</th>
                  <th className="px-6 py-4 text-center">{en ? "Detail" : "상세"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-gray-500" colSpan={8}>
                      {en ? "No password reset history found." : "조회된 비밀번호 초기화 이력이 없습니다."}
                    </td>
                  </tr>
                ) : historyRows.map((row, index) => {
                  const displayNumber = totalCount - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                  const rowKey = `${row.targetUserId || "row"}-${index}`;
                  const highlighted = row.resetSource === "ADMIN_MEMBER_RESET";
                  return (
                    <tr key={rowKey} className={`cursor-pointer ${selectedRowKey === rowKey ? "bg-blue-50" : highlighted ? "bg-amber-50/50 hover:bg-amber-50/70" : "hover:bg-gray-50/50"}`} onClick={() => setSelectedRowKey(rowKey)}>
                      <td className="px-6 py-4 text-center text-gray-500">{displayNumber}</td>
                      <td className="px-6 py-4 text-gray-600">{row.resetAt || "-"}</td>
                      <td className="px-6 py-4 font-semibold">{row.targetUserId || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{row.targetUserSeLabel || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{row.resetBy || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{row.resetIp || "-"}</td>
                      <td className="px-6 py-4 text-gray-600">{row.resetSource || "-"}</td>
                      <td className="px-6 py-4 text-center">
                        {row.detailUrl ? (
                          <a className="inline-flex items-center justify-center rounded border border-[var(--kr-gov-border-light)] px-3 py-1.5 text-xs font-bold hover:bg-gray-50" href={row.detailUrl}>
                            {en ? "View Member" : "회원 보기"}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <MemberPagination currentPage={currentPage} onPageChange={movePage} totalPages={totalPages} />
        </section>
        <aside className="gov-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">{en ? "Reset Detail" : "초기화 상세"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a row to review target member, actor, source IP, and follow-up link together." : "행을 선택하면 대상 회원, 수행자, IP, 후속 이동 링크를 함께 확인합니다."}</p>
            </div>
            {selectedRow ? <button className="text-sm font-bold text-[var(--kr-gov-blue)]" onClick={() => setSelectedRowKey("")} type="button">{en ? "Clear" : "해제"}</button> : null}
          </div>
          {selectedRow ? (
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Reset Type" : "초기화 유형"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${selectedRow.resetSource === "ADMIN_MEMBER_RESET" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {selectedRow.resetSource || "-"}
                  </span>
                  <span className="text-[var(--kr-gov-text-secondary)]">{selectedRow.resetAt || "-"}</span>
                </div>
              </div>
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target Member" : "대상 회원"}</dt>
                  <dd className="mt-1 font-semibold">{selectedRow.targetUserId || "-"}</dd>
                  <dd className="text-xs text-gray-500">{selectedRow.targetUserSeLabel || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Actor" : "수행자"}</dt>
                  <dd className="mt-1">{selectedRow.resetBy || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">IP</dt>
                  <dd className="mt-1 font-mono">{selectedRow.resetIp || "-"}</dd>
                </div>
              </dl>
              {selectedRow.detailUrl || selectedRow.resetIp ? (
                <div className="flex flex-wrap gap-2">
                  {selectedRow.detailUrl ? (
                    <a className="gov-btn gov-btn-outline-blue inline-flex" href={selectedRow.detailUrl}>
                      {en ? "Open Member Detail" : "회원 상세 열기"}
                    </a>
                  ) : null}
                  {selectedRow.resetIp ? (
                    <a className="gov-btn gov-btn-outline-blue inline-flex" href={`${en ? "/en/admin/system/blocklist" : "/admin/system/blocklist"}?searchKeyword=${encodeURIComponent(selectedRow.resetIp)}`}>
                      {en ? "Open Blocklist" : "차단목록 열기"}
                    </a>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                {en ? "Temporary passwords are shown only once. Record delivery action immediately after reset." : "임시 비밀번호는 1회만 노출되므로 초기화 직후 전달 여부를 즉시 기록해야 합니다."}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No reset row selected yet." : "아직 선택된 초기화 이력이 없습니다."}
            </div>
          )}
        </aside>
        </section>
      </CanView>
    </AdminPageShell>
  );
}
