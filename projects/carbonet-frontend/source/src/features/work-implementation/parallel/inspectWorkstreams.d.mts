export type Workstream = {
  id: string; sortOrder?: number; name: string; assignee: string; model: string; state: string; goal: string;
  ownedPaths: string[]; steps: { processCode: string; stepCode: string; expectedVersion: string; pageIds: string[] }[];
  pages: { pageId: string; route: string; sourcePath: string; permissionCodes: string[] }[];
  apis: { method: string; path: string }[]; permissions: { code: string }[];
  dependencies: { contractId: string; version: string }[]; migrationVersions: string[];
  evidence?: Record<string, { status: string; commit: string; artifact: string }>;
};
export type Policy = { protectedPaths: string[]; requiredChecks: string[]; sharedPermissions: string[]; contracts: { id: string; version: string; status: string }[] };
export type Finding = { code: string; message: string; streamIds: string[]; severity: string };
export function normalizeRoute(value: string): string;
export function inspectWorkstreams(streams: Workstream[], policy: Policy, options?: { existingPaths?: string[]; head?: string; catalog?: { processCode: string; processVersion?: string; steps?: { stepCode: string }[] }[] }): { findings: Finding[]; conflictCount: number; integrationReady: boolean };
export function inspectChangedFiles(stream: Workstream, policy: Policy, paths: string[]): { code: string; path: string }[];
