import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request } from 'express';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  requiredActions?: string[];
  attributes?: Record<string, string[]>;
};

type KeycloakGroup = {
  id: string;
  name: string;
};

const managedGroups = [
  'platform-engineering',
  'carbon-operations',
  'verification-governance',
];

const isValidNetworkValue = (ruleType: string, value: string) => {
  if (ruleType === 'BLOCK_SUBJECT') {
    return /^[A-Za-z0-9@._:*\/-]{1,200}$/.test(value);
  }
  const [address, prefix] = value.split('/');
  const version = isIP(address);
  if (!version) return false;
  if (prefix === undefined) return true;
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const parsed = Number(prefix);
  return parsed >= 0 && parsed <= (version === 4 ? 32 : 128);
};

const normalizeScopes = (
  value: unknown,
  fallback: string[],
  pattern: RegExp,
) => {
  const values = Array.isArray(value) ? value.map(String) : [];
  const normalized = [
    ...new Set(values.map(item => item.trim()).filter(Boolean)),
  ];
  const resolved = normalized.length > 0 ? normalized : fallback;
  if (!resolved.every(item => pattern.test(item))) {
    throw new Error('invalid identity scope');
  }
  return resolved;
};

const identityAttributes = (body: Record<string, unknown>) => {
  const tenantId = String(body.tenantId ?? 'DEFAULT').trim() || 'DEFAULT';
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(tenantId)) {
    throw new Error('invalid tenant scope');
  }
  return {
    resonanceTenantId: [tenantId],
    resonanceProjectScopes: normalizeScopes(
      body.projectScopes,
      ['*'],
      /^[A-Za-z0-9*_.:-]{1,100}$/,
    ),
    resonanceDataScopes: normalizeScopes(
      body.dataScopes,
      ['*'],
      /^[A-Za-z0-9*_.:/-]{1,80}$/,
    ),
  };
};

const requestedIdentityAttributes = (
  body: Record<string, unknown>,
  current: Record<string, string[]> = {},
) => {
  if (
    !('tenantId' in body) &&
    !('projectScopes' in body) &&
    !('dataScopes' in body)
  ) {
    return {};
  }
  return identityAttributes({
    tenantId: body.tenantId ?? current.resonanceTenantId?.[0],
    projectScopes: body.projectScopes ?? current.resonanceProjectScopes,
    dataScopes: body.dataScopes ?? current.resonanceDataScopes,
  });
};

const keycloakUpdateRepresentation = (
  current: KeycloakUser,
  body: Record<string, unknown>,
) => ({
  username: current.username,
  email:
    current.email ||
    `${current.username || String(body.username ?? 'account')}@resonance.local`,
  firstName:
    current.firstName || current.username || String(body.username ?? 'Account'),
  lastName: current.lastName || current.username || 'Account',
  emailVerified: current.emailVerified !== false,
  requiredActions: current.requiredActions ?? [],
  enabled:
    'enabled' in body ? Boolean(body.enabled) : current.enabled !== false,
  attributes: {
    ...(current.attributes ?? {}),
    ...requestedIdentityAttributes(body, current.attributes),
  },
});

