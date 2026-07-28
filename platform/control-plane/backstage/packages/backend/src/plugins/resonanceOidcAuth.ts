import { DEFAULT_NAMESPACE, stringifyEntityRef } from '@backstage/catalog-model';
import { createBackendModule } from '@backstage/backend-plugin-api';
import { oidcAuthenticator } from '@backstage/plugin-auth-backend-module-oidc-provider';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

const normalizeName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

const claimGroups = (claims: Record<string, unknown>) => {
  const raw = claims.groups;
  const groups = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,\s]+/)
      : [];
  return groups
    .map(value => String(value))
    .map(value =>
      value.startsWith('group:')
        ? value
        : stringifyEntityRef({
            kind: 'Group',
            namespace: DEFAULT_NAMESPACE,
            name: normalizeName(value),
          }),
    )
    .filter(value => !value.endsWith('/'));
};

export const resonanceOidcAuth = createBackendModule({
  pluginId: 'auth',
  moduleId: 'resonance-oidc-provider',
  register(registration) {
    registration.registerInit({
      deps: { providers: authProvidersExtensionPoint },
      async init({ providers }) {
        providers.registerProvider({
          providerId: 'oidc',
          factory: createOAuthProviderFactory({
            authenticator: oidcAuthenticator,
            async signInResolver(info, context) {
              const claims = info.result.fullProfile.userinfo as Record<
                string,
                unknown
              >;
              const email =
                typeof claims.email === 'string' ? claims.email : undefined;
              const preferredUsername =
                typeof claims.preferred_username === 'string'
                  ? claims.preferred_username
                  : undefined;
              const subject = String(claims.sub ?? '');
              const localPart = email?.split('@')[0];
              const name = normalizeName(
                preferredUsername || localPart || subject,
              );
              if (!name) {
                throw new Error('OIDC identity is missing a usable sub or email');
              }
              const userRef = stringifyEntityRef({
                kind: 'User',
                namespace: DEFAULT_NAMESPACE,
                name,
              });
              return context.issueToken({
                claims: {
                  sub: userRef,
                  ent: [userRef, ...claimGroups(claims)],
                },
              });
            },
          }),
        });
      },
    });
  },
});
