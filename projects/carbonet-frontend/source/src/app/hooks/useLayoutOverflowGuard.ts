import { useEffect } from "react";

const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,span,a,button,label,legend,th,td,dt,dd,li,code,pre";
const FLUID_SELECTOR = "img,svg,canvas,video,iframe,input,select,textarea,button";

function applyOverflowGuards(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(TEXT_SELECTOR).forEach((element) => {
    if (element.closest(".material-symbols-outlined,.material-icons")) return;
    // The guard itself changes wrapping and therefore the element's height.
    // Removing the marker as soon as wrapping resolves the overflow creates a
    // ResizeObserver feedback loop: nowrap -> wrap -> nowrap. Near the bottom
    // of a page the browser repeatedly clamps scrollY to the changing document
    // height, which looks like the whole screen is bouncing. Once protection is
    // required, keep it for the lifetime of the mounted node. A wider viewport
    // does not make normal wrapping harmful, and remounted route content gets a
    // fresh measurement.
    if (element.dataset.krdsOverflow === "wrap") return;
    const overflowX = element.scrollWidth > element.clientWidth + 1;
    const overflowY = element.scrollHeight > element.clientHeight + 1;
    if (overflowX || overflowY) element.dataset.krdsOverflow = "wrap";
  });

  root.querySelectorAll<HTMLElement>(FLUID_SELECTOR).forEach((element) => {
    const hasExplicitHeight = element.hasAttribute("height")
      || Boolean((element as HTMLElement).style.height)
      || element.className.toString().split(/\s+/).some((className) => /^(?:h|min-h|max-h|aspect)-/.test(className));
    if (hasExplicitHeight) delete element.dataset.krdsFluid;
    else element.dataset.krdsFluid = "true";
  });

  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const parent = table.parentElement;
    if (!parent) return;
    // Keep the viewport once installed. The viewport styles can change the
    // table's measured width, so toggling this marker from ResizeObserver is
    // subject to the same layout feedback loop as text wrapping.
    if (parent.dataset.krdsTableViewport === "true") return;
    if (table.scrollWidth > parent.clientWidth + 1) parent.dataset.krdsTableViewport = "true";
  });
}

/** Applies framework-wide overflow protection after route, content, and size changes. */
export function useLayoutOverflowGuard() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyOverflowGuards(root));
    };
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: true, characterData: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("beforeprint", schedule);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("beforeprint", schedule);
    };
  }, []);
}
