export interface Config {
  app: {
    /**
     * Enables the Resonance OIDC sign-in provider.
     * @visibility frontend
     */
    resonanceOidcEnabled?: boolean;

    /**
     * User-facing name of the Resonance OIDC provider.
     * @visibility frontend
     */
    resonanceOidcDisplayName?: string;
  };
}
