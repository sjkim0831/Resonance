import { useEffect, useRef, useState } from "react";
import { fetchScreenCommandPage } from "../../lib/api/platform";
import type { ScreenCommandEvent, ScreenCommandPagePayload, ScreenCommandSurface } from "../../lib/api/platformTypes";
import { resolveManagedRuntimeHref, resolveRuntimeRoutePath, type ManagedRuntimeRoute } from "../routes/runtime";

type ContextMenuTarget = Pick<ManagedRuntimeRoute, "pageId" | "routePath">;

export type MatchedContext = {
  page: ScreenCommandPagePayload["page"];
  surface?: ScreenCommandSurface;
  event?: ScreenCommandEvent;
  highlightElement: Element;
};

type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  pageId: ContextMenuTarget["pageId"] | "";
  routePath: ContextMenuTarget["routePath"];
  pageData: ScreenCommandPagePayload | null;
  match: MatchedContext | null;
};

const INTERACTIVE_TARGET_SELECTOR = [
  "input",
  "select",
  "textarea",
  "button",
  "a",
  "label",
  "th",
  "td"
].join(", ");

const BROAD_CONTAINER_SELECTOR = [
  "[data-help-id]",
  "form",
  "section",
  "article",
  "table",
  ".gov-card"
].join(", ");

function safelyClosest(element: Element, selector: string): Element | null {
  const normalized = selector.trim();
  if (!normalized) {
    return null;
  }
  try {
    return element.closest(normalized);
  } catch {
    return null;
  }
}

function resolvePreferredTargetElement(element: Element | null) {
  if (!element) {
    return null;
  }
  let current: Element | null = element;
  let fallback: Element | null = null;
  while (current && current !== document.body) {
    if (current.matches(INTERACTIVE_TARGET_SELECTOR)) {
      return current;
    }
    if (!fallback && current.tagName === "DIV" && current.parentElement?.matches(BROAD_CONTAINER_SELECTOR)) {
      fallback = current;
    }
    if (current.hasAttribute("data-help-id")) {
      return fallback || current;
    }
    current = current.parentElement;
  }
  return fallback || safelyClosest(element, INTERACTIVE_TARGET_SELECTOR) || element;
}

function resolveMatchedContext(payload: ScreenCommandPagePayload | null, element: Element | null): MatchedContext | null {
  if (!payload?.page || !element) {
    return null;
  }
  const page = payload.page;
  const targetElement = resolvePreferredTargetElement(element);
  const matchedSurface = [...(page.surfaces || [])]
    .map((surface) => ({
      surface,
      matchedElement: (targetElement ? safelyClosest(targetElement, surface.selector) : null) || safelyClosest(element, surface.selector)
    }))
    .filter((item): item is { surface: ScreenCommandSurface; matchedElement: Element } => Boolean(item.matchedElement))
    .sort((left, right) => right.surface.selector.length - left.surface.selector.length)[0];
  const highlightElement = targetElement || matchedSurface?.matchedElement || element;
  const surface = matchedSurface?.surface;
  const relatedEvents = (page.events || []).filter((event) => !surface?.eventIds?.length || surface.eventIds.includes(event.eventId));
  const event = relatedEvents.find((item) => Boolean((targetElement ? safelyClosest(targetElement, item.triggerSelector) : null) || safelyClosest(element, item.triggerSelector)))
    || relatedEvents[0]
    || (page.events || [])[0];
  return {
    page,
    surface,
    event,
    highlightElement
  };
}

function resolveContextTargetFromElement(
  element: Element | null,
  fallbackRoutePath: ContextMenuTarget["routePath"]
): ContextMenuTarget {
  const resolveFallbackTarget = () => resolveRuntimeRoutePath(fallbackRoutePath);
  if (!element) {
    return resolveFallbackTarget();
  }
  const anchor = element.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return resolveFallbackTarget();
  }
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return resolveFallbackTarget();
  }
  const managedRoute = resolveManagedRuntimeHref(anchor.href);
  if (!managedRoute) {
    return resolveFallbackTarget();
  }
  return managedRoute;
}

function measureHighlightRect(element: Element | null) {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  };
}

function createClosedContextMenu(): ContextMenuState {
  return { open: false, x: 0, y: 0, pageId: "", routePath: "", pageData: null, match: null };
}

function buildHighlightLabel(match: MatchedContext | null) {
  return [match?.page?.label, match?.surface?.label, match?.event?.label].filter(Boolean).join(" / ");
}

