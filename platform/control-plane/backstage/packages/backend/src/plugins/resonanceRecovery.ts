import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request } from 'express';
import { createHash, randomUUID } from 'node:crypto';

const COMMANDS = [
  'CREATE_BACKUP',
  'VERIFY_BACKUP',
  'RESTORE_BACKUP',
  'PROMOTE_PRIMARY',
  'SYNC_DEPLOY',
] as const;
type RecoveryCommand = (typeof COMMANDS)[number];

const HIGH_RISK = new Set<RecoveryCommand>([
  'RESTORE_BACKUP',
  'PROMOTE_PRIMARY',
  'SYNC_DEPLOY',
]);

const requiredConfirmation = (command: RecoveryCommand) =>
  `EXECUTE ${command}`;

export default createBackendPlugin({
  pluginId: 'resonance-recovery',
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
        if (!(await knex.schema.hasTable('resonance_recovery__policy'))) {
          await knex.schema.createTable(
            'resonance_recovery__policy',
            table => {
              table.string('policy_code', 80).primary();
              table.string('policy_name', 200).notNullable();
              table.jsonb('policy_value').notNullable();
              table.boolean('active').notNullable().defaultTo(true);
              table.timestamp('updated_at', { useTz: true }).notNullable();
            },
          );
        }
        if (!(await knex.schema.hasTable('resonance_recovery__command'))) {
          await knex.schema.createTable(
            'resonance_recovery__command',
            table => {
              table.uuid('command_id').primary();
              table.string('command_type', 80).notNullable();
              table.string('target_environment', 80).notNullable();
              table.string('status', 32).notNullable();
              table.string('requested_by', 300).notNullable();
              table.string('change_ticket', 120).notNullable().defaultTo('');
              table.string('idempotency_key', 128).notNullable();
              table.jsonb('payload').notNullable();
              table.text('result_message').nullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.unique(
                ['target_environment', 'idempotency_key'],
                'resonance_recovery_command_idempotency_uq',
              );
              table.index(
                ['status', 'created_at'],
                'resonance_recovery_command_queue_idx',
              );
            },
          );
        }
        if (!(await knex.schema.hasTable('resonance_recovery__audit'))) {
          await knex.schema.createTable(
            'resonance_recovery__audit',
            table => {
              table.bigIncrements('audit_id').primary();
              table.uuid('command_id').nullable();
              table.string('action_code', 80).notNullable();
              table.string('actor_ref', 300).notNullable();
              table.jsonb('details').notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.index(
                ['created_at', 'action_code'],
                'resonance_recovery_audit_lookup_idx',
              );
            },
          );
        }

        const now = new Date();
        const policySeeds = [
          [
            'BACKUP_RETENTION',
            '백업 보존 정책',
            { hourlyDays: 3, dailyDays: 30, baseBackupCopies: 2 },
          ],
          [
            'RESTORE_GUARD',
            '복구 실행 보호',
            {
              requireVerifiedBackup: true,
              requireChangeTicket: true,
              requireExactConfirmation: true,
            },
          ],
          [
            'PROMOTION_GUARD',
            'DB 승격 보호',
            {
              requireHealthyReplica: true,
              requireChangeTicket: true,
              requireExactConfirmation: true,
            },
          ],
          [
            'COMMAND_EXECUTION',
            '명령 실행 정책',
            {
              mode: 'QUEUED',
              workerRequired: true,
              directShellExecution: false,
            },
          ],
        ] as const;
        for (const [code, name, value] of policySeeds) {
          await knex('resonance_recovery__policy')
            .insert({
              policy_code: code,
              policy_name: name,
              policy_value: JSON.stringify(value),
              active: true,
              updated_at: now,
            })
            .onConflict('policy_code')
            .ignore();
        }

        const router = Router();
        router.use(json({ limit: '256kb' }));

        const resolveUser = async (request: Request) => {
          const credentials = await httpAuth.credentials(request, {
            allow: ['user'],
          });
          return userInfo.getUserInfo(credentials);
        };
        const operatorRefs = () =>
          new Set(
            (
              process.env.RESONANCE_RECOVERY_OPERATOR_REFS ??
              'group:default/platform-engineering,group:default/verification-governance'
            )
              .split(',')
              .map(value => value.trim())
              .filter(Boolean),
          );
        const requireOperator = async (request: Request) => {
          const user = await resolveUser(request);
          const principals = new Set([
            user.userEntityRef,
            ...user.ownershipEntityRefs,
          ]);
          if (
            ![...operatorRefs()].some(principal => principals.has(principal))
          ) {
            await knex('resonance_recovery__audit').insert({
              command_id: null,
              action_code: 'ACCESS_DENIED',
              actor_ref: user.userEntityRef,
              details: JSON.stringify({
                required: [...operatorRefs()],
              }),
              created_at: new Date(),
            });
            const error = new Error('recovery operator permission required') as
              Error & { statusCode?: number };
            error.statusCode = 403;
            throw error;
          }
          return user;
        };

        router.get('/health', async (_request, response) => {
          const [{ count }] = await knex('resonance_recovery__policy').count({
            count: '*',
          });
          response.json({ status: 'UP', policyCount: Number(count) });
        });
        router.get('/summary', async (request, response) => {
          await resolveUser(request);
          const [policies, commands] = await Promise.all([
            knex('resonance_recovery__policy')
              .select('*')
              .orderBy('policy_code'),
            knex('resonance_recovery__command')
              .select('*')
              .orderBy('created_at', 'desc')
              .limit(50),
          ]);
          response.json({
            checkedAt: new Date().toISOString(),
            executionMode: 'QUEUED',
            directShellExecution: false,
            workerConnected:
              process.env.RESONANCE_RECOVERY_WORKER_CONNECTED === 'true',
            policies: policies.map(policy => ({
              code: policy.policy_code,
              name: policy.policy_name,
              value: policy.policy_value,
              active: policy.active,
              updatedAt: policy.updated_at,
            })),
            commands: commands.map(command => ({
              commandId: command.command_id,
              commandType: command.command_type,
              targetEnvironment: command.target_environment,
              status: command.status,
              requestedBy: command.requested_by,
              changeTicket: command.change_ticket,
              createdAt: command.created_at,
              updatedAt: command.updated_at,
              resultMessage: command.result_message,
            })),
          });
        });
        router.post('/commands', async (request, response) => {
          const user = await requireOperator(request);
          const commandType = String(
            request.body?.commandType ?? '',
          ) as RecoveryCommand;
          const targetEnvironment = String(
            request.body?.targetEnvironment ?? '',
          )
            .trim()
            .toUpperCase();
          const changeTicket = String(request.body?.changeTicket ?? '').trim();
          const confirmation = String(request.body?.confirmation ?? '').trim();
          const rawIdempotencyKey = String(
            request.body?.idempotencyKey ?? '',
          ).trim();
          if (!COMMANDS.includes(commandType)) {
            response.status(400).json({ message: 'unsupported commandType' });
            return;
          }
          if (!/^[A-Z][A-Z0-9_-]{2,79}$/.test(targetEnvironment)) {
            response.status(400).json({ message: 'invalid targetEnvironment' });
            return;
          }
          if (
            HIGH_RISK.has(commandType) &&
            (!changeTicket ||
              confirmation !== requiredConfirmation(commandType))
          ) {
            response.status(400).json({
              message: `changeTicket and confirmation "${requiredConfirmation(
                commandType,
              )}" are required`,
            });
            return;
          }
          const idempotencyKey =
            rawIdempotencyKey ||
            createHash('sha256')
              .update(
                `${user.userEntityRef}:${commandType}:${targetEnvironment}:${changeTicket}`,
              )
              .digest('hex');
          const commandId = randomUUID();
          const createdAt = new Date();
          let inserted = true;
          await knex.transaction(async transaction => {
            const result = await transaction('resonance_recovery__command')
              .insert({
                command_id: commandId,
                command_type: commandType,
                target_environment: targetEnvironment,
                status: 'PLANNED',
                requested_by: user.userEntityRef,
                change_ticket: changeTicket,
                idempotency_key: idempotencyKey,
                payload: JSON.stringify({
                  requestedPayload: request.body?.payload ?? {},
                  executionMode: 'QUEUED',
                }),
                created_at: createdAt,
                updated_at: createdAt,
              })
              .onConflict(['target_environment', 'idempotency_key'])
              .ignore()
              .returning('command_id');
            inserted = result.length > 0;
            await transaction('resonance_recovery__audit').insert({
              command_id: inserted ? commandId : null,
              action_code: inserted
                ? 'COMMAND_PLANNED'
                : 'DUPLICATE_COMMAND_IGNORED',
              actor_ref: user.userEntityRef,
              details: JSON.stringify({
                commandType,
                targetEnvironment,
                changeTicket,
                idempotencyKey,
              }),
              created_at: createdAt,
            });
          });
          const command = await knex('resonance_recovery__command')
            .where({ target_environment: targetEnvironment, idempotency_key: idempotencyKey })
            .first();
          response.status(inserted ? 201 : 200).json({
            success: true,
            duplicate: !inserted,
            commandId: command.command_id,
            status: command.status,
            executionMode: 'QUEUED',
          });
        });

        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        httpRouter.use(router);
        logger.info('Resonance recovery control API initialized');
      },
    });
  },
});
