import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { Router, json, type Request } from 'express';

type KeycloakUser = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
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
          if (
            !user.ownershipEntityRefs.includes(
              'group:default/verification-governance',
            )
          ) {
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

        router.get('/identities', async (request, response, next) => {
          try {
            await requireAdmin(request);
            const users = await keycloak<KeycloakUser[]>(
              '/users?max=500&briefRepresentation=true',
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
                emailVerified: true,
                requiredActions: [],
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
            if ('enabled' in (request.body ?? {})) {
              await keycloak(`/users/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify({
                  enabled: Boolean(request.body.enabled),
                }),
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
