import { createRouteFamily, buildRoutePageContracts, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";

const P006_DIGITAL_TWIN_ROUTES = [
  { id: "p006-digital-twin", label: "Digital Twin 프로젝트", group: "admin", koPath: "/projects/P006/digital-twin", enPath: "/en/projects/P006/digital-twin" },
  { id: "p006-factory-studio", label: "공장 조립 스튜디오", group: "admin", koPath: "/projects/P006/digital-twin/factory-studio", enPath: "/en/projects/P006/digital-twin/factory-studio" },
  { id: "p006-factory-simulator", label: "공장 시뮬레이터", group: "admin", koPath: "/projects/P006/digital-twin/factory-simulator", enPath: "/en/projects/P006/digital-twin/factory-simulator" },
  { id: "p006-scenarios", label: "시뮬레이션 시나리오", group: "admin", koPath: "/projects/P006/digital-twin/scenarios", enPath: "/en/projects/P006/digital-twin/scenarios" },
  { id: "p006-results", label: "실행 결과·병목 분석", group: "admin", koPath: "/projects/P006/digital-twin/results", enPath: "/en/projects/P006/digital-twin/results" }
] as const satisfies RouteDefinitionsOf;

const P006_DIGITAL_TWIN_PAGES = P006_DIGITAL_TWIN_ROUTES.map(route => ({ id: route.id, exportName: "P006DigitalTwinPages", loader: () => import("../../../features/p006-digital-twin/P006DigitalTwinPages") })) as PageUnitsOf<typeof P006_DIGITAL_TWIN_ROUTES>;

export const P006_DIGITAL_TWIN_FAMILY = createRouteFamily(P006_DIGITAL_TWIN_ROUTES, P006_DIGITAL_TWIN_PAGES, {
  familyId: "p006-digital-twin", pageFamily: "project-generated", ownershipLane: "PROJECT", installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: { manifestOwner: "projects/P006/design/project.contract.json", templateProfile: "KRDS_DIGITAL_TWIN", frameProfile: "RESONANCE_KRDS_ADMIN_V1", helpBinding: "P006.help", accessibilityBinding: "WCAG_2_1_AA", securityBinding: "P006.actor-permission" },
  authorityScope: { actorFamily: "P006_PROJECT_ACTORS", dataScope: "P006_DATABASE_ONLY", actionScopes: ["view","create","update","execute","approve"], menuPolicy: "P006 role menu binding", entryPolicy: "authenticated P006 actor", queryPolicy: "woosu_digital_twin only", actionPolicy: "role and process-step guarded", approvalPolicy: "reviewer or project admin", auditPolicy: "all mutations recorded in dt_audit_log", tracePolicy: "page-actor-function-input-output", denyState: "p006-access-denied" },
  commonDefinition: { owner: "Resonance KRDS shared frame", artifacts: ["AdminPageShell","KRDS components","route registry"] },
  projectBinding: { owner: "P006 contract generator", menuBinding: "P006-admin-v1", routeBinding: "p006DigitalTwinFamily", authorityBinding: "P006 actor permissions", themeBinding: "theme-krds-digital-twin" },
  projectExecutor: { owner: "P006 runtime", responsibilities: ["scene authoring","animation authoring","simulation execution","result review"] },
  installDeploy: { packagingOwnerPath: "projects/P006", assemblyOwnerPath: "src/app/routes/families/allRouteFamilies.ts", bootstrapPayloadTarget: "/projects/P006/digital-twin", bindingInputs: ["project contract","P006 runtime manifest","P006 DB migration"], validatorChecks: ["five routes","six governance cards","P006 health","DB isolation","visual QA"], runtimeVerificationTarget: "/projects/P006/digital-twin", compareTarget: "/projects/P006/digital-twin/factory-simulator", deploySequence: "contract generate -> migrate -> runtime -> frontend overlay", freshnessVerificationSequence: "contract checksum -> typecheck -> build -> HTTP -> browser QA", validator: "P006 full-stack contract validator", rollbackEvidence: "P006 deployment evidence", auditTrace: "P006 page-process trace" },
  pageContracts: buildRoutePageContracts(P006_DIGITAL_TWIN_ROUTES, { familyId: "p006-digital-twin", manifestRoot: "P006.project.contract.pages", menuCodePrefix: "P006", validator: "P006 full-stack contract validator", rollbackEvidence: "P006 deployment evidence" }),
  pageSystemizationCloseout: "CLOSED: page systemization is complete for p006-digital-twin; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout: "CLOSED: authority scope is consistently applied for p006-digital-twin; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout: "CLOSED: builder install and deploy closeout is complete for p006-digital-twin; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout: "CLOSED: project binding is explicit for p006-digital-twin; common definition, project binding, and project executor lines are separately traceable."
});
