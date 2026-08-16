import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Request, Response, Router } from 'express';
import { randomUUID } from 'node:crypto';
import { bootstrapProjectDesignRoles } from './projectDesignRoles';

const normalizeProjectId = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const projectIdPattern = /^[A-Z][A-Z0-9_-]{2,63}$/;
const projectRuntimeSagaLeaseMs = 60_000;
const projectRuntimeSagaTable = 'resonance_projects__runtime_purge_saga';

class ProjectRuntimeSagaLeaseLostError extends Error {
  constructor() {
    super('PROJECT_RUNTIME_PURGE_SAGA_LEASE_LOST');
  }
}

class ProjectLocalDeleteOutcomeIndeterminateError extends Error {
  constructor(cause?: unknown) {
    super('PROJECT_LOCAL_DELETE_OUTCOME_INDETERMINATE', { cause });
  }
}

const sagaLeaseExpiresAt = () =>
  new Date(Date.now() + projectRuntimeSagaLeaseMs);

const activeSagaLease = (row: Record<string, unknown>, now = new Date()) =>
  Boolean(row.claim_token) &&
  row.lease_expires_at != null &&
  !(new Date(String(row.lease_expires_at)).getTime() <= now.getTime());

const updateOwnedRuntimePurgeSaga = async (options: {
  knex: any;
  sagaId: string;
  claimToken: string;
  expectedStatuses: string[];
  values: Record<string, unknown>;
  releaseLease?: boolean;
}) => {
  const {
    knex,
    sagaId,
    claimToken,
    expectedStatuses,
    values,
    releaseLease = false,
  } = options;
  await knex.transaction(async (transaction: any) => {
    const now = new Date();
    const updated = await transaction(projectRuntimeSagaTable)
      .where({ saga_id: sagaId, claim_token: claimToken })
      .whereIn('saga_status', expectedStatuses)
      .andWhere('lease_expires_at', '>', now)
      .update({
        ...values,
        claim_token: releaseLease ? null : claimToken,
        lease_expires_at: releaseLease ? null : sagaLeaseExpiresAt(),
        updated_at: now,
      });
    if (updated !== 1) throw new ProjectRuntimeSagaLeaseLostError();
  });
};

export const projectLifecycleMutationLockKey = (projectId: string) =>
  `BACKSTAGE_PROJECT_LIFECYCLE_V1:${projectId}`;

export class ProjectLifecyclePublicationFenceError extends Error {
  constructor(
    readonly statusCode: 404 | 409,
    readonly code: 'PROJECT_MISSING' | 'PROJECT_DELETE_IN_PROGRESS',
    message: string,
  ) {
    super(message);
  }
}

export const inspectProjectLifecyclePublicationMutation = async (
  transaction: any,
  projectId: string,
) => {
  await transaction.raw(
    'select pg_advisory_xact_lock(hashtextextended(?, 0))',
    [projectLifecycleMutationLockKey(projectId)],
  );
  const project = await transaction('resonance_projects__project')
    .where({ project_id: projectId })
    .forUpdate()
    .first();
  if (!project) {
    return {
      allowed: false as const,
      error: new ProjectLifecyclePublicationFenceError(
        404,
        'PROJECT_MISSING',
        'Project not found',
      ),
    };
  }
  const activeSaga = await transaction(projectRuntimeSagaTable)
    .select('saga_id', 'saga_status')
    .where({ project_id: projectId })
    .whereIn('saga_status', ['PREPARED', 'PURGED', 'RESTORE_REQUIRED'])
    .orderBy('created_at', 'desc')
    .forUpdate()
    .first();
  if (activeSaga) {
    return {
      allowed: false as const,
      error: new ProjectLifecyclePublicationFenceError(
        409,
        'PROJECT_DELETE_IN_PROGRESS',
        `Project deletion is ${String(
          activeSaga.saga_status,
        )}; project mutation is fenced`,
      ),
    };
  }
  return { allowed: true as const, project };
};

export const lockProjectLifecyclePublicationMutation = async (
  transaction: any,
  projectId: string,
) => {
  const fence = await inspectProjectLifecyclePublicationMutation(
    transaction,
    projectId,
  );
  if (!fence.allowed) throw fence.error;
  return fence.project;
};

export type ProjectLifecycleIdentity = {
  actorRef: string;
  principals: string[];
  accountId: string;
  systemAdministrator: boolean;
};

export type ProjectRuntimePurgeCommand = {
  receiptId: string;
  operationKey: string;
  projectId: string;
  processCode: string;
  designVersion: number;
  contractSha256: string;
  scopeMode: 'EXACT_PROJECT';
  actorRef: string;
  accountId: string;
  snapshotSha256?: string;
};

export type ProjectRuntimeAbsenceCommand = {
  proofId: string;
  projectId: string;
  actorRef: string;
  accountId: string;
};

export type ProjectRuntimePurgeGateway = {
  preflightRecovery: (identity: {
    accountId: string;
    actorRef: string;
  }) => Promise<Record<string, unknown>>;
  proveAbsent: (
    command: ProjectRuntimeAbsenceCommand,
  ) => Promise<Record<string, unknown>>;
  activateAbsent: (
    command: ProjectRuntimeAbsenceCommand,
  ) => Promise<Record<string, unknown>>;
  releaseAbsent: (
    command: ProjectRuntimeAbsenceCommand,
  ) => Promise<Record<string, unknown>>;
  preview: (
    command: ProjectRuntimePurgeCommand,
  ) => Promise<Record<string, unknown>>;
  apply: (
    command: ProjectRuntimePurgeCommand & { snapshotSha256: string },
  ) => Promise<Record<string, unknown>>;
  restore: (
    command: ProjectRuntimePurgeCommand & { snapshotSha256: string },
  ) => Promise<Record<string, unknown>>;
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

const hasLockedProjectMutationAuthority = async (
  transaction: any,
  projectId: string,
  identity: ProjectLifecycleIdentity,
) =>
  identity.systemAdministrator ||
  hasLockedDesignApprover(transaction, projectId, identity);

const parseContract = (value: unknown): Record<string, any> => {
  const parsed =
    typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PROJECT_RUNTIME_RELEASE_CONTRACT_INVALID');
  }
  return parsed as Record<string, any>;
};

const exactRuntimeReceipt = (
  receipt: Record<string, unknown>,
  command: ProjectRuntimePurgeCommand,
  expectedStatus: 'PREVIEWED' | 'BLOCKED' | 'PURGED' | 'RESTORED',
) => {
  if (
    receipt.receiptId !== command.receiptId ||
    receipt.operationKey !== command.operationKey ||
    receipt.projectId !== command.projectId ||
    receipt.processCode !== command.processCode ||
    receipt.designVersion !== command.designVersion ||
    receipt.contractSha256 !== command.contractSha256 ||
    receipt.scopeMode !== command.scopeMode ||
    receipt.status !== expectedStatus ||
    typeof receipt.snapshotSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(receipt.snapshotSha256) ||
    (command.snapshotSha256 !== undefined &&
      receipt.snapshotSha256 !== command.snapshotSha256)
  ) {
    throw new Error(
      `PROJECT_RUNTIME_PURGE_RECEIPT_CAS_INVALID:${expectedStatus}`,
    );
  }
};

