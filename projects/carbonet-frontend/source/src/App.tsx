import { lazy, Suspense, useEffect, useState } from "react";
import { getMissingInsttWarningEventName } from "./platform/telemetry/fetch";
import { usePageTelemetry } from "./platform/telemetry/usePageTelemetry";
import { useTelemetryTransport } from "./platform/telemetry/useTelemetryTransport";
import { useGlobalErrorHandler } from "./app/hooks/useGlobalErrorHandler";
import { useRuntimeNavigation } from "./app/hooks/useRuntimeNavigation";
import { type MatchedContext, useScreenContextMenu } from "./app/hooks/useScreenContextMenu";
import { getTraceContext } from "./platform/telemetry/traceContext";
import { getPageComponent } from "./app/routes/pageRegistry";
import { publishTelemetryEvent } from "./platform/telemetry/events";
import { ErrorBoundary } from "./components/error/ErrorBoundary";
import { getRuntimeLocale, navigate } from "./lib/navigation/runtime";
import type { PageHelpContent } from "./platform/screen-registry/helpContent";
import type { PageManifest } from "./platform/screen-registry/types";
import { addSrWorkbenchStackItem, quickExecuteSrTicket } from "./lib/api/platform";
import { getScreenCommandChainValues } from "./lib/api/screenCommand";
import {
  type ScreenCommandApi,
  type ScreenCommandChangeTarget,
  type ScreenCommandPagePayload
} from "./lib/api/platformTypes";

const HelpOverlay = lazy(() => import("./components/help/HelpOverlay").then((module) => ({ default: module.HelpOverlay })));

function buildContextSummary(match: MatchedContext | null, comment: string) {
  const base = [match?.page?.label, match?.surface?.label, match?.event?.label].filter(Boolean).join(" / ");
  if (comment.trim()) {
    return comment.trim().slice(0, 120);
  }
  return base || "우클릭 컨텍스트 수정";
}

function describeElement(element: Element | null) {
  if (!element) {
    return "-";
  }
  const tagName = element.tagName.toLowerCase();
  const idPart = element.id ? `#${element.id}` : "";
  const classNames = Array.from(element.classList || []).filter(Boolean).slice(0, 4);
  const classPart = classNames.length > 0 ? `.${classNames.join(".")}` : "";
  const helpId = element.getAttribute("data-help-id");
  const name = element.getAttribute("name");
  const role = element.getAttribute("role");
  const markerParts = [
    helpId ? `[data-help-id=${helpId}]` : "",
    name ? `[name=${name}]` : "",
    role ? `[role=${role}]` : ""
  ].filter(Boolean);
  return `${tagName}${idPart}${classPart}${markerParts.join("")}` || "-";
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.map((item) => (item || "").trim()).filter(Boolean);
}

function compactValueLine(key: string, value: string | undefined | null) {
  const normalized = (value || "").trim();
  return normalized ? `${key}=${normalized}` : "";
}

function buildNearbySourceHints(
  page: ScreenCommandPagePayload["page"],
  match: MatchedContext,
  relatedApis: ScreenCommandApi[]
) {
  const sources = new Set<string>();
  const pageSource = (page.source || "").trim();
  if (pageSource) {
    pageSource.split(",").map((item) => item.trim()).filter(Boolean).forEach((item) => sources.add(item));
  }
  const componentId = (match.surface?.componentId || "").trim();
  if (componentId) {
    sources.add(`component:${componentId}`);
  }
  relatedApis.forEach((api) => {
    getScreenCommandChainValues(api.controllerActions, api.controllerAction)
      .forEach((item) => sources.add(`controller:${item}`));
    getScreenCommandChainValues(api.serviceMethods, api.serviceMethod)
      .forEach((item) => sources.add(`service:${item}`));
    getScreenCommandChainValues(api.mapperQueries, api.mapperQuery)
      .forEach((item) => sources.add(`mapper:${item}`));
  });
  return Array.from(sources).slice(0, 6);
}

