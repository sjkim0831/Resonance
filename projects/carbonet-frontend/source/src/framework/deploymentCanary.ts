/**
 * Compile-only deployment canary.
 *
 * This contract deliberately has no visual side effects. Updating its revision
 * exercises the complete frontend typecheck, Vite asset closure, live overlay,
 * responsive smoke test, rollback guard, and deployment performance SLO.
 */
export const FRONTEND_DEPLOYMENT_CANARY = Object.freeze({
  contractVersion: "1.0.0",
  revision: "2026-07-31T00:00:00+09:00",
  requiredChecks: [
    "typescript",
    "vite-asset-closure",
    "react-mount",
    "desktop-critical-routes",
    "mobile-critical-routes",
    "rollback-guard",
    "deploy-performance-slo",
  ],
} as const);
