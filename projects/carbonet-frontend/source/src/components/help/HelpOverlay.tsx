import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { publishTelemetryEvent } from "../../platform/telemetry/events";
import { PageHelpContent } from "../../platform/screen-registry/helpContent";
import type { ScreenWorkContext } from "../../features/runtime-assist/screenWorkContext";

type HelpOverlayProps = {
  open: boolean;
  pageId: string;
  helpContent: PageHelpContent;
  workContext?: ScreenWorkContext | null;
  versionedBinding?: {
    actorCode: string;
    audience: "USER";
    contractHash: string;
    processCode: string;
    source: "DB_VERSIONED_CONTRACT";
    stepCode: string;
    versionId: number;
  } | null;
  onClose: () => void;
};

export function HelpOverlay({ open, pageId, helpContent, workContext, versionedBinding = null, onClose }: HelpOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const activeItem = useMemo(
    () => helpContent.items[Math.min(stepIndex, Math.max(helpContent.items.length - 1, 0))],
    [helpContent.items, stepIndex]
  );
  const placementClass = activeItem?.placement ? `help-overlay-panel-wrap placement-${activeItem.placement}` : "help-overlay-panel-wrap placement-top";
  const highlightToneClass = activeItem?.highlightStyle ? `help-target-${activeItem.highlightStyle}` : "help-target-focus";
  const workClassification = workContext?.classification
    || (workContext?.workflow || workContext?.candidates?.length ? "EXECUTABLE" : "REVIEW_REQUIRED");

  useEffect(() => {
    if (!open) {
      return;
    }
    setStepIndex(0);
    setDragOffset({ x: 0, y: 0 });
    publishTelemetryEvent({
      type: "ui_action",
      pageId,
      actionId: "help_open",
      payloadSummary: {
        helpPageId: helpContent.pageId,
        itemCount: helpContent.items.length,
        routePath: workContext?.routePath || "",
        projectId: workContext?.identity?.projectId || "",
        processCode: workContext?.workflow?.processCode || "",
        stepCode: workContext?.workflow?.stepCode || "",
        actorCode: workContext?.workflow?.actorCode || ""
      }
    });
  }, [helpContent.items.length, helpContent.pageId, open, pageId, workContext?.identity?.projectId, workContext?.routePath, workContext?.workflow?.actorCode, workContext?.workflow?.processCode, workContext?.workflow?.stepCode]);

  useEffect(() => {
    if (!open || !activeItem?.anchorSelector) {
      return;
    }
    let element: Element | null = null;
    try {
      element = document.querySelector(activeItem.anchorSelector);
    } catch {
      return;
    }
    if (!(element instanceof HTMLElement)) {
      return;
    }
    element.classList.add("help-target-active");
    element.classList.add(highlightToneClass);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    publishTelemetryEvent({
      type: "ui_action",
      pageId,
      actionId: "help_step_view",
      payloadSummary: {
        helpItemId: activeItem.id,
        anchorSelector: activeItem.anchorSelector,
        placement: activeItem.placement || "top",
        highlightStyle: activeItem.highlightStyle || "focus",
        routePath: workContext?.routePath || "",
        processCode: workContext?.workflow?.processCode || "",
        stepCode: workContext?.workflow?.stepCode || "",
        actorCode: workContext?.workflow?.actorCode || ""
      }
    });
    return () => {
      element.classList.remove("help-target-active");
      element.classList.remove("help-target-focus", "help-target-warning", "help-target-success", "help-target-neutral");
    };
  }, [activeItem, highlightToneClass, open, pageId, workContext?.routePath, workContext?.workflow?.actorCode, workContext?.workflow?.processCode, workContext?.workflow?.stepCode]);

  if (!open) {
    return null;
  }

  function handleHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) {
      return;
    }
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    setDragOffset({
      x: dragState.baseX + (event.clientX - dragState.startX),
      y: dragState.baseY + (event.clientY - dragState.startY)
    });
  }

  function handleHeaderPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const overlay = (
    <>
      <div className="help-overlay-backdrop" onClick={onClose} />
      <div
        aria-labelledby="help-overlay-title"
        aria-modal="true"
        className={placementClass}
        data-actor-code={versionedBinding?.actorCode}
        data-audience={versionedBinding?.audience}
        data-contract-hash={versionedBinding?.contractHash}
        data-help-item-count={versionedBinding ? String(helpContent.items.length) : undefined}
        data-help-summary={versionedBinding ? helpContent.summary : undefined}
        data-help-title={versionedBinding ? helpContent.title : undefined}
        data-process-code={versionedBinding?.processCode}
        data-screen-access-restricted={versionedBinding ? "false" : undefined}
        data-screen-classification={versionedBinding ? "EXECUTABLE" : undefined}
        data-step-code={versionedBinding?.stepCode}
        data-support-source={versionedBinding?.source}
        data-version-id={versionedBinding ? String(versionedBinding.versionId) : undefined}
        data-versioned-support-help-dialog={versionedBinding ? "" : undefined}
        role="dialog"
      >
        <div className="help-overlay-panel" style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}>
          <div
            className="help-overlay-header help-overlay-drag-handle"
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={handleHeaderPointerEnd}
            onPointerCancel={handleHeaderPointerEnd}
          >
            <div>
              <p className="caption">Screen Help</p>
              <h2 id="help-overlay-title">{helpContent.title}</h2>
              <p className="state-text">{helpContent.summary}</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                publishTelemetryEvent({ type: "ui_action", pageId, actionId: "help_close" });
                onClose();
              }}
              type="button"
            >
              닫기
            </button>
          </div>

          {workContext?.accessRestricted ? (
            <div className="mx-5 mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-950" data-help-work-context="" data-screen-classification={workClassification} data-screen-access-restricted="true">{workContext.reasonText || "이 화면은 실행 업무 화면이지만 현재 계정의 담당 액터·권한 범위 밖입니다. 권한이 있는 계정으로 전환하거나 업무 배정을 확인하세요."}</div>
          ) : workClassification === "EXECUTABLE" && workContext?.workflow ? (
            <div className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm" data-help-work-context="" data-screen-classification={workClassification}>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">현재 업무 절차</p>
              <h3 className="mt-1 font-black text-slate-900">{workContext.workflow.processName||workContext.workflow.processCode} · {Number(workContext.workflow.stepOrder||0)}. {workContext.workflow.stepName||workContext.workflow.stepCode}</h3>
              <dl className="mt-2 grid gap-1 text-xs leading-5 text-slate-700"><div><dt className="inline font-black">담당자 </dt><dd className="inline">{workContext.workflow.actorName||workContext.workflow.actorCode||"-"}</dd></div><div><dt className="inline font-black">해야 할 일 </dt><dd className="inline">{workContext.workflow.workPurpose||"-"}</dd></div><div><dt className="inline font-black">입력 안내 </dt><dd className="inline whitespace-pre-wrap">{workContext.workflow.inputContract||"화면의 필수 입력값과 선택지를 확인합니다."}</dd></div><div><dt className="inline font-black">완료 기준 </dt><dd className="inline">{workContext.workflow.completionRule||"-"}</dd></div></dl>
            </div>
          ) : workClassification === "EXECUTABLE" && workContext?.selectionRequired ? (
            <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" data-help-work-context="" data-screen-classification={workClassification}>이 화면은 여러 업무 절차에서 공통 사용됩니다. 업무 길잡이에서 현재 절차를 선택하면 해당 절차 도움말이 표시됩니다.</div>
          ) : workClassification === "INFORMATIONAL" ? (
            <div className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900" data-help-work-context="" data-screen-classification={workClassification}>{workContext?.reasonText || "정보 조회 화면이며 실행 절차가 필요하지 않습니다. 조회 기준과 데이터 출처는 화면 도움말에서 확인할 수 있습니다."}</div>
          ) : workClassification === "EXCLUDED" ? (
            <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700" data-help-work-context="" data-screen-classification={workClassification}>{workContext?.reasonText || "보안·계정 복구·오류·인쇄 화면은 업무 실행 연동 대상에서 제외됩니다."}</div>
          ) : workContext ? (
            <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" data-help-work-context="" data-screen-classification={workClassification}>
              <p className="font-bold">{workContext.reasonText || "이 화면의 업무 연결 계약은 설계 검토가 필요합니다."}</p>
              <a className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-3 font-black text-amber-900 hover:bg-amber-100" href={`/admin/system/actor-process?tab=design-canvas&routePath=${encodeURIComponent(workContext.routePath)}`}>액터·프로세스 설계에서 검토</a>
            </div>
          ) : null}

          {activeItem ? (
            <div className="help-overlay-body">
              <div className="help-step-chip-row">
                <p className="eyebrow">Step {stepIndex + 1} / {helpContent.items.length}</p>
                {activeItem.iconName ? (
                  <span className="help-step-icon material-symbols-outlined" aria-hidden="true">
                    {activeItem.iconName}
                  </span>
                ) : null}
              </div>
              <h3>{activeItem.title}</h3>
              <p>{activeItem.body}</p>
              {activeItem.imageUrl ? (
                <div className="help-image-frame">
                  <img alt={activeItem.title} className="help-image" src={activeItem.imageUrl} />
                </div>
              ) : null}
              {activeItem.ctaLabel && activeItem.ctaUrl ? (
                <div className="help-overlay-cta">
                  <a className="primary-button help-cta-link" href={activeItem.ctaUrl}>
                    {activeItem.ctaLabel}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="help-overlay-body">
              <h3>등록된 도움말이 없습니다.</h3>
              <p>이 화면은 기본 manifest 정보만 등록되어 있습니다.</p>
            </div>
          )}

          <div className="help-overlay-footer">
            <button className="secondary-button" disabled={stepIndex <= 0} onClick={() => setStepIndex((value) => Math.max(value - 1, 0))} type="button">
              이전
            </button>
            <button
              className="primary-button"
              disabled={helpContent.items.length === 0}
              onClick={() => setStepIndex((value) => Math.min(value + 1, Math.max(helpContent.items.length - 1, 0)))}
              type="button"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(overlay, document.body);
}