const exactPurgePostcondition = (receipt: Record<string, unknown>) => {
  const postcondition = receipt.postcondition as
    | Record<string, unknown>
    | undefined;
  const captured = postcondition?.capturedScopeCounts as
    | Record<string, unknown>
    | undefined;
  const deleted = postcondition?.deletedScopeCounts as
    | Record<string, unknown>
    | undefined;
  const residual = postcondition?.residualScopeCounts as
    | Record<string, unknown>
    | undefined;
  const countEntries = (value: Record<string, unknown> | undefined) =>
    Object.entries(value ?? {}).filter(([key]) => key !== 'exactZero');
  const capturedCounts = countEntries(captured);
  const deletedCounts = countEntries(deleted);
  const residualCounts = countEntries(residual);
  const validCounts = (entries: Array<[string, unknown]>) =>
    entries.length > 0 &&
    entries.every(
      ([key, value]) =>
        key.length > 0 &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        Number.isInteger(value) &&
        value >= 0,
    );
  const keys = (entries: Array<[string, unknown]>) =>
    entries.map(([key]) => key).sort();
  const capturedKeys = keys(capturedCounts);
  const deletedKeys = keys(deletedCounts);
  const residualKeys = keys(residualCounts);
  if (
    postcondition?.exactZero !== true ||
    postcondition?.capturedEqualsDeleted !== true ||
    typeof captured?.exactZero !== 'boolean' ||
    Object.keys(deleted ?? {}).includes('exactZero') ||
    residual?.exactZero !== true ||
    residual?.residualRows !== 0 ||
    !validCounts(capturedCounts) ||
    !validCounts(deletedCounts) ||
    !validCounts(residualCounts) ||
    capturedKeys.join('\u0000') !== deletedKeys.join('\u0000') ||
    capturedKeys.join('\u0000') !== residualKeys.join('\u0000') ||
    capturedCounts.some(([key, value]) => deleted?.[key] !== value) ||
    residualCounts.some(([, value]) => value !== 0)
  ) {
    throw new Error('PROJECT_RUNTIME_PURGE_POSTCONDITION_INVALID');
  }
  return postcondition;
};

const reconcileRuntimeAfterSagaLeaseLoss = async (
  runtimePurge: ProjectRuntimePurgeGateway,
  command: ProjectRuntimePurgeCommand & { snapshotSha256: string },
  knownPurged?: Record<string, unknown>,
) => {
  const receipt = knownPurged ?? (await runtimePurge.preview(command));
  const status = String(receipt.status ?? '');
  if (status === 'PURGED') {
    const restored = await runtimePurge.restore(command);
    exactRuntimeReceipt(restored, command, 'RESTORED');
    if (restored.aToBToA !== true) {
      throw new Error('PROJECT_RUNTIME_RESTORE_POSTCONDITION_INVALID');
    }
    return restored;
  }
  if (status === 'PREVIEWED' || status === 'BLOCKED' || status === 'RESTORED') {
    exactRuntimeReceipt(
      receipt,
      command,
      status as 'PREVIEWED' | 'BLOCKED' | 'RESTORED',
    );
    return receipt;
  }
  throw new Error(`PROJECT_RUNTIME_PURGE_RECONCILE_STATUS_INVALID:${status}`);
};

const exactRuntimeAbsenceProof = (
  proof: Record<string, unknown>,
  command: ProjectRuntimeAbsenceCommand,
) =>
  proof.status === 'PROVEN_ABSENT' &&
  proof.success === true &&
  proof.proofId === command.proofId &&
  proof.projectId === command.projectId &&
  proof.projectScopedRows === 0 &&
  proof.releaseRows === 0 &&
  proof.sourceRows === 0 &&
  proof.runtimeResourceRows === 0 &&
  proof.residualRows === 0 &&
  proof.exactZero === true &&
  /^[0-9a-f]{64}$/.test(String(proof.proofSha256 ?? ''));

const exactRuntimeAbsenceRelease = (
  release: Record<string, unknown>,
  command: ProjectRuntimeAbsenceCommand,
) =>
  release.success === true &&
  release.proofId === command.proofId &&
  release.projectId === command.projectId &&
  release.fenceStatus === 'RELEASED' &&
  typeof release.idempotent === 'boolean';

const exactRuntimeRecoveryAuthority = (
  receipt: Record<string, unknown>,
  accountId: string,
) =>
  receipt.success === true &&
  receipt.status === 'READY' &&
  receipt.accountId === accountId &&
  receipt.authorityValidated === true;

type LocalProjectDeleteOptions = {
  knex: any;
  projectId: string;
  sagaId: string;
  claimToken: string;
  projectIncarnation: string;
  projectUpdatedAt: unknown;
  projectName: string;
  identity: ProjectLifecycleIdentity;
  auditDetails: Record<string, unknown>;
};

const sameDatabaseTimestamp = (left: unknown, right: unknown) => {
  const leftTime = new Date(String(left)).getTime();
  const rightTime = new Date(String(right)).getTime();
  return Number.isFinite(leftTime) && leftTime === rightTime;
};

const exactDeleteCountsFromAudit = (
  rows: Array<Record<string, unknown>>,
  sagaId: string,
) => {
  const exact = rows
    .map(row => parseContract(row.details))
    .filter(row => row.runtimePurgeSagaId === sagaId);
  if (exact.length !== 1) {
    throw new ProjectLocalDeleteOutcomeIndeterminateError();
  }
  const deleted = exact[0].deleted;
  if (
    !deleted ||
    typeof deleted !== 'object' ||
    Array.isArray(deleted) ||
    Object.keys(deleted).length === 0 ||
    Object.values(deleted).some(
      value =>
        typeof value !== 'number' || !Number.isInteger(value) || value < 0,
    ) ||
    deleted.project !== 1
  ) {
    throw new ProjectLocalDeleteOutcomeIndeterminateError();
  }
  return deleted as Record<string, number>;
};

const reconcileLocalProjectDeleteCommit = async (
  options: LocalProjectDeleteOptions,
): Promise<
  | { status: 'LOCAL_APPLIED'; counts: Record<string, number> }
  | { status: 'NOT_APPLIED' }
