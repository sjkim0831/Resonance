import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  deleteCodexSrTicket,
  directExecuteCodexSrTicket,
  executeCodexProvision,
  executeCodexSrTicket,
  fetchCodexHistory,
  fetchCodexProvisionPage,
  fetchCodexSrTicketArtifact,
  fetchCodexSrTicketDetail,
  inspectCodexHistory,
  planCodexSrTicket,
  prepareCodexSrTicket,
  queueDirectExecuteCodexSrTicket,
  reissueCodexSrTicket,
  rollbackCodexSrTicket,
  remediateCodexHistory,
  skipPlanExecuteCodexSrTicket,
  runCodexLoginCheck
} from "../../lib/api/platform";
import type {
  CodexHistoryPayload,
  CodexProvisionPagePayload,
  SrTicketArtifactPayload,
  SrTicketDetailPayload,
  SrTicketRow
} from "../../lib/api/platformTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ContextKeyStrip } from "../admin-ui/ContextKeyStrip";
import { codexWorkbenchContextKeys } from "../admin-ui/contextKeyPresets";
import { stringOf } from "../admin-system/adminSystemShared";
import { PageStatusNotice } from "../admin-ui/common";

function numberOrDash(value: unknown) {
  return value == null || value === "" ? "-" : String(value);
}

function boolOf(value: unknown) {
  return value === true;
}

function textOrDash(value: unknown) {
  return value == null || value === "" ? "-" : String(value);
}

