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
  onClose: () => void;
};

export function HelpOverlay({ open, pageId, helpContent, workContext, onClose }: HelpOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const activeItem = useMemo(
    () => helpContent.items[Math.min(stepIndex, Math.max(helpContent.items.length - 1, 0))],
    [helpContent.items, stepIndex]
  );
  const placementClass = activeItem?.placement ? `help-overlay-panel-wrap placement-${activeItem.placement}` : "help-overlay-panel-wrap placement-top";
  const highlightToneClass = activeItem?.highlightStyle ? `help-target-${activeItem.highlightStyle}` : "help-target-focus";

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
    const element = document.querySelector(activeItem.anchorSelector);
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
      <div className={placementClass} role="dialog" aria-modal="true" aria-labelledby="help-overlay-title">
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

          {workContext?.workflow ? <div className="mx-5 mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm" data-help-work-context=""><p className="text-xs font-black uppercase tracking-wide text-blue-700">현재 업무 절차</p><h3 className="mt-1 font-black text-slate-900">{workContext.workflow.processName||workContext.workflow.processCode} · {Number(workContext.workflow.stepOrder||0)}. {workContext.workflow.stepName||workContext.workflow.stepCode}</h3><dl className="mt-2 grid gap-1 text-xs leading-5 text-slate-700"><div><dt className="inline font-black">담당자 </dt><dd className="inline">{workContext.workflow.actorName||workContext.workflow.actorCode||"-"}</dd></div><div><dt className="inline font-black">해야 할 일 </dt><dd className="inline">{workContext.workflow.workPurpose||"-"}</dd></div><div><dt className="inline font-black">입력 안내 </dt><dd className="inline whitespace-pre-wrap">{workContext.workflow.inputContract||"화면의 필수 입력값과 선택지를 확인합니다."}</dd></div><div><dt className="inline font-black">완료 기준 </dt><dd className="inline">{workContext.workflow.completionRule||"-"}</dd></div></dl></div> : workContext?.selectionRequired ? <div className="mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">이 화면은 여러 업무 절차에서 공통 사용됩니다. 업무 길잡이에서 현재 절차를 선택하면 해당 절차 도움말이 표시됩니다.</div> : workContext ? <div className="mx-5 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700" data-help-work-context="">이 화면에는 아직 실행 업무 절차가 연결되지 않았습니다. 화면 도움말은 사용할 수 있으며 업무 연결은 화면 설계에서 등록합니다.</div> : null}

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
