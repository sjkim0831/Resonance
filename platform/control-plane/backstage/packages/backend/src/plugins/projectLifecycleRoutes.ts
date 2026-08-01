import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Router } from 'express';

const normalizeProjectId = (value: unknown) =>
  String(value ?? '').trim().toUpperCase();

const projectIdPattern = /^[A-Z][A-Z0-9_-]{2,63}$/;

export function registerProjectLifecycleRoutes(options: {
  router: Router;
  knex: any;
  logger: LoggerService;
}) {
  const { router, knex, logger } = options;

  router.post('/:sourceProjectId/copy', async (request, response) => {
    const sourceProjectId = normalizeProjectId(request.params.sourceProjectId);
    const projectId = normalizeProjectId(request.body?.projectId);
    const projectName = String(request.body?.projectName ?? '').trim();
    if (!projectIdPattern.test(projectId) || !projectName) {
      response.status(400).json({ message: 'A valid projectId and projectName are required' });
      return;
    }
    if (sourceProjectId === projectId) {
      response.status(400).json({ message: 'Source and target project must differ' });
      return;
    }
    const source = await knex('resonance_projects__project')
      .where({ project_id: sourceProjectId }).first();
    if (!source) {
      response.status(404).json({ message: 'Source project not found' });
      return;
    }
    if (await knex('resonance_projects__project').where({ project_id: projectId }).first()) {
      response.status(409).json({ message: 'Target project already exists' });
      return;
    }

    const now = new Date();
    const copied = await knex.transaction(async (transaction: any) => {
      const counts: Record<string, number> = {};
      await transaction('resonance_projects__project').insert({
        project_id: projectId,
        project_name: projectName,
        description: source.description,
        owner: String(request.body?.owner ?? source.owner).trim() || source.owner,
        source_repository: source.source_repository,
        database_mode: source.database_mode,
        runtime_mode: source.runtime_mode,
        status: 'REGISTERED',
        design_version: source.design_version,
        created_at: now,
        updated_at: now,
      });

      const roles = await transaction('resonance_projects__design_asset_role_assignment')
        .where({ project_id: sourceProjectId });
      if (roles.length) {
        await transaction('resonance_projects__design_asset_role_assignment').insert(
          roles.map(({ assignment_id: _id, ...row }: Record<string, unknown>) => ({
            ...row, project_id: projectId, created_at: now,
          })),
        );
      }
      counts.roleAssignments = roles.length;
      await transaction('resonance_projects__task').insert({
        project_id: projectId,
        task_type: 'PROJECT_COPY_BOOTSTRAP',
        status: 'PLANNED',
        payload: JSON.stringify({
          sourceProjectId,
          copiedConfiguration: counts,
          steps: ['REGENERATE_DESIGN_ASSETS', 'REGISTER_CONTROL_ASSETS', 'VALIDATE_CONTRACTS'],
        }),
        created_at: now,
        updated_at: now,
      });
      return counts;
    });
    logger.info(`Copied project ${sourceProjectId} to ${projectId}`);
    response.status(201).json({
      success: true,
      sourceProjectId,
      projectId,
      copied,
      excluded: [
        'runtime executions', 'task history', 'audit history', 'requirement uploads',
        'materialized design assets (queued for regeneration)',
      ],
    });
  });

  router.delete('/:projectId', async (request, response) => {
    const projectId = normalizeProjectId(request.params.projectId);
    if (projectId === 'CCUS-PLATFORM') {
      response.status(409).json({ message: 'The default CCUS-PLATFORM project is protected' });
      return;
    }
    if (String(request.query.confirmProjectId ?? '') !== projectId) {
      response.status(400).json({ message: 'confirmProjectId must exactly match projectId' });
      return;
    }
    if (!(await knex('resonance_projects__project').where({ project_id: projectId }).first())) {
      response.status(404).json({ message: 'Project not found' });
      return;
    }
    const deleted = await knex.transaction(async (transaction: any) => {
      const tables = [
        'resonance_projects__requirement_item',
        'resonance_projects__requirement_document',
        'resonance_projects__screen_space_spec',
        'resonance_projects__design_asset_audit',
        'resonance_projects__design_asset_role_assignment',
        'resonance_projects__design_asset_draft',
        'resonance_projects__design_asset_snapshot',
        'resonance_projects__control_asset_migration',
        'resonance_projects__design_release',
        'resonance_projects__task',
      ];
      const counts: Record<string, number> = {};
      for (const table of tables) {
        counts[table] = await transaction(table).where({ project_id: projectId }).delete();
      }
      counts.project = await transaction('resonance_projects__project')
        .where({ project_id: projectId }).delete();
      return counts;
    });
    logger.info(`Deleted project ${projectId}`);
    response.json({ success: true, projectId, deleted });
  });
}
