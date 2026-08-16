import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Request, Response, Router } from 'express';
import { bootstrapProjectDesignRoles } from './projectDesignRoles';

const normalizeProjectId = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const projectIdPattern = /^[A-Z][A-Z0-9_-]{2,63}$/;

export const projectLifecycleMutationLockKey = (projectId: string) =>
  `BACKSTAGE_PROJECT_LIFECYCLE_V1:${projectId}`;

export type ProjectLifecycleIdentity = {
  actorRef: string;
  principals: string[];
  systemAdministrator: boolean;
};

type LifecycleResult = {
  status: number;
  body: Record<string, unknown>;
};

const lifecycleError = (status: number, message: string): LifecycleResult => ({
  status,
  body: { success: false, message },
});

const statusCode = (error: unknown) => {
  const candidate = Number((error as { statusCode?: unknown })?.statusCode);
  return Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate
    : 500;
};

const sendLifecycleException = (
  response: Response,
  error: unknown,
  fallback: string,
) => {
  const status = statusCode(error);
  response.status(status).json({
    success: false,
    message:
      status === 500
        ? fallback
        : error instanceof Error
        ? error.message
        : fallback,
  });
};

const hasLockedDesignApprover = async (
  transaction: any,
  projectId: string,
  identity: ProjectLifecycleIdentity,
) => {
  if (identity.systemAdministrator) return true;
  const assignment = await transaction(
    'resonance_projects__design_asset_role_assignment',
  )
    .select('assignment_id')
    .where({
      project_id: projectId,
      role_code: 'DESIGN_APPROVER',
      active: true,
    })
    .whereIn('principal_ref', identity.principals)
    .forUpdate()
    .first();
  return Boolean(assignment);
};

const recordDenied = async (
  transaction: any,
  projectId: string,
  identity: ProjectLifecycleIdentity,
  operation: string,
) => {
  await transaction('resonance_projects__design_asset_audit').insert({
    project_id: projectId,
    action_code: 'ACCESS_DENIED',
    actor_ref: identity.actorRef,
    details: JSON.stringify({
      operation,
      requiredRole: 'DESIGN_APPROVER',
      systemAdministratorAccepted: true,
    }),
    created_at: new Date(),
  });
};

export async function copyProjectLifecycle(options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  sourceProjectId: string;
  projectId: string;
  projectName: string;
}): Promise<LifecycleResult> {
  const { knex, identity, sourceProjectId, projectId, projectName } = options;
  if (!projectIdPattern.test(projectId) || !projectName) {
    return lifecycleError(
      400,
      'A valid projectId and projectName are required',
    );
  }
  if (sourceProjectId === projectId) {
    return lifecycleError(400, 'Source and target project must differ');
  }
  // A copied project is owned by the exact authenticated account. Ownership
  // groups from the source or from the caller's catalog graph are deliberately
  // not expanded into target DESIGN_APPROVER assignments.
  const ownerAssignments = bootstrapProjectDesignRoles([identity.actorRef]);
  if (!ownerAssignments.length) {
    return lifecycleError(403, 'Authenticated target owner is invalid');
  }

  return knex.transaction(async (transaction: any) => {
    await transaction.raw(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [`PROJECT_COPY:${projectId}`],
    );
    const source = await transaction('resonance_projects__project')
      .where({ project_id: sourceProjectId })
      .forUpdate()
      .first();
    if (!source) return lifecycleError(404, 'Source project not found');
    if (
      !(await hasLockedDesignApprover(transaction, sourceProjectId, identity))
    ) {
      await recordDenied(
        transaction,
        sourceProjectId,
        identity,
        'PROJECT_COPY',
      );
      return lifecycleError(
        403,
        'Source project DESIGN_APPROVER or system administrator authority is required',
      );
    }
    if (
      await transaction('resonance_projects__project')
        .where({ project_id: projectId })
        .forUpdate()
        .first()
    ) {
      return lifecycleError(409, 'Target project already exists');
    }

    const now = new Date();
    await transaction('resonance_projects__project').insert({
      project_id: projectId,
      project_name: projectName,
      description: source.description,
      owner: identity.actorRef,
      source_repository: source.source_repository,
      database_mode: source.database_mode,
      runtime_mode: source.runtime_mode,
      status: 'REGISTERED',
      design_version: source.design_version,
      created_at: now,
      updated_at: now,
    });
    await transaction(
      'resonance_projects__design_asset_role_assignment',
    ).insert(
      ownerAssignments.map(assignment => ({
        project_id: projectId,
        principal_ref: assignment.principalRef,
        role_code: assignment.roleCode,
        active: true,
        created_at: now,
      })),
    );
    await transaction('resonance_projects__task').insert({
      project_id: projectId,
      task_type: 'PROJECT_COPY_BOOTSTRAP',
      status: 'PLANNED',
      payload: JSON.stringify({
        sourceProjectId,
        copiedConfiguration: { roleAssignments: 0 },
        ownerBootstrapAssignments: ownerAssignments.length,
        steps: [
          'REGENERATE_DESIGN_ASSETS',
          'REGISTER_CONTROL_ASSETS',
          'VALIDATE_CONTRACTS',
        ],
      }),
      created_at: now,
      updated_at: now,
    });
    await transaction('resonance_projects__design_asset_audit').insert({
      project_id: projectId,
      action_code: 'PROJECT_COPIED_OWNER_BOOTSTRAPPED',
      actor_ref: identity.actorRef,
      details: JSON.stringify({
        sourceProjectId,
        ownerBootstrapAssignmentCount: ownerAssignments.length,
        copiedRoleAssignmentCount: 0,
      }),
      created_at: now,
    });
    return {
      status: 201,
      body: {
        success: true,
        sourceProjectId,
        projectId,
        owner: identity.actorRef,
        copied: { roleAssignments: 0 },
        ownerBootstrapAssignmentCount: ownerAssignments.length,
        excluded: [
          'source project role assignments',
          'runtime executions',
          'task history',
          'audit history',
          'requirement uploads',
          'materialized design assets (queued for regeneration)',
        ],
      },
    };
  });
}