export function useScreenContextMenu(page: string, routePath: string) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(createClosedContextMenu);
  const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [highlightLabel, setHighlightLabel] = useState("");
  const [contextComment, setContextComment] = useState("");
  const [contextTargetId, setContextTargetId] = useState("");
  const [contextActionLoading, setContextActionLoading] = useState(false);
  const [contextToast, setContextToast] = useState("");
  const contextMenuDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const contextMenuDraggingRef = useRef(false);
  const screenCommandCacheRef = useRef<Record<string, ScreenCommandPagePayload>>({});
  const contextMenuOpenRef = useRef(false);
  const contextMenuPageDataRef = useRef<ScreenCommandPagePayload | null>(null);

  function clampContextMenuPosition(x: number, y: number) {
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - 360)),
      y: Math.max(8, Math.min(y, window.innerHeight - 320))
    };
  }

  function closeContextMenu() {
    setContextMenu(createClosedContextMenu());
    contextMenuOpenRef.current = false;
    contextMenuPageDataRef.current = null;
    setHighlightRect(null);
    setHighlightLabel("");
    setContextComment("");
    setContextTargetId("");
    setContextActionLoading(false);
  }

  useEffect(() => {
    closeContextMenu();
  }, [page, routePath]);

  useEffect(() => {
    let toastTimer: number | undefined;
    if (contextToast) {
      toastTimer = window.setTimeout(() => setContextToast(""), 5000);
    }
    return () => {
      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }
    };
  }, [contextToast]);

  useEffect(() => {
    contextMenuOpenRef.current = contextMenu.open;
    contextMenuPageDataRef.current = contextMenu.pageData;
  }, [contextMenu.open, contextMenu.pageData]);

  useEffect(() => {
    async function ensureScreenCommandPage(pageId: string) {
      if (screenCommandCacheRef.current[pageId]) {
        return screenCommandCacheRef.current[pageId];
      }
      const payload = await fetchScreenCommandPage(pageId);
      screenCommandCacheRef.current[pageId] = payload;
      return payload;
    }

    async function handleContextMenu(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || target.closest("[data-codex-context-menu]")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const targetContext = resolveContextTargetFromElement(target, routePath);
      const payload = await ensureScreenCommandPage(targetContext.pageId);
      const match = resolveMatchedContext(payload, target);
      const defaultTarget = payload.page?.changeTargets?.[0]?.targetId || "";
      contextMenuOpenRef.current = true;
      contextMenuPageDataRef.current = payload;
      setContextMenu({
        open: true,
        ...clampContextMenuPosition(event.clientX, event.clientY),
        pageId: targetContext.pageId,
        routePath: targetContext.routePath,
        pageData: payload,
        match
      });
      setContextTargetId(defaultTarget);
      setHighlightRect(measureHighlightRect(match?.highlightElement || target));
      setHighlightLabel(buildHighlightLabel(match));
    }

    function handleMouseMove(event: MouseEvent) {
      if (contextMenuDraggingRef.current && contextMenuDragOffsetRef.current) {
        const nextX = event.clientX - contextMenuDragOffsetRef.current.x;
        const nextY = event.clientY - contextMenuDragOffsetRef.current.y;
        setContextMenu((current) => current.open
          ? { ...current, ...clampContextMenuPosition(nextX, nextY) }
          : current);
        return;
      }
      if (!contextMenuOpenRef.current || !contextMenuPageDataRef.current) {
        return;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!(element instanceof Element) || element.closest("[data-codex-context-menu]")) {
        return;
      }
      const match = resolveMatchedContext(contextMenuPageDataRef.current, element);
      setContextMenu((current) => ({ ...current, match }));
      setHighlightRect(measureHighlightRect(match?.highlightElement || element));
      setHighlightLabel(buildHighlightLabel(match));
    }

    function handlePointerDown(event: MouseEvent) {
      if (event.button === 2) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("[data-codex-context-menu]")) {
        return;
      }
      if (contextMenuOpenRef.current) {
        closeContextMenu();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    }

    function handleMouseUp() {
      contextMenuDraggingRef.current = false;
      contextMenuDragOffsetRef.current = null;
    }

    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", closeContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", closeContextMenu);
    };
  }, [page, routePath]);

  function handleContextMenuHeaderMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    contextMenuDraggingRef.current = true;
    contextMenuDragOffsetRef.current = {
      x: event.clientX - contextMenu.x,
      y: event.clientY - contextMenu.y
    };
    event.preventDefault();
    event.stopPropagation();
  }

  const availableChangeTargets = contextMenu.pageData?.page?.changeTargets || [];
  const selectedChangeTarget = availableChangeTargets.find((item) => item.targetId === contextTargetId) || availableChangeTargets[0];

  return {
    availableChangeTargets,
    closeContextMenu,
    contextActionLoading,
    contextComment,
    contextMenu,
    contextToast,
    contextTargetId,
    handleContextMenuHeaderMouseDown,
    highlightLabel,
    highlightRect,
    selectedChangeTarget,
    setContextActionLoading,
    setContextComment,
    setContextMenu,
    setContextTargetId,
    setContextToast
  };
}
