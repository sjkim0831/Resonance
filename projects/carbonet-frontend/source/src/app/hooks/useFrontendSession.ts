import { useMemo } from "react";
import {
  fetchFrontendSession,
  invalidateFrontendSessionCache,
  readFrontendSessionSnapshot
} from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import { buildLocalizedPath, getCsrfMeta, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import { getCurrentRuntimeLocationState } from "../routes/runtime";
import { useAsyncValue } from "./useAsyncValue";

type UseFrontendSessionOptions = {
  enabled?: boolean;
};

export function useFrontendSession(options: UseFrontendSessionOptions = {}) {
  const { enabled = true } = options;
  const initialSession = readFrontendSessionSnapshot();
  const sessionState = useAsyncValue<FrontendSession>(fetchFrontendSession, [], {
    enabled,
    initialValue: initialSession,
    skipInitialLoad: Boolean(initialSession)
  });
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
        await fetch(buildLocalizedPath("/signin/actionLogout", "/en/signin/actionLogout"), {
          method: "POST",
          credentials: "include",
          headers
        });
      } finally {
        invalidateFrontendSessionCache();
        const nextPath = buildLocalizedPath("/home", "/en/home");
        if (getCurrentRuntimeLocationState() === nextPath) {
          window.dispatchEvent(new Event(getNavigationEventName()));
          return;
        }
        navigate(nextPath);
      }
    }
  }), [logoutMessage, sessionState.value]);

  return {
    ...sessionState,
    ...actions
  };
}
