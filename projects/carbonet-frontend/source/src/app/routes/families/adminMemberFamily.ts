import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const ADMIN_MEMBER_ROUTE_DEFINITIONS = [
  { id: "auth-group", label: "권한 그룹", group: "admin", koPath: "/admin/auth/group", enPath: "/en/admin/auth/group" },
  { id: "auth-change", label: "권한 변경", group: "admin", koPath: "/admin/member/auth-change", enPath: "/en/admin/member/auth-change" },
  { id: "dept-role", label: "부서 권한 맵핑", group: "admin", koPath: "/admin/member/dept-role-mapping", enPath: "/en/admin/member/dept-role-mapping" },
  { id: "member-edit", label: "회원 수정", group: "admin", koPath: "/admin/member/edit", enPath: "/en/admin/member/edit" },
  { id: "password-reset", label: "비밀번호 초기화", group: "admin", koPath: "/admin/member/reset_password", enPath: "/en/admin/member/reset_password" },
  { id: "admin-permission", label: "관리자 권한", group: "admin", koPath: "/admin/member/admin_account/permissions", enPath: "/en/admin/member/admin_account/permissions" },
  { id: "admin-create", label: "관리자 생성", group: "admin", koPath: "/admin/member/admin_account", enPath: "/en/admin/member/admin_account" },
  { id: "company-account", label: "회원사 계정", group: "admin", koPath: "/admin/member/company_account", enPath: "/en/admin/member/company_account" },
  { id: "admin-list", label: "관리자 목록", group: "admin", koPath: "/admin/member/admin_list", enPath: "/en/admin/member/admin_list" },
  { id: "company-list", label: "회원사 목록", group: "admin", koPath: "/admin/member/company_list", enPath: "/en/admin/member/company_list" },
  { id: "member-approve", label: "회원 승인", group: "admin", koPath: "/admin/member/approve", enPath: "/en/admin/member/approve" },
  { id: "company-approve", label: "회원사 승인", group: "admin", koPath: "/admin/member/company-approve", enPath: "/en/admin/member/company-approve" },
  { id: "certificate-approve", label: "인증서 승인", group: "admin", koPath: "/admin/certificate/approve", enPath: "/en/admin/certificate/approve" },
  { id: "certificate-pending", label: "인증서 발급 대기", group: "admin", koPath: "/admin/certificate/pending_list", enPath: "/en/admin/certificate/pending_list" },
  { id: "virtual-issue", label: "환불 계좌 검수", group: "admin", koPath: "/admin/payment/virtual_issue", enPath: "/en/admin/payment/virtual_issue" },
  { id: "member-list", label: "회원 목록", group: "admin", koPath: "/admin/member/list", enPath: "/en/admin/member/list" },
  { id: "member-withdrawn", label: "탈퇴 회원", group: "admin", koPath: "/admin/member/withdrawn", enPath: "/en/admin/member/withdrawn" },
  { id: "member-activate", label: "휴면 계정", group: "admin", koPath: "/admin/member/activate", enPath: "/en/admin/member/activate" },
  { id: "member-detail", label: "회원 상세", group: "admin", koPath: "/admin/member/detail", enPath: "/en/admin/member/detail" },
  { id: "company-detail", label: "회원사 상세", group: "admin", koPath: "/admin/member/company_detail", enPath: "/en/admin/member/company_detail" },
  { id: "member-stats", label: "회원 통계", group: "admin", koPath: "/admin/member/stats", enPath: "/en/admin/member/stats" },
  { id: "member-register", label: "회원 등록", group: "admin", koPath: "/admin/member/register", enPath: "/en/admin/member/register" }
] as const satisfies RouteDefinitionsOf;

