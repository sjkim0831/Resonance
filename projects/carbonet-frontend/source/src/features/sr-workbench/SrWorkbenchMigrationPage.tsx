import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  clearSrWorkbenchStack,
  approveSrTicket,
  removeSrWorkbenchStackItem,
  createSrTicket,
  directExecuteSrTicket,
  executeSrTicket,
  fetchSrWorkbenchPage,
  prepareSrExecution,
  planSrTicket,
  quickExecuteSrTicket,
  skipPlanExecuteSrTicket
} from "../../lib/api/platform";
import { getScreenCommandChainText, getScreenCommandChainValues } from "../../lib/api/screenCommand";
import type {
  ScreenCommandApi,
  ScreenCommandChangeTarget,
  ScreenCommandEvent,
  ScreenCommandPagePayload,
  ScreenCommandSchema,
  ScreenCommandSurface,
  SrTicketRow,
  SrWorkbenchStackItem,
  SrWorkbenchPagePayload
} from "../../lib/api/platformTypes";
import { fetchScreenCommandPage } from "../../lib/api/platform";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { DiagnosticCard, GridToolbar, MemberButton } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

function buildDirectionPreview(params: {
  pageLabel: string;
  routePath: string;
  surface?: ScreenCommandSurface;
  event?: ScreenCommandEvent;
  api?: ScreenCommandApi;
  target?: ScreenCommandChangeTarget;
  schema?: ScreenCommandSchema;
  summary: string;
  instruction: string;
}) {
  const lines = [
    `[SR 요약] ${params.summary || "요약 없음"}`,
    `대상 화면: ${params.pageLabel} (${params.routePath})`,
    `대상 요소: ${params.surface ? `${params.surface.label} [${params.surface.selector}]` : "미선택"}`,
    `이벤트: ${params.event ? `${params.event.label} / ${params.event.frontendFunction}` : "미선택"}`,
    `API: ${params.api ? `${params.api.method} ${params.api.endpoint}` : "미선택"}`,
    `백엔드: ${params.api ? [
      getScreenCommandChainText(params.api.controllerActions, params.api.controllerAction),
      getScreenCommandChainText(params.api.serviceMethods, params.api.serviceMethod),
      getScreenCommandChainText(params.api.mapperQueries, params.api.mapperQuery)
    ].join(" -> ") : "미선택"}`,
    `스키마: ${params.schema ? `${params.schema.tableName} (${params.schema.columns.join(", ")})` : "미선택"}`,
    `수정 레이어: ${params.target ? `${params.target.label} [${params.target.editableFields.join(", ")}]` : "미선택"}`,
    `실행 지시: ${params.instruction || "구체 지시 필요"}`
  ];
  return lines.join("\n");
}

function buildCommandPrompt(params: {
  pageId: string;
  pageLabel: string;
  routePath: string;
  summary: string;
  direction: string;
  menuCode: string;
  menuLookupUrl: string;
}) {
  return [
    "Carbonet SR ticket",
    `pageId=${params.pageId}`,
    `page=${params.pageLabel}`,
    `route=${params.routePath}`,
    `menuCode=${params.menuCode || "-"}`,
    `menuUrl=${params.menuLookupUrl || "-"}`,
    `summary=${params.summary || "-"}`,
    "direction=",
    params.direction
  ].join("\n");
}

