import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { buildLocalizedPath, getNavigationEventName } from "../../lib/navigation/runtime";
import { fetchMemberListPage } from "../../lib/api/adminMember";
import type { MemberListPagePayload } from "../../lib/api/memberTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  MEMBER_STATUS_OPTIONS,
  MEMBER_TYPE_OPTIONS,
  resolveMembershipTypeLabel
} from "../member/shared";
import { resolveMemberStatusBadgeClass, resolveMemberStatusLabel } from "../member/status";
import { AdminInput, AdminSelect, AdminTable, MemberButton, MemberLinkButton, MemberPagination, MemberSectionToolbar } from "../member/common";
import { MEMBER_BUTTON_LABELS, MEMBER_LIST_LABELS } from "../member/labels";
import { MemberCountSummary, MemberListEmptyRow, MemberListTopActions } from "../member/toolbar";
import { MemberStateCard } from "../member/sections";

type SearchFilters = {
  searchKeyword: string;
  membershipType: string;
  status: string;
  pageIndex: number;
};

type MemberListPageVariant = "default" | "withdrawn" | "activate";

const DEFAULT_FILTERS: SearchFilters = {
  searchKeyword: "",
  membershipType: "",
  status: "",
  pageIndex: 1
};

function getDefaultFiltersForVariant(variant: MemberListPageVariant): SearchFilters {
  if (variant === "withdrawn") {
    return { ...DEFAULT_FILTERS, status: "D" };
  }
  if (variant === "activate") {
    return { ...DEFAULT_FILTERS, status: "X" };
  }
  return DEFAULT_FILTERS;
}

function readInitialFilters(variant: MemberListPageVariant): SearchFilters {
  if (typeof window === "undefined") {
    return getDefaultFiltersForVariant(variant);
  }
  const params = new URLSearchParams(window.location.search);
  const defaultFilters = getDefaultFiltersForVariant(variant);
  return {
    searchKeyword: params.get("searchKeyword") || "",
    membershipType: params.get("membershipType") || "",
    status: defaultFilters.status || params.get("sbscrbSttus") || "",
    pageIndex: Number(params.get("pageIndex") || "1") || 1
  };
}

function resolveMemberListPageCopy(variant: MemberListPageVariant) {
  if (variant === "withdrawn") {
    return {
      breadcrumb: "탈퇴 회원",
      title: "탈퇴 회원",
      subtitle: "삭제 상태 회원을 조회하고 상세 이력을 확인합니다."
    };
  }
  if (variant === "activate") {
    return {
      breadcrumb: "휴면 계정",
      title: "휴면 계정",
      subtitle: "비활성 상태 회원을 조회하고 후속 조치 대상 여부를 확인합니다."
    };
  }
  return {
    breadcrumb: "회원 목록 조회",
    title: "회원 목록 조회",
    subtitle: "검색 조건과 가입 상태를 기준으로 기업 회원 신청 현황을 빠르게 확인하고 상세 관리 화면으로 이동합니다."
  };
}

function buildAdminPath(koPath: string, enPath: string, key?: string, value?: string) {
  const params = new URLSearchParams();
  if (key && value) {
    params.set(key, value);
  }
  const query = params.toString();
  return buildLocalizedPath(
    query ? `${koPath}?${query}` : koPath,
    query ? `${enPath}?${query}` : enPath
  );
}

function buildMemberListExcelPath(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.searchKeyword) {
    params.set("searchKeyword", filters.searchKeyword);
  }
  if (filters.membershipType) {
    params.set("membershipType", filters.membershipType);
  }
  if (filters.status) {
    params.set("sbscrbSttus", filters.status);
  }
  const query = params.toString();
  return buildLocalizedPath(
    query ? `/admin/member/list/excel?${query}` : "/admin/member/list/excel",
    query ? `/en/admin/member/list/excel?${query}` : "/en/admin/member/list/excel"
  );
}

