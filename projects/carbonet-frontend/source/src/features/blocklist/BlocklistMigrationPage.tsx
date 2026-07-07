import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBlocklistPage, updateSecurityMonitoringBlockCandidate } from "../../lib/api/security";
import type { BlocklistPagePayload } from "../../lib/api/securityTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import {
  AdminInput,
  AdminSelect,
  AdminTable,
  MemberButton,
  MemberButtonGroup,
  MemberPagination,
  MemberSectionToolbar,
  PageStatusNotice
} from "../member/common";
import { stringOf } from "../admin-system/adminSystemShared";
import { ReviewModalFrame } from "../member/sections";

const BLOCKLIST_PAGE_SIZE = 10;
const RELEASE_QUEUE_PAGE_SIZE = 5;
const STATUS_HISTORY_PAGE_SIZE = 5;

type PendingAction = {
  blockId: string;
  status: string;
  expiresAt?: string;
  target: string;
  actionLabel: string;
};

type BlocklistFilters = {
  searchKeyword: string;
  blockType: string;
  status: string;
  source: string;
};

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function csvValue(value: string) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function parseDateValue(value: string) {
  const timestamp = Date.parse(String(value || "").replace(" ", "T"));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isExpiringSoon(value: string) {
  const timestamp = parseDateValue(value);
  if (timestamp === null) {
    return false;
  }
  return timestamp - Date.now() <= 24 * 60 * 60 * 1000;
}

function sourceTone(source: string) {
  return source.toLowerCase() === "monitoring" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700";
}

function statusTone(status: string) {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (upper === "PENDING") {
    return "bg-amber-100 text-amber-700";
  }
  if (upper === "RELEASED") {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-blue-100 text-blue-700";
}

function clampBlocklistPageInput(value: string, totalPages: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), Math.max(totalPages, 1));
}

function readFiltersFromLocation(): BlocklistFilters {
  const search = new URLSearchParams(window.location.search);
  return {
    searchKeyword: search.get("searchKeyword") || "",
    blockType: search.get("blockType") || "",
    status: search.get("status") || "",
    source: search.get("source") || ""
  };
}

