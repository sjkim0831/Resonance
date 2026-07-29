import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request } from 'express';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const COMMANDS = [
  'CREATE_BACKUP',
  'VERIFY_BACKUP',
  'RESTORE_DRILL',
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

const requiredConfirmation = (command: RecoveryCommand) => `EXECUTE ${command}`;

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
          await knex.schema.createTable('resonance_recovery__policy', table => {
            table.string('policy_code', 80).primary();
            table.string('policy_name', 200).notNullable();
            table.jsonb('policy_value').notNullable();
            table.boolean('active').notNullable().defaultTo(true);
            table.timestamp('updated_at', { useTz: true }).notNullable();
          });
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
          await knex.schema.createTable('resonance_recovery__audit', table => {
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
          });
        }
        if (!(await knex.schema.hasTable('resonance_recovery__worker'))) {
          await knex.schema.createTable('resonance_recovery__worker', table => {
            table.string('worker_id', 160).primary();
            table.string('worker_version', 80).notNullable();
            table.jsonb('capabilities').notNullable();
            table.timestamp('last_seen_at', { useTz: true }).notNullable();
          });
        }
        if (!(await knex.schema.hasTable('resonance_recovery__offsite_status'))) {
          await knex.schema.createTable(
            'resonance_recovery__offsite_status',
            table => {
              table.string('reporter_id', 160).primary();
              table.string('status', 32).notNullable();
              table.string('backup_name', 320).notNullable().defaultTo('');
              table.string('sha256', 64).notNullable().defaultTo('');
              table.bigInteger('encrypted_bytes').notNullable().defaultTo(0);
              table.string('encryption', 120).notNullable().defaultTo('');
              table.boolean('restore_verified').notNullable().defaultTo(false);
              table.text('error_message').notNullable().defaultTo('');
              table.timestamp('completed_at', { useTz: true }).nullable();
              table.timestamp('reported_at', { useTz: true }).notNullable();
            },
          );
        }
        const commandColumns = [
          [
            'attempt_count',
            (table: any) =>
              table.integer('attempt_count').notNullable().defaultTo(0),
          ],
          [
            'lease_token',
            (table: any) => table.string('lease_token', 64).nullable(),
          ],
          [
            'lease_until',
            (table: any) =>
              table.timestamp('lease_until', { useTz: true }).nullable(),
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
        for (const [columnName, addColumn] of commandColumns) {
          if (
            !(await knex.schema.hasColumn(
              'resonance_recovery__command',
              columnName,
            ))
          ) {
            await knex.schema.alterTable(
              'resonance_recovery__command',
              addColumn,
            );
          }
        }

        const now = new Date();
        const policySeeds = [
          [
            'BACKUP_RETENTION',
            '백업 보존 정책',
            {
              hourlyDays: 3,
              dailyDays: 30,
              baseBackupCopies: 2,
              maxDiskUsagePercent: 85,
              maxDeletePerRun: 3,
              stalePartialHours: 24,
            },
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
          [
            'RESTORE_DRILL_SCHEDULE',
            '격리 복원 리허설 일정',
            {
              automaticSchedule: true,
              intervalDays: 7,
              staleAfterDays: 8,
            },
          ],
          [
            'OFFSITE_BACKUP_SCHEDULE',
            '독립 저장소 백업 일정',
            {
              automaticSchedule: true,
              intervalHours: 6,
              staleAfterHours: 12,
              requireEncryption: true,
              requireRestoreVerification: true,
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

        const requireWorker = (request: Request) => {
          const configured = process.env.RESONANCE_RECOVERY_WORKER_TOKEN ?? '';
          const authorization = request.header('authorization') ?? '';
          const supplied = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : '';
          const valid =
            configured.length >= 32 &&
            supplied.length === configured.length &&
            timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
          if (!valid) {
            const error = new Error(
              'worker authentication required',
            ) as Error & {
              statusCode?: number;
            };
            error.statusCode = 401;
            throw error;
          }
        };

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
            const error = new Error(
              'recovery operator permission required',
            ) as Error & { statusCode?: number };
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
          const [policies, commands, workers, drillCommands, offsiteStatuses] =
            await Promise.all([
              knex('resonance_recovery__policy')
                .select('*')
                .orderBy('policy_code'),
              knex('resonance_recovery__command')
                .select('*')
                .orderBy('created_at', 'desc')
                .limit(50),
              knex('resonance_recovery__worker')
                .select('*')
                .where(
                  'last_seen_at',
                  '>',
                  new Date(Date.now() - 3 * 60 * 1000),
                )
                .orderBy('last_seen_at', 'desc'),
              knex('resonance_recovery__command')
                .select('*')
                .where({ command_type: 'RESTORE_DRILL' })
                .orderBy('created_at', 'desc')
                .limit(50),
              knex('resonance_recovery__offsite_status')
                .select('*')
                .orderBy('reported_at', 'desc')
                .limit(20),
            ]);
          const parseJsonObject = (value: unknown) => {
            if (value && typeof value === 'object') {
              return value as Record<string, any>;
            }
            if (typeof value === 'string') {
              try {
                return JSON.parse(value) as Record<string, any>;
              } catch {
                return {};
              }
            }
            return {};
          };
          const drillPolicyRow = policies.find(
            policy => policy.policy_code === 'RESTORE_DRILL_SCHEDULE',
          );
          const drillPolicy = parseJsonObject(drillPolicyRow?.policy_value);
          const staleAfterDays = Number(drillPolicy.staleAfterDays ?? 8);
          const latestDrill = drillCommands[0];
          const latestSuccessfulDrill = drillCommands.find(
            command => command.status === 'COMPLETED',
          );
          const successfulPayload = parseJsonObject(
            latestSuccessfulDrill?.payload,
          );
          const successfulResult = parseJsonObject(successfulPayload.result);
          const lastSuccessAt = latestSuccessfulDrill?.finished_at
            ? new Date(latestSuccessfulDrill.finished_at)
            : null;
          const stale =
            !lastSuccessAt ||
            Date.now() - lastSuccessAt.getTime() >
              staleAfterDays * 24 * 60 * 60 * 1000;
          const drillHealth = ['PLANNED', 'RUNNING', 'RETRY'].includes(
            latestDrill?.status,
          )
            ? 'RUNNING'
            : latestDrill?.status === 'FAILED'
            ? 'FAILED'
            : stale
            ? 'STALE'
            : 'HEALTHY';
          const offsitePolicyRow = policies.find(
            policy => policy.policy_code === 'OFFSITE_BACKUP_SCHEDULE',
          );
          const offsitePolicy = parseJsonObject(
            offsitePolicyRow?.policy_value,
          );
          const offsiteStaleAfterHours = Number(
            offsitePolicy.staleAfterHours ?? 12,
          );
          const latestOffsite = offsiteStatuses[0];
          const offsiteCompletedAt = latestOffsite?.completed_at
            ? new Date(latestOffsite.completed_at)
            : null;
          const offsiteStale =
            !offsiteCompletedAt ||
            Date.now() - offsiteCompletedAt.getTime() >
              offsiteStaleAfterHours * 60 * 60 * 1000;
          const offsiteHealth =
            latestOffsite?.status === 'FAILED'
              ? 'FAILED'
              : offsiteStale
              ? 'STALE'
              : latestOffsite?.status === 'VERIFIED'
              ? 'HEALTHY'
              : 'STALE';
          response.json({
            checkedAt: new Date().toISOString(),
            executionMode: 'QUEUED',
            directShellExecution: false,
            workerConnected: workers.length > 0,
            restoreDrill: {
              health: drillHealth,
              automaticSchedule:
                drillPolicyRow?.active !== false &&
                drillPolicy.automaticSchedule !== false,
              intervalDays: Number(drillPolicy.intervalDays ?? 7),
              staleAfterDays,
              latestCommandId: latestDrill?.command_id ?? null,
              latestStatus: latestDrill?.status ?? 'NOT_RUN',
              lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
              durationSeconds: successfulResult.durationSeconds ?? null,
              tableCount: successfulResult.checks?.tableCount ?? null,
              evidenceStatus: successfulResult.status ?? null,
            },
            offsiteBackup: {
              health: offsiteHealth,
              automaticSchedule:
                offsitePolicyRow?.active !== false &&
                offsitePolicy.automaticSchedule !== false,
              intervalHours: Number(offsitePolicy.intervalHours ?? 6),
              staleAfterHours: offsiteStaleAfterHours,
              reporterId: latestOffsite?.reporter_id ?? null,
              latestStatus: latestOffsite?.status ?? 'NOT_REPORTED',
              backupName: latestOffsite?.backup_name ?? null,
              sha256: latestOffsite?.sha256 ?? null,
              encryptedBytes: Number(latestOffsite?.encrypted_bytes ?? 0),
              encryption: latestOffsite?.encryption ?? null,
              restoreVerified: latestOffsite?.restore_verified === true,
              completedAt: offsiteCompletedAt?.toISOString() ?? null,
              reportedAt: latestOffsite?.reported_at ?? null,
              errorMessage: latestOffsite?.error_message ?? '',
            },
            workers: workers.map(worker => ({
              workerId: worker.worker_id,
              version: worker.worker_version,
              capabilities: worker.capabilities,
              lastSeenAt: worker.last_seen_at,
            })),
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
            .where({
              target_environment: targetEnvironment,
              idempotency_key: idempotencyKey,
            })
            .first();
          response.status(inserted ? 201 : 200).json({
            success: true,
            duplicate: !inserted,
            commandId: command.command_id,
            status: command.status,
            executionMode: 'QUEUED',
          });
        });
        router.post('/worker/claim', async (request, response) => {
          requireWorker(request);
          const workerId = String(request.body?.workerId ?? '')
            .trim()
            .slice(0, 160);
          if (!workerId) {
            response.status(400).json({ message: 'workerId is required' });
            return;
          }
          const now = new Date();
          const drillScheduleRow = await knex('resonance_recovery__policy')
            .where({
              policy_code: 'RESTORE_DRILL_SCHEDULE',
              active: true,
            })
            .first();
          let drillSchedule: Record<string, any> = {};
          try {
            drillSchedule =
              typeof drillScheduleRow?.policy_value === 'string'
                ? JSON.parse(drillScheduleRow.policy_value)
                : drillScheduleRow?.policy_value ?? {};
          } catch {
            drillSchedule = {};
          }
          if (drillScheduleRow && drillSchedule.automaticSchedule !== false) {
            const activeDrill = await knex('resonance_recovery__command')
              .where({ command_type: 'RESTORE_DRILL' })
              .whereIn('status', ['PLANNED', 'RUNNING', 'RETRY'])
              .first();
            const latestSuccessfulDrill = await knex(
              'resonance_recovery__command',
            )
              .where({
                command_type: 'RESTORE_DRILL',
                status: 'COMPLETED',
              })
              .orderBy('finished_at', 'desc')
              .first();
            const intervalDays = Math.max(
              1,
              Math.min(30, Number(drillSchedule.intervalDays ?? 7)),
            );
            const due =
              !latestSuccessfulDrill?.finished_at ||
              now.getTime() -
                new Date(latestSuccessfulDrill.finished_at).getTime() >=
                intervalDays * 24 * 60 * 60 * 1000;
            if (!activeDrill && due) {
              const commandId = randomUUID();
              const idempotencyKey = `auto-restore-drill-${now
                .toISOString()
                .slice(0, 10)}`;
              const inserted = await knex('resonance_recovery__command')
                .insert({
                  command_id: commandId,
                  command_type: 'RESTORE_DRILL',
                  target_environment: 'ISOLATED_LOCAL',
                  status: 'PLANNED',
                  requested_by: 'system:restore-drill-scheduler',
                  change_ticket: 'AUTO-RESTORE-DRILL',
                  idempotency_key: idempotencyKey,
                  payload: JSON.stringify({
                    automaticSchedule: true,
                    intervalDays,
                  }),
                  created_at: now,
                  updated_at: now,
                })
                .onConflict(['target_environment', 'idempotency_key'])
                .ignore()
                .returning('command_id');
              if (inserted.length > 0) {
                await knex('resonance_recovery__audit').insert({
                  command_id: commandId,
                  action_code: 'RESTORE_DRILL_AUTO_PLANNED',
                  actor_ref: 'system:restore-drill-scheduler',
                  details: JSON.stringify({
                    intervalDays,
                    idempotencyKey,
                  }),
                  created_at: now,
                });
              }
            }
          }
          await knex('resonance_recovery__worker')
            .insert({
              worker_id: workerId,
              worker_version: String(
                request.body?.workerVersion ?? 'unknown',
              ).slice(0, 80),
              capabilities: JSON.stringify([
                'CREATE_BACKUP',
                'VERIFY_BACKUP',
                'RESTORE_DRILL',
              ]),
              last_seen_at: now,
            })
            .onConflict('worker_id')
            .merge({
              worker_version: String(
                request.body?.workerVersion ?? 'unknown',
              ).slice(0, 80),
              capabilities: JSON.stringify([
                'CREATE_BACKUP',
                'VERIFY_BACKUP',
                'RESTORE_DRILL',
              ]),
              last_seen_at: now,
            });
          let leaseUntil = new Date(now.getTime() + 15 * 60 * 1000);
          const leaseToken = randomUUID();
          const command = await knex.transaction(async transaction => {
            const candidate = await transaction('resonance_recovery__command')
              .whereIn('command_type', [
                'CREATE_BACKUP',
                'VERIFY_BACKUP',
                'RESTORE_DRILL',
              ])
              .where(builder =>
                builder
                  .where({ status: 'PLANNED' })
                  .orWhere(subquery =>
                    subquery
                      .where({ status: 'RETRY' })
                      .andWhere('lease_until', '<', now),
                  )
                  .orWhere(subquery =>
                    subquery
                      .where({ status: 'RUNNING' })
                      .andWhere('lease_until', '<', now),
                  ),
              )
              .andWhere('attempt_count', '<', 3)
              .orderBy('created_at', 'asc')
              .forUpdate()
              .skipLocked()
              .first();
            if (!candidate) return null;
            if (candidate.command_type === 'RESTORE_DRILL') {
              leaseUntil = new Date(now.getTime() + 90 * 60 * 1000);
            }
            await transaction('resonance_recovery__command')
              .where({ command_id: candidate.command_id })
              .update({
                status: 'RUNNING',
                attempt_count: Number(candidate.attempt_count ?? 0) + 1,
                lease_token: leaseToken,
                lease_until: leaseUntil,
                started_at: candidate.started_at ?? now,
                updated_at: now,
              });
            await transaction('resonance_recovery__audit').insert({
              command_id: candidate.command_id,
              action_code: 'COMMAND_CLAIMED',
              actor_ref: `worker:${workerId}`,
              details: JSON.stringify({ leaseUntil }),
              created_at: now,
            });
            return candidate;
          });
          if (!command) {
            response.status(204).end();
            return;
          }
          const retentionRow = await knex('resonance_recovery__policy')
            .where({ policy_code: 'BACKUP_RETENTION', active: true })
            .first();
          let retentionPolicy: Record<string, unknown> = {};
          try {
            retentionPolicy =
              typeof retentionRow?.policy_value === 'string'
                ? JSON.parse(retentionRow.policy_value)
                : retentionRow?.policy_value ?? {};
          } catch {
            retentionPolicy = {};
          }
          response.json({
            commandId: command.command_id,
            commandType: command.command_type,
            targetEnvironment: command.target_environment,
            payload: command.payload,
            retentionPolicy,
            leaseToken,
            leaseUntil,
          });
        });
        router.post(
          '/worker/commands/:commandId/complete',
          async (request, response) => {
            requireWorker(request);
            const commandId = String(request.params.commandId);
            const leaseToken = String(request.body?.leaseToken ?? '');
            const success = request.body?.success === true;
            const workerId = String(request.body?.workerId ?? '')
              .trim()
              .slice(0, 160);
            const result =
              request.body?.result && typeof request.body.result === 'object'
                ? request.body.result
                : {};
            const resultMessage = String(request.body?.message ?? '').slice(
              0,
              2000,
            );
            const now = new Date();
            const updated = await knex.transaction(async transaction => {
              const command = await transaction('resonance_recovery__command')
                .where({
                  command_id: commandId,
                  status: 'RUNNING',
                  lease_token: leaseToken,
                })
                .forUpdate()
                .first();
              if (!command) return null;
              const exhausted = Number(command.attempt_count ?? 0) >= 3;
              const status = success
                ? 'COMPLETED'
                : exhausted
                ? 'FAILED'
                : 'RETRY';
              await transaction('resonance_recovery__command')
                .where({ command_id: commandId })
                .update({
                  status,
                  payload: JSON.stringify({
                    ...(typeof command.payload === 'string'
                      ? JSON.parse(command.payload)
                      : command.payload),
                    result,
                  }),
                  result_message: resultMessage,
                  lease_token: null,
                  lease_until:
                    success || exhausted
                      ? null
                      : new Date(now.getTime() + 5 * 60 * 1000),
                  finished_at: success || exhausted ? now : null,
                  updated_at: now,
                });
              await transaction('resonance_recovery__audit').insert({
                command_id: commandId,
                action_code: success
                  ? 'COMMAND_COMPLETED'
                  : exhausted
                  ? 'COMMAND_FAILED'
                  : 'COMMAND_RETRY_SCHEDULED',
                actor_ref: `worker:${workerId || 'unknown'}`,
                details: JSON.stringify({ result, resultMessage }),
                created_at: now,
              });
              return status;
            });
            if (!updated) {
              response.status(409).json({
                message: 'command lease is stale or command is not running',
              });
              return;
            }
            response.json({ success: true, commandId, status: updated });
          },
        );

        router.post('/worker/offsite-status', async (request, response) => {
          requireWorker(request);
          const reporterId = String(request.body?.reporterId ?? '')
            .trim()
            .slice(0, 160);
          const status = String(request.body?.status ?? '').toUpperCase();
          if (!reporterId || !['VERIFIED', 'FAILED'].includes(status)) {
            response
              .status(400)
              .json({ message: 'valid reporterId and status are required' });
            return;
          }
          const completedAtValue = request.body?.completedAt
            ? new Date(String(request.body.completedAt))
            : null;
          if (
            completedAtValue &&
            Number.isNaN(completedAtValue.getTime())
          ) {
            response.status(400).json({ message: 'completedAt is invalid' });
            return;
          }
          const reportedAt = new Date();
          const row = {
            reporter_id: reporterId,
            status,
            backup_name: String(request.body?.backupName ?? '').slice(0, 320),
            sha256: String(request.body?.sha256 ?? '')
              .toLowerCase()
              .slice(0, 64),
            encrypted_bytes: Math.max(
              0,
              Number(request.body?.encryptedBytes ?? 0),
            ),
            encryption: String(request.body?.encryption ?? '').slice(0, 120),
            restore_verified: request.body?.restoreVerified === true,
            error_message: String(request.body?.errorMessage ?? '').slice(
              0,
              2000,
            ),
            completed_at: completedAtValue,
            reported_at: reportedAt,
          };
          await knex('resonance_recovery__offsite_status')
            .insert(row)
            .onConflict('reporter_id')
            .merge(row);
          await knex('resonance_recovery__audit').insert({
            command_id: null,
            action_code: `OFFSITE_BACKUP_${status}`,
            actor_ref: `worker:${reporterId}`,
            details: JSON.stringify({
              backupName: row.backup_name,
              sha256: row.sha256,
              encryptedBytes: row.encrypted_bytes,
              encryption: row.encryption,
              restoreVerified: row.restore_verified,
            }),
            created_at: reportedAt,
          });
          response.json({ success: true, reporterId, status, reportedAt });
        });

        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/worker',
          allow: 'unauthenticated',
        });
        httpRouter.use(router);
        logger.info('Resonance recovery control API initialized');
      },
    });
  },
});
