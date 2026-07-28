import { createApp } from '@backstage/frontend-defaults';
import {
  BackstageIdentityApi,
  OpenIdConnectApi,
  ProfileInfoApi,
  SessionApi,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { SignInPage } from '@backstage/core-components';
import {
  ApiBlueprint,
  configApiRef,
  createApiRef,
  createFrontendModule,
  discoveryApiRef,
  oauthRequestApiRef,
  useApi,
} from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { ccusScreenDesignsPlugin } from './plugins/ccus-screen-designs/plugin';

const resonanceOidcAuthApiRef = createApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
>().with({ id: 'auth.resonance-oidc' });

const resonanceOidcAuthApi = ApiBlueprint.make({
  name: 'resonance-oidc',
  params: defineParams =>
    defineParams({
      api: resonanceOidcAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
        OAuth2.create({
          configApi,
          discoveryApi,
          oauthRequestApi,
          environment: configApi.getOptionalString('auth.environment'),
          provider: {
            id: 'oidc',
            title:
              configApi.getOptionalString('app.resonanceOidcDisplayName') ??
              'Resonance 계정',
            icon: () => null,
          },
          defaultScopes: ['openid', 'profile', 'email', 'groups'],
        }),
    }),
});

const resonanceSignInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props => {
      const configApi = useApi(configApiRef);
      if (!configApi.getOptionalBoolean('app.resonanceOidcEnabled')) {
        return <SignInPage {...props} providers={['guest']} />;
      }
      const title =
        configApi.getOptionalString('app.resonanceOidcDisplayName') ??
        'Resonance 계정';
      return (
        <SignInPage
          {...props}
          provider={{
            id: 'resonance-oidc-auth-provider',
            title,
            message: `${title}(으)로 로그인`,
            apiRef: resonanceOidcAuthApiRef,
          }}
        />
      );
    },
  },
});

export default createApp({
  features: [
    catalogPlugin,
    ccusScreenDesignsPlugin,
    navModule,
    createFrontendModule({
      pluginId: 'app',
      extensions: [resonanceOidcAuthApi, resonanceSignInPage],
    }),
  ],
});