export function BlocklistMigrationPage() {
  const en = isEnglish();
  const initialFilters = readFiltersFromLocation();
  const [filters, setFilters] = useState(initialFilters);
  const [draft, setDraft] = useState(initialFilters);
  const [releaseHistoryKeyword, setReleaseHistoryKeyword] = useState("");
  const [releaseQueueKeyword, setReleaseQueueKeyword] = useState("");
  const [releaseQueueSort, setReleaseQueueSort] = useState("RELEASE_AT");
  const [expiringFilter, setExpiringFilter] = useState("24H");
  const [statusHistoryKeyword, setStatusHistoryKeyword] = useState("");
  const [blocklistPage, setBlocklistPage] = useState(1);
  const [releaseQueuePage, setReleaseQueuePage] = useState(1);
  const [releaseHistoryPage, setReleaseHistoryPage] = useState(1);
  const [statusHistoryPage, setStatusHistoryPage] = useState(1);
  const [blocklistPageInput, setBlocklistPageInput] = useState("1");
  const [releaseQueuePageInput, setReleaseQueuePageInput] = useState("1");
  const [releaseHistoryPageInput, setReleaseHistoryPageInput] = useState("1");
  const [statusHistoryPageInput, setStatusHistoryPageInput] = useState("1");
  const [statusHistorySort, setStatusHistorySort] = useState("LATEST");
  const [operationMessage, setOperationMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const pageState = useAsyncValue<BlocklistPagePayload>(() => fetchBlocklistPage(filters), [filters.searchKeyword, filters.blockType, filters.status, filters.source], {
    onSuccess(payload) {
      setDraft({
        searchKeyword: String(payload.searchKeyword || ""),
        blockType: String(payload.blockType || ""),
        status: String(payload.status || ""),
        source: String(filters.source || "")
      });
    }
  });
  const page = pageState.value;
  const summary = (page?.blocklistSummary || []) as Array<Record<string, string>>;
  const rows = (page?.blocklistRows || []) as Array<Record<string, string>>;
  const releaseQueue = (page?.blocklistReleaseQueue || []) as Array<Record<string, string>>;
  const releaseHistory = (page?.blocklistReleaseHistory || []) as Array<Record<string, string>>;
  const filteredRows = rows.filter((row) => !filters.source || String(stringOf(row, "source") || "system").toUpperCase() === filters.source.toUpperCase());
  const filteredReleaseQueue = [...releaseQueue]
    .filter((row) => {
      const keyword = releaseQueueKeyword.trim().toLowerCase();
      if (!keyword) {
        return true;
      }
      return [
        stringOf(row, "target"),
        stringOf(row, "condition"),
        stringOf(row, "releaseAt")
      ].join(" ").toLowerCase().includes(keyword);
    })
    .sort((left, right) => {
      if (releaseQueueSort === "TARGET") {
        return stringOf(left, "target").localeCompare(stringOf(right, "target"));
      }
      return (parseDateValue(stringOf(left, "releaseAt")) || 0) - (parseDateValue(stringOf(right, "releaseAt")) || 0);
    });
  const filteredReleaseHistory = releaseHistory.filter((row) => {
    const keyword = releaseHistoryKeyword.trim().toLowerCase();
    if (!keyword) {
      return true;
    }
    return [
      stringOf(row, "target"),
      stringOf(row, "reason"),
      stringOf(row, "releasedBy"),
      stringOf(row, "blockId")
    ].join(" ").toLowerCase().includes(keyword);
  });
  const totalBlocklistPages = Math.max(1, Math.ceil(filteredRows.length / BLOCKLIST_PAGE_SIZE));
  const pagedRows = filteredRows.slice((blocklistPage - 1) * BLOCKLIST_PAGE_SIZE, blocklistPage * BLOCKLIST_PAGE_SIZE);
  const totalReleaseQueuePages = Math.max(1, Math.ceil(filteredReleaseQueue.length / RELEASE_QUEUE_PAGE_SIZE));
  const pagedReleaseQueue = filteredReleaseQueue.slice((releaseQueuePage - 1) * RELEASE_QUEUE_PAGE_SIZE, releaseQueuePage * RELEASE_QUEUE_PAGE_SIZE);
  const totalReleaseHistoryPages = Math.max(1, Math.ceil(filteredReleaseHistory.length / BLOCKLIST_PAGE_SIZE));
  const pagedReleaseHistory = filteredReleaseHistory.slice((releaseHistoryPage - 1) * BLOCKLIST_PAGE_SIZE, releaseHistoryPage * BLOCKLIST_PAGE_SIZE);
  const expiringSoonRows = filteredRows
    .filter((row) => {
      if (String(stringOf(row, "status") || "").toUpperCase() !== "ACTIVE") {
        return false;
      }
      const expiresAt = parseDateValue(stringOf(row, "expiresAt"));
      if (expiresAt === null) {
        return false;
      }
      if (expiringFilter === "EXPIRED") {
        return expiresAt < Date.now();
      }
      if (expiringFilter === "TODAY") {
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        return expiresAt >= Date.now() && expiresAt <= endOfDay;
      }
      return isExpiringSoon(stringOf(row, "expiresAt"));
    })
    .sort((left, right) => (parseDateValue(stringOf(left, "expiresAt")) || 0) - (parseDateValue(stringOf(right, "expiresAt")) || 0))
    .slice(0, 5);
  const blockActionHistory = [
    ...rows.filter((row) => stringOf(row, "source").toLowerCase() === "monitoring").map((row) => ({
      target: stringOf(row, "target"),
      action: stringOf(row, "status"),
      happenedAt: stringOf(row, "updatedAt") || stringOf(row, "registeredAt") || stringOf(row, "expiresAt"),
      actor: stringOf(row, "owner"),
      detail: stringOf(row, "reason")
    })),
    ...releaseHistory.map((row) => ({
      target: stringOf(row, "target"),
      action: "RELEASED",
      happenedAt: stringOf(row, "releasedAt"),
      actor: stringOf(row, "releasedBy"),
      detail: stringOf(row, "reason")
    }))
  ]
    .filter((row) => row.target || row.happenedAt)
    .filter((row) => {
      const keyword = statusHistoryKeyword.trim().toLowerCase();
      if (!keyword) {
        return true;
      }
      return [row.target, row.action, row.actor, row.detail].join(" ").toLowerCase().includes(keyword);
    })
    .sort((left, right) => {
      if (statusHistorySort === "TARGET") {
        return left.target.localeCompare(right.target);
      }
      if (statusHistorySort === "ACTION") {
        return left.action.localeCompare(right.action);
      }
      return (parseDateValue(right.happenedAt) || 0) - (parseDateValue(left.happenedAt) || 0);
    });
  const totalStatusHistoryPages = Math.max(1, Math.ceil(blockActionHistory.length / STATUS_HISTORY_PAGE_SIZE));
  const pagedStatusHistory = blockActionHistory.slice((statusHistoryPage - 1) * STATUS_HISTORY_PAGE_SIZE, statusHistoryPage * STATUS_HISTORY_PAGE_SIZE);

  function exportBlocklistCsv() {
    const headers = ["blockId", "target", "blockType", "source", "reason", "status", "expiresAt", "owner"];
    const lines = [
      headers.join(","),
      ...filteredRows.map((row) => headers.map((header) => csvValue(stringOf(row, header))).join(","))
    ];
    downloadBlob(`blocklist-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportBlocklistJson() {
    downloadBlob(`blocklist-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(filteredRows, null, 2), "application/json;charset=utf-8");
  }

  function exportStatusHistoryCsv() {
    const headers = ["target", "action", "happenedAt", "actor", "detail"];
    const lines = [
      headers.join(","),
      ...blockActionHistory.map((row) => headers.map((header) => csvValue(String(row[header as keyof typeof row] || ""))).join(","))
    ];
    downloadBlob(`blocklist-status-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportStatusHistoryJson() {
    downloadBlob(`blocklist-status-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(blockActionHistory, null, 2), "application/json;charset=utf-8");
  }

  function exportReleaseQueueCsv() {
    const headers = ["target", "condition", "releaseAt", "source"];
    const lines = [
      headers.join(","),
      ...filteredReleaseQueue.map((row) => headers.map((header) => csvValue(stringOf(row, header))).join(","))
    ];
    downloadBlob(`blocklist-release-queue-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }

  function exportReleaseQueueJson() {
    downloadBlob(`blocklist-release-queue-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(filteredReleaseQueue, null, 2), "application/json;charset=utf-8");
  }

  function resetFilters() {
    const clearedFilters = {
      searchKeyword: "",
      blockType: "",
      status: "",
      source: ""
    };
    setDraft(clearedFilters);
    setFilters(clearedFilters);
    setOperationMessage("");
  }

  async function handleMonitoringCandidateAction(blockId: string, status: string, expiresAt?: string) {
    try {
      const response = await updateSecurityMonitoringBlockCandidate({ blockId, status, expiresAt: expiresAt || "" });
      setOperationMessage(String(response.message || (en ? "Block candidate updated." : "차단 후보 상태를 변경했습니다.")));
      await pageState.reload();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "blocklist", {
      route: window.location.pathname,
      summaryCount: summary.length,
      rowCount: rows.length,
      filteredRowCount: filteredRows.length,
      releaseQueueCount: releaseQueue.length,
      blockType: filters.blockType,
      status: filters.status,
      source: filters.source
    });
    logGovernanceScope("COMPONENT", "blocklist-table", {
      component: "blocklist-table",
      rowCount: rows.length,
      releaseQueueCount: releaseQueue.length
    });
  }, [filters.blockType, filters.source, filters.status, filteredRows.length, page, releaseQueue.length, rows.length, summary.length]);

  useEffect(() => {
    setBlocklistPage(1);
    setBlocklistPageInput("1");
  }, [filters.blockType, filters.searchKeyword, filters.source, filters.status, rows.length]);

  useEffect(() => {
    setReleaseQueuePage(1);
  }, [releaseQueueKeyword, releaseQueueSort, filteredReleaseQueue.length]);

  useEffect(() => {
    setReleaseHistoryPage(1);
    setReleaseHistoryPageInput("1");
  }, [releaseHistoryKeyword, releaseHistory.length]);

  useEffect(() => {
    setReleaseQueuePage(1);
    setReleaseQueuePageInput("1");
  }, [releaseQueueKeyword, releaseQueueSort, releaseQueue.length]);

  useEffect(() => {
    setStatusHistoryPage(1);
    setStatusHistoryPageInput("1");
  }, [statusHistoryKeyword, statusHistorySort, rows.length, releaseHistory.length]);

  useEffect(() => {
    setStatusHistoryPage(1);
  }, [statusHistorySort, blockActionHistory.length]);

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    if (filters.searchKeyword) nextSearch.set("searchKeyword", filters.searchKeyword);
    if (filters.blockType) nextSearch.set("blockType", filters.blockType);
    if (filters.status) nextSearch.set("status", filters.status);
    if (filters.source) nextSearch.set("source", filters.source);
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [filters.blockType, filters.searchKeyword, filters.source, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOperationMessage("");
    }, 4000);
    if (!operationMessage) {
      window.clearTimeout(timer);
      return;
    }
    return () => window.clearTimeout(timer);
  }, [operationMessage]);

  useEffect(() => {
    function handlePopState() {
      const nextFilters = readFiltersFromLocation();
      setFilters(nextFilters);
      setDraft(nextFilters);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function confirmPendingAction() {
    if (!pendingAction) {
      return;
    }
    await handleMonitoringCandidateAction(pendingAction.blockId, pendingAction.status, pendingAction.expiresAt);
    setPendingAction(null);
  }

  function actionDisableReason(row: Record<string, string>) {
    const source = stringOf(row, "source").toLowerCase();
    const status = stringOf(row, "status").toUpperCase();
    if (source !== "monitoring") {
      return en ? "Available only for monitoring-origin blocks." : "모니터링 승격 건에서만 처리할 수 있습니다.";
    }
    if (status !== "ACTIVE") {
      return en ? "Only active blocks can be extended or released." : "활성 상태 차단만 연장 또는 해제할 수 있습니다.";
    }
    return "";
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Blocklist" : "차단 대상 관리" }
      ]}
      title={en ? "Blocklist Management" : "차단 대상 관리"}
      subtitle={en ? "Operate blocked IP, CIDR, account, and user-agent targets and review release queue." : "IP, CIDR, 계정, User-Agent 단위 차단 대상을 운영하고 해제 대기열을 점검합니다."}
      loading={pageState.loading && !page && !pageState.error}
      loadingLabel={en ? "Loading blocklist management data." : "차단 대상 관리 데이터를 불러오는 중입니다."}
    >
      {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
      {operationMessage ? <PageStatusNotice tone={operationMessage.toLowerCase().includes("fail") || operationMessage.includes("오류") ? "error" : "success"}>{operationMessage}</PageStatusNotice> : null}

      <section className="gov-card mb-8" data-help-id="blocklist-search">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {en ? `Filtered ${filteredRows.length}` : `필터 결과 ${filteredRows.length}건`}
                </span>
                <MemberButton onClick={exportBlocklistCsv} size="sm" type="button" variant="secondary">
                  {en ? "Export CSV" : "CSV 다운로드"}
                </MemberButton>
                <MemberButton onClick={exportBlocklistJson} size="sm" type="button" variant="secondary">
                  {en ? "Export JSON" : "JSON 다운로드"}
                </MemberButton>
              </div>
            )}
            meta={en ? "Filter by target keyword, block type, source, and enforcement status." : "검색어, 차단 유형, 소스, 상태 기준으로 운영 대상을 빠르게 좁혀서 조회합니다."}
            title={en ? "Search Filters" : "검색 조건"}
          />
        </div>
        <form
          className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            logGovernanceScope("ACTION", "blocklist-search", {
              searchKeyword: draft.searchKeyword,
              blockType: draft.blockType,
              status: draft.status,
              source: draft.source
            });
            setFilters(draft);
          }}
        >
          <div className="md:col-span-2">
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
            <AdminInput
              placeholder={en ? "Block ID, target, reason, owner" : "차단 ID, 대상, 사유, 등록 주체 검색"}
              value={draft.searchKeyword}
              onChange={(event) => setDraft((current) => ({ ...current, searchKeyword: event.target.value }))}
            />
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Block Type" : "차단 유형"}</span>
            <AdminSelect value={draft.blockType} onChange={(event) => setDraft((current) => ({ ...current, blockType: event.target.value }))}>
              <option value="">{en ? "All Types" : "전체 유형"}</option>
              <option value="IP">IP</option>
              <option value="CIDR">CIDR</option>
              <option value="ACCOUNT">{en ? "Account" : "계정"}</option>
              <option value="UA">User-Agent</option>
            </AdminSelect>
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Source" : "소스"}</span>
            <AdminSelect value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}>
              <option value="">{en ? "All Sources" : "전체 소스"}</option>
              <option value="system">{en ? "System Rules" : "시스템 룰"}</option>
              <option value="monitoring">{en ? "Monitoring Escalation" : "모니터링 승격"}</option>
            </AdminSelect>
          </div>
          <div>
            <span className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</span>
            <AdminSelect value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}>
              <option value="">{en ? "All Status" : "전체 상태"}</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="RELEASED">RELEASED</option>
            </AdminSelect>
          </div>
          <div className="md:col-span-4">
            <div className="flex flex-col gap-3 border-t border-[var(--kr-gov-border-light)] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                {en
                  ? "Monitoring-origin blocks can be extended or released directly and keep their source event linkage."
                  : "모니터링 승격 차단은 원본 이벤트 연결을 유지한 채 즉시 해제하거나 1일 연장할 수 있습니다."}
              </p>
              <MemberButtonGroup className="justify-end">
                <MemberButton onClick={resetFilters} type="button" variant="secondary">
                  {en ? "Reset" : "초기화"}
                </MemberButton>
                <MemberButton icon="search" type="submit" variant="primary">
                  {en ? "Search" : "조회"}
                </MemberButton>
              </MemberButtonGroup>
            </div>
          </div>
        </form>
      </section>

      <section className="gov-card mb-8" data-help-id="blocklist-summary">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            meta={en ? "Review current block inventory, automation volume, and today's release workload." : "현재 적용 차단 수, 자동 생성 비중, 오늘의 해제 처리량을 함께 확인합니다."}
            title={en ? "Operational Summary" : "운영 요약"}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
          {summary.length === 0 ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)] md:col-span-2 xl:col-span-4">
              {en ? "No blocklist summary is available." : "표시할 차단 요약 정보가 없습니다."}
            </div>
          ) : summary.map((card, idx) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-5 py-5 shadow-sm" key={`${stringOf(card, "title")}-${idx}`}>
              <p className="text-xs font-bold tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{stringOf(card, "title") || "-"}</p>
              <p className="mt-3 text-3xl font-black text-[var(--kr-gov-text-primary)]">{stringOf(card, "value") || "0"}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(card, "description") || "-"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gov-card mb-8">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <AdminSelect value={expiringFilter} onChange={(event) => setExpiringFilter(event.target.value)}>
                <option value="24H">{en ? "Within 24h" : "24시간 이내"}</option>
                <option value="TODAY">{en ? "Today" : "오늘 만료"}</option>
                <option value="EXPIRED">{en ? "Expired" : "이미 만료"}</option>
              </AdminSelect>
            )}
            meta={en ? "Review blocks expiring within 24 hours and extend or release them before service impact changes." : "24시간 내 만료될 차단을 먼저 검토하고 연장 또는 해제를 빠르게 처리합니다."}
            title={en ? "Expiring Soon Review" : "만료 임박 검토"}
          />
        </div>
        <div className="space-y-3 px-6 py-6">
          {expiringSoonRows.length ? expiringSoonRows.map((row, idx) => (
            <div key={`${stringOf(row, "blockId")}-${idx}`} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong className="font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{stringOf(row, "target") || "-"}</strong>
                  <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(row, "expiresAt") || "-"}</p>
                  <p className="mt-2 text-[11px] font-bold text-[var(--kr-gov-blue)]">
                    {expiringFilter === "EXPIRED"
                      ? (en ? "Immediate cleanup review is recommended." : "즉시 정리 여부를 검토하는 것이 좋습니다.")
                      : expiringFilter === "TODAY"
                        ? (en ? "Decide today whether to extend or release." : "오늘 안에 연장 또는 해제를 판단하세요.")
                        : (en ? "Extend if the threat persists, otherwise release for review." : "위협이 지속되면 연장하고 아니면 해제를 검토하세요.")}
                  </p>
                </div>
                <MemberButtonGroup>
                  <a
                    className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-xs font-bold text-[var(--kr-gov-blue)] transition hover:bg-slate-50"
                    href={`${buildLocalizedPath("/admin/system/security-audit", "/en/admin/system/security-audit")}?searchKeyword=${encodeURIComponent(stringOf(row, "target"))}`}
                  >
                    {en ? "Audit Log" : "감사 로그"}
                  </a>
                  {actionDisableReason(row) ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700" title={actionDisableReason(row)}>
                      {en ? "View only" : "조회 전용"}
                    </span>
                  ) : (
                    <>
                      <MemberButton
                        onClick={() => {
                          const next = new Date();
                          next.setDate(next.getDate() + 1);
                          const expiresAt = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")} 23:59`;
                          setPendingAction({
                            blockId: stringOf(row, "blockId"),
                            status: "ACTIVE",
                            expiresAt,
                            target: stringOf(row, "target"),
                            actionLabel: en ? "Extend block by 1 day" : "차단 1일 연장"
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="primary"
                      >
                        {en ? "Extend 1d" : "1일 연장"}
                      </MemberButton>
                      <MemberButton
                        onClick={() => {
                          setPendingAction({
                            blockId: stringOf(row, "blockId"),
                            status: "RELEASED",
                            target: stringOf(row, "target"),
                            actionLabel: en ? "Release block" : "차단 해제"
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        {en ? "Release" : "해제"}
                      </MemberButton>
                    </>
                  )}
                </MemberButtonGroup>
              </div>
            </div>
          )) : (
            <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No active monitoring blocks are expiring within 24 hours." : "24시간 내 만료될 활성 모니터링 차단이 없습니다."}
            </div>
          )}
        </div>
      </section>

      <section className="gov-card mb-8 p-0 overflow-hidden" data-help-id="blocklist-table">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                {en ? `Page ${blocklistPage} / ${totalBlocklistPages}` : `${blocklistPage} / ${totalBlocklistPages} 페이지`}
              </span>
            )}
            meta={en ? "Use row actions for monitoring-origin entries without leaving the list." : "모니터링 승격 건은 목록에서 바로 원본 이벤트 확인, 해제, 1일 연장을 처리할 수 있습니다."}
            title={(
              <span className="text-[15px] font-semibold text-[var(--kr-gov-text-primary)]">
                {en ? "Blocked Targets" : "차단 정책 적용 대상"}{" "}
                <span className="text-[var(--kr-gov-blue)]">{filteredRows.length.toLocaleString()}</span>
              </span>
            )}
          />
        </div>
        <div className="overflow-x-auto">
          <AdminTable className="min-w-[1120px]">
            <thead>
              <tr className="border-y border-[var(--kr-gov-border-light)] bg-gray-50 text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">
                <th className="w-16 px-6 py-4 text-center">{en ? "No." : "번호"}</th>
                <th className="px-6 py-4">{en ? "Block ID" : "차단 ID"}</th>
                <th className="px-6 py-4">{en ? "Target" : "대상"}</th>
                <th className="px-6 py-4">{en ? "Type / Source" : "유형 / 소스"}</th>
                <th className="px-6 py-4">{en ? "Reason" : "사유"}</th>
                <th className="px-6 py-4">{en ? "Status" : "상태"}</th>
                <th className="px-6 py-4">{en ? "Expiration" : "만료"}</th>
                <th className="px-6 py-4">{en ? "Owner" : "등록 주체"}</th>
                <th className="px-6 py-4">{en ? "Actions" : "작업"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-gray-500" colSpan={9}>
                    {en ? "No block targets match the current filter." : "현재 조건에 맞는 차단 대상이 없습니다."}
                  </td>
                </tr>
              ) : pagedRows.map((row, idx) => {
                const source = stringOf(row, "source") || "system";
                const monitoring = source.toLowerCase() === "monitoring";
                const fingerprint = stringOf(row, "sourceFingerprint");
                const expiringSoon = isExpiringSoon(stringOf(row, "expiresAt"));
                const rowNumber = filteredRows.length - ((blocklistPage - 1) * BLOCKLIST_PAGE_SIZE + idx);
                return (
                  <tr className={`transition-colors hover:bg-gray-50/50 ${monitoring ? "bg-red-50/30" : ""}`.trim()} key={`${stringOf(row, "blockId")}-${idx}`}>
                    <td className="px-6 py-4 text-center text-gray-500">{rowNumber > 0 ? rowNumber : idx + 1}</td>
                    <td className="px-6 py-4 font-bold text-[var(--kr-gov-text-primary)]">{stringOf(row, "blockId") || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-[13px] text-[var(--kr-gov-text-primary)]">{stringOf(row, "target") || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                          {stringOf(row, "blockType") || "-"}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${sourceTone(source)}`}>
                          {monitoring ? (en ? "Monitoring" : "모니터링") : (en ? "System" : "시스템")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(row, "reason") || "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(stringOf(row, "status"))}`}>
                        {stringOf(row, "status") || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div>{stringOf(row, "expiresAt") || "-"}</div>
                      {expiringSoon ? (
                        <div className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          {en ? "Expiring Soon" : "만료 임박"}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{stringOf(row, "owner") || "-"}</td>
                    <td className="px-6 py-4">
                      <MemberButtonGroup>
                        <a
                          className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-xs font-bold text-[var(--kr-gov-blue)] transition hover:bg-slate-50"
                          href={`${buildLocalizedPath("/admin/system/security-audit", "/en/admin/system/security-audit")}?searchKeyword=${encodeURIComponent(stringOf(row, "target") || stringOf(row, "blockId"))}`}
                        >
                          {en ? "Audit Log" : "감사 로그"}
                        </a>
                        {monitoring && fingerprint ? (
                          <a
                            className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 text-xs font-bold text-[var(--kr-gov-blue)] transition hover:bg-slate-50"
                            href={`${buildLocalizedPath("/admin/system/security-monitoring", "/en/admin/system/security-monitoring")}?fingerprint=${encodeURIComponent(fingerprint)}`}
                          >
                            {en ? "Source Event" : "원본 이벤트"}
                          </a>
                        ) : null}
                        {monitoring && stringOf(row, "status").toUpperCase() === "ACTIVE" ? (
                          <>
                            <MemberButton
                              onClick={() => {
                                setPendingAction({
                                  blockId: stringOf(row, "blockId"),
                                  status: "RELEASED",
                                  target: stringOf(row, "target"),
                                  actionLabel: en ? "Release block" : "차단 해제"
                                });
                              }}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              {en ? "Release" : "해제"}
                            </MemberButton>
                            <MemberButton
                              onClick={() => {
                                const next = new Date();
                                next.setDate(next.getDate() + 1);
                                const expiresAt = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")} 23:59`;
                                setPendingAction({
                                  blockId: stringOf(row, "blockId"),
                                  status: "ACTIVE",
                                  expiresAt,
                                  target: stringOf(row, "target"),
                                  actionLabel: en ? "Extend block by 1 day" : "차단 1일 연장"
                                });
                              }}
                              size="sm"
                              type="button"
                              variant="primary"
                            >
                              {en ? "Extend 1d" : "1일 연장"}
                            </MemberButton>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700" title={actionDisableReason(row)}>
                            {en ? "View only" : "조회 전용"}
                          </span>
                        )}
                      </MemberButtonGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        </div>
        <MemberPagination currentPage={blocklistPage} onPageChange={setBlocklistPage} totalPages={totalBlocklistPages} />
        <div className="px-6 pb-6 pt-3">
          <div className="flex items-center justify-end gap-2 text-xs">
            <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
            <input
              className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
              value={blocklistPageInput}
              onChange={(event) => setBlocklistPageInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
              onClick={() => setBlocklistPage(clampBlocklistPageInput(blocklistPageInput, totalBlocklistPages))}
            >
              {en ? "Move" : "이동"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="gov-card" data-help-id="blocklist-release-queue">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <div className="flex flex-wrap items-center gap-2">
                  <AdminSelect className="min-w-[150px]" value={releaseQueueSort} onChange={(event) => setReleaseQueueSort(event.target.value)}>
                    <option value="RELEASE_AT">{en ? "Release time" : "해제 예정순"}</option>
                    <option value="TARGET">{en ? "Target name" : "대상명순"}</option>
                  </AdminSelect>
                  <MemberButton onClick={exportReleaseQueueCsv} size="sm" type="button" variant="secondary">
                    {en ? "CSV" : "CSV"}
                  </MemberButton>
                  <MemberButton onClick={exportReleaseQueueJson} size="sm" type="button" variant="secondary">
                    JSON
                  </MemberButton>
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {filteredReleaseQueue.length.toLocaleString()}
                  </span>
                </div>
              )}
              meta={en ? "Targets waiting for approved release or scheduled expiration." : "승인 대기 또는 예약 만료 기준으로 해제될 대상을 별도로 점검합니다."}
              title={en ? "Release Queue" : "해제 대기열"}
            />
          </div>
          <div className="space-y-3 px-6 py-6">
            <AdminInput
              className="max-w-[280px]"
              placeholder={en ? "Search release queue" : "해제 대기열 검색"}
              value={releaseQueueKeyword}
              onChange={(event) => setReleaseQueueKeyword(event.target.value)}
            />
            {pagedReleaseQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No targets in the release queue match the current filter." : "현재 조건에 맞는 해제 대기 대상이 없습니다."}
              </div>
            ) : pagedReleaseQueue.map((row, idx) => (
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm" key={`${stringOf(row, "target")}-${idx}`}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-mono text-[var(--kr-gov-text-primary)]">{stringOf(row, "target") || "-"}</strong>
                  <span className="text-sm text-gray-500">{stringOf(row, "releaseAt") || "-"}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "condition") || "-"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${sourceTone(stringOf(row, "source") || "system")}`}>
                    {stringOf(row, "source").toLowerCase() === "monitoring" ? (en ? "Monitoring" : "모니터링") : (en ? "System" : "시스템")}
                  </span>
                  <a
                    className="text-xs font-bold text-[var(--kr-gov-blue)] hover:underline"
                    href={`${buildLocalizedPath("/admin/system/security-audit", "/en/admin/system/security-audit")}?searchKeyword=${encodeURIComponent(stringOf(row, "target"))}`}
                  >
                    {en ? "Open audit log" : "감사 로그 열기"}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <MemberPagination className="mt-4 border-t-0 bg-transparent px-6 pb-6 pt-0" currentPage={releaseQueuePage} onPageChange={setReleaseQueuePage} totalPages={totalReleaseQueuePages} />
          <div className="px-6 pb-6 pt-0">
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
              <input
                className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
                value={releaseQueuePageInput}
                onChange={(event) => setReleaseQueuePageInput(event.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={() => setReleaseQueuePage(clampBlocklistPageInput(releaseQueuePageInput, totalReleaseQueuePages))}
              >
                {en ? "Move" : "이동"}
              </button>
            </div>
          </div>
        </section>

        <section className="gov-card" data-help-id="blocklist-release-history">
          <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
            <MemberSectionToolbar
              actions={(
                <AdminInput
                  className="max-w-[260px]"
                  placeholder={en ? "Search release history" : "해제 이력 검색"}
                  value={releaseHistoryKeyword}
                  onChange={(event) => setReleaseHistoryKeyword(event.target.value)}
                />
              )}
              meta={en ? "Search released targets by target, reason, release operator, or block id." : "대상, 사유, 해제 담당자, 차단 ID 기준으로 해제 이력을 재검색합니다."}
              title={en ? "Release History" : "차단 해제 이력"}
            />
          </div>
          <div className="space-y-3 px-6 py-6">
            {pagedReleaseHistory.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "No released monitoring blocks match the current filter." : "현재 조건에 맞는 차단 해제 이력이 없습니다."}
              </div>
            ) : pagedReleaseHistory.map((row, idx) => (
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm" key={`${stringOf(row, "blockId")}-${idx}`}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-mono text-[var(--kr-gov-text-primary)]">{stringOf(row, "target") || "-"}</strong>
                  <span className="text-sm text-gray-500">{stringOf(row, "releasedAt") || "-"}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(row, "reason") || "-"}</p>
                <p className="mt-2 text-xs text-gray-400">{stringOf(row, "releasedBy") || "-"} · {stringOf(row, "blockId") || "-"}</p>
              </div>
            ))}
          </div>
          <MemberPagination className="mt-4 border-t-0 bg-transparent px-6 pb-6 pt-0" currentPage={releaseHistoryPage} onPageChange={setReleaseHistoryPage} totalPages={totalReleaseHistoryPages} />
          <div className="px-6 pb-6 pt-0">
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
              <input
                className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
                value={releaseHistoryPageInput}
                onChange={(event) => setReleaseHistoryPageInput(event.target.value.replace(/[^0-9]/g, ""))}
              />
              <button
                type="button"
                className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
                onClick={() => setReleaseHistoryPage(clampBlocklistPageInput(releaseHistoryPageInput, totalReleaseHistoryPages))}
              >
                {en ? "Move" : "이동"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="gov-card mt-6" data-help-id="blocklist-status-history">
        <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
          <MemberSectionToolbar
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                <MemberButton onClick={exportStatusHistoryCsv} size="sm" type="button" variant="secondary">
                  {en ? "CSV" : "CSV"}
                </MemberButton>
                <MemberButton onClick={exportStatusHistoryJson} size="sm" type="button" variant="secondary">
                  JSON
                </MemberButton>
                <AdminSelect className="min-w-[150px]" value={statusHistorySort} onChange={(event) => setStatusHistorySort(event.target.value)}>
                  <option value="LATEST">{en ? "Latest first" : "최신순"}</option>
                  <option value="TARGET">{en ? "Target name" : "대상명순"}</option>
                  <option value="ACTION">{en ? "Action type" : "상태순"}</option>
                </AdminSelect>
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {blockActionHistory.length.toLocaleString()}
                </span>
              </div>
            )}
            meta={en ? "Recent monitoring-origin block actions and releases are merged into one timeline." : "모니터링 승격 건의 상태 변경과 해제 기록을 하나의 최근 타임라인으로 묶어 확인합니다."}
            title={en ? "Status Change History" : "상태 변경 이력"}
          />
        </div>
        <div className="px-6 pt-6">
          <AdminInput
            placeholder={en ? "Search target, action, actor, detail" : "대상, 상태, 작업자, 상세 검색"}
            value={statusHistoryKeyword}
            onChange={(event) => setStatusHistoryKeyword(event.target.value)}
          />
        </div>
        <div className="space-y-3 px-6 py-6">
          {blockActionHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--kr-gov-border-light)] px-4 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "No block status changes have been recorded yet." : "기록된 차단 상태 변경 이력이 없습니다."}
            </div>
          ) : pagedStatusHistory.map((row, idx) => (
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4 shadow-sm" key={`${row.target}-${idx}`}>
              <div className="flex items-center justify-between gap-3">
                <strong className="font-mono text-[var(--kr-gov-text-primary)]">{row.target || "-"}</strong>
                <span className="text-xs text-gray-400">{row.happenedAt || "-"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{row.detail || "-"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(row.action)}`}>{row.action || "-"}</span>
                <span className="text-xs text-gray-400">{row.actor || "-"}</span>
              </div>
            </div>
          ))}
        </div>
        <MemberPagination className="mt-4 border-t-0 bg-transparent px-6 pb-6 pt-0" currentPage={statusHistoryPage} onPageChange={setStatusHistoryPage} totalPages={totalStatusHistoryPages} />
        <div className="px-6 pb-6 pt-0">
          <div className="flex items-center justify-end gap-2 text-xs">
            <span className="text-[var(--kr-gov-text-secondary)]">{en ? "Go to page" : "페이지 이동"}</span>
            <input
              className="h-9 w-20 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-2 text-sm"
              value={statusHistoryPageInput}
              onChange={(event) => setStatusHistoryPageInput(event.target.value.replace(/[^0-9]/g, ""))}
            />
            <button
              type="button"
              className="rounded border border-[var(--kr-gov-border-light)] px-3 py-2 font-bold text-[var(--kr-gov-text-secondary)]"
              onClick={() => setStatusHistoryPage(clampBlocklistPageInput(statusHistoryPageInput, totalStatusHistoryPages))}
            >
              {en ? "Move" : "이동"}
            </button>
          </div>
        </div>
      </section>
      <ReviewModalFrame
        maxWidthClassName="max-w-xl"
        onClose={() => setPendingAction(null)}
        open={!!pendingAction}
        title={pendingAction?.actionLabel || (en ? "Confirm Action" : "작업 확인")}
        footerRight={(
          <>
            <MemberButton onClick={() => setPendingAction(null)} type="button" variant="secondary">
              {en ? "Cancel" : "취소"}
            </MemberButton>
            <MemberButton onClick={() => { void confirmPendingAction(); }} type="button" variant="primary">
              {en ? "Confirm" : "확인"}
            </MemberButton>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
            {en
              ? "Review the target and requested action before applying the monitoring-origin block update."
              : "모니터링 승격 차단에 대한 변경 내용을 확인한 뒤 작업을 적용합니다."}
          </p>
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target" : "대상"}</dt>
                <dd className="font-mono text-right text-[var(--kr-gov-text-primary)]">{pendingAction?.target || "-"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Action" : "작업"}</dt>
                <dd className="text-right text-[var(--kr-gov-text-primary)]">{pendingAction?.actionLabel || "-"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Expires At" : "만료 시각"}</dt>
                <dd className="text-right text-[var(--kr-gov-text-primary)]">{pendingAction?.expiresAt || (en ? "No change" : "변경 없음")}</dd>
              </div>
            </dl>
          </div>
        </div>
      </ReviewModalFrame>
    </AdminPageShell>
  );
}