> => {
  const {
    knex,
    projectId,
    sagaId,
    claimToken,
    projectIncarnation,
    projectUpdatedAt,
  } = options;
  try {
    return await knex.transaction(async (transaction: any) => {
      await transaction.raw(
        'select pg_advisory_xact_lock(hashtextextended(?, 0))',
        [projectLifecycleMutationLockKey(projectId)],
      );
      const saga = await transaction(projectRuntimeSagaTable)
        .where({ saga_id: sagaId })
        .forUpdate()
        .first();
      const project = await transaction('resonance_projects__project')
        .where({ project_id: projectId })
        .forUpdate()
        .first();
      const status = String(saga?.saga_status ?? '');
      const auditRows = project
        ? []
        : ((await transaction('resonance_projects__design_asset_audit')
            .select('details')
            .where({
              project_id: projectId,
              action_code: 'PROJECT_DELETED',
            })
            .orderBy('created_at', 'desc')) as Array<Record<string, unknown>>);
      const recoveredCounts = project
        ? undefined
        : exactDeleteCountsFromAudit(auditRows, sagaId);
      if (!project && status === 'LOCAL_APPLIED') {
        return { status: 'LOCAL_APPLIED', counts: recoveredCounts! };
      }
      if (
        !project &&
        status === 'PURGED' &&
        String(saga?.claim_token ?? '') === claimToken
      ) {
        const completedAt = new Date();
        const finalized = await transaction(projectRuntimeSagaTable)
          .where({
            saga_id: sagaId,
            saga_status: 'PURGED',
            claim_token: claimToken,
          })
          .update({
            saga_status: 'LOCAL_APPLIED',
            claim_token: null,
            lease_expires_at: null,
            completed_at: completedAt,
            updated_at: completedAt,
            last_error: null,
          });
        if (finalized !== 1) {
          throw new ProjectLocalDeleteOutcomeIndeterminateError();
        }
        return { status: 'LOCAL_APPLIED', counts: recoveredCounts! };
      }
      const exactProjectStillPresent =
        project &&
        new Date(String(project.created_at)).toISOString() ===
          projectIncarnation &&
        sameDatabaseTimestamp(project.updated_at, projectUpdatedAt);
      if (
        exactProjectStillPresent &&
        status === 'PURGED' &&
        String(saga?.claim_token ?? '') === claimToken &&
        activeSagaLease(saga)
      ) {
        return { status: 'NOT_APPLIED' };
      }
      throw new ProjectLocalDeleteOutcomeIndeterminateError();
    });
  } catch (error) {
    if (error instanceof ProjectLocalDeleteOutcomeIndeterminateError) {
      throw error;
    }
    throw new ProjectLocalDeleteOutcomeIndeterminateError(error);
  }
};

const commitLocalProjectDelete = async (options: LocalProjectDeleteOptions) => {
  const {
    knex,
    projectId,
    sagaId,
    claimToken,
    projectIncarnation,
    projectUpdatedAt,
    projectName,
    identity,
    auditDetails,
  } = options;
  return knex.transaction(async (transaction: any) => {
    await transaction.raw(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [projectLifecycleMutationLockKey(projectId)],
    );
    const leaseCheckAt = new Date();
    const saga = await transaction(projectRuntimeSagaTable)
      .where({
        saga_id: sagaId,
        saga_status: 'PURGED',
        claim_token: claimToken,
      })
      .andWhere('lease_expires_at', '>', leaseCheckAt)
      .forUpdate()
      .first();
    if (!saga) throw new ProjectRuntimeSagaLeaseLostError();
    const project = await transaction('resonance_projects__project')
      .where({
        project_id: projectId,
        created_at: new Date(projectIncarnation),
        updated_at: projectUpdatedAt,
      })
      .forUpdate()
      .first();
    if (!project) throw new Error('PROJECT_DELETE_CAS_NOT_EXACT');
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
      .where({
        project_id: projectId,
        created_at: new Date(projectIncarnation),
        updated_at: projectUpdatedAt,
      })
      .delete();
    if (counts.project !== 1) throw new Error('PROJECT_DELETE_CAS_NOT_EXACT');
    const completedAt = new Date();
    const sagaUpdates = await transaction(projectRuntimeSagaTable)
      .where({
        saga_id: sagaId,
        saga_status: 'PURGED',
        claim_token: claimToken,
      })
      .andWhere('lease_expires_at', '>', completedAt)
      .update({
        saga_status: 'LOCAL_APPLIED',
        claim_token: null,
        lease_expires_at: null,
        completed_at: completedAt,
        updated_at: completedAt,
      });
    if (sagaUpdates !== 1) throw new ProjectRuntimeSagaLeaseLostError();
    await transaction('resonance_projects__design_asset_audit').insert({
      project_id: projectId,
      action_code: 'PROJECT_DELETED',
      actor_ref: identity.actorRef,
      details: JSON.stringify({
        projectName,
        ...auditDetails,
        deleted: counts,
        auditHistoryPreserved: true,
        sourceSyncHistoryPreserved: true,
      }),
      created_at: completedAt,
    });
    return counts;
  });
};