function MemberListPageScreen({ variant }: { variant: MemberListPageVariant }) {
  const [filters, setFilters] = useState<SearchFilters>(() => readInitialFilters(variant));
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(() => readInitialFilters(variant));
  const [actionError, setActionError] = useState("");
  const sessionState = useFrontendSession();
  const pageState = useAsyncValue<MemberListPagePayload>(
    () => fetchMemberListPage({
      pageIndex: filters.pageIndex,
      searchKeyword: filters.searchKeyword,
      membershipType: filters.membershipType,
      sbscrbSttus: filters.status
    }),
    [filters.pageIndex, filters.searchKeyword, filters.membershipType, filters.status],
    {
      onSuccess(payload) {
        const variantDefaults = getDefaultFiltersForVariant(variant);
        const nextFilters = {
          searchKeyword: String(payload.searchKeyword || ""),
          membershipType: String(payload.membershipType || ""),
          status: variantDefaults.status || String(payload.sbscrbSttus || ""),
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
  const pageCopy = resolveMemberListPageCopy(variant);
  const canView = !!page?.canViewMemberList;
  const memberTypeOptions = (page?.memberTypeOptions || []).length > 0
    ? (page?.memberTypeOptions || []).map((option) => ({ value: option.code, label: option.label }))
    : MEMBER_TYPE_OPTIONS;
  const memberStatusOptions = (page?.memberStatusOptions || []).length > 0
    ? (page?.memberStatusOptions || []).map((option) => ({ value: option.code, label: option.label }))
    : MEMBER_STATUS_OPTIONS;
  const currentUserInsttId = String(page?.currentUserInsttId || "");
  const companyScopedAccess = !!page?.canManageOwnCompany && !page?.canManageAllCompanies;
  const showAccessDenied = !pageState.loading && !!page && !canView;
  const registerHref = variant === "default"
    ? buildLocalizedPath("/admin/member/register", "/en/admin/member/register")
    : undefined;

  useEffect(() => {
    function syncFiltersFromLocation() {
      const nextFilters = readInitialFilters(variant);
      setActionError("");
      setFilters(nextFilters);
      setDraftFilters(nextFilters);
    }

    const eventName = getNavigationEventName();
    window.addEventListener(eventName, syncFiltersFromLocation);
    window.addEventListener("popstate", syncFiltersFromLocation);
    return () => {
      window.removeEventListener(eventName, syncFiltersFromLocation);
      window.removeEventListener("popstate", syncFiltersFromLocation);
    };
  }, []);

  useEffect(() => {
    if (!page || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "member-list", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      actorMemberType: (sessionState.value.capabilityCodes || []).join(","),
      canManageAllCompanies: !!page.canManageAllCompanies,
      canManageOwnCompany: !!page.canManageOwnCompany,
      pageScopeMode: String(page.memberManagementScopeMode || ""),
      resolvedInsttId: String(page.currentUserInsttId || ""),
      filters: JSON.stringify(filters)
    });
    logGovernanceScope("COMPONENT", "member-list-search-form", {
      component: "member-search-form",
      allowed: !!page.canViewMemberList,
      interaction: page.canViewMemberList ? "ENABLED" : "DISABLED",
      membershipTypes: (page.memberTypeOptions || []).map((item) => item.code).join(","),
      statuses: (page.memberStatusOptions || []).map((item) => item.code).join(",")
    });
    logGovernanceScope("COMPONENT", "member-list-table", {
      component: "member-list-table",
      allowed: !!page.canViewMemberList,
      rowCount: Number(page.totalCount || 0),
      currentPage: Number(page.pageIndex || 1),
      resolvedInsttId: String(page.currentUserInsttId || "")
    });
  }, [filters, page, sessionState.value]);

  function updateDraft<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(nextPageIndex = 1) {
    setActionError("");
    logGovernanceScope("ACTION", "member-list-search", {
      requestedPageIndex: nextPageIndex,
      searchKeyword: draftFilters.searchKeyword,
      membershipType: draftFilters.membershipType,
      status: draftFilters.status,
      resolvedInsttId: String(page?.currentUserInsttId || "")
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

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(1);
  }

  function resetFilters() {
    setActionError("");
    const nextFilters = getDefaultFiltersForVariant(variant);
    logGovernanceScope("ACTION", "member-list-reset", {
      variant,
      resolvedInsttId: String(page?.currentUserInsttId || "")
    });
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "회원" },
        { label: pageCopy.breadcrumb }
      ]}
      subtitle={pageCopy.subtitle}
      title={pageCopy.title}
      loading={pageState.loading && !page && !error}
      loadingLabel="회원 목록을 불러오는 중입니다."
    >
      {error ? <section className="border border-red-200 bg-red-50 rounded-[var(--kr-gov-radius)] px-4 py-3 mb-4"><p className="text-sm text-red-700">조회 중 오류: {error}</p></section> : null}
      {showAccessDenied ? (
        <MemberStateCard
          description="현재 계정으로는 이 회원 관리 화면을 조회할 수 없습니다."
          icon="lock"
          title="권한이 없습니다."
          tone="warning"
        />
      ) : null}
      <CanView allowed={canView} fallback={null}>
        {companyScopedAccess ? (
          <section className="mb-4 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-blue)]">
            본인 회원사 범위로만 조회합니다. {currentUserInsttId ? `기관 ID: ${currentUserInsttId}` : "회원사 정보가 없는 계정은 조회가 제한됩니다."}
          </section>
        ) : null}
        {variant === "withdrawn" ? <div data-help-id="member-withdrawn-search" /> : null}
        {variant === "activate" ? <div data-help-id="member-activate-search" /> : null}
        <div className="gov-card mb-8" data-help-id="member-search-form">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    현재 페이지 {currentPage} / {totalPages}
                  </span>
                </div>
              )}
              meta="회원 유형, 상태, 검색어를 함께 조합해 목록 기준 화면을 동일한 밀도로 유지합니다."
              title="검색 조건"
            />
          </div>
          <form className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4" data-help-id="member-list-search" onSubmit={handleSearchSubmit}>
            <div>
              <span className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">회원 유형</span>
              <AdminSelect id="member-type" value={draftFilters.membershipType} onChange={(event) => updateDraft("membershipType", event.target.value)}>
                {memberTypeOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div>
              <span className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">상태</span>
              <AdminSelect id="status" value={draftFilters.status} onChange={(event) => updateDraft("status", event.target.value)}>
                {memberStatusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>{option.label}</option>
                ))}
              </AdminSelect>
            </div>
            <div className="md:col-span-2">
              <span className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2">검색어</span>
              <div className="flex gap-2">
                <AdminInput className="flex-1" id="keyword" placeholder="신청자명, 아이디, 회사명 검색" value={draftFilters.searchKeyword} onChange={(event) => updateDraft("searchKeyword", event.target.value)} />
              </div>
            </div>
            <div className="md:col-span-4">
              <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                  동일한 목록형 화면은 검색 카드, 상단 툴바, 결과 테이블 순서를 유지합니다.
                </p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <MemberButton onClick={resetFilters} type="button" variant="secondary">
                    {MEMBER_BUTTON_LABELS.reset}
                  </MemberButton>
                  <MemberButton icon="search" type="submit" variant="primary">
                    {MEMBER_BUTTON_LABELS.search}
                  </MemberButton>
                </div>
              </div>
            </div>
          </form>
        </div>

        {variant === "withdrawn" ? <div data-help-id="member-withdrawn-table" /> : null}
        {variant === "activate" ? <div data-help-id="member-activate-table" /> : null}
        <div className="gov-card p-0 overflow-hidden" data-help-id="member-table">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <MemberListTopActions
                  excelHref={buildMemberListExcelPath(filters)}
                  registerHref={registerHref}
                />
              )}
              meta="회원 목록형 화면은 전체 건수, 다운로드, 신규 등록 버튼의 순서와 높이를 동일하게 유지합니다."
              title={<MemberCountSummary totalCount={Number(page?.totalCount || 0)} />}
            />
          </div>
          <div className="overflow-x-auto" data-help-id="member-list-table">
            <AdminTable>
              <thead>
                <tr className="bg-gray-50 border-y border-[var(--kr-gov-border-light)] text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                  <th className="px-6 py-4 text-center w-16">번호</th>
                  <th className="px-6 py-4">성명 (아이디)</th>
                  <th className="px-6 py-4">회원 유형</th>
                  <th className="px-6 py-4">소속 기관</th>
                  <th className="px-6 py-4">가입일</th>
                  <th className="px-6 py-4 text-center">상태</th>
                  <th className="px-6 py-4 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(page?.member_list || []).length === 0 ? (
                  <MemberListEmptyRow colSpan={7} message={MEMBER_LIST_LABELS.emptyMemberList} />
                ) : (page?.member_list || []).map((row, index) => {
                  const memberId = String(row.entrprsmberId || "");
                  const rowNumber = Number(page?.totalCount || 0) - ((currentPage - 1) * 10 + index);
                  return (
                    <tr className="hover:bg-gray-50/50 transition-colors" key={`${memberId || "member"}-${index}`}>
                      <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-[var(--kr-gov-text-primary)]">{String(row.applcntNm || "-")}</div>
                        <div className="text-xs text-gray-400">{memberId || "-"}</div>
                      </td>
                      <td className="px-6 py-4">{resolveMembershipTypeLabel(row.entrprsSeCode)}</td>
                      <td className="px-6 py-4 font-medium text-[var(--kr-gov-text-secondary)]">{String(row.cmpnyNm || "-")}</td>
                      <td className="px-6 py-4 text-gray-500">{String(row.sbscrbDe || "-")}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-full ${resolveMemberStatusBadgeClass(row.entrprsMberSttus)}`}>
                          {resolveMemberStatusLabel(row.entrprsMberSttus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <MemberLinkButton href={buildAdminPath("/admin/member/edit", "/en/admin/member/edit", "memberId", memberId)} size="xs" variant="secondary">
                            {MEMBER_BUTTON_LABELS.edit}
                          </MemberLinkButton>
                          <MemberLinkButton href={buildAdminPath("/admin/member/detail", "/en/admin/member/detail", "memberId", memberId)} size="xs" variant="primary">
                            {MEMBER_BUTTON_LABELS.detail}
                          </MemberLinkButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>

          <MemberPagination currentPage={currentPage} onPageChange={movePage} totalPages={totalPages} />
        </div>
      </CanView>
    </AdminPageShell>
  );
}

export function MemberListMigrationPage() {
  return <MemberListPageScreen variant="default" />;
}

export function WithdrawnMemberListMigrationPage() {
  return <MemberListPageScreen variant="withdrawn" />;
}

export function ActivateMemberListMigrationPage() {
  return <MemberListPageScreen variant="activate" />;
}
