import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router } from 'express';

type ProjectInput = {
  projectId?: string;
  projectName?: string;
  description?: string;
  owner?: string;
  sourceRepository?: string;
  databaseMode?: string;
  runtimeMode?: string;
};

const normalizeProjectId = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toUpperCase();

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

        const router = Router();
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
              database_mode: input.databaseMode ?? 'PROJECT_DB',
              runtime_mode:
                input.runtimeMode ?? 'DEDICATED_PROJECT_RUNTIME',
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
