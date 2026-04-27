import { fetchJoinSession } from "../../lib/api/joinSession";
import type { JoinSessionPayload } from "../../lib/api/joinTypes";
import { useAsyncValue } from "./useAsyncValue";

type UseJoinSessionOptions = {
  enabled?: boolean;
  onSuccess?: (session: JoinSessionPayload) => void;
};

export function useJoinSession(options: UseJoinSessionOptions = {}) {
  const { enabled = true, onSuccess } = options;

  return useAsyncValue<JoinSessionPayload>(async () => {
    const session = await fetchJoinSession();
    if (!session) {
      throw new Error("Join session is unavailable");
    }
    return session;
  }, [], {
    enabled,
    onSuccess
  });
}