const deleteLocalProjectWithSagaLease = async (
  options: LocalProjectDeleteOptions,
) => {
  try {
    return {
      counts: await commitLocalProjectDelete(options),
      recoveredAfterAmbiguousCommit: false,
    };
  } catch (error) {
    const resolution = await reconcileLocalProjectDeleteCommit(options);
    if (resolution.status === 'LOCAL_APPLIED') {
      return {
        counts: resolution.counts,
        recoveredAfterAmbiguousCommit: true,
      };
    }
    throw error;
  }
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
      requiredAuthorities:
        operation === 'PROJECT_DELETE'
          ? ['DESIGN_APPROVER', 'RUNTIME_SYSTEM_ADMINISTRATOR']
          : ['DESIGN_APPROVER_OR_SYSTEM_ADMINISTRATOR'],
      systemAdministratorAcceptedAlone: operation !== 'PROJECT_DELETE',
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
      !(await hasLockedProjectMutationAuthority(
        transaction,
        sourceProjectId,
        identity,
      ))
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

type DeleteProjectOptions = {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  confirmProjectId: string;
  runtimePurge?: ProjectRuntimePurgeGateway;
  dryRun?: boolean;
};

type PreparedProjectDeleteBase = {
  sagaId: string;
  sagaStatus: string;
  claimToken: string;
  projectIncarnation: string;
  projectUpdatedAt: unknown;
  projectName: string;
};

type PreparedAbsenceDelete = PreparedProjectDeleteBase & {
  proofCommand: ProjectRuntimeAbsenceCommand & {
    proofMode: 'PROJECT_ABSENT';
  };
};

type PreparedRuntimeDelete = PreparedProjectDeleteBase & {
  command: ProjectRuntimePurgeCommand;
  snapshotSha256: string;
  purgeReceipt?: Record<string, unknown>;
};

type PreparedProjectDelete = PreparedAbsenceDelete | PreparedRuntimeDelete;
type PreparedProjectDeleteResult =
  | PreparedProjectDelete
  | { result: LifecycleResult };
type PersistOwnedSaga = (
  expectedStatuses: string[],
  values: Record<string, unknown>,
  releaseLease?: boolean,
) => Promise<void>;

const claimExistingProjectDeleteSaga = async (options: {
  transaction: any;
  row: Record<string, any>;
  claimToken: string;
  inProgressMessage: string;
  recoveryMessage: string;
}): Promise<LifecycleResult | undefined> => {
  const { transaction, row, claimToken, inProgressMessage, recoveryMessage } =
    options;
  if (String(row.saga_status) === 'RESTORE_REQUIRED') {
    return lifecycleError(409, recoveryMessage);
  }
  if (activeSagaLease(row)) return lifecycleError(409, inProgressMessage);
  const claimed = await transaction(projectRuntimeSagaTable)
    .where({
      saga_id: row.saga_id,
      saga_status: row.saga_status,
      claim_token: row.claim_token ?? null,
      lease_expires_at: row.lease_expires_at ?? null,
    })
    .update({
      claim_token: claimToken,
      lease_expires_at: sagaLeaseExpiresAt(),
      updated_at: new Date(),
    });
  if (claimed !== 1) throw new ProjectRuntimeSagaLeaseLostError();
  return undefined;
};

const prepareAbsenceProjectDelete = async (options: {
  transaction: any;
  project: Record<string, any>;
  projectId: string;
  identity: ProjectLifecycleIdentity;
  claimToken: string;
  projectIncarnation: string;
}): Promise<PreparedProjectDeleteResult> => {
  const {
    transaction,
    project,
    projectId,
    identity,
    claimToken,
    projectIncarnation,
  } = options;
  const existing = await transaction(projectRuntimeSagaTable)
    .where({
      project_id: projectId,
      project_incarnation: projectIncarnation,
      process_code: 'NO_RUNTIME_RELEASE',
    })
    .whereIn('saga_status', ['PREPARED', 'PURGED', 'RESTORE_REQUIRED'])
    .orderBy('created_at', 'desc')
    .forUpdate()
    .first();
  if (existing) {
    const result = await claimExistingProjectDeleteSaga({
      transaction,
      row: existing,
      claimToken,
      inProgressMessage:
        'Project runtime absence-fence saga is already in progress',
      recoveryMessage:
        'Project runtime absence-fence recovery owns this saga; retry after recovery completes',
    });
    if (result) return { result };
    return {
      sagaId: String(existing.saga_id),
      sagaStatus: String(existing.saga_status),
      claimToken,
      projectIncarnation,
      projectUpdatedAt: project.updated_at,
      projectName: String(project.project_name),
      proofCommand: parseContract(
        existing.command_json,
      ) as PreparedAbsenceDelete['proofCommand'],
    };
  }
  const sagaId = randomUUID();
  const proofCommand: PreparedAbsenceDelete['proofCommand'] = {
    proofMode: 'PROJECT_ABSENT',
    proofId: randomUUID(),
    projectId,
    actorRef: identity.actorRef,
    accountId: identity.accountId,
  };
  const now = new Date();
  await transaction(projectRuntimeSagaTable).insert({
    saga_id: sagaId,
    receipt_id: proofCommand.proofId,
    operation_key: randomUUID(),
    project_id: projectId,
    project_incarnation: projectIncarnation,
    process_code: 'NO_RUNTIME_RELEASE',
    design_version: 0,
    contract_sha256: '0'.repeat(64),
    snapshot_sha256: null,
    saga_status: 'PREPARED',
    claim_token: claimToken,
    lease_expires_at: sagaLeaseExpiresAt(),
    command_json: JSON.stringify(proofCommand),
    actor_ref: identity.actorRef,
    account_id: identity.accountId,
    created_at: now,
    updated_at: now,
  });
  return {
    sagaId,
    sagaStatus: 'PREPARED',
    claimToken,
    projectIncarnation,
    projectUpdatedAt: project.updated_at,
    projectName: String(project.project_name),
    proofCommand,
  };
};

const exactRuntimeReleaseIdentity = (
  project: Record<string, any>,
  releases: Array<Record<string, any>>,
):
  | { result: LifecycleResult }
  | { processCode: string; designVersion: number; contractSha256: string } => {
  const processCodes = new Set(
    releases.map(release =>
      normalizeProjectId(
        parseContract(release.contract_payload).process?.processCode,
      ),
    ),
  );
  if (processCodes.size !== 1) {
    return {
      result: lifecycleError(
        409,
        'MULTI_PROCESS_RUNTIME_PURGE_REQUIRED: project release history has multiple process identities',
      ),
    };
  }
  const designVersion = Number(project.design_version);
  const release = releases.find(
    row => Number(row.design_version) === designVersion,
  );
  if (!release) {
    return {
      result: lifecycleError(409, 'Exact project design release is required'),
    };
  }
  const processCode = [...processCodes][0] ?? '';
  const contractSha256 = String(release.contract_sha256 ?? '')
    .trim()
    .toLowerCase();
  const releaseStatus = String(release.release_status ?? '').toUpperCase();
  if (
    !Number.isInteger(designVersion) ||
    designVersion < 1 ||
    !/^[A-Z][A-Z0-9_:-]{1,79}$/.test(processCode) ||
    !/^[0-9a-f]{64}$/.test(contractSha256) ||
    !new Set([
      'VALIDATED',
      'QUEUED',
      'RUNNING',
      'APPLIED',
      'FAILED',
      'REVIEW_REQUIRED',
      'CANCELLED',
    ]).has(releaseStatus)
  ) {
    return {
      result: lifecycleError(
        409,
        'Project runtime release identity or resumable status is invalid',
      ),
    };
  }
  return { processCode, designVersion, contractSha256 };
};

const prepareReleasedProjectDelete = async (options: {
  transaction: any;
  project: Record<string, any>;
  projectId: string;
  identity: ProjectLifecycleIdentity;
  claimToken: string;
  projectIncarnation: string;
  releases: Array<Record<string, any>>;
}): Promise<PreparedProjectDeleteResult> => {
  const {
    transaction,
    project,
    projectId,
    identity,
    claimToken,
    projectIncarnation,
    releases,
  } = options;
  const identityResult = exactRuntimeReleaseIdentity(project, releases);
  if ('result' in identityResult) return identityResult;
  const { processCode, designVersion, contractSha256 } = identityResult;
  const existing = await transaction(projectRuntimeSagaTable)
    .where({ project_id: projectId, project_incarnation: projectIncarnation })
    .whereIn('saga_status', ['PREPARED', 'PURGED', 'RESTORE_REQUIRED'])
    .orderBy('created_at', 'desc')
    .forUpdate()
    .first();
  if (existing) {
    if (
      String(existing.process_code) !== processCode ||
      Number(existing.design_version) !== designVersion ||
      String(existing.contract_sha256) !== contractSha256
    ) {
      return {
        result: lifecycleError(
          409,
          'Existing runtime purge saga identity conflicts with the exact project release',
        ),
      };
    }
    const result = await claimExistingProjectDeleteSaga({
      transaction,
      row: existing,
      claimToken,
      inProgressMessage: 'Project runtime purge saga is already in progress',
      recoveryMessage:
        'Project runtime purge recovery owns this saga; retry after recovery completes',
    });
    if (result) return { result };
    return {
      sagaId: String(existing.saga_id),
      sagaStatus: String(existing.saga_status),
      claimToken,
      projectIncarnation,
      projectUpdatedAt: project.updated_at,
      projectName: String(project.project_name),
      command: parseContract(
        existing.command_json,
      ) as ProjectRuntimePurgeCommand,
      snapshotSha256: String(existing.snapshot_sha256 ?? ''),
      purgeReceipt: existing.purge_receipt
        ? parseContract(existing.purge_receipt)
        : undefined,
    };
  }
  const sagaId = randomUUID();
  const command: ProjectRuntimePurgeCommand = {
    receiptId: randomUUID(),
    operationKey: randomUUID(),
    projectId,
    processCode,
    designVersion,
    contractSha256,
    scopeMode: 'EXACT_PROJECT',
    actorRef: identity.actorRef,
    accountId: identity.accountId,
  };
  const now = new Date();
  await transaction(projectRuntimeSagaTable).insert({
    saga_id: sagaId,
    receipt_id: command.receiptId,
    operation_key: command.operationKey,
    project_id: projectId,
    project_incarnation: projectIncarnation,
    process_code: processCode,
    design_version: designVersion,
    contract_sha256: contractSha256,
    snapshot_sha256: null,
    saga_status: 'PREPARED',
    claim_token: claimToken,
    lease_expires_at: sagaLeaseExpiresAt(),
    command_json: JSON.stringify(command),
    actor_ref: identity.actorRef,
    account_id: identity.accountId,
    created_at: now,
    updated_at: now,
  });
  return {
    sagaId,
    sagaStatus: 'PREPARED',
    claimToken,
    projectIncarnation,
    projectUpdatedAt: project.updated_at,
    projectName: String(project.project_name),
    command,
    snapshotSha256: '',
  };
};

const prepareProjectDelete = async (options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  claimToken: string;
}): Promise<PreparedProjectDeleteResult> => {
  const { knex, identity, projectId, claimToken } = options;
  return knex.transaction(async (transaction: any) => {
    await transaction.raw(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [projectLifecycleMutationLockKey(projectId)],
    );
    const project = await transaction('resonance_projects__project')
      .where({ project_id: projectId })
      .forUpdate()
      .first();
    if (!project) {
      const completed = await transaction(projectRuntimeSagaTable)
        .where({ project_id: projectId, saga_status: 'LOCAL_APPLIED' })
        .orderBy('completed_at', 'desc')
        .forUpdate()
        .first();
      return completed
        ? {
            result: {
              status: 200,
              body: {
                success: true,
                idempotent: true,
                projectId,
                runtimePurgeSagaId: String(completed.saga_id),
              },
            },
          }
        : { result: lifecycleError(404, 'Project not found') };
    }
    const designApprover = await hasLockedDesignApprover(
      transaction,
      projectId,
      identity,
    );
    if (!designApprover || !identity.systemAdministrator) {
      await recordDenied(transaction, projectId, identity, 'PROJECT_DELETE');
      return {
        result: lifecycleError(
          403,
          'Project deletion requires both locked DESIGN_APPROVER and runtime system administrator authority',
        ),
      };
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
      return {
        result: lifecycleError(
          409,
          `Project source synchronization ${String(
            activeSourceSync.sync_id,
          )} is ${String(
            activeSourceSync.sync_status,
          )}; retry deletion after it reaches a terminal state`,
        ),
      };
    }
    const activeRequirementPublication = await transaction(
      'resonance_projects__requirement_document',
    )
      .select('document_id', 'publication_reconcile_status')
      .where({ project_id: projectId })
      .whereIn('publication_reconcile_status', ['PENDING', 'RUNNING'])
      .orderBy('created_at', 'asc')
      .forUpdate()
      .first();
    if (activeRequirementPublication) {
      return {
        result: lifecycleError(
          409,
          `Requirement publication ${String(
            activeRequirementPublication.document_id,
          )} is ${String(
            activeRequirementPublication.publication_reconcile_status,
          )}; retry deletion after it reaches a terminal state`,
        ),
      };
    }
    const releases = (await transaction('resonance_projects__design_release')
      .select(
        'design_version',
        'release_status',
        'contract_sha256',
        'contract_payload',
      )
      .where({ project_id: projectId })
      .orderBy('design_version', 'asc')
      .forUpdate()) as Array<Record<string, any>>;
    const common = {
      transaction,
      project,
      projectId,
      identity,
      claimToken,
      projectIncarnation: new Date(project.created_at).toISOString(),
    };
    return releases.length === 0
      ? prepareAbsenceProjectDelete(common)
      : prepareReleasedProjectDelete({ ...common, releases });
  });
};

