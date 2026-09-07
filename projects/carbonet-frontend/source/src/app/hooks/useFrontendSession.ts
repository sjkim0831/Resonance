import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchFrontendSession,
  getFrontendSessionInvalidationEventName,
  invalidateFrontendSessionCache,
  readFrontendSessionSnapshot
} from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import { buildLocalizedPath, getCsrfMeta, isEnglish } from "../../lib/navigation/runtime";
import { useAsyncValue } from "./useAsyncValue";

type UseFrontendSessionOptions = {
  enabled?: boolean;
  revalidate?: boolean;
};

async function revalidateFrontendSession(): Promise<FrontendSession> {
  const response = await fetch("/api/frontend/session", {
    credentials: "include",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
  if (!response.ok) {
    throw new Error(`Failed to revalidate session: ${response.status}`);
  }
  return response.json() as Promise<FrontendSession>;
}

export function useFrontendSession(options: UseFrontendSessionOptions = {}) {
  const { enabled = true, revalidate = false } = options;
  // The cache reader may materialize an equivalent object on every render.
  // Keep the mount snapshot stable so useAsyncValue does not continuously
  // reapply it and trigger an authentication-boundary render loop.
  const [initialSession] = useState<FrontendSession | null>(() => readFrontendSessionSnapshot());
  const sessionLoader = !revalidate && initialSession?.authenticated === true
    ? fetchFrontendSession
    : revalidateFrontendSession;
  const sessionState = useAsyncValue<FrontendSession>(sessionLoader, [], {
    enabled,
    initialValue: revalidate ? null : initialSession,
    // A cached anonymous snapshot may have been captured immediately before a
    // successful login. Revalidate it so authenticated-only utilities such as
    // the full task guide are promoted without requiring a second reload.
    skipInitialLoad: !revalidate && initialSession?.authenticated === true
  });
  const reloadRef = useRef(sessionState.reload);
  reloadRef.current = sessionState.reload;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const eventName = getFrontendSessionInvalidationEventName();
    const handleInvalidation = () => {
      sessionState.setValue(null);
      sessionState.setError("");
      void reloadRef.current();
    };
    window.addEventListener(eventName, handleInvalidation);
    return () => window.removeEventListener(eventName, handleInvalidation);
  }, [enabled, sessionState.setError, sessionState.setValue]);
  const logoutMessage = isEnglish()
    ? "Do you want to log out?"
    : "로그아웃 하시겠습니까?";

  const actions = useMemo(() => ({
    async logout() {
      if (!window.confirm(logoutMessage)) {
        return;
      }

      const session = sessionState.value;
      const headers: Record<string, string> = {};
      const csrf = getCsrfMeta();
      if (session?.csrfHeaderName && session.csrfToken) {
        headers[session.csrfHeaderName] = session.csrfToken;
      } else if (csrf.token) {
        headers[csrf.headerName] = csrf.token;
      }

      try {
        const response = await fetch(buildLocalizedPath("/signin/actionLogout", "/en/signin/actionLogout"), {
          method: "POST",
          credentials: "include",
          headers
        });
        if (!response.ok) throw new Error(`Logout failed: ${response.status}`);
        invalidateFrontendSessionCache();
        const nextPath = buildLocalizedPath("/home", "/en/home");
        // Logout crosses an authentication boundary. A full navigation also
        // clears mounted header/bootstrap state when already on the home route.
        window.location.replace(nextPath);
      } catch {
        window.alert(isEnglish()
          ? "Could not confirm logout. Please try again."
          : "로그아웃 완료를 확인하지 못했습니다. 다시 시도해 주세요.");
      }
    }
  }), [logoutMessage, sessionState.value]);

  return {
    ...sessionState,
    ...actions
  };
}
