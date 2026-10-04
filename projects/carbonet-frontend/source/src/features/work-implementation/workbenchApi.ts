import { fetchJson, postAdminValidatedJson } from "../../lib/api/core";
import { createSrTicket, fetchSrWorkbenchPage, approveSrTicket } from "../../lib/api/platform";
import type { SrTicketDetailPayload, SrTicketArtifactPayload } from "../../lib/api/platformTypes";
export { createSrTicket, fetchSrWorkbenchPage, approveSrTicket };
export const fetchCodexSrTicketDetail = (id: string) => fetchJson<SrTicketDetailPayload>(`/admin/api/platform/workbench/tickets/${encodeURIComponent(id)}`, { credentials: "include" });
export const fetchCodexSrTicketArtifact = (id: string, type: string) => fetchJson<SrTicketArtifactPayload>(`/admin/api/platform/workbench/tickets/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(type)}`, { credentials: "include" });
export type DevelopmentCapabilities = { developmentOnly: boolean; planEnabled: boolean; executeEnabled: boolean; deploymentEnabled: boolean; reason: string };
export const fetchDevelopmentCapabilities = () => fetchJson<DevelopmentCapabilities>("/admin/api/platform/workbench/development-capabilities", { credentials: "include" });
export const runDevelopmentAction = (id: string, action: "plan" | "execute") => postAdminValidatedJson<{ success: boolean; message: string }>(
  `/admin/api/platform/workbench/tickets/${encodeURIComponent(id)}/development-${action}`, {}, "개발 작업 요청에 실패했습니다.");

export type WorkContext = { processCode: string; stepCode: string; processVersion: string; stepName: string; routePath: string; inputContract: unknown; outputContract: unknown; completionRule: string };
export function ticketContext(raw: string | undefined): Partial<WorkContext> {
  try { const value = JSON.parse(raw || "{}"); return value?.source === "work-implementation" ? value : {}; } catch { return {}; }
}
export function currentEvidence(raw: string | undefined, context: WorkContext) {
  const saved = ticketContext(raw);
  return !!context.processVersion && saved.processCode === context.processCode && saved.stepCode === context.stepCode && saved.processVersion === context.processVersion;
}
export function safeRoute(route: string) { return route.startsWith("/") && !route.startsWith("//") && !/[\\\r\n]/.test(route) ? route : ""; }
