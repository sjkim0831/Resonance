import {
  copyProjectLifecycle,
  deleteProjectLifecycle,
  lockProjectLifecyclePublicationMutation,
  projectLifecycleMutationLockKey,
  ProjectLifecyclePublicationFenceError,
  recoverProjectRuntimePurgeSagas,
  registerProjectLifecycleRoutes,
  type ProjectLifecycleIdentity,
  type ProjectRuntimePurgeGateway,
} from './projectLifecycleRoutes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const identity: ProjectLifecycleIdentity = {
  actorRef: 'user:default/designer',
  principals: ['user:default/designer'],
  accountId: 'runtime.admin',
  systemAdministrator: false,
};
const deleteIdentity: ProjectLifecycleIdentity = {
  ...identity,
  systemAdministrator: true,
};
const recoveryIdentity = {
  accountId: 'runtime.recovery',
  actorRef: 'service:default/runtime-purge-recovery',
};
const runtimeSnapshot = 'd'.repeat(64);
const runtimePurgeGateway = () => {
  const preflightRecovery = jest.fn(async (recovery: any) => ({
    success: true,
    status: 'READY',
    accountId: recovery.accountId,
    authorityValidated: true,
  }));
  const proveAbsent = jest.fn(async (command: any) => ({
    success: true,
    status: 'PROVEN_ABSENT',
    proofId: command.proofId,
    projectId: command.projectId,
    projectScopedRows: 0,
    releaseRows: 0,
    sourceRows: 0,
    runtimeResourceRows: 0,
    residualRows: 0,
    exactZero: true,
    proofSha256: 'e'.repeat(64),
  }));
  const activateAbsent = jest.fn(async (command: any) => ({
    success: true,
    status: 'PROVEN_ABSENT',
    proofId: command.proofId,
    projectId: command.projectId,
    projectScopedRows: 0,
    releaseRows: 0,
    sourceRows: 0,
    runtimeResourceRows: 0,
    residualRows: 0,
    exactZero: true,
    proofSha256: 'e'.repeat(64),
    fenceStatus: 'ACTIVE',
    activated: true,
    idempotent: false,
  }));
  const releaseAbsent = jest.fn(async (command: any) => ({
    success: true,
    proofId: command.proofId,
    projectId: command.projectId,
    fenceStatus: 'RELEASED',
    idempotent: false,
  }));
  const preview = jest.fn(async (command: any) => ({
    success: true,
    status: 'PREVIEWED',
    receiptId: command.receiptId,
    operationKey: command.operationKey,
    projectId: command.projectId,
    processCode: command.processCode,
    designVersion: command.designVersion,
    contractSha256: command.contractSha256,
    scopeMode: command.scopeMode,
    snapshotSha256: runtimeSnapshot,
    impact: { totalRows: 12 },
    blockers: { blocked: false },
  }));
  const apply = jest.fn(async (command: any) => ({
    success: true,
    status: 'PURGED',
    receiptId: command.receiptId,
    operationKey: command.operationKey,
    projectId: command.projectId,
    processCode: command.processCode,
    designVersion: command.designVersion,
    contractSha256: command.contractSha256,
    scopeMode: command.scopeMode,
    snapshotSha256: command.snapshotSha256,
    postcondition: {
      exactZero: true,
      capturedEqualsDeleted: true,
      capturedScopeCounts: {
        releaseRows: 1,
        residualRows: 12,
        exactZero: false,
      },
      deletedScopeCounts: { releaseRows: 1, residualRows: 12 },
      residualScopeCounts: {
        releaseRows: 0,
        residualRows: 0,
        exactZero: true,
      },
    },
  }));
  const restore = jest.fn(async (command: any) => ({
    success: true,
    status: 'RESTORED',
    receiptId: command.receiptId,
    operationKey: command.operationKey,
    projectId: command.projectId,
    processCode: command.processCode,
    designVersion: command.designVersion,
    contractSha256: command.contractSha256,
    scopeMode: command.scopeMode,
    snapshotSha256: command.snapshotSha256,
    aToBToA: true,
  }));
  return {
    preflightRecovery,
    proveAbsent,
    activateAbsent,
    releaseAbsent,
    preview,
    apply,
    restore,
  } satisfies ProjectRuntimePurgeGateway;
};

const deniedDatabase = () => {
  const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];
  const transaction = Object.assign(
    (table: string) => {
      const state: { where?: Record<string, unknown> } = {};
      const builder: any = {
        select: () => builder,
        where: (value: Record<string, unknown>) => {
          state.where = { ...(state.where ?? {}), ...value };
          return builder;
        },
        whereIn: () => builder,
        forUpdate: () => builder,
        first: async () => {
          if (table === 'resonance_projects__project') {
            return {
              project_id: state.where?.project_id,
              project_name: 'Source',
              description: '',
              owner: 'source-owner',
              source_repository: '',
              database_mode: 'PROJECT_DB',
              runtime_mode: 'DEDICATED_PROJECT_RUNTIME',
              design_version: 3,
              updated_at: new Date('2026-08-16T00:00:00Z'),
            };
          }
          return undefined;
        },
        insert: async (value: Record<string, unknown>) => {
          inserts.push({ table, value });
          return 1;
        },
      };
      return builder;
    },
    { raw: async () => undefined },
  );
  return {
    inserts,
    knex: {
      transaction: async (callback: (tx: any) => unknown) =>
        callback(transaction),
    },
  };
};

const approvedCopyDatabase = () => {
  const inserts: Array<{ table: string; value: unknown }> = [];
  const sourceUpdatedAt = new Date('2026-08-16T00:00:00Z');
  const transaction = Object.assign(
    (table: string) => {
      const state: { where?: Record<string, unknown> } = {};
      const builder: any = {
        select: () => builder,
        where: (value: Record<string, unknown>) => {
          state.where = { ...(state.where ?? {}), ...value };
          return builder;
        },
        whereIn: () => builder,
        forUpdate: () => builder,
        first: async () => {
          if (
            table === 'resonance_projects__project' &&
            state.where?.project_id === 'SOURCE'
          ) {
            return {
              project_id: 'SOURCE',
              project_name: 'Source',
              description: 'source settings',
              owner: 'user:default/source-owner',
              source_repository: 'source-repository',
              database_mode: 'PROJECT_DB',
              runtime_mode: 'DEDICATED_PROJECT_RUNTIME',
              design_version: 3,
              updated_at: sourceUpdatedAt,
            };
          }
          if (table === 'resonance_projects__design_asset_role_assignment') {
            return { assignment_id: 9 };
          }
          return undefined;
        },
        insert: async (value: unknown) => {
          inserts.push({ table, value });
          return 1;
        },
      };
      return builder;
    },
    { raw: async () => undefined },
  );
  return {
    inserts,
    knex: {
      transaction: async (callback: (tx: any) => unknown) =>
        callback(transaction),
    },
  };
};