export default createBackendPlugin({
  pluginId: 'resonance-identity-admin',
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
        if (!(await knex.schema.hasTable('resonance_identity_admin__audit'))) {
          await knex.schema.createTable(
            'resonance_identity_admin__audit',
            table => {
              table.bigIncrements('audit_id').primary();
              table.string('actor_ref', 300).notNullable();
              table.string('target_username', 100).notNullable();
              table.string('action_code', 50).notNullable();
              table.jsonb('details').notNullable().defaultTo('{}');
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.index(
                ['target_username', 'created_at'],
                'resonance_identity_admin_audit_target_idx',
              );
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_identity_admin__security_policy',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_identity_admin__security_policy',
            table => {
              table.string('policy_code', 80).primary();
              table.string('policy_name', 160).notNullable();
              table.text('description').notNullable().defaultTo('');
              table.boolean('enabled').notNullable().defaultTo(true);
              table.jsonb('configuration').notNullable().defaultTo('{}');
              table.string('updated_by', 300).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
            },
          );
        }
        if (
          !(await knex.schema.hasTable(
            'resonance_identity_admin__network_rule',
          ))
        ) {
          await knex.schema.createTable(
            'resonance_identity_admin__network_rule',
            table => {
              table.string('rule_id', 36).primary();
              table.string('rule_type', 30).notNullable();
              table.string('rule_value', 200).notNullable();
              table.string('reason', 500).notNullable().defaultTo('');
              table.boolean('enabled').notNullable().defaultTo(true);
              table.timestamp('expires_at', { useTz: true }).nullable();
              table.string('created_by', 300).notNullable();
              table.timestamp('created_at', { useTz: true }).notNullable();
              table.timestamp('updated_at', { useTz: true }).notNullable();
              table.unique(
                ['rule_type', 'rule_value'],
                'resonance_identity_network_rule_unique',
              );
              table.index(
                ['rule_type', 'enabled'],
                'resonance_identity_network_rule_status_idx',
              );
            },
          );
        }
        const now = new Date();
        await knex('resonance_identity_admin__security_policy')
          .insert([
            {
              policy_code: 'PASSWORD_BASELINE',
              policy_name: '비밀번호 기준',
              description: '통합 계정 비밀번호의 최소 보안 기준',
              enabled: true,
              configuration: JSON.stringify({
                minimumLength: 12,
                requireComplexity: true,
              }),
              updated_by: 'system:bootstrap',
              updated_at: now,
            },
            {
              policy_code: 'SESSION_SECURITY',
              policy_name: '세션 보안',
              description: '관리 세션 만료와 재인증 기준',
              enabled: true,
              configuration: JSON.stringify({
                idleMinutes: 30,
                absoluteMinutes: 480,
              }),
              updated_by: 'system:bootstrap',
              updated_at: now,
            },
            {
              policy_code: 'MFA_ADMIN',
              policy_name: '관리자 MFA',
              description: '관리 권한 계정의 다중 인증 적용 기준',
              enabled: false,
              configuration: JSON.stringify({ required: false }),
              updated_by: 'system:bootstrap',
              updated_at: now,
            },
            {
              policy_code: 'AUDIT_RETENTION',
              policy_name: '감사 보존',
              description: '보안·계정 변경 감사 기록 보존 기준',
              enabled: true,
              configuration: JSON.stringify({ retentionDays: 365 }),
              updated_by: 'system:bootstrap',
              updated_at: now,
            },
          ])
          .onConflict('policy_code')
          .ignore();

        const metadataUrl = process.env.AUTH_OIDC_METADATA_URL ?? '';
        const clientId = process.env.AUTH_OIDC_CLIENT_ID ?? '';
        const clientSecret = process.env.AUTH_OIDC_CLIENT_SECRET ?? '';
        const issuer = metadataUrl.replace(
          '/.well-known/openid-configuration',
          '',
        );
        const realmBase = issuer.replace(/\/realms\/[^/]+$/, '');
        const adminBase = `${realmBase}/admin/realms/resonance`;
        const tokenEndpoint = `${issuer}/protocol/openid-connect/token`;
        let cachedToken = '';
        let cachedTokenUntil = 0;

        const getAdminToken = async () => {
          if (cachedToken && Date.now() < cachedTokenUntil) return cachedToken;
          if (!clientId || !clientSecret || !issuer) {
            throw new Error(
              'Keycloak service account configuration is missing',
            );
          }
          const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          });
          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          });
          if (!response.ok) {
            throw new Error(
              `Keycloak token request failed: ${response.status}`,
            );
          }
          const payload = (await response.json()) as {
            access_token?: string;
            expires_in?: number;
          };
          if (!payload.access_token) {
            throw new Error('Keycloak token response is missing access_token');
          }
          cachedToken = payload.access_token;
          cachedTokenUntil =
            Date.now() + Math.max(10, (payload.expires_in ?? 60) - 15) * 1000;
          return cachedToken;
        };

        const keycloak = async <T>(
          path: string,
          init: RequestInit = {},
        ): Promise<T> => {
          const token = await getAdminToken();
          const response = await fetch(`${adminBase}${path}`, {
            ...init,
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
              ...init.headers,
            },
          });
          if (!response.ok) {
            const message = await response.text();
            throw new Error(
              `Keycloak ${init.method ?? 'GET'} ${path} failed: ${
                response.status
              } ${message.slice(0, 300)}`,
            );
          }
          if (response.status === 204 || response.status === 201) {
            return undefined as T;
          }
          return (await response.json()) as T;
        };

        const requireAdmin = async (request: Request) => {
          const credentials = await httpAuth.credentials(request, {
            allow: ['user'],
          });
          const user = await userInfo.getUserInfo(credentials);
          const catalogAuthorized = user.ownershipEntityRefs.includes(
            'group:default/verification-governance',
          );
          const username = user.userEntityRef.split('/').at(-1) ?? '';
          const keycloakUsers = catalogAuthorized
            ? []
            : await keycloak<KeycloakUser[]>(
                `/users?username=${encodeURIComponent(username)}&exact=true`,
              );
          const keycloakGroups =
            catalogAuthorized || !keycloakUsers[0]
              ? []
              : await keycloak<KeycloakGroup[]>(
                  `/users/${encodeURIComponent(keycloakUsers[0].id)}/groups`,
                );
          const keycloakAuthorized = keycloakGroups.some(
            group => group.name === 'verification-governance',
          );
          if (!catalogAuthorized && !keycloakAuthorized) {
            const error = new Error(
              'verification-governance membership is required',
            ) as Error & { statusCode?: number };
            error.statusCode = 403;
            throw error;
          }
          return user.userEntityRef;
        };

        const audit = async (
          actorRef: string,
          targetUsername: string,
          actionCode: string,
          details: Record<string, unknown> = {},
        ) => {
          await knex('resonance_identity_admin__audit').insert({
            actor_ref: actorRef,
            target_username: targetUsername,
            action_code: actionCode,
            details: JSON.stringify(details),
            created_at: new Date(),
          });
        };

        const listGroups = () =>
          keycloak<KeycloakGroup[]>('/groups?briefRepresentation=true');

        const setGroups = async (userId: string, names: string[]) => {
          const available = (await listGroups()).filter(group =>
            managedGroups.includes(group.name),
          );
          const current = await keycloak<KeycloakGroup[]>(
            `/users/${encodeURIComponent(userId)}/groups`,
          );
          const desired = new Set(
            names.filter(name => managedGroups.includes(name)),
          );
          for (const group of available) {
            const hasGroup = current.some(item => item.id === group.id);
            if (desired.has(group.name) && !hasGroup) {
              await keycloak(
                `/users/${encodeURIComponent(
                  userId,
                )}/groups/${encodeURIComponent(group.id)}`,
                { method: 'PUT' },
              );
            } else if (!desired.has(group.name) && hasGroup) {
              await keycloak(
                `/users/${encodeURIComponent(
                  userId,
                )}/groups/${encodeURIComponent(group.id)}`,
                { method: 'DELETE' },
              );
            }
          }
        };

        const router = Router();
        router.use(json({ limit: '1mb' }));

        router.get('/summary', async (request, response, next) => {
          try {
            await requireAdmin(request);
            const [users, groups, auditRows] = await Promise.all([
              keycloak<KeycloakUser[]>(
                '/users?max=500&briefRepresentation=false',
              ),
              listGroups(),
              knex('resonance_identity_admin__audit')
                .select('action_code')
                .count({ count: '*' })
                .groupBy('action_code') as Promise<
                { action_code: string; count: string | number }[]
              >,
            ]);
            response.json({
              checkedAt: new Date().toISOString(),
              identityProvider: {
                code: 'KEYCLOAK',
                status: 'UP',
                issuerConfigured: Boolean(issuer),
              },
              identities: {
                total: users.length,
                enabled: users.filter(user => user.enabled !== false).length,
                disabled: users.filter(user => user.enabled === false).length,
              },
              groups: {
                total: groups.length,
                managed: groups
                  .filter(group => managedGroups.includes(group.name))
                  .map(group => group.name),
              },
              auditCounts: Object.fromEntries(
                auditRows.map(row => [row.action_code, Number(row.count)]),
              ),
            });
          } catch (error) {
            next(error);
          }
        });

        router.get('/security-controls', async (request, response, next) => {
          try {
            await requireAdmin(request);
            const [policies, networkRules] = await Promise.all([
              knex('resonance_identity_admin__security_policy')
                .select('*')
                .orderBy('policy_code'),
              knex('resonance_identity_admin__network_rule')
                .select('*')
                .orderBy('created_at', 'desc'),
            ]);
            response.json({
              policies: policies.map(row => ({
                policyCode: row.policy_code,
                policyName: row.policy_name,
                description: row.description,
                enabled: Boolean(row.enabled),
                configuration: row.configuration,
                updatedBy: row.updated_by,
                updatedAt: row.updated_at,
              })),
              networkRules: networkRules.map(row => ({
                ruleId: row.rule_id,
                ruleType: row.rule_type,
                value: row.rule_value,
                reason: row.reason,
                enabled: Boolean(row.enabled),
                expiresAt: row.expires_at,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              })),
            });
          } catch (error) {
            next(error);
          }
        });

        router.put(
          '/security-controls/policies/:code',
          async (request, response, next) => {
            try {
              const actorRef = await requireAdmin(request);
              const policyCode = String(request.params.code ?? '')
                .trim()
                .toUpperCase();
              if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(policyCode)) {
                response.status(400).json({ message: 'invalid policy code' });
                return;
              }
              const configuration = request.body?.configuration;
              if (
                !configuration ||
                typeof configuration !== 'object' ||
                Array.isArray(configuration) ||
                JSON.stringify(configuration).length > 20_000
              ) {
                response
                  .status(400)
                  .json({ message: 'invalid policy configuration' });
                return;
              }
              const updatedAt = new Date();
              await knex.transaction(async trx => {
                const changed = await trx(
                  'resonance_identity_admin__security_policy',
                )
                  .where({ policy_code: policyCode })
                  .update({
                    enabled: Boolean(request.body?.enabled),
                    configuration: JSON.stringify(configuration),
                    updated_by: actorRef,
                    updated_at: updatedAt,
                  });
                if (!changed) throw new Error('security policy not found');
                await trx('resonance_identity_admin__audit').insert({
                  actor_ref: actorRef,
                  target_username: policyCode,
                  action_code: 'SECURITY_POLICY_UPDATED',
                  details: JSON.stringify({
                    enabled: Boolean(request.body?.enabled),
                  }),
                  created_at: updatedAt,
                });
              });
              response.json({ policyCode, updatedAt });
            } catch (error) {
              next(error);
            }
          },
        );

        router.post(
          '/security-controls/network-rules',
          async (request, response, next) => {
            try {
              const actorRef = await requireAdmin(request);
              const ruleType = String(request.body?.ruleType ?? '').trim();
              const value = String(request.body?.value ?? '').trim();
              const reason = String(request.body?.reason ?? '').trim();
              if (
                !['ALLOW_IP', 'BLOCK_IP', 'BLOCK_SUBJECT'].includes(ruleType) ||
                !isValidNetworkValue(ruleType, value) ||
                reason.length > 500
              ) {
                response.status(400).json({ message: 'invalid network rule' });
                return;
              }
              const expiresAt = request.body?.expiresAt
                ? new Date(String(request.body.expiresAt))
                : null;
              if (expiresAt && Number.isNaN(expiresAt.getTime())) {
                response.status(400).json({ message: 'invalid expiry' });
                return;
              }
              const ruleId = randomUUID();
              const createdAt = new Date();
              await knex.transaction(async trx => {
                await trx('resonance_identity_admin__network_rule').insert({
                  rule_id: ruleId,
                  rule_type: ruleType,
                  rule_value: value,
                  reason,
                  enabled: true,
                  expires_at: expiresAt,
                  created_by: actorRef,
                  created_at: createdAt,
                  updated_at: createdAt,
                });
                await trx('resonance_identity_admin__audit').insert({
                  actor_ref: actorRef,
                  target_username: value,
                  action_code: 'NETWORK_RULE_CREATED',
                  details: JSON.stringify({ ruleId, ruleType }),
                  created_at: createdAt,
                });
              });
              response.status(201).json({ ruleId, createdAt });
            } catch (error) {
              next(error);
            }
          },
        );

        router.patch(
          '/security-controls/network-rules/:id',
          async (request, response, next) => {
            try {
              const actorRef = await requireAdmin(request);
              const ruleId = String(request.params.id ?? '');
              if (!/^[0-9a-f-]{36}$/.test(ruleId)) {
                response.status(400).json({ message: 'invalid rule id' });
                return;
              }
              const updatedAt = new Date();
              await knex.transaction(async trx => {
                const changed = await trx(
                  'resonance_identity_admin__network_rule',
                )
                  .where({ rule_id: ruleId })
                  .update({
                    enabled: Boolean(request.body?.enabled),
                    updated_at: updatedAt,
                  });
                if (!changed) throw new Error('network rule not found');
                await trx('resonance_identity_admin__audit').insert({
                  actor_ref: actorRef,
                  target_username: ruleId,
                  action_code: 'NETWORK_RULE_STATUS_UPDATED',
                  details: JSON.stringify({
                    enabled: Boolean(request.body?.enabled),
                  }),
                  created_at: updatedAt,
                });
              });
              response.json({ ruleId, updatedAt });
            } catch (error) {
              next(error);
            }
          },
        );

        router.get('/identities', async (request, response, next) => {
          try {
            await requireAdmin(request);
            const users = await keycloak<KeycloakUser[]>(
              '/users?max=500&briefRepresentation=false',
            );
            const identities = await Promise.all(
              users.map(async user => ({
                id: user.id,
                username: user.username ?? '',
                displayName: [user.firstName, user.lastName]
                  .filter(Boolean)
                  .join(' '),
                email: user.email ?? '',
                enabled: user.enabled !== false,
                tenantId: user.attributes?.resonanceTenantId?.[0] ?? 'DEFAULT',
                projectScopes: user.attributes?.resonanceProjectScopes ?? ['*'],
                dataScopes: user.attributes?.resonanceDataScopes ?? ['*'],
                groups: (
                  await keycloak<KeycloakGroup[]>(
                    `/users/${encodeURIComponent(user.id)}/groups`,
                  )
                )
                  .map(group => group.name)
                  .filter(name => managedGroups.includes(name)),
              })),
            );
            response.json({ identities, managedGroups });
          } catch (error) {
            next(error);
          }
        });

        router.post('/identities', async (request, response, next) => {
          try {
            const actorRef = await requireAdmin(request);
            const username = String(request.body?.username ?? '')
              .trim()
              .toLocaleLowerCase('en-US');
            const password = String(request.body?.password ?? '');
            const groups = Array.isArray(request.body?.groups)
              ? request.body.groups.map(String)
              : [];
            if (!/^[a-z0-9_.-]{3,63}$/.test(username)) {
              response.status(400).json({ message: 'invalid username' });
              return;
            }
            if (password.length < 8) {
              response.status(400).json({
                message: 'password must contain at least 8 characters',
              });
              return;
            }
            await keycloak('/users', {
              method: 'POST',
              body: JSON.stringify({
                username,
                enabled: true,
                email: String(
                  request.body?.email ?? `${username}@resonance.local`,
                ),
                firstName: String(request.body?.displayName ?? username),
                lastName: username,
                emailVerified: true,
                requiredActions: [],
                attributes: identityAttributes(request.body ?? {}),
              }),
            });
            const matches = await keycloak<KeycloakUser[]>(
              `/users?username=${encodeURIComponent(username)}&exact=true`,
            );
            const user = matches[0];
            if (!user)
              throw new Error('created Keycloak identity was not found');
            await keycloak(
              `/users/${encodeURIComponent(user.id)}/reset-password`,
              {
                method: 'PUT',
                body: JSON.stringify({
                  type: 'password',
                  value: password,
                  temporary: Boolean(request.body?.temporaryPassword ?? true),
                }),
              },
            );
            await setGroups(user.id, groups);
            await audit(actorRef, username, 'IDENTITY_CREATED', { groups });
            response.status(201).json({ id: user.id, username });
          } catch (error) {
            next(error);
          }
        });

        router.put('/identities/:id', async (request, response, next) => {
          try {
            const actorRef = await requireAdmin(request);
            const id = String(request.params.id);
            const username = String(request.body?.username ?? '');
            const current = await keycloak<KeycloakUser>(
              `/users/${encodeURIComponent(id)}`,
            );
            if ('enabled' in (request.body ?? {})) {
              await keycloak(`/users/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify(
                  keycloakUpdateRepresentation(current, request.body ?? {}),
                ),
              });
            } else if (
              'tenantId' in (request.body ?? {}) ||
              'projectScopes' in (request.body ?? {}) ||
              'dataScopes' in (request.body ?? {})
            ) {
              await keycloak(`/users/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify(
                  keycloakUpdateRepresentation(current, request.body ?? {}),
                ),
              });
            }
            if (Array.isArray(request.body?.groups)) {
              await setGroups(id, request.body.groups.map(String));
            }
            const password = String(request.body?.password ?? '');
            if (password) {
              if (password.length < 8) {
                response.status(400).json({
                  message: 'password must contain at least 8 characters',
                });
                return;
              }
              await keycloak(
                `/users/${encodeURIComponent(id)}/reset-password`,
                {
                  method: 'PUT',
                  body: JSON.stringify({
                    type: 'password',
                    value: password,
                    temporary: Boolean(request.body?.temporaryPassword ?? true),
                  }),
                },
              );
            }
            await audit(actorRef, username, 'IDENTITY_UPDATED', {
              enabled: request.body?.enabled,
              groups: request.body?.groups,
              tenantId: request.body?.tenantId,
              projectScopes: request.body?.projectScopes,
              dataScopes: request.body?.dataScopes,
              passwordReset: Boolean(password),
            });
            response.json({ status: 'UPDATED' });
          } catch (error) {
            next(error);
          }
        });

        router.get('/audit', async (request, response, next) => {
          try {
            await requireAdmin(request);
            const rows = await knex('resonance_identity_admin__audit')
              .orderBy('audit_id', 'desc')
              .limit(200);
            response.json({
              audit: rows.map(row => ({
                auditId: String(row.audit_id),
                actorRef: row.actor_ref,
                targetUsername: row.target_username,
                actionCode: row.action_code,
                details: row.details,
                createdAt: row.created_at,
              })),
            });
          } catch (error) {
            next(error);
          }
        });

        httpRouter.use(router);
        logger.info('Resonance identity administration API initialized');
      },
    });
  },
});
