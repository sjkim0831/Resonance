import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request, type Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  analyzeRequirementText,
  buildRequirementDesignContract,
  decodeRequirementDocument,
  requirementContractSha256,
  type RequirementDocumentInput,
} from './requirementAutomation';
import {
  RequirementPublicationError,
  ensureRequirementPublication,
  nextRequirementDesignVersion,
  reconcileRequirementPublicationReceipt,
  requirementContentFingerprint,
  requirementDocumentId,
  requirementItemId,
  requirementPublicationComplete,
  requirementPublicationDisposition,
  requirementPublicationPersistence,
  requirementReceiptTransitionAllowed,
  sameRequirementRevision,
  type RequirementPublicationDisposition,
} from './requirementIngestionLifecycle';
import { registerProjectLifecycleRoutes } from './projectLifecycleRoutes';
import {
  buildSourceDesignAssetMutation,
  synchronizeGlobalDesignAssetSnapshots,
  type DesignAssetSnapshot,
  type SourceDesignAssetMutation,
} from './designAssetSourceImmediate';
import {
  bootstrapProjectDesignRoles,
  canonicalProjectPrincipals,
  validateProjectDesignRoleAssignments,
} from './projectDesignRoles';
import {
  RECEIPT_RECONCILIATION_BATCH_SIZE,
  RECEIPT_RECONCILIATION_LEASE_MS,
  reconcileDesignSnapshotSyncBatch,
  reconcileRequirementReceiptBatch,
  receiptRetryDelayMs,
  selectFairRequirementClaims,
  type DesignSnapshotSyncClaim,
  type RequirementReceiptClaim,
} from './receiptReconciliation';

type ProjectInput = {
  projectId?: string;
  projectName?: string;
  description?: string;
  owner?: string;
  sourceRepository?: string;
  databaseMode?: string;
  runtimeMode?: string;
};

type ControlAssetInput = {
  assetId?: string;
  routePath?: string;
  screenName?: string;
  ownershipLane?: string;
  migrationStatus?: string;
  targetPlugin?: string;
  capabilities?: string[];
  dependencyContracts?: string[];
};

type ScreenCoordinateInput = {
  projectId?: string;
  domainObject?: string;
  actor?: string;
  process?: string;
  step?: string;
  state?: string;
  action?: string;
  permission?: string;
  archetype?: string;
  device?: string;
  language?: string;
  dataContext?: string;
  seedScreenId?: string;
  routePath?: string;
  sections?: string[];
  dataContracts?: string[];
};

const RUNTIME_DESIGN_SOURCE_TIMEOUT_MS = 10_000;

const SCREEN_DIMENSIONS = [
  'projectId',
  'domainObject',
  'actor',
  'process',
  'step',
  'state',
  'action',
  'permission',
  'archetype',
  'device',
  'language',
  'dataContext',
] as const;

const EMISSION_WORK_PACK = [
  [
    'EMISSION_PROJECT_SETUP',
    '배출량 프로젝트 생성',
    'COMPANY_MANAGER',
    '/emission/project/create',
    'CREATE',
  ],
  [
    'EMISSION_PROJECT_COLLECT',
    '활동자료 수집',
    'SITE_DATA_OWNER',
    '/emission/activity-data',
    'WORKFLOW',
  ],
  [
    'EMISSION_PROJECT_CALCULATE',
    '배출량 산정',
    'CALCULATOR',
    '/emission/calculation',
    'WORKFLOW',
  ],
  [
    'EMISSION_PROJECT_VALIDATE',
    '검증 및 보완',
    'VERIFIER',
    '/emission/validate',
    'APPROVAL',
  ],
  [
    'EMISSION_PROJECT_CORRECT',
    '보완·재산정',
    'SITE_DATA_OWNER',
    '/emission/data_input?mode=correction',
    'WORKFLOW',
  ],
  [
    'EMISSION_PROJECT_APPROVE',
    '검토·승인',
    'APPROVER',
    '/emission/validate?tab=approval',
    'APPROVAL',
  ],
  [
    'EMISSION_PROJECT_REPORT',
    '확정·보고',
    'COMPANY_MANAGER',
    '/emission/report_submit',
    'REPORT',
  ],
] as const;

const normalizeCoordinatePart = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 64) || 'default';

const buildCoordinate = (input: ScreenCoordinateInput) =>
  ['ccus', ...SCREEN_DIMENSIONS.map(field => input[field])]
    .map(normalizeCoordinatePart)
    .join(':');

const normalizeProjectId = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

const validateDesignContract = (
  projectId: string,
  contract: Record<string, unknown>,
) => {
  const failures: string[] = [];
  if (contract.projectId !== projectId) {
    failures.push('contract.projectId must match the selected project');
  }
  if (contract.tenantId !== 'DEFAULT') {
    failures.push('contract.tenantId must be DEFAULT');
  }
  const workspaces = Array.isArray(contract.workspaces)
    ? contract.workspaces
    : [];
  if (workspaces.length !== 3) {
    failures.push('exactly 3 actor-process workspaces are required');
  }
  const tabs = workspaces.flatMap(workspace => {
    if (!workspace || typeof workspace !== 'object') return [];
    const candidate = (workspace as { tabs?: unknown }).tabs;
    return Array.isArray(candidate) ? candidate : [];
  });
  if (tabs.length !== 25) {
    failures.push('exactly 25 actor-process functions are required');
  }
  const tabIds = tabs
    .map(tab =>
      tab && typeof tab === 'object'
        ? String((tab as { id?: unknown }).id ?? '')
        : '',
    )
    .filter(Boolean);
  if (new Set(tabIds).size !== tabIds.length) {
    failures.push('actor-process function ids must be unique');
  }
  const workspaceIds = workspaces
    .map(workspace =>
      workspace && typeof workspace === 'object'
        ? String((workspace as { id?: unknown }).id ?? '')
        : '',
    )
    .filter(Boolean);
  for (const required of ['design', 'develop', 'operate']) {
    if (!workspaceIds.includes(required)) {
      failures.push(`missing actor-process workspace: ${required}`);
    }
  }
  const requiredContext = [
    'projectId',
    'tenantId',
    'designVersion',
    'actorCode',
    'processCode',
    'stepCode',
  ];
  const contextFields = Array.isArray(contract.contextFields)
    ? contract.contextFields.map(String)
    : [];
  for (const field of requiredContext) {
    if (!contextFields.includes(field)) {
      failures.push(`missing project context field: ${field}`);
    }
  }
  return {
    status: failures.length === 0 ? 'VERIFIED' : 'BLOCKED',
    failures,
    workspaceCount: workspaces.length,
    functionCount: tabs.length,
  };
};

