import { useEffect } from "react";

type ProjectTheme = {
  id?: string;
  tokens?: Record<string, unknown>;
};

type ProjectRuntimeInfo = {
  projectId?: string;
  theme?: ProjectTheme;
};

const TOKEN_NAME = /^--[a-z][a-z0-9-]{1,80}$/;
const FORBIDDEN_VALUE = /[;{}]|url\s*\(|expression\s*\(/i;

function safeTokenEntries(tokens: Record<string, unknown> | undefined) {
  return Object.entries(tokens || {}).filter(([name, value]) =>
    TOKEN_NAME.test(name)
      && (typeof value === "string" || typeof value === "number")
      && String(value).length <= 160
      && !FORBIDDEN_VALUE.test(String(value))
  );
}

export function useProjectTheme() {
  useEffect(() => {
    let cancelled = false;
    const root = document.documentElement;
    const appliedNames: string[] = [];

    fetch("/api/runtime/project-info", {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    })
      .then(async (response) => {
        if (!response.ok || !(response.headers.get("content-type") || "").includes("application/json")) {
          return null;
        }
        return response.json() as Promise<ProjectRuntimeInfo>;
      })
      .then((runtime) => {
        if (cancelled || !runtime) return;
        root.dataset.projectId = runtime.projectId || "";
        root.dataset.themeId = runtime.theme?.id || "theme-default";
        for (const [name, value] of safeTokenEntries(runtime.theme?.tokens)) {
          root.style.setProperty(name, String(value));
          appliedNames.push(name);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      for (const name of appliedNames) root.style.removeProperty(name);
    };
  }, []);
}