function isSimpleUiTarget(selectedChangeTarget: ScreenCommandChangeTarget | undefined) {
  const targetId = (selectedChangeTarget?.targetId || "").trim().toLowerCase();
  return targetId === "ui" || targetId === "css";
}

function buildTechnicalContext(
  match: MatchedContext | null,
  payload: ScreenCommandPagePayload | null,
  selectedChangeTarget: ScreenCommandChangeTarget | undefined,
  routePath: string
) {
  if (!match || !payload?.page) {
    return "";
  }
  const page = payload.page;
  const eventApiIds = new Set((match.event?.apiIds || []).map((item) => item.trim()).filter(Boolean));
  const relatedApis = (page.apis || []).filter((api) => eventApiIds.has((api.apiId || "").trim()));
  const relatedSchemaIds = new Set<string>();
  relatedApis.forEach((api) => {
    (api.schemaIds || []).forEach((schemaId) => {
      const normalized = schemaId.trim();
      if (normalized) {
        relatedSchemaIds.add(normalized);
      }
    });
  });
  const relatedSchemas = (page.schemas || []).filter((schema) => relatedSchemaIds.has((schema.schemaId || "").trim()));
  const nearbySources = buildNearbySourceHints(page, match, relatedApis);
  const lines = compactLines([
    "[context]",
    compactValueLine("url", match.page.routePath || routePath),
    compactValueLine("pageId", match.page.pageId),
    compactValueLine("pageLabel", match.page.label),
    compactValueLine("pageSource", page.source),
    compactValueLine("target", match.surface?.label || describeElement(match.highlightElement)),
    compactValueLine("selector", match.surface?.selector),
    compactValueLine("componentId", match.surface?.componentId),
    compactValueLine("dom", describeElement(match.highlightElement)),
    compactValueLine("event", match.event?.label),
    compactValueLine("eventId", match.event?.eventId),
    compactValueLine("frontendFunction", match.event?.frontendFunction),
    compactValueLine("changeTarget", selectedChangeTarget?.label || selectedChangeTarget?.targetId),
    nearbySources.length > 0 ? `nearbySources=${nearbySources.join(", ")}` : "",
    relatedApis.length > 0 ? `lookupApis=${relatedApis.map((api) => api.apiId).filter(Boolean).join(", ")}` : "",
    relatedSchemas.length > 0 ? `lookupSchemas=${relatedSchemas.map((schema) => schema.schemaId).filter(Boolean).join(", ")}` : "",
    relatedApis.length > 0
      ? `lookupTables=${Array.from(new Set(relatedApis.flatMap((api) => api.relatedTables || []).map((item) => item.trim()).filter(Boolean))).join(", ")}`
      : "",
    isSimpleUiTarget(selectedChangeTarget)
      ? "focus=선택한 컴포넌트와 바로 인접한 UI/class/layout만 최소 수정"
      : ""
  ]);
  return lines.join("\n").trim();
}

function fallbackHelpContent(pageId: string): PageHelpContent {
  return {
    pageId,
    title: "화면 도움말",
    summary: "도움말 정보를 준비하는 중입니다.",
    items: []
  };
}

