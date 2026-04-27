import { ENVIRONMENT_MANAGEMENT_FAMILY } from "../../features/environment-management/environmentManagementFamily";
import { PROJECT_VERSION_MANAGEMENT_FAMILY } from "../../features/project-version-management/projectVersionManagementFamily";
import { SCREEN_BUILDER_FAMILY } from "../../features/screen-builder/screenBuilderFamily";
import { PLATFORM_FOUNDATION_FAMILY } from "./platformFoundationFamily";

export const EXTERNAL_ROUTE_FAMILIES = [
  PLATFORM_FOUNDATION_FAMILY,
  ENVIRONMENT_MANAGEMENT_FAMILY,
  SCREEN_BUILDER_FAMILY,
  PROJECT_VERSION_MANAGEMENT_FAMILY
] as const;

export const PLATFORM_ROUTE_FAMILIES = EXTERNAL_ROUTE_FAMILIES;
