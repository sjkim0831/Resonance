import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { saveSecurityHistoryAction } from "../../lib/api/security";
import type { LoginHistoryPagePayload } from "../../lib/api/securityTypes";
import { stringOf } from "../admin-system/adminSystemShared";
import { GridToolbar, LookupContextStrip, MemberButton, MemberLinkButton, MemberPagination, PageStatusNotice } from "../member/common";
import { SummaryMetricCard } from "../admin-ui/common";

type Filters = {
  pageIndex: number;
  searchKeyword: string;
  userSe: string;
  loginResult: string;
  insttId: string;
  actionStatus: string;
};

type Props = {
  titleKo: string;
  titleEn: string;
  subtitleKo: string;
  subtitleEn: string;
  breadcrumbsKo: string[];
  breadcrumbsEn: string[];
  fetchPage: (params: Filters) => Promise<LoginHistoryPagePayload>;
  fixedLoginResult?: string;
  variant?: "login" | "blocked";
  routeScope?: "system" | "member";
};

type SecurityHistoryCloseoutRow = {
  labelKo: string;
  labelEn: string;
  stateKo: string;
  stateEn: string;
  tone: "ready" | "blocked";
  notesKo: string;
  notesEn: string;
};

const SECURITY_HISTORY_CLOSEOUT_ROWS: SecurityHistoryCloseoutRow[] = [
  {
    labelKo: "공유 차단 이력 콘솔",
    labelEn: "Shared blocked-history console",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "시스템/회원 차단 이력은 같은 표준 컴포넌트를 사용하되 route, breadcrumb, payload API로 범위를 구분합니다.",
    notesEn: "System and member block-history routes share the governed component while route, breadcrumb, and payload API define the scope."
  },
  {
    labelKo: "차단 이력 조회/필터",
    labelEn: "Blocked-history query and filters",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "loginResult=FAIL 기준으로 회원사, 사용자 구분, 조치 상태, 키워드, 페이지 조건을 조회합니다.",
    notesEn: "Queries loginResult=FAIL rows by company, user type, action status, keyword, and page."
  },
  {
    labelKo: "상세 컨텍스트와 연계 이동",
    labelEn: "Detail context and linked navigation",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "동일 IP/사용자/회원사 건수, 메시지, 모니터링/정책/차단목록/회원사 링크를 제공합니다.",
    notesEn: "Shows same-IP/user/company counts, message context, and links to monitoring, policy, blocklist, and company pages."
  },
  {
    labelKo: "운영 조치 기록",
    labelEn: "Operator action recording",
    stateKo: "가능",
    stateEn: "Available",
    tone: "ready",
    notesKo: "메모 저장, 차단 해제 요청 기록, 예외 요청 기록, IP 차단 승격을 보안 조치 이력으로 저장합니다.",
    notesEn: "Records note save, unblock request, exception request, and IP block escalation in security action history."
  },
  {
    labelKo: "실제 계정 해제/예외 적용",
    labelEn: "Actual unblock and exception enforcement",
    stateKo: "차단",
    stateEn: "Blocked",
    tone: "blocked",
    notesKo: "현재 해제/예외는 요청 기록이며 계정 잠금, 세션, 정책 예외를 실제 변경하는 실행 API는 별도 필요합니다.",
    notesEn: "Unblock and exception actions currently record requests; enforcement APIs for account locks, sessions, and policy exceptions are still needed."
  },
  {
    labelKo: "케이스 관리 / 감사 export",
    labelEn: "Case management / audit export",
    stateKo: "차단",
    stateEn: "Blocked",
    tone: "blocked",
    notesKo: "인시던트 케이스 연결, 승인 흐름, 감사 증적 조회와 내보내기 계약이 필요합니다.",
    notesEn: "Incident case linkage, approval flow, and audit evidence query/export contracts are still needed."
  }
];

const SECURITY_HISTORY_ACTION_CONTRACT = [
  { labelKo: "실제 계정 잠금 해제", labelEn: "Enforce Account Unblock" },
  { labelKo: "정책 예외 적용", labelEn: "Apply Policy Exception" },
  { labelKo: "인시던트 케이스 생성", labelEn: "Create Incident Case" },
  { labelKo: "감사 증적 내보내기", labelEn: "Export Audit Evidence" }
];

function resultBadge(result: string) {
  return result === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
}

function actionBadgeMeta(action: string, en: boolean) {
  switch (action) {
    case "SAVE_NOTE":
      return {
        className: "bg-slate-100 text-slate-700",
        label: en ? "Note Saved" : "메모 저장"
      };
    case "UNBLOCK_USER":
      return {
        className: "bg-emerald-100 text-emerald-700",
        label: en ? "Unblock Logged" : "해제 기록"
      };
    case "REGISTER_EXCEPTION":
      return {
        className: "bg-blue-100 text-blue-700",
        label: en ? "Exception" : "예외 등록"
      };
    case "ESCALATE_BLOCK_IP":
      return {
        className: "bg-amber-100 text-amber-700",
        label: en ? "IP Escalated" : "IP 차단 승격"
      };
    default:
      return {
        className: "bg-slate-100 text-slate-500",
        label: en ? "No Action" : "미조치"
      };
  }
}

