import { buildRouteFamilyAggregates } from "../../../framework/registry/routeFamilyAggregates";
import { normalizeRegistryPath } from "../../../framework/registry/pathNormalization";
import { EXTERNAL_ROUTE_FAMILIES } from "../../../platform/routes/platformRouteRegistry";
import { ADMIN_MEMBER_FAMILY } from "./adminMemberFamily";
import { ADMIN_SYSTEM_FAMILY } from "./adminSystemFamily";
import { APP_OWNED_FAMILY } from "./appOwnedFamily";
import { CONTENT_SUPPORT_FAMILY } from "./contentSupportFamily";
import { EMISSION_MONITORING_FAMILY } from "./emissionMonitoringFamily";
import { HOME_EXPERIENCE_FAMILY } from "./homeExperienceFamily";
import { TRADE_PAYMENT_FAMILY } from "./tradePaymentFamily";

export const APP_ROUTE_FAMILIES = [
  APP_OWNED_FAMILY,
  ADMIN_MEMBER_FAMILY,
  TRADE_PAYMENT_FAMILY,
  EMISSION_MONITORING_FAMILY,
  ADMIN_SYSTEM_FAMILY,
  CONTENT_SUPPORT_FAMILY,
  HOME_EXPERIENCE_FAMILY
] as const;

export const ALL_ROUTE_FAMILIES = [
  ...APP_ROUTE_FAMILIES,
  ...EXTERNAL_ROUTE_FAMILIES
] as const;

export const ALL_ROUTE_FAMILY_CLOSEOUTS = ALL_ROUTE_FAMILIES.map((family) => family.closeout);
export const ALL_ROUTE_CLOSEOUT_BINDINGS = ALL_ROUTE_FAMILIES.flatMap((family) =>
  family.routeDefinitions.map((routeDefinition) => ({
    routeId: routeDefinition.id,
    closeout: family.closeout
  }))
);

export const {
  definitions: ALL_ROUTE_DEFINITIONS,
  pageUnits: ALL_ROUTE_PAGE_UNITS
} = buildRouteFamilyAggregates(ALL_ROUTE_FAMILIES);

const KNOWN_ROUTE_PATHS = new Set(
  ALL_ROUTE_DEFINITIONS.flatMap((definition) => [
    normalizeRegistryPath(definition.koPath),
    normalizeRegistryPath(definition.enPath)
  ])
);

function reportRouteCloseoutValidation(message: string) {
  if (typeof console !== "undefined") {
    console.error(`[route-closeout-validation] ${message}`);
  }
}

ALL_ROUTE_FAMILY_CLOSEOUTS.forEach((closeout) => {
  const bootstrapPayloadTarget = normalizeRegistryPath(closeout.installDeploy.bootstrapPayloadTarget);
  if (!KNOWN_ROUTE_PATHS.has(bootstrapPayloadTarget)) {
    reportRouteCloseoutValidation(`Unknown bootstrap payload target for route family ${closeout.familyId}: ${bootstrapPayloadTarget}`);
  }

  const runtimeVerificationTarget = normalizeRegistryPath(closeout.installDeploy.runtimeVerificationTarget);
  if (!KNOWN_ROUTE_PATHS.has(runtimeVerificationTarget)) {
    reportRouteCloseoutValidation(`Unknown runtime verification target for route family ${closeout.familyId}: ${runtimeVerificationTarget}`);
  }

  const compareTarget = normalizeRegistryPath(closeout.installDeploy.compareTarget);
  if (!KNOWN_ROUTE_PATHS.has(compareTarget)) {
    reportRouteCloseoutValidation(`Unknown compare target for route family ${closeout.familyId}: ${compareTarget}`);
  }

  closeout.pageContracts.forEach((pageContract) => {
    const canonicalRoute = normalizeRegistryPath(pageContract.canonicalRoute);
    if (!KNOWN_ROUTE_PATHS.has(canonicalRoute)) {
      reportRouteCloseoutValidation(`Unknown canonical route for route family ${closeout.familyId}: ${canonicalRoute}`);
    }

    const pageRuntimeVerificationTarget = normalizeRegistryPath(pageContract.runtimeVerificationTarget);
    if (!KNOWN_ROUTE_PATHS.has(pageRuntimeVerificationTarget)) {
      reportRouteCloseoutValidation(
        `Unknown page runtime verification target for route family ${closeout.familyId}: ${pageRuntimeVerificationTarget}`
      );
    }
  });
});