const releaseAbsenceFenceAfterFailure = async (options: {
  runtimePurge: ProjectRuntimePurgeGateway;
  prepared: PreparedAbsenceDelete;
  persistSaga: PersistOwnedSaga;
  error: unknown;
}): Promise<never> => {
  const { runtimePurge, prepared, persistSaga, error } = options;
  let ownsLease = true;
  try {
    await persistSaga([prepared.sagaStatus, 'PURGED'], {
      saga_status: 'RESTORE_REQUIRED',
      last_error: String(error),
    });
  } catch {
    // Release remains mandatory even when the local saga store is unavailable.
    ownsLease = false;
  }
  try {
    const released = await runtimePurge.releaseAbsent(prepared.proofCommand);
    if (!exactRuntimeAbsenceRelease(released, prepared.proofCommand)) {
      throw new Error('PROJECT_RUNTIME_ABSENCE_FENCE_RELEASE_INVALID');
    }
    if (ownsLease) {
      await persistSaga(
        ['RESTORE_REQUIRED'],
        {
          saga_status: 'RESTORED',
          restore_receipt: JSON.stringify(released),
          completed_at: new Date(),
          last_error: null,
        },
        true,
      );
    }
  } catch (releaseError) {
    if (ownsLease) {
      try {
        await persistSaga(
          ['RESTORE_REQUIRED'],
          { last_error: String(releaseError) },
          true,
        );
      } catch {
        // A newer exact lease owner must finish the release reconciliation.
      }
    }
    throw new Error('PROJECT_DELETE_FAILED_AND_ABSENCE_FENCE_RELEASE_FAILED', {
      cause: releaseError,
    });
  }
  throw error;
};

const blockAbsenceProjectDelete = async (options: {
  projectId: string;
  prepared: PreparedAbsenceDelete;
  persistSaga: PersistOwnedSaga;
  proof: Record<string, unknown>;
}): Promise<LifecycleResult> => {
  const { projectId, prepared, persistSaga, proof } = options;
  await persistSaga(
    [prepared.sagaStatus],
    {
      saga_status: 'BLOCKED',
      preview_receipt: JSON.stringify(proof),
      completed_at: new Date(),
    },
    true,
  );
  return {
    status: 409,
    body: {
      success: false,
      status: 'BLOCKED',
      projectId,
      runtimeAbsenceProof: proof,
    },
  };
};