const approvedDeleteDatabase = (
  projectCasCount = 1,
  syncStatus?:
    | 'PREPARED'
    | 'PENDING'
    | 'RUNNING'
    | 'SYNCHRONIZED'
    | 'CANCELLED'
    | 'SYNC_TRACKING_FAILED',
  releaseStatus = 'APPLIED',
  legacyProcessCode?: string,
  noReleases = false,
  options: {
    publicationStatus?: 'PENDING' | 'RUNNING';
    failAfterLocalCommit?: boolean;
    leaveSagaPurgedAfterLocalCommit?: boolean;
  } = {},
) => {
  const inserts: Array<{ table: string; value: unknown }> = [];
  const deletes: Array<{ table: string; where: Record<string, unknown> }> = [];
  const rawBindings: unknown[][] = [];
  const updatedAt = new Date('2026-08-16T00:00:00Z');
  const createdAt = new Date('2026-08-15T00:00:00Z');
  const sagas: Array<Record<string, any>> = [];
  let projectExists = true;
  let lostCommitResponse = false;
  let suppressedLocalApplied = false;
  const releases = noReleases
    ? []
    : [
        {
          project_id: 'TARGET',
          design_version: 3,
          release_status: releaseStatus,
          contract_sha256: 'c'.repeat(64),
          contract_payload: { process: { processCode: 'RFP_TARGET' } },
        },
        ...(legacyProcessCode
          ? [
              {
                project_id: 'TARGET',
                design_version: 2,
                release_status: 'APPLIED',
                contract_sha256: 'b'.repeat(64),
                contract_payload: {
                  process: { processCode: legacyProcessCode },
                },
              },
            ]
          : []),
      ];
  const transaction = Object.assign(
    (table: string) => {
      const state: {
        where?: Record<string, unknown>;
        whereIn?: { column: string; values: unknown[] };
        comparisons: Array<{
          column: string;
          operator: string;
          value: unknown;
        }>;
        order?: { column: string; direction?: string };
      } = { comparisons: [] };
      const comparable = (value: unknown) =>
        value instanceof Date ? value.getTime() : value;
      const equal = (actual: unknown, expected: unknown) =>
        actual == null && expected == null
          ? true
          : comparable(actual) === comparable(expected);
      const matches = (row: Record<string, any>) => {
        const exact = Object.entries(state.where ?? {}).every(([key, value]) =>
          equal(row[key], value),
        );
        const inValues = state.whereIn
          ? state.whereIn.values.includes(row[state.whereIn.column])
          : true;
        const comparisons = state.comparisons.every(predicate => {
          const actual = comparable(row[predicate.column]) as any;
          const expected = comparable(predicate.value) as any;
          if (actual == null || expected == null) return false;
          if (predicate.operator === '>') return actual > expected;
          if (predicate.operator === '<') return actual < expected;
          if (predicate.operator === '>=') return actual >= expected;
          if (predicate.operator === '<=') return actual <= expected;
          return actual === expected;
        });
        return exact && inValues && comparisons;
      };
      const builder: any = {
        select: () => builder,
        where: (value: Record<string, unknown>) => {
          state.where = { ...(state.where ?? {}), ...value };
          return builder;
        },
        whereIn: (column: string, values: unknown[]) => {
          state.whereIn = { column, values };
          return builder;
        },
        andWhere: (column: string, operator: string, value: unknown) => {
          state.comparisons.push({ column, operator, value });
          return builder;
        },
        orderBy: (column: string, direction?: string) => {
          state.order = { column, direction };
          return builder;
        },
        limit: () => builder,
        forUpdate: () => builder,
        skipLocked: () => builder,
        first: async () => {
          if (table === 'resonance_projects__project') {
            if (!projectExists) return undefined;
            return {
              project_id: 'TARGET',
              project_name: 'Target',
              design_version: 3,
              created_at: createdAt,
              updated_at: updatedAt,
            };
          }
          if (table === 'resonance_projects__design_asset_role_assignment') {
            return { assignment_id: 9 };
          }
          if (table === 'resonance_projects__runtime_purge_saga') {
            return [...sagas].reverse().find(matches);
          }
          if (
            table === 'resonance_projects__requirement_document' &&
            options.publicationStatus &&
            state.whereIn?.column === 'publication_reconcile_status' &&
            state.whereIn.values.includes(options.publicationStatus)
          ) {
            return {
              document_id: 'requirement-active-1',
              publication_reconcile_status: options.publicationStatus,
            };
          }
          if (
            table === 'resonance_projects__design_asset_source_sync' &&
            syncStatus &&
            state.whereIn?.column === 'sync_status' &&
            state.whereIn.values.includes(syncStatus)
          ) {
            return { sync_id: 'sync-1', sync_status: syncStatus };
          }
          return undefined;
        },
        delete: async () => {
          deletes.push({ table, where: state.where ?? {} });
          if (table === 'resonance_projects__project') {
            if (projectCasCount === 1) projectExists = false;
            return projectCasCount;
          }
          return 1;
        },
        insert: async (value: unknown) => {
          inserts.push({ table, value });
          if (table === 'resonance_projects__runtime_purge_saga') {
            sagas.push({ ...(value as Record<string, unknown>) });
          }
          return 1;
        },
        update: async (value: Record<string, unknown>) => {
          if (table !== 'resonance_projects__runtime_purge_saga') return 1;
          const row = sagas.find(matches);
          if (!row) return 0;
          if (
            options.leaveSagaPurgedAfterLocalCommit &&
            !suppressedLocalApplied &&
            value.saga_status === 'LOCAL_APPLIED'
          ) {
            suppressedLocalApplied = true;
            return 1;
          }
          Object.assign(row, value);
          return 1;
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) =>
          Promise.resolve(
            table === 'resonance_projects__design_release'
              ? releases
              : table === 'resonance_projects__runtime_purge_saga'
              ? sagas.filter(matches)
              : table === 'resonance_projects__design_asset_audit'
              ? inserts
                  .filter(row => row.table === table)
                  .map(row => row.value as Record<string, any>)
                  .filter(matches)
              : [],
          ).then(resolve, reject),
      };
      return builder;
    },
    {
      raw: async (_sql: string, bindings: unknown[]) => {
        rawBindings.push(bindings);
      },
    },
  );
  return {
    inserts,
    deletes,
    rawBindings,
    sagas,
    knex: {
      transaction: async (callback: (tx: any) => unknown) => {
        const priorDeleteCount = deletes.length;
        const result = await callback(transaction);
        const deletedProject = deletes
          .slice(priorDeleteCount)
          .some(row => row.table === 'resonance_projects__project');
        if (
          options.failAfterLocalCommit &&
          !lostCommitResponse &&
          deletedProject
        ) {
          lostCommitResponse = true;
          throw new Error('LOCAL_COMMIT_RESPONSE_LOST');
        }
        return result;
      },
    },
  };
};

