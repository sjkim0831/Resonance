import { buildAdminApiPath, buildQueryString, fetchJson } from "./core";

export type UnifiedLogTab =
  | "all"
  | "access-auth"
  | "audit"
  | "error"
  | "trace"
  | "security"
  | "batch-runtime";

export interface UnifiedLogSearchParams {
  pageIndex?: number;
  pageSize?: number;
  tab?: UnifiedLogTab;
  logType?: string;
  detailType?: string;
  resultCode?: string;
  actorId?: string;
  actorRole?: string;
  insttId?: string;
  memberType?: string;
  menuCode?: string;
  pageId?: string;
  componentId?: string;
  functionId?: string;
  apiId?: string;
  actionCode?: string;
  targetType?: string;
  targetId?: string;
  traceId?: string;
  requestUri?: string;
  remoteAddr?: string;
  fromDate?: string;
  toDate?: string;
  searchKeyword?: string;
}

export interface UnifiedLogRow {
  logId: string;
  logType: string;
  detailType: string;
  occurredAt: string;
  resultCode: string;
  actorId: string;
  actorRole: string;
  insttId: string;
  companyName: string;
  memberType: string;
  menuCode: string;
  pageId: string;
  componentId: string;
  functionId: string;
  apiId: string;
  actionCode: string;
  targetType: string;
  targetId: string;
  traceId: string;
  requestUri: string;
  remoteAddr: string;
  durationMs: number | null;
  summary: string;
  message: string;
  rawSourceType: string;
}

export interface UnifiedLogSearchPayload {
  totalCount: number;
  items: UnifiedLogRow[];
}

export async function fetchUnifiedLog(params?: UnifiedLogSearchParams): Promise<UnifiedLogSearchPayload> {
  return fetchJson<UnifiedLogSearchPayload>(
    `${buildAdminApiPath("/api/platform/observability/unified-log")}${buildQueryString(params)}`,
    {
      apiId: "admin.observability.unified-log.search"
    }
  );
}