const runAbsenceProjectDelete = async (options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  runtimePurge: ProjectRuntimePurgeGateway;
  dryRun: boolean;
  prepared: PreparedAbsenceDelete;
  persistSaga: PersistOwnedSaga;
}): Promise<LifecycleResult> => {
  const {
    knex,
    identity,
    projectId,
    runtimePurge,
    dryRun,
    prepared,
    persistSaga,
  } = options;
  if (dryRun) {
    const proof = await runtimePurge.proveAbsent(prepared.proofCommand);
    if (!exactRuntimeAbsenceProof(proof, prepared.proofCommand)) {
      return await blockAbsenceProjectDelete({
        projectId,
        prepared,
        persistSaga,
        proof,
      });
    }
    await persistSaga(
      [prepared.sagaStatus],
      {
        saga_status: 'PREPARED',
        preview_receipt: JSON.stringify(proof),
        last_error: null,
      },
      true,
    );
    return {
      status: 200,
      body: {
        success: true,
        dryRun: true,
        projectId,
        runtimeAbsenceProof: proof,
      },
    };
  }
  try {
    const proof = await runtimePurge.activateAbsent(prepared.proofCommand);
    const exactZero = exactRuntimeAbsenceProof(proof, prepared.proofCommand);
    const exactFence =
      proof.fenceStatus === 'ACTIVE' && proof.activated === true;
    if (!exactZero || !exactFence) {
      if (proof.fenceStatus === 'ACTIVE' || proof.activated === true) {
        throw new Error('PROJECT_RUNTIME_ABSENCE_FENCE_RECEIPT_INVALID');
      }
      return await blockAbsenceProjectDelete({
        projectId,
        prepared,
        persistSaga,
        proof,
      });
    }
    await persistSaga([prepared.sagaStatus], {
      saga_status: 'PURGED',
      preview_receipt: JSON.stringify(proof),
      last_error: null,
    });
    const localDelete = await deleteLocalProjectWithSagaLease({
      knex,
      projectId,
      sagaId: prepared.sagaId,
      claimToken: prepared.claimToken,
      projectIncarnation: prepared.projectIncarnation,
      projectUpdatedAt: prepared.projectUpdatedAt,
      projectName: prepared.projectName,
      identity,
      auditDetails: {
        runtimePurgeSagaId: prepared.sagaId,
        runtimeAbsenceProof: proof,
      },
    });
    return {
      status: 200,
      body: {
        success: true,
        projectId,
        deleted: localDelete.counts,
        recoveredAfterAmbiguousCommit:
          localDelete.recoveredAfterAmbiguousCommit,
        runtimeAbsenceProof: proof,
        runtimePurgeSagaId: prepared.sagaId,
        auditHistoryPreserved: true,
        sourceSyncHistoryPreserved: true,
      },
    };
  } catch (error) {
    if (error instanceof ProjectLocalDeleteOutcomeIndeterminateError) {
      throw error;
    }
    return releaseAbsenceFenceAfterFailure({
      runtimePurge,
      prepared,
      persistSaga,
      error,
    });
  }
};

const restoreRuntimeAfterDeleteFailure = async (options: {
  runtimePurge: ProjectRuntimePurgeGateway;
  prepared: PreparedRuntimeDelete;
  persistSaga: PersistOwnedSaga;
  exactCommand: ProjectRuntimePurgeCommand & { snapshotSha256: string };
  purged?: Record<string, unknown>;
  error: unknown;
}): Promise<never> => {
  const { runtimePurge, prepared, persistSaga, exactCommand, purged, error } =
    options;
  if (error instanceof ProjectLocalDeleteOutcomeIndeterminateError) {
    throw error;
  }
  if (error instanceof ProjectRuntimeSagaLeaseLostError) {
    try {
      await reconcileRuntimeAfterSagaLeaseLoss(
        runtimePurge,
        exactCommand,
        purged,
      );
    } catch (restoreError) {
      throw new Error('PROJECT_DELETE_FAILED_AND_RUNTIME_RESTORE_FAILED', {
        cause: restoreError,
      });
    }
    throw error;
  }
  try {
    try {
      await persistSaga(['PURGED', 'RESTORE_REQUIRED', prepared.sagaStatus], {
        saga_status: 'RESTORE_REQUIRED',
        snapshot_sha256: exactCommand.snapshotSha256,
        last_error: String(error),
      });
    } catch (claimError) {
      if (!(claimError instanceof ProjectRuntimeSagaLeaseLostError)) {
        throw claimError;
      }
      await reconcileRuntimeAfterSagaLeaseLoss(
        runtimePurge,
        exactCommand,
        purged,
      );
      throw error;
    }
    const restored = await runtimePurge.restore(exactCommand);
    exactRuntimeReceipt(restored, exactCommand, 'RESTORED');
    if (restored.aToBToA !== true) {
      throw new Error('PROJECT_RUNTIME_RESTORE_POSTCONDITION_INVALID');
    }
    await persistSaga(
      ['RESTORE_REQUIRED'],
      {
        saga_status: 'RESTORED',
        restore_receipt: JSON.stringify(restored),
        completed_at: new Date(),
        last_error: null,
      },
      true,
    );
  } catch (restoreError) {
    throw new Error('PROJECT_DELETE_FAILED_AND_RUNTIME_RESTORE_FAILED', {
      cause: restoreError,
    });
  }
  throw error;
};

const finishRuntimeDeleteDryRun = async (options: {
  runtimePurge: ProjectRuntimePurgeGateway;
  projectId: string;
  prepared: PreparedRuntimeDelete;
  persistSaga: PersistOwnedSaga;
  receipt: Record<string, unknown>;
  receiptStatus: string;
  exactCommand: ProjectRuntimePurgeCommand & { snapshotSha256: string };
}): Promise<LifecycleResult> => {
  const {
    runtimePurge,
    projectId,
    prepared,
    persistSaga,
    receipt,
    receiptStatus,
    exactCommand,
  } = options;
  if (receiptStatus === 'PURGED') {
    await persistSaga([prepared.sagaStatus], {
      saga_status: 'RESTORE_REQUIRED',
      snapshot_sha256: exactCommand.snapshotSha256,
      purge_receipt: JSON.stringify(receipt),
    });
    const restored = await runtimePurge.restore(exactCommand);
    exactRuntimeReceipt(restored, exactCommand, 'RESTORED');
    if (restored.aToBToA !== true) {
      throw new Error('PROJECT_RUNTIME_RESTORE_POSTCONDITION_INVALID');
    }
    await persistSaga(
      ['RESTORE_REQUIRED'],
      {
        saga_status: 'RESTORED',
        restore_receipt: JSON.stringify(restored),
        completed_at: new Date(),
      },
      true,
    );
    return {
      status: 200,
      body: {
        success: true,
        dryRun: true,
        recoveredPurgedReceipt: true,
        projectId,
        runtimePurge: receipt,
      },
    };
  }
  await persistSaga(
    [prepared.sagaStatus],
    {
      saga_status: 'PREPARED',
      snapshot_sha256: exactCommand.snapshotSha256,
      preview_receipt: JSON.stringify(receipt),
    },
    true,
  );
  return {
    status: 200,
    body: { success: true, dryRun: true, projectId, runtimePurge: receipt },
  };
};

const finishReleasedLocalProjectDelete = async (options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  prepared: PreparedRuntimeDelete;
  snapshotSha256: string;
  postcondition: Record<string, unknown>;
  purged: Record<string, unknown>;
}): Promise<LifecycleResult> => {
  const {
    knex,
    identity,
    projectId,
    prepared,
    snapshotSha256,
    postcondition,
    purged,
  } = options;
  const localDelete = await deleteLocalProjectWithSagaLease({
    knex,
    projectId,
    sagaId: prepared.sagaId,
    claimToken: prepared.claimToken,
    projectIncarnation: prepared.projectIncarnation,
    projectUpdatedAt: prepared.projectUpdatedAt,
    projectName: prepared.projectName,
    identity,
    auditDetails: {
      designVersion: prepared.command.designVersion,
      processCode: prepared.command.processCode,
      contractSha256: prepared.command.contractSha256,
      runtimePurgeSagaId: prepared.sagaId,
      runtimePurgeReceiptId: prepared.command.receiptId,
      runtimeSnapshotSha256: snapshotSha256,
      runtimePostcondition: postcondition,
    },
  });
  return {
    status: 200,
    body: {
      success: true,
      projectId,
      deleted: localDelete.counts,
      recoveredAfterAmbiguousCommit: localDelete.recoveredAfterAmbiguousCommit,
      runtimePurge: purged,
      runtimePurgeSagaId: prepared.sagaId,
      auditHistoryPreserved: true,
      sourceSyncHistoryPreserved: true,
    },
  };
};

