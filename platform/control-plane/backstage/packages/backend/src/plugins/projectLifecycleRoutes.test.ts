import {
  copyProjectLifecycle,
  deleteProjectLifecycle,
  registerProjectLifecycleRoutes,
  type ProjectLifecycleIdentity,
} from './projectLifecycleRoutes';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const identity: ProjectLifecycleIdentity = {
  actorRef: 'user:default/designer',
  principals: ['user:default/designer'],
  systemAdministrator: false,
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
          if (
            table ===
            'resonance_projects__design_asset_role_assignment'
          ) {
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

const approvedDeleteDatabase = (projectCasCount = 1) => {
  const inserts: Array<{ table: string; value: unknown }> = [];
  const deletes: Array<{ table: string; where: Record<string, unknown> }> = [];
  const updatedAt = new Date('2026-08-16T00:00:00Z');
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
              project_id: 'TARGET',
              project_name: 'Target',
              design_version: 3,
              updated_at: updatedAt,
            };
          }
          if (
            table ===
            'resonance_projects__design_asset_role_assignment'
          ) {
            return { assignment_id: 9 };
          }
          return undefined;
        },
        delete: async () => {
          deletes.push({ table, where: state.where ?? {} });
          return table === 'resonance_projects__project'
            ? projectCasCount
            : 1;
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
    deletes,
    knex: {
      transaction: async (callback: (tx: any) => unknown) =>
        callback(transaction),
    },
  };
};

describe('project lifecycle mutation authority', () => {
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

  it('copies configuration but bootstraps only the authenticated account', async () => {
    const database = approvedCopyDatabase();

    const result = await copyProjectLifecycle({
      knex: database.knex,
      identity: {
        ...identity,
        principals: [
          identity.actorRef,
          'group:default/platform-engineering',
        ],
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
      row =>
        row.table ===
        'resonance_projects__design_asset_role_assignment',
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

    const result = await deleteProjectLifecycle({
      knex: database.knex,
      identity,
      projectId: 'TARGET',
      confirmProjectId: 'TARGET',
    });

    expect(result.status).toBe(200);
    const projectDelete = database.deletes.find(
      row => row.table === 'resonance_projects__project',
    );
    expect(projectDelete?.where).toEqual({
      project_id: 'TARGET',
      updated_at: new Date('2026-08-16T00:00:00Z'),
    });
    expect(database.inserts).toContainEqual(
      expect.objectContaining({
        table: 'resonance_projects__design_asset_audit',
        value: expect.objectContaining({
          action_code: 'PROJECT_DELETED',
          actor_ref: identity.actorRef,
        }),
      }),
    );
  });

  it('fails closed when the exact project CAS deletes zero rows', async () => {
    const database = approvedDeleteDatabase(0);

    await expect(
      deleteProjectLifecycle({
        knex: database.knex,
        identity,
        projectId: 'TARGET',
        confirmProjectId: 'TARGET',
      }),
    ).rejects.toThrow('PROJECT_DELETE_CAS_NOT_EXACT');
    expect(database.inserts).toHaveLength(0);
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
    expect(source).toContain(
      ".where({ project_id: projectId, updated_at: project.updated_at })",
    );
    expect(source).toContain('PROJECT_DELETE_CAS_NOT_EXACT');
    expect(source).not.toContain(
      '.where({ project_id: sourceProjectId });\n      if (roles.length)',
    );
  });
});