export default createBackendPlugin({
  pluginId: 'resonance-projects',
  register(env) {
    env.registerInit({
      deps: {
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        userInfo: coreServices.userInfo,
      },
      async init({
        database,
        httpAuth,
        httpRouter,
        logger,
        scheduler,
        userInfo,
      }) {
        const knex = await database.getClient();
        if (!(await knex.schema.hasTable('resonance_projects__project'))) {
          await knex.schema.createTable(
            'resonance_projects__project',
            table => {
              table.string('project_id', 64).primary();
              table.string('project_name', 200).notNullable();
              table.text('description').notNullable().defaultTo('');
              table.string('owner', 120).notNullable();
              table
                .string('source_repository', 500)
                .notNullable()
                .defaultTo('');
              table.string('database_mode', 64).notNullable();
              table.string('runtime_mode', 64).notNullable();
              table.string('status', 32).notNullable();
              table.integer('design_version').notNullable().defaultTo(1);
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
            },
          );
        }
        if (!(await knex.schema.hasTable('resonance_projects__task'))) {
          await knex.schema.createTable('resonance_projects__task', table => {
            table.bigIncrements('task_id').primary();
            table
              .string('project_id', 64)
              .notNullable()
              .references('project_id')
              .inTable('resonance_projects__project')
              .onDelete('CASCADE');
            table.string('task_type', 64).notNullable();
            table.string('status', 32).notNullable();
            table.jsonb('payload').notNullable();
            table.text('error_message').nullable();
            table.timestamp('created_at', { useTz: true }).notNullable();
            table.timestamp('updated_at', { useTz: true }).notNullable();
          });
          await knex.schema.alterTable('resonance_projects__task', table => {
            table.index(
              ['project_id', 'status'],
              'resonance_projects__task_project_status_idx',
            );
          });
        }
        if (
          !(await knex.schema.hasTable('resonance_projects__design_release'))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_release',
            table => {
              table.bigIncrements('release_id').primary();
              table
                .string('project_id', 64)
                .notNullable()
                .references('project_id')
                .inTable('resonance_projects__project')
                .onDelete('CASCADE');
              table.integer('design_version').notNullable();
              table.string('release_status', 32).notNullable();
              table.jsonb('contract_payload').notNullable();
              table.string('contract_sha256', 64).notNullable();
              table.jsonb('validation_report').notNullable();
              table.string('created_by', 120).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.timestamp('promoted_at', { useTz: true }).nullable();
              table.unique(
                ['project_id', 'design_version'],
                'resonance_projects__design_release_project_version_uq',
              );
              table.index(
                ['project_id', 'release_status'],
                'resonance_projects__design_release_status_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__design_asset_snapshot',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_snapshot',
            table => {
              table.bigIncrements('snapshot_id').primary();
              table
                .string('project_id', 64)
                .notNullable()
                .references('project_id')
                .inTable('resonance_projects__project')
                .onDelete('CASCADE');
              table.string('asset_type', 32).notNullable();
              table.string('asset_id', 200).notNullable();
              table.string('asset_name', 300).notNullable();
              table.string('route_path', 500).notNullable().defaultTo('');
              table.string('asset_version', 80).notNullable().defaultTo('v1');
              table.boolean('active').notNullable().defaultTo(true);
              table.jsonb('asset_payload').notNullable();
              table.string('asset_sha256', 64).notNullable();
              table.timestamp('synced_at', { useTz: true }).notNullable();
              table.unique(
                ['project_id', 'asset_type', 'asset_id'],
                'resonance_design_asset_project_type_id_uq',
              );
              table.index(
                ['project_id', 'asset_type', 'active'],
                'resonance_design_asset_lookup_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__design_asset_role_assignment',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_role_assignment',
            table => {
              table.bigIncrements('assignment_id').primary();
              table.string('project_id', 64).notNullable();
              table.string('principal_ref', 300).notNullable();
              table.string('role_code', 32).notNullable();
              table.boolean('active').notNullable().defaultTo(true);
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.unique(
                ['project_id', 'principal_ref', 'role_code'],
                'resonance_design_asset_role_assignment_uq',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__design_asset_source_sync',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_source_sync',
            table => {
              table.string('sync_id', 64).primary();
              table.string('project_id', 64).notNullable();
              table.string('asset_type', 32).notNullable();
              table.string('asset_id', 200).notNullable();
              table.string('snapshot_base_fingerprint', 64).notNullable();
              table.string('base_fingerprint', 64).notNullable();
              table.string('asset_fingerprint', 64).notNullable();
              table.jsonb('mutation_payload').notNullable();
              table.jsonb('runtime_receipt').notNullable();
              table.string('sync_status', 32).notNullable();
              table.integer('retry_attempt').notNullable().defaultTo(0);
              table.timestamp('next_attempt_at', { useTz: true }).notNullable();
              table.string('claim_token', 64).nullable();
              table.timestamp('lease_expires_at', { useTz: true }).nullable();
              table.text('last_error').nullable();
              table.string('created_by', 300).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.timestamp('synchronized_at', { useTz: true }).nullable();
              table.unique(
                ['project_id', 'asset_type', 'asset_id', 'asset_fingerprint'],
                'resonance_design_asset_source_sync_identity_uq',
              );
              table.index(
                ['sync_status', 'next_attempt_at', 'project_id'],
                'resonance_design_asset_source_sync_due_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasColumn(
            'resonance_projects__design_asset_source_sync',
            'snapshot_base_fingerprint',
          ))
        ) {
          await knex.schema.alterTable(
            'resonance_projects__design_asset_source_sync',
            table =>
              table
                .string('snapshot_base_fingerprint', 64)
                .notNullable()
                .defaultTo(''),
          );
        }
        await knex.raw(`
          create unique index if not exists resonance_design_asset_source_sync_active_uq
              on resonance_projects__design_asset_source_sync(asset_type,asset_id)
           where sync_status in ('PREPARED','PENDING','RUNNING')
        `);
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__design_asset_audit',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_audit',
            table => {
              table.bigIncrements('audit_id').primary();
              table.string('project_id', 64).notNullable();
              table.string('action_code', 64).notNullable();
              table.string('actor_ref', 300).notNullable();
              table.jsonb('details').notNullable().defaultTo('{}');
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.index(
                ['project_id', 'created_at'],
                'resonance_design_asset_audit_lookup_idx',
              );
            },
          );
        }
        const roleSeeds = [
          ['group:default/platform-engineering', 'DESIGN_REQUESTER'],
          ['group:default/carbon-operations', 'DESIGN_REVIEWER'],
          ['group:default/verification-governance', 'DESIGN_APPROVER'],
          ['group:default/verification-governance', 'DESIGN_AUDITOR'],
        ];
        if (process.env.RESONANCE_ALLOW_GUEST_DESIGN_RBAC === 'true') {
          roleSeeds.push(
            ['user:development/guest', 'DESIGN_REQUESTER'],
            ['user:development/guest', 'DESIGN_REVIEWER'],
            ['user:development/guest', 'DESIGN_APPROVER'],
            ['user:development/guest', 'DESIGN_AUDITOR'],
          );
        } else {
          await knex('resonance_projects__design_asset_role_assignment')
            .where({
              project_id: 'CCUS-PLATFORM',
              principal_ref: 'user:development/guest',
            })
            .update({ active: false });
        }
        for (const [principalRef, roleCode] of roleSeeds) {
          await knex('resonance_projects__design_asset_role_assignment')
            .insert({
              project_id: 'CCUS-PLATFORM',
              principal_ref: principalRef,
              role_code: roleCode,
              active: true,
              created_at: new Date(),
            })
            .onConflict(['project_id', 'principal_ref', 'role_code'])
            .merge({ active: true });
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__control_asset_migration',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__control_asset_migration',
            table => {
              table.bigIncrements('migration_id').primary();
              table
                .string('project_id', 64)
                .notNullable()
                .references('project_id')
                .inTable('resonance_projects__project')
                .onDelete('CASCADE');
              table.string('asset_id', 160).notNullable();
              table.string('route_path', 500).notNullable();
              table.string('screen_name', 300).notNullable();
              table.string('ownership_lane', 40).notNullable();
              table.string('migration_status', 40).notNullable();
              table.string('target_plugin', 200).notNullable();
              table.jsonb('capabilities').notNullable();
              table.jsonb('dependency_contracts').notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.unique(
                ['project_id', 'asset_id'],
                'resonance_control_asset_project_asset_uq',
              );
              table.index(
                ['project_id', 'ownership_lane', 'migration_status'],
                'resonance_control_asset_status_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasColumn(
            'resonance_projects__control_asset_migration',
            'verification_evidence',
          ))
        ) {
          await knex.schema.alterTable(
            'resonance_projects__control_asset_migration',
            table => table.jsonb('verification_evidence').nullable(),
          );
        }
        const taskColumns = [
          ['result', (table: any) => table.jsonb('result').nullable()],
          [
            'attempt_count',
            (table: any) =>
              table.integer('attempt_count').notNullable().defaultTo(0),
          ],
          [
            'worker_id',
            (table: any) => table.string('worker_id', 160).nullable(),
          ],
          [
            'started_at',
            (table: any) =>
              table.timestamp('started_at', { useTz: true }).nullable(),
          ],
          [
            'finished_at',
            (table: any) =>
              table.timestamp('finished_at', { useTz: true }).nullable(),
          ],
        ] as const;
        for (const [column, addColumn] of taskColumns) {
          if (
            !(await knex.schema.hasColumn('resonance_projects__task', column))
          ) {
            await knex.schema.alterTable('resonance_projects__task', addColumn);
          }
        }
        if (
          !(await knex.schema.hasTable('resonance_projects__screen_space_spec'))
        ) {
          await knex.schema.createTable(
            'resonance_projects__screen_space_spec',
            table => {
              table.string('coordinate', 1200).primary();
              table.string('project_id', 64).notNullable();
              table.string('seed_screen_id', 200).notNullable();
              table.string('route_path', 500).notNullable();
              table.string('actor_code', 120).notNullable();
              table.string('process_code', 160).notNullable();
              table.string('step_code', 160).notNullable();
              table.string('state_code', 80).notNullable();
              table.string('archetype_code', 80).notNullable();
              table.jsonb('coordinate_payload').notNullable();
              table.jsonb('screen_spec').notNullable();
              table.jsonb('validation_report').notNullable();
              table.string('spec_sha256', 64).notNullable();
              table.string('materialization_status', 40).notNullable();
              table.string('created_by', 200).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.index(
                ['project_id', 'process_code', 'step_code'],
                'resonance_screen_space_process_step_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_projects__requirement_document',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__requirement_document',
            table => {
              table.string('document_id', 64).primary();
              table.string('project_id', 64).notNullable();
              table.string('file_name', 240).notNullable();
              table.string('mime_type', 160).notNullable();
              table.bigInteger('byte_size').notNullable();
              table.string('document_sha256', 64).notNullable();
              table.string('text_sha256', 64).notNullable();
              table.string('identity_key', 240).notNullable();
              table.string('content_fingerprint', 64).notNullable();
              table.text('extracted_text').notNullable();
              table.string('analysis_status', 32).notNullable();
              table.integer('requirement_count').notNullable();
              table.integer('design_version').notNullable();
              table.string('process_code', 80).notNullable();
              table.string('created_by', 160).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.index(
                ['project_id', 'identity_key', 'design_version'],
                'resonance_requirement_document_identity_head_idx',
              );
              table.index(
                ['project_id', 'created_at'],
                'resonance_requirement_document_project_idx',
              );
            },
          );
        }
        for (const [column, length] of [
          ['identity_key', 240],
          ['content_fingerprint', 64],
        ] as const) {
          if (
            !(await knex.schema.hasColumn(
              'resonance_projects__requirement_document',
              column,
            ))
          ) {
            await knex.schema.alterTable(
              'resonance_projects__requirement_document',
              table => table.string(column, length).nullable(),
            );
          }
        }
        await knex.raw(
          'alter table resonance_projects__requirement_document drop constraint if exists resonance_requirement_document_project_hash_uq',
        );
        await knex.raw(`
          update resonance_projects__requirement_document
             set identity_key=coalesce(identity_key,'legacy:raw:'||document_sha256),
                 content_fingerprint=coalesce(content_fingerprint,document_sha256)
           where identity_key is null or content_fingerprint is null
        `);
        await knex.raw(`
          alter table resonance_projects__requirement_document
            alter column identity_key set not null,
            alter column content_fingerprint set not null
        `);
        await knex.raw(`
          create index if not exists resonance_requirement_document_identity_head_idx
          on resonance_projects__requirement_document(project_id,identity_key,design_version desc)
        `);
        const requirementReceiptColumns = [
          [
            'publication_reconcile_status',
            (table: any) =>
              table.string('publication_reconcile_status', 32).nullable(),
          ],
          [
            'publication_poll_attempt_count',
            (table: any) =>
              table
                .integer('publication_poll_attempt_count')
                .notNullable()
                .defaultTo(0),
          ],
          [
            'publication_next_attempt_at',
            (table: any) =>
              table
                .timestamp('publication_next_attempt_at', { useTz: true })
                .nullable(),
          ],
          [
            'publication_claim_token',
            (table: any) =>
              table.string('publication_claim_token', 64).nullable(),
          ],
          [
            'publication_lease_expires_at',
            (table: any) =>
              table
                .timestamp('publication_lease_expires_at', { useTz: true })
                .nullable(),
          ],
          [
            'publication_last_error',
            (table: any) => table.text('publication_last_error').nullable(),
          ],
          [
            'publication_reconciled_at',
            (table: any) =>
              table
                .timestamp('publication_reconciled_at', { useTz: true })
                .nullable(),
          ],
        ] as const;
        for (const [column, addColumn] of requirementReceiptColumns) {
          if (
            !(await knex.schema.hasColumn(
              'resonance_projects__requirement_document',
              column,
            ))
          ) {
            await knex.schema.alterTable(
              'resonance_projects__requirement_document',
              addColumn,
            );
          }
        }
        await knex.raw(`
          create index if not exists resonance_requirement_document_receipt_due_idx
          on resonance_projects__requirement_document(
            analysis_status,publication_next_attempt_at,project_id,created_at
          )
        `);
        if (
          !(await knex.schema.hasTable('resonance_projects__requirement_item'))
        ) {
          await knex.schema.createTable(
            'resonance_projects__requirement_item',
            table => {
              table.string('requirement_id', 120).primary();
              table.string('document_id', 64).notNullable();
              table.string('project_id', 64).notNullable();
              table.integer('sort_order').notNullable();
              table.string('title', 240).notNullable();
              table.text('description').notNullable();
              table.string('actor_code', 80).notNullable();
              table.string('process_code', 80).notNullable();
              table.string('step_code', 100).notNullable();
              table.string('route_path', 500).notNullable();
              table.string('endpoint_method', 12).notNullable();
              table.string('endpoint_path', 500).notNullable();
              table.jsonb('field_contract').notNullable();
              table.jsonb('acceptance_criteria').notNullable();
              table.string('implementation_status', 40).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.index(
                ['project_id', 'process_code', 'sort_order'],
                'resonance_requirement_item_process_idx',
              );
            },
          );
        }

        const resolveAuthenticatedProjectIdentity = async (
          request: Request,
        ) => {
          const credentials = await httpAuth.credentials(request, {
            allow: ['user'],
          });
          const user = await userInfo.getUserInfo(credentials);
          const assignments = bootstrapProjectDesignRoles([
            user.userEntityRef,
            ...user.ownershipEntityRefs,
          ]);
          const principals = [
            ...new Set(assignments.map(item => item.principalRef)),
          ];
          if (!principals.length) {
            const error = new Error(
              'authenticated project owner principal is invalid',
            ) as Error & { statusCode?: number };
            error.statusCode = 403;
            throw error;
          }
          const systemAdministratorPrincipals = new Set(
            canonicalProjectPrincipals([
              'group:default/system-administrators',
              ...String(
                process.env.RESONANCE_SYSTEM_ADMIN_PRINCIPALS ?? '',
              ).split(','),
            ]),
          );
          return {
            actorRef: String(user.userEntityRef).trim().toLowerCase(),
            principals,
            systemAdministrator: principals.some(principal =>
              systemAdministratorPrincipals.has(principal),
            ),
          };
        };
        const resolveDesignAssetAccess = async (
          request: Request,
          projectId: string,
        ) => {
          const identity = await resolveAuthenticatedProjectIdentity(request);
          const assignments = await knex(
            'resonance_projects__design_asset_role_assignment',
          )
            .where({ project_id: projectId, active: true })
            .whereIn('principal_ref', identity.principals)
            .select('role_code');
          return {
            ...identity,
            roles: assignments.map(row => String(row.role_code)),
          };
        };
        const resolveRuntimeAccount = async (request: Request) => {
          const credentials = await httpAuth.credentials(request, {
            allow: ['user'],
          });
          const user = await userInfo.getUserInfo(credentials);
          const accountId = user.userEntityRef.split('/').at(-1)?.trim() ?? '';
          if (!accountId || !/^[A-Za-z0-9._@-]{2,120}$/.test(accountId)) {
            const error = new Error(
              'authenticated runtime account is invalid',
            ) as Error & { statusCode?: number };
            error.statusCode = 403;
            throw error;
          }
          return { accountId, userEntityRef: user.userEntityRef };
        };
        const requireDesignAssetRole = async (
          request: Request,
          projectId: string,
          role: string,
        ) => {
          const access = await resolveDesignAssetAccess(request, projectId);
          if (!access.roles.includes(role)) {
            await knex('resonance_projects__design_asset_audit').insert({
              project_id: projectId,
              action_code: 'ACCESS_DENIED',
              actor_ref: access.actorRef,
              details: JSON.stringify({ requiredRole: role }),
              created_at: new Date(),
            });
            const error = new Error(
              `missing required role: ${role}`,
            ) as Error & {
              statusCode?: number;
            };
            error.statusCode = 403;
            throw error;
          }
          return access;
        };
        const persistRequirementPublicationReceipt = async ({
          projectId,
          documentId,
          designVersion,
          existingRevision,
          disposition,
          publication,
          reconciliationClaimToken,
        }: {
          projectId: string;
          documentId: string;
          designVersion: number;
          existingRevision: boolean;
          disposition: RequirementPublicationDisposition;
          publication: Record<string, unknown>;
          reconciliationClaimToken?: string;
        }) => {
          const recordedAt = new Date();
          const target = requirementPublicationPersistence(disposition);
          const publicationEvidence = JSON.stringify({
            evidenceType: 'RUNTIME_PUBLICATION_RECEIPT',
            disposition,
            publication,
          });
          const generation =
            publication.generation && typeof publication.generation === 'object'
              ? (publication.generation as Record<string, unknown>)
              : {};
          const terminalError = target.successful
            ? null
            : String(generation.message ?? publication.message ?? disposition);
          const rawAttempt = Number(
            generation.retryAttempt ?? publication.retryAttempt ?? 0,
          );
          const retryAttempt =
            Number.isInteger(rawAttempt) && rawAttempt >= 0 ? rawAttempt : 0;
          return knex.transaction(async transaction => {
            const currentRelease = await transaction(
              'resonance_projects__design_release',
            )
              .select('release_status')
              .where({ project_id: projectId, design_version: designVersion })
              .forUpdate()
              .first();
            if (!currentRelease) {
              throw new Error('REQUIREMENT_RELEASE_RECEIPT_CAS_NOT_EXACT');
            }
            const currentReleaseStatus = String(
              currentRelease.release_status,
            ).toUpperCase();
            const currentTask = await transaction('resonance_projects__task')
              .select('attempt_count')
              .where({ project_id: projectId })
              .whereRaw("payload->>'documentId' = ?", [documentId])
              .whereNotNull('attempt_count')
              .orderBy('attempt_count', 'desc')
              .first();
            const currentAttempt = Math.max(
              0,
              Number(currentTask?.attempt_count ?? 0),
            );
            const currentDisposition = requirementPublicationDisposition({
              releaseStatus: currentReleaseStatus,
            });
            let claimedPollAttempt = 0;
            if (reconciliationClaimToken) {
              const claimedDocument = await transaction(
                'resonance_projects__requirement_document',
              )
                .select(
                  'publication_claim_token',
                  'publication_reconcile_status',
                  'publication_poll_attempt_count',
                )
                .where({ project_id: projectId, document_id: documentId })
                .forUpdate()
                .first();
              if (
                !claimedDocument ||
                claimedDocument.publication_claim_token !==
                  reconciliationClaimToken ||
                claimedDocument.publication_reconcile_status !== 'RUNNING'
              ) {
                throw new Error('REQUIREMENT_RECEIPT_CLAIM_IS_STALE');
              }
              claimedPollAttempt = Math.max(
                1,
                Number(claimedDocument.publication_poll_attempt_count ?? 1),
              );
            }
            const transitionAllowed = requirementReceiptTransitionAllowed({
              currentReleaseStatus,
              currentAttempt,
              incomingDisposition: disposition,
              incomingAttempt: retryAttempt,
              existingRevision,
            });
            if (!transitionAllowed) {
              if (currentDisposition) {
                if (reconciliationClaimToken) {
                  const terminal = [
                    'APPLIED',
                    'FAILED',
                    'REVIEW_REQUIRED',
                  ].includes(currentDisposition);
                  const settled = await transaction(
                    'resonance_projects__requirement_document',
                  )
                    .where({
                      project_id: projectId,
                      document_id: documentId,
                      publication_claim_token: reconciliationClaimToken,
                      publication_reconcile_status: 'RUNNING',
                    })
                    .update({
                      publication_reconcile_status: terminal
                        ? 'TERMINAL'
                        : 'PENDING',
                      publication_next_attempt_at: terminal
                        ? null
                        : new Date(
                            recordedAt.getTime() +
                              receiptRetryDelayMs(claimedPollAttempt),
                          ),
                      publication_claim_token: null,
                      publication_lease_expires_at: null,
                      publication_reconciled_at: terminal ? recordedAt : null,
                    });
                  if (settled !== 1) {
                    throw new Error('REQUIREMENT_RECEIPT_CLAIM_IS_STALE');
                  }
                }
                return currentDisposition;
              }
              throw new Error('REQUIREMENT_RELEASE_RECEIPT_CAS_NOT_EXACT');
            }
            const releaseUpdates = await transaction(
              'resonance_projects__design_release',
            )
              .where({
                project_id: projectId,
                design_version: designVersion,
                release_status: currentReleaseStatus,
              })
              .update({
                release_status: target.releaseStatus,
                promoted_at: recordedAt,
                updated_at: recordedAt,
              });
            if (releaseUpdates !== 1) {
              throw new Error('REQUIREMENT_RELEASE_RECEIPT_CAS_NOT_EXACT');
            }
            await transaction('resonance_projects__project')
              .where({ project_id: projectId })
              .where('design_version', '<=', designVersion)
              .update({
                design_version: designVersion,
                status: target.projectStatus,
                updated_at: recordedAt,
              });
            const documentReceiptUpdate: Record<string, unknown> = {
              analysis_status: target.analysisStatus,
              publication_last_error: terminalError,
            };
            if (reconciliationClaimToken) {
              Object.assign(documentReceiptUpdate, {
                publication_reconcile_status: target.completeTasks
                  ? 'TERMINAL'
                  : 'PENDING',
                publication_next_attempt_at: target.completeTasks
                  ? null
                  : new Date(
                      recordedAt.getTime() +
                        receiptRetryDelayMs(claimedPollAttempt),
                    ),
                publication_claim_token: null,
                publication_lease_expires_at: null,
                publication_reconciled_at: target.completeTasks
                  ? recordedAt
                  : null,
              });
            } else {
              Object.assign(documentReceiptUpdate, {
                publication_reconcile_status: target.completeTasks
                  ? 'TERMINAL'
                  : 'PENDING',
                publication_poll_attempt_count: target.completeTasks
                  ? retryAttempt
                  : 0,
                publication_next_attempt_at: target.completeTasks
                  ? null
                  : recordedAt,
                publication_claim_token: null,
                publication_lease_expires_at: null,
                publication_reconciled_at: target.completeTasks
                  ? recordedAt
                  : null,
              });
            }
            const documentUpdateQuery = transaction(
              'resonance_projects__requirement_document',
            ).where({ project_id: projectId, document_id: documentId });
            if (reconciliationClaimToken) {
              documentUpdateQuery.where({
                publication_claim_token: reconciliationClaimToken,
                publication_reconcile_status: 'RUNNING',
              });
            }
            const documentUpdates = await documentUpdateQuery.update(
              documentReceiptUpdate,
            );
            if (documentUpdates !== 1) {
              throw new Error('REQUIREMENT_RECEIPT_DOCUMENT_CAS_NOT_EXACT');
            }
            await transaction('resonance_projects__requirement_item')
              .where({ project_id: projectId, document_id: documentId })
              .update({ implementation_status: target.itemStatus });
            const taskUpdates = transaction('resonance_projects__task')
              .where({ project_id: projectId })
              .whereRaw("payload->>'documentId' = ?", [documentId]);
            if (target.taskStatus !== 'COMPLETED') {
              taskUpdates.whereNot('status', 'COMPLETED');
            }
            await taskUpdates.update({
              status: target.taskStatus,
              result: publicationEvidence,
              error_message: terminalError,
              attempt_count: retryAttempt,
              finished_at: target.completeTasks ? recordedAt : null,
              updated_at: recordedAt,
            });
            return disposition;
          });
        };

        const runtimeBridgeBaseUrl = () =>
          String(
            process.env.CARBONET_RUNTIME_BASE_URL ??
              'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
          ).replace(/\/+$/, '');
        const runtimeBridgeToken = () =>
          String(process.env.RESONANCE_OPS_TOKEN ?? '');
        const parseJsonRecord = (value: unknown): Record<string, unknown> => {
          if (value && typeof value === 'object') {
            return value as Record<string, unknown>;
          }
          if (typeof value === 'string') {
            const parsed = JSON.parse(value) as unknown;
            if (parsed && typeof parsed === 'object') {
              return parsed as Record<string, unknown>;
            }
          }
          throw new Error('RECEIPT_PAYLOAD_OBJECT_REQUIRED');
        };
        const readRuntimeJson = async (
          url: string,
          init: RequestInit,
        ): Promise<{
          ok: boolean;
          status: number;
          body: Record<string, unknown>;
        }> => {
          const token = runtimeBridgeToken();
          if (!token) throw new Error('RUNTIME_RECEIPT_TOKEN_UNAVAILABLE');
          let result: globalThis.Response;
          try {
            result = await fetch(url, {
              ...init,
              signal: AbortSignal.timeout(RUNTIME_DESIGN_SOURCE_TIMEOUT_MS),
              headers: {
                accept: 'application/json',
                'x-resonance-token': token,
                ...init.headers,
              },
            });
          } catch (error) {
            throw new Error(`RUNTIME_RECEIPT_REQUEST_FAILED: ${String(error)}`);
          }
          const text = await result.text();
          let body: Record<string, unknown>;
          try {
            body = parseJsonRecord(text);
          } catch {
            throw new Error('RUNTIME_RECEIPT_RESPONSE_NOT_JSON');
          }
          return { ok: result.ok, status: result.status, body };
        };

        const claimRequirementReceipts = async (
          limit: number,
        ): Promise<RequirementReceiptClaim[]> => {
          const now = new Date();
          const leaseExpiresAt = new Date(
            now.getTime() + RECEIPT_RECONCILIATION_LEASE_MS,
          );
          const claimToken = randomUUID();
          return knex.transaction(async transaction => {
            const dueRows = await transaction(
              'resonance_projects__requirement_document as document',
            )
              .join(
                'resonance_projects__design_release as release',
                function joinRequirementRelease() {
                  this.on(
                    'release.project_id',
                    '=',
                    'document.project_id',
                  ).andOn(
                    'release.design_version',
                    '=',
                    'document.design_version',
                  );
                },
              )
              .whereIn('document.analysis_status', [
                'GENERATION_QUEUED',
                'GENERATION_RUNNING',
                'QUEUED',
                'RUNNING',
              ])
              .whereIn('release.release_status', ['QUEUED', 'RUNNING'])
              .andWhere(builder =>
                builder
                  .whereNull('document.publication_next_attempt_at')
                  .orWhere('document.publication_next_attempt_at', '<=', now),
              )
              .andWhere(builder =>
                builder
                  .whereNull('document.publication_claim_token')
                  .orWhereNull('document.publication_lease_expires_at')
                  .orWhere('document.publication_lease_expires_at', '<=', now),
              )
              .select(
                'document.document_id as documentId',
                'document.project_id as projectId',
                'document.design_version as designVersion',
                'document.publication_next_attempt_at as dueAt',
              )
              .select(
                transaction.raw(`
                  row_number() over (
                    partition by document.project_id
                    order by coalesce(
                      document.publication_next_attempt_at,
                      document.created_at
                    ),document.created_at,document.document_id
                  ) as "projectRank"
                `),
              )
              .orderBy('projectRank', 'asc')
              .orderByRaw(
                'coalesce(document.publication_next_attempt_at,document.created_at) asc',
              )
              .orderBy('document.project_id', 'asc')
              .orderBy('document.document_id', 'asc')
              .limit(Math.min(1_000, Math.max(limit * 20, 100)));
            const fair = selectFairRequirementClaims(dueRows, limit);
            if (!fair.length) return [];
            const locked = await transaction(
              'resonance_projects__requirement_document as document',
            )
              .join(
                'resonance_projects__design_release as release',
                function joinRequirementRelease() {
                  this.on(
                    'release.project_id',
                    '=',
                    'document.project_id',
                  ).andOn(
                    'release.design_version',
                    '=',
                    'document.design_version',
                  );
                },
              )
              .whereIn(
                'document.document_id',
                fair.map(candidate => candidate.documentId),
              )
              .whereIn('document.analysis_status', [
                'GENERATION_QUEUED',
                'GENERATION_RUNNING',
                'QUEUED',
                'RUNNING',
              ])
              .whereIn('release.release_status', ['QUEUED', 'RUNNING'])
              .andWhere(builder =>
                builder
                  .whereNull('document.publication_claim_token')
                  .orWhereNull('document.publication_lease_expires_at')
                  .orWhere('document.publication_lease_expires_at', '<=', now),
              )
              .select(
                'document.document_id as documentId',
                'document.project_id as projectId',
                'document.design_version as designVersion',
                'document.publication_poll_attempt_count as pollAttempt',
                'release.contract_sha256 as contractSha256',
              )
              .forUpdate()
              .skipLocked();
            if (!locked.length) return [];
            const lockedIds = locked.map(row => String(row.documentId));
            await transaction('resonance_projects__requirement_document')
              .whereIn('document_id', lockedIds)
              .update({
                publication_reconcile_status: 'RUNNING',
                publication_claim_token: claimToken,
                publication_lease_expires_at: leaseExpiresAt,
                publication_last_error: null,
                publication_poll_attempt_count: transaction.raw(
                  'coalesce(publication_poll_attempt_count,0)+1',
                ),
              });
            return locked.map(row => ({
              documentId: String(row.documentId),
              projectId: String(row.projectId),
              designVersion: Number(row.designVersion),
              contractSha256: String(row.contractSha256),
              claimToken,
              pollAttempt: Number(row.pollAttempt ?? 0) + 1,
            }));
          });
        };
        const readRequirementRuntimeReceipt = async (
          claim: RequirementReceiptClaim,
        ) => {
          const result = await readRuntimeJson(
            `${runtimeBridgeBaseUrl()}/api/internal/actor-process/design-releases/${encodeURIComponent(
              claim.projectId,
            )}/${claim.designVersion}?contractSha256=${encodeURIComponent(
              claim.contractSha256,
            )}`,
            { method: 'GET' },
          );
          if (!result.ok) {
            throw new Error(
              String(
                result.body.message ?? `RUNTIME_RECEIPT_HTTP_${result.status}`,
              ),
            );
          }
          return result.body;
        };
        const retryRequirementReceiptClaim = async (
          claim: RequirementReceiptClaim,
          message: string,
          nextAttemptAt: Date,
        ) =>
          (await knex('resonance_projects__requirement_document')
            .where({
              document_id: claim.documentId,
              publication_claim_token: claim.claimToken,
              publication_reconcile_status: 'RUNNING',
            })
            .update({
              publication_reconcile_status: 'PENDING',
              publication_next_attempt_at: nextAttemptAt,
              publication_claim_token: null,
              publication_lease_expires_at: null,
              publication_last_error: message,
            })) === 1;

        const designSnapshotSyncId = (
          projectId: string,
          mutation: Record<string, unknown>,
        ) =>
          createHash('sha256')
            .update(
              `${projectId}\0${String(mutation.assetType)}\0${String(
                mutation.assetId,
              )}\0${String(mutation.baseFingerprint)}\0${String(
                mutation.assetFingerprint,
              )}`,
            )
            .digest('hex');
        const queueDesignSnapshotSync = async ({
          projectId,
          mutation,
          actorRef,
          snapshotBaseFingerprint,
        }: {
          projectId: string;
          mutation: Record<string, unknown>;
          actorRef: string;
          snapshotBaseFingerprint: string;
        }) => {
          const syncId = designSnapshotSyncId(projectId, mutation);
          const now = new Date();
          const claimToken = randomUUID();
          const leaseExpiresAt = new Date(
            now.getTime() + RECEIPT_RECONCILIATION_LEASE_MS,
          );
          await knex.transaction(async transaction => {
            const existing = await transaction(
              'resonance_projects__design_asset_source_sync',
            )
              .where({ sync_id: syncId })
              .forUpdate()
              .first();
            const row = {
              project_id: projectId,
              asset_type: String(mutation.assetType),
              asset_id: String(mutation.assetId),
              snapshot_base_fingerprint: snapshotBaseFingerprint,
              base_fingerprint: String(mutation.baseFingerprint),
              asset_fingerprint: String(mutation.assetFingerprint),
              mutation_payload: JSON.stringify(mutation),
              runtime_receipt: JSON.stringify({}),
              sync_status: 'PREPARED',
              retry_attempt: Number(existing?.retry_attempt ?? 0),
              next_attempt_at: now,
              claim_token: claimToken,
              lease_expires_at: leaseExpiresAt,
              last_error: null,
              created_by: actorRef,
              created_at: existing?.created_at ?? now,
              updated_at: now,
              synchronized_at: null,
            };
            if (existing) {
              await transaction('resonance_projects__design_asset_source_sync')
                .where({ sync_id: syncId })
                .update(row);
            } else {
              await transaction(
                'resonance_projects__design_asset_source_sync',
              ).insert({ sync_id: syncId, ...row });
            }
          });
          return { syncId, claimToken, retryNotBefore: leaseExpiresAt };
        };
        const cancelPreparedDesignSnapshotSync = async (
          prepared: { syncId: string; claimToken: string },
          message: string,
        ) =>
          (await knex('resonance_projects__design_asset_source_sync')
            .where({
              sync_id: prepared.syncId,
              sync_status: 'PREPARED',
              claim_token: prepared.claimToken,
            })
            .update({
              sync_status: 'CANCELLED',
              claim_token: null,
              lease_expires_at: null,
              last_error: message.slice(0, 2_000),
              updated_at: new Date(),
            })) === 1;
        const claimDesignSnapshotSyncs = async (
          limit: number,
        ): Promise<DesignSnapshotSyncClaim[]> => {
          const now = new Date();
          const leaseExpiresAt = new Date(
            now.getTime() + RECEIPT_RECONCILIATION_LEASE_MS,
          );
          const claimToken = randomUUID();
          return knex.transaction(async transaction => {
            const rows = await transaction(
              'resonance_projects__design_asset_source_sync',
            )
              .whereIn('sync_status', ['PREPARED', 'PENDING', 'RUNNING'])
              .andWhere('next_attempt_at', '<=', now)
              .andWhere(builder =>
                builder
                  .whereNull('claim_token')
                  .orWhereNull('lease_expires_at')
                  .orWhere('lease_expires_at', '<=', now),
              )
              .orderBy('next_attempt_at', 'asc')
              .orderBy('project_id', 'asc')
              .limit(limit)
              .forUpdate()
              .skipLocked();
            if (!rows.length) return [];
            const ids = rows.map(row => String(row.sync_id));
            await transaction('resonance_projects__design_asset_source_sync')
              .whereIn('sync_id', ids)
              .update({
                sync_status: 'RUNNING',
                claim_token: claimToken,
                lease_expires_at: leaseExpiresAt,
                retry_attempt: transaction.raw('coalesce(retry_attempt,0)+1'),
                last_error: null,
                updated_at: now,
              });
            return rows.map(row => ({
              syncId: String(row.sync_id),
              projectId: String(row.project_id),
              assetType: String(row.asset_type),
              assetId: String(row.asset_id),
              snapshotBaseFingerprint: String(row.snapshot_base_fingerprint),
              assetFingerprint: String(row.asset_fingerprint),
              mutation: parseJsonRecord(row.mutation_payload),
              actorRef: String(row.created_by),
              claimToken,
              retryAttempt: Number(row.retry_attempt ?? 0) + 1,
            }));
          });
        };
        const replayDesignAssetSource = async (
          claim: DesignSnapshotSyncClaim,
        ) => {
          const result = await readRuntimeJson(
            `${runtimeBridgeBaseUrl()}/api/internal/actor-process/design-assets/source`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-resonance-actor': claim.actorRef,
              },
              body: JSON.stringify({
                projectId: claim.projectId,
                ...claim.mutation,
              }),
            },
          );
          if (
            !result.ok &&
            result.body.sourceCommitted !== true &&
            result.body.sourceCommitted !== false
          ) {
            throw new Error(
              String(
                result.body.message ??
                  `RUNTIME_SOURCE_REPLAY_HTTP_${result.status}`,
              ),
            );
          }
          return result.body;
        };
        const cancelDesignSnapshotSyncClaim = async (
          claim: DesignSnapshotSyncClaim,
          message: string,
          receipt: Record<string, unknown>,
        ) => {
          const now = new Date();
          return (
            (await knex('resonance_projects__design_asset_source_sync')
              .where({
                sync_id: claim.syncId,
                sync_status: 'RUNNING',
                claim_token: claim.claimToken,
              })
              .update({
                sync_status: 'CANCELLED',
                runtime_receipt: JSON.stringify(receipt),
                next_attempt_at: now,
                claim_token: null,
                lease_expires_at: null,
                last_error: message.slice(0, 2_000),
                updated_at: now,
                synchronized_at: null,
              })) === 1
          );
        };
        const commitDesignSnapshotSync = async (
          claim: DesignSnapshotSyncClaim,
          receipt: Record<string, unknown>,
        ) => {
          const mutation = claim.mutation;
          const nextFingerprint = String(mutation.assetFingerprint);
          if (
            String(mutation.assetType) !== claim.assetType ||
            String(mutation.assetId) !== claim.assetId ||
            nextFingerprint.toLowerCase() !==
              claim.assetFingerprint.toLowerCase()
          ) {
            throw new Error('DESIGN_SNAPSHOT_SYNC_CLAIM_PAYLOAD_MISMATCH');
          }
          return knex.transaction(async transaction => {
            const activeClaim = await transaction(
              'resonance_projects__design_asset_source_sync',
            )
              .where({
                sync_id: claim.syncId,
                sync_status: 'RUNNING',
                claim_token: claim.claimToken,
              })
              .forUpdate()
              .first();
            if (!activeClaim) return false;
            const now = new Date();
            const synchronizedProjectCount =
              await synchronizeGlobalDesignAssetSnapshots(
                transaction,
                mutation as SourceDesignAssetMutation,
                now,
              );
            const updated = await transaction(
              'resonance_projects__design_asset_source_sync',
            )
              .where({
                sync_id: claim.syncId,
                sync_status: 'RUNNING',
                claim_token: claim.claimToken,
              })
              .update({
                sync_status: 'SYNCHRONIZED',
                runtime_receipt: JSON.stringify(receipt),
                next_attempt_at: now,
                claim_token: null,
                lease_expires_at: null,
                last_error: null,
                updated_at: now,
                synchronized_at: now,
              });
            if (updated !== 1) {
              throw new Error('DESIGN_SNAPSHOT_SYNC_COMMIT_FENCE_LOST');
            }
            await transaction('resonance_projects__design_asset_audit').insert({
              project_id: claim.projectId,
              action_code: 'SOURCE_IMMEDIATE_SNAPSHOT_RECONCILED',
              actor_ref: 'system:receipt-reconciler',
              details: JSON.stringify({
                syncId: claim.syncId,
                assetType: claim.assetType,
                assetId: claim.assetId,
                snapshotBaseFingerprint: claim.snapshotBaseFingerprint,
                assetFingerprint: claim.assetFingerprint,
                synchronizedProjectCount,
              }),
              created_at: now,
            });
            return true;
          });
        };
        const retryDesignSnapshotSyncClaim = async (
          claim: DesignSnapshotSyncClaim,
          message: string,
          nextAttemptAt: Date,
        ) =>
          (await knex('resonance_projects__design_asset_source_sync')
            .where({
              sync_id: claim.syncId,
              sync_status: 'RUNNING',
              claim_token: claim.claimToken,
            })
            .update({
              sync_status: 'PENDING',
              next_attempt_at: nextAttemptAt,
              claim_token: null,
              lease_expires_at: null,
              last_error: message,
              updated_at: new Date(),
            })) === 1;

        const router = Router();
        router.use(json({ limit: '10mb' }));
        router.use((_, response, next) => {
          response.setHeader('content-type', 'application/json; charset=utf-8');
          next();
        });
        router.get('/health', async (_request, response) => {
          const [{ count }] = await knex('resonance_projects__project').count({
            count: '*',
          });
          response.json({ status: 'UP', projectCount: Number(count) });
        });
        router.get('/operations/summary', async (_request, response) => {
          const countRows = async (tableName: string) => {
            if (!(await knex.schema.hasTable(tableName))) return 0;
            const [{ count }] = await knex(tableName).count({ count: '*' });
            return Number(count);
          };
          const [projectCount, taskCount, controlAssetCount, designAssetCount] =
            await Promise.all([
              countRows('resonance_projects__project'),
              countRows('resonance_projects__task'),
              countRows('resonance_projects__control_asset'),
              countRows('resonance_projects__design_asset'),
            ]);
          const taskStatusRows = (await knex('resonance_projects__task')
            .select('status')
            .count({ count: '*' })
            .groupBy('status')) as { status: string; count: string | number }[];
          const taskStatuses = Object.fromEntries(
            taskStatusRows.map(row => [row.status, Number(row.count)]),
          );
          let deployment: Record<string, unknown> = {
            status: 'UNKNOWN',
            category: 'NO_EVIDENCE',
            retryAllowed: false,
            retryAttempted: false,
          };
          try {
            deployment = JSON.parse(
              await readFile('/app/deploy-status/deploy-status.json', 'utf8'),
            ) as Record<string, unknown>;
          } catch {
            // The first deployment may precede status publication. Keep the
            // API available and make the missing evidence explicit.
          }
          let deploymentAlerts: Record<string, unknown>[] = [];
          try {
            deploymentAlerts = (
              await readFile('/app/deploy-status/deploy-alerts.jsonl', 'utf8')
            )
              .split('\n')
              .filter(Boolean)
              .slice(-10)
              .reverse()
              .map(line => JSON.parse(line) as Record<string, unknown>);
          } catch {
            // No failures have been recorded yet.
          }
          response.json({
            checkedAt: new Date().toISOString(),
            services: [
              {
                code: 'BACKSTAGE',
                name: 'Backstage control plane',
                status: 'UP',
                evidence: 'operations summary API responded',
              },
              {
                code: 'CONTROL_DB',
                name: 'Control-plane PostgreSQL',
                status: 'UP',
                evidence: 'transactional catalog queries passed',
              },
            ],
            inventory: {
              projectCount,
              taskCount,
              controlAssetCount,
              designAssetCount,
            },
            taskStatuses,
            deployment,
            deploymentAlerts,
          });
        });
        router.get(
          '/actor-process/runtime-dashboard',
          async (request, response) => {
            response.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate',
            );
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const runtimeIdentity = await resolveRuntimeAccount(request);
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/dashboard${
                request.query.dataset
                  ? `?dataset=${encodeURIComponent(
                      String(request.query.dataset),
                    )}`
                  : ''
              }`,
              {
                headers: {
                  accept: 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-account': runtimeIdentity.accountId,
                },
              },
            );
            const body = await runtimeResponse.text();
            if (!runtimeResponse.ok) {
              response.status(runtimeResponse.status).send(body);
              return;
            }
            const dataset = String(request.query.dataset ?? '').trim();
            if (!dataset) {
              response.status(runtimeResponse.status).send(body);
              return;
            }
            if (!/^[A-Za-z][A-Za-z0-9]*$/.test(dataset)) {
              response.status(400).json({ message: 'invalid dataset key' });
              return;
            }
            const dashboard = JSON.parse(body) as Record<string, unknown>;
            response.json({
              [dataset]: Array.isArray(dashboard[dataset])
                ? dashboard[dataset]
                : [],
            });
          },
        );
        router.get(
          '/actor-process/design-documents',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const parameters = new URLSearchParams({
              processCode: String(request.query.processCode ?? ''),
              stepCode: String(request.query.stepCode ?? ''),
              routePath: String(request.query.routePath ?? ''),
            });
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/design-documents?${parameters}`,
              {
                headers: {
                  accept: 'application/json',
                  'x-resonance-token': bridgeToken,
                },
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.get(
          '/actor-process/page-development-master',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const parameters = new URLSearchParams({
              query: String(request.query.query ?? ''),
              processCode: String(request.query.processCode ?? ''),
              status: String(request.query.status ?? ''),
            });
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/page-development-master?${parameters}`,
              {
                headers: {
                  accept: 'application/json',
                  'x-resonance-token': bridgeToken,
                },
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.get(
          '/actor-process/page-development-master/:itemId',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const itemId = String(request.params.itemId ?? '');
            if (!/^\d+$/.test(itemId)) {
              response.status(400).json({ message: 'invalid screen item id' });
              return;
            }
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/page-development-master/${itemId}`,
              {
                headers: {
                  accept: 'application/json',
                  'x-resonance-token': bridgeToken,
                },
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.get(
          '/actor-process/screen-workflow-test-cases',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const parameters = new URLSearchParams({
              screenResourceId: String(request.query.screenResourceId ?? ''),
              processCode: String(request.query.processCode ?? ''),
              stepCode: String(request.query.stepCode ?? ''),
              capabilityCode: String(request.query.capabilityCode ?? 'ALL'),
            });
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/screen-workflow-test-cases?${parameters}`,
              {
                headers: {
                  accept: 'application/json',
                  'x-resonance-token': bridgeToken,
                },
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.post(
          '/actor-process/screen-workflow-test-cases',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const runtimeIdentity = await resolveRuntimeAccount(request);
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/screen-workflow-test-cases`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-actor': runtimeIdentity.userEntityRef,
                  'x-resonance-account': runtimeIdentity.accountId,
                },
                body: JSON.stringify(request.body ?? {}),
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.post(
          '/actor-process/screen-workflow-test',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const runtimeIdentity = await resolveRuntimeAccount(request);
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/screen-workflow-test`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-actor': runtimeIdentity.userEntityRef,
                  'x-resonance-account': runtimeIdentity.accountId,
                },
                body: JSON.stringify(request.body ?? {}),
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.post(
          '/actor-process/design-documents',
          async (request, response) => {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const runtimeIdentity = await resolveRuntimeAccount(request);
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/design-documents`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-actor': runtimeIdentity.userEntityRef,
                  'x-resonance-account': runtimeIdentity.accountId,
                },
                body: JSON.stringify(request.body ?? {}),
              },
            );
            response
              .status(runtimeResponse.status)
              .type('application/json')
              .send(await runtimeResponse.text());
          },
        );
        router.post('/actor-process/commands', async (request, response) => {
          const runtimeBaseUrl = String(
            process.env.CARBONET_RUNTIME_BASE_URL ??
              'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
          ).replace(/\/+$/, '');
          const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
          if (!bridgeToken) {
            response
              .status(503)
              .json({ message: 'control-plane bridge token is missing' });
            return;
          }
          const runtimeIdentity = await resolveRuntimeAccount(request);
          const runtimeResponse = await fetch(
            `${runtimeBaseUrl}/api/internal/actor-process/commands`,
            {
              method: 'POST',
              headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                'x-resonance-token': bridgeToken,
                'x-resonance-actor': runtimeIdentity.userEntityRef,
                'x-resonance-account': runtimeIdentity.accountId,
              },
              body: JSON.stringify(request.body ?? {}),
            },
          );
          const body = await runtimeResponse.text();
          response
            .status(runtimeResponse.status)
            .type('application/json')
            .send(body);
        });
        router.get(
          '/screen-space/work-pack/emission',
          async (_request, response) => {
            response.json({
              workPackCode: 'EMISSION_PROJECT_END_TO_END',
              name: '탄소배출 프로젝트 전 과정',
              stages: EMISSION_WORK_PACK.map(
                ([step, name, actor, routePath, archetype], index) => ({
                  sequence: index + 1,
                  step,
                  name,
                  actor,
                  process: 'EMISSION_PROJECT',
                  routePath,
                  archetype,
                  inputContract:
                    index === 0
                      ? ['tenantId', 'companyId']
                      : [`${EMISSION_WORK_PACK[index - 1][0]}.output`],
                  outputContract: [`${step}.output`],
                  completionCondition: `${step}.status=COMPLETED`,
                }),
              ),
            });
          },
        );
        router.get('/screen-space/specs', async (request, response) => {
          const projectId = normalizeProjectId(
            request.query.projectId ?? 'CCUS-PLATFORM',
          );
          await requireDesignAssetRole(request, projectId, 'DESIGN_REQUESTER');
          const rows = await knex('resonance_projects__screen_space_spec')
            .where({ project_id: projectId })
            .orderBy('updated_at', 'desc')
            .limit(200);
          response.json({
            projectId,
            specs: rows.map(row => ({
              coordinate: row.coordinate,
              seedScreenId: row.seed_screen_id,
              routePath: row.route_path,
              actor: row.actor_code,
              process: row.process_code,
              step: row.step_code,
              state: row.state_code,
              archetype: row.archetype_code,
              status: row.materialization_status,
              specSha256: row.spec_sha256,
              validation: row.validation_report,
              updatedAt: row.updated_at,
            })),
          });
        });
        router.post('/screen-space/materialize', async (request, response) => {
          const input = (request.body ?? {}) as ScreenCoordinateInput;
          const projectId = normalizeProjectId(input.projectId);
          const access = await requireDesignAssetRole(
            request,
            projectId,
            'DESIGN_REQUESTER',
          );
          const missing = SCREEN_DIMENSIONS.filter(
            field => !String(input[field] ?? '').trim(),
          );
          const workflowStage = EMISSION_WORK_PACK.find(
            ([step]) => step === input.step,
          );
          const checks = [
            ['DIMENSIONS_COMPLETE', missing.length === 0],
            ['PROJECT_BOUND', Boolean(projectId)],
            ['ACTOR_BOUND', Boolean(input.actor)],
            ['PROCESS_STEP_BOUND', Boolean(input.process && input.step)],
            ['ROUTE_BOUND', String(input.routePath ?? '').startsWith('/')],
            ['DATA_CONTRACT_BOUND', Boolean(input.dataContracts?.length)],
            ['SECTIONS_BOUND', Boolean(input.sections?.length)],
            [
              'PERMISSION_BOUND',
              input.action === input.permission || input.permission === 'ADMIN',
            ],
            [
              'WORKFLOW_REACHABLE',
              input.process !== 'EMISSION_PROJECT' || Boolean(workflowStage),
            ],
          ].map(([code, passed]) => ({
            code,
            status: passed ? 'PASS' : 'FAIL',
          }));
          const coordinate = buildCoordinate({ ...input, projectId });
          const screenSpec = {
            schemaVersion: 1,
            coordinate,
            dimensions: { ...input, projectId },
            composition: {
              archetype: input.archetype,
              sections: input.sections ?? [],
              responsive: ['DESKTOP', 'TABLET', 'MOBILE'],
            },
            bindings: {
              routePath: input.routePath,
              dataContracts: input.dataContracts ?? [],
              actor: input.actor,
              permission: input.permission,
              action: input.action,
            },
            materialization: {
              strategy: 'LAZY_METADATA_RUNTIME',
              outputs: {
                screenSpec: `screen-spec/${createHash('sha256')
                  .update(coordinate)
                  .digest('hex')
                  .slice(0, 16)}.json`,
                apiContract: `contracts/${normalizeCoordinatePart(
                  input.process,
                )}.openapi.yaml`,
                schemaContract: `contracts/${normalizeCoordinatePart(
                  input.process,
                )}.schema.json`,
                testContract: `tests/${normalizeCoordinatePart(
                  input.process,
                )}-${normalizeCoordinatePart(input.step)}.scenario.json`,
              },
            },
          };
          const canonical = JSON.stringify(screenSpec);
          const checksum = createHash('sha256').update(canonical).digest('hex');
          const status = checks.every(check => check.status === 'PASS')
            ? 'VERIFIED'
            : 'BLOCKED';
          const now = new Date();
          await knex('resonance_projects__screen_space_spec')
            .insert({
              coordinate,
              project_id: projectId,
              seed_screen_id: String(input.seedScreenId ?? 'UNBOUND'),
              route_path: String(input.routePath ?? ''),
              actor_code: String(input.actor ?? ''),
              process_code: String(input.process ?? ''),
              step_code: String(input.step ?? ''),
              state_code: String(input.state ?? ''),
              archetype_code: String(input.archetype ?? ''),
              coordinate_payload: JSON.stringify({ ...input, projectId }),
              screen_spec: canonical,
              validation_report: JSON.stringify({ checks, missing }),
              spec_sha256: checksum,
              materialization_status: status,
              created_by: access.actorRef,
              created_at: now,
              updated_at: now,
            })
            .onConflict('coordinate')
            .merge({
              route_path: String(input.routePath ?? ''),
              coordinate_payload: JSON.stringify({ ...input, projectId }),
              screen_spec: canonical,
              validation_report: JSON.stringify({ checks, missing }),
              spec_sha256: checksum,
              materialization_status: status,
              created_by: access.actorRef,
              updated_at: now,
            });
          let runtimePublication: Record<string, unknown> = {
            success: false,
            status: 'NOT_PUBLISHED',
          };
          if (status === 'VERIFIED') {
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              runtimePublication = {
                success: false,
                status: 'BRIDGE_TOKEN_MISSING',
              };
            } else {
              try {
                const publishResponse = await fetch(
                  `${runtimeBaseUrl}/api/internal/screen-space/specs`,
                  {
                    method: 'POST',
                    headers: {
                      accept: 'application/json',
                      'content-type': 'application/json',
                      'x-resonance-token': bridgeToken,
                    },
                    body: JSON.stringify({
                      coordinate,
                      projectId,
                      routePath: input.routePath,
                      process: input.process,
                      step: input.step,
                      actor: input.actor,
                      state: input.state,
                      archetype: input.archetype,
                      status,
                      specSha256: checksum,
                      sourceActor: access.actorRef,
                      screenSpec,
                    }),
                  },
                );
                const publicationBody =
                  (await publishResponse.json()) as Record<string, unknown>;
                runtimePublication = {
                  ...publicationBody,
                  httpStatus: publishResponse.status,
                };
              } catch (error) {
                logger.error(
                  `Screen-space runtime publication failed for ${coordinate}: ${String(
                    error,
                  )}`,
                );
                runtimePublication = {
                  success: false,
                  status: 'PUBLISH_FAILED',
                };
              }
            }
          }
          const published = runtimePublication.success === true;
          response
            .status(status !== 'VERIFIED' ? 422 : published ? 201 : 502)
            .json({
              success: status === 'VERIFIED' && published,
              coordinate,
              status,
              specSha256: checksum,
              validation: { checks, missing },
              screenSpec,
              runtimePublication,
            });
        });
        router.get(
          '/design-assets/:projectId/access',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await resolveDesignAssetAccess(request, projectId);
            response.json({
              projectId,
              actorRef: access.actorRef,
              roles: access.roles,
              permissions: {
                canRequest: access.roles.includes('DESIGN_REQUESTER'),
                canReview: access.roles.includes('DESIGN_REVIEWER'),
                canApprove: access.roles.includes('DESIGN_APPROVER'),
                canAudit: access.roles.includes('DESIGN_AUDITOR'),
              },
            });
          },
        );
        router.get(
          '/design-assets/:projectId/audit',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            await requireDesignAssetRole(request, projectId, 'DESIGN_AUDITOR');
            const rows = await knex('resonance_projects__design_asset_audit')
              .where({ project_id: projectId })
              .orderBy('audit_id', 'desc')
              .limit(200);
            response.json({
              projectId,
              audit: rows.map(row => ({
                auditId: String(row.audit_id),
                actionCode: row.action_code,
                actorRef: row.actor_ref,
                details: row.details,
                createdAt: row.created_at,
              })),
            });
          },
        );
        router.get(
          '/:projectId/design-role-assignments',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            await requireDesignAssetRole(request, projectId, 'DESIGN_AUDITOR');
            const assignments = await knex(
              'resonance_projects__design_asset_role_assignment',
            )
              .where({ project_id: projectId, active: true })
              .select('principal_ref', 'role_code', 'created_at')
              .orderBy(['principal_ref', 'role_code']);
            response.json({
              projectId,
              assignments: assignments.map(row => ({
                principalRef: row.principal_ref,
                roleCode: row.role_code,
                createdAt: row.created_at,
              })),
            });
          },
        );
        router.put(
          '/:projectId/design-role-assignments',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            let assignments: ReturnType<
              typeof validateProjectDesignRoleAssignments
            >;
            try {
              assignments = validateProjectDesignRoleAssignments(
                request.body?.assignments,
              );
            } catch (error) {
              response.status(422).json({
                success: false,
                message: error instanceof Error ? error.message : String(error),
              });
              return;
            }
            const now = new Date();
            const replaced = await knex.transaction(async transaction => {
              const authority = await transaction(
                'resonance_projects__design_asset_role_assignment',
              )
                .where({
                  project_id: projectId,
                  role_code: 'DESIGN_APPROVER',
                  active: true,
                })
                .whereIn('principal_ref', access.principals)
                .forUpdate()
                .first();
              if (!authority) return false;
              await transaction(
                'resonance_projects__design_asset_role_assignment',
              )
                .where({ project_id: projectId, active: true })
                .update({ active: false });
              for (const assignment of assignments) {
                await transaction(
                  'resonance_projects__design_asset_role_assignment',
                )
                  .insert({
                    project_id: projectId,
                    principal_ref: assignment.principalRef,
                    role_code: assignment.roleCode,
                    active: true,
                    created_at: now,
                  })
                  .onConflict(['project_id', 'principal_ref', 'role_code'])
                  .merge({ active: true });
              }
              await transaction(
                'resonance_projects__design_asset_audit',
              ).insert({
                project_id: projectId,
                draft_id: null,
                action_code: 'DESIGN_ROLE_ASSIGNMENTS_REPLACED',
                actor_ref: access.actorRef,
                details: JSON.stringify({
                  assignmentCount: assignments.length,
                }),
                created_at: now,
              });
              return true;
            });
            if (!replaced) {
              response.status(403).json({
                success: false,
                message: 'DESIGN_APPROVER authority changed; retry is denied',
              });
              return;
            }
            response.json({
              success: true,
              projectId,
              assignmentCount: assignments.length,
            });
          },
        );
        router.get('/control-assets/:projectId', async (request, response) => {
          const projectId = normalizeProjectId(request.params.projectId);
          const rows = await knex('resonance_projects__control_asset_migration')
            .select('*')
            .where({ project_id: projectId })
            .orderBy('route_path', 'asc');
          response.json({
            projectId,
            assets: rows.map(row => ({
              assetId: row.asset_id,
              routePath: row.route_path,
              screenName: row.screen_name,
              ownershipLane: row.ownership_lane,
              migrationStatus: row.migration_status,
              targetPlugin: row.target_plugin,
              capabilities: row.capabilities,
              dependencyContracts: row.dependency_contracts,
              verificationEvidence: row.verification_evidence,
              updatedAt: row.updated_at,
            })),
          });
        });
        router.post(
          '/control-assets/:projectId/sync',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const project = await knex('resonance_projects__project')
              .where({ project_id: projectId })
              .first();
            if (!project) {
              response.status(404).json({ message: 'project not found' });
              return;
            }
            const assets = Array.isArray(request.body?.assets)
              ? (request.body.assets as ControlAssetInput[])
              : [];
            const lanes = new Set([
              'BACKSTAGE_NATIVE',
              'RESONANCE_RUNTIME',
              'SHARED_RUNTIME',
            ]);
            const statuses = new Set([
              'DISCOVERED',
              'CLASSIFIED',
              'NATIVE_READY',
              'MIGRATED',
              'VERIFIED',
              'RETIRED_SOURCE',
            ]);
            const normalized = assets.map((asset, index) => {
              const assetId = String(asset.assetId ?? '').trim();
              const routePath = String(asset.routePath ?? '').trim();
              const ownershipLane = String(asset.ownershipLane ?? '');
              const migrationStatus = String(asset.migrationStatus ?? '');
              if (
                !assetId ||
                !routePath.startsWith('/') ||
                !lanes.has(ownershipLane) ||
                !statuses.has(migrationStatus)
              ) {
                throw new Error(`invalid control asset at index ${index}`);
              }
              return {
                project_id: projectId,
                asset_id: assetId,
                route_path: routePath,
                screen_name: String(asset.screenName ?? routePath),
                ownership_lane: ownershipLane,
                migration_status: migrationStatus,
                target_plugin: String(asset.targetPlugin ?? ''),
                capabilities: JSON.stringify(asset.capabilities ?? []),
                dependency_contracts: JSON.stringify(
                  asset.dependencyContracts ?? [],
                ),
              };
            });
            if (
              new Set(normalized.map(asset => asset.asset_id)).size !==
              normalized.length
            ) {
              response.status(400).json({ message: 'duplicate asset ids' });
              return;
            }
            const now = new Date();
            await knex.transaction(async transaction => {
              for (const asset of normalized) {
                const existing = await transaction(
                  'resonance_projects__control_asset_migration',
                )
                  .select('migration_status')
                  .where({
                    project_id: projectId,
                    asset_id: asset.asset_id,
                  })
                  .first();
                const migrationStatus =
                  existing &&
                  ['DISCOVERED', 'CLASSIFIED'].includes(
                    existing.migration_status,
                  ) &&
                  asset.migration_status === 'NATIVE_READY'
                    ? 'NATIVE_READY'
                    : existing?.migration_status ?? asset.migration_status;
                await transaction('resonance_projects__control_asset_migration')
                  .insert({
                    ...asset,
                    migration_status: migrationStatus,
                    created_at: now,
                    updated_at: now,
                  })
                  .onConflict(['project_id', 'asset_id'])
                  .merge({
                    route_path: asset.route_path,
                    screen_name: asset.screen_name,
                    ownership_lane: asset.ownership_lane,
                    migration_status: migrationStatus,
                    target_plugin: asset.target_plugin,
                    capabilities: asset.capabilities,
                    dependency_contracts: asset.dependency_contracts,
                    updated_at: now,
                  });
              }
              await transaction(
                'resonance_projects__design_asset_audit',
              ).insert({
                project_id: projectId,
                action_code: 'CONTROL_ASSETS_SYNCHRONIZED',
                actor_ref: access.actorRef,
                details: JSON.stringify({ assetCount: normalized.length }),
                created_at: now,
              });
            });
            const summary = (await knex(
              'resonance_projects__control_asset_migration',
            )
              .select('ownership_lane', 'migration_status')
              .count({ count: '*' })
              .where({ project_id: projectId })
              .groupBy('ownership_lane', 'migration_status')) as {
              ownership_lane: string;
              migration_status: string;
              count: string | number;
            }[];
            response.json({
              projectId,
              synchronized: normalized.length,
              actorRef: access.actorRef,
              summary: summary.map(row => ({
                ownershipLane: row.ownership_lane,
                migrationStatus: row.migration_status,
                count: Number(row.count),
              })),
            });
          },
        );
        router.get('/design-assets/:projectId', async (request, response) => {
          const projectId = normalizeProjectId(request.params.projectId);
          const assetType = String(request.query.assetType ?? '')
            .trim()
            .toUpperCase();
          const search = String(request.query.search ?? '').trim();
          const limit = Math.max(
            1,
            Math.min(Number(request.query.limit ?? 100), 500),
          );
          const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
          if (!bridgeToken) {
            response
              .status(503)
              .json({ message: 'control-plane bridge token is missing' });
            return;
          }
          const runtimeBaseUrl = String(
            process.env.CARBONET_RUNTIME_BASE_URL ??
              'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
          ).replace(/\/+$/, '');
          const parameters = new URLSearchParams({
            assetType,
            search,
            limit: String(limit),
          });
          const runtimeResponse = await fetch(
            `${runtimeBaseUrl}/api/internal/actor-process/design-assets/source-heads?${parameters}`,
            {
              headers: {
                accept: 'application/json',
                'X-Resonance-Token': bridgeToken,
              },
            },
          );
          const runtimePayload = (await runtimeResponse.json()) as {
            assets?: DesignAssetSnapshot[];
            message?: string;
          };
          if (!runtimeResponse.ok) {
            response.status(runtimeResponse.status).json(runtimePayload);
            return;
          }
          const assets = Array.isArray(runtimePayload.assets)
            ? runtimePayload.assets
            : [];
          const counts = assets
            .filter(asset => asset.active)
            .reduce<Record<string, number>>((index, asset) => {
              index[asset.assetType] = (index[asset.assetType] ?? 0) + 1;
              return index;
            }, {});
          response.json({
            projectId,
            authority: 'RUNTIME_GLOBAL_SOURCE_HEAD',
            counts,
            assets,
          });
        });
        const retiredDesignAssetMutation = (
          _request: Request,
          response: Response,
        ) => {
          response.status(410).json({
            status: 'RETIRED',
            activationPolicy: 'SOURCE_IMMEDIATE_V1',
            replacement: '/design-assets/:projectId/source',
            message:
              'This mutation API is retired; approved source changes are applied immediately.',
          });
        };
        router.post(
          '/design-assets/:projectId/sync',
          retiredDesignAssetMutation,
        );
        router.post(
          '/design-assets/:projectId/source',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const requestedType = String(request.body?.assetType ?? '')
              .trim()
              .toUpperCase();
            const requestedId = String(request.body?.assetId ?? '').trim();
            const pendingSnapshotSync = await knex(
              'resonance_projects__design_asset_source_sync',
            )
              .where({ asset_type: requestedType, asset_id: requestedId })
              .whereIn('sync_status', ['PREPARED', 'PENDING', 'RUNNING'])
              .orderBy('created_at', 'asc')
              .first();
            if (pendingSnapshotSync) {
              response.status(409).json({
                success: false,
                sourceCommitted: false,
                controlPlaneSnapshot: 'SYNC_REQUIRED',
                syncReceiptId: String(pendingSnapshotSync.sync_id),
                retryAttempt: Number(pendingSnapshotSync.retry_attempt ?? 0),
                retryNotBefore: pendingSnapshotSync.next_attempt_at,
                message:
                  'an earlier runtime source commit is still synchronizing this global design asset',
              });
              return;
            }
            let committedReceipt: Record<string, unknown> | undefined;
            let committedMutation: Record<string, unknown> | undefined;
            let committedSnapshotBaseFingerprint: string | undefined;
            let preparedSync:
              | {
                  syncId: string;
                  claimToken: string;
                  retryNotBefore: Date;
                }
              | undefined;
            try {
              const result = await knex.transaction(async transaction => {
                await transaction.raw(
                  'select pg_advisory_xact_lock(hashtextextended(?,0))',
                  [
                    `BACKSTAGE_COMMON_DESIGN_SOURCE_V1:${requestedType}:${requestedId}`,
                  ],
                );
                const activeSync = await transaction(
                  'resonance_projects__design_asset_source_sync',
                )
                  .where({ asset_type: requestedType, asset_id: requestedId })
                  .whereIn('sync_status', [
                    'PREPARED',
                    'PENDING',
                    'RUNNING',
                  ])
                  .orderBy('created_at', 'asc')
                  .first();
                if (activeSync) {
                  return {
                    status: 409,
                    body: {
                      success: false,
                      sourceCommitted: false,
                      controlPlaneSnapshot: 'SYNC_REQUIRED',
                      syncReceiptId: String(activeSync.sync_id),
                      retryAttempt: Number(activeSync.retry_attempt ?? 0),
                      retryNotBefore:
                        activeSync.lease_expires_at ??
                        activeSync.next_attempt_at,
                      message:
                        'an earlier runtime source commit is still synchronizing this global design asset',
                    },
                  };
                }
                let headResponse: globalThis.Response;
                let headPayload: {
                  assets?: DesignAssetSnapshot[];
                  message?: string;
                };
                try {
                  const headParameters = new URLSearchParams({
                    assetType: requestedType,
                    assetId: requestedId,
                    limit: '1',
                  });
                  headResponse = await fetch(
                    `${runtimeBaseUrl}/api/internal/actor-process/design-assets/source-heads?${headParameters}`,
                    {
                      signal: AbortSignal.timeout(
                        RUNTIME_DESIGN_SOURCE_TIMEOUT_MS,
                      ),
                      headers: {
                        accept: 'application/json',
                        'x-resonance-token': bridgeToken,
                      },
                    },
                  );
                  headPayload = (await headResponse.json()) as {
                    assets?: DesignAssetSnapshot[];
                    message?: string;
                  };
                } catch (error) {
                  return {
                    status: 502,
                    body: {
                      message:
                        error instanceof Error
                          ? error.message
                          : 'runtime design source head is unavailable',
                      sourceCommitted: false,
                      jobCount: 0,
                    },
                  };
                }
                if (!headResponse.ok) {
                  return { status: headResponse.status, body: headPayload };
                }
                const current = headPayload.assets?.[0];
                if (
                  !current ||
                  current.assetType !== requestedType ||
                  current.assetId !== requestedId
                ) {
                  return {
                    status: 404,
                    body: { message: 'design asset source head not found' },
                  };
                }
                const requestedBaseFingerprint = String(
                  request.body?.baseFingerprint ?? '',
                ).toLowerCase();
                if (requestedBaseFingerprint !== current.fingerprint) {
                  return {
                    status: 409,
                    body: {
                      message:
                        'source fingerprint changed; refresh before editing',
                      sourceCommitted: false,
                      jobCount: 0,
                      current,
                    },
                  };
                }
                committedSnapshotBaseFingerprint = current.fingerprint;
                let mutation;
                try {
                  mutation = buildSourceDesignAssetMutation(
                    current,
                    request.body,
                  );
                } catch (error) {
                  return {
                    status: 422,
                    body: {
                      message:
                        error instanceof Error
                          ? error.message
                          : 'invalid source design mutation',
                      sourceCommitted: false,
                      jobCount: 0,
                    },
                  };
                }
                committedMutation = { ...mutation };
                preparedSync = await queueDesignSnapshotSync({
                  projectId,
                  mutation: committedMutation,
                  actorRef: access.actorRef,
                  snapshotBaseFingerprint:
                    committedSnapshotBaseFingerprint,
                });
                let runtimeResponse: globalThis.Response;
                try {
                  runtimeResponse = await fetch(
                    `${runtimeBaseUrl}/api/internal/actor-process/design-assets/source`,
                    {
                      method: 'POST',
                      signal: AbortSignal.timeout(
                        RUNTIME_DESIGN_SOURCE_TIMEOUT_MS,
                      ),
                      headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        'x-resonance-token': bridgeToken,
                        'x-resonance-actor': access.actorRef,
                      },
                      body: JSON.stringify({ projectId, ...mutation }),
                    },
                  );
                } catch (error) {
                  throw new Error(
                    `RUNTIME_SOURCE_COMMIT_UNKNOWN: ${
                      error instanceof Error
                        ? error.message
                        : 'runtime design source is unavailable'
                    }`,
                  );
                }
                const runtimeText = await runtimeResponse.text();
                let receipt: Record<string, unknown>;
                try {
                  receipt = JSON.parse(runtimeText) as Record<string, unknown>;
                } catch {
                  receipt = {
                    message:
                      runtimeText || 'runtime returned an invalid receipt',
                  };
                }
                if (receipt.sourceCommitted !== true) {
                  if (receipt.sourceCommitted !== false || !preparedSync) {
                    throw new Error(
                      String(
                        receipt.message ?? 'RUNTIME_SOURCE_COMMIT_UNKNOWN',
                      ),
                    );
                  }
                  const cancelled = await cancelPreparedDesignSnapshotSync(
                    preparedSync,
                    String(receipt.message ?? 'runtime source rejected'),
                  );
                  if (!cancelled) {
                    throw new Error(
                      'DESIGN_SOURCE_PREPARED_RECEIPT_CANCEL_FENCE_LOST',
                    );
                  }
                  preparedSync = undefined;
                  return {
                    status: runtimeResponse.ok ? 502 : runtimeResponse.status,
                    body: {
                      ...receipt,
                      sourceCommitted: false,
                      jobCount: Number(receipt.jobCount ?? 0),
                    },
                  };
                }
                committedReceipt = receipt;
                const now = new Date();
                const synchronizedProjectCount =
                  await synchronizeGlobalDesignAssetSnapshots(
                    transaction,
                    mutation,
                    now,
                  );
                await transaction(
                  'resonance_projects__design_asset_audit',
                ).insert({
                  project_id: projectId,
                  action_code:
                    receipt.status === 'REVIEW_REQUIRED'
                      ? 'SOURCE_IMMEDIATE_REVIEW_REQUIRED'
                      : 'SOURCE_IMMEDIATE_APPLIED',
                  actor_ref: access.actorRef,
                  details: JSON.stringify(receipt),
                  created_at: now,
                });
                if (!preparedSync) {
                  throw new Error('DESIGN_SOURCE_PREPARED_RECEIPT_REQUIRED');
                }
                const synchronizedReceipt = await transaction(
                  'resonance_projects__design_asset_source_sync',
                )
                  .where({
                    sync_id: preparedSync.syncId,
                    sync_status: 'PREPARED',
                    claim_token: preparedSync.claimToken,
                  })
                  .update({
                    runtime_receipt: JSON.stringify(receipt),
                    sync_status: 'SYNCHRONIZED',
                    next_attempt_at: now,
                    claim_token: null,
                    lease_expires_at: null,
                    last_error: null,
                    updated_at: now,
                    synchronized_at: now,
                  });
                if (synchronizedReceipt !== 1) {
                  throw new Error(
                    'DESIGN_SOURCE_PREPARED_RECEIPT_COMMIT_FENCE_LOST',
                  );
                }
                return {
                  status: runtimeResponse.status,
                  body: {
                    ...receipt,
                    controlPlaneSnapshot: 'SYNCHRONIZED',
                    snapshotFingerprint: mutation.assetFingerprint,
                    synchronizedProjectCount,
                    syncReceiptId: preparedSync.syncId,
                  },
                };
              });
              response.status(result.status).json(result.body);
            } catch (error) {
              if (preparedSync && committedMutation) {
                response.status(202).json({
                  ...(committedReceipt ?? {}),
                  success: false,
                  sourceCommitState:
                    committedReceipt?.sourceCommitted === true
                      ? 'COMMITTED'
                      : 'UNKNOWN',
                  controlPlaneSnapshot: 'SYNC_REQUIRED',
                  syncReceiptId: preparedSync.syncId,
                  retryAttempt: 0,
                  retryNotBefore: preparedSync.retryNotBefore,
                  message:
                    committedReceipt?.sourceCommitted === true
                      ? 'runtime source committed; automatic control-plane snapshot synchronization is pending'
                      : 'runtime source commit state is unknown; automatic idempotent reconciliation is pending',
                });
                return;
              }
              response.status(500).json({
                message:
                  error instanceof Error
                    ? error.message
                    : 'source design mutation failed',
                sourceCommitted: false,
                jobCount: 0,
              });
            }
          },
        );
        router.get(
          '/design-assets/:projectId/source-sync/:syncId',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await resolveDesignAssetAccess(request, projectId);
            if (
              !access.roles.some(role =>
                ['DESIGN_APPROVER', 'DESIGN_AUDITOR'].includes(role),
              )
            ) {
              response.status(403).json({
                success: false,
                message:
                  'missing required role: DESIGN_APPROVER or DESIGN_AUDITOR',
              });
              return;
            }
            const syncId = String(request.params.syncId ?? '').toLowerCase();
            if (!/^[0-9a-f]{64}$/.test(syncId)) {
              response.status(400).json({
                success: false,
                message: 'invalid source synchronization receipt id',
              });
              return;
            }
            const sync = await knex(
              'resonance_projects__design_asset_source_sync',
            )
              .where({ project_id: projectId, sync_id: syncId })
              .first();
            if (!sync) {
              response.status(404).json({
                success: false,
                message: 'source synchronization receipt not found',
              });
              return;
            }
            const synchronized = sync.sync_status === 'SYNCHRONIZED';
            response.json({
              success: synchronized,
              syncReceiptId: syncId,
              status: String(sync.sync_status),
              controlPlaneSnapshot: synchronized
                ? 'SYNCHRONIZED'
                : 'SYNC_REQUIRED',
              snapshotFingerprint: synchronized
                ? String(sync.asset_fingerprint)
                : undefined,
              retryAttempt: Number(sync.retry_attempt ?? 0),
              retryNotBefore: sync.next_attempt_at,
              message: sync.last_error ?? undefined,
              synchronizedAt: sync.synchronized_at,
            });
          },
        );
        router.get(
          '/design-assets/:projectId/drafts',
          retiredDesignAssetMutation,
        );
        router.post(
          '/design-assets/:projectId/drafts',
          retiredDesignAssetMutation,
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/validate',
          retiredDesignAssetMutation,
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/promote',
          retiredDesignAssetMutation,
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/rollback',
          retiredDesignAssetMutation,
        );
        router.post(
          '/control-assets/:projectId/transition',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const assetId = String(request.body?.assetId ?? '').trim();
            const nextStatus = String(request.body?.nextStatus ?? '').trim();
            const evidence =
              request.body?.evidence &&
              typeof request.body.evidence === 'object'
                ? request.body.evidence
                : {};
            const asset = await knex(
              'resonance_projects__control_asset_migration',
            )
              .where({ project_id: projectId, asset_id: assetId })
              .first();
            if (!asset) {
              response.status(404).json({ message: 'control asset not found' });
              return;
            }
            if (asset.ownership_lane !== 'BACKSTAGE_NATIVE') {
              response.status(409).json({
                message: 'only Backstage native assets can be transitioned',
              });
              return;
            }
            const transitions: Record<string, string[]> = {
              CLASSIFIED: ['NATIVE_READY'],
              NATIVE_READY: ['MIGRATED'],
              MIGRATED: ['VERIFIED'],
              VERIFIED: ['RETIRED_SOURCE'],
              RETIRED_SOURCE: [],
            };
            if (
              !(transitions[asset.migration_status] ?? []).includes(nextStatus)
            ) {
              response.status(409).json({
                message: `invalid transition: ${asset.migration_status} -> ${nextStatus}`,
              });
              return;
            }
            const targetUrl = String(evidence.targetUrl ?? '');
            const testStatus = String(evidence.testStatus ?? '');
            const verifiedBy = String(evidence.verifiedBy ?? '');
            const backstageTargets = [
              '/resonance-',
              '/actor-process-control',
              '/design-assets',
              '/identity-administration',
              '/ccus-screen-designs',
              '/ccus-screen-space',
              '/system-',
              '/migration-cutover',
            ];
            if (
              ['MIGRATED', 'VERIFIED', 'RETIRED_SOURCE'].includes(nextStatus) &&
              !backstageTargets.some(prefix => targetUrl.startsWith(prefix))
            ) {
              response.status(400).json({
                message: 'a Backstage targetUrl is required',
              });
              return;
            }
            if (
              ['VERIFIED', 'RETIRED_SOURCE'].includes(nextStatus) &&
              (testStatus !== 'PASS' || !verifiedBy)
            ) {
              response.status(400).json({
                message: 'PASS evidence and verifiedBy are required',
              });
              return;
            }
            const now = new Date();
            await knex.transaction(async transaction => {
              const updated = await transaction(
                'resonance_projects__control_asset_migration',
              )
                .where({
                  project_id: projectId,
                  asset_id: assetId,
                  migration_status: asset.migration_status,
                })
                .update({
                  migration_status: nextStatus,
                  verification_evidence: JSON.stringify(evidence),
                  updated_at: now,
                });
              if (updated !== 1) {
                throw new Error(
                  'control asset transition changed concurrently',
                );
              }
              await transaction(
                'resonance_projects__design_asset_audit',
              ).insert({
                project_id: projectId,
                action_code: 'CONTROL_ASSET_TRANSITIONED',
                actor_ref: access.actorRef,
                details: JSON.stringify({
                  assetId,
                  previousStatus: asset.migration_status,
                  nextStatus,
                }),
                created_at: now,
              });
            });
            response.json({
              projectId,
              assetId,
              previousStatus: asset.migration_status,
              migrationStatus: nextStatus,
              verificationEvidence: evidence,
              actorRef: access.actorRef,
              updatedAt: now,
            });
          },
        );
        router.post(
          '/control-assets/:projectId/verify-native',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const targets: { assetId?: unknown; targetUrl?: unknown }[] =
              Array.isArray(request.body?.targets) ? request.body.targets : [];
            const evidence =
              request.body?.evidence &&
              typeof request.body.evidence === 'object'
                ? request.body.evidence
                : {};
            const targetUrls = new Set<string>(
              targets
                .map((target: { targetUrl?: unknown }) =>
                  String(target.targetUrl ?? '').trim(),
                )
                .filter(Boolean),
            );
            const assetIds: string[] = targets.map(target =>
              String(target.assetId ?? '').trim(),
            );
            const allowedTargetPrefixes = [
              '/resonance-',
              '/actor-process-',
              '/design-assets',
              '/ccus-screen-designs',
              '/ccus-screen-space',
              '/system-',
            ];
            if (
              !assetIds.length ||
              assetIds.some(assetId => !assetId) ||
              new Set(assetIds).size !== assetIds.length ||
              [...targetUrls].some(
                targetUrl =>
                  !allowedTargetPrefixes.some(prefix =>
                    targetUrl.startsWith(prefix),
                  ),
              ) ||
              String(evidence.testStatus ?? '') !== 'PASS' ||
              !String(evidence.verifiedBy ?? '').trim()
            ) {
              response.status(400).json({
                message:
                  'unique assets, allowed target URLs and PASS evidence are required',
              });
              return;
            }

            const now = new Date();
            const verified = await knex.transaction(async transaction => {
              const assets = await transaction(
                'resonance_projects__control_asset_migration',
              )
                .select('*')
                .where({ project_id: projectId })
                .whereIn('asset_id', assetIds)
                .forUpdate();
              if (assets.length !== assetIds.length) {
                throw new Error('one or more control assets were not found');
              }
              const invalid = assets.filter(
                asset =>
                  asset.ownership_lane !== 'BACKSTAGE_NATIVE' ||
                  !['NATIVE_READY', 'MIGRATED', 'VERIFIED'].includes(
                    asset.migration_status,
                  ),
              );
              if (invalid.length) {
                throw new Error(
                  `assets are not native-ready: ${invalid
                    .map(asset => asset.asset_id)
                    .join(', ')}`,
                );
              }

              for (const target of targets) {
                const assetId = String(target.assetId).trim();
                const targetUrl = String(target.targetUrl).trim();
                await transaction('resonance_projects__control_asset_migration')
                  .where({ project_id: projectId, asset_id: assetId })
                  .update({
                    migration_status: 'VERIFIED',
                    verification_evidence: JSON.stringify({
                      ...evidence,
                      targetUrl,
                      assetId,
                      verifiedAt: now.toISOString(),
                    }),
                    updated_at: now,
                  });
              }
              await transaction(
                'resonance_projects__design_asset_audit',
              ).insert({
                project_id: projectId,
                action_code: 'CONTROL_ASSETS_NATIVE_VERIFIED',
                actor_ref: access.actorRef,
                details: JSON.stringify({ assetIds, evidence }),
                created_at: now,
              });
              return assets.length;
            });

            response.json({
              projectId,
              verified,
              targetCount: targetUrls.size,
              migrationStatus: 'VERIFIED',
              actorRef: access.actorRef,
              updatedAt: now,
            });
          },
        );
        router.post(
          '/control-assets/:projectId/retire-source',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const runtimeIdentity = await resolveRuntimeAccount(request);
            const assetIds = Array.isArray(request.body?.assetIds)
              ? request.body.assetIds.map((value: unknown) =>
                  String(value).trim(),
                )
              : [];
            if (
              !assetIds.length ||
              assetIds.some((assetId: string) => !assetId) ||
              new Set(assetIds).size !== assetIds.length
            ) {
              response
                .status(400)
                .json({ message: 'unique assetIds required' });
              return;
            }
            const assets = await knex(
              'resonance_projects__control_asset_migration',
            )
              .select('*')
              .where({ project_id: projectId })
              .whereIn('asset_id', assetIds);
            if (
              assets.length !== assetIds.length ||
              assets.some(
                asset =>
                  asset.ownership_lane !== 'BACKSTAGE_NATIVE' ||
                  !['VERIFIED', 'RETIRED_SOURCE'].includes(
                    asset.migration_status,
                  ),
              )
            ) {
              response.status(409).json({
                message: 'all assets must be verified Backstage native assets',
              });
              return;
            }

            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response
                .status(503)
                .json({ message: 'control-plane bridge token is missing' });
              return;
            }
            const sourceRoutes = [
              ...new Set(assets.map(asset => String(asset.route_path).trim())),
            ];
            const bridgeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/control-assets/cutover`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-actor': runtimeIdentity.userEntityRef,
                  'x-resonance-account': runtimeIdentity.accountId,
                },
                body: JSON.stringify({
                  projectId,
                  action: 'RETIRE',
                  sourceRoutes,
                  requestedBy: runtimeIdentity.userEntityRef,
                }),
              },
            );
            const bridgeResult = (await bridgeResponse.json()) as Record<
              string,
              unknown
            >;
            if (!bridgeResponse.ok || bridgeResult.success !== true) {
              response.status(502).json({
                message: 'Resonance menu cutover failed',
                bridgeResult,
              });
              return;
            }

            const now = new Date();
            await knex.transaction(async transaction => {
              for (const asset of assets) {
                const previousEvidence =
                  asset.verification_evidence &&
                  typeof asset.verification_evidence === 'object'
                    ? asset.verification_evidence
                    : {};
                await transaction('resonance_projects__control_asset_migration')
                  .where({
                    project_id: projectId,
                    asset_id: asset.asset_id,
                  })
                  .update({
                    migration_status: 'RETIRED_SOURCE',
                    verification_evidence: JSON.stringify({
                      ...previousEvidence,
                      cutover: bridgeResult,
                      retiredAt: now.toISOString(),
                    }),
                    updated_at: now,
                  });
              }
              await transaction(
                'resonance_projects__design_asset_audit',
              ).insert({
                project_id: projectId,
                action_code: 'CONTROL_ASSET_SOURCE_RETIRED',
                actor_ref: access.actorRef,
                details: JSON.stringify({
                  assetIds,
                  sourceRoutes,
                  runtimeAccount: runtimeIdentity.accountId,
                  runtimeActor: runtimeIdentity.userEntityRef,
                }),
                created_at: now,
              });
            });
            response.json({
              projectId,
              retired: assets.length,
              sourceRoutes: sourceRoutes.length,
              bridgeResult,
              migrationStatus: 'RETIRED_SOURCE',
              reversible: true,
              actorRef: access.actorRef,
            });
          },
        );
        router.get('/', async (_request, response) => {
          const rows = await knex('resonance_projects__project')
            .select('*')
            .orderBy('created_at', 'asc');
          const tasks = await knex('resonance_projects__task')
            .select('*')
            .whereIn(
              'project_id',
              rows.map(row => row.project_id),
            )
            .orderBy('task_id', 'desc');
          response.json({
            projects: rows.map(row => ({
              projectId: row.project_id,
              projectName: row.project_name,
              description: row.description,
              owner: row.owner,
              sourceRepository: row.source_repository,
              databaseMode: row.database_mode,
              runtimeMode: row.runtime_mode,
              status: row.status,
              designVersion: row.design_version,
              createdAt: row.created_at,
              tasks: tasks
                .filter(task => task.project_id === row.project_id)
                .map(task => ({
                  taskId: String(task.task_id),
                  taskType: task.task_type,
                  status: task.status,
                  errorMessage: task.error_message,
                  result: task.result,
                  attemptCount: task.attempt_count,
                  startedAt: task.started_at,
                  finishedAt: task.finished_at,
                })),
            })),
          });
        });
        router.get('/:projectId', async (request, response) => {
          const projectId = normalizeProjectId(request.params.projectId);
          const project = await knex('resonance_projects__project')
            .where({ project_id: projectId })
            .first();
          if (!project) {
            response.status(404).json({ message: 'Project not found' });
            return;
          }
          const tasks = await knex('resonance_projects__task')
            .where({ project_id: projectId })
            .orderBy('task_id', 'asc');
          response.json({ project, tasks });
        });
        router.get('/:projectId/design-releases', async (request, response) => {
          const projectId = normalizeProjectId(request.params.projectId);
          const releases = await knex('resonance_projects__design_release')
            .where({ project_id: projectId })
            .select(
              'release_id',
              'design_version',
              'release_status',
              'contract_sha256',
              'validation_report',
              'created_by',
              'created_at',
              'updated_at',
              'promoted_at',
            )
            .orderBy('design_version', 'desc');
          response.json({
            projectId,
            releases: releases.map(release => ({
              releaseId: String(release.release_id),
              designVersion: release.design_version,
              status: release.release_status,
              contractSha256: release.contract_sha256,
              validationReport: release.validation_report,
              createdBy: release.created_by,
              createdAt: release.created_at,
              updatedAt: release.updated_at,
              promotedAt: release.promoted_at,
            })),
          });
        });
        router.get('/:projectId/requirements', async (request, response) => {
          const projectId = normalizeProjectId(request.params.projectId);
          const documents = await knex(
            'resonance_projects__requirement_document',
          )
            .where({ project_id: projectId })
            .select(
              'document_id',
              'file_name',
              'mime_type',
              'byte_size',
              'document_sha256',
              'identity_key',
              'content_fingerprint',
              'analysis_status',
              'requirement_count',
              'design_version',
              'process_code',
              'created_by',
              'created_at',
              'publication_reconcile_status',
              'publication_poll_attempt_count',
              'publication_next_attempt_at',
              'publication_last_error',
            )
            .orderBy('created_at', 'desc');
          response.json({
            projectId,
            documents: documents.map(document => ({
              documentId: document.document_id,
              fileName: document.file_name,
              mimeType: document.mime_type,
              byteSize: Number(document.byte_size),
              documentSha256: document.document_sha256,
              identityKey: document.identity_key,
              contentFingerprint: document.content_fingerprint,
              status: document.analysis_status,
              requirementCount: document.requirement_count,
              designVersion: document.design_version,
              processCode: document.process_code,
              createdBy: document.created_by,
              createdAt: document.created_at,
              reconciliationStatus: document.publication_reconcile_status,
              pollAttempt: Number(document.publication_poll_attempt_count ?? 0),
              retryNotBefore: document.publication_next_attempt_at,
              lastError: document.publication_last_error,
            })),
          });
        });
        router.post(
          '/:projectId/requirements/:documentId/publication/reconcile',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const documentId = String(request.params.documentId ?? '').trim();
            const designAccess = await resolveDesignAssetAccess(
              request,
              projectId,
            );
            if (!designAccess.roles.includes('DESIGN_APPROVER')) {
              response.status(403).json({
                success: false,
                message: 'missing required role: DESIGN_APPROVER',
              });
              return;
            }
            const document = await knex(
              'resonance_projects__requirement_document',
            )
              .where({ project_id: projectId, document_id: documentId })
              .first();
            if (!document) {
              response.status(404).json({
                success: false,
                message: 'Requirement document not found',
              });
              return;
            }
            const release = await knex('resonance_projects__design_release')
              .where({
                project_id: projectId,
                design_version: Number(document.design_version),
              })
              .first();
            if (!release) {
              response.status(409).json({
                success: false,
                message: 'Requirement document has no matching design release',
              });
              return;
            }
            try {
              const result = await reconcileRequirementPublicationReceipt({
                state: {
                  analysisStatus: document.analysis_status,
                  releaseStatus: release.release_status,
                },
                readReceipt: async () => {
                  const bridgeToken = String(
                    process.env.RESONANCE_OPS_TOKEN ?? '',
                  );
                  if (!bridgeToken) {
                    throw new RequirementPublicationError(
                      {
                        success: false,
                        message: 'Runtime receipt token is unavailable',
                      },
                      503,
                    );
                  }
                  const runtimeBaseUrl = String(
                    process.env.CARBONET_RUNTIME_BASE_URL ??
                      'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
                  ).replace(/\/+$/, '');
                  let receiptResponse: globalThis.Response;
                  try {
                    receiptResponse = await fetch(
                      `${runtimeBaseUrl}/api/internal/actor-process/design-releases/${encodeURIComponent(
                        projectId,
                      )}/${Number(
                        document.design_version,
                      )}?contractSha256=${encodeURIComponent(
                        String(release.contract_sha256),
                      )}`,
                      {
                        headers: {
                          accept: 'application/json',
                          'x-resonance-token': bridgeToken,
                        },
                      },
                    );
                  } catch (error) {
                    throw new RequirementPublicationError({
                      success: false,
                      message: `Runtime receipt request failed: ${String(
                        error,
                      )}`,
                    });
                  }
                  let receipt: Record<string, unknown>;
                  try {
                    receipt = (await receiptResponse.json()) as Record<
                      string,
                      unknown
                    >;
                  } catch {
                    throw new RequirementPublicationError({
                      success: false,
                      message: 'Runtime receipt response is not valid JSON',
                    });
                  }
                  if (!receiptResponse.ok) {
                    throw new RequirementPublicationError(
                      {
                        ...receipt,
                        success: false,
                        message: String(
                          receipt.message ??
                            'Runtime receipt reconciliation failed',
                        ),
                      },
                      receiptResponse.status === 409 ? 409 : 502,
                    );
                  }
                  return receipt;
                },
                persistReceipt: (disposition, receipt) =>
                  persistRequirementPublicationReceipt({
                    projectId,
                    documentId,
                    designVersion: Number(document.design_version),
                    existingRevision: true,
                    disposition,
                    publication: receipt,
                  }),
              });
              response.json({
                success: true,
                reconciled: result.reconciled,
                terminal: ['APPLIED', 'FAILED', 'REVIEW_REQUIRED'].includes(
                  result.disposition,
                ),
                status:
                  result.disposition === 'QUEUED'
                    ? 'GENERATION_QUEUED'
                    : result.disposition,
                documentId,
                designVersion: Number(document.design_version),
                publication: result.receipt,
              });
            } catch (error) {
              if (error instanceof RequirementPublicationError) {
                response.status(error.statusCode).json({
                  success: false,
                  message: error.message,
                  publication: error.publication,
                });
                return;
              }
              throw error;
            }
          },
        );
        router.get(
          '/:projectId/requirements/:documentId',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const documentId = String(request.params.documentId);
            const document = await knex(
              'resonance_projects__requirement_document',
            )
              .where({ project_id: projectId, document_id: documentId })
              .first();
            if (!document) {
              response
                .status(404)
                .json({ message: 'Requirement document not found' });
              return;
            }
            const requirements = await knex(
              'resonance_projects__requirement_item',
            )
              .where({ project_id: projectId, document_id: documentId })
              .orderBy('sort_order', 'asc');
            response.json({ projectId, document, requirements });
          },
        );
        router.post(
          '/:projectId/requirements/automate',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            if (
              request.body &&
              Object.prototype.hasOwnProperty.call(request.body, 'autoPromote')
            ) {
              response.status(422).json({
                success: false,
                message:
                  'autoPromote is retired; SOURCE_IMMEDIATE_V1 is always active',
              });
              return;
            }
            const project = await knex('resonance_projects__project')
              .where({ project_id: projectId })
              .first();
            if (!project) {
              response.status(404).json({ message: 'Project not found' });
              return;
            }
            const designAccess = await resolveDesignAssetAccess(
              request,
              projectId,
            );
            if (!designAccess.roles.includes('DESIGN_APPROVER')) {
              response.status(403).json({
                success: false,
                message: 'missing required role: DESIGN_APPROVER',
              });
              return;
            }
            const account = await resolveRuntimeAccount(request);
            let document: ReturnType<typeof decodeRequirementDocument>;
            try {
              document = decodeRequirementDocument(
                (request.body ?? {}) as RequirementDocumentInput,
              );
            } catch (error) {
              response.status(422).json({
                success: false,
                message: error instanceof Error ? error.message : String(error),
              });
              return;
            }
            const persistence = await knex.transaction(async transaction => {
              const lockedProject = await transaction(
                'resonance_projects__project',
              )
                .where({ project_id: projectId })
                .forUpdate()
                .first();
              if (!lockedProject) {
                return { kind: 'PROJECT_MISSING' as const };
              }
              const analysis = analyzeRequirementText(
                projectId,
                document.fileName,
                document.text,
                document.identity,
              );
              const identityKey = analysis.identity.stableKey;
              const contentFingerprint = requirementContentFingerprint(
                document.documentSha256,
                document.textSha256,
              );
              const existing = await transaction(
                'resonance_projects__requirement_document',
              )
                .where({ project_id: projectId, identity_key: identityKey })
                .orderBy('design_version', 'desc')
                .first();
              if (
                sameRequirementRevision(
                  existing
                    ? {
                        identityKey: existing.identity_key,
                        contentFingerprint: existing.content_fingerprint,
                      }
                    : undefined,
                  identityKey,
                  contentFingerprint,
                )
              ) {
                const release = await transaction(
                  'resonance_projects__design_release',
                )
                  .where({
                    project_id: projectId,
                    design_version: existing.design_version,
                  })
                  .first();
                if (!release) {
                  throw new Error(
                    'Requirement document has no matching design release',
                  );
                }
                const storedContract =
                  typeof release.contract_payload === 'string'
                    ? JSON.parse(release.contract_payload)
                    : release.contract_payload;
                return {
                  kind: 'EXISTING' as const,
                  documentId: String(existing.document_id),
                  designVersion: Number(existing.design_version),
                  processCode: String(existing.process_code),
                  requirementCount: Number(existing.requirement_count),
                  analysisStatus: String(existing.analysis_status),
                  releaseStatus: String(release.release_status),
                  contractSha256: String(release.contract_sha256),
                  contract: storedContract as Record<string, unknown>,
                };
              }
              const [{ max }] = await transaction(
                'resonance_projects__design_release',
              )
                .where({ project_id: projectId })
                .max({ max: 'design_version' });
              const designVersion = nextRequirementDesignVersion(
                lockedProject.design_version,
                max,
              );
              const contract = buildRequirementDesignContract({
                projectId,
                designVersion,
                document,
                analysis,
              });
              const validation = validateDesignContract(projectId, contract);
              if (validation.status !== 'VERIFIED') {
                return { kind: 'INVALID' as const, validation };
              }
              const contractSha256 = requirementContractSha256(contract);
              const documentId = requirementDocumentId(
                projectId,
                identityKey,
                designVersion,
                contentFingerprint,
              );
              const now = new Date();
              await transaction(
                'resonance_projects__requirement_document',
              ).insert({
                document_id: documentId,
                project_id: projectId,
                file_name: document.fileName,
                mime_type: document.mimeType,
                byte_size: document.byteSize,
                document_sha256: document.documentSha256,
                text_sha256: document.textSha256,
                identity_key: identityKey,
                content_fingerprint: contentFingerprint,
                extracted_text: document.text,
                analysis_status: 'DESIGN_VALIDATED',
                requirement_count: analysis.requirements.length,
                design_version: designVersion,
                process_code: analysis.processCode,
                created_by: account.userEntityRef,
                created_at: now,
              });
              await transaction('resonance_projects__requirement_item').insert(
                analysis.requirements.map((item, index) => ({
                  requirement_id: requirementItemId(
                    projectId,
                    documentId,
                    item.requirementId,
                  ),
                  document_id: documentId,
                  project_id: projectId,
                  sort_order: index + 1,
                  title: item.title,
                  description: item.description,
                  actor_code: item.actorCode,
                  process_code: item.processCode,
                  step_code: item.stepCode,
                  route_path: item.routePath,
                  endpoint_method: item.endpoint.method,
                  endpoint_path: item.endpoint.path,
                  field_contract: JSON.stringify(item.fields),
                  acceptance_criteria: JSON.stringify(item.acceptanceCriteria),
                  implementation_status: 'DESIGN_VALIDATED',
                  created_at: now,
                })),
              );
              await transaction('resonance_projects__design_release').insert({
                project_id: projectId,
                design_version: designVersion,
                release_status: 'VALIDATED',
                contract_payload: JSON.stringify(contract),
                contract_sha256: contractSha256,
                validation_report: JSON.stringify(validation),
                created_by: account.userEntityRef,
                created_at: now,
                updated_at: now,
              });
              await transaction('resonance_projects__task').insert(
                [
                  ['REQUIREMENT_ANALYSIS', 'COMPLETED'],
                  ['DESIGN_GENERATION', 'COMPLETED'],
                  ['ENDPOINT_GENERATION', 'PLANNED'],
                  ['CONTRACT_TEST', 'PLANNED'],
                ].map(([taskType, status]) => ({
                  project_id: projectId,
                  task_type: taskType,
                  status,
                  payload: JSON.stringify({
                    documentId,
                    designVersion,
                    processCode: analysis.processCode,
                    requirementCount: analysis.requirements.length,
                    contractSha256,
                  }),
                  created_at: now,
                  updated_at: now,
                  finished_at: status === 'COMPLETED' ? now : null,
                })),
              );
              return {
                kind: 'CREATED' as const,
                documentId,
                designVersion,
                processCode: analysis.processCode,
                requirementCount: analysis.requirements.length,
                analysisStatus: 'DESIGN_VALIDATED',
                releaseStatus: 'VALIDATED',
                contractSha256,
                contract,
              };
            });
            if (persistence.kind === 'PROJECT_MISSING') {
              response.status(404).json({ message: 'Project not found' });
              return;
            }
            if (persistence.kind === 'INVALID') {
              response.status(422).json({
                success: false,
                message: 'Generated design contract failed validation',
                validation: persistence.validation,
              });
              return;
            }
            const sourceImmediate = true;
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            const publicationComplete = requirementPublicationComplete({
              analysisStatus: persistence.analysisStatus,
              releaseStatus: persistence.releaseStatus,
            });
            if (!publicationComplete && !bridgeToken) {
              response.status(503).json({
                success: false,
                projectId,
                documentId: persistence.documentId,
                designVersion: persistence.designVersion,
                message:
                  'Design is stored, but the runtime bridge token is missing',
              });
              return;
            }
            let publicationResult;
            try {
              publicationResult = await ensureRequirementPublication({
                sourceImmediate,
                refreshExisting:
                  persistence.kind === 'EXISTING' && Boolean(bridgeToken),
                state: {
                  analysisStatus: persistence.analysisStatus,
                  releaseStatus: persistence.releaseStatus,
                },
                publish: async () => {
                  const runtimeBaseUrl = String(
                    process.env.CARBONET_RUNTIME_BASE_URL ??
                      'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
                  ).replace(/\/+$/, '');
                  const publicationResponse = await fetch(
                    `${runtimeBaseUrl}/api/internal/actor-process/design-releases`,
                    {
                      method: 'POST',
                      headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        'x-resonance-token': bridgeToken,
                      },
                      body: JSON.stringify({
                        projectId,
                        designVersion: persistence.designVersion,
                        contractSha256: persistence.contractSha256,
                        contract: persistence.contract,
                      }),
                    },
                  );
                  const publication =
                    (await publicationResponse.json()) as Record<
                      string,
                      unknown
                    >;
                  return {
                    ok: publicationResponse.ok,
                    status: publicationResponse.status,
                    payload: publication,
                  };
                },
                recordPublication: (disposition, publication) =>
                  persistRequirementPublicationReceipt({
                    projectId,
                    documentId: persistence.documentId,
                    designVersion: persistence.designVersion,
                    existingRevision: persistence.kind === 'EXISTING',
                    disposition,
                    publication,
                  }),
              });
            } catch (error) {
              if (error instanceof RequirementPublicationError) {
                response.status(error.statusCode).json({
                  success: false,
                  projectId,
                  documentId: persistence.documentId,
                  designVersion: persistence.designVersion,
                  message: error.message,
                  publication: error.publication,
                });
                return;
              }
              throw error;
            }
            const finalDisposition =
              publicationResult.disposition ??
              requirementPublicationDisposition({
                analysisStatus: persistence.analysisStatus,
                releaseStatus: persistence.releaseStatus,
              });
            const terminalFailure = ['FAILED', 'REVIEW_REQUIRED'].includes(
              String(finalDisposition),
            );
            const responsePublication = publicationResult.publication as Record<
              string,
              unknown
            >;
            const responseGeneration =
              responsePublication.generation &&
              typeof responsePublication.generation === 'object'
                ? (responsePublication.generation as Record<string, unknown>)
                : {};
            const terminalMessage = terminalFailure
              ? String(
                  responseGeneration.message ??
                    responsePublication.message ??
                    finalDisposition,
                )
              : undefined;
            let responseStatus = 200;
            if (terminalFailure) responseStatus = 409;
            else if (finalDisposition !== 'APPLIED') responseStatus = 202;
            else if (persistence.kind === 'CREATED') responseStatus = 201;
            response.status(responseStatus).json({
              success: finalDisposition === 'APPLIED',
              message: terminalMessage,
              idempotent: persistence.kind === 'EXISTING',
              publicationRetried:
                persistence.kind === 'EXISTING' && publicationResult.attempted,
              projectId,
              documentId: persistence.documentId,
              designVersion: persistence.designVersion,
              processCode: persistence.processCode,
              requirementCount: persistence.requirementCount,
              screenCount: persistence.requirementCount,
              endpointCount: persistence.requirementCount,
              contractSha256: persistence.contractSha256,
              status:
                finalDisposition === 'APPLIED' ||
                ['APPLIED', 'GENERATION_APPLIED'].includes(
                  String(persistence.analysisStatus).toUpperCase(),
                ) ||
                String(persistence.releaseStatus).toUpperCase() === 'APPLIED'
                  ? 'APPLIED'
                  : finalDisposition === 'FAILED'
                  ? 'FAILED'
                  : finalDisposition === 'REVIEW_REQUIRED'
                  ? 'REVIEW_REQUIRED'
                  : publicationResult.completed
                  ? 'GENERATION_QUEUED'
                  : persistence.analysisStatus,
              publication: publicationResult.publication,
            });
          },
        );
        router.post(
          '/:projectId/design-releases',
          async (_request, response) => {
            response.status(410).json({
              success: false,
              message:
                'Legacy design release mutation is retired; use the structured SOURCE-immediate screen contract workflow.',
            });
          },
        );
        router.post(
          '/:projectId/design-releases/:designVersion/promote',
          async (_request, response) => {
            response.status(410).json({
              success: false,
              message:
                'Legacy design promotion is retired; SOURCE_IMMEDIATE_V1 applies structured contracts directly.',
            });
          },
        );
        router.get(
          '/:projectId/development-contract',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const preview = request.query.mode === 'preview';
            const query = knex('resonance_projects__design_release').where({
              project_id: projectId,
            });
            if (!preview) query.where('release_status', 'APPLIED');
            const release = await query
              .orderBy('design_version', 'desc')
              .first();
            if (!release) {
              response.status(404).json({
                message: preview
                  ? 'No design release exists'
                  : 'No SOURCE-immediate design release exists',
              });
              return;
            }
            const contract =
              typeof release.contract_payload === 'string'
                ? JSON.parse(release.contract_payload)
                : release.contract_payload;
            response.json({
              schemaVersion: 1,
              projectId,
              tenantId: contract.tenantId,
              designVersion: release.design_version,
              releaseStatus: release.release_status,
              contractSha256: release.contract_sha256,
              sourceOfTruth: 'BACKSTAGE',
              generator: {
                strategy: 'METADATA_FIRST',
                resonanceEndpoint:
                  '/admin/api/system/actor-process/generation/compile-and-queue',
              },
              contract,
            });
          },
        );
        router.post('/', async (request, response) => {
          const input = (request.body ?? {}) as ProjectInput;
          const projectId = normalizeProjectId(input.projectId);
          const projectName = String(input.projectName ?? '').trim();
          const owner = String(input.owner ?? '').trim();
          if (!/^[A-Z][A-Z0-9_-]{2,63}$/.test(projectId)) {
            response.status(400).json({
              message:
                'projectId must be 3-64 uppercase letters, numbers, _ or -',
            });
            return;
          }
          if (!projectName || !owner) {
            response
              .status(400)
              .json({ message: 'projectName and owner are required' });
            return;
          }
          const databaseMode = input.databaseMode ?? 'PROJECT_DB';
          const runtimeMode = input.runtimeMode ?? 'DEDICATED_PROJECT_RUNTIME';
          if (databaseMode !== 'PROJECT_DB') {
            response.status(400).json({
              message: 'databaseMode must be PROJECT_DB',
            });
            return;
          }
          if (runtimeMode !== 'DEDICATED_PROJECT_RUNTIME') {
            response.status(400).json({
              message: 'runtimeMode must be DEDICATED_PROJECT_RUNTIME',
            });
            return;
          }
          const ownerIdentity = await resolveAuthenticatedProjectIdentity(
            request,
          );
          const ownerAssignments = bootstrapProjectDesignRoles(
            ownerIdentity.principals,
          );
          const exists = await knex('resonance_projects__project')
            .where({ project_id: projectId })
            .first();
          if (exists) {
            response.status(409).json({ message: 'Project already exists' });
            return;
          }
          const now = new Date();
          await knex.transaction(async transaction => {
            await transaction('resonance_projects__project').insert({
              project_id: projectId,
              project_name: projectName,
              description: String(input.description ?? '').trim(),
              owner,
              source_repository: String(input.sourceRepository ?? '').trim(),
              database_mode: databaseMode,
              runtime_mode: runtimeMode,
              status: 'REGISTERED',
              design_version: 1,
              created_at: now,
              updated_at: now,
            });
            await transaction('resonance_projects__task').insert({
              project_id: projectId,
              task_type: 'PROJECT_BOOTSTRAP',
              status: 'PLANNED',
              payload: JSON.stringify({
                steps: [
                  'CREATE_MANIFEST',
                  'CREATE_SOURCE_STRUCTURE',
                  'BIND_DATABASE',
                  'REGISTER_CATALOG',
                  'CREATE_DESIGN_SPACE',
                  'VALIDATE_CONTRACTS',
                ],
              }),
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
            await transaction('resonance_projects__design_asset_audit').insert({
              project_id: projectId,
              draft_id: null,
              action_code: 'PROJECT_DESIGN_ROLES_BOOTSTRAPPED',
              actor_ref: ownerIdentity.actorRef,
              details: JSON.stringify({
                principalCount: ownerIdentity.principals.length,
                assignmentCount: ownerAssignments.length,
              }),
              created_at: now,
            });
          });
          logger.info(`Registered project ${projectId}`);
          const saved = await knex('resonance_projects__project')
            .where({ project_id: projectId })
            .first();
          response.status(201).json({
            success: true,
            project: saved,
            taskStatus: 'PLANNED',
            designRoleAssignmentCount: ownerAssignments.length,
          });
        });

        registerProjectLifecycleRoutes({
          router,
          knex,
          logger,
          resolveIdentity: resolveAuthenticatedProjectIdentity,
        });

        await scheduler.scheduleTask({
          id: 'resonance-projects-receipt-reconciliation-v1',
          frequency: { seconds: 15 },
          timeout: { seconds: 50 },
          initialDelay: { seconds: 2 },
          fn: async () => {
            const [requirements, designSnapshots] = await Promise.all([
              reconcileRequirementReceiptBatch({
                claimDue: claimRequirementReceipts,
                readReceipt: readRequirementRuntimeReceipt,
                persistReceipt: (claim, disposition, receipt) =>
                  persistRequirementPublicationReceipt({
                    projectId: claim.projectId,
                    documentId: claim.documentId,
                    designVersion: claim.designVersion,
                    existingRevision: true,
                    disposition,
                    publication: receipt,
                    reconciliationClaimToken: claim.claimToken,
                  }),
                retryClaim: retryRequirementReceiptClaim,
                batchSize: RECEIPT_RECONCILIATION_BATCH_SIZE,
              }),
              reconcileDesignSnapshotSyncBatch({
                claimDue: claimDesignSnapshotSyncs,
                replaySource: replayDesignAssetSource,
                commitSnapshot: commitDesignSnapshotSync,
                cancelClaim: cancelDesignSnapshotSyncClaim,
                retryClaim: retryDesignSnapshotSyncClaim,
                batchSize: RECEIPT_RECONCILIATION_BATCH_SIZE,
              }),
            ]);
            if (requirements.claimed || designSnapshots.claimed) {
              logger.info(
                `Receipt reconciliation: requirements=${JSON.stringify(
                  requirements,
                )}, designSnapshots=${JSON.stringify(designSnapshots)}`,
              );
            }
          },
        });

        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        httpRouter.use(router);
        logger.info('Resonance project registry API initialized');
      },
    });
  },
});