const lifecyclePublicationFenceDatabase = (
  sagaStatus?: string,
  projectExists = true,
) => {
  const events: string[] = [];
  const writes: string[] = [];
  const transaction = Object.assign(
    (table: string) => {
      const state: { statuses?: unknown[]; locked?: boolean } = {};
      const builder: any = {
        select: () => builder,
        where: () => builder,
        whereIn: (_column: string, values: unknown[]) => {
          state.statuses = values;
          return builder;
        },
        orderBy: () => builder,
        forUpdate: () => {
          state.locked = true;
          return builder;
        },
        first: async () => {
          events.push(`${table}:${state.locked ? 'for-update' : 'read'}`);
          if (table === 'resonance_projects__project') {
            return projectExists ? { project_id: 'TARGET' } : undefined;
          }
          if (
            table === 'resonance_projects__runtime_purge_saga' &&
            sagaStatus &&
            state.statuses?.includes(sagaStatus)
          ) {
            return { saga_id: 'saga-1', saga_status: sagaStatus };
          }
          return undefined;
        },
        insert: async () => {
          writes.push(`${table}:insert`);
          return 1;
        },
        update: async () => {
          writes.push(`${table}:update`);
          return 1;
        },
        delete: async () => {
          writes.push(`${table}:delete`);
          return 1;
        },
      };
      return builder;
    },
    {
      raw: async (_sql: string, bindings: unknown[]) => {
        events.push(`advisory:${String(bindings[0])}`);
      },
    },
  );
  return { transaction, events, writes };
};