function statusBadgeClass(status: string) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-700";
    case "PREPARED":
      return "bg-amber-100 text-amber-700";
    case "EXECUTED":
      return "bg-sky-100 text-sky-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function executionBadgeClass(status: string) {
  switch ((status || "").toUpperCase()) {
    case "DONE":
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-700";
    case "READY":
    case "PREPARED":
      return "bg-blue-100 text-blue-700";
    case "FAILED":
      return "bg-rose-100 text-rose-700";
    case "RUNNING":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function canApprovedShortcut(ticket: SrTicketRow) {
  return (ticket.status || "").toUpperCase() === "APPROVED";
}

function canExecuteTicket(ticket: SrTicketRow) {
  return (ticket.executionStatus || "").toUpperCase() === "PLAN_COMPLETED";
}

export function SrWorkbenchMigrationPage() {
  const en = isEnglish();
  const embeddedInLegacyAdminShell = typeof document !== "undefined"
    && document.getElementById("root")?.parentElement?.id === "main-content";
  const [selectedPageId, setSelectedPageId] = useState("member-list");
  
  const workbenchState = useAsyncValue<SrWorkbenchPagePayload>(() => fetchSrWorkbenchPage(selectedPageId), [selectedPageId], {
    initialValue: null
  });
  
  const commandPageState = useAsyncValue<ScreenCommandPagePayload>(() => fetchScreenCommandPage(selectedPageId), [selectedPageId], {
    initialValue: null,
    onSuccess(payload) {
      setSelectedPageId(prev => payload.selectedPageId || prev);
    }
  });
  
  const [surfaceId, setSurfaceId] = useState("");
  const [eventId, setEventId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [summary, setSummary] = useState("");
  const [instruction, setInstruction] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [generatedDirection, setGeneratedDirection] = useState("");
  const [selectedStackItemIds, setSelectedStackItemIds] = useState<string[]>([]);
  const [errorMessage, setError] = useState("");
  const [message, setMessage] = useState("");
  
  const error = errorMessage || workbenchState.error || commandPageState.error;
  const loading = workbenchState.loading || commandPageState.loading;
  
  const workbench = workbenchState.value;
  const commandPage = commandPageState.value;
  
  useEffect(() => {
    if (commandPage?.page?.surfaces?.length && !surfaceId) {
      setSurfaceId(commandPage.page.surfaces[0].surfaceId || "");
    }
    if (commandPage?.page?.changeTargets?.length && !targetId) {
      setTargetId(commandPage.page.changeTargets[0].targetId || "");
    }
  }, [commandPage, surfaceId, targetId]);

  useEffect(() => {
    const validIds = new Set((workbench?.stackItems || []).map((item) => item.stackItemId));
    setSelectedStackItemIds((current) => current.filter((item) => validIds.has(item)));
  }, [workbench?.stackItems]);

  const page = commandPage?.page;
  const selectedSurface = useMemo(
    () => page?.surfaces?.find((item) => item.surfaceId === surfaceId) || page?.surfaces?.[0],
    [page, surfaceId]
  );
  const availableEvents = useMemo(() => {
    if (!page) {
      return [];
    }
    if (!selectedSurface?.eventIds?.length) {
      return page.events || [];
    }
    const ids = new Set(selectedSurface.eventIds);
    return page.events.filter((item) => ids.has(item.eventId));
  }, [page, selectedSurface]);
  const selectedEvent = useMemo(
    () => availableEvents.find((item) => item.eventId === eventId) || availableEvents[0],
    [availableEvents, eventId]
  );
  const selectedApi = useMemo(() => {
    if (!page) {
      return undefined;
    }
    const ids = new Set(selectedEvent?.apiIds || []);
    return page.apis.find((item) => ids.has(item.apiId)) || page.apis?.[0];
  }, [page, selectedEvent]);
  const selectedSchema = useMemo(() => {
    if (!page) {
      return undefined;
    }
    const schemaId = selectedApi?.schemaIds?.[0];
    return page.schemas.find((item) => item.schemaId === schemaId) || page.schemas?.[0];
  }, [page, selectedApi]);
  const selectedTarget = useMemo(
    () => page?.changeTargets?.find((item) => item.targetId === targetId) || page?.changeTargets?.[0],
    [page, targetId]
  );
  const preview = useMemo(() => buildDirectionPreview({
    pageLabel: page?.label || "-",
    routePath: page?.routePath || "-",
    surface: selectedSurface,
    event: selectedEvent,
    api: selectedApi,
    target: selectedTarget,
    schema: selectedSchema,
    summary,
    instruction
  }), [instruction, page, selectedApi, selectedEvent, selectedSchema, selectedSurface, selectedTarget, summary]);
  const commandPrompt = useMemo(() => buildCommandPrompt({
    pageId: page?.pageId || "-",
    pageLabel: page?.label || "-",
    routePath: page?.routePath || "-",
    summary,
    direction: generatedDirection || preview,
    menuCode: page?.menuCode || "",
    menuLookupUrl: page?.menuLookupUrl || ""
  }), [generatedDirection, page, preview, summary]);

  useEffect(() => {
    logGovernanceScope("PAGE", "sr-workbench", {
      language: en ? "en" : "ko",
      selectedPageId,
      ticketCount: workbench?.ticketCount || 0,
      stackCount: (workbench?.stackItems || []).length,
      selectedStackCount: selectedStackItemIds.length
    });
    logGovernanceScope("COMPONENT", "sr-ticket-draft", {
      surfaceId: selectedSurface?.surfaceId || "",
      eventId: selectedEvent?.eventId || "",
      targetId: selectedTarget?.targetId || "",
      hasGeneratedDirection: Boolean(generatedDirection)
    });
  }, [
    en,
    generatedDirection,
    selectedEvent?.eventId,
    selectedPageId,
    selectedStackItemIds.length,
    selectedSurface?.surfaceId,
    selectedTarget?.targetId,
    workbench?.stackItems,
    workbench?.ticketCount
  ]);

  async function refreshTickets() {
    await workbenchState.reload();
  }

  async function reloadPage() {
    await Promise.all([
      workbenchState.reload(),
      commandPageState.reload()
    ]);
  }

  function handleGenerate() {
    logGovernanceScope("ACTION", "sr-workbench-generate", {
      selectedPageId,
      surfaceId: selectedSurface?.surfaceId || "",
      eventId: selectedEvent?.eventId || "",
      targetId: selectedTarget?.targetId || ""
    });
    setGeneratedDirection(preview);
  }

  async function handleCreateTicket() {
    logGovernanceScope("ACTION", "sr-workbench-create-ticket", {
      selectedPageId,
      summary,
      surfaceId: selectedSurface?.surfaceId || "",
      eventId: selectedEvent?.eventId || ""
    });
    setError("");
    setMessage("");
    try {
      const response = await createSrTicket({
        pageId: page?.pageId || "",
        pageLabel: page?.label || "",
        routePath: page?.routePath || "",
        menuCode: page?.menuCode || "",
        menuLookupUrl: page?.menuLookupUrl || "",
        surfaceId: selectedSurface?.surfaceId || "",
        surfaceLabel: selectedSurface?.label || "",
        eventId: selectedEvent?.eventId || "",
        eventLabel: selectedEvent?.label || "",
        targetId: selectedTarget?.targetId || "",
        targetLabel: selectedTarget?.label || "",
        summary,
        instruction,
        generatedDirection: generatedDirection || preview,
        commandPrompt
      });
      setMessage(response.message);
      setSummary("");
      setInstruction("");
      setGeneratedDirection("");
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to create SR ticket." : "SR 티켓 발행 중 오류가 발생했습니다."));
    }
  }

  async function handleQuickExecuteDraft() {
    logGovernanceScope("ACTION", "sr-workbench-quick-execute", {
      selectedPageId,
      summary
    });
    setError("");
    setMessage("");
    try {
      const response = await quickExecuteSrTicket({
        pageId: page?.pageId || "",
        pageLabel: page?.label || "",
        routePath: page?.routePath || "",
        menuCode: page?.menuCode || "",
        menuLookupUrl: page?.menuLookupUrl || "",
        surfaceId: selectedSurface?.surfaceId || "",
        surfaceLabel: selectedSurface?.label || "",
        eventId: selectedEvent?.eventId || "",
        eventLabel: selectedEvent?.label || "",
        targetId: selectedTarget?.targetId || "",
        targetLabel: selectedTarget?.label || "",
        summary,
        instruction,
        generatedDirection: generatedDirection || preview,
        commandPrompt
      });
      setMessage(response.message);
      setSummary("");
      setInstruction("");
      setGeneratedDirection("");
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to quick execute SR ticket." : "바로 실행 티켓 처리 중 오류가 발생했습니다."));
    }
  }

  async function handleCreateTicketFromStack() {
    const stackItemIds = selectedStackItemIds.length > 0
      ? selectedStackItemIds
      : (workbench?.stackItems || []).map((item) => item.stackItemId);
    if (stackItemIds.length === 0) {
      setError(en ? "No stack items selected." : "선택된 스택 항목이 없습니다.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await createSrTicket({
        pageId: "",
        pageLabel: "",
        routePath: "",
        menuCode: "",
        menuLookupUrl: "",
        surfaceId: "",
        surfaceLabel: "",
        eventId: "",
        eventLabel: "",
        targetId: selectedTarget?.targetId || "",
        targetLabel: selectedTarget?.label || "",
        summary,
        instruction,
        generatedDirection: "",
        commandPrompt: "",
        stackItemIds
      });
      setMessage(response.message);
      setSelectedStackItemIds([]);
      setSummary("");
      setInstruction("");
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to create SR ticket from stack." : "스택 기반 SR 티켓 발행 중 오류가 발생했습니다."));
    }
  }

  async function handleRemoveStackItem(stackItemId: string) {
    setError("");
    setMessage("");
    try {
      const response = await removeSrWorkbenchStackItem(stackItemId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to remove stack item." : "스택 항목 제거 중 오류가 발생했습니다."));
    }
  }

  async function handleClearStack() {
    setError("");
    setMessage("");
    try {
      const response = await clearSrWorkbenchStack();
      setMessage(response.message);
      setSelectedStackItemIds([]);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to clear stack." : "스택 비우기 중 오류가 발생했습니다."));
    }
  }

  async function handleApprove(ticketId: string, decision: "APPROVE" | "REJECT") {
    setError("");
    setMessage("");
    try {
      const response = await approveSrTicket(ticketId, decision, approvalComment);
      setMessage(response.message);
      setApprovalComment("");
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to update approval." : "승인 처리 중 오류가 발생했습니다."));
    }
  }

  async function handlePrepareExecution(ticketId: string) {
    setError("");
    setMessage("");
    try {
      const response = await prepareSrExecution(ticketId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to prepare execution." : "실행 준비 처리 중 오류가 발생했습니다."));
    }
  }

  async function handleExecute(ticketId: string) {
    setError("");
    setMessage("");
    try {
      const response = await executeSrTicket(ticketId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to execute Codex runner." : "Codex runner 실행 중 오류가 발생했습니다."));
    }
  }

  async function handleDirectExecute(ticketId: string) {
    setError("");
    setMessage("");
    try {
      const response = await directExecuteSrTicket(ticketId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to direct execute Codex runner." : "Codex 바로 실행 중 오류가 발생했습니다."));
    }
  }

  async function handleSkipPlanExecute(ticketId: string) {
    setError("");
    setMessage("");
    try {
      const response = await skipPlanExecuteSrTicket(ticketId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to skip PLAN and execute Codex runner." : "계획 없이 Codex 실행 중 오류가 발생했습니다."));
    }
  }

  async function handlePlan(ticketId: string) {
    setError("");
    setMessage("");
    try {
      const response = await planSrTicket(ticketId);
      setMessage(response.message);
      await refreshTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to generate Codex plan." : "Codex 계획 수립 중 오류가 발생했습니다."));
    }
  }

  const content = (
    <AdminWorkspacePageFrame>
      <section className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">
              {en ? "Automation Operations" : "운영자동화"}
            </p>
            <h3 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">
              {en ? "Integrated SR approval and execution workspace" : "통합 SR 승인 및 실행 작업공간"}
            </h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en
                ? "Keep screen metadata, authority review, approval, and Codex execution in the same operator flow."
                : "화면 메타데이터, 권한 검토, 승인, Codex 실행을 한 흐름 안에서 이어서 처리합니다."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-[var(--kr-gov-text-secondary)] md:grid-cols-2">
            <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="font-bold text-[var(--kr-gov-blue)]">{en ? "Current route" : "현재 라우트"}</p>
              <p className="mt-1 break-all">{page?.routePath || "/admin/system/sr-workbench"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-bold text-[var(--kr-gov-text-primary)]">{en ? "Ticket lifecycle" : "티켓 처리 흐름"}</p>
              <p className="mt-1">{en ? "Draft -> Approval -> Prepare -> Plan -> Execute" : "초안 -> 승인 -> 준비 -> 계획 -> 실행"}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </section>
      ) : null}

      {message ? (
        <section className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <article className="gov-card border-l-4 border-l-[var(--kr-gov-blue)]">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Target Screen" : "대상 화면"}</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{page?.label || "-"}</p>
          <p className="mt-2 text-xs text-gray-500">{page?.routePath || "-"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-[var(--kr-gov-green)]">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Open Tickets" : "진행 티켓"}</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{workbench?.ticketCount || 0}</p>
          <p className="mt-2 text-xs text-gray-500">{en ? "Approval and execution queue" : "승인 및 실행 대기열"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-amber-500">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "View Feature" : "조회 권한"}</p>
          <p className="mt-3 text-lg font-black text-[var(--kr-gov-text-primary)] break-all">{page?.menuPermission?.requiredViewFeatureCode || "-"}</p>
          <p className="mt-2 text-xs text-gray-500">{(page?.menuPermission?.featureCodes || []).join(", ") || "-"}</p>
        </article>
        <article className="gov-card border-l-4 border-l-slate-500">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Codex Status" : "Codex 상태"}</p>
          <p className="mt-3 text-2xl font-black text-[var(--kr-gov-text-primary)]">{workbench?.codexEnabled ? "ENABLED" : "DISABLED"}</p>
          <p className="mt-2 text-xs text-gray-500 break-all">{workbench?.codexHistoryFile || "-"}</p>
        </article>
      </section>

      <section className="gov-card" data-help-id="sr-ticket-draft">
        <div className="mb-6 flex flex-col gap-2 border-b border-[var(--kr-gov-border-light)] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "SR Draft" : "SR 초안 작성"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
              {en ? "Select a screen surface and generate an actionable SR direction." : "화면 요소를 선택하고 실행 가능한 SR 지시를 생성합니다."}
            </p>
          </div>
          <button
            className="gov-btn gov-btn-secondary"
            disabled={loading}
            onClick={() => reloadPage().catch(() => undefined)}
            type="button"
          >
            {loading ? (en ? "Loading..." : "불러오는 중...") : (en ? "Reload Screen" : "대상 화면 불러오기")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="gov-label">{en ? "Target Screen" : "대상 화면"}</span>
            <select className="gov-select" value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)}>
              {(workbench?.screenOptions || []).map((item) => (
                <option key={item.pageId} value={item.pageId}>
                  {item.label} ({item.routePath})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">{en ? "Surface" : "요소"}</span>
            <select className="gov-select" value={selectedSurface?.surfaceId || ""} onChange={(event) => setSurfaceId(event.target.value)}>
              {(page?.surfaces || []).map((item) => (
                <option key={item.surfaceId} value={item.surfaceId}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">{en ? "Event" : "이벤트"}</span>
            <select className="gov-select" value={selectedEvent?.eventId || ""} onChange={(event) => setEventId(event.target.value)}>
              {availableEvents.map((item) => (
                <option key={item.eventId} value={item.eventId}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="gov-label">{en ? "Change Layer" : "수정 레이어"}</span>
            <select className="gov-select" value={selectedTarget?.targetId || ""} onChange={(event) => setTargetId(event.target.value)}>
              {(page?.changeTargets || []).map((item) => (
                <option key={item.targetId} value={item.targetId}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <label className="block">
            <span className="gov-label">{en ? "SR Summary" : "SR 요약"}</span>
            <input
              className="gov-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={en ? "Example: mismatch between badge color and authority exposure on member detail screen" : "예: 회원 상세 화면 상태배지 색상과 권한 노출 조건 불일치"}
            />
          </label>
          <label className="block">
            <span className="gov-label">{en ? "Instruction" : "상세 지시"}</span>
            <textarea
              className="gov-input min-h-[120px] py-3"
              rows={4}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={en ? "Describe the UI, event, API, and authority impact that must be reviewed together." : "UI, 이벤트, API, 권한 영향도를 함께 검토해야 하는 내용을 적어주세요."}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <MemberButton onClick={handleGenerate} type="button" variant="secondary">{en ? "Generate Direction" : "해결 지시 생성"}</MemberButton>
          <MemberButton onClick={() => handleCreateTicket().catch(() => undefined)} type="button" variant="primary">{en ? "Create Ticket" : "SR 티켓 발행"}</MemberButton>
          <MemberButton onClick={() => handleQuickExecuteDraft().catch(() => undefined)} type="button" variant="secondary">{en ? "Create + Run Now" : "티켓 발행 후 바로 실행"}</MemberButton>
          <MemberButton onClick={() => handleCreateTicketFromStack().catch(() => undefined)} type="button" variant="info">{en ? "Create From Stack" : "스택으로 티켓 발행"}</MemberButton>
        </div>
      </section>

      <section className="gov-card">
        <GridToolbar
          actions={<MemberButton onClick={() => handleClearStack().catch(() => undefined)} type="button" variant="secondary">{en ? "Clear Stack" : "스택 비우기"}</MemberButton>}
          meta={en ? "Right-click selections accumulate here and can be converted into one SR ticket." : "우클릭으로 모은 컨텍스트를 여기서 확인하고 하나의 SR 티켓으로 발행할 수 있습니다."}
          title={en ? "Workbench Stack" : "워크벤치 스택"}
        />

        {(workbench?.stackItems || []).length === 0 ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-[var(--kr-gov-text-secondary)]">
            {en ? "No stacked context yet. Use right-click on a page element to collect it." : "아직 쌓인 컨텍스트가 없습니다. 페이지 요소에서 우클릭으로 스택에 추가하세요."}
          </div>
        ) : (
          <div className="space-y-3">
            {(workbench?.stackItems || []).map((item: SrWorkbenchStackItem) => (
              <label key={item.stackItemId} className="flex gap-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <input
                  checked={selectedStackItemIds.includes(item.stackItemId)}
                  onChange={() => setSelectedStackItemIds((current) => current.includes(item.stackItemId)
                    ? current.filter((value) => value !== item.stackItemId)
                    : [...current, item.stackItemId])}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.summary || item.surfaceLabel || item.pageLabel || item.stackItemId}</div>
                      <div className="mt-1 text-xs text-gray-500 break-all">{item.pageLabel || item.pageId} / {item.routePath || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500 break-all">{item.surfaceLabel || "-"} / {item.eventLabel || "-"} / {item.targetLabel || "-"}</div>
                      <div className="mt-1 text-xs text-gray-500 break-all">{item.selector || item.componentId || "-"}</div>
                      {item.instruction ? <div className="mt-2 text-sm text-[var(--kr-gov-text-primary)] whitespace-pre-wrap">{item.instruction}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{item.createdAt || "-"}</span>
                      <button className="gov-btn gov-btn-outline !h-[34px] !px-3 !text-[12px]" onClick={() => handleRemoveStackItem(item.stackItemId).catch(() => undefined)} type="button">
                        {en ? "Remove" : "제거"}
                      </button>
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DiagnosticCard
          className="p-0 overflow-hidden"
          description={en ? "Review API, schema, and permission metadata before approval." : "승인 전에 API, 스키마, 권한 메타데이터를 검토합니다."}
          title={en ? "Execution Context" : "실행 컨텍스트"}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">API / Controller</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedApi ? `${selectedApi.method} ${selectedApi.endpoint}` : "-"}</p>
              <p className="mt-2 text-xs text-gray-500 break-all">{getScreenCommandChainText(selectedApi?.controllerActions, selectedApi?.controllerAction || "")}</p>
              <p className="mt-1 text-xs text-gray-500 break-all">{getScreenCommandChainText(selectedApi?.serviceMethods, selectedApi?.serviceMethod || "")}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">Schema</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedSchema?.tableName || "-"}</p>
              <div className="mt-2 space-y-1">
                {getScreenCommandChainValues(selectedApi?.mapperQueries, selectedApi?.mapperQuery || "").length > 0 ? getScreenCommandChainValues(selectedApi?.mapperQueries, selectedApi?.mapperQuery || "").map((item) => (
                  <p key={item} className="text-xs text-gray-500 break-all">{item}</p>
                )) : <p className="text-xs text-gray-500 break-all">-</p>}
              </div>
              <p className="mt-1 text-xs text-gray-500">{selectedSchema?.notes || "-"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Surface" : "선택 요소"}</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedSurface?.label || "-"}</p>
              <p className="mt-2 text-xs text-gray-500 break-all">{selectedSurface?.selector || "-"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Event / Target" : "이벤트 / 타깃"}</p>
              <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{selectedEvent?.label || "-"}</p>
              <p className="mt-2 text-xs text-gray-500">{selectedTarget?.label || "-"}</p>
            </div>
          </div>
        </DiagnosticCard>

        <div data-help-id="sr-direction-preview">
          <DiagnosticCard
            description={en ? "Use the generated SR direction and Codex prompt for approval and execution." : "생성된 SR 지시와 Codex 프롬프트를 승인 및 실행에 사용합니다."}
            title={en ? "Generated Direction" : "생성된 해결 지시"}
          >
            <label className="block">
              <span className="gov-label">{en ? "Direction" : "Direction"}</span>
              <textarea className="gov-input min-h-[220px] py-3 font-mono text-[12px]" readOnly rows={10} value={generatedDirection || preview} />
            </label>
            <label className="mt-4 block">
              <span className="gov-label">{en ? "Codex Command Prompt" : "Codex Command Prompt"}</span>
              <textarea className="gov-input min-h-[220px] py-3 font-mono text-[12px]" readOnly rows={10} value={commandPrompt} />
            </label>
          </DiagnosticCard>
        </div>
      </section>

      <section className="gov-card" data-help-id="sr-ticket-table">
        <GridToolbar
          actions={<div className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total" : "전체"} <span className="font-bold text-[var(--kr-gov-blue)]">{workbench?.ticketCount || 0}</span>{en ? " tickets" : "건"}</div>}
          meta={en ? "Handle approval, preparation, and execution from the same queue." : "승인, 실행 준비, 실행을 같은 대기열에서 처리합니다."}
          title={en ? "Ticket Queue" : "티켓 대기열"}
        />

        <label className="mb-6 block">
          <span className="gov-label">{en ? "Approval Comment" : "승인 코멘트"}</span>
          <input
            className="gov-input"
            value={approvalComment}
            onChange={(event) => setApprovalComment(event.target.value)}
            placeholder={en ? "Leave a reason for approval or rejection." : "승인/반려 사유를 남깁니다."}
          />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="gov-table-header">
                <th className="px-5 py-4">ticketId</th>
                <th className="px-5 py-4">{en ? "Status" : "상태"}</th>
                <th className="px-5 py-4">{en ? "Page / Summary" : "페이지 / 요약"}</th>
                <th className="px-5 py-4">{en ? "Execution" : "실행"}</th>
                <th className="px-5 py-4 text-center">{en ? "Actions" : "처리"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(workbench?.tickets || []).length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-500" colSpan={5}>
                    {en ? "No SR tickets have been created yet." : "등록된 SR 티켓이 없습니다."}
                  </td>
                </tr>
              ) : (workbench?.tickets || []).map((ticket: SrTicketRow) => (
                <tr key={ticket.ticketId} className="hover:bg-gray-50/60">
                  <td className="px-5 py-4 align-top font-mono text-xs text-[var(--kr-gov-text-primary)]">{ticket.ticketId}</td>
                  <td className="px-5 py-4 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="font-bold text-[var(--kr-gov-text-primary)]">{ticket.pageLabel || ticket.pageId}</p>
                    <p className="mt-1 text-sm text-[var(--kr-gov-text-primary)]">{ticket.summary || "-"}</p>
                    <p className="mt-2 text-xs text-gray-500">{ticket.surfaceLabel} / {ticket.eventLabel} / {ticket.targetLabel}</p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${executionBadgeClass(ticket.executionStatus)}`}>
                      {ticket.executionStatus || "-"}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <p>{ticket.executionComment || "-"}</p>
                      {ticket.planRunId ? <p>planRunId: {ticket.planRunId}</p> : null}
                      {ticket.planCompletedAt ? <p>plan completed: {ticket.planCompletedAt}</p> : null}
                      {ticket.executionRunId ? <p>runId: {ticket.executionRunId}</p> : null}
                      {ticket.executionCompletedAt ? <p>completed: {ticket.executionCompletedAt}</p> : null}
                      {ticket.executionChangedFiles ? <p>changed: {ticket.executionChangedFiles}</p> : null}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button className="gov-btn gov-btn-secondary !h-[38px] !px-4 !text-[13px]" onClick={() => handleApprove(ticket.ticketId, "APPROVE").catch(() => undefined)} type="button">
                        {en ? "Approve" : "승인"}
                      </button>
                      <button className="gov-btn gov-btn-outline !h-[38px] !px-4 !text-[13px]" onClick={() => handleApprove(ticket.ticketId, "REJECT").catch(() => undefined)} type="button">
                        {en ? "Reject" : "반려"}
                      </button>
                      <button className="gov-btn gov-btn-outline-blue !h-[38px] !px-4 !text-[13px]" onClick={() => handlePrepareExecution(ticket.ticketId).catch(() => undefined)} type="button">
                        {en ? "Prepare" : "실행 준비"}
                      </button>
                      <button className="gov-btn gov-btn-outline-blue !h-[38px] !px-4 !text-[13px]" onClick={() => handlePlan(ticket.ticketId).catch(() => undefined)} type="button">
                        {en ? "Plan" : "계획 수립"}
                      </button>
                      <button className="gov-btn gov-btn-outline-blue !h-[38px] !px-4 !text-[13px]" disabled={!canApprovedShortcut(ticket)} onClick={() => handleDirectExecute(ticket.ticketId).catch(() => undefined)} type="button">
                        {en ? "Run Now" : "바로 실행"}
                      </button>
                      <button className="gov-btn gov-btn-outline-blue !h-[38px] !px-4 !text-[13px]" disabled={!canApprovedShortcut(ticket)} onClick={() => handleSkipPlanExecute(ticket.ticketId).catch(() => undefined)} type="button">
                        {en ? "Skip Plan" : "계획 없이 실행"}
                      </button>
                      <button className="gov-btn gov-btn-primary !h-[38px] !px-4 !text-[13px]" disabled={!canExecuteTicket(ticket)} onClick={() => handleExecute(ticket.ticketId).catch(() => undefined)} type="button">
                        {en ? "Execute" : "Codex 실행"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminWorkspacePageFrame>
  );

  if (embeddedInLegacyAdminShell) {
    return content;
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Automation Ops" : "운영자동화" },
        { label: en ? "SR Workbench" : "SR 워크벤치" }
      ]}
      title={en ? "SR Workbench" : "SR 워크벤치"}
      subtitle={en
        ? "Create SR tickets, review approvals, and prepare Codex execution from the shared admin workspace."
        : "공통 관리자 작업공간에서 SR 티켓 발행, 승인 검토, Codex 실행 준비를 처리합니다."}
    >
      {content}
    </AdminPageShell>
  );
}
