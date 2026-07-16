import { useEffect } from "react";

const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,span,a,button,label,legend,th,td,dt,dd,li,code,pre";
const FLUID_SELECTOR = "img,svg,canvas,video,iframe,input,select,textarea,button";

function applyOverflowGuards(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(TEXT_SELECTOR).forEach((element) => {
    if (element.closest(".material-symbols-outlined,.material-icons")) return;
    const overflowX = element.scrollWidth > element.clientWidth + 1;
    const overflowY = element.scrollHeight > element.clientHeight + 1;
    if (overflowX || overflowY) element.dataset.krdsOverflow = "wrap";
    else delete element.dataset.krdsOverflow;
  });

  root.querySelectorAll<HTMLElement>(FLUID_SELECTOR).forEach((element) => {
    element.dataset.krdsFluid = "true";
  });

  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const parent = table.parentElement;
    if (!parent) return;
    if (table.scrollWidth > parent.clientWidth + 1) parent.dataset.krdsTableViewport = "true";
    else delete parent.dataset.krdsTableViewport;
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
