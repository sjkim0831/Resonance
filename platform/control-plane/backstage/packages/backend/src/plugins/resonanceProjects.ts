import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request } from 'express';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  analyzeRequirementText,
  buildRequirementDesignContract,
  decodeRequirementDocument,
  type RequirementDocumentInput,
} from './requirementAutomation';
import { registerProjectLifecycleRoutes } from './projectLifecycleRoutes';

type ProjectInput = {
  projectId?: string;
  projectName?: string;
  description?: string;
  owner?: string;
  sourceRepository?: string;
  databaseMode?: string;
  runtimeMode?: string;
};

type DesignContractInput = {
  designVersion?: number;
  contract?: Record<string, unknown>;
  createdBy?: string;
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

type DesignAssetSnapshotInput = {
  assetType?: string;
  assetId?: string;
  assetName?: string;
  routePath?: string;
  version?: string;
  active?: boolean;
  payload?: Record<string, unknown>;
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
  if (tabs.length !== 24) {
    failures.push('exactly 24 actor-process functions are required');
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
        userInfo: coreServices.userInfo,
      },
      async init({ database, httpAuth, httpRouter, logger, userInfo }) {
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
            'resonance_projects__design_asset_draft',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_draft',
            table => {
              table.bigIncrements('draft_id').primary();
              table
                .string('project_id', 64)
                .notNullable()
                .references('project_id')
                .inTable('resonance_projects__project')
                .onDelete('CASCADE');
              table.string('asset_type', 32).notNullable();
              table.string('asset_id', 200).notNullable();
              table.string('base_sha256', 64).notNullable();
              table.jsonb('patch_payload').notNullable();
              table.string('draft_status', 32).notNullable();
              table.jsonb('validation_report').nullable();
              table.string('created_by', 120).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.timestamp('promoted_at', { useTz: true }).nullable();
              table.index(
                ['project_id', 'draft_status'],
                'resonance_design_asset_draft_status_idx',
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
            'resonance_projects__design_asset_audit',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_projects__design_asset_audit',
            table => {
              table.bigIncrements('audit_id').primary();
              table.string('project_id', 64).notNullable();
              table.bigInteger('draft_id').nullable();
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
          !(await knex.schema.hasTable('resonance_projects__requirement_document'))
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
              table.text('extracted_text').notNullable();
              table.string('analysis_status', 32).notNullable();
              table.integer('requirement_count').notNullable();
              table.integer('design_version').notNullable();
              table.string('process_code', 80).notNullable();
              table.string('created_by', 160).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.unique(
                ['project_id', 'document_sha256'],
                'resonance_requirement_document_project_hash_uq',
              );
              table.index(
                ['project_id', 'created_at'],
                'resonance_requirement_document_project_idx',
              );
            },
          );
        }
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

        const resolveDesignAssetAccess = async (
          request: Request,
          projectId: string,
        ) => {
          const credentials = await httpAuth.credentials(request, {
            allow: ['user'],
          });
          const user = await userInfo.getUserInfo(credentials);
          const principals = [user.userEntityRef, ...user.ownershipEntityRefs];
          const assignments = await knex(
            'resonance_projects__design_asset_role_assignment',
          )
            .where({ project_id: projectId, active: true })
            .whereIn('principal_ref', principals)
            .select('role_code');
          return {
            actorRef: user.userEntityRef,
            principals,
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
              draft_id: null,
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
        const writeDesignAssetAudit = async ({
          projectId,
          draftId,
          actionCode,
          actorRef,
          details = {},
        }: {
          projectId: string;
          draftId?: number;
          actionCode: string;
          actorRef: string;
          details?: Record<string, unknown>;
        }) => {
          await knex('resonance_projects__design_asset_audit').insert({
            project_id: projectId,
            draft_id: draftId ?? null,
            action_code: actionCode,
            actor_ref: actorRef,
            details: JSON.stringify(details),
            created_at: new Date(),
          });
        };

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
            const runtimeResponse = await fetch(
              `${runtimeBaseUrl}/api/internal/actor-process/design-documents`,
              {
                method: 'POST',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  'x-resonance-token': bridgeToken,
                  'x-resonance-actor': 'BACKSTAGE_CONTROL_PLANE',
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
          '/actor-process/commands',
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
          },
        );
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
                draftId: row.draft_id ? String(row.draft_id) : null,
                actionCode: row.action_code,
                actorRef: row.actor_ref,
                details: row.details,
                createdAt: row.created_at,
              })),
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
          const query = knex('resonance_projects__design_asset_snapshot')
            .select('*')
            .where({ project_id: projectId });
          if (assetType) query.andWhere({ asset_type: assetType });
          if (search) {
            query.andWhere(builder =>
              builder
                .whereILike('asset_id', `%${search}%`)
                .orWhereILike('asset_name', `%${search}%`)
                .orWhereILike('route_path', `%${search}%`),
            );
          }
          const assets = await query
            .orderBy('asset_type', 'asc')
            .orderBy('asset_name', 'asc')
            .limit(limit);
          const counts = (await knex(
            'resonance_projects__design_asset_snapshot',
          )
            .select('asset_type')
            .count({ count: '*' })
            .where({ project_id: projectId, active: true })
            .groupBy('asset_type')) as {
            asset_type: string;
            count: string | number;
          }[];
          response.json({
            projectId,
            counts: Object.fromEntries(
              counts.map(row => [row.asset_type, Number(row.count)]),
            ),
            assets: assets.map(asset => ({
              assetType: asset.asset_type,
              assetId: asset.asset_id,
              assetName: asset.asset_name,
              routePath: asset.route_path,
              version: asset.asset_version,
              active: asset.active,
              payload: asset.asset_payload,
              fingerprint: asset.asset_sha256,
              syncedAt: asset.synced_at,
            })),
          });
        });
        router.post(
          '/design-assets/:projectId/sync',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const project = await knex('resonance_projects__project')
              .where({ project_id: projectId })
              .first();
            if (!project) {
              response.status(404).json({ message: 'project not found' });
              return;
            }
            const assets = Array.isArray(request.body?.assets)
              ? (request.body.assets as DesignAssetSnapshotInput[])
              : [];
            const allowedTypes = new Set([
              'THEME',
              'CSS',
              'SECTION',
              'COMPONENT',
              'SCREEN',
              'MENU',
            ]);
            if (assets.length > 10000) {
              response.status(413).json({ message: 'too many design assets' });
              return;
            }
            const now = new Date();
            const rows = assets.map((asset, index) => {
              const assetType = String(asset.assetType ?? '').toUpperCase();
              const assetId = String(asset.assetId ?? '').trim();
              const payload =
                asset.payload && typeof asset.payload === 'object'
                  ? asset.payload
                  : {};
              if (!allowedTypes.has(assetType) || !assetId) {
                throw new Error(`invalid design asset at index ${index}`);
              }
              const canonical = JSON.stringify({
                assetType,
                assetId,
                assetName: String(asset.assetName ?? assetId),
                routePath: String(asset.routePath ?? ''),
                version: String(asset.version ?? 'v1'),
                active: asset.active !== false,
                payload,
              });
              return {
                project_id: projectId,
                asset_type: assetType,
                asset_id: assetId,
                asset_name: String(asset.assetName ?? assetId),
                route_path: String(asset.routePath ?? ''),
                asset_version: String(asset.version ?? 'v1'),
                active: asset.active !== false,
                asset_payload: JSON.stringify(payload),
                asset_sha256: createHash('sha256')
                  .update(canonical)
                  .digest('hex'),
                synced_at: now,
              };
            });
            if (
              new Set(rows.map(row => `${row.asset_type}:${row.asset_id}`))
                .size !== rows.length
            ) {
              response.status(400).json({ message: 'duplicate design assets' });
              return;
            }
            await knex.transaction(async transaction => {
              for (const row of rows) {
                await transaction('resonance_projects__design_asset_snapshot')
                  .insert(row)
                  .onConflict(['project_id', 'asset_type', 'asset_id'])
                  .merge({
                    asset_name: row.asset_name,
                    route_path: row.route_path,
                    asset_version: row.asset_version,
                    active: row.active,
                    asset_payload: row.asset_payload,
                    asset_sha256: row.asset_sha256,
                    synced_at: now,
                  });
              }
            });
            response.json({
              projectId,
              synchronized: rows.length,
              fingerprint: createHash('sha256')
                .update(
                  rows
                    .map(
                      row =>
                        `${row.asset_type}:${row.asset_id}:${row.asset_sha256}`,
                    )
                    .sort()
                    .join('\n'),
                )
                .digest('hex'),
              syncedAt: now,
            });
          },
        );
        router.get(
          '/design-assets/:projectId/drafts',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const drafts = await knex('resonance_projects__design_asset_draft')
              .where({ project_id: projectId })
              .orderBy('draft_id', 'desc')
              .limit(100);
            response.json({
              projectId,
              drafts: drafts.map(draft => ({
                draftId: String(draft.draft_id),
                assetType: draft.asset_type,
                assetId: draft.asset_id,
                baseFingerprint: draft.base_sha256,
                patch: draft.patch_payload,
                status: draft.draft_status,
                validationReport: draft.validation_report,
                createdBy: draft.created_by,
                createdAt: draft.created_at,
                updatedAt: draft.updated_at,
                promotedAt: draft.promoted_at,
              })),
            });
          },
        );
        router.post(
          '/design-assets/:projectId/drafts',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_REQUESTER',
            );
            const assetType = String(
              request.body?.assetType ?? '',
            ).toUpperCase();
            const assetId = String(request.body?.assetId ?? '').trim();
            const baseFingerprint = String(
              request.body?.baseFingerprint ?? '',
            ).trim();
            const patch =
              request.body?.patch && typeof request.body.patch === 'object'
                ? request.body.patch
                : {};
            const allowedPatchFields = new Set([
              'assetName',
              'routePath',
              'version',
              'active',
              'payload',
            ]);
            const invalidFields = Object.keys(patch).filter(
              field => !allowedPatchFields.has(field),
            );
            if (invalidFields.length) {
              response.status(400).json({
                message: `unsupported patch fields: ${invalidFields.join(
                  ', ',
                )}`,
              });
              return;
            }
            const source = await knex(
              'resonance_projects__design_asset_snapshot',
            )
              .where({
                project_id: projectId,
                asset_type: assetType,
                asset_id: assetId,
              })
              .first();
            if (!source) {
              response.status(404).json({ message: 'design asset not found' });
              return;
            }
            if (source.asset_sha256 !== baseFingerprint) {
              response.status(409).json({
                message: 'source fingerprint changed; refresh before editing',
              });
              return;
            }
            const [draft] = await knex('resonance_projects__design_asset_draft')
              .insert({
                project_id: projectId,
                asset_type: assetType,
                asset_id: assetId,
                base_sha256: baseFingerprint,
                patch_payload: JSON.stringify(patch),
                draft_status: 'DRAFT',
                created_by: access.actorRef,
                created_at: new Date(),
                updated_at: new Date(),
              })
              .returning('*');
            await writeDesignAssetAudit({
              projectId,
              draftId: Number(draft.draft_id),
              actionCode: 'DRAFT_CREATED',
              actorRef: access.actorRef,
              details: { assetType, assetId, baseFingerprint },
            });
            response.status(201).json({
              projectId,
              draftId: String(draft.draft_id),
              status: draft.draft_status,
            });
          },
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/validate',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_REVIEWER',
            );
            const draftId = Number(request.params.draftId);
            const draft = await knex('resonance_projects__design_asset_draft')
              .where({ project_id: projectId, draft_id: draftId })
              .first();
            if (!draft) {
              response.status(404).json({ message: 'draft not found' });
              return;
            }
            if (draft.draft_status !== 'DRAFT') {
              response.status(409).json({ message: 'draft is not editable' });
              return;
            }
            if (draft.created_by === access.actorRef) {
              await writeDesignAssetAudit({
                projectId,
                draftId,
                actionCode: 'REVIEW_DENIED_SELF',
                actorRef: access.actorRef,
              });
              response.status(409).json({
                message: 'requester cannot review their own draft',
              });
              return;
            }
            const source = await knex(
              'resonance_projects__design_asset_snapshot',
            )
              .where({
                project_id: projectId,
                asset_type: draft.asset_type,
                asset_id: draft.asset_id,
              })
              .first();
            const failures: string[] = [];
            if (!source || source.asset_sha256 !== draft.base_sha256) {
              failures.push('SOURCE_FINGERPRINT_CHANGED');
            }
            const patch = draft.patch_payload as Record<string, unknown>;
            if (
              Object.prototype.hasOwnProperty.call(patch, 'assetName') &&
              !String(patch.assetName ?? '').trim()
            ) {
              failures.push('ASSET_NAME_REQUIRED');
            }
            if (
              Object.prototype.hasOwnProperty.call(patch, 'routePath') &&
              String(patch.routePath ?? '') &&
              !String(patch.routePath).startsWith('/')
            ) {
              failures.push('ROUTE_PATH_INVALID');
            }
            const report = {
              status: failures.length ? 'BLOCKED' : 'PASS',
              failures,
              baseFingerprint: draft.base_sha256,
              validatedAt: new Date(),
            };
            await knex('resonance_projects__design_asset_draft')
              .where({ project_id: projectId, draft_id: draftId })
              .update({
                draft_status: failures.length ? 'BLOCKED' : 'VALIDATED',
                validation_report: JSON.stringify(report),
                updated_at: new Date(),
              });
            await writeDesignAssetAudit({
              projectId,
              draftId,
              actionCode: failures.length ? 'REVIEW_BLOCKED' : 'REVIEW_PASSED',
              actorRef: access.actorRef,
              details: report,
            });
            response.status(failures.length ? 409 : 200).json({
              projectId,
              draftId: String(draftId),
              ...report,
            });
          },
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/promote',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const draftId = Number(request.params.draftId);
            const now = new Date();
            const result = await knex.transaction(async transaction => {
              const draft = await transaction(
                'resonance_projects__design_asset_draft',
              )
                .where({ project_id: projectId, draft_id: draftId })
                .forUpdate()
                .first();
              if (!draft) throw new Error('draft not found');
              if (draft.draft_status !== 'VALIDATED') {
                throw new Error('only validated drafts can be promoted');
              }
              if (draft.created_by === access.actorRef) {
                throw new Error('requester cannot approve their own draft');
              }
              const review = await transaction(
                'resonance_projects__design_asset_audit',
              )
                .where({
                  project_id: projectId,
                  draft_id: draftId,
                  action_code: 'REVIEW_PASSED',
                })
                .orderBy('audit_id', 'desc')
                .first();
              if (!review || review.actor_ref === access.actorRef) {
                throw new Error('approver must be different from the reviewer');
              }
              const source = await transaction(
                'resonance_projects__design_asset_snapshot',
              )
                .where({
                  project_id: projectId,
                  asset_type: draft.asset_type,
                  asset_id: draft.asset_id,
                })
                .first();
              if (!source || source.asset_sha256 !== draft.base_sha256) {
                throw new Error('source fingerprint changed');
              }
              await transaction('resonance_projects__design_asset_draft')
                .where({ project_id: projectId, draft_id: draftId })
                .update({
                  draft_status: 'PROMOTED',
                  promoted_at: now,
                  updated_at: now,
                });
              const [task] = await transaction('resonance_projects__task')
                .insert({
                  project_id: projectId,
                  task_type: 'DESIGN_ASSET_PROMOTION',
                  status: 'PLANNED',
                  payload: JSON.stringify({
                    draftId,
                    assetType: draft.asset_type,
                    assetId: draft.asset_id,
                    baseFingerprint: draft.base_sha256,
                    patch: draft.patch_payload,
                  }),
                  created_at: now,
                  updated_at: now,
                })
                .returning('*');
              return task;
            });
            await writeDesignAssetAudit({
              projectId,
              draftId,
              actionCode: 'APPROVAL_QUEUED',
              actorRef: access.actorRef,
              details: { taskId: String(result.task_id) },
            });
            response.json({
              projectId,
              draftId: String(draftId),
              status: 'PROMOTED',
              taskId: String(result.task_id),
              taskStatus: result.status,
            });
          },
        );
        router.post(
          '/design-assets/:projectId/drafts/:draftId/rollback',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const access = await requireDesignAssetRole(
              request,
              projectId,
              'DESIGN_APPROVER',
            );
            const draftId = Number(request.params.draftId);
            const now = new Date();
            const result = await knex.transaction(async transaction => {
              const draft = await transaction(
                'resonance_projects__design_asset_draft',
              )
                .where({ project_id: projectId, draft_id: draftId })
                .forUpdate()
                .first();
              if (!draft) throw new Error('draft not found');
              if (draft.draft_status !== 'APPLIED') {
                throw new Error('only applied drafts can be rolled back');
              }
              const report = (draft.validation_report ?? {}) as Record<
                string,
                unknown
              >;
              const backup = String(report.backup ?? '');
              const appliedFingerprint = String(report.afterFingerprint ?? '');
              if (!backup || !/^[0-9a-f]{64}$/.test(appliedFingerprint)) {
                throw new Error('verified runtime backup is missing');
              }
              await transaction('resonance_projects__design_asset_draft')
                .where({ project_id: projectId, draft_id: draftId })
                .update({
                  draft_status: 'ROLLBACK_QUEUED',
                  updated_at: now,
                });
              const [task] = await transaction('resonance_projects__task')
                .insert({
                  project_id: projectId,
                  task_type: 'DESIGN_ASSET_ROLLBACK',
                  status: 'PLANNED',
                  payload: JSON.stringify({
                    draftId,
                    assetType: draft.asset_type,
                    assetId: draft.asset_id,
                    appliedFingerprint,
                    backup,
                  }),
                  created_at: now,
                  updated_at: now,
                })
                .returning('*');
              return task;
            });
            await writeDesignAssetAudit({
              projectId,
              draftId,
              actionCode: 'ROLLBACK_QUEUED',
              actorRef: access.actorRef,
              details: { taskId: String(result.task_id) },
            });
            response.json({
              projectId,
              draftId: String(draftId),
              status: 'ROLLBACK_QUEUED',
              taskId: String(result.task_id),
              taskStatus: result.status,
            });
          },
        );
        router.post(
          '/control-assets/:projectId/transition',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
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
            await knex('resonance_projects__control_asset_migration')
              .where({ project_id: projectId, asset_id: assetId })
              .update({
                migration_status: nextStatus,
                verification_evidence: JSON.stringify(evidence),
                updated_at: now,
              });
            response.json({
              projectId,
              assetId,
              previousStatus: asset.migration_status,
              migrationStatus: nextStatus,
              verificationEvidence: evidence,
              updatedAt: now,
            });
          },
        );
        router.post(
          '/control-assets/:projectId/verify-native',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
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
              return assets.length;
            });

            response.json({
              projectId,
              verified,
              targetCount: targetUrls.size,
              migrationStatus: 'VERIFIED',
              updatedAt: now,
            });
          },
        );
        router.post(
          '/control-assets/:projectId/retire-source',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
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
                },
                body: JSON.stringify({
                  projectId,
                  action: 'RETIRE',
                  sourceRoutes,
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
            });
            response.json({
              projectId,
              retired: assets.length,
              sourceRoutes: sourceRoutes.length,
              bridgeResult,
              migrationStatus: 'RETIRED_SOURCE',
              reversible: true,
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
              'analysis_status',
              'requirement_count',
              'design_version',
              'process_code',
              'created_by',
              'created_at',
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
              status: document.analysis_status,
              requirementCount: document.requirement_count,
              designVersion: document.design_version,
              processCode: document.process_code,
              createdBy: document.created_by,
              createdAt: document.created_at,
            })),
          });
        });
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
              response.status(404).json({ message: 'Requirement document not found' });
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
            const project = await knex('resonance_projects__project')
              .where({ project_id: projectId })
              .first();
            if (!project) {
              response.status(404).json({ message: 'Project not found' });
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
            const existing = await knex(
              'resonance_projects__requirement_document',
            )
              .where({
                project_id: projectId,
                document_sha256: document.documentSha256,
              })
              .first();
            if (existing) {
              response.status(200).json({
                success: true,
                idempotent: true,
                projectId,
                documentId: existing.document_id,
                designVersion: existing.design_version,
                processCode: existing.process_code,
                requirementCount: existing.requirement_count,
                status: existing.analysis_status,
              });
              return;
            }
            const analysis = analyzeRequirementText(
              projectId,
              document.fileName,
              document.text,
            );
            const [{ max }] = await knex(
              'resonance_projects__design_release',
            )
              .where({ project_id: projectId })
              .max({ max: 'design_version' });
            const designVersion = Math.max(
              Number(project.design_version ?? 1),
              Number(max ?? 0),
            ) + 1;
            const contract = buildRequirementDesignContract({
              projectId,
              designVersion,
              document,
              analysis,
            });
            const validation = validateDesignContract(projectId, contract);
            if (validation.status !== 'VERIFIED') {
              response.status(422).json({
                success: false,
                message: 'Generated design contract failed validation',
                validation,
              });
              return;
            }
            const contractSha256 = createHash('sha256')
              .update(JSON.stringify(contract))
              .digest('hex');
            const documentId = document.documentSha256;
            const now = new Date();
            await knex.transaction(async transaction => {
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
                  requirement_id: item.requirementId,
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
                  implementation_status: 'GENERATION_QUEUED',
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
            });
            let publication: Record<string, unknown> = {
              success: false,
              status: 'AWAITING_PROMOTION',
            };
            if (request.body?.autoPromote === true) {
              const runtimeBaseUrl = String(
                process.env.CARBONET_RUNTIME_BASE_URL ??
                  'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
              ).replace(/\/+$/, '');
              const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
              if (!bridgeToken) {
                response.status(503).json({
                  success: false,
                  projectId,
                  documentId,
                  designVersion,
                  message: 'Design is stored, but the runtime bridge token is missing',
                });
                return;
              }
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
                    designVersion,
                    contractSha256,
                    contract,
                  }),
                },
              );
              publication = (await publicationResponse.json()) as Record<
                string,
                unknown
              >;
              if (!publicationResponse.ok || publication.success !== true) {
                response.status(502).json({
                  success: false,
                  projectId,
                  documentId,
                  designVersion,
                  message: 'Runtime rejected the generated design contract',
                  publication,
                });
                return;
              }
              await knex.transaction(async transaction => {
                await transaction('resonance_projects__design_release')
                  .where({ project_id: projectId, design_version: designVersion })
                  .update({
                    release_status: 'PROMOTED',
                    promoted_at: new Date(),
                    updated_at: new Date(),
                  });
                await transaction('resonance_projects__project')
                  .where({ project_id: projectId })
                  .update({
                    design_version: designVersion,
                    status: 'GENERATION_QUEUED',
                    updated_at: new Date(),
                  });
                await transaction('resonance_projects__requirement_document')
                  .where({ project_id: projectId, document_id: documentId })
                  .update({ analysis_status: 'GENERATION_QUEUED' });
              });
            }
            response.status(201).json({
              success: true,
              idempotent: false,
              projectId,
              documentId,
              designVersion,
              processCode: analysis.processCode,
              requirementCount: analysis.requirements.length,
              screenCount: analysis.requirements.length,
              endpointCount: analysis.requirements.length,
              contractSha256,
              status:
                request.body?.autoPromote === true
                  ? 'GENERATION_QUEUED'
                  : 'DESIGN_VALIDATED',
              publication,
            });
          },
        );
        router.post(
          '/:projectId/design-releases',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const input = (request.body ?? {}) as DesignContractInput;
            const project = await knex('resonance_projects__project')
              .where({ project_id: projectId })
              .first();
            if (!project) {
              response.status(404).json({ message: 'Project not found' });
              return;
            }
            const designVersion = Number(
              input.designVersion ?? project.design_version,
            );
            const contract =
              input.contract && typeof input.contract === 'object'
                ? input.contract
                : {};
            if (!Number.isInteger(designVersion) || designVersion < 1) {
              response.status(400).json({ message: 'Invalid designVersion' });
              return;
            }
            const validation = validateDesignContract(projectId, contract);
            const canonical = JSON.stringify(contract);
            const checksum = createHash('sha256')
              .update(canonical)
              .digest('hex');
            const now = new Date();
            const releaseStatus =
              validation.status === 'VERIFIED' ? 'VALIDATED' : 'DRAFT';
            await knex('resonance_projects__design_release')
              .insert({
                project_id: projectId,
                design_version: designVersion,
                release_status: releaseStatus,
                contract_payload: JSON.stringify(contract),
                contract_sha256: checksum,
                validation_report: JSON.stringify(validation),
                created_by: String(input.createdBy ?? 'backstage-user'),
                created_at: now,
                updated_at: now,
              })
              .onConflict(['project_id', 'design_version'])
              .merge({
                release_status: releaseStatus,
                contract_payload: JSON.stringify(contract),
                contract_sha256: checksum,
                validation_report: JSON.stringify(validation),
                created_by: String(input.createdBy ?? 'backstage-user'),
                updated_at: now,
                promoted_at: null,
              });
            response.status(validation.status === 'VERIFIED' ? 201 : 422).json({
              success: validation.status === 'VERIFIED',
              projectId,
              designVersion,
              status: releaseStatus,
              contractSha256: checksum,
              validation,
            });
          },
        );
        router.post(
          '/:projectId/design-releases/:designVersion/promote',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const designVersion = Number(request.params.designVersion);
            const release = await knex('resonance_projects__design_release')
              .where({
                project_id: projectId,
                design_version: designVersion,
              })
              .first();
            if (!release) {
              response
                .status(404)
                .json({ message: 'Design release not found' });
              return;
            }
            const report =
              typeof release.validation_report === 'string'
                ? JSON.parse(release.validation_report)
                : release.validation_report;
            if (report?.status !== 'VERIFIED') {
              response.status(409).json({
                message: 'Only a verified design release can be promoted',
              });
              return;
            }
            const runtimeBaseUrl = String(
              process.env.CARBONET_RUNTIME_BASE_URL ??
                'http://carbonet-api.carbonet-prod.svc.cluster.local:8080',
            ).replace(/\/+$/, '');
            const bridgeToken = String(process.env.RESONANCE_OPS_TOKEN ?? '');
            if (!bridgeToken) {
              response.status(503).json({
                message:
                  'Resonance control-plane bridge token is not configured',
              });
              return;
            }
            const contract =
              typeof release.contract_payload === 'string'
                ? JSON.parse(release.contract_payload)
                : release.contract_payload;
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
                  designVersion,
                  contractSha256: release.contract_sha256,
                  contract,
                }),
              },
            );
            const publication = (await publicationResponse.json()) as Record<
              string,
              unknown
            >;
            if (!publicationResponse.ok || publication.success !== true) {
              response.status(502).json({
                message:
                  'Resonance rejected the promoted Backstage design contract',
                publication,
              });
              return;
            }
            const now = new Date();
            await knex.transaction(async transaction => {
              await transaction('resonance_projects__design_release')
                .where({ project_id: projectId })
                .whereNot({ design_version: designVersion })
                .where({ release_status: 'PROMOTED' })
                .update({ release_status: 'SUPERSEDED', updated_at: now });
              await transaction('resonance_projects__design_release')
                .where({
                  project_id: projectId,
                  design_version: designVersion,
                })
                .update({
                  release_status: 'PROMOTED',
                  promoted_at: now,
                  updated_at: now,
                });
              await transaction('resonance_projects__project')
                .where({ project_id: projectId })
                .update({
                  design_version: designVersion,
                  status: 'DESIGN_PROMOTED',
                  updated_at: now,
                });
              await transaction('resonance_projects__task').insert({
                project_id: projectId,
                task_type: 'DESIGN_PROMOTION',
                status: 'PLANNED',
                payload: JSON.stringify({
                  designVersion,
                  contractSha256: release.contract_sha256,
                  target: 'RESONANCE_GENERATOR',
                }),
                created_at: now,
                updated_at: now,
              });
            });
            response.json({
              success: true,
              projectId,
              designVersion,
              status: 'PROMOTED',
              contractSha256: release.contract_sha256,
              sourceOfTruth: 'BACKSTAGE',
              resonancePublication: publication,
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
            if (!preview) query.andWhere({ release_status: 'PROMOTED' });
            const release = await query
              .orderBy('design_version', 'desc')
              .first();
            if (!release) {
              response.status(404).json({
                message: preview
                  ? 'No design release exists'
                  : 'No promoted design release exists',
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
          });
          logger.info(`Registered project ${projectId}`);
          const saved = await knex('resonance_projects__project')
            .where({ project_id: projectId })
            .first();
          response.status(201).json({
            success: true,
            project: saved,
            taskStatus: 'PLANNED',
          });
        });

        registerProjectLifecycleRoutes({ router, knex, logger });

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