describe('project lifecycle mutation authority', () => {
  it.each(['PREPARED', 'PURGED', 'RESTORE_REQUIRED'])(
    'fences every project writer after the lifecycle lock when saga is %s',
    async sagaStatus => {
      const database = lifecyclePublicationFenceDatabase(sagaStatus);
      await expect(
        lockProjectLifecyclePublicationMutation(database.transaction, 'TARGET'),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'PROJECT_DELETE_IN_PROGRESS',
      } satisfies Partial<ProjectLifecyclePublicationFenceError>);
      expect(database.events).toEqual([
        `advisory:${projectLifecycleMutationLockKey('TARGET')}`,
        'resonance_projects__project:for-update',
        'resonance_projects__runtime_purge_saga:for-update',
      ]);
      expect(database.writes).toHaveLength(0);
    },
  );

  it.each(['LOCAL_APPLIED', 'RESTORED'])(
    'allows project writers after terminal saga %s',
    async sagaStatus => {
      const database = lifecyclePublicationFenceDatabase(sagaStatus);
      await expect(
        lockProjectLifecyclePublicationMutation(database.transaction, 'TARGET'),
      ).resolves.toEqual({ project_id: 'TARGET' });
      expect(database.writes).toHaveLength(0);
    },
  );

  it('returns exact PROJECT_MISSING before touching a saga or writer row', async () => {
    const database = lifecyclePublicationFenceDatabase(undefined, false);
    await expect(
      lockProjectLifecyclePublicationMutation(database.transaction, 'TARGET'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_MISSING' });
    expect(database.events).toEqual([
      `advisory:${projectLifecycleMutationLockKey('TARGET')}`,
      'resonance_projects__project:for-update',
    ]);
    expect(database.writes).toHaveLength(0);
  });

  it('returns 401 for both routes before opening a write transaction', async () => {
    const handlers: Record<
      string,
      (request: any, response: any) => Promise<void>
    > = {};
    const router = {
      post: (path: string, handler: (typeof handlers)[string]) => {
        handlers[`POST ${path}`] = handler;
      },
      delete: (path: string, handler: (typeof handlers)[string]) => {
        handlers[`DELETE ${path}`] = handler;
      },
    };
    const knex = { transaction: jest.fn() };
    const unauthorized = Object.assign(new Error('Authentication required'), {
      statusCode: 401,
    });
    registerProjectLifecycleRoutes({
      router: router as never,
      knex,
      logger: { info: jest.fn() } as never,
      resolveIdentity: async () => {
        throw unauthorized;
      },
      runtimePurge: runtimePurgeGateway(),
    });
    const response = () => {
      const candidate: any = { status: jest.fn(), json: jest.fn() };
      candidate.status.mockReturnValue(candidate);
      return candidate;
    };

    const copyResponse = response();
    await handlers['POST /:sourceProjectId/copy'](
      {
        params: { sourceProjectId: 'SOURCE' },
        body: { projectId: 'TARGET', projectName: 'Target' },
      },
      copyResponse,
    );
    const deleteResponse = response();
    await handlers['DELETE /:projectId'](
      {
        params: { projectId: 'TARGET' },
        query: { confirmProjectId: 'TARGET' },
      },
      deleteResponse,
    );

    expect(copyResponse.status).toHaveBeenCalledWith(401);
    expect(deleteResponse.status).toHaveBeenCalledWith(401);
    expect(knex.transaction).not.toHaveBeenCalled();
  });

  it('copy denial commits exactly one audit and no project, role, or task write', async () => {
    const database = deniedDatabase();

    const result = await copyProjectLifecycle({
      knex: database.knex,
      identity,
      sourceProjectId: 'SOURCE',
      projectId: 'TARGET',
      projectName: 'Target',
    });

    expect(result.status).toBe(403);
    expect(database.inserts).toHaveLength(1);
    expect(database.inserts[0]).toMatchObject({
      table: 'resonance_projects__design_asset_audit',
      value: {
        project_id: 'SOURCE',
        action_code: 'ACCESS_DENIED',
        actor_ref: identity.actorRef,
      },
    });
  });

  it('delete denial commits exactly one audit and performs no delete', async () => {
    const database = deniedDatabase();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge: runtimePurgeGateway(),
    });

    expect(result.status).toBe(403);
    expect(database.inserts).toHaveLength(1);
    expect(database.inserts[0]).toMatchObject({
      table: 'resonance_projects__design_asset_audit',
      value: {
        project_id: 'TARGET',
        action_code: 'ACCESS_DENIED',
        actor_ref: identity.actorRef,
      },
    });
  });

  it('requires DESIGN_APPROVER and system administrator as two independent authorities', async () => {
    const approverOnly = approvedDeleteDatabase();
    const approverGateway = runtimePurgeGateway();
    const approverResult = await deleteProjectLifecycle({
      knex: approverOnly.knex,
      identity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge: approverGateway,
    });
    const administratorOnly = deniedDatabase();
    const administratorGateway = runtimePurgeGateway();
    const administratorResult = await deleteProjectLifecycle({
      knex: administratorOnly.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge: administratorGateway,
    });

    expect(approverResult.status).toBe(403);
    expect(administratorResult.status).toBe(403);
    expect(approverGateway.preview).not.toHaveBeenCalled();
    expect(administratorGateway.preview).not.toHaveBeenCalled();
    expect(approverOnly.deletes).toHaveLength(0);
  });

  it('copies configuration but bootstraps only the authenticated account', async () => {
    const database = approvedCopyDatabase();

    const result = await copyProjectLifecycle({
      knex: database.knex,
      identity: {
        ...identity,
        principals: [identity.actorRef, 'group:default/platform-engineering'],
      },
      sourceProjectId: 'SOURCE',
      projectId: 'TARGET',
      projectName: 'Target',
    });

    expect(result).toMatchObject({
      status: 201,
      body: {
        owner: identity.actorRef,
        copied: { roleAssignments: 0 },
        ownerBootstrapAssignmentCount: 4,
      },
    });
    const projectInsert = database.inserts.find(
      row => row.table === 'resonance_projects__project',
    )?.value as Record<string, unknown>;
    expect(projectInsert.owner).toBe(identity.actorRef);
    const roleInsert = database.inserts.find(
      row => row.table === 'resonance_projects__design_asset_role_assignment',
    )?.value as Array<Record<string, unknown>>;
    expect(roleInsert).toHaveLength(4);
    expect(new Set(roleInsert.map(row => row.principal_ref))).toEqual(
      new Set([identity.actorRef]),
    );
    expect(database.inserts).toContainEqual(
      expect.objectContaining({
        table: 'resonance_projects__design_asset_audit',
        value: expect.objectContaining({
          action_code: 'PROJECT_COPIED_OWNER_BOOTSTRAPPED',
          actor_ref: identity.actorRef,
        }),
      }),
    );
  });

  it('rejects a non-exact delete confirmation before a transaction', async () => {
    const knex = { transaction: jest.fn() };

    const result = await deleteProjectLifecycle({
      knex,
      identity,
      projectId: 'TARGET',
      confirmProjectId: 'target',
    });

    expect(result.status).toBe(400);
    expect(knex.transaction).not.toHaveBeenCalled();
  });

  it('deletes with the locked updated_at CAS and writes the actor tombstone', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    const projectDelete = database.deletes.find(
      row => row.table === 'resonance_projects__project',
    );
    expect(projectDelete?.where).toEqual({
      project_id: 'TARGET',
      created_at: new Date('2026-08-15T00:00:00Z'),
      updated_at: new Date('2026-08-16T00:00:00Z'),
    });
    expect(database.inserts).toContainEqual(
      expect.objectContaining({
        table: 'resonance_projects__design_asset_audit',
        value: expect.objectContaining({
          action_code: 'PROJECT_DELETED',
          actor_ref: deleteIdentity.actorRef,
        }),
      }),
    );
    expect(database.rawBindings).toContainEqual([
      projectLifecycleMutationLockKey('TARGET'),
    ]);
    expect(database.deletes).not.toContainEqual(
      expect.objectContaining({
        table: 'resonance_projects__design_asset_source_sync',
      }),
    );
    expect(result.body).toMatchObject({ sourceSyncHistoryPreserved: true });
    expect(runtimePurge.preview).toHaveBeenCalledTimes(1);
    expect(runtimePurge.apply).toHaveBeenCalledTimes(1);
    expect(runtimePurge.restore).not.toHaveBeenCalled();
  });

  it('returns an exact dry-run impact receipt with zero Backstage deletes', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
      dryRun: true,
    });

    expect(result).toMatchObject({
      status: 200,
      body: { success: true, dryRun: true, projectId: 'TARGET' },
    });
    expect(database.deletes).toHaveLength(0);
    expect(runtimePurge.preview).toHaveBeenCalledTimes(1);
    expect(runtimePurge.apply).not.toHaveBeenCalled();
  });

  it('propagates a runtime MANUAL/materialized blocker with zero delete or apply', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    runtimePurge.preview.mockImplementationOnce(async command => ({
      success: false,
      status: 'BLOCKED',
      receiptId: command.receiptId,
      operationKey: command.operationKey,
      projectId: command.projectId,
      processCode: command.processCode,
      designVersion: command.designVersion,
      contractSha256: command.contractSha256,
      scopeMode: command.scopeMode,
      snapshotSha256: runtimeSnapshot,
      blockers: { manualOrAdoptRowCount: 1, blocked: true },
    }));

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(409);
    expect(database.deletes).toHaveLength(0);
    expect(runtimePurge.apply).not.toHaveBeenCalled();
    expect(runtimePurge.restore).not.toHaveBeenCalled();
  });

  it.each(
    [
      'receiptId',
      'operationKey',
      'projectId',
      'processCode',
      'designVersion',
      'contractSha256',
      'scopeMode',
      'snapshotSha256',
    ].flatMap(field => [
      [field, 'missing'],
      [field, 'mismatch'],
    ]),
  )(
    'rejects a PURGED receipt with %s %s before local writes',
    async (field, mode) => {
      const database = approvedDeleteDatabase();
      const runtimePurge = runtimePurgeGateway();
      runtimePurge.apply.mockImplementationOnce(async command => {
        const valid = (await runtimePurgeGateway().apply(command)) as Record<
          string,
          unknown
        >;
        if (mode === 'missing') delete valid[field];
        else valid[field] = field === 'designVersion' ? 999 : 'mismatch';
        return valid;
      });

      await expect(
        deleteProjectLifecycle({
          knex: database.knex,
          identity: deleteIdentity,
          projectId: 'TARGET',
          confirmProjectId: 'TARGET',
          runtimePurge,
        }),
      ).rejects.toThrow('PROJECT_RUNTIME_PURGE_RECEIPT_CAS_INVALID');
      expect(database.deletes).toHaveLength(0);
      expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a different valid PURGED snapshot hash before local writes', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    runtimePurge.apply.mockImplementationOnce(async command => ({
      ...(await runtimePurgeGateway().apply(command)),
      snapshotSha256: 'e'.repeat(64),
    }));

    await expect(
      deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      }),
    ).rejects.toThrow('PROJECT_RUNTIME_PURGE_RECEIPT_CAS_INVALID');
    expect(database.deletes).toHaveLength(0);
    expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
  });

  it.each([
    'residual',
    'capturedDeletedMismatch',
    'capturedTypeAndDeletedMissing',
    'deletedMissingKey',
    'deletedExtraKey',
    'residualMissingKey',
    'residualStringZero',
    'capturedNegative',
    'deletedFractional',
  ])('rejects a %s postcondition before local writes', async mutant => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    runtimePurge.apply.mockImplementationOnce(async command => {
      const valid = (await runtimePurgeGateway().apply(command)) as Record<
        string,
        any
      >;
      const postcondition = valid.postcondition;
      if (mutant === 'residual')
        postcondition.residualScopeCounts.residualRows = 1;
      else if (mutant === 'capturedDeletedMismatch')
        postcondition.deletedScopeCounts.releaseRows = 0;
      else if (mutant === 'capturedTypeAndDeletedMissing') {
        postcondition.capturedScopeCounts.releaseRows = '1';
        delete postcondition.deletedScopeCounts.releaseRows;
        delete postcondition.residualScopeCounts.releaseRows;
      } else if (mutant === 'deletedMissingKey')
        delete postcondition.deletedScopeCounts.releaseRows;
      else if (mutant === 'deletedExtraKey')
        postcondition.deletedScopeCounts.extraRows = 0;
      else if (mutant === 'residualMissingKey')
        delete postcondition.residualScopeCounts.releaseRows;
      else if (mutant === 'residualStringZero')
        postcondition.residualScopeCounts.releaseRows = '0';
      else if (mutant === 'capturedNegative')
        postcondition.capturedScopeCounts.releaseRows = -1;
      else postcondition.deletedScopeCounts.releaseRows = 1.5;
      return valid;
    });

    await expect(
      deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      }),
    ).rejects.toThrow('PROJECT_RUNTIME_PURGE_POSTCONDITION_INVALID');
    expect(database.deletes).toHaveLength(0);
    expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
  });

  it.each(['PREPARED', 'PENDING', 'RUNNING'] as const)(
    'blocks deletion with zero writes while a %s source receipt is active',
    async syncStatus => {
      const database = approvedDeleteDatabase(1, syncStatus);

      const result = await deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge: runtimePurgeGateway(),
      });

      expect(result.status).toBe(409);
      expect(result.body.message).toContain(syncStatus);
      expect(database.deletes).toHaveLength(0);
      expect(database.inserts).toHaveLength(0);
    },
  );

  it.each(['SYNCHRONIZED', 'CANCELLED', 'SYNC_TRACKING_FAILED'] as const)(
    'preserves terminal %s source receipt history while deleting the project',
    async syncStatus => {
      const database = approvedDeleteDatabase(1, syncStatus);

      const result = await deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge: runtimePurgeGateway(),
      });

      expect(result.status).toBe(200);
      expect(
        database.deletes.some(row => row.table.includes('source_sync')),
      ).toBe(false);
      expect(result.body).toMatchObject({ sourceSyncHistoryPreserved: true });
    },
  );

  it.each(['PENDING', 'RUNNING'] as const)(
    'blocks deletion while requirement publication is %s',
    async publicationStatus => {
      const database = approvedDeleteDatabase(
        1,
        undefined,
        'APPLIED',
        undefined,
        false,
        { publicationStatus },
      );
      const runtimePurge = runtimePurgeGateway();

      const result = await deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      });

      expect(result.status).toBe(409);
      expect(result.body.message).toContain(publicationStatus);
      expect(database.deletes).toHaveLength(0);
      expect(runtimePurge.preview).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'reconciles a lost local COMMIT response without restoring runtime (finalizePurged=%s)',
    async leaveSagaPurgedAfterLocalCommit => {
      const database = approvedDeleteDatabase(
        1,
        undefined,
        'APPLIED',
        undefined,
        false,
        {
          failAfterLocalCommit: true,
          leaveSagaPurgedAfterLocalCommit,
        },
      );
      const runtimePurge = runtimePurgeGateway();

      const result = await deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      });

      expect(result).toMatchObject({
        status: 200,
        body: {
          success: true,
          recoveredAfterAmbiguousCommit: true,
          deleted: { project: 1 },
        },
      });
      expect(runtimePurge.restore).not.toHaveBeenCalled();
      expect(database.sagas[0]?.saga_status).toBe('LOCAL_APPLIED');
    },
  );

  it('reconciles a lost no-release local COMMIT response without releasing the fence', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      undefined,
      true,
      { failAfterLocalCommit: true },
    );
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result).toMatchObject({
      status: 200,
      body: {
        recoveredAfterAmbiguousCommit: true,
        deleted: { project: 1 },
      },
    });
    expect(runtimePurge.releaseAbsent).not.toHaveBeenCalled();
    expect(database.sagas[0]?.saga_status).toBe('LOCAL_APPLIED');
  });

  it('fails closed when the exact project CAS deletes zero rows', async () => {
    const database = approvedDeleteDatabase(0);
    const runtimePurge = runtimePurgeGateway();

    await expect(
      deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      }),
    ).rejects.toThrow('PROJECT_DELETE_CAS_NOT_EXACT');
    expect(database.inserts).not.toContainEqual(
      expect.objectContaining({
        table: 'resonance_projects__design_asset_audit',
      }),
    );
    expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
  });

  it.each(['QUEUED', 'RUNNING', 'FAILED', 'REVIEW_REQUIRED'])(
    'purges partial runtime rows for a %s exact release',
    async releaseStatus => {
      const database = approvedDeleteDatabase(1, undefined, releaseStatus);
      const runtimePurge = runtimePurgeGateway();

      const result = await deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      });

      expect(result.status).toBe(200);
      expect(runtimePurge.apply).toHaveBeenCalledTimes(1);
      expect(database.sagas[0]?.saga_status).toBe('LOCAL_APPLIED');
    },
  );

  it('deletes a copy/upload-before-release failure only after exact runtime-zero proof', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      undefined,
      true,
    );
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    expect(runtimePurge.activateAbsent).toHaveBeenCalledTimes(1);
    expect(runtimePurge.proveAbsent).not.toHaveBeenCalled();
    expect(runtimePurge.preview).not.toHaveBeenCalled();
    expect(runtimePurge.apply).not.toHaveBeenCalled();
    expect(database.sagas[0]?.saga_status).toBe('LOCAL_APPLIED');
  });

  it('reuses the durable proof identity after a lost dry-run response', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      undefined,
      true,
    );
    const runtimePurge = runtimePurgeGateway();
    const request = {
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    };

    await deleteProjectLifecycle({ ...request, dryRun: true });
    const result = await deleteProjectLifecycle(request);

    expect(result.status).toBe(200);
    expect(runtimePurge.proveAbsent).toHaveBeenCalledTimes(1);
    expect(runtimePurge.activateAbsent).toHaveBeenCalledTimes(1);
    expect(runtimePurge.proveAbsent.mock.calls[0][0].proofId).toBe(
      runtimePurge.activateAbsent.mock.calls[0][0].proofId,
    );
    expect(database.sagas).toHaveLength(1);
  });

  it('releases an activated absence fence when the local project CAS fails', async () => {
    const database = approvedDeleteDatabase(
      0,
      undefined,
      'APPLIED',
      undefined,
      true,
    );
    const runtimePurge = runtimePurgeGateway();

    await expect(
      deleteProjectLifecycle({
        knex: database.knex,
        identity: deleteIdentity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
        runtimePurge,
      }),
    ).rejects.toThrow('PROJECT_DELETE_CAS_NOT_EXACT');

    expect(runtimePurge.activateAbsent).toHaveBeenCalledTimes(1);
    expect(runtimePurge.releaseAbsent).toHaveBeenCalledTimes(1);
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
    expect(database.sagas[0]?.claim_token).toBeNull();
  });

  it('starts a new proof identity after a terminal absence saga', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      undefined,
      true,
    );
    const oldProofId = 'aaaaaaaa-0000-4000-a000-000000000099';
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000099',
      receipt_id: oldProofId,
      operation_key: 'bbbbbbbb-0000-4000-a000-000000000099',
      project_id: 'TARGET',
      project_incarnation: '2026-08-15T00:00:00.000Z',
      process_code: 'NO_RUNTIME_RELEASE',
      saga_status: 'RESTORED',
      command_json: JSON.stringify({
        proofMode: 'PROJECT_ABSENT',
        proofId: oldProofId,
        projectId: 'TARGET',
        actorRef: deleteIdentity.actorRef,
        accountId: deleteIdentity.accountId,
      }),
      created_at: new Date(0),
      updated_at: new Date(0),
    });
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    expect(database.sagas).toHaveLength(2);
    expect(runtimePurge.activateAbsent.mock.calls[0][0].proofId).not.toBe(
      oldProofId,
    );
    expect(database.sagas[1]?.saga_status).toBe('LOCAL_APPLIED');
  });

  it('starts a new receipt identity after a terminal released-runtime saga', async () => {
    const database = approvedDeleteDatabase();
    const oldReceiptId = 'aaaaaaaa-0000-4000-a000-000000000098';
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000098',
      receipt_id: oldReceiptId,
      operation_key: 'bbbbbbbb-0000-4000-a000-000000000098',
      project_id: 'TARGET',
      project_incarnation: '2026-08-15T00:00:00.000Z',
      process_code: 'RFP_TARGET',
      design_version: 3,
      contract_sha256: 'c'.repeat(64),
      saga_status: 'BLOCKED',
      command_json: JSON.stringify({ receiptId: oldReceiptId }),
      created_at: new Date(0),
      updated_at: new Date(0),
    });
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    expect(database.sagas).toHaveLength(2);
    expect(runtimePurge.preview.mock.calls[0][0].receiptId).not.toBe(
      oldReceiptId,
    );
    expect(database.sagas[1]?.saga_status).toBe('LOCAL_APPLIED');
  });

  it('blocks a legacy project whose release history names two processes', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      'LEGACY_TARGET',
    );
    const runtimePurge = runtimePurgeGateway();

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(409);
    expect(result.body.message).toContain(
      'MULTI_PROCESS_RUNTIME_PURGE_REQUIRED',
    );
    expect(runtimePurge.preview).not.toHaveBeenCalled();
    expect(database.deletes).toHaveLength(0);
  });

  it('resumes a lost PURGED response without applying twice', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    runtimePurge.preview.mockImplementationOnce(async command => ({
      success: true,
      status: 'PURGED',
      receiptId: command.receiptId,
      operationKey: command.operationKey,
      projectId: command.projectId,
      processCode: command.processCode,
      designVersion: command.designVersion,
      contractSha256: command.contractSha256,
      scopeMode: command.scopeMode,
      snapshotSha256: runtimeSnapshot,
      postcondition: {
        exactZero: true,
        capturedEqualsDeleted: true,
        capturedScopeCounts: {
          releaseRows: 1,
          residualRows: 12,
          exactZero: false,
        },
        deletedScopeCounts: { releaseRows: 1, residualRows: 12 },
        residualScopeCounts: {
          releaseRows: 0,
          residualRows: 0,
          exactZero: true,
        },
      },
    }));

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    expect(runtimePurge.apply).not.toHaveBeenCalled();
    expect(database.sagas[0]?.saga_status).toBe('LOCAL_APPLIED');
  });

  it('re-applies an exact RESTORED receipt on retry', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    runtimePurge.preview.mockImplementationOnce(async command => ({
      success: true,
      status: 'RESTORED',
      receiptId: command.receiptId,
      operationKey: command.operationKey,
      projectId: command.projectId,
      processCode: command.processCode,
      designVersion: command.designVersion,
      contractSha256: command.contractSha256,
      scopeMode: command.scopeMode,
      snapshotSha256: runtimeSnapshot,
    }));

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });

    expect(result.status).toBe(200);
    expect(runtimePurge.apply).toHaveBeenCalledTimes(1);
  });

  it('recovery restores a PURGED runtime after a process crash before local delete', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    const command = {
      receiptId: 'aaaaaaaa-0000-4000-a000-000000000001',
      operationKey: 'bbbbbbbb-0000-4000-a000-000000000001',
      projectId: 'TARGET',
      processCode: 'RFP_TARGET',
      designVersion: 3,
      contractSha256: 'c'.repeat(64),
      scopeMode: 'EXACT_PROJECT' as const,
      actorRef: identity.actorRef,
      accountId: 'revoked.runtime.account',
    };
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000001',
      saga_status: 'PURGED',
      command_json: JSON.stringify(command),
      snapshot_sha256: runtimeSnapshot,
      updated_at: new Date(0),
    });
    runtimePurge.preview.mockImplementationOnce(async () => ({
      ...command,
      status: 'PURGED',
      snapshotSha256: runtimeSnapshot,
      postcondition: { exactZero: true, capturedEqualsDeleted: true },
    }));

    const result = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });

    expect(result).toMatchObject({ claimed: 1, restored: 1, failed: 0 });
    expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
    expect(runtimePurge.preview.mock.calls[0][0]).toMatchObject(
      recoveryIdentity,
    );
    expect(runtimePurge.restore.mock.calls[0][0]).toMatchObject(
      recoveryIdentity,
    );
  });

  it('recovery rejects a different valid snapshot hash with write0', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    const command = {
      receiptId: 'aaaaaaaa-0000-4000-a000-000000000011',
      operationKey: 'bbbbbbbb-0000-4000-a000-000000000011',
      projectId: 'TARGET',
      processCode: 'RFP_TARGET',
      designVersion: 3,
      contractSha256: 'c'.repeat(64),
      scopeMode: 'EXACT_PROJECT' as const,
      actorRef: identity.actorRef,
      accountId: 'revoked.runtime.account',
    };
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000011',
      saga_status: 'PURGED',
      command_json: JSON.stringify(command),
      snapshot_sha256: runtimeSnapshot,
      updated_at: new Date(0),
    });
    runtimePurge.preview.mockImplementationOnce(async () => ({
      ...command,
      status: 'PURGED',
      snapshotSha256: 'e'.repeat(64),
    }));

    const result = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });

    expect(result).toMatchObject({ claimed: 1, restored: 0, failed: 1 });
    expect(runtimePurge.restore).not.toHaveBeenCalled();
  });

  it('makes zero saga writes when the recovery service principal is missing', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000002',
      saga_status: 'PURGED',
      command_json: JSON.stringify({ projectId: 'TARGET' }),
      snapshot_sha256: runtimeSnapshot,
      updated_at: new Date(0),
    });

    const result = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      staleBefore: new Date(),
    });

    expect(result).toMatchObject({
      claimed: 0,
      skipped: 'RECOVERY_IDENTITY_REQUIRED',
    });
    expect(database.sagas[0]?.saga_status).toBe('PURGED');
    expect(database.sagas[0]?.claim_token).toBeUndefined();
    expect(runtimePurge.preview).not.toHaveBeenCalled();
    expect(runtimePurge.restore).not.toHaveBeenCalled();
  });

  it('claims zero sagas when database recovery authority preflight fails', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000012',
      saga_status: 'PURGED',
      command_json: JSON.stringify({ projectId: 'TARGET' }),
      snapshot_sha256: runtimeSnapshot,
      updated_at: new Date(0),
    });
    runtimePurge.preflightRecovery.mockRejectedValueOnce(
      new Error('ROLE_REVOKED'),
    );

    const result = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });

    expect(result).toMatchObject({
      claimed: 0,
      skipped: 'RECOVERY_AUTHORITY_NOT_READY',
    });
    expect(database.sagas[0]?.saga_status).toBe('PURGED');
    expect(database.sagas[0]?.claim_token).toBeUndefined();
    expect(runtimePurge.preview).not.toHaveBeenCalled();
    expect(runtimePurge.restore).not.toHaveBeenCalled();
  });

  it('recovers a PREPARED no-release saga by idempotently releasing a missing fence', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    const proofId = 'aaaaaaaa-0000-4000-a000-000000000003';
    database.sagas.push({
      saga_id: 'cccccccc-0000-4000-a000-000000000003',
      saga_status: 'PREPARED',
      command_json: JSON.stringify({
        proofMode: 'PROJECT_ABSENT',
        proofId,
        projectId: 'TARGET',
        actorRef: 'user:default/revoked',
        accountId: 'revoked.runtime.account',
      }),
      updated_at: new Date(0),
    });

    const result = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });

    expect(result).toMatchObject({ claimed: 1, noMutation: 1, failed: 0 });
    expect(runtimePurge.releaseAbsent).toHaveBeenCalledWith({
      proofId,
      projectId: 'TARGET',
      ...recoveryIdentity,
    });
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
    expect(database.sagas[0]?.claim_token).toBeNull();
  });

  it('performs zero local deletes when recovery tombstones a proof before slow activation returns', async () => {
    const database = approvedDeleteDatabase(
      1,
      undefined,
      'APPLIED',
      undefined,
      true,
    );
    const runtimePurge = runtimePurgeGateway();
    let activationCommand: any;
    let resolveActivation:
      | ((receipt: Record<string, unknown>) => void)
      | undefined;
    let signalActivationStarted: (() => void) | undefined;
    const activationStarted = new Promise<void>(resolve => {
      signalActivationStarted = resolve;
    });
    runtimePurge.activateAbsent.mockImplementationOnce(
      command =>
        new Promise(resolve => {
          activationCommand = command;
          resolveActivation = resolve;
          signalActivationStarted?.();
        }),
    );
    const liveDelete = deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });
    await activationStarted;
    database.sagas[0].updated_at = new Date(0);
    database.sagas[0].lease_expires_at = new Date(0);

    const recovery = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });
    resolveActivation?.({
      success: true,
      status: 'NOT_ACTIVATED',
      proofId: activationCommand.proofId,
      projectId: activationCommand.projectId,
      fenceStatus: 'RELEASED',
      activated: false,
      idempotent: true,
    });

    await expect(liveDelete).rejects.toThrow(
      'PROJECT_RUNTIME_PURGE_SAGA_LEASE_LOST',
    );
    expect(recovery).toMatchObject({ claimed: 1, noMutation: 1, failed: 0 });
    expect(database.deletes).toHaveLength(0);
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
    expect(runtimePurge.releaseAbsent).toHaveBeenCalledTimes(2);
  });

  it('restores runtime and performs zero local deletes when recovery steals an expired live lease during apply', async () => {
    const database = approvedDeleteDatabase();
    const runtimePurge = runtimePurgeGateway();
    let applyCommand: any;
    let resolveApply: ((receipt: Record<string, unknown>) => void) | undefined;
    let signalApplyStarted: (() => void) | undefined;
    const applyStarted = new Promise<void>(resolve => {
      signalApplyStarted = resolve;
    });
    runtimePurge.apply.mockImplementationOnce(
      command =>
        new Promise(resolve => {
          applyCommand = command;
          resolveApply = resolve;
          signalApplyStarted?.();
        }),
    );
    const liveDelete = deleteProjectLifecycle({
      knex: database.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge,
    });
    await applyStarted;
    database.sagas[0].updated_at = new Date(0);
    database.sagas[0].lease_expires_at = new Date(0);

    const recovery = await recoverProjectRuntimePurgeSagas({
      knex: database.knex,
      runtimePurge,
      recoveryIdentity,
      staleBefore: new Date(),
    });
    const purged = await runtimePurgeGateway().apply(applyCommand);
    resolveApply?.(purged);

    await expect(liveDelete).rejects.toThrow(
      'PROJECT_RUNTIME_PURGE_SAGA_LEASE_LOST',
    );
    expect(recovery).toMatchObject({ claimed: 1, noMutation: 1, failed: 0 });
    expect(database.deletes).toHaveLength(0);
    expect(database.sagas[0]?.saga_status).toBe('RESTORED');
    expect(runtimePurge.restore).toHaveBeenCalledTimes(1);
  });

  it('uses new durable random receipt identities for a recreated project', async () => {
    const firstDatabase = approvedDeleteDatabase();
    const secondDatabase = approvedDeleteDatabase();
    const firstGateway = runtimePurgeGateway();
    const secondGateway = runtimePurgeGateway();

    await deleteProjectLifecycle({
      knex: firstDatabase.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge: firstGateway,
    });
    await deleteProjectLifecycle({
      knex: secondDatabase.knex,
      identity: deleteIdentity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
      runtimePurge: secondGateway,
    });

    const firstCommand = firstGateway.preview.mock.calls[0][0];
    const secondCommand = secondGateway.preview.mock.calls[0][0];
    expect(firstCommand.receiptId).not.toBe(secondCommand.receiptId);
    expect(firstCommand.operationKey).not.toBe(secondCommand.operationKey);
  });

  it('source role rows are never copied into target authority', () => {
    const source = readFileSync(
      join(__dirname, 'projectLifecycleRoutes.ts'),
      'utf8',
    );
    expect(source).toContain(
      'bootstrapProjectDesignRoles([identity.actorRef])',
    );
    expect(source).toContain('copiedRoleAssignmentCount: 0');
    expect(source).toContain('created_at: new Date(projectIncarnation)');
    expect(source).toContain("saga_status: 'LOCAL_APPLIED'");
    expect(source).toContain('PROJECT_DELETE_CAS_NOT_EXACT');
    expect(source).not.toContain(
      '.where({ project_id: sourceProjectId });\n      if (roles.length)',
    );
  });

  it('fences requirement and source writers with the shared lifecycle lock', () => {
    const source = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const throwingFenceCalls =
      source.match(/lockProjectLifecyclePublicationMutation\(/g)?.length ?? 0;
    const inspectedFenceCalls =
      source.match(/inspectProjectLifecyclePublicationMutation\(/g)?.length ??
      0;
    expect(throwingFenceCalls + inspectedFenceCalls).toBe(5);
    expect(source).toContain('REQUIREMENT_REPUBLICATION_ARM_CAS_NOT_EXACT');
    expect(source).toContain("publication_reconcile_status: 'PENDING'");
    expect(source).toContain("['PENDING', 'RUNNING']");
  });

  it('wires a mandatory recovery principal and surfaces scheduler readiness failures', () => {
    const projectSource = readFileSync(
      join(__dirname, 'resonanceProjects.ts'),
      'utf8',
    );
    const manifest = readFileSync(
      join(
        __dirname,
        '../../../../../../../deploy/k8s/control-plane/backstage.yaml',
      ),
      'utf8',
    );
    const deploy = readFileSync(
      join(
        __dirname,
        '../../../../../../../ops/scripts/resonance-backstage-deploy.sh',
      ),
      'utf8',
    );

    expect(projectSource).toContain(
      '/project-runtime-purge/recovery-authority/preflight',
    );
    expect(projectSource).toContain('RECOVERY_AUTHORITY_NOT_READY');
    expect(projectSource).toContain('logger.error(');
    expect(projectSource).toContain("'/health/project-runtime-purge-recovery'");
    expect(projectSource).toContain('response.status(ready ? 200 : 503)');
    expect(manifest).toContain('name: resonance-runtime-purge-recovery');
    expect(manifest).not.toContain(
      'name: resonance-runtime-purge-recovery\n                optional: true',
    );
    expect(deploy).toContain('ensure_runtime_purge_recovery_secret');
    expect(deploy).toContain('RESONANCE_RUNTIME_PURGE_RECOVERY_ACCOUNT_ID');
    const readinessPath =
      '/api/resonance-projects/health/project-runtime-purge-recovery';
    expect(manifest).toContain(`path: ${readinessPath}`);
    expect(deploy).toContain(
      `RUNTIME_PURGE_READINESS_URL="$BACKSTAGE_URL${readinessPath}"`,
    );
    expect(deploy.match(/RUNTIME_PURGE_READINESS_URL/g)).toHaveLength(3);
    expect(manifest).not.toContain('path: /.backstage/health/v1/readiness');
  });
});
