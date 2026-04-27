import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const sharedAdminEntryLoader = () => import("../../../features/admin-entry/AdminEntryPages");
const sharedPublicEntryLoader = () => import("../../../features/public-entry/PublicEntryPages");
const sharedJoinCompanyStatusLoader = () => import("../../../features/join-company-status/JoinCompanyStatusMigrationPage");

const APP_OWNED_ROUTE_DEFINITIONS = [
  { id: "home", label: "홈", group: "home", koPath: "/home", enPath: "/en/home" },
  { id: "signin-login", label: "로그인", group: "home", koPath: "/signin/loginView", enPath: "/en/signin/loginView" },
  { id: "signin-auth-choice", label: "인증선택", group: "home", koPath: "/signin/authChoice", enPath: "/en/signin/authChoice" },
  { id: "signin-find-id", label: "아이디 찾기", group: "home", koPath: "/signin/findId", enPath: "/en/signin/findId" },
  { id: "signin-find-id-result", label: "아이디 찾기 결과", group: "home", koPath: "/signin/findId/result", enPath: "/en/signin/findId/result" },
  { id: "signin-find-password", label: "비밀번호 찾기", group: "home", koPath: "/signin/findPassword", enPath: "/en/signin/findPassword" },
  { id: "signin-find-password-result", label: "비밀번호 재설정 완료", group: "home", koPath: "/signin/findPassword/result", enPath: "/en/signin/findPassword/result" },
  { id: "signin-forbidden", label: "접근 거부", group: "home", koPath: "/signin/loginForbidden", enPath: "/en/signin/loginForbidden" },
  { id: "admin-home", label: "관리자 홈", group: "admin", koPath: "/admin/", enPath: "/en/admin/" },
  { id: "admin-login", label: "관리자 로그인", group: "admin", koPath: "/admin/login/loginView", enPath: "/en/admin/login/loginView" },
  { id: "join-company-status", label: "가입 현황 조회", group: "join", koPath: "/join/companyJoinStatusSearch", enPath: "/join/en/companyJoinStatusSearch" },
  { id: "join-company-status-guide", label: "가입 현황 안내", group: "join", koPath: "/join/companyJoinStatusGuide", enPath: "/join/en/companyJoinStatusGuide" },
  { id: "join-company-status-detail", label: "가입 현황 상세", group: "join", koPath: "/join/companyJoinStatusDetail", enPath: "/join/en/companyJoinStatusDetail" }
] as const satisfies RouteDefinitionsOf;

const APP_OWNED_PAGE_UNITS = [
  { id: "home", exportName: "HomeLandingPage", loader: () => import("../../../features/home-entry/HomeEntryPages") },
  { id: "admin-home", exportName: "AdminHomePage", loader: sharedAdminEntryLoader },
  { id: "signin-login", exportName: "PublicLoginPage", loader: sharedPublicEntryLoader },
  { id: "admin-login", exportName: "AdminLoginPage", loader: sharedAdminEntryLoader },
  { id: "signin-auth-choice", exportName: "AuthChoicePage", loader: sharedPublicEntryLoader },
  { id: "signin-find-id", exportName: "FindIdPage", loader: sharedPublicEntryLoader },
  { id: "signin-find-id-result", exportName: "FindIdResultPage", loader: sharedPublicEntryLoader },
  { id: "signin-find-password", exportName: "FindPasswordPage", loader: sharedPublicEntryLoader },
  { id: "signin-find-password-result", exportName: "FindPasswordCompletePage", loader: sharedPublicEntryLoader },
  { id: "signin-forbidden", exportName: "ForbiddenPage", loader: sharedPublicEntryLoader },
  { id: "join-company-status", exportName: "JoinCompanyStatusMigrationPage", loader: sharedJoinCompanyStatusLoader },
  { id: "join-company-status-guide", exportName: "JoinCompanyStatusMigrationPage", loader: sharedJoinCompanyStatusLoader },
  { id: "join-company-status-detail", exportName: "JoinCompanyStatusMigrationPage", loader: sharedJoinCompanyStatusLoader }
] as const satisfies PageUnitsOf<typeof APP_OWNED_ROUTE_DEFINITIONS>;

export const APP_OWNED_FAMILY = createRouteFamily(APP_OWNED_ROUTE_DEFINITIONS, APP_OWNED_PAGE_UNITS, {
  familyId: "app-owned-entry",
  pageFamily: "entry",
  ownershipLane: "SYSTEM",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "appOwnedFamily",
    templateProfile: "public-and-admin-entry-pages",
    frameProfile: "entry-shell-layout",
    helpBinding: "entry-pages.help",
    accessibilityBinding: "entry-accessibility-baseline",
    securityBinding: "entry-security-and-auth-guard"
  },
  authorityScope: {
    actorFamily: "PUBLIC_AND_ADMIN_ENTRY",
    dataScope: "PUBLIC",
    actionScopes: ["view", "create"],
    menuPolicy: "entry menu visibility follows public/admin entry policy",
    entryPolicy: "public-or-admin-entry-route",
    queryPolicy: "entry bootstrap and lookup queries stay inside public/admin entry scope",
    actionPolicy: "login/join bootstrap actions follow the same entry guard policy",
    approvalPolicy: "approval is not used; escalation remains outside the entry family",
    auditPolicy: "entry deny and fallback paths emit audit evidence where authentication gates fire",
    tracePolicy: "entry bootstrap and route traces stay correlated by pageId and route",
    denyState: "signin-and-forbidden-governed-state"
  },
  commonDefinition: {
    owner: "app/routes/families/appOwnedFamily",
    artifacts: ["route family definition", "entry page manifests", "entry validator contract", "entry shell baseline"]
  },
  projectBinding: {
    owner: "home/signin/admin entry route binding",
    menuBinding: "entry menu and landing binding",
    routeBinding: "public/admin entry route binding",
    authorityBinding: "entry actor and guard binding",
    themeBinding: "entry shell presentation binding"
  },
  projectExecutor: {
    owner: "login/join bootstrap executor",
    responsibilities: ["login bootstrap execution", "join bootstrap execution", "entry fallback execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/home",
    bindingInputs: ["entry route ownership", "localized route binding", "theme shell binding", "auth provider binding"],
    validatorChecks: ["entry manifest linked", "localized route aligned", "authority guard aligned", "fallback route known"],
    runtimeVerificationTarget: "/home",
    compareTarget: "/admin/",
    deploySequence: "frontend build -> package -> restart-18000 -> entry route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> entry route verify",
    validator: "app-owned entry route family aggregate validator",
    rollbackEvidence: "entry shell and login fallback evidence",
    auditTrace: "entry bootstrap and route trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(APP_OWNED_ROUTE_DEFINITIONS, {
    familyId: "app-owned-entry",
    manifestRoot: "appOwnedFamily.manifest",
    menuCodePrefix: "APP_ENTRY",
    validator: "app-owned entry route family aggregate validator",
    rollbackEvidence: "entry shell and login fallback evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for app-owned-entry; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for app-owned-entry; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for app-owned-entry; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for app-owned-entry; common definition, project binding, and project executor lines are separately traceable."
});