const ADMIN_MEMBER_PAGE_UNITS = [
  { id: "auth-group", exportName: "AuthGroupMigrationPage", loader: () => import("../../../features/auth-groups/AuthGroupMigrationPage") },
  { id: "auth-change", exportName: "AuthChangeMigrationPage", loader: () => import("../../../features/auth-change/AuthChangeMigrationPage") },
  { id: "dept-role", exportName: "DeptRoleMappingMigrationPage", loader: () => import("../../../features/dept-role-mapping/DeptRoleMappingMigrationPage") },
  { id: "member-edit", exportName: "MemberEditMigrationPage", loader: () => import("../../../features/member-edit/MemberEditMigrationPage") },
  { id: "password-reset", exportName: "PasswordResetMigrationPage", loader: () => import("../../../features/password-reset/PasswordResetMigrationPage") },
  { id: "admin-permission", exportName: "AdminPermissionMigrationPage", loader: () => import("../../../features/admin-permissions/AdminPermissionMigrationPage") },
  { id: "admin-create", exportName: "AdminAccountCreateMigrationPage", loader: () => import("../../../features/admin-account-create/AdminAccountCreateMigrationPage") },
  { id: "company-account", exportName: "CompanyAccountMigrationPage", loader: () => import("../../../features/company-account/CompanyAccountMigrationPage") },
  { id: "admin-list", exportName: "AdminListMigrationPage", loader: () => import("../../../features/admin-list/AdminListMigrationPage") },
  { id: "company-list", exportName: "CompanyListMigrationPage", loader: () => import("../../../features/company-list/CompanyListMigrationPage") },
  { id: "member-approve", exportName: "MemberApproveMigrationPage", loader: () => import("../../../features/member-approve/MemberApproveMigrationPage") },
  { id: "company-approve", exportName: "CompanyApproveMigrationPage", loader: () => import("../../../features/company-approve/CompanyApproveMigrationPage") },
  { id: "certificate-approve", exportName: "CertificateApproveMigrationPage", loader: () => import("../../../features/certificate-approve/CertificateApproveMigrationPage") },
  { id: "certificate-pending", exportName: "CertificatePendingMigrationPage", loader: () => import("../../../features/certificate-pending/CertificatePendingMigrationPage") },
  { id: "virtual-issue", exportName: "VirtualIssueMigrationPage", loader: () => import("../../../features/virtual-issue/VirtualIssueMigrationPage") },
  { id: "member-list", exportName: "MemberListMigrationPage", loader: () => import("../../../features/member-list/MemberListMigrationPage") },
  { id: "member-withdrawn", exportName: "WithdrawnMemberListMigrationPage", loader: () => import("../../../features/member-list/MemberListMigrationPage") },
  { id: "member-activate", exportName: "ActivateMemberListMigrationPage", loader: () => import("../../../features/member-list/MemberListMigrationPage") },
  { id: "member-detail", exportName: "MemberDetailMigrationPage", loader: () => import("../../../features/member-detail/MemberDetailMigrationPage") },
  { id: "company-detail", exportName: "CompanyDetailMigrationPage", loader: () => import("../../../features/company-detail/CompanyDetailMigrationPage") },
  { id: "member-stats", exportName: "MemberStatsMigrationPage", loader: () => import("../../../features/member-stats/MemberStatsMigrationPage") },
  { id: "member-register", exportName: "MemberRegisterMigrationPage", loader: () => import("../../../features/member-register/MemberRegisterMigrationPage") }
] as const satisfies PageUnitsOf<typeof ADMIN_MEMBER_ROUTE_DEFINITIONS>;

export const ADMIN_MEMBER_FAMILY = createRouteFamily(ADMIN_MEMBER_ROUTE_DEFINITIONS, ADMIN_MEMBER_PAGE_UNITS, {
  familyId: "admin-member",
  pageFamily: "authority",
  ownershipLane: "SYSTEM",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "adminMemberFamily",
    templateProfile: "admin-member-and-authority-suite",
    frameProfile: "admin-governed-management-layout",
    helpBinding: "admin-member.help",
    accessibilityBinding: "admin-management-accessibility",
    securityBinding: "admin-member-authority-guard"
  },
  authorityScope: {
    actorFamily: "ADMIN",
    dataScope: "INSTT_SCOPED",
    actionScopes: ["view", "create", "update", "approve", "delete"],
    menuPolicy: "admin member menus follow admin authority visibility policy",
    entryPolicy: "admin-authority-only",
    queryPolicy: "member/account queries stay institution scoped and actor gated",
    actionPolicy: "member/account mutations require the same member authority scope",
    approvalPolicy: "member/company/certificate approvals stay inside admin authority flow",
    auditPolicy: "member authority deny and execution paths emit audit evidence",
    tracePolicy: "member/account/approval traces stay correlated by pageId and authority target",
    denyState: "admin-authority-denied-state"
  },
  commonDefinition: {
    owner: "app/routes/families/adminMemberFamily",
    artifacts: ["route family definition", "admin member page manifests", "member governance validator", "member trace baseline"]
  },
  projectBinding: {
    owner: "admin member menu and authority narrowing",
    menuBinding: "admin member menu binding",
    routeBinding: "admin member route binding",
    authorityBinding: "member authority override and approval binding",
    themeBinding: "admin member console presentation binding"
  },
  projectExecutor: {
    owner: "member/account/project-specific mutation executor",
    responsibilities: ["member mutation execution", "account mutation execution", "project-specific approval execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/member/list",
    bindingInputs: ["admin menu binding", "institution scope binding", "approval authority binding", "localized route binding"],
    validatorChecks: ["member manifest linked", "authority scope aligned", "approval path known", "audit trace linked"],
    runtimeVerificationTarget: "/admin/member/list",
    compareTarget: "/admin/auth/group",
    deploySequence: "frontend build -> package -> restart-18000 -> admin member route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> admin member route verify",
    validator: "admin-member route family aggregate validator",
    rollbackEvidence: "member authority and approval route evidence",
    auditTrace: "member authority and approval trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(ADMIN_MEMBER_ROUTE_DEFINITIONS, {
    familyId: "admin-member",
    manifestRoot: "adminMemberFamily.manifest",
    menuCodePrefix: "ADMIN_MEMBER",
    validator: "admin-member route family aggregate validator",
    rollbackEvidence: "member authority and approval route evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for admin-member; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for admin-member; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for admin-member; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for admin-member; common definition, project binding, and project executor lines are separately traceable."
});
