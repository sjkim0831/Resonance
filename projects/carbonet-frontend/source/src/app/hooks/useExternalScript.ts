import { useEffect } from "react";

const scriptRefCounts = new Map<string, number>();

export function useExternalScript(src: string) {
  useEffect(() => {
    const selector = `script[src="${src}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    const script = existing || document.createElement("script");
    const nextCount = (scriptRefCounts.get(src) || 0) + 1;
    scriptRefCounts.set(src, nextCount);

    if (!existing) {
      script.src = src;
      document.body.appendChild(script);
    }

    return () => {
      const currentCount = scriptRefCounts.get(src) || 0;
      if (currentCount <= 1) {
        scriptRefCounts.delete(src);
        script.remove();
        return;
      }
      scriptRefCounts.set(src, currentCount - 1);
    };
  }, [src]);
}