function executionBadgeClass(status: string) {
  switch ((status || "").toUpperCase()) {
    case "PLAN_COMPLETED":
    case "CODEX_COMPLETED":
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700";
    case "READY_FOR_CODEX":
    case "APPROVED_READY":
      return "bg-blue-100 text-blue-700";
    case "PLAN_RUNNING":
    case "RUNNING_CODEX":
      return "bg-amber-100 text-amber-700";
    case "PLAN_FAILED":
    case "RUNNER_ERROR":
    case "VERIFY_FAILED":
    case "CODEX_FAILED":
    case "DEPLOY_FAILED":
    case "CHANGED_FILE_BLOCKED":
    case "RUNNER_BLOCKED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function queueBadgeClass(status: string) {
  switch ((status || "").toUpperCase()) {
    case "QUEUED":
      return "bg-purple-100 text-purple-700";
    case "RUNNING":
      return "bg-amber-100 text-amber-700";
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700";
    case "FAILED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function artifactBody(payload: SrTicketArtifactPayload | null | undefined, emptyMessage: string) {
  if (!payload) {
    return emptyMessage;
  }
  if (payload.available && payload.content) {
    return payload.content;
  }
  return payload.message || emptyMessage;
}

function exitStatusLabel(value: number | null | undefined, en: boolean) {
  if (value == null) {
    return en ? "Not run" : "미실행";
  }
  return value === 0 ? (en ? "OK (0)" : "성공 (0)") : (en ? `Failed (${value})` : `실패 (${value})`);
}

function isExecutionRunning(status: string | undefined) {
  const normalized = (status || "").toUpperCase();
  return normalized === "PLAN_RUNNING" || normalized === "RUNNING_CODEX";
}

function canStreamPlanArtifact(artifactType: string) {
  return artifactType === "plan-log" || artifactType === "plan-stderr";
}

function canStreamBuildArtifact(artifactType: string) {
  return artifactType === "build-log" || artifactType === "build-stderr" || artifactType === "rollback-log" || artifactType === "rollback-stderr";
}

function isRollbackRunning(status: string | undefined) {
  return (status || "").toUpperCase() === "MANUAL_ROLLBACK_RUNNING";
}

function canBuildTicket(status: string | undefined) {
  const normalized = (status || "").toUpperCase();
  return normalized === "PLAN_COMPLETED";
}

function canApprovedShortcut(ticket: SrTicketRow) {
  return (ticket.status || "").toUpperCase() === "APPROVED";
}

function isPlanCompleted(status: string | undefined) {
  const normalized = (status || "").toUpperCase();
  return normalized === "PLAN_COMPLETED" || normalized === "CODEX_COMPLETED" || normalized === "COMPLETED";
}

function buildActionHint(status: string | undefined, en: boolean) {
  const normalized = (status || "").toUpperCase();
  if (normalized === "PLAN_RUNNING") {
    return en ? "Build unlocks after PLAN completes." : "PLAN 완료 후 실행 가능합니다.";
  }
  if (normalized === "RUNNING_CODEX") {
    return en ? "Build is already running." : "이미 실행 중입니다.";
  }
  if (normalized !== "PLAN_COMPLETED") {
    return en ? "Build unlocks after PLAN completes." : "PLAN 완료 후 실행 가능합니다.";
  }
  return "";
}

function approvedShortcutHint(ticket: SrTicketRow, en: boolean) {
  if (isExecutionRunning(ticket.executionStatus)) {
    return en ? "A Codex job is already running." : "이미 Codex 작업이 실행 중입니다.";
  }
  if (!canApprovedShortcut(ticket)) {
    return en ? "Shortcut actions are available only for APPROVED tickets." : "바로 실행과 계획 없이 실행은 APPROVED 상태에서만 가능합니다.";
  }
  return "";
}

function updateTicketRow(rows: SrTicketRow[], ticketId: string, updater: (ticket: SrTicketRow) => SrTicketRow) {
  return rows.map((ticket) => (ticket.ticketId === ticketId ? updater(ticket) : ticket));
}

export function CodexProvisionMigrationPage() {
  const queuePageSize = 3;
  const en = isEnglish();
  const pageState = useAsyncValue<CodexProvisionPagePayload>(fetchCodexProvisionPage, []);
  const historyState = useAsyncValue<CodexHistoryPayload>(fetchCodexHistory, []);
  const [payload, setPayload] = useState("");
  const [responseText, setResponseText] = useState(en ? "No execution result yet." : "아직 호출 결과가 없습니다.");
  const [httpStatus, setHttpStatus] = useState("-");
  const [createdCount, setCreatedCount] = useState("-");
  const [existingCount, setExistingCount] = useState("-");
  const [skippedCount, setSkippedCount] = useState("-");
  const [error, setError] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<SrTicketDetailPayload | null>(null);
  const [selectedTicketError, setSelectedTicketError] = useState("");
  const [selectedTicketLoading, setSelectedTicketLoading] = useState(false);
  const [planArtifact, setPlanArtifact] = useState<SrTicketArtifactPayload | null>(null);
  const [buildArtifact, setBuildArtifact] = useState<SrTicketArtifactPayload | null>(null);
  const [artifactLoading, setArtifactLoading] = useState(false);
  const [selectedPlanArtifactType, setSelectedPlanArtifactType] = useState("plan-result");
  const [selectedBuildArtifactType, setSelectedBuildArtifactType] = useState("build-result");
  const [ticketContextReloadKey, setTicketContextReloadKey] = useState(0);
  const [queuePageIndex, setQueuePageIndex] = useState(0);

  const historyRows = historyState.value?.items || [];
  const historyCount = historyState.value?.totalCount ?? historyRows.length;
  const codexEnabled = pageState.value?.codexEnabled === true;
  const codexApiKeyConfigured = pageState.value?.codexApiKeyConfigured === true;
  const codexReady = codexEnabled && codexApiKeyConfigured;
  const codexAvailabilityMessage = stringOf(pageState.value, "codexAvailabilityMessage");
  const runtimeConfig = pageState.value?.codexRuntimeConfig || {};
  const srTickets = pageState.value?.srTickets || [];
  const srTicketCount = pageState.value?.srTicketCount ?? srTickets.length;
  const executionLanes = (pageState.value?.executionLanes || []) as Array<Record<string, unknown>>;
  const queuePageCount = Math.max(1, Math.ceil(srTickets.length / queuePageSize));
  const normalizedQueuePageIndex = Math.min(queuePageIndex, queuePageCount - 1);
  const pagedTickets = srTickets.slice(normalizedQueuePageIndex * queuePageSize, (normalizedQueuePageIndex + 1) * queuePageSize);

  useEffect(() => {
    logGovernanceScope("PAGE", "codex-provision", {
      language: en ? "en" : "ko",
      codexReady,
      srTicketCount,
      historyCount,
      selectedTicketId,
      queuePageIndex: normalizedQueuePageIndex
    });
    logGovernanceScope("COMPONENT", "codex-provision-ticket-queue", {
      pagedTicketCount: pagedTickets.length,
      queuePageCount,
      selectedTicketId,
      selectedPlanArtifactType,
      selectedBuildArtifactType
    });
  }, [
    codexReady,
    en,
    historyCount,
    normalizedQueuePageIndex,
    pagedTickets.length,
    queuePageCount,
    selectedBuildArtifactType,
    selectedPlanArtifactType,
    selectedTicketId,
    srTicketCount
  ]);

  useEffect(() => {
    if (pageState.value?.codexSamplePayload) {
      setPayload(String(pageState.value.codexSamplePayload));
    }
  }, [pageState.value?.codexSamplePayload]);

  useEffect(() => {
    if (srTickets.length === 0) {
      setQueuePageIndex(0);
      setSelectedTicketId("");
      setSelectedTicketDetail(null);
      setPlanArtifact(null);
      setBuildArtifact(null);
      setSelectedPlanArtifactType("plan-result");
      setSelectedBuildArtifactType("build-result");
      return;
    }
    const exists = srTickets.some((ticket) => ticket.ticketId === selectedTicketId);
    if (!selectedTicketId || !exists) {
      setSelectedTicketId(srTickets[0].ticketId);
    }
  }, [selectedTicketId, srTickets]);

  useEffect(() => {
    if (queuePageIndex !== normalizedQueuePageIndex) {
      setQueuePageIndex(normalizedQueuePageIndex);
    }
  }, [normalizedQueuePageIndex, queuePageIndex]);

  useEffect(() => {
    if (!selectedTicketId || srTickets.length === 0) {
      return;
    }
    const selectedIndex = srTickets.findIndex((ticket) => ticket.ticketId === selectedTicketId);
    if (selectedIndex < 0) {
      return;
    }
    const nextPageIndex = Math.floor(selectedIndex / queuePageSize);
    if (nextPageIndex !== normalizedQueuePageIndex) {
      setQueuePageIndex(nextPageIndex);
    }
  }, [normalizedQueuePageIndex, selectedTicketId, srTickets]);

  useEffect(() => {
    if (!selectedTicketId || !codexReady) {
      return;
    }
    let cancelled = false;
    async function loadSelectedTicketContext(ticketId: string) {
      setSelectedTicketLoading(true);
      setArtifactLoading(true);
      setSelectedTicketError("");
      try {
        const detail = await fetchCodexSrTicketDetail(ticketId);
        if (cancelled) {
          return;
        }
        setSelectedTicketDetail(detail);
        const planArtifactType = detail.ticket.planResultPath ? "plan-result" : (detail.ticket.planStderrPath ? "plan-stderr" : "plan-log");
        const buildArtifactType = detail.ticket.executionLogPath
          ? "build-result"
          : (detail.ticket.executionStderrPath ? "build-stderr" : (detail.ticket.executionDiffPath ? "build-diff" : "build-changed-summary"));
        setSelectedPlanArtifactType(planArtifactType);
        setSelectedBuildArtifactType(buildArtifactType);
        const [nextPlanArtifact, nextBuildArtifact] = await Promise.all([
          fetchCodexSrTicketArtifact(ticketId, planArtifactType),
          fetchCodexSrTicketArtifact(ticketId, buildArtifactType)
        ]);
        if (cancelled) {
          return;
        }
        setPlanArtifact(nextPlanArtifact);
        setBuildArtifact(nextBuildArtifact);
      } catch (nextError) {
        if (!cancelled) {
          setSelectedTicketError(nextError instanceof Error ? nextError.message : (en ? "Failed to load ticket detail." : "티켓 상세를 불러오지 못했습니다."));
          setSelectedTicketDetail(null);
          setPlanArtifact(null);
          setBuildArtifact(null);
        }
      } finally {
        if (!cancelled) {
          setSelectedTicketLoading(false);
          setArtifactLoading(false);
        }
      }
    }
    void loadSelectedTicketContext(selectedTicketId);
    return () => {
      cancelled = true;
    };
  }, [codexReady, en, selectedTicketId, ticketContextReloadKey]);

  function renderResponse(status: string, body: unknown) {
    setHttpStatus(status);
    const record = (body || {}) as Record<string, unknown>;
    setCreatedCount(numberOrDash(record.createdCount));
    setExistingCount(numberOrDash(record.existingCount));
    setSkippedCount(numberOrDash(record.skippedCount));
    setResponseText(typeof body === "string" ? body : JSON.stringify(body, null, 2));
  }

  async function withResult(action: () => Promise<unknown>) {
    setError("");
    try {
      const result = await action();
      renderResponse("200", result);
      await historyState.reload();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : (en ? "Request failed." : "요청 처리에 실패했습니다.");
      setError(message);
      setResponseText(message);
    }
  }

  async function withTicketAction<T extends { message?: string }>(ticketId: string, action: () => Promise<T>) {
    setError("");
    try {
      const result = await action();
      setResponseText(JSON.stringify(result, null, 2));
      setHttpStatus("200");
      setSelectedTicketId(ticketId);
      setTicketContextReloadKey((current) => current + 1);
      await Promise.all([historyState.reload(), pageState.reload()]);
      return result;
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : (en ? "Ticket action failed." : "티켓 처리에 실패했습니다.");
      setError(message);
      setResponseText(message);
      throw nextError;
    }
  }

  async function handleReissueTicket(ticket: SrTicketRow) {
    setError("");
    try {
      const result = await reissueCodexSrTicket(ticket.ticketId);
      setResponseText(JSON.stringify(result, null, 2));
      setHttpStatus("200");
      await Promise.all([historyState.reload(), pageState.reload()]);
      if (result.ticket?.ticketId) {
        setSelectedTicketId(result.ticket.ticketId);
        setTicketContextReloadKey((current) => current + 1);
      }
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : (en ? "Ticket reissue failed." : "티켓 재발행에 실패했습니다.");
      setError(message);
      setResponseText(message);
    }
  }

  async function handleRollbackTicket(ticket: SrTicketRow) {
    setError("");
    const previousTicket = { ...ticket };
    patchTicketState(ticket.ticketId, (current) => ({
      ...current,
      rollbackStatus: "MANUAL_ROLLBACK_RUNNING",
      executionComment: en ? "Manual rollback is running." : "수동 롤백 실행 중입니다."
    }));
    if (selectedTicketId === ticket.ticketId) {
      setSelectedBuildArtifactType("rollback-log");
      setBuildArtifact(null);
    }
    try {
      await withTicketAction(ticket.ticketId, () => rollbackCodexSrTicket(ticket.ticketId));
    } catch (nextError) {
      patchTicketState(ticket.ticketId, () => previousTicket);
      throw nextError;
    }
  }

  async function loadArtifact(ticketId: string, artifactType: string, target: "plan" | "build") {
    setArtifactLoading(true);
    try {
      const artifact = await fetchCodexSrTicketArtifact(ticketId, artifactType);
      if (target === "plan") {
        setSelectedPlanArtifactType(artifactType);
        setPlanArtifact(artifact);
      } else {
        setSelectedBuildArtifactType(artifactType);
        setBuildArtifact(artifact);
      }
    } catch (nextError) {
      setSelectedTicketError(nextError instanceof Error ? nextError.message : (en ? "Failed to load artifact." : "아티팩트를 불러오지 못했습니다."));
    } finally {
      setArtifactLoading(false);
    }
  }

  function patchTicketState(ticketId: string, updater: (ticket: SrTicketRow) => SrTicketRow) {
    pageState.setValue((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        srTickets: updateTicketRow(current.srTickets || [], ticketId, updater)
      };
    });
    setSelectedTicketDetail((current) => {
      if (!current || current.ticket.ticketId !== ticketId) {
        return current;
      }
      return {
        ...current,
        ticket: updater(current.ticket)
      };
    });
  }

  async function handlePrepareTicket(ticket: SrTicketRow) {
    const startedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    patchTicketState(ticket.ticketId, (current) => ({
      ...current,
      executionStatus: "READY_FOR_CODEX",
      executionComment: en
        ? "Switching ticket to ready-for-Codex state."
        : "Codex 실행 준비 상태로 전환 중입니다.",
      updatedAt: startedAt,
      executionPreparedAt: current.executionPreparedAt || startedAt
    }));
    await withTicketAction(ticket.ticketId, () => prepareCodexSrTicket(ticket.ticketId));
  }

  async function handlePlanTicket(ticket: SrTicketRow) {
    const startedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    patchTicketState(ticket.ticketId, (current) => ({
      ...current,
      executionStatus: "PLAN_RUNNING",
      executionComment: en
        ? "Codex PLAN is running."
        : "Codex PLAN 실행 중입니다.",
      updatedAt: startedAt,
      planStartedAt: startedAt
    }));
    if (selectedTicketId === ticket.ticketId) {
      setPlanArtifact(null);
      setSelectedPlanArtifactType("plan-result");
    }
    setTicketContextReloadKey((current) => current + 1);
    await withTicketAction(ticket.ticketId, () => planCodexSrTicket(ticket.ticketId));
  }

  async function handleBuildTicket(ticket: SrTicketRow) {
    const startedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    patchTicketState(ticket.ticketId, (current) => ({
      ...current,
      executionStatus: "RUNNING_CODEX",
      executionComment: en
        ? "Codex BUILD is running."
        : "Codex BUILD 실행 중입니다.",
      updatedAt: startedAt,
      executionStartedAt: startedAt
    }));
    if (selectedTicketId === ticket.ticketId) {
      setBuildArtifact(null);
      setSelectedBuildArtifactType("build-result");
    }
    setTicketContextReloadKey((current) => current + 1);
    await withTicketAction(ticket.ticketId, () => executeCodexSrTicket(ticket.ticketId));
  }

  async function handleDirectExecuteTicket(ticket: SrTicketRow) {
    const startedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    patchTicketState(ticket.ticketId, (current) => ({
      ...current,
      executionStatus: "PLAN_RUNNING",
      executionComment: en
        ? "Direct execution is preparing PLAN and BUILD."
        : "바로 실행이 PLAN과 BUILD를 순차 진행 중입니다.",
      updatedAt: startedAt,
      planStartedAt: startedAt
    }));
    if (selectedTicketId === ticket.ticketId) {
      setPlanArtifact(null);
      setBuildArtifact(null);
      setSelectedPlanArtifactType("plan-result");
      setSelectedBuildArtifactType("build-result");
    }
    setTicketContextReloadKey((current) => current + 1);
    await withTicketAction(ticket.ticketId, () => directExecuteCodexSrTicket(ticket.ticketId));
  }

  async function handleQueueDirectExecuteTicket(ticket: SrTicketRow) {
    await withTicketAction(ticket.ticketId, () => queueDirectExecuteCodexSrTicket(ticket.ticketId));
  }

  async function handleSkipPlanExecuteTicket(ticket: SrTicketRow) {
    const startedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    const result = await withTicketAction(ticket.ticketId, () => skipPlanExecuteCodexSrTicket(ticket.ticketId));
    patchTicketState(ticket.ticketId, (current) => {
      const nextTicket = result?.ticket ? { ...current, ...result.ticket } : { ...current };
      const nextStatus = (nextTicket.executionStatus || "").toUpperCase();
      if (!nextStatus || nextStatus === "APPROVED_READY" || nextStatus === "READY_FOR_CODEX") {
        nextTicket.executionStatus = "RUNNING_CODEX";
      }
      if (!nextTicket.executionStartedAt) {
        nextTicket.executionStartedAt = startedAt;
      }
      if (!nextTicket.updatedAt) {
        nextTicket.updatedAt = startedAt;
      }
      if (!nextTicket.executionComment || nextTicket.executionComment === current.executionComment) {
        nextTicket.executionComment = en
          ? "Codex BUILD is running without PLAN."
          : "PLAN 없이 Codex BUILD 실행 중입니다.";
      }
      return nextTicket;
    });
    setTicketContextReloadKey((current) => current + 1);
  }

  const selectedTicket = selectedTicketDetail?.ticket || srTickets.find((ticket) => ticket.ticketId === selectedTicketId) || null;
  const reviewSummary = selectedTicketDetail?.reviewSummary || {};

  useEffect(() => {
    if (!selectedTicket || !isExecutionRunning(selectedTicket.executionStatus)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setTicketContextReloadKey((current) => current + 1);
      void pageState.reload();
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pageState, selectedTicket, ticketContextReloadKey]);

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }
    const ticketId = selectedTicket.ticketId;
    const executionStatus = selectedTicket.executionStatus;
    const streamPlanArtifact = executionStatus === "PLAN_RUNNING" && canStreamPlanArtifact(selectedPlanArtifactType);
    const streamBuildArtifact = (executionStatus === "RUNNING_CODEX" || isRollbackRunning(selectedTicket.rollbackStatus)) && canStreamBuildArtifact(selectedBuildArtifactType);
    if (!streamPlanArtifact && !streamBuildArtifact) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      async function refreshArtifacts() {
        try {
          if (streamPlanArtifact) {
            const nextPlanArtifact = await fetchCodexSrTicketArtifact(ticketId, selectedPlanArtifactType);
            if (!cancelled) {
              setPlanArtifact(nextPlanArtifact);
            }
          }
          if (streamBuildArtifact) {
            const nextBuildArtifact = await fetchCodexSrTicketArtifact(ticketId, selectedBuildArtifactType);
            if (!cancelled) {
              setBuildArtifact(nextBuildArtifact);
            }
          }
        } catch {
          if (!cancelled) {
            setSelectedTicketError(en ? "Failed to refresh running artifact." : "실행 중 아티팩트를 새로고침하지 못했습니다.");
          }
        }
      }
      void refreshArtifacts();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [en, selectedBuildArtifactType, selectedPlanArtifactType, selectedTicket]);

  const buildArtifactPreviewText = artifactLoading
    ? (en ? "Loading build artifact..." : "Build 아티팩트를 불러오는 중입니다.")
    : (selectedTicket && selectedTicket.executionStatus === "RUNNING_CODEX" && !canStreamBuildArtifact(selectedBuildArtifactType)
      ? (en ? "BUILD is still running. Artifact will appear when the run completes." : "BUILD 실행 중입니다. 실행이 끝나면 아티팩트가 표시됩니다.")
      : (selectedTicket && isRollbackRunning(selectedTicket.rollbackStatus) && !canStreamBuildArtifact(selectedBuildArtifactType)
        ? (en ? "Rollback is still running. Select rollback-log or rollback-stderr to follow progress." : "롤백 실행 중입니다. 진행 상황은 rollback-log 또는 rollback-stderr를 선택해 확인하세요.")
        : artifactBody(buildArtifact, en ? "No BUILD artifact yet." : "아직 BUILD 아티팩트가 없습니다.")));

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "Codex Execution Console" : "Codex 실행 콘솔" }
      ]}
      title={en ? "Codex Execution Console" : "Codex 실행 콘솔"}
      subtitle={en ? "Operate the SR ticket queue, review PLAN and BUILD artifacts, and use the legacy admin proxy from one console." : "SR 티켓 큐를 운영하고 PLAN/BUILD 아티팩트를 검토하며 기존 관리자 프록시도 함께 사용하는 중앙 실행 콘솔입니다."}
      contextStrip={
        <ContextKeyStrip items={codexWorkbenchContextKeys} />
      }
    >
      {pageState.error || historyState.error || error || selectedTicketError ? (
        <PageStatusNotice tone="error">
          {error || selectedTicketError || pageState.error || historyState.error}
        </PageStatusNotice>
      ) : null}
      {!codexReady ? (
        <PageStatusNotice tone="warning">
          {codexAvailabilityMessage || (en ? "Codex execution is not available in this environment." : "이 환경에서는 Codex 실행을 사용할 수 없습니다.")}
        </PageStatusNotice>
      ) : null}
      <section className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <article className="gov-card" data-help-id="codex-request-runtime">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">tune</span>
            <h3 className="text-lg font-bold">{en ? "Runtime Configuration" : "런타임 설정"}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Codex API" : "Codex API"}</div>
              <div className="mt-1 font-semibold">{codexEnabled ? (en ? "Enabled" : "활성") : (en ? "Disabled" : "비활성")}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Runner" : "Runner"}</div>
              <div className="mt-1 font-semibold">{runtimeConfig.runnerEnabled ? (en ? "Enabled" : "활성") : (en ? "Disabled" : "비활성")}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">repo-root</div>
              <div className="mt-1 font-mono text-xs break-all">{textOrDash(runtimeConfig.repoRoot)}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">workspace-root</div>
              <div className="mt-1 font-mono text-xs break-all">{textOrDash(runtimeConfig.workspaceRoot)}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">runner-history-file</div>
              <div className="mt-1 font-mono text-xs break-all">{textOrDash(runtimeConfig.runnerHistoryFile)}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">plan-command</div>
              <div className="mt-1 font-semibold">{runtimeConfig.planCommandConfigured ? (en ? "Configured" : "설정됨") : (en ? "Missing" : "미설정")}</div>
              <div className="mt-2 font-mono text-[11px] break-all">{textOrDash(runtimeConfig.planCommand)}</div>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-[var(--kr-gov-text-secondary)]">build-command</div>
              <div className="mt-1 font-semibold">{runtimeConfig.buildCommandConfigured ? (en ? "Configured" : "설정됨") : (en ? "Missing" : "미설정")}</div>
              <div className="mt-2 font-mono text-[11px] break-all">{textOrDash(runtimeConfig.buildCommand)}</div>
            </div>
          </div>
        </article>
        <article className="gov-card" data-help-id="codex-response-panel">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">monitoring</span>
            <h3 className="text-lg font-bold">{en ? "Response Result" : "응답 결과"}</h3>
          </div>
          <div className="flex flex-wrap gap-3 mb-4 text-sm">
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-[var(--kr-gov-text-secondary)]">HTTP: <strong>{httpStatus}</strong></div>
            <div className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">CREATED: <strong>{createdCount}</strong></div>
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">EXISTING: <strong>{existingCount}</strong></div>
            <div className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">SKIPPED: <strong>{skippedCount}</strong></div>
          </div>
          <pre className="rounded-[var(--kr-gov-radius)] bg-slate-950 text-slate-100 p-4 text-xs md:text-sm font-mono whitespace-pre-wrap break-all leading-6 min-h-[14rem]">{responseText}</pre>
        </article>
      </section>
      <section className="gov-card mt-6" data-help-id="codex-request-history-review">
        <div data-help-id="codex-history-table" hidden />
        <div className="flex flex-col gap-3 border-b pb-4 mb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold">{en ? "SR Execution Queue" : "SR 실행 큐"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Prepare, plan, build, and inspect SR tickets from the central Codex console." : "중앙 Codex 콘솔에서 SR 티켓을 준비, 계획 수립, 빌드 실행, 상세 검토합니다."}
            </p>
          </div>
          <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            {srTicketCount}{en ? " tickets" : "건"}
          </div>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {executionLanes.map((lane, index) => (
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3" key={index}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{String(lane.laneId || "-")}</div>
                  <div className="mt-1 text-sm font-semibold">{String(lane.tmuxSessionName || "-")}</div>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${queueBadgeClass(String(lane.status || ""))}`}>{String(lane.status || "-")}</span>
              </div>
              <div className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                {en ? "Active Ticket" : "실행 티켓"}: {String(lane.activeTicketId || "-")}
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="gov-table-header">
                <th className="px-4 py-3 text-left">{en ? "Ticket" : "티켓"}</th>
                <th className="px-4 py-3 text-left">{en ? "Summary" : "요약"}</th>
                <th className="px-4 py-3 text-left">{en ? "Execution" : "실행상태"}</th>
                <th className="px-4 py-3 text-left">{en ? "Actions" : "조치"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {srTickets.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={4}>{en ? "No SR tickets loaded." : "불러온 SR 티켓이 없습니다."}</td></tr> : pagedTickets.map((ticket: SrTicketRow) => (
                <tr className={`align-top cursor-pointer ${ticket.ticketId === selectedTicketId ? "bg-blue-50/70" : ""}`} key={ticket.ticketId} onClick={() => { setSelectedTicketId(ticket.ticketId); }}>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-semibold">{ticket.ticketId}</div>
                    <div className="text-xs text-gray-500">{ticket.pageLabel || ticket.pageId || "-"}</div>
                    <div className="text-xs text-gray-400">{ticket.surfaceLabel || "-"} / {ticket.eventLabel || "-"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{ticket.summary || "-"}</div>
                    <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{ticket.instruction || "-"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${executionBadgeClass(ticket.executionStatus)}`}>{ticket.executionStatus || "-"}</span>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${queueBadgeClass(ticket.queueStatus)}`}>{ticket.queueStatus || "IDLE"}</span>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-gray-500">
                      <div>{ticket.executionComment || "-"}</div>
                      {ticket.queueLaneId ? <div>lane: {ticket.queueLaneId} / {ticket.queueTmuxSessionName || "-"}</div> : null}
                      {ticket.queueSubmittedAt ? <div>queued: {ticket.queueSubmittedAt}</div> : null}
                      {ticket.planCompletedAt ? <div>plan: {ticket.planCompletedAt}</div> : null}
                      {ticket.executionCompletedAt ? <div>build: {ticket.executionCompletedAt}</div> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2">
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus) || ticket.queueStatus === "QUEUED" || ticket.queueStatus === "RUNNING" || !canApprovedShortcut(ticket)} onClick={(event) => { event.stopPropagation(); void handleQueueDirectExecuteTicket(ticket); }} type="button">{en ? "Queue Run" : "대기열 실행"}</button>
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus)} onClick={(event) => { event.stopPropagation(); void handlePrepareTicket(ticket); }} type="button">{en ? "Prepare" : "준비"}</button>
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus)} onClick={(event) => { event.stopPropagation(); void handlePlanTicket(ticket); }} type="button">{isPlanCompleted(ticket.executionStatus) ? (en ? "Replan" : "재계획") : (en ? "Plan" : "계획")}</button>
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady} onClick={(event) => { event.stopPropagation(); void handleReissueTicket(ticket); }} type="button">{en ? "Reissue" : "재발행"}</button>
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus) || !canApprovedShortcut(ticket)} onClick={(event) => { event.stopPropagation(); void handleDirectExecuteTicket(ticket); }} type="button">{en ? "Run Now" : "바로 실행"}</button>
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus) || !canApprovedShortcut(ticket)} onClick={(event) => { event.stopPropagation(); void handleSkipPlanExecuteTicket(ticket); }} type="button">{en ? "Skip Plan" : "계획 없이 실행"}</button>
                      {approvedShortcutHint(ticket, en) ? <div className="max-w-[12rem] text-[11px] leading-4 text-slate-600 whitespace-normal">{approvedShortcutHint(ticket, en)}</div> : null}
                      <button className="gov-btn gov-btn-primary !px-3 !py-1.5 text-xs" disabled={!codexReady || isExecutionRunning(ticket.executionStatus) || !canBuildTicket(ticket.executionStatus)} onClick={(event) => { event.stopPropagation(); void handleBuildTicket(ticket); }} type="button">{en ? "Build" : "실행"}</button>
                      {buildActionHint(ticket.executionStatus, en) ? <div className="max-w-[12rem] text-[11px] leading-4 text-amber-700 whitespace-normal">{buildActionHint(ticket.executionStatus, en)}</div> : null}
                      <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" onClick={(event) => { event.stopPropagation(); void withTicketAction(ticket.ticketId, () => deleteCodexSrTicket(ticket.ticketId)); }} type="button">{en ? "Delete" : "삭제"}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {srTickets.length > queuePageSize ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-[var(--kr-gov-text-secondary)]">
              {en
                ? `Showing ${normalizedQueuePageIndex * queuePageSize + 1}-${Math.min((normalizedQueuePageIndex + 1) * queuePageSize, srTicketCount)} of ${srTicketCount}`
                : `${normalizedQueuePageIndex * queuePageSize + 1}-${Math.min((normalizedQueuePageIndex + 1) * queuePageSize, srTicketCount)} / 전체 ${srTicketCount}건`}
            </div>
            <div className="flex items-center gap-2">
              <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={normalizedQueuePageIndex === 0} onClick={() => { setQueuePageIndex((current) => Math.max(0, current - 1)); }} type="button">{en ? "Previous" : "이전"}</button>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-[var(--kr-gov-text-secondary)]">
                {normalizedQueuePageIndex + 1} / {queuePageCount}
              </div>
              <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={normalizedQueuePageIndex >= queuePageCount - 1} onClick={() => { setQueuePageIndex((current) => Math.min(queuePageCount - 1, current + 1)); }} type="button">{en ? "Next" : "다음"}</button>
            </div>
          </div>
        ) : null}
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 mt-6">
        <article className="gov-card" data-help-id="codex-request-ticket-detail">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">list_alt</span>
            <h3 className="text-lg font-bold">{en ? "Selected Ticket Detail" : "선택 티켓 상세"}</h3>
          </div>
          {selectedTicketLoading && !selectedTicket ? <div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Loading ticket detail..." : "티켓 상세를 불러오는 중입니다."}</div> : null}
          {!selectedTicket ? <div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Select a ticket from the queue." : "큐에서 티켓을 선택하세요."}</div> : (
            <div className="space-y-3 text-sm">
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Ticket / Status" : "티켓 / 상태"}</div>
                    <div className="mt-1 font-semibold">{selectedTicket.ticketId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady} onClick={() => { void handleReissueTicket(selectedTicket); }} type="button">{en ? "Reissue" : "재발행"}</button>
                    <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || !selectedTicket.deployLogPath || isExecutionRunning(selectedTicket.executionStatus)} onClick={() => { void handleRollbackTicket(selectedTicket); }} type="button">{en ? "Rollback" : "롤백"}</button>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${executionBadgeClass(selectedTicket.executionStatus)}`}>{selectedTicket.executionStatus || "-"}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                  <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Page" : "페이지"}</div>
                  <div className="mt-1 font-semibold">{selectedTicket.pageLabel || selectedTicket.pageId || "-"}</div>
                  <div className="mt-1 text-xs text-gray-500 break-all">{selectedTicket.routePath || "-"}</div>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                  <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Surface / Event" : "Surface / Event"}</div>
                  <div className="mt-1 font-semibold">{selectedTicket.surfaceLabel || "-"}</div>
                  <div className="mt-1 text-xs text-gray-500">{selectedTicket.eventLabel || "-"}</div>
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Summary" : "요약"}</div>
                <div className="mt-1 font-semibold whitespace-pre-wrap">{selectedTicket.summary || "-"}</div>
                <div className="mt-3 text-xs text-gray-500 whitespace-pre-wrap">{selectedTicket.instruction || "-"}</div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Runner Comment" : "Runner 코멘트"}</div>
                <div className="mt-1 whitespace-pre-wrap">{selectedTicket.executionComment || "-"}</div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Artifact Paths" : "아티팩트 경로"}</div>
                <div className="mt-2 text-[11px] font-mono space-y-1 text-gray-600">
                  <div>plan-result: {selectedTicket.planResultPath || "-"}</div>
                  <div>plan-log: {selectedTicket.planLogPath || "-"}</div>
                  <div>plan-stderr: {selectedTicket.planStderrPath || "-"}</div>
                  <div>build-result: {selectedTicket.executionLogPath ? selectedTicket.executionLogPath.replace("codex-build.stdout.log", "codex-build-result.txt") : "-"}</div>
                  <div>build-log: {selectedTicket.executionLogPath || "-"}</div>
                  <div>build-stderr: {selectedTicket.executionStderrPath || "-"}</div>
                  <div>build-diff: {selectedTicket.executionDiffPath || "-"}</div>
                  <div>backend-verify-log: {selectedTicket.backendVerifyLogPath || "-"}</div>
                  <div>frontend-verify-log: {selectedTicket.frontendVerifyLogPath || "-"}</div>
                  <div>deploy-log: {selectedTicket.deployLogPath || "-"}</div>
                  <div>rollback-log: {selectedTicket.rollbackLogPath || "-"}</div>
                  <div>rollback-stderr: {selectedTicket.rollbackStderrPath || "-"}</div>
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Verify Exit Codes" : "검증 Exit Code"}</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">backend</div>
                    <div className="font-semibold">{exitStatusLabel(selectedTicket.backendVerifyExitCode, en)}</div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">frontend</div>
                    <div className="font-semibold">{exitStatusLabel(selectedTicket.frontendVerifyExitCode, en)}</div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">deploy</div>
                    <div className="font-semibold">{exitStatusLabel(selectedTicket.deployExitCode, en)}</div>
                    <div className="mt-1 text-[11px] text-gray-500">{selectedTicket.healthCheckStatus || selectedTicket.rollbackStatus || "-"}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Deployment" : "배포"}</div>
                <div className="mt-1 font-semibold whitespace-pre-wrap break-all">{selectedTicket.deployCommand || (en ? "Automatic deploy disabled" : "자동 배포 비활성화")}</div>
              <div className="mt-2 text-xs text-gray-500">health-check: {selectedTicket.healthCheckStatus || "-"}</div>
              <div className="mt-1 text-xs text-gray-500">rollback: {selectedTicket.rollbackStatus || "-"}</div>
              <div className="mt-3">
                <button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady || !selectedTicket.deployLogPath || isExecutionRunning(selectedTicket.executionStatus)} onClick={() => { void handleRollbackTicket(selectedTicket); }} type="button">{en ? "Rollback to Previous Deploy" : "이전 배포로 롤백"}</button>
                {isRollbackRunning(selectedTicket.rollbackStatus) ? (
                  <div className="mt-2 text-[11px] text-amber-700">{en ? "Rollback is running. Open rollback-log or rollback-stderr below." : "롤백 실행 중입니다. 아래 rollback-log 또는 rollback-stderr를 확인하세요."}</div>
                ) : null}
              </div>
            </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3">
                <div className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Review Summary" : "리뷰 요약"}</div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">plan stderr</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.planStderrSnippet || "-"}</pre>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">build stderr</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.buildStderrSnippet || "-"}</pre>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">backend verify</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.backendVerifySnippet || "-"}</pre>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">frontend verify</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.frontendVerifySnippet || "-"}</pre>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">deploy</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.deploySnippet || "-"}</pre>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-3 py-3">
                    <div className="text-[11px] text-[var(--kr-gov-text-secondary)]">rollback</div>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-5 text-gray-700">{reviewSummary.rollbackSnippet || "-"}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>
        <div className="space-y-6">
          <article className="gov-card" data-help-id="codex-request-plan-result">
            <div className="flex items-center gap-2 border-b pb-4 mb-4">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">fact_check</span>
              <h3 className="text-lg font-bold">{en ? "Plan Result" : "Plan 결과"}</h3>
            </div>
            <div className="mb-3 text-xs text-[var(--kr-gov-text-secondary)]">
              {planArtifact?.label || (en ? "PLAN artifact preview" : "PLAN 아티팩트 미리보기")}
              {planArtifact?.filePath ? ` · ${planArtifact.filePath}` : ""}
              {selectedTicket?.executionStatus === "PLAN_RUNNING" && canStreamPlanArtifact(selectedPlanArtifactType)
                ? ` · ${en ? "live tail every 4s" : "4초마다 자동 새로고침"}`
                : ""}
            </div>
            {selectedTicket ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedPlanArtifactType === "plan-result" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "plan-result", "plan"); }} type="button">plan-result</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedPlanArtifactType === "plan-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "plan-log", "plan"); }} type="button">stdout</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedPlanArtifactType === "plan-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "plan-stderr", "plan"); }} type="button">stderr</button>
              </div>
            ) : null}
            <pre className="rounded-[var(--kr-gov-radius)] bg-slate-950 text-slate-100 p-4 text-xs md:text-sm font-mono whitespace-pre-wrap break-all leading-6 min-h-[16rem]">{artifactLoading
              ? (en ? "Loading plan artifact..." : "Plan 아티팩트를 불러오는 중입니다.")
              : (selectedTicket && selectedTicket.executionStatus === "PLAN_RUNNING" && !canStreamPlanArtifact(selectedPlanArtifactType)
                ? (en ? "PLAN is still running. Artifact will appear when the run completes." : "PLAN 실행 중입니다. 실행이 끝나면 아티팩트가 표시됩니다.")
                : artifactBody(planArtifact, en ? "No PLAN artifact yet." : "아직 PLAN 아티팩트가 없습니다."))}</pre>
          </article>
          <article className="gov-card" data-help-id="codex-request-build-result">
            <div className="flex items-center gap-2 border-b pb-4 mb-4">
              <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">terminal</span>
              <h3 className="text-lg font-bold">{en ? "Build Result" : "Build 결과"}</h3>
            </div>
            <div className="mb-3 text-xs text-[var(--kr-gov-text-secondary)]">
              {buildArtifact?.label || (en ? "BUILD artifact preview" : "BUILD 아티팩트 미리보기")}
              {buildArtifact?.filePath ? ` · ${buildArtifact.filePath}` : ""}
              {(selectedTicket?.executionStatus === "RUNNING_CODEX" || isRollbackRunning(selectedTicket?.rollbackStatus)) && canStreamBuildArtifact(selectedBuildArtifactType)
                ? ` · ${en ? "live tail every 4s" : "4초마다 자동 새로고침"}`
                : ""}
            </div>
            {selectedTicket ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "build-result" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "build-result", "build"); }} type="button">{en ? "codex-result" : "codex-응답"}</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "build-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "build-log", "build"); }} type="button">codex-stdout</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "build-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "build-stderr", "build"); }} type="button">codex-stderr</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "backend-verify-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "backend-verify-log", "build"); }} type="button">backend-verify</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "backend-verify-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "backend-verify-stderr", "build"); }} type="button">backend-stderr</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "frontend-verify-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "frontend-verify-log", "build"); }} type="button">frontend-verify</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "frontend-verify-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "frontend-verify-stderr", "build"); }} type="button">frontend-stderr</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "deploy-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "deploy-log", "build"); }} type="button">deploy-log</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "deploy-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "deploy-stderr", "build"); }} type="button">deploy-stderr</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "rollback-log" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "rollback-log", "build"); }} type="button">rollback-log</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "rollback-stderr" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "rollback-stderr", "build"); }} type="button">rollback-stderr</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "build-diff" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "build-diff", "build"); }} type="button">diff</button>
                <button className={`gov-btn !px-3 !py-1.5 text-xs ${selectedBuildArtifactType === "build-changed-summary" ? "gov-btn-primary" : "gov-btn-outline"}`} disabled={artifactLoading} onClick={() => { void loadArtifact(selectedTicket.ticketId, "build-changed-summary", "build"); }} type="button">changed-files</button>
              </div>
            ) : null}
            <pre className="rounded-[var(--kr-gov-radius)] bg-slate-950 text-slate-100 p-4 text-xs md:text-sm font-mono whitespace-pre-wrap break-all leading-6 min-h-[16rem]">{buildArtifactPreviewText}</pre>
          </article>
        </div>
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6 mt-6">
        <article className="gov-card" data-help-id="codex-request-setup">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">settings_ethernet</span>
            <h3 className="text-lg font-bold">{en ? "Legacy Provision Proxy" : "레거시 Provision 프록시"}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="proxyMode">{en ? "Mode" : "호출 모드"}</label>
              <input className="gov-input bg-slate-50" id="proxyMode" readOnly value={en ? "Admin Internal Proxy" : "관리자 내부 프록시"} />
            </div>
            <div className="md:col-span-2">
              <label className="gov-label" htmlFor="payload">Provision JSON Payload</label>
              <textarea className="w-full min-h-[24rem] border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] px-4 py-3 text-sm font-mono leading-6" id="payload" value={payload} onChange={(event) => setPayload(event.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="gov-btn gov-btn-outline" disabled={!codexReady} onClick={() => { void withResult(runCodexLoginCheck); }} type="button">{en ? "Check Auth" : "인증 확인"}</button>
            <button className="gov-btn gov-btn-primary" disabled={!codexReady} onClick={() => {
              if (typeof window !== "undefined" && !window.confirm(en ? "Queue and execute this provision payload now?" : "현재 Provision payload를 실행하시겠습니까?")) {
                return;
              }
              void withResult(async () => executeCodexProvision(JSON.parse(payload)));
            }} type="button">{en ? "Run Provision" : "Provision 실행"}</button>
            <button className="gov-btn gov-btn-outline" onClick={() => {
              try {
                setPayload(JSON.stringify(JSON.parse(payload), null, 2));
              } catch {
                setError(en ? "Invalid JSON payload." : "JSON 형식이 올바르지 않습니다.");
              }
            }} type="button">{en ? "Format JSON" : "JSON 정렬"}</button>
            <button className="gov-btn gov-btn-outline" onClick={() => { void navigator.clipboard.writeText(payload); }} type="button">{en ? "Copy Payload" : "Payload 복사"}</button>
          </div>
        </article>
        <article className="gov-card">
          <div className="flex items-center gap-2 border-b pb-4 mb-4">
            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">rule_settings</span>
            <h3 className="text-lg font-bold">{en ? "Checkpoints" : "운영 체크포인트"}</h3>
          </div>
          <ul className="space-y-3 text-sm text-[var(--kr-gov-text-secondary)] leading-6">
            <li className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3 bg-slate-50">{en ? "Use PLAN first. BUILD should start only after PLAN_COMPLETED." : "반드시 PLAN 을 먼저 실행하고 PLAN_COMPLETED 이후에만 BUILD 를 시작합니다."}</li>
            <li className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3 bg-slate-50">{en ? "The current console is SR-ticket-backed. It is not a standalone stack model yet." : "현재 콘솔은 SR 티켓 기반 중앙 큐이며 아직 standalone stack 모델은 아닙니다."}</li>
            <li className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3 bg-slate-50">{en ? "Plan/build artifact previews come from ticket-recorded paths only." : "Plan/build 아티팩트 미리보기는 티켓에 기록된 경로만 기준으로 조회합니다."}</li>
            <li className="rounded-[var(--kr-gov-radius)] border border-slate-200 px-4 py-3 bg-slate-50">{runtimeConfig.deployCommandConfigured ? (en ? `Automatic deploy enabled: ${runtimeConfig.deployCommand || "-"}` : `자동 배포 활성화: ${runtimeConfig.deployCommand || "-"}`) : (en ? "Automatic deploy is disabled." : "자동 배포가 비활성화되어 있습니다.")}</li>
          </ul>
        </article>
      </section>
      <section className="gov-card mt-6">
        <div className="flex flex-col gap-3 border-b pb-4 mb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold">{en ? "Execution History" : "실행 이력 점검"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Review company context and mapping status for recent executions." : "최근 실행된 Codex 요청에서 회사 컨텍스트와 페이지/메뉴/기능/공통코드 매핑 상태를 다시 점검합니다."}</p>
          </div>
          <button className="gov-btn gov-btn-outline" disabled={!codexReady} onClick={() => { void historyState.reload(); }} type="button">{en ? "Refresh History" : "이력 새로고침"}</button>
        </div>
        <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">{historyRows.length === 0 ? (en ? "No execution history yet." : "아직 실행 이력이 없습니다.") : `${historyRows.length}${en ? " records loaded" : "건 이력을 불러왔습니다"} / ${historyCount}${en ? " total." : "건 전체."}`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="gov-table-header">
                <th className="px-4 py-3 text-left">{en ? "Executed At" : "실행시각"}</th>
                <th className="px-4 py-3 text-left">{en ? "Request / Actor" : "요청/실행자"}</th>
                <th className="px-4 py-3 text-left">{en ? "Company / API" : "회사/대상 API"}</th>
                <th className="px-4 py-3 text-left">{en ? "Result" : "점검 결과"}</th>
                <th className="px-4 py-3 text-left">{en ? "Actions" : "조치"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyRows.length === 0 ? <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={5}>{en ? "No history loaded." : "불러온 이력이 없습니다."}</td></tr> : historyRows.map((item, idx) => (
                <tr className="align-top" key={`${stringOf(item, "logId")}-${idx}`}>
                  <td className="px-4 py-4 whitespace-nowrap"><div className="font-semibold">{stringOf(item, "executedAt") || "-"}</div><div className="text-xs text-gray-400">HTTP {stringOf(item, "httpStatus") || "-"} / {stringOf(item, "executionStatus") || "-"}</div></td>
                  <td className="px-4 py-4"><div className="font-semibold">{stringOf(item, "requestId") || "-"}</div><div className="text-xs text-gray-500">{stringOf(item, "actorUserId") || "-"} / {stringOf(item, "actorAuthorCode") || "-"}</div></td>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{stringOf(item, "companyId") || "-"}</div>
                    <div className="text-xs text-gray-500 break-all">{stringOf(item, "targetApiPath") || stringOf(item, "pageMenuUrl") || "-"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${boolOf(item.companyContextOk) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{en ? "Company" : "회사"}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${boolOf(item.pageMapped) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{en ? "Page" : "페이지"}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${boolOf(item.menuMapped) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{en ? "Menu" : "메뉴"}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${boolOf(item.featuresMapped) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{en ? "Feature" : "기능"}</span>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${boolOf(item.commonCodesMapped) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{en ? "Code" : "공통코드"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`font-semibold ${Number(item.issueCount || 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>{stringOf(item, "issueSummary") || "-"}</div>
                    {Array.isArray(item.issues) && item.issues.length > 0 ? (
                      <div className="mt-2 text-xs leading-5 text-red-700">
                        {item.issues.map((issue, issueIndex) => (
                          <div key={`${stringOf(item, "logId")}-issue-${issueIndex}`}>• {String(issue)}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-emerald-700">{en ? "No issue found" : "문제 없음"}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap"><div className="flex flex-col gap-2"><button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" onClick={() => { setPayload(stringOf(item, "requestJson")); }} type="button">{en ? "Load Payload" : "Payload 불러오기"}</button><button className="gov-btn gov-btn-outline !px-3 !py-1.5 text-xs" disabled={!codexReady} onClick={() => { void withResult(async () => inspectCodexHistory(stringOf(item, "logId"))); }} type="button">{en ? "Inspect" : "재점검"}</button><button className="gov-btn gov-btn-primary !px-3 !py-1.5 text-xs" disabled={!codexReady} onClick={() => { void withResult(async () => remediateCodexHistory(stringOf(item, "logId"))); }} type="button">{en ? "Remediate" : "조치 실행"}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageShell>
  );
}