const exactRuntimeSnapshotCommand = (
  receipt: Record<string, unknown>,
  prepared: PreparedRuntimeDelete,
  receiptStatus: 'PREVIEWED' | 'PURGED' | 'RESTORED',
): ProjectRuntimePurgeCommand & { snapshotSha256: string } => {
  exactRuntimeReceipt(receipt, prepared.command, receiptStatus);
  const snapshotSha256 = String(
    prepared.snapshotSha256 || receipt.snapshotSha256,
  );
  if (!/^[0-9a-f]{64}$/.test(snapshotSha256)) {
    throw new Error('PROJECT_RUNTIME_PURGE_SNAPSHOT_INVALID');
  }
  const command = { ...prepared.command, snapshotSha256 };
  exactRuntimeReceipt(receipt, command, receiptStatus);
  return command;
};

const runReleasedProjectDelete = async (options: {
  knex: any;
  identity: ProjectLifecycleIdentity;
  projectId: string;
  runtimePurge: ProjectRuntimePurgeGateway;
  dryRun: boolean;
  prepared: PreparedRuntimeDelete;
  persistSaga: PersistOwnedSaga;
}): Promise<LifecycleResult> => {
  const {
    knex,
    identity,
    projectId,
    runtimePurge,
    dryRun,
    prepared,
    persistSaga,
  } = options;
  let exactCommand:
    | (ProjectRuntimePurgeCommand & { snapshotSha256: string })
    | undefined;
  let purged: Record<string, unknown> | undefined;
  try {
    const receipt =
      prepared.sagaStatus === 'PURGED' && prepared.snapshotSha256
        ? prepared.purgeReceipt ??
          (await runtimePurge.preview(prepared.command))
        : await runtimePurge.preview(prepared.command);
    const receiptStatus = String(receipt.status ?? '');
    if (receiptStatus === 'BLOCKED') {
      exactRuntimeReceipt(receipt, prepared.command, 'BLOCKED');
      await persistSaga(
        [prepared.sagaStatus],
        {
          saga_status: 'BLOCKED',
          preview_receipt: JSON.stringify(receipt),
          completed_at: new Date(),
        },
        true,
      );
      return {
        status: 409,
        body: {
          success: false,
          status: 'BLOCKED',
          projectId,
          runtimePurge: receipt,
        },
      };
    }
    if (!['PREVIEWED', 'PURGED', 'RESTORED'].includes(receiptStatus)) {
      throw new Error(
        `PROJECT_RUNTIME_PURGE_RESUME_STATUS_INVALID:${receiptStatus}`,
      );
    }
    exactCommand = exactRuntimeSnapshotCommand(
      receipt,
      prepared,
      receiptStatus as 'PREVIEWED' | 'PURGED' | 'RESTORED',
    );
    const { snapshotSha256 } = exactCommand;
    if (receiptStatus === 'PURGED') purged = receipt;
    if (dryRun) {
      return finishRuntimeDeleteDryRun({
        runtimePurge,
        projectId,
        prepared,
        persistSaga,
        receipt,
        receiptStatus,
        exactCommand,
      });
    }
    if (!purged) {
      await persistSaga([prepared.sagaStatus], {
        saga_status: prepared.sagaStatus,
        snapshot_sha256: snapshotSha256,
        preview_receipt: JSON.stringify(receipt),
      });
      purged = await runtimePurge.apply(exactCommand);
      exactRuntimeReceipt(purged, exactCommand, 'PURGED');
    }
    const postcondition = exactPurgePostcondition(purged);
    await persistSaga([prepared.sagaStatus], {
      saga_status: 'PURGED',
      snapshot_sha256: snapshotSha256,
      purge_receipt: JSON.stringify(purged),
      last_error: null,
    });
    return await finishReleasedLocalProjectDelete({
      knex,
      identity,
      projectId,
      prepared,
      snapshotSha256,
      postcondition,
      purged,
    });
  } catch (error) {
    if (!exactCommand) throw error;
    return restoreRuntimeAfterDeleteFailure({
      runtimePurge,
      prepared,
      persistSaga,
      exactCommand,
      purged,
      error,
    });
  }
};

export async function deleteProjectLifecycle(
  options: DeleteProjectOptions,
): Promise<LifecycleResult> {
  const {
    knex,
    identity,
    projectId,
    confirmProjectId,
    runtimePurge,
    dryRun = false,
  } = options;
  if (projectId === 'CCUS-PLATFORM') {
    return lifecycleError(
      409,
      'The default CCUS-PLATFORM project is protected',
    );
  }
  if (confirmProjectId !== projectId) {
    return lifecycleError(400, 'confirmProjectId must exactly match projectId');
  }
  if (!runtimePurge) {
    return lifecycleError(503, 'Project runtime purge gateway is required');
  }
  if (
    !identity.accountId ||
    !/^[A-Za-z0-9._@-]{2,120}$/.test(identity.accountId)
  ) {
    return lifecycleError(403, 'Authenticated runtime account is required');
  }
  const prepared = await prepareProjectDelete({
    knex,
    identity,
    projectId,
    claimToken: randomUUID(),
  });
  if ('result' in prepared) return prepared.result;
  const persistSaga: PersistOwnedSaga = (
    expectedStatuses,
    values,
    releaseLease = false,
  ) =>
    updateOwnedRuntimePurgeSaga({
      knex,
      sagaId: prepared.sagaId,
      claimToken: prepared.claimToken,
      expectedStatuses,
      values,
      releaseLease,
    });
  const flow = {
    knex,
    identity,
    projectId,
    runtimePurge,
    dryRun,
    prepared,
    persistSaga,
  };
  return 'proofCommand' in prepared
    ? runAbsenceProjectDelete({ ...flow, prepared })
    : runReleasedProjectDelete({ ...flow, prepared });
}

type RuntimePurgeRecoveryOutcome =
  | 'restored'
  | 'noMutation'
  | 'blocked'
  | 'failed';

const claimStaleRuntimePurgeSagas = async (options: {
  knex: any;
  staleBefore: Date;
  limit: number;
}) => {
  const { knex, staleBefore, limit } = options;
  return knex.transaction(async (transaction: any) => {
    const rows = await transaction(projectRuntimeSagaTable)
      .whereIn('saga_status', ['PREPARED', 'PURGED', 'RESTORE_REQUIRED'])
      .andWhere('updated_at', '<', staleBefore)
      .orderBy('updated_at', 'asc')
      .limit(Math.max(1, Math.min(limit, 100)))
      .forUpdate()
      .skipLocked();
    const claims: any[] = [];
    for (const row of rows as any[]) {
      if (activeSagaLease(row)) continue;
      const claimToken = randomUUID();
      const updated = await transaction(projectRuntimeSagaTable)
        .where({
          saga_id: row.saga_id,
          saga_status: row.saga_status,
          claim_token: row.claim_token ?? null,
          lease_expires_at: row.lease_expires_at ?? null,
        })
        .update({
          saga_status: 'RESTORE_REQUIRED',
          claim_token: claimToken,
          lease_expires_at: sagaLeaseExpiresAt(),
          last_error: 'RECOVERY_CLAIMED',
          updated_at: new Date(),
        });
      if (updated === 1) claims.push({ ...row, claimToken });
    }
    return claims;
  });
};

