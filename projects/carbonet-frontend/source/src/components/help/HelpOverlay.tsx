import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { publishTelemetryEvent } from "../../platform/telemetry/events";
import { PageHelpContent } from "../../platform/screen-registry/helpContent";

type HelpOverlayProps = {
  open: boolean;
  pageId: string;
  helpContent: PageHelpContent;
  onClose: () => void;
};

export function HelpOverlay({ open, pageId, helpContent, onClose }: HelpOverlayProps) {
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
        itemCount: helpContent.items.length
      }
    });
  }, [helpContent.items.length, helpContent.pageId, open, pageId]);

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
        highlightStyle: activeItem.highlightStyle || "focus"
      }
    });
    return () => {
      element.classList.remove("help-target-active");
      element.classList.remove("help-target-focus", "help-target-warning", "help-target-success", "help-target-neutral");
    };
  }, [activeItem, highlightToneClass, open, pageId]);

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