export async function deleteProjectLifecycle(options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  confirmProjectId: string;
}): Promise<LifecycleResult> {
  const { knex, identity, projectId, confirmProjectId } = options;
  if (projectId === 'CCUS-PLATFORM') {
    return lifecycleError(
      409,
      'The default CCUS-PLATFORM project is protected',
    );
  }
  if (confirmProjectId !== projectId) {
    return lifecycleError(400, 'confirmProjectId must exactly match projectId');
  }

  return knex.transaction(async (transaction: any) => {
    await transaction.raw(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [projectLifecycleMutationLockKey(projectId)],
    );
    const project = await transaction('resonance_projects__project')
      .where({ project_id: projectId })
      .forUpdate()
      .first();
    if (!project) return lifecycleError(404, 'Project not found');
    if (!(await hasLockedDesignApprover(transaction, projectId, identity))) {
      await recordDenied(transaction, projectId, identity, 'PROJECT_DELETE');
      return lifecycleError(
        403,
        'Project DESIGN_APPROVER or system administrator authority is required',
      );
    }

    const activeSourceSync = await transaction(
      'resonance_projects__design_asset_source_sync',
    )
      .select('sync_id', 'sync_status')
      .where({ project_id: projectId })
      .whereIn('sync_status', ['PREPARED', 'PENDING', 'RUNNING'])
      .orderBy('created_at', 'asc')
      .forUpdate()
      .first();
    if (activeSourceSync) {
      return lifecycleError(
        409,
        `Project source synchronization ${String(
          activeSourceSync.sync_id,
        )} is ${String(
          activeSourceSync.sync_status,
        )}; retry deletion after it reaches a terminal state`,
      );
    }

    const tables = [
      'resonance_projects__requirement_item',
      'resonance_projects__requirement_document',
      'resonance_projects__screen_space_spec',
      'resonance_projects__design_asset_role_assignment',
      'resonance_projects__design_asset_draft',
      'resonance_projects__design_asset_snapshot',
      'resonance_projects__control_asset_migration',
      'resonance_projects__design_release',
      'resonance_projects__task',
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      counts[table] = await transaction(table)
        .where({ project_id: projectId })
        .delete();
    }
    counts.project = await transaction('resonance_projects__project')
      .where({ project_id: projectId, updated_at: project.updated_at })
      .delete();
    if (counts.project !== 1) {
      throw new Error('PROJECT_DELETE_CAS_NOT_EXACT');
    }
    await transaction('resonance_projects__design_asset_audit').insert({
      project_id: projectId,
      action_code: 'PROJECT_DELETED',
      actor_ref: identity.actorRef,
      details: JSON.stringify({
        projectName: project.project_name,
        designVersion: project.design_version,
        deleted: counts,
        auditHistoryPreserved: true,
        sourceSyncHistoryPreserved: true,
      }),
      created_at: new Date(),
    });
    return {
      status: 200,
      body: {
        success: true,
        projectId,
        deleted: counts,
        auditHistoryPreserved: true,
        sourceSyncHistoryPreserved: true,
      },
    };
  });
}

export function registerProjectLifecycleRoutes(options: {
  router: Router;
  knex: any;
  logger: LoggerService;
  resolveIdentity: (request: Request) => Promise<ProjectLifecycleIdentity>;
}) {
  const { router, knex, logger, resolveIdentity } = options;

  router.post('/:sourceProjectId/copy', async (request, response) => {
    try {
      const identity = await resolveIdentity(request);
      const sourceProjectId = normalizeProjectId(
        request.params.sourceProjectId,
      );
      const projectId = normalizeProjectId(request.body?.projectId);
      const projectName = String(request.body?.projectName ?? '').trim();
      const result = await copyProjectLifecycle({
        knex,
        identity,
        sourceProjectId,
        projectId,
        projectName,
      });
      if (result.status === 201) {
        logger.info(
          `Copied project ${sourceProjectId} to ${projectId} for ${identity.actorRef}`,
        );
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      sendLifecycleException(response, error, 'Project copy failed');
    }
  });

  router.delete('/:projectId', async (request, response) => {
    try {
      const identity = await resolveIdentity(request);
      const projectId = normalizeProjectId(request.params.projectId);
      const result = await deleteProjectLifecycle({
        knex,
        identity,
        projectId,
        confirmProjectId: String(request.query.confirmProjectId ?? ''),
      });
      if (result.status === 200) {
        logger.info(`Deleted project ${projectId} for ${identity.actorRef}`);
      }
      response.status(result.status).json(result.body);
    } catch (error) {
      sendLifecycleException(response, error, 'Project deletion failed');
    }
  });
}