export default function App() {
  useTelemetryTransport();
  useGlobalErrorHandler();
  const { locationState, location, page, routeLoading } = useRuntimeNavigation();
  const locale = getRuntimeLocale();
  const routePath = `${location.pathname}${location.search}`;
  const [manifest, setManifest] = useState<PageManifest | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContent, setHelpContent] = useState<PageHelpContent>(() => fallbackHelpContent(page));
  const [insttWarning, setInsttWarning] = useState("");
  const {
    availableChangeTargets,
    closeContextMenu,
    contextActionLoading,
    contextComment,
    contextMenu,
    contextToast,
    handleContextMenuHeaderMouseDown,
    highlightLabel,
    highlightRect,
    selectedChangeTarget,
    setContextActionLoading,
    setContextComment,
    setContextMenu,
    setContextTargetId,
    setContextToast
  } = useScreenContextMenu(page, routePath);
  const CurrentPage = getPageComponent(page);
  const boundaryResetKey = `${page}|${location.pathname}|${location.search}`;

  usePageTelemetry(page, locale);

  useEffect(() => {
    setHelpOpen(false);
    setInsttWarning("");
    setHelpContent(fallbackHelpContent(page));
  }, [locationState]);

  useEffect(() => {
    let timeoutId: number | undefined;

    function handleMissingInsttWarning(event: Event) {
      const customEvent = event as CustomEvent<{ url?: string }>;
      const targetUrl = customEvent.detail?.url || routePath;
      setInsttWarning(`마스터 계정이 아닌데 요청 파라미터에 instt_id 없이 API가 실행되었습니다. 요청 경로: ${targetUrl}`);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setInsttWarning(""), 8000);
    }

    window.addEventListener(getMissingInsttWarningEventName(), handleMissingInsttWarning as EventListener);
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener(getMissingInsttWarningEventName(), handleMissingInsttWarning as EventListener);
    };
  }, [routePath]);

  useEffect(() => {
    if (!helpOpen) {
      return;
    }
    let cancelled = false;
    import("./platform/screen-registry/helpContent")
      .then(async (module) => {
        if (cancelled) {
          return;
        }
        setHelpContent(module.getPageHelp(page));
        const payload = await module.fetchPageHelp(page);
        if (!cancelled && payload) {
          setHelpContent(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [helpOpen, page, locationState]);

  useEffect(() => {
    let cancelled = false;
    setManifest(null);
    import("./platform/screen-registry/pageManifests")
      .then((module) => {
        if (!cancelled) {
          setManifest(module.getPageManifest(page));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    if (!manifest) {
      return;
    }
    publishTelemetryEvent({
      type: "layout_render",
      pageId: page,
      payloadSummary: {
        routePath: manifest.routePath,
        layoutVersion: manifest.layoutVersion,
        componentCount: manifest.components.length
      }
    });
  }, [manifest, page, routePath]);

  async function handleAddToStack(openWorkbench: boolean) {
    if (!contextMenu.match) {
      return;
    }
    setContextActionLoading(true);
    try {
      const trace = getTraceContext();
      const summary = buildContextSummary(contextMenu.match, contextComment);
      const technicalContext = buildTechnicalContext(contextMenu.match, contextMenu.pageData, selectedChangeTarget, contextMenu.routePath || routePath);
      await addSrWorkbenchStackItem({
        pageId: contextMenu.match.page.pageId || contextMenu.pageId || page,
        pageLabel: contextMenu.match.page.label || contextMenu.pageId || page,
        routePath: contextMenu.match.page.routePath || contextMenu.routePath || routePath,
        menuCode: contextMenu.match.page.menuCode || "",
        menuLookupUrl: contextMenu.match.page.menuLookupUrl || "",
        surfaceId: contextMenu.match.surface?.surfaceId || "",
        surfaceLabel: contextMenu.match.surface?.label || "",
        selector: contextMenu.match.surface?.selector || "",
        componentId: contextMenu.match.surface?.componentId || "",
        eventId: contextMenu.match.event?.eventId || "",
        eventLabel: contextMenu.match.event?.label || "",
        targetId: selectedChangeTarget?.targetId || "",
        targetLabel: selectedChangeTarget?.label || "",
        summary,
        instruction: contextComment.trim(),
        technicalContext,
        traceId: trace.traceId,
        requestId: trace.requestId
      });
      setContextToast("워크벤치 스택에 추가했습니다.");
      if (openWorkbench) {
        navigate("/admin/system/sr-workbench");
      }
      closeContextMenu();
    } catch (error) {
      setContextToast(error instanceof Error ? error.message : "워크벤치 스택 추가에 실패했습니다.");
    } finally {
      setContextActionLoading(false);
    }
  }

  async function handleQuickExecute() {
    if (!contextMenu.match) {
      return;
    }
    setContextActionLoading(true);
    try {
      const summary = buildContextSummary(contextMenu.match, contextComment);
      const instruction = contextComment.trim() || `${contextMenu.match.surface?.label || "선택 영역"} 기준으로 실제 수정이 필요한 파일만 반영합니다.`;
      const technicalContext = buildTechnicalContext(contextMenu.match, contextMenu.pageData, selectedChangeTarget, contextMenu.routePath || routePath);
      const directionLines = [
        `[SR 요약] ${summary}`,
        `대상 화면: ${contextMenu.match.page.label || contextMenu.pageId || page} (${contextMenu.match.page.routePath || contextMenu.routePath || routePath})`,
        `선택 요소: ${contextMenu.match.surface?.label || "-"}`,
        `이벤트: ${contextMenu.match.event?.label || "-"}`,
        `수정 레이어: ${selectedChangeTarget?.label || "-"}`,
        `실행 지시: ${instruction}`,
        "",
        "[technicalContext]",
        technicalContext || "-"
      ];
      const direction = directionLines.join("\n");
      await quickExecuteSrTicket({
        pageId: contextMenu.match.page.pageId || contextMenu.pageId || page,
        pageLabel: contextMenu.match.page.label || contextMenu.pageId || page,
        routePath: contextMenu.match.page.routePath || contextMenu.routePath || routePath,
        menuCode: contextMenu.match.page.menuCode || "",
        menuLookupUrl: contextMenu.match.page.menuLookupUrl || "",
        surfaceId: contextMenu.match.surface?.surfaceId || "",
        surfaceLabel: contextMenu.match.surface?.label || "",
        eventId: contextMenu.match.event?.eventId || "",
        eventLabel: contextMenu.match.event?.label || "",
        targetId: selectedChangeTarget?.targetId || "",
        targetLabel: selectedChangeTarget?.label || "",
        summary,
        instruction,
        technicalContext,
        generatedDirection: direction,
        commandPrompt: [
          "Carbonet SR ticket",
          `pageId=${contextMenu.match.page.pageId || contextMenu.pageId || page}`,
          `page=${contextMenu.match.page.label || contextMenu.pageId || page}`,
          `route=${contextMenu.match.page.routePath || contextMenu.routePath || routePath}`,
          `summary=${summary}`,
          "technicalContext=",
          technicalContext || "-",
          "direction=",
          direction
        ].join("\n")
      });
      setContextToast("선택 영역 즉시 수정 실행을 시작했습니다.");
      closeContextMenu();
    } catch (error) {
      setContextToast(error instanceof Error ? error.message : "즉시 수정 실행에 실패했습니다.");
    } finally {
      setContextActionLoading(false);
    }
  }

  return (
    <>
      {highlightRect ? (
        <>
          <div
            className="pointer-events-none fixed z-[1400] rounded-[10px] border-2 border-sky-500 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,116,144,0.25),0_18px_40px_rgba(14,116,144,0.18)]"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height
            }}
          />
          <div
            className="pointer-events-none fixed z-[1401] rounded-full bg-sky-600 px-3 py-1 text-[11px] font-black text-white shadow-lg"
            style={{
              top: Math.max(8, highlightRect.top - 30),
              left: Math.max(8, highlightRect.left)
            }}
          >
            {highlightLabel || "선택 영역"}
          </div>
        </>
      ) : null}

      {contextMenu.open ? (
        <div
          className="fixed z-[1500] w-[min(340px,calc(100vw-24px))] rounded-[18px] border border-slate-200 bg-white/98 p-4 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur"
          data-codex-context-menu=""
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="flex items-start justify-between gap-3 cursor-move select-none" onMouseDown={handleContextMenuHeaderMouseDown}>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-700">Codex Context</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{highlightLabel || "선택 영역"}</p>
              <p className="mt-1 text-xs text-slate-500">{contextMenu.match?.surface?.selector || contextMenu.match?.event?.triggerSelector || routePath}</p>
            </div>
            <button className="rounded-full border border-slate-200 px-2 py-1 text-xs font-bold text-slate-500" onClick={() => setContextMenu({ open: false, x: 0, y: 0, pageId: "", routePath: "", pageData: null, match: null })} type="button">닫기</button>
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-bold text-slate-700">수정 레이어</span>
            <select className="gov-select mt-1" value={selectedChangeTarget?.targetId || ""} onChange={(event) => setContextTargetId(event.target.value)}>
              {availableChangeTargets.map((item: ScreenCommandChangeTarget) => (
                <option key={item.targetId} value={item.targetId}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-bold text-slate-700">코멘트</span>
            <textarea
              className="gov-input mt-1 min-h-[96px] py-3 text-sm"
              placeholder="예: 이 버튼 클릭 시 실제 수정이 필요한 조건과 변경 의도를 적으세요."
              value={contextComment}
              onChange={(event) => setContextComment(event.target.value)}
            />
          </label>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button className="gov-btn gov-btn-secondary w-full justify-center" disabled={contextActionLoading} onClick={() => { void handleAddToStack(false); }} type="button">
              {contextActionLoading ? "처리 중..." : "워크벤치 스택에 추가"}
            </button>
            <button className="gov-btn gov-btn-outline-blue w-full justify-center" disabled={contextActionLoading} onClick={() => { void handleAddToStack(true); }} type="button">
              {contextActionLoading ? "처리 중..." : "스택 추가 후 워크벤치 열기"}
            </button>
            <button className="gov-btn gov-btn-primary w-full justify-center" disabled={contextActionLoading} onClick={() => { void handleQuickExecute(); }} type="button">
              {contextActionLoading ? "Codex 실행 중..." : "이 영역 바로 수정 실행"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        className="help-fab"
        onClick={() => setHelpOpen(true)}
        type="button"
      >
        도움말
      </button>

      {helpOpen ? (
        <Suspense fallback={null}>
          <HelpOverlay
            open={helpOpen}
            pageId={page}
            helpContent={helpContent}
            onClose={() => setHelpOpen(false)}
          />
        </Suspense>
      ) : null}

      {insttWarning ? (
        <div className="fixed left-1/2 top-4 z-[1200] w-[min(960px,calc(100%-32px))] -translate-x-1/2 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-warning-border)] bg-[var(--kr-gov-warning-bg)] px-5 py-4 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm font-medium text-[var(--kr-gov-text-primary)]">
              {insttWarning}
            </div>
            <button
              className="shrink-0 rounded border border-[var(--kr-gov-border-light)] bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-secondary)]"
              onClick={() => setInsttWarning("")}
              type="button"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {contextToast ? (
        <div className="fixed bottom-5 left-1/2 z-[1500] w-[min(720px,calc(100%-24px))] -translate-x-1/2 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
          {contextToast}
        </div>
      ) : null}

      {routeLoading ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/18 backdrop-blur-[1px]">
          <div className="min-w-[17rem] rounded-[calc(var(--kr-gov-radius)+6px)] border border-slate-200 bg-white/95 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="flex items-center gap-4">
              <div className="relative h-10 w-10 shrink-0">
                <span className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--kr-gov-blue)] border-r-[var(--kr-gov-blue)]" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">페이지 이동 중</p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">새 화면을 준비한 뒤 전환합니다.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ErrorBoundary resetKey={boundaryResetKey}>
        <Suspense fallback={<PageLoadingFallback />}>
          <CurrentPage key={boundaryResetKey} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

function PageLoadingFallback() {
  return null;
}
