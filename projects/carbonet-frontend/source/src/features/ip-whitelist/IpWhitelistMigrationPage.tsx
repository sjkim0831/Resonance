import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { createIpWhitelistRequest } from "../../lib/api/ops";
import { decideIpWhitelistRequest, fetchIpWhitelistPage } from "../../lib/api/security";
import type { IpWhitelistPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminInput, AdminSelect, AdminTable, AdminTextarea, DiagnosticCard, GridToolbar, MemberButton, MemberButtonGroup, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminPolicyPageFrame, AdminSummaryStrip } from "../admin-ui/pageFrames";

type Filters = {
  searchIp: string;
  accessScope: string;
  status: string;
};

type WhitelistRuleRow = Record<string, string>;
type WhitelistRequestRow = Record<string, string>;

type RegisterDraft = {
  applicationName: string;
  ipAddress: string;
  port: string;
  openFirewall: string;
  accessScope: string;
  reason: string;
  requester: string;
  expiresAt: string;
  memo: string;
};

type AppPreset = {
  key: string;
  labelKo: string;
  labelEn: string;
  accessScope: string;
  port: string;
  firewallDefault: "OPEN" | "KEEP_CLOSED";
  descriptionKo: string;
  descriptionEn: string;
};

const APP_PRESETS: AppPreset[] = [
  { key: "ADMIN_WEB", labelKo: "관리자 웹", labelEn: "Admin Web", accessScope: "ADMIN", port: "18000", firewallDefault: "KEEP_CLOSED", descriptionKo: "관리자 콘솔 직접 접속", descriptionEn: "Direct access to the admin console" },
  { key: "API_GATEWAY", labelKo: "API 게이트웨이", labelEn: "API Gateway", accessScope: "API", port: "8443", firewallDefault: "OPEN", descriptionKo: "연계 API 호출용 허용", descriptionEn: "Allow integration API access" },
  { key: "BATCH_AGENT", labelKo: "배치 에이전트", labelEn: "Batch Agent", accessScope: "BATCH", port: "22", firewallDefault: "OPEN", descriptionKo: "배치 서버 점검 및 파일 전송", descriptionEn: "Batch host maintenance and file transfer" },
  { key: "INTERNAL_TOOL", labelKo: "내부 운영 도구", labelEn: "Internal Tool", accessScope: "INTERNAL", port: "8080", firewallDefault: "KEEP_CLOSED", descriptionKo: "사내 운영 도구 접근", descriptionEn: "Internal operator tool access" },
  { key: "DB_ADMIN", labelKo: "DB 관리", labelEn: "DB Admin", accessScope: "INTERNAL", port: "33000", firewallDefault: "KEEP_CLOSED", descriptionKo: "DB 관리망 점검 요청", descriptionEn: "Database network maintenance request" },
  { key: "CUSTOM", labelKo: "직접 입력", labelEn: "Custom", accessScope: "ADMIN", port: "", firewallDefault: "KEEP_CLOSED", descriptionKo: "앱과 포트를 직접 입력", descriptionEn: "Enter the app and port manually" }
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    case "PENDING":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

function statusLabel(status: string, en: boolean) {
  switch (status) {
    case "ACTIVE":
      return en ? "Active" : "활성";
    case "PENDING":
      return en ? "Pending" : "검토중";
    case "INACTIVE":
      return en ? "Inactive" : "비활성";
    default:
      return status || (en ? "Unknown" : "미정");
  }
}

function requestStatusBadgeClass(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes("APPROV") || normalized.includes("승인")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("REJECT") || normalized.includes("반려")) {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-100 text-amber-700";
}

function extractExecutionContext(row: Record<string, string>, en: boolean) {
  const reason = stringOf(row, en ? "reasonEn" : "reason");
  const parts = reason.split("|").map((part) => part.trim());
  const appPart = parts.find((part) => (en ? part.startsWith("App ") : part.startsWith("앱 ")));
  const portPart = parts.find((part) => (en ? part.startsWith("Port ") : part.startsWith("포트 ")));
  const firewallPart = parts.find((part) => (en ? part.startsWith("Firewall ") : part.startsWith("방화벽 ")));
  return {
    app: appPart ? appPart.replace(en ? "App " : "앱 ", "").trim() : "-",
    port: portPart ? portPart.replace(en ? "Port " : "포트 ", "").trim() : "-",
    firewall: firewallPart ? firewallPart.replace(en ? "Firewall " : "방화벽 ", "").trim() : "-"
  };
}


export function IpWhitelistMigrationPage() {
  const en = isEnglish();
  const query = new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState<Filters>({
    searchIp: query.get("searchIp") || "",
    accessScope: query.get("accessScope") || "",
    status: query.get("status") || ""
  });
  const [draft, setDraft] = useState(filters);
  const [registerDraft, setRegisterDraft] = useState<RegisterDraft>({
    applicationName: "ADMIN_WEB",
    ipAddress: "",
    port: "18000",
    openFirewall: "KEEP_CLOSED",
    accessScope: "ADMIN",
    reason: "",
    requester: "",
    expiresAt: "",
    memo: ""
  });
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [operationMessage, setOperationMessage] = useState("");
  const [registering, setRegistering] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [executionFeedback, setExecutionFeedback] = useState("");
  const pageState = useAsyncValue<IpWhitelistPagePayload>(() => fetchIpWhitelistPage(filters), [filters.searchIp, filters.accessScope, filters.status], {
    onSuccess(payload) {
      setDraft({
        searchIp: String(payload.searchIp || ""),
        accessScope: String(payload.accessScope || ""),
        status: String(payload.status || "")
      });
    }
  });
  const page = pageState.value;
  const summary = (page?.ipWhitelistSummary || []) as Array<Record<string, string>>;
  const rows = (page?.ipWhitelistRows || []) as WhitelistRuleRow[];
  const requests = (page?.ipWhitelistRequestRows || []) as WhitelistRequestRow[];
  const pendingRequestCount = requests.filter((row) => {
    const approvalStatus = stringOf(row, "approvalStatus");
    const approvalStatusEn = stringOf(row, "approvalStatusEn").toUpperCase();
    return approvalStatus.includes("검토") || approvalStatus.includes("대기") || approvalStatusEn.includes("PENDING") || approvalStatusEn.includes("REVIEW");
  }).length;
  const activeRuleCount = rows.filter((row) => stringOf(row, "status").toUpperCase() === "ACTIVE").length;
  const inactiveRuleCount = rows.filter((row) => stringOf(row, "status").toUpperCase() === "INACTIVE").length;
  const hasActiveFilter = Boolean(filters.searchIp || filters.accessScope || filters.status);
  const selectedRequest = requests.find((row) => stringOf(row, "requestId") === selectedRequestId) || requests[0] || null;
  const selectedPreset = APP_PRESETS.find((preset) => preset.key === registerDraft.applicationName) || APP_PRESETS[0];
  const selectedRequestContext = selectedRequest ? extractExecutionContext(selectedRequest, en) : null;

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "ip-whitelist", {
      route: window.location.pathname,
      summaryCount: summary.length,
      rowCount: rows.length,
      requestCount: requests.length,
      accessScope: filters.accessScope,
      status: filters.status
    });
    logGovernanceScope("COMPONENT", "ip-whitelist-table", {
      component: "ip-whitelist-table",
      rowCount: rows.length,
      requestCount: requests.length
    });
  }, [filters.accessScope, filters.status, page, requests.length, rows.length, summary.length]);

  useEffect(() => {
    if (!selectedRequestId && requests.length > 0) {
      setSelectedRequestId(stringOf(requests[0], "requestId"));
      return;
    }
    if (selectedRequestId && !requests.some((row) => stringOf(row, "requestId") === selectedRequestId)) {
      setSelectedRequestId(requests.length > 0 ? stringOf(requests[0], "requestId") : "");
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    setReviewNote(selectedRequest ? stringOf(selectedRequest, "reviewNote") : "");
  }, [selectedRequest]);

  useEffect(() => {
    if (registerDraft.applicationName === "CUSTOM") {
      return;
    }
    setRegisterDraft((current) => ({
      ...current,
      accessScope: selectedPreset.accessScope,
      port: selectedPreset.port,
      openFirewall: selectedPreset.firewallDefault
    }));
  }, [registerDraft.applicationName, selectedPreset.accessScope, selectedPreset.firewallDefault, selectedPreset.port]);

  async function handleRegisterRequest() {
    if (!registerDraft.ipAddress.trim() || !registerDraft.port.trim() || !registerDraft.reason.trim() || !registerDraft.requester.trim()) {
      setOperationMessage(en ? "Enter app, IP, port, reason, and requester before submitting." : "앱, IP, 포트, 사유, 요청자를 입력한 뒤 등록하세요.");
      return;
    }
    setRegistering(true);
    try {
      const response = await createIpWhitelistRequest({
        applicationName: registerDraft.applicationName,
        ipAddress: registerDraft.ipAddress.trim(),
        port: registerDraft.port.trim(),
        openFirewall: registerDraft.openFirewall,
        accessScope: registerDraft.accessScope,
        reason: registerDraft.reason.trim(),
        requester: registerDraft.requester.trim(),
        expiresAt: registerDraft.expiresAt.trim(),
        memo: registerDraft.memo.trim()
      });
      setOperationMessage(String(response.message || (en ? "Temporary allowlist request has been queued for review." : "임시 허용 요청을 검토 대기열에 등록했습니다.")));
      setSelectedRequestId(String(response.requestId || ""));
      setRegisterDraft({
        applicationName: "ADMIN_WEB",
        ipAddress: "",
        port: "18000",
        openFirewall: "KEEP_CLOSED",
        accessScope: "ADMIN",
        reason: "",
        requester: "",
        expiresAt: "",
        memo: ""
      });
      setExecutionFeedback(String(response.executionFeedback || ""));
      await pageState.reload();
      logGovernanceScope("ACTION", "ip-whitelist-register", {
        requestId: String(response.requestId || ""),
        applicationName: registerDraft.applicationName,
        ipAddress: registerDraft.ipAddress.trim(),
        port: registerDraft.port.trim(),
        openFirewall: registerDraft.openFirewall,
        accessScope: registerDraft.accessScope
      });
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : (en ? "Failed to queue the allowlist request." : "허용 요청 등록에 실패했습니다."));
    } finally {
      setRegistering(false);
    }
  }

  async function handleRequestDecision(decision: "APPROVE" | "REJECT") {
    if (!selectedRequest) {
      return;
    }
    const requestId = stringOf(selectedRequest, "requestId");
    setDeciding(true);
    try {
      const response = await decideIpWhitelistRequest({
        requestId,
        decision,
        reviewNote: reviewNote.trim()
      });
      setOperationMessage(String(response.message || (decision === "APPROVE"
        ? (en ? `Request ${requestId} approved and reflected in the allowlist.` : `${requestId} 요청을 승인하고 허용 정책에 반영했습니다.`)
        : (en ? `Request ${requestId} rejected.` : `${requestId} 요청을 반려했습니다.`))));
      setExecutionFeedback(String(response.executionFeedback || ""));
      await pageState.reload();
      logGovernanceScope("ACTION", "ip-whitelist-decision", {
        requestId,
        decision,
        reviewNote: reviewNote.trim()
      });
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : (en ? "Failed to process the request." : "요청 처리에 실패했습니다."));
    } finally {
      setDeciding(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Environment" : "환경" },
        { label: en ? "IP Whitelist" : "IP 화이트리스트" }
      ]}
      title={en ? "IP Whitelist" : "IP 화이트리스트"}
      subtitle={en ? "Manage allowlist policies and approval requests for admin, batch, and integration access." : "관리자, 배치, 연계 API 접근에 허용된 IP 정책과 승인 요청을 함께 관리합니다."}
    >
      <AdminPolicyPageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {operationMessage ? <PageStatusNotice tone="success">{operationMessage}</PageStatusNotice> : null}
        {!pageState.error && pendingRequestCount > 0 ? (
          <PageStatusNotice tone="warning">
            {en
              ? `${pendingRequestCount} approval request${pendingRequestCount > 1 ? "s are" : " is"} waiting for review before gateway propagation.`
              : `${pendingRequestCount}건의 승인 요청이 게이트웨이 반영 전 검토 대기 중입니다.`}
          </PageStatusNotice>
        ) : null}
        {!pageState.error && !pageState.loading && rows.length === 0 ? (
          <PageStatusNotice tone="warning">
            {hasActiveFilter
              ? (en ? "No allowlist policy matches the current filter." : "현재 조건에 맞는 허용 정책이 없습니다.")
              : (en ? "There is no registered allowlist policy yet." : "등록된 허용 정책이 아직 없습니다.")}
          </PageStatusNotice>
        ) : null}

        <AdminSummaryStrip data-help-id="ip-whitelist-summary">
          {summary.length > 0 ? summary.map((card, index) => (
            <SummaryMetricCard
              description={card.description || card.caption}
              key={`${card.title || card.label || card.value}-${index}`}
              title={card.title || card.label}
              value={card.value}
            />
          )) : (
            <>
              <SummaryMetricCard description={en ? "Policies currently enforced" : "현재 적용 중인 허용 정책"} title={en ? "Active Rules" : "활성 정책"} value={activeRuleCount} />
              <SummaryMetricCard description={en ? "Pending operator review" : "운영자 검토 대기"} surfaceClassName="bg-amber-50" accentClassName="text-amber-700" title={en ? "Pending Requests" : "승인 요청"} value={pendingRequestCount} />
              <SummaryMetricCard description={en ? "Filtered policy rows" : "조회된 정책 건수"} title={en ? "Search Results" : "검색 결과"} value={rows.length} />
              <SummaryMetricCard description={en ? "Inactive or reserved entries" : "비활성 또는 보류 항목"} surfaceClassName="bg-slate-50" accentClassName="text-slate-700" title={en ? "Inactive Rules" : "비활성 정책"} value={inactiveRuleCount} />
            </>
          )}
        </AdminSummaryStrip>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="gov-card" data-help-id="ip-whitelist-register">
            <GridToolbar
              actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">add_moderator</span>}
              title={en ? "Execute Access Request" : "접근 요청 실행"}
              meta={en ? "Pick a frequent app, bind the port, decide whether to open the firewall, and queue the execution result for review." : "자주 쓰는 앱을 고르고 포트를 연동한 뒤 방화벽 개방 여부를 선택해 실행 결과를 검토 대기열에 올립니다."}
            />
            <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2">
              <div>
                <label className="gov-label" htmlFor="registerApplicationName">{en ? "Frequent App" : "자주 쓰는 앱"}</label>
                <AdminSelect id="registerApplicationName" value={registerDraft.applicationName} onChange={(event) => setRegisterDraft((current) => ({ ...current, applicationName: event.target.value }))}>
                  {APP_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>{en ? preset.labelEn : preset.labelKo}</option>
                  ))}
                </AdminSelect>
                <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{en ? selectedPreset.descriptionEn : selectedPreset.descriptionKo}</p>
              </div>
              <div>
                <label className="gov-label" htmlFor="registerIpAddress">{en ? "IP / Range" : "IP / 대역"}</label>
                <AdminInput id="registerIpAddress" placeholder={en ? "e.g., 203.248.117.8 or 203.248.117.0/24" : "예: 203.248.117.8 또는 203.248.117.0/24"} value={registerDraft.ipAddress} onChange={(event) => setRegisterDraft((current) => ({ ...current, ipAddress: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registerPort">{en ? "Port" : "포트"}</label>
                <AdminInput id="registerPort" placeholder={en ? "e.g., 18000" : "예: 18000"} value={registerDraft.port} onChange={(event) => setRegisterDraft((current) => ({ ...current, port: event.target.value.replace(/[^0-9]/g, "") }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registerAccessScope">{en ? "Access Scope" : "접근 범위"}</label>
                <AdminSelect id="registerAccessScope" value={registerDraft.accessScope} onChange={(event) => setRegisterDraft((current) => ({ ...current, accessScope: event.target.value }))}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="BATCH">BATCH</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="API">API</option>
                </AdminSelect>
              </div>
              <div>
                <label className="gov-label" htmlFor="registerFirewallAction">{en ? "Firewall Action" : "방화벽 처리"}</label>
                <AdminSelect id="registerFirewallAction" value={registerDraft.openFirewall} onChange={(event) => setRegisterDraft((current) => ({ ...current, openFirewall: event.target.value }))}>
                  <option value="OPEN">{en ? "Open Firewall" : "방화벽 열기"}</option>
                  <option value="KEEP_CLOSED">{en ? "Keep Closed" : "방화벽 열지 않기"}</option>
                </AdminSelect>
              </div>
              <div>
                <label className="gov-label" htmlFor="registerRequester">{en ? "Requester" : "요청자"}</label>
                <AdminInput id="registerRequester" placeholder={en ? "e.g., Security Officer Minsu Kim" : "예: 보안담당 김민수"} value={registerDraft.requester} onChange={(event) => setRegisterDraft((current) => ({ ...current, requester: event.target.value }))} />
              </div>
              <div>
                <label className="gov-label" htmlFor="registerExpiresAt">{en ? "Expires At" : "만료 예정"}</label>
                <AdminInput id="registerExpiresAt" placeholder={en ? "e.g., 2026-03-28 18:00" : "예: 2026-03-28 18:00"} value={registerDraft.expiresAt} onChange={(event) => setRegisterDraft((current) => ({ ...current, expiresAt: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="gov-label" htmlFor="registerReason">{en ? "Reason" : "요청 사유"}</label>
                <AdminTextarea className="min-h-[96px]" id="registerReason" placeholder={en ? "Explain why this IP needs temporary access." : "해당 IP에 임시 허용이 필요한 사유를 입력하세요."} value={registerDraft.reason} onChange={(event) => setRegisterDraft((current) => ({ ...current, reason: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="gov-label" htmlFor="registerMemo">{en ? "Operator Memo" : "운영 메모"}</label>
                <AdminTextarea className="min-h-[88px]" id="registerMemo" placeholder={en ? "Optional propagation notes, firewall linkage, certificate impact, etc." : "방화벽 반영, 인증서 영향, 게이트웨이 동기화 메모 등을 입력하세요."} value={registerDraft.memo} onChange={(event) => setRegisterDraft((current) => ({ ...current, memo: event.target.value }))} />
              </div>
              <div className="md:col-span-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                {en
                  ? `Execution plan: ${selectedPreset.labelEn}, port ${registerDraft.port || "-"}, firewall ${registerDraft.openFirewall === "OPEN" ? "open" : "kept closed"}, scope ${registerDraft.accessScope}.`
                  : `실행 계획: ${selectedPreset.labelKo}, 포트 ${registerDraft.port || "-"}, 방화벽 ${registerDraft.openFirewall === "OPEN" ? "개방" : "미개방"}, 범위 ${registerDraft.accessScope}.`}
              </div>
              {executionFeedback ? (
                <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-bold">{en ? "Latest Result / Feedback" : "최근 실행 결과 / 피드백"}</p>
                  <p className="mt-2 whitespace-pre-wrap">{executionFeedback}</p>
                </div>
              ) : null}
              <div className="md:col-span-2 flex justify-end">
                <MemberButtonGroup>
                  <MemberButton disabled={registering} onClick={() => { void handleRegisterRequest(); }} type="button" variant="primary">
                    {registering ? (en ? "Executing..." : "실행 중...") : (en ? "Execute and Queue Review" : "실행 후 검토 요청")}
                  </MemberButton>
                </MemberButtonGroup>
              </div>
            </div>
          </section>

          <DiagnosticCard
            description={en ? "Select a queued request and record approval or rejection with an operator note." : "대기 중인 요청을 선택해 승인 또는 반려를 기록하고 운영 메모를 남깁니다."}
            eyebrow={en ? "Approval Desk" : "승인 처리"}
            status={selectedRequest ? stringOf(selectedRequest, en ? "approvalStatusEn" : "approvalStatus") : (en ? "Idle" : "대기")}
            statusTone={selectedRequest && (stringOf(selectedRequest, "approvalStatusEn").toUpperCase().includes("APPROVED") || stringOf(selectedRequest, "approvalStatus").includes("승인")) ? "healthy" : "warning"}
            title={en ? "Selected Request" : "선택된 요청"}
          >
            {selectedRequest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Request ID" : "요청번호"}</p>
                    <p className="mt-1 font-semibold">{stringOf(selectedRequest, "requestId")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Current Status" : "현재 상태"}</p>
                    <p className="mt-1">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${requestStatusBadgeClass(stringOf(selectedRequest, "approvalStatusEn") || stringOf(selectedRequest, "approvalStatus"))}`}>
                        {stringOf(selectedRequest, en ? "approvalStatusEn" : "approvalStatus")}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">IP</p>
                    <p className="mt-1 font-mono text-sm">{stringOf(selectedRequest, "ipAddress")}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "App / Port" : "앱 / 포트"}</p>
                    <p className="mt-1 font-semibold">{selectedRequestContext ? `${selectedRequestContext.app} / ${selectedRequestContext.port}` : "-"}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Requester" : "요청자"}</p>
                    <p className="mt-1 font-semibold">{stringOf(selectedRequest, en ? "requesterEn" : "requester")}</p>
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Firewall Choice" : "방화벽 선택"}</p>
                  <p className="mt-1 font-semibold">{selectedRequestContext ? selectedRequestContext.firewall : "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Reason" : "요청 사유"}</p>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-primary)]">{stringOf(selectedRequest, en ? "reasonEn" : "reason")}</p>
                </div>
                <div>
                  <label className="gov-label" htmlFor="reviewNote">{en ? "Review Note" : "검토 메모"}</label>
                  <AdminTextarea className="min-h-[104px]" id="reviewNote" placeholder={en ? "Document propagation timing, scope, and rollback condition." : "반영 시점, 허용 범위, 회수 조건을 메모로 남기세요."} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
                </div>
                <MemberButtonGroup>
                  <MemberButton disabled={deciding} onClick={() => { void handleRequestDecision("APPROVE"); }} type="button" variant="primary">
                    {deciding ? (en ? "Processing..." : "처리 중...") : (en ? "Approve and Reflect" : "승인 후 반영")}
                  </MemberButton>
                  <MemberButton disabled={deciding} onClick={() => { void handleRequestDecision("REJECT"); }} type="button" variant="danger">
                    {deciding ? (en ? "Processing..." : "처리 중...") : (en ? "Reject Request" : "요청 반려")}
                  </MemberButton>
                </MemberButtonGroup>
              </div>
            ) : (
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "There is no request to review in the current filter." : "현재 필터에서는 검토할 요청이 없습니다."}</p>
            )}
          </DiagnosticCard>
        </section>

        <section className="gov-card" data-help-id="ip-whitelist-search">
          <GridToolbar
            actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">shield_with_house</span>}
            title={en ? "Allowlist Search" : "허용 정책 조회"}
            meta={en ? "Filter by IP, scope, and workflow status." : "IP, 접근 범위, 상태 기준으로 허용 정책을 조회합니다."}
          />
          <form className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-4" onSubmit={(event) => {
            event.preventDefault();
            logGovernanceScope("ACTION", "ip-whitelist-search", {
              searchIp: draft.searchIp,
              accessScope: draft.accessScope,
              status: draft.status
            });
            setFilters(draft);
          }}>
            <div>
              <label className="gov-label" htmlFor="searchIp">{en ? "IP or Description" : "IP 또는 설명"}</label>
              <AdminInput id="searchIp" placeholder={en ? "e.g., 203.248 or operations center" : "예: 203.248 또는 운영센터"} value={draft.searchIp} onChange={(event) => setDraft((current) => ({ ...current, searchIp: event.target.value }))} />
            </div>
            <div>
              <label className="gov-label" htmlFor="accessScope">{en ? "Access Scope" : "접근 범위"}</label>
              <AdminSelect id="accessScope" value={draft.accessScope} onChange={(event) => setDraft((current) => ({ ...current, accessScope: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="ADMIN">ADMIN</option>
                <option value="BATCH">BATCH</option>
                <option value="INTERNAL">INTERNAL</option>
                <option value="API">API</option>
              </AdminSelect>
            </div>
            <div>
              <label className="gov-label" htmlFor="status">{en ? "Status" : "상태"}</label>
              <AdminSelect id="status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
                <option value="">{en ? "All" : "전체"}</option>
                <option value="ACTIVE">{en ? "Active" : "활성"}</option>
                <option value="PENDING">{en ? "Pending" : "검토중"}</option>
                <option value="INACTIVE">{en ? "Inactive" : "비활성"}</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <MemberButtonGroup className="w-full justify-end">
                <MemberButton className="min-w-[120px] justify-center" type="submit" variant="primary">{en ? "Search" : "조회"}</MemberButton>
                <MemberButton className="min-w-[120px] justify-center" onClick={() => {
                  const reset = { searchIp: "", accessScope: "", status: "" };
                  logGovernanceScope("ACTION", "ip-whitelist-reset", reset);
                  setDraft(reset);
                  setFilters(reset);
                }} type="button" variant="secondary">{en ? "Reset" : "초기화"}</MemberButton>
              </MemberButtonGroup>
            </div>
          </form>
        </section>

        <section className="gov-card" data-help-id="ip-whitelist-table">
          <GridToolbar
            actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">vpn_lock</span>}
            title={en ? "Applied Whitelist" : "적용 중인 화이트리스트"}
            meta={en ? `${rows.length} policies, ${activeRuleCount} active, ${pendingRequestCount} pending reviews` : `총 ${rows.length}건, 활성 ${activeRuleCount}건, 검토중 ${pendingRequestCount}건`}
          />
          <div className="overflow-x-auto">
            <AdminTable>
              <thead>
                <tr className="gov-table-header">
                  <th className="px-4 py-3">{en ? "Rule ID" : "규칙 ID"}</th>
                  <th className="px-4 py-3">{en ? "IP / Range" : "IP / 대역"}</th>
                  <th className="px-4 py-3">{en ? "Access Scope" : "접근 범위"}</th>
                  <th className="px-4 py-3">{en ? "Description" : "설명"}</th>
                  <th className="px-4 py-3">{en ? "Owner" : "담당 조직"}</th>
                  <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                  <th className="px-4 py-3">{en ? "Last Applied" : "최근 반영"}</th>
                  <th className="px-4 py-3">{en ? "Memo" : "비고"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>{en ? "No matching policies." : "조건에 맞는 허용 정책이 없습니다."}</td></tr>
                ) : rows.map((row) => {
                  const status = stringOf(row, "status");
                  return (
                    <tr key={stringOf(row, "ruleId")}>
                      <td className="px-4 py-3 font-bold">{stringOf(row, "ruleId")}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "ipAddress")}</td>
                      <td className="px-4 py-3">{stringOf(row, "accessScope")}</td>
                      <td className="px-4 py-3">{stringOf(row, en ? "descriptionEn" : "description")}</td>
                      <td className="px-4 py-3">{stringOf(row, en ? "ownerEn" : "owner")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(status)}`}>
                          {statusLabel(status, en)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "updatedAt")}</td>
                      <td className="px-4 py-3 text-[var(--kr-gov-text-secondary)]">{stringOf(row, en ? "memoEn" : "memo")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <article className="gov-card" data-help-id="ip-whitelist-requests">
            <GridToolbar
              actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">approval</span>}
              title={en ? "Approval Requests" : "승인 요청 현황"}
              meta={en ? `${requests.length} request rows in the current queue` : `현재 승인 대기열 ${requests.length}건`}
            />
            <div className="overflow-x-auto">
              <AdminTable>
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Request ID" : "요청번호"}</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">{en ? "Scope" : "범위"}</th>
                    <th className="px-4 py-3">{en ? "Reason" : "사유"}</th>
                    <th className="px-4 py-3">{en ? "Status" : "상태"}</th>
                    <th className="px-4 py-3">{en ? "Requested At" : "요청일시"}</th>
                    <th className="px-4 py-3">{en ? "Requester" : "요청자"}</th>
                    <th className="px-4 py-3 text-right">{en ? "Action" : "처리"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.length === 0 ? (
                    <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={8}>{en ? "There are no pending approval requests." : "대기 중인 승인 요청이 없습니다."}</td></tr>
                  ) : requests.map((row) => (
                    <tr key={stringOf(row, "requestId")}>
                      <td className="px-4 py-3 font-bold">{stringOf(row, "requestId")}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{stringOf(row, "ipAddress")}</td>
                      <td className="px-4 py-3">{stringOf(row, "accessScope")}</td>
                      <td className="px-4 py-3">{stringOf(row, en ? "reasonEn" : "reason")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${requestStatusBadgeClass(stringOf(row, "approvalStatusEn") || stringOf(row, "approvalStatus"))}`}>
                          {stringOf(row, en ? "approvalStatusEn" : "approvalStatus")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{stringOf(row, "requestedAt")}</td>
                      <td className="px-4 py-3">{stringOf(row, en ? "requesterEn" : "requester")}</td>
                      <td className="px-4 py-3 text-right">
                        <MemberButton onClick={() => setSelectedRequestId(stringOf(row, "requestId"))} type="button" variant="secondary">
                          {en ? "Review" : "검토"}
                        </MemberButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            </div>
          </article>

          <DiagnosticCard
            description={en ? "Operator checkpoints that should be reviewed before allowlist changes are propagated." : "화이트리스트 정책 반영 전에 운영자가 함께 점검해야 하는 항목입니다."}
            eyebrow={en ? "Operations Guide" : "운영 가이드"}
            status={pendingRequestCount > 0 ? (en ? "Review Required" : "검토 필요") : (en ? "Stable" : "안정")}
            statusTone={pendingRequestCount > 0 ? "warning" : "healthy"}
            title={en ? "Operational Checkpoints" : "운영 체크포인트"}
          >
            <ul className="space-y-3 text-sm text-[var(--kr-gov-text-secondary)]">
              <li className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">{en ? "Review automatic revoke scheduling for temporary external access." : "외부 협력사 임시 허용은 종료일 기준 자동 회수 여부를 함께 검토합니다."}</li>
              <li className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">{en ? "Check duplicate ranges before propagating gateway rules." : "게이트웨이 정책 반영 전 동일 대역 중복 등록 여부를 확인합니다."}</li>
              <li className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">{en ? "Validate firewall and certificate impacts when batch IPs change." : "배치 서버 고정 IP 변경 시 API 인증서와 방화벽 정책도 같이 점검합니다."}</li>
            </ul>
          </DiagnosticCard>
        </section>
      </AdminPolicyPageFrame>
    </AdminPageShell>
  );
}
