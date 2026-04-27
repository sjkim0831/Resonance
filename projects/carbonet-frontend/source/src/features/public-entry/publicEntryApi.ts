import { postJson } from "../../lib/api/core";

export async function postJsonWithSession<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  return postJson<TResponse>(url, payload);
}
