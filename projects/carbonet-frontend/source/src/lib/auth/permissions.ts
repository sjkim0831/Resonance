import type { FrontendSession } from "../api/adminShellTypes";
import type { AuthGroupPagePayload } from "../api/authTypes";

export type UiPermissions = {
  canViewGeneralAuthGroupSection: boolean;
  canViewScopedAuthGroupSection: boolean;
  canUseGeneralAuthGroupCreate: boolean;
  canUseScopedAuthGroupCreate: boolean;
  canUseGeneralFeatureSave: boolean;
  canUseScopedFeatureSave: boolean;
};

function hasCapability(session: FrontendSession | null, capability: string) {
  return !!session?.capabilityCodes.includes(capability);
}

export function deriveUiPermissions(
  session: FrontendSession | null,
  page: AuthGroupPagePayload | null
): UiPermissions {
  const isWebmaster = !!page?.isWebmaster;
  const ownCompanyScope = session?.companyScope === "own-company";
  const roleCategory = page?.selectedRoleCategory || "GENERAL";
  const canViewGeneralAuthGroupSection =
    isWebmaster || hasCapability(session, "auth.group.general.view");
  const canViewScopedAuthGroupSection = isWebmaster || ownCompanyScope;
  const canUseGeneralAuthGroupCreate = isWebmaster && roleCategory === "GENERAL";
  const canUseScopedAuthGroupCreate =
    roleCategory !== "GENERAL" && (isWebmaster || ownCompanyScope) && !!page?.canManageScopedAuthorityGroups;
  const canUseGeneralFeatureSave = isWebmaster && roleCategory === "GENERAL";
  const canUseScopedFeatureSave = roleCategory !== "GENERAL" && (isWebmaster || ownCompanyScope);

  return {
    canViewGeneralAuthGroupSection,
    canViewScopedAuthGroupSection,
    canUseGeneralAuthGroupCreate,
    canUseScopedAuthGroupCreate,
    canUseGeneralFeatureSave,
    canUseScopedFeatureSave
  };
}
