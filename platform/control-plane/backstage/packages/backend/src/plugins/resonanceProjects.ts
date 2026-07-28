import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json } from 'express';
import { createHash } from 'node:crypto';

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
  if (workspaces.length !== 4) {
    failures.push('exactly 4 actor-process workspaces are required');
  }
  const tabs = workspaces.flatMap(workspace => {
    if (!workspace || typeof workspace !== 'object') return [];
    const candidate = (workspace as { tabs?: unknown }).tabs;
    return Array.isArray(candidate) ? candidate : [];
  });
  if (tabs.length !== 33) {
    failures.push('exactly 33 actor-process functions are required');
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
  const requiredContext = ['projectId', 'tenantId', 'designVersion'];
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
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ database, httpRouter, logger }) {
        const knex = await database.getClient();
        if (!(await knex.schema.hasTable('resonance_projects__project'))) {
          await knex.schema.createTable('resonance_projects__project', table => {
            table.string('project_id', 64).primary();
            table.string('project_name', 200).notNullable();
            table.text('description').notNullable().defaultTo('');
            table.string('owner', 120).notNullable();
            table.string('source_repository', 500).notNullable().defaultTo('');
            table.string('database_mode', 64).notNullable();
            table.string('runtime_mode', 64).notNullable();
            table.string('status', 32).notNullable();
            table.integer('design_version').notNullable().defaultTo(1);
            table.timestamp('created_at', { useTz: true }).notNullable();
            table.timestamp('updated_at', { useTz: true }).notNullable();
          });
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
        const taskColumns = [
          ['result', (table: any) => table.jsonb('result').nullable()],
          [
            'attempt_count',
            (table: any) => table.integer('attempt_count').notNullable().defaultTo(0),
          ],
          ['worker_id', (table: any) => table.string('worker_id', 160).nullable()],
          [
            'started_at',
            (table: any) => table.timestamp('started_at', { useTz: true }).nullable(),
          ],
          [
            'finished_at',
            (table: any) => table.timestamp('finished_at', { useTz: true }).nullable(),
          ],
        ] as const;
        for (const [column, addColumn] of taskColumns) {
          if (!(await knex.schema.hasColumn('resonance_projects__task', column))) {
            await knex.schema.alterTable('resonance_projects__task', addColumn);
          }
        }

        const router = Router();
        router.use(json({ limit: '256kb' }));
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
        router.get(
          '/control-assets/:projectId',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const rows = await knex(
              'resonance_projects__control_asset_migration',
            )
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
                updatedAt: row.updated_at,
              })),
            });
          },
        );
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
            if (new Set(normalized.map(asset => asset.asset_id)).size !== normalized.length) {
              response.status(400).json({ message: 'duplicate asset ids' });
              return;
            }
            const now = new Date();
            await knex.transaction(async transaction => {
              for (const asset of normalized) {
                await transaction(
                  'resonance_projects__control_asset_migration',
                )
                  .insert({
                    ...asset,
                    created_at: now,
                    updated_at: now,
                  })
                  .onConflict(['project_id', 'asset_id'])
                  .merge({
                    route_path: asset.route_path,
                    screen_name: asset.screen_name,
                    ownership_lane: asset.ownership_lane,
                    migration_status: asset.migration_status,
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
        router.post('/:projectId/design-releases', async (request, response) => {
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
        });
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
              response.status(404).json({ message: 'Design release not found' });
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
            });
          },
        );
        router.get(
          '/:projectId/development-contract',
          async (request, response) => {
            const projectId = normalizeProjectId(request.params.projectId);
            const preview = request.query.mode === 'preview';
            const query = knex('resonance_projects__design_release')
              .where({ project_id: projectId });
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
          const runtimeMode =
            input.runtimeMode ?? 'DEDICATED_PROJECT_RUNTIME';
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