const recoverClaimedRuntimePurgeSaga = async (options: {
  knex: any;
  runtimePurge: ProjectRuntimePurgeGateway;
  row: Record<string, any>;
  accountId: string;
  actorRef: string;
}): Promise<RuntimePurgeRecoveryOutcome> => {
  const { knex, runtimePurge, row, accountId, actorRef } = options;
  const rawCommand = parseContract(row.command_json);
  const persist = (values: Record<string, unknown>, releaseLease = false) =>
    updateOwnedRuntimePurgeSaga({
      knex,
      sagaId: String(row.saga_id),
      claimToken: String(row.claimToken),
      expectedStatuses: ['RESTORE_REQUIRED'],
      values,
      releaseLease,
    });
  try {
    if (rawCommand.proofMode === 'PROJECT_ABSENT') {
      const command: ProjectRuntimeAbsenceCommand = {
        proofId: String(rawCommand.proofId),
        projectId: String(rawCommand.projectId),
        accountId,
        actorRef,
      };
      const release = await runtimePurge.releaseAbsent(command);
      if (!exactRuntimeAbsenceRelease(release, command)) {
        throw new Error('PROJECT_RUNTIME_ABSENCE_FENCE_RELEASE_INVALID');
      }
      await persist(
        {
          saga_status: 'RESTORED',
          restore_receipt: JSON.stringify(release),
          last_error: 'RECOVERY_RELEASED_RUNTIME_ABSENCE_FENCE',
          completed_at: new Date(),
        },
        true,
      );
      return 'noMutation';
    }
    const command: ProjectRuntimePurgeCommand = {
      ...(rawCommand as ProjectRuntimePurgeCommand),
      accountId,
      actorRef,
    };
    const receipt = await runtimePurge.preview(command);
    const status = String(receipt.status ?? '');
    if (status === 'BLOCKED' || status === 'PREVIEWED') {
      exactRuntimeReceipt(receipt, command, status as 'BLOCKED' | 'PREVIEWED');
      await persist(
        {
          saga_status: status === 'BLOCKED' ? 'BLOCKED' : 'RESTORED',
          preview_receipt: JSON.stringify(receipt),
          last_error:
            status === 'PREVIEWED'
              ? 'RECOVERY_CONFIRMED_NO_RUNTIME_MUTATION'
              : null,
          completed_at: new Date(),
        },
        true,
      );
      return status === 'BLOCKED' ? 'blocked' : 'noMutation';
    }
    if (status === 'RESTORED') {
      exactRuntimeReceipt(receipt, command, 'RESTORED');
      await persist(
        {
          saga_status: 'RESTORED',
          restore_receipt: JSON.stringify(receipt),
          last_error: null,
          completed_at: new Date(),
        },
        true,
      );
      return 'restored';
    }
    const snapshotSha256 = String(
      row.snapshot_sha256 ?? receipt.snapshotSha256 ?? '',
    );
    if (!/^[0-9a-f]{64}$/.test(snapshotSha256)) {
      throw new Error('PROJECT_RUNTIME_PURGE_RECOVERY_SNAPSHOT_INVALID');
    }
    const exactCommand = { ...command, snapshotSha256 };
    exactRuntimeReceipt(receipt, exactCommand, 'PURGED');
    const restored = await runtimePurge.restore(exactCommand);
    exactRuntimeReceipt(restored, exactCommand, 'RESTORED');
    if (restored.aToBToA !== true) {
      throw new Error('PROJECT_RUNTIME_PURGE_RECOVERY_RESTORE_INVALID');
    }
    await persist(
      {
        saga_status: 'RESTORED',
        snapshot_sha256: snapshotSha256,
        restore_receipt: JSON.stringify(restored),
        last_error: null,
        completed_at: new Date(),
      },
      true,
    );
    return 'restored';
  } catch (error) {
    try {
      await persist({ last_error: String(error) }, true);
    } catch {
      // An expired/replaced recovery lease must never overwrite its successor.
    }
    return 'failed';
  }
};

export async function recoverProjectRuntimePurgeSagas(options: {
  knex: any;
  runtimePurge: ProjectRuntimePurgeGateway;
  recoveryIdentity?: { accountId: string; actorRef?: string };
  staleBefore?: Date;
  limit?: number;
}) {
  const {
    knex,
    runtimePurge,
    recoveryIdentity,
    staleBefore = new Date(Date.now() - 120_000),
    limit = 20,
  } = options;
  const accountId = String(recoveryIdentity?.accountId ?? '');
  const actorRef = String(
    recoveryIdentity?.actorRef ??
      'service:default/project-runtime-purge-recovery',
  );
  if (
    !/^[A-Za-z0-9._@-]{2,120}$/.test(accountId) ||
    accountId !== accountId.trim() ||
    !/^[a-z][a-z0-9._-]*:[a-z0-9._-]+\/[a-z0-9._-]+$/.test(actorRef) ||
    actorRef !== actorRef.trim().toLowerCase()
  ) {
    return {
      claimed: 0,
      restored: 0,
      noMutation: 0,
      blocked: 0,
      failed: 0,
      skipped: 'RECOVERY_IDENTITY_REQUIRED',
    };
  }
  try {
    const authority = await runtimePurge.preflightRecovery({
      accountId,
      actorRef,
    });
    if (!exactRuntimeRecoveryAuthority(authority, accountId)) {
      throw new Error('PROJECT_RUNTIME_PURGE_RECOVERY_AUTHORITY_INVALID');
    }
  } catch (error) {
    return {
      claimed: 0,
      restored: 0,
      noMutation: 0,
      blocked: 0,
      failed: 0,
      skipped: 'RECOVERY_AUTHORITY_NOT_READY',
      error: String(error),
    };
  }
  const claimed = await claimStaleRuntimePurgeSagas({
    knex,
    staleBefore,
    limit,
  });
  const counts = { restored: 0, noMutation: 0, blocked: 0, failed: 0 };
  for (const row of claimed as any[]) {
    const outcome = await recoverClaimedRuntimePurgeSaga({
      knex,
      runtimePurge,
      row,
      accountId,
      actorRef,
    });
    counts[outcome] += 1;
  }
  return { claimed: claimed.length, ...counts };
}

export function registerProjectLifecycleRoutes(options: {
  router: Router;
  knex: any;
  logger: LoggerService;
  resolveIdentity: (request: Request) => Promise<ProjectLifecycleIdentity>;
  runtimePurge: ProjectRuntimePurgeGateway;
}) {
  const { router, knex, logger, resolveIdentity, runtimePurge } = options;

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
        runtimePurge,
        dryRun: String(request.query.dryRun ?? '').toLowerCase() === 'true',
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