function userSeLabel(value: string, en: boolean) {
  switch (value) {
    case "USR":
      return en ? "Admin" : "관리자";
    case "ENT":
      return en ? "Enterprise" : "기업회원";
    case "GNR":
      return en ? "General" : "일반회원";
    default:
      return value || (en ? "Other" : "기타");
  }
}

function syncLoginHistoryQuery(filters: Filters, fixedLoginResult?: string) {
  const search = new URLSearchParams();
  if (filters.pageIndex > 1) search.set("pageIndex", String(filters.pageIndex));
  if (filters.searchKeyword) search.set("searchKeyword", filters.searchKeyword);
  if (filters.userSe) search.set("userSe", filters.userSe);
  if (!fixedLoginResult && filters.loginResult) search.set("loginResult", filters.loginResult);
  if (filters.insttId) search.set("insttId", filters.insttId);
  if (filters.actionStatus) search.set("actionStatus", filters.actionStatus);
  const nextUrl = `${window.location.pathname}${search.toString() ? `?${search.toString()}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

export function LoginHistorySharedPage(props: Props) {
  const en = isEnglish();
  const blockedMode = props.variant === "blocked";
  const systemBlockedMode = blockedMode && props.routeScope === "system";
  const initial = useMemo<Filters>(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      pageIndex: Number(search.get("pageIndex") || "1") || 1,
      searchKeyword: search.get("searchKeyword") || "",
      userSe: search.get("userSe") || "",
      loginResult: props.fixedLoginResult || search.get("loginResult") || "",
      insttId: search.get("insttId") || "",
      actionStatus: search.get("actionStatus") || ""
    };
  }, [props.fixedLoginResult]);
  const [filters, setFilters] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [selectedRowKey, setSelectedRowKey] = useState<string>("");
  const [operatorNotes, setOperatorNotes] = useState<Record<string, string>>({});
  const [actionNote, setActionNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const pageState = useAsyncValue<LoginHistoryPagePayload>(() => props.fetchPage(filters), [filters.pageIndex, filters.searchKeyword, filters.userSe, filters.loginResult, filters.insttId], {
    onSuccess(payload) {
      const next = {
        pageIndex: Number(payload.pageIndex || 1),
        searchKeyword: String(payload.searchKeyword || ""),
        userSe: String(payload.userSe || ""),
        loginResult: props.fixedLoginResult || String(payload.loginResult || ""),
        insttId: String(payload.selectedInsttId || ""),
        actionStatus: filters.actionStatus
      };
      setDraft(next);
      syncLoginHistoryQuery(next, props.fixedLoginResult);
    }
  });
  const page = pageState.value;
  const rows = (page?.loginHistoryList || []) as Array<Record<string, unknown>>;
  const securityHistoryActionRows = (page?.securityHistoryActionRows || []) as Array<Record<string, string>>;
  const securityActionByHistoryKey = (page?.securityHistoryActionByHistoryKey || {}) as Record<string, Record<string, string>>;
  const relatedCountByHistoryKey = (page?.securityHistoryRelatedCountByHistoryKey || {}) as Record<string, Record<string, number>>;
  const aggregate = (page?.securityHistoryAggregate || {}) as Record<string, unknown>;
  const filteredRows = rows;
  const companyOptions = (page?.companyOptions || []) as Array<Record<string, string>>;
  const totalPages = Number(page?.totalPages || 1);
  const currentPage = Number(page?.pageIndex || 1);
  const totalCount = Number(page?.totalCount || 0);
  const successCount = filteredRows.filter((item) => stringOf(item, "loginResult") === "SUCCESS").length;
  const failCount = filteredRows.filter((item) => stringOf(item, "loginResult") === "FAIL").length;
  const uniqueIpCount = Number(aggregate.uniqueIpCount || 0);
  const uniqueUserCount = Number(aggregate.uniqueUserCount || 0);
  const userSeSummary = (aggregate.userSeSummary || {}) as Record<string, number>;
  const selectedRow = filteredRows.find((item, index) => `${stringOf(item, "histId", "userId")}-${index}` === selectedRowKey)
    || rows.find((item, index) => `${stringOf(item, "histId", "userId")}-${index}` === selectedRowKey)
    || null;
  const selectedRowCompany = selectedRow ? stringOf(selectedRow, "companyName") : "";
  const selectedHistoryKey = selectedRow
    ? (stringOf(selectedRow, "histId") || `${stringOf(selectedRow, "userId")}|${stringOf(selectedRow, "loginIp")}|${stringOf(selectedRow, "loginPnttm")}`)
    : "";
  const selectedIp = selectedRow ? stringOf(selectedRow, "loginIp") : "";
  const selectedUserId = selectedRow ? stringOf(selectedRow, "userId") : "";
  const selectedInsttId = selectedRow ? stringOf(selectedRow, "insttId") : "";
  const relatedCounts = selectedHistoryKey ? relatedCountByHistoryKey[selectedHistoryKey] || {} : {};
  const sameIpCount = Number(relatedCounts.sameIpCount || 0);
  const sameUserCount = Number(relatedCounts.sameUserCount || 0);
  const sameCompanyCount = Number(relatedCounts.sameCompanyCount || 0);
  const selectedNote = selectedRow ? stringOf(selectedRow, "loginMessage") : "";
  const selectedSavedAction = selectedHistoryKey ? securityActionByHistoryKey[selectedHistoryKey] || null : null;
  const selectedActionTimeline = selectedHistoryKey
    ? securityHistoryActionRows.filter((row) => stringOf(row, "historyKey") === selectedHistoryKey).slice(0, 8)
    : [];
  const monitoringHref = selectedIp
    ? `${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?ip=${encodeURIComponent(selectedIp)}`
    : buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring");
  const policyHref = selectedUserId
    ? `${buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy")}?searchKeyword=${encodeURIComponent(selectedUserId)}`
    : buildLocalizedPath("/admin/system/security-policy", "/en/admin/system/security-policy");
  const blocklistHref = selectedIp
    ? `${buildLocalizedPath("/admin/system/blocklist", "/en/admin/system/blocklist")}?searchKeyword=${encodeURIComponent(selectedIp)}`
    : buildLocalizedPath("/admin/system/blocklist", "/en/admin/system/blocklist");
  const companyDetailHref = selectedInsttId
    ? buildLocalizedPath(`/admin/member/company_detail?insttId=${encodeURIComponent(selectedInsttId)}`, `/en/admin/member/company_detail?insttId=${encodeURIComponent(selectedInsttId)}`)
    : "";
  const activeFilterCount = [filters.searchKeyword, filters.userSe, filters.insttId, !props.fixedLoginResult ? filters.loginResult : "", filters.actionStatus].filter(Boolean).length;
  const contextLabel = blockedMode
    ? (en ? "Block Review Context" : "차단 검토 컨텍스트")
    : (en ? "Login History Context" : "로그인 이력 컨텍스트");
  const contextValue = blockedMode
    ? (en
      ? `Showing blocked access rows${filters.insttId ? ` for company ${filters.insttId}` : ""}${filters.userSe ? ` · ${userSeLabel(filters.userSe, en)}` : ""}.`
      : `차단 접근 이력을 조회 중입니다.${filters.insttId ? ` 회원사 ${filters.insttId}` : ""}${filters.userSe ? ` · ${userSeLabel(filters.userSe, en)}` : ""}`)
    : (en
      ? `Showing login history rows${filters.insttId ? ` for company ${filters.insttId}` : ""}${filters.userSe ? ` · ${userSeLabel(filters.userSe, en)}` : ""}.`
      : `로그인 이력을 조회 중입니다.${filters.insttId ? ` 회원사 ${filters.insttId}` : ""}${filters.userSe ? ` · ${userSeLabel(filters.userSe, en)}` : ""}`);

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "login-history-shared", {
      route: window.location.pathname,
      title: en ? props.titleEn : props.titleKo,
      rowCount: rows.length,
      currentPage,
      totalPages,
      userSe: filters.userSe,
      loginResult: filters.loginResult,
      insttId: filters.insttId
    });
    logGovernanceScope("COMPONENT", "login-history-table", {
      component: "login-history-table",
      rowCount: filteredRows.length,
      fixedLoginResult: props.fixedLoginResult || ""
    });
  }, [currentPage, en, filteredRows.length, filters.insttId, filters.loginResult, filters.userSe, page, props.fixedLoginResult, props.titleEn, props.titleKo, rows.length, totalPages]);

  useEffect(() => {
    setSelectedRowKey("");
  }, [currentPage, filters.actionStatus, filters.insttId, filters.loginResult, filters.searchKeyword, filters.userSe]);

  useEffect(() => {
    if (!selectedRowKey) {
      setActionNote("");
      setActionError("");
      setActionMessage("");
      return;
    }
    setActionNote(operatorNotes[selectedRowKey] || stringOf(selectedSavedAction || {}, "note"));
    setActionError("");
    setActionMessage("");
  }, [operatorNotes, selectedRowKey, selectedSavedAction]);

  async function handleSecurityAction(action: "SAVE_NOTE" | "UNBLOCK_USER" | "REGISTER_EXCEPTION" | "ESCALATE_BLOCK_IP") {
    if (!selectedRow || !selectedHistoryKey) {
      return;
    }
    const confirmMessages: Record<string, string> = {
      SAVE_NOTE: en ? "Save this operator note?" : "이 운영 메모를 저장하시겠습니까?",
      UNBLOCK_USER: en ? "Record an unblock request for this user?" : "이 사용자에 대한 차단 해제 요청을 기록하시겠습니까?",
      REGISTER_EXCEPTION: en ? "Register a temporary exception for this entry?" : "이 항목에 대한 임시 예외 요청을 등록하시겠습니까?",
      ESCALATE_BLOCK_IP: en ? "Escalate this source IP to blocklist review?" : "이 원본 IP를 차단목록 검토 대상으로 승격하시겠습니까?"
    };
    if (!window.confirm(confirmMessages[action])) {
      return;
    }
    setPendingAction(action);
    setActionError("");
    setActionMessage("");
    try {
      const response = await saveSecurityHistoryAction({
        action,
        historyKey: selectedHistoryKey,
        userId: selectedUserId,
        targetIp: selectedIp,
        insttId: selectedInsttId,
        note: actionNote,
        occurredAt: stringOf(selectedRow, "loginPnttm"),
        loginMessage: selectedNote
      });
      setOperatorNotes((current) => ({ ...current, [selectedRowKey]: actionNote }));
      await pageState.reload();
      setActionMessage(String(response.message || ""));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? props.breadcrumbsEn[0] : props.breadcrumbsKo[0], href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? props.breadcrumbsEn[1] : props.breadcrumbsKo[1] },
        { label: en ? props.breadcrumbsEn[2] : props.breadcrumbsKo[2] }
      ]}
      title={en ? props.titleEn : props.titleKo}
      subtitle={en ? props.subtitleEn : props.subtitleKo}
      contextStrip={
        <LookupContextStrip
          action={
            selectedRow
              ? <button className="gov-btn gov-btn-secondary" onClick={() => setSelectedRowKey("")} type="button">{en ? "Clear Detail Selection" : "상세 선택 해제"}</button>
              : null
          }
          label={contextLabel}
          value={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{contextValue}</span>
              <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? "Active filters" : "적용 필터"} <strong>{activeFilterCount}</strong>
              </span>
              <span className="text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? "Rows" : "행 수"} <strong>{totalCount.toLocaleString()}</strong>
              </span>
            </div>
          }
        />
      }
    >
      {page?.loginHistoryError || pageState.error ? <PageStatusNotice tone="error">{page?.loginHistoryError || pageState.error}</PageStatusNotice> : null}
      {blockedMode ? (
        <section className="gov-card mb-6 border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))]" data-help-id="member-security-guidance">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-lg font-bold">{en ? "Blocked Access Review" : "차단 접근 검토"}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Use this page to review blocked member access, repeated fail messages, and company scope together before unblocking or resetting credentials."
                  : "회원 차단 이력, 반복 실패 메시지, 회원사 범위를 함께 확인한 뒤 차단 해제나 비밀번호 초기화를 판단하는 화면입니다."}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800">
              {en ? "Review order: member -> company -> IP -> message -> follow-up action" : "검토 순서: 사용자 -> 회원사 -> IP -> 메시지 -> 후속 조치"}
            </div>
          </div>
        </section>
      ) : null}
      {systemBlockedMode ? (
        <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <article className="gov-card min-w-0 overflow-hidden p-0" data-help-id="security-history-closeout-gate">
            <GridToolbar
              meta={en ? "Documents this route as the system-scope blocked-history console, not a separate duplicate screen." : "이 경로가 별도 중복 화면이 아니라 시스템 범위 차단 이력 콘솔임을 명확히 합니다."}
              title={en ? "Security History Completion Gate" : "보안 이력 완료 게이트"}
            />
            <div className="divide-y divide-slate-100">
              {SECURITY_HISTORY_CLOSEOUT_ROWS.map((row) => (
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[210px_92px_minmax(0,1fr)]" key={row.labelKo}>
                  <div className="font-semibold text-[var(--kr-gov-text-primary)]">{en ? row.labelEn : row.labelKo}</div>
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.tone === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                      {en ? row.stateEn : row.stateKo}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{en ? row.notesEn : row.notesKo}</p>
                </div>
              ))}
            </div>
          </article>

          <aside className="gov-card min-w-0 p-5" data-help-id="security-history-action-contract">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">lock</span>
              <h2 className="text-base font-bold text-[var(--kr-gov-text-primary)]">{en ? "Blocked Enforcement" : "차단된 실행 조치"}</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
              {en
                ? "The page records operator intent today. Actual account/session/policy mutation needs separate authority, approval, and audit contracts."
                : "현재 화면은 운영자 의사결정을 기록합니다. 실제 계정/세션/정책 변경은 별도 권한, 승인, 감사 계약이 필요합니다."}
            </p>
            <div className="mt-4 grid gap-2">
              {SECURITY_HISTORY_ACTION_CONTRACT.map((action) => (
                <button className="gov-btn gov-btn-outline justify-center opacity-60" disabled key={action.labelKo} type="button">
                  {en ? action.labelEn : action.labelKo}
                </button>
              ))}
            </div>
          </aside>
        </section>
      ) : null}
      <section className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard description={blockedMode ? (en ? "Current blocked result count" : "현재 차단 결과 건수") : (en ? "Current filter result count" : "현재 필터 기준 결과 건수")} surfaceClassName="bg-white" title={blockedMode ? (en ? "Blocked Logs" : "차단 이력") : (en ? "Visible Logs" : "조회 건수")} value={<span className="text-3xl font-black text-[var(--kr-gov-blue)]">{totalCount.toLocaleString()}</span>} />
        <SummaryMetricCard description={blockedMode ? (en ? "Distinct blocked user IDs on this page" : "현재 페이지의 고유 차단 사용자 수") : (en ? "Counts on this page" : "현재 페이지 기준 집계")} surfaceClassName="bg-white" title={blockedMode ? (en ? "Blocked Users" : "차단 사용자") : (en ? "Success / Fail" : "성공 / 실패")} value={blockedMode ? <span className="text-3xl font-black text-red-600">{uniqueUserCount.toLocaleString()}</span> : <span className="text-3xl font-black text-emerald-600">{successCount}<span className="mx-2 text-gray-300">/</span><span className="text-red-600">{failCount}</span></span>} />
        <SummaryMetricCard description={blockedMode ? (en ? "Distinct source IPs behind blocked rows" : "차단 이력에 포함된 고유 IP 수") : (en ? "Distinct client IPs on this page" : "현재 페이지의 중복 제거 IP 수")} surfaceClassName="bg-white" title={blockedMode ? (en ? "Blocked IPs" : "차단 IP") : (en ? "Unique IPs" : "고유 IP")} value={<span className="text-3xl font-black text-amber-600">{uniqueIpCount.toLocaleString()}</span>} />
        <SummaryMetricCard description={blockedMode ? (en ? "Blocked row distribution on this page" : "현재 페이지의 차단 사용자 분포") : (en ? "Distribution on this page" : "현재 페이지 분포")} surfaceClassName="bg-white" title={blockedMode ? (en ? "Blocked Scope" : "차단 범위") : (en ? "User Scope" : "사용자 구분")} value={<span className="text-base font-black text-slate-800">{`${en ? "Admin" : "관리자"} ${userSeSummary.USR || 0} · ${en ? "Enterprise" : "기업"} ${userSeSummary.ENT || 0} · ${en ? "General" : "일반"} ${userSeSummary.GNR || 0}`}</span>} />
      </section>
      <section className="gov-card mb-6" data-help-id="login-history-search">
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={(event) => {
          event.preventDefault();
          logGovernanceScope("ACTION", "login-history-search", {
            searchKeyword: draft.searchKeyword,
            userSe: draft.userSe,
            loginResult: draft.loginResult || props.fixedLoginResult || "",
            insttId: draft.insttId,
            actionStatus: draft.actionStatus
          });
          setFilters({ ...draft, pageIndex: 1 });
        }}>
          {Boolean(page?.canManageAllCompanies) ? (
            <div>
              <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="insttId">회원사</label>
              <select className="gov-select" id="insttId" value={draft.insttId} onChange={(event) => setDraft((current) => ({ ...current, insttId: event.target.value }))}>
                <option value="">전체 회원사</option>
                {companyOptions.map((option, index) => {
                  const value = stringOf(option, "value", "insttId");
                  const label = stringOf(option, "cmpnyNm", "label", "insttNm", "insttName", "value", "insttId");
                  return <option key={`${value}-${index}`} value={value}>{label || value}</option>;
                })}
              </select>
            </div>
          ) : <div />}
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="userSe">{en ? "User Type" : "사용자 구분"}</label>
            <select className="gov-select" id="userSe" value={draft.userSe} onChange={(event) => setDraft((current) => ({ ...current, userSe: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              <option value="USR">{en ? "Admin" : "관리자"}</option>
              <option value="ENT">{en ? "Enterprise" : "기업회원"}</option>
              <option value="GNR">{en ? "General" : "일반회원"}</option>
            </select>
          </div>
          {!props.fixedLoginResult ? (
            <div>
              <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="loginResult">{en ? "Result" : "결과"}</label>
              <select className="gov-select" id="loginResult" value={draft.loginResult} onChange={(event) => setDraft((current) => ({ ...current, loginResult: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="SUCCESS">{en ? "Success" : "성공"}</option>
                <option value="FAIL">{en ? "Fail" : "실패"}</option>
              </select>
            </div>
          ) : <div />}
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="actionStatus">{en ? "Action Status" : "조치 상태"}</label>
            <select className="gov-select" id="actionStatus" value={draft.actionStatus} onChange={(event) => setDraft((current) => ({ ...current, actionStatus: event.target.value }))}>
              <option value="">{en ? "All" : "전체"}</option>
              <option value="NONE">{en ? "No Action" : "미조치"}</option>
              <option value="SAVE_NOTE">{en ? "Note Saved" : "메모 저장"}</option>
              <option value="UNBLOCK_USER">{en ? "Unblock Logged" : "해제 기록"}</option>
              <option value="REGISTER_EXCEPTION">{en ? "Exception" : "예외 등록"}</option>
              <option value="ESCALATE_BLOCK_IP">{en ? "IP Escalated" : "IP 차단 승격"}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="searchKeyword">{en ? "Keyword" : "검색어"}</label>
            <div className="flex gap-2">
              <input className="gov-input flex-1" id="searchKeyword" placeholder={en ? "Search by ID, name, or IP" : "아이디, 이름, IP 검색"} value={draft.searchKeyword} onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))} />
              <button className="gov-btn gov-btn-primary" type="submit">{en ? "Search" : "검색"}</button>
              <button className="gov-btn gov-btn-secondary" onClick={() => {
                const reset = { pageIndex: 1, searchKeyword: "", userSe: "", loginResult: props.fixedLoginResult || "", insttId: "", actionStatus: "" };
                setDraft(reset);
                setFilters(reset);
              }} type="button">{en ? "Reset" : "초기화"}</button>
            </div>
          </div>
        </form>
      </section>
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_380px]">
      <section className="gov-card p-0 overflow-hidden" data-help-id="login-history-table">
        <GridToolbar
          actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Filtered rows" : "필터 결과"} <strong>{filteredRows.length}</strong>{en ? ` / ${totalCount}` : ` / 총 ${totalCount}건`}</span>}
          meta={blockedMode ? (en ? "Review block reasons and source IPs together before release action." : "차단 해제 전 차단 사유와 원본 IP를 함께 검토합니다.") : (en ? "Select a row to inspect user, company, IP, and note together." : "행을 선택하면 사용자, 회원사, IP, 비고를 함께 확인합니다.")}
          title={blockedMode ? (en ? "Blocked Access History" : "차단 접근 이력") : (en ? "Login History" : "로그인 이력")}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="gov-table-header">
                <th className="px-6 py-4 text-center w-16">{en ? "No." : "번호"}</th>
                <th className="px-6 py-4">{en ? "Logged In At" : props.fixedLoginResult ? "차단 일시" : "로그인 일시"}</th>
                {!props.fixedLoginResult ? <th className="px-6 py-4">{en ? "Result" : "결과"}</th> : null}
                <th className="px-6 py-4">{en ? "User Type" : "사용자 구분"}</th>
                <th className="px-6 py-4">{en ? "Company" : "회원사"}</th>
                <th className="px-6 py-4">{en ? "Name (ID)" : "이름 (아이디)"}</th>
                <th className="px-6 py-4">IP</th>
                <th className="px-6 py-4">{en ? "Action Status" : "조치 상태"}</th>
                <th className="px-6 py-4">{en ? "Note" : props.fixedLoginResult ? "차단 사유" : "비고"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.length === 0 ? (
                <tr><td className="px-6 py-8 text-center text-gray-500" colSpan={props.fixedLoginResult ? 8 : 9}>{en ? "No history found." : "조회된 이력이 없습니다."}</td></tr>
              ) : filteredRows.map((item, index) => {
                const rowNo = Number(page?.totalCount || 0) - ((currentPage - 1) * Number(page?.pageSize || 10) + index);
                const result = stringOf(item, "loginResult");
                const rowKey = `${stringOf(item, "histId", "userId")}-${index}`;
                const rowHistoryKey = stringOf(item, "histId") || `${stringOf(item, "userId")}|${stringOf(item, "loginIp")}|${stringOf(item, "loginPnttm")}`;
                const rowSavedAction = securityActionByHistoryKey[rowHistoryKey] || null;
                const actionMeta = actionBadgeMeta(stringOf(rowSavedAction || {}, "action"), en);
                const highlighted = result === "FAIL" && !props.fixedLoginResult;
                return (
                  <tr className={`cursor-pointer transition-colors ${selectedRowKey === rowKey ? "bg-blue-50" : highlighted ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-gray-50/50"}`} key={rowKey} onClick={() => setSelectedRowKey(rowKey)}>
                    <td className="px-6 py-4 text-center text-gray-500">{rowNo}</td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(item, "loginPnttm")}</td>
                    {!props.fixedLoginResult ? <td className="px-6 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${resultBadge(result)}`}>{result === "SUCCESS" ? (en ? "Success" : "성공") : (en ? "Fail" : "실패")}</span></td> : null}
                    <td className="px-6 py-4">{userSeLabel(stringOf(item, "userSe"), en)}</td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(item, "companyName") || "-"}</td>
                    <td className="px-6 py-4"><div className="font-semibold">{stringOf(item, "userNm") || "-"}</div><div className="text-xs text-gray-400">{stringOf(item, "userId") || "-"}</div></td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(item, "loginIp")}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold ${actionMeta.className}`}>{actionMeta.label}</span>
                        {rowSavedAction ? (
                          <span className="text-xs text-gray-500">
                            {stringOf(rowSavedAction, "executedAt") || "-"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(item, "loginMessage") || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MemberPagination currentPage={currentPage} onPageChange={(pageNumber) => setFilters((current) => ({ ...current, pageIndex: pageNumber }))} totalPages={totalPages} />
      </section>
      <aside className="gov-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{blockedMode ? (en ? "Block Detail" : "차단 상세") : (en ? "Detail" : "상세 정보")}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{blockedMode ? (en ? "Select a blocked row to review company, source IP, and lock message before follow-up action." : "차단 행을 선택해 회원사, 원본 IP, 잠금 메시지를 확인한 뒤 후속 조치를 판단합니다.") : (en ? "Select a row to inspect user, company, IP, and message together." : "행을 선택하면 사용자, 회원사, IP, 메시지를 함께 확인합니다.")}</p>
          </div>
          {selectedRow ? <button className="text-sm font-bold text-[var(--kr-gov-blue)]" onClick={() => setSelectedRowKey("")} type="button">{en ? "Clear" : "해제"}</button> : null}
        </div>
        {selectedRow ? (
          <div className="mt-5 space-y-4 text-sm">
            {actionError ? <PageStatusNotice className="mb-0" tone="error">{actionError}</PageStatusNotice> : null}
            {actionMessage ? <PageStatusNotice className="mb-0" tone="success">{actionMessage}</PageStatusNotice> : null}
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Result" : "결과"}</p>
              <div className="mt-2 flex items-center gap-2">
                {!props.fixedLoginResult ? <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${resultBadge(stringOf(selectedRow, "loginResult"))}`}>{stringOf(selectedRow, "loginResult") === "SUCCESS" ? (en ? "Success" : "성공") : (en ? "Fail" : "실패")}</span> : null}
                <span className="text-[var(--kr-gov-text-secondary)]">{stringOf(selectedRow, "loginPnttm") || "-"}</span>
              </div>
            </div>
            {selectedSavedAction ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-bold text-emerald-800">{en ? "Latest Recorded Action" : "최근 기록된 조치"}</p>
                <div className="mt-2 text-sm text-emerald-900">
                  <strong>{stringOf(selectedSavedAction, "action") || "-"}</strong>
                  <span className="mx-2">·</span>
                  <span>{stringOf(selectedSavedAction, "executedAt") || "-"}</span>
                  <span className="mx-2">·</span>
                  <span>{stringOf(selectedSavedAction, "executedBy") || "-"}</span>
                </div>
                {stringOf(selectedSavedAction, "note") ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-emerald-900">{stringOf(selectedSavedAction, "note")}</p>
                ) : null}
              </div>
            ) : null}
            {selectedActionTimeline.length > 0 ? (
              <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
                <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action Timeline" : "조치 타임라인"}</p>
                <div className="mt-3 space-y-3">
                  {selectedActionTimeline.map((row, index) => {
                    const meta = actionBadgeMeta(stringOf(row, "action"), en);
                    return (
                      <div className="flex gap-3" key={`${stringOf(row, "executedAt")}-${index}`}>
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--kr-gov-blue)]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
                            <span className="text-xs text-gray-500">{stringOf(row, "executedAt") || "-"}</span>
                            <span className="text-xs text-gray-500">{stringOf(row, "executedBy") || "-"}</span>
                          </div>
                          {stringOf(row, "note") ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "note")}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3">
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                className="rounded-lg"
                surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                title={en ? "Same IP Rows" : "동일 IP 건수"}
                value={<span className="text-2xl font-black text-red-700">{sameIpCount}</span>}
                description={en ? "Rows on this page from the same source IP." : "현재 페이지에서 같은 원본 IP로 확인된 건수입니다."}
              />
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                className="rounded-lg"
                surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                title={en ? "Same User Rows" : "동일 사용자 건수"}
                value={<span className="text-2xl font-black text-amber-700">{sameUserCount}</span>}
                description={en ? "Rows on this page for the same user ID." : "현재 페이지에서 같은 사용자 ID로 확인된 건수입니다."}
              />
              <SummaryMetricCard
                accentClassName="text-[var(--kr-gov-text-secondary)] text-xs"
                className="rounded-lg"
                surfaceClassName="bg-[var(--kr-gov-surface-subtle)]"
                title={en ? "Same Company Rows" : "동일 회원사 건수"}
                value={<span className="text-2xl font-black text-[var(--kr-gov-blue)]">{sameCompanyCount}</span>}
                description={en ? "Rows on this page within the same company scope." : "현재 페이지에서 같은 회원사 범위로 확인된 건수입니다."}
              />
            </div>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "User" : "사용자"}</dt>
                <dd className="mt-1 font-semibold">{stringOf(selectedRow, "userNm") || "-"}</dd>
                <dd className="text-xs text-gray-500">{stringOf(selectedRow, "userId") || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "User Type" : "사용자 구분"}</dt>
                <dd className="mt-1">{userSeLabel(stringOf(selectedRow, "userSe"), en)}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Company" : "회원사"}</dt>
                <dd className="mt-1">{selectedRowCompany || "-"}</dd>
                <dd className="text-xs text-gray-500">{stringOf(selectedRow, "insttId") || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">IP</dt>
                <dd className="mt-1 font-mono">{stringOf(selectedRow, "loginIp") || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Note" : props.fixedLoginResult ? "차단 사유" : "비고"}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words leading-6">{stringOf(selectedRow, "loginMessage") || "-"}</dd>
              </div>
            </dl>
            <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-white px-4 py-4">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Operational Actions" : "운영 액션"}</p>
              <div className="mt-3">
                <label className="block text-xs font-bold text-[var(--kr-gov-text-secondary)]" htmlFor="security-history-action-note">
                  {en ? "Operator Note" : "운영 메모"}
                </label>
                <textarea
                  className="mt-2 min-h-[96px] w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-2 text-sm"
                  id="security-history-action-note"
                  placeholder={en ? "Record release reason, exception scope, or review notes." : "해제 사유, 예외 범위, 검토 메모를 기록합니다."}
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <MemberLinkButton href={monitoringHref} size="sm" variant="secondary">
                  {en ? "Open Monitoring" : "모니터링 열기"}
                </MemberLinkButton>
                <MemberLinkButton href={policyHref} size="sm" variant="secondary">
                  {en ? "Open Policy" : "정책 열기"}
                </MemberLinkButton>
                <MemberLinkButton href={blocklistHref} size="sm" variant="secondary">
                  {en ? "Open Blocklist" : "차단목록 열기"}
                </MemberLinkButton>
                {companyDetailHref ? (
                  <MemberLinkButton href={companyDetailHref} size="sm" variant="secondary">
                    {en ? "Open Company" : "회원사 열기"}
                  </MemberLinkButton>
                ) : null}
                <MemberButton
                  onClick={() => {
                    const lines = [
                      `${en ? "User ID" : "사용자 ID"}: ${selectedUserId || "-"}`,
                      `IP: ${selectedIp || "-"}`,
                      `${en ? "Company" : "회원사"}: ${selectedRowCompany || selectedInsttId || "-"}`,
                      `${en ? "Reason" : "사유"}: ${selectedNote || "-"}`
                    ];
                    void navigator.clipboard.writeText(lines.join("\n"));
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {en ? "Copy Summary" : "요약 복사"}
                </MemberButton>
                <MemberButton disabled={pendingAction === "SAVE_NOTE"} onClick={() => { void handleSecurityAction("SAVE_NOTE"); }} size="sm" type="button" variant="secondary">
                  {pendingAction === "SAVE_NOTE" ? (en ? "Saving..." : "저장 중...") : (en ? "Save Note" : "메모 저장")}
                </MemberButton>
                <MemberButton disabled={pendingAction === "UNBLOCK_USER"} onClick={() => { void handleSecurityAction("UNBLOCK_USER"); }} size="sm" type="button" variant="secondary">
                  {pendingAction === "UNBLOCK_USER" ? (en ? "Submitting..." : "처리 중...") : (en ? "Record Unblock" : "차단 해제 기록")}
                </MemberButton>
                <MemberButton disabled={pendingAction === "REGISTER_EXCEPTION"} onClick={() => { void handleSecurityAction("REGISTER_EXCEPTION"); }} size="sm" type="button" variant="secondary">
                  {pendingAction === "REGISTER_EXCEPTION" ? (en ? "Submitting..." : "처리 중...") : (en ? "Register Exception" : "예외 등록")}
                </MemberButton>
                <MemberButton disabled={pendingAction === "ESCALATE_BLOCK_IP" || !selectedIp} onClick={() => { void handleSecurityAction("ESCALATE_BLOCK_IP"); }} size="sm" type="button" variant="secondary">
                  {pendingAction === "ESCALATE_BLOCK_IP" ? (en ? "Submitting..." : "처리 중...") : (en ? "Escalate IP Block" : "IP 차단 승격")}
                </MemberButton>
              </div>
            </div>
            {stringOf(selectedRow, "loginResult") === "FAIL" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {sameIpCount >= 3
                  ? (en ? "The same source IP appears repeatedly on this page. Review monitoring and blocklist before releasing access." : "동일 원본 IP가 이 페이지에서 반복 확인됩니다. 해제 전에 모니터링과 차단목록을 함께 검토해야 합니다.")
                  : (en ? "Repeated fail rows should be reviewed with the source IP and member company together." : "실패 이력은 원본 IP와 회원사 범위를 함께 확인한 뒤 추가 차단 여부를 검토해야 합니다.")}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "No row selected yet." : "아직 선택된 이력이 없습니다."}
          </div>
        )}
      </aside>
      </section>
    </AdminPageShell>
  );
}
