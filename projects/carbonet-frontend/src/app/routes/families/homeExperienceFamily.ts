import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const HOME_EXPERIENCE_ROUTE_DEFINITIONS = [
  { id: "join-company-register", label: "공개 회원사 등록", group: "join", koPath: "/join/companyRegister", enPath: "/join/en/companyRegister" },
  { id: "join-company-register-complete", label: "회원사 등록 완료", group: "join", koPath: "/join/companyRegisterComplete", enPath: "/join/en/companyRegisterComplete" },
  { id: "join-company-reapply", label: "반려 재신청", group: "join", koPath: "/join/companyReapply", enPath: "/join/en/companyReapply" },
  { id: "edu-course-list", label: "교육과정 목록", group: "home", koPath: "/edu/course_list", enPath: "/en/edu/course_list" },
  { id: "edu-my-course", label: "나의 교육", group: "home", koPath: "/edu/my_course", enPath: "/en/edu/my_course" },
  { id: "edu-progress", label: "진도 관리", group: "home", koPath: "/edu/progress", enPath: "/en/edu/progress" },
  { id: "edu-content", label: "자격 연계", group: "home", koPath: "/edu/content", enPath: "/en/edu/content" },
  { id: "edu-course-detail", label: "과정 상세", group: "home", koPath: "/edu/course_detail", enPath: "/en/edu/course_detail" },
  { id: "edu-apply", label: "교육 신청", group: "home", koPath: "/edu/apply", enPath: "/en/edu/apply" },
  { id: "edu-survey", label: "설문조사", group: "home", koPath: "/edu/survey", enPath: "/en/edu/survey" },
  { id: "edu-certificate", label: "수료증", group: "home", koPath: "/edu/certificate", enPath: "/en/edu/certificate" },
  { id: "join-wizard", label: "회원가입 위저드", group: "join", koPath: "/join/step1", enPath: "/join/en/step1" },
  { id: "join-terms", label: "회원가입 약관", group: "join", koPath: "/join/step2", enPath: "/join/en/step2" },
  { id: "join-auth", label: "회원가입 본인확인", group: "join", koPath: "/join/step3", enPath: "/join/en/step3" },
  { id: "join-info", label: "회원가입 정보입력", group: "join", koPath: "/join/step4", enPath: "/join/en/step4" },
  { id: "join-complete", label: "회원가입 완료", group: "join", koPath: "/join/step5", enPath: "/join/en/step5" },
  { id: "my-inquiry", label: "1:1 문의", group: "home", koPath: "/mtn/my_inquiry", enPath: "/en/mtn/my_inquiry" },
  { id: "mtn-status", label: "서비스 상태", group: "home", koPath: "/mtn/status", enPath: "/en/mtn/status" },
  { id: "mtn-version", label: "버전 관리", group: "home", koPath: "/mtn/version", enPath: "/en/mtn/version" },
  { id: "support-faq", label: "FAQ", group: "home", koPath: "/support/faq", enPath: "/en/support/faq" },
  { id: "support-inquiry", label: "문의 내역", group: "home", koPath: "/support/inquiry", enPath: "/en/support/inquiry" },
  { id: "mypage", label: "마이페이지", group: "home", koPath: "/mypage/profile", enPath: "/en/mypage/profile" },
  { id: "mypage-email", label: "이메일/전화 변경", group: "home", koPath: "/mypage/email", enPath: "/en/mypage/email" },
  { id: "mypage-notification", label: "알림 설정", group: "home", koPath: "/mypage/notification", enPath: "/en/mypage/notification" },
  { id: "mypage-marketing", label: "마케팅 수신", group: "home", koPath: "/mypage/marketing", enPath: "/en/mypage/marketing" },
  { id: "mypage-company", label: "기업 정보", group: "home", koPath: "/mypage/company", enPath: "/en/mypage/company" },
  { id: "mypage-password", label: "비밀번호 변경", group: "home", koPath: "/mypage/password", enPath: "/en/mypage/password" },
  { id: "mypage-staff", label: "담당자 관리", group: "home", koPath: "/mypage/staff", enPath: "/en/mypage/staff" }
] as const satisfies RouteDefinitionsOf;

const HOME_EXPERIENCE_PAGE_UNITS = [
  { id: "edu-course-list", exportName: "EduCourseListMigrationPage", loader: () => import("../../../features/edu-course-list/EduCourseListMigrationPage") },
  { id: "edu-my-course", exportName: "EduMyCourseMigrationPage", loader: () => import("../../../features/edu-my-course/EduMyCourseMigrationPage") },
  { id: "edu-progress", exportName: "EduProgressMigrationPage", loader: () => import("../../../features/edu-progress/EduProgressMigrationPage") },
  { id: "edu-content", exportName: "EduContentMigrationPage", loader: () => import("../../../features/edu-content/EduContentMigrationPage") },
  { id: "edu-course-detail", exportName: "EduCourseDetailMigrationPage", loader: () => import("../../../features/edu-course-detail/EduCourseDetailMigrationPage") },
  { id: "edu-apply", exportName: "EduApplyMigrationPage", loader: () => import("../../../features/edu-apply/EduApplyMigrationPage") },
  { id: "edu-survey", exportName: "EduSurveyMigrationPage", loader: () => import("../../../features/edu-survey/EduSurveyMigrationPage") },
  { id: "edu-certificate", exportName: "EduCertificateMigrationPage", loader: () => import("../../../features/edu-certificate/EduCertificateMigrationPage") },
  { id: "join-company-register", exportName: "JoinCompanyRegisterMigrationPage", loader: () => import("../../../features/join-company-register/JoinCompanyRegisterMigrationPage") },
  { id: "join-company-register-complete", exportName: "JoinCompanyRegisterCompleteMigrationPage", loader: () => import("../../../features/join-company-register/JoinCompanyRegisterCompleteMigrationPage") },
  { id: "join-company-reapply", exportName: "JoinCompanyReapplyMigrationPage", loader: () => import("../../../features/join-company-reapply/JoinCompanyReapplyMigrationPage") },
  { id: "my-inquiry", exportName: "MyInquiryMigrationPage", loader: () => import("../../../features/my-inquiry/MyInquiryMigrationPage") },
  { id: "mtn-status", exportName: "MtnStatusMigrationPage", loader: () => import("../../../features/mtn-status/MtnStatusMigrationPage") },
  { id: "mtn-version", exportName: "VersionManagementMigrationPage", loader: () => import("../../../features/version-management") },
  { id: "support-faq", exportName: "SupportFaqMigrationPage", loader: () => import("../../../features/support-faq/SupportFaqMigrationPage") },
  { id: "support-inquiry", exportName: "SupportInquiryMigrationPage", loader: () => import("../../../features/support-inquiry/SupportInquiryMigrationPage") },
  { id: "join-wizard", exportName: "JoinWizardMigrationPage", loader: () => import("../../../features/join-wizard/JoinWizardMigrationPage") },
  { id: "join-terms", exportName: "JoinTermsMigrationPage", loader: () => import("../../../features/join-wizard/JoinTermsMigrationPage") },
  { id: "join-auth", exportName: "JoinAuthMigrationPage", loader: () => import("../../../features/join-wizard/JoinAuthMigrationPage") },
  { id: "join-info", exportName: "JoinInfoMigrationPage", loader: () => import("../../../features/join-wizard/JoinInfoMigrationPage") },
  { id: "join-complete", exportName: "JoinCompleteMigrationPage", loader: () => import("../../../features/join-wizard/JoinCompleteMigrationPage") },
  { id: "mypage", exportName: "MypageMigrationPage", loader: () => import("../../../features/mypage/MypageMigrationPage") },
  { id: "mypage-email", exportName: "MypageEmailMigrationPage", loader: () => import("../../../features/mypage-email/MypageEmailMigrationPage") },
  { id: "mypage-notification", exportName: "MypageNotificationMigrationPage", loader: () => import("../../../features/mypage/MypageNotificationMigrationPage") },
  { id: "mypage-marketing", exportName: "MypageMarketingMigrationPage", loader: () => import("../../../features/mypage/MypageMarketingMigrationPage") },
  { id: "mypage-company", exportName: "MypageCompanyMigrationPage", loader: () => import("../../../features/mypage-company/MypageCompanyMigrationPage") },
  { id: "mypage-password", exportName: "MypagePasswordMigrationPage", loader: () => import("../../../features/mypage-password/MypagePasswordMigrationPage") },
  { id: "mypage-staff", exportName: "MypageStaffMigrationPage", loader: () => import("../../../features/mypage-staff/MypageStaffMigrationPage") }
] as const satisfies PageUnitsOf<typeof HOME_EXPERIENCE_ROUTE_DEFINITIONS>;

export const HOME_EXPERIENCE_FAMILY = createRouteFamily(HOME_EXPERIENCE_ROUTE_DEFINITIONS, HOME_EXPERIENCE_PAGE_UNITS, {
  familyId: "home-experience",
  pageFamily: "registry",
  ownershipLane: "PROJECT",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "homeExperienceFamily",
    templateProfile: "home-education-join-mypage-suite",
    frameProfile: "home-and-join-layout",
    helpBinding: "home-experience.help",
    accessibilityBinding: "home-experience-accessibility",
    securityBinding: "home-experience-route-guard"
  },
  authorityScope: {
    actorFamily: "PUBLIC_AND_MEMBER",
    dataScope: "PUBLIC_AND_PROJECT_SCOPED",
    actionScopes: ["view", "create", "update", "execute"],
    menuPolicy: "home, join, education, and mypage menus follow public/member visibility policy",
    entryPolicy: "public-or-member-home-route",
    queryPolicy: "home/join/mypage queries stay inside public/member and project-scoped rules",
    actionPolicy: "education, join, and mypage mutations require the same governed scope",
    approvalPolicy: "approval is family-local only where member workflow escalation is explicit",
    auditPolicy: "home/join/mypage deny and execution paths emit audit evidence",
    tracePolicy: "education, join, and mypage traces stay correlated by pageId and menu binding",
    denyState: "home-experience-denied-state"
  },
  commonDefinition: {
    owner: "app/routes/families/homeExperienceFamily",
    artifacts: ["route family definition", "home experience page manifests", "home experience validator", "home experience trace baseline"]
  },
  projectBinding: {
    owner: "education/join/mypage route and menu binding",
    menuBinding: "home experience menu binding",
    routeBinding: "home/join/mypage route binding",
    authorityBinding: "home/member authority narrowing",
    themeBinding: "home experience presentation binding"
  },
  projectExecutor: {
    owner: "education/join/mypage project executor",
    responsibilities: ["education execution", "join flow execution", "mypage project execution"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/edu/course_list",
    bindingInputs: ["project route binding", "localized route binding", "member authority narrowing", "presentation binding"],
    validatorChecks: ["home manifest linked", "authority scope aligned", "runtime target known", "mypage evidence linked"],
    runtimeVerificationTarget: "/edu/course_list",
    compareTarget: "/mypage/profile",
    deploySequence: "frontend build -> package -> restart-18000 -> home experience route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> home experience route verify",
    validator: "home-experience route family aggregate validator",
    rollbackEvidence: "home/join/mypage runtime evidence",
    auditTrace: "education/join/mypage trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(HOME_EXPERIENCE_ROUTE_DEFINITIONS, {
    familyId: "home-experience",
    manifestRoot: "homeExperienceFamily.manifest",
    menuCodePrefix: "HOME_EXPERIENCE",
    validator: "home-experience route family aggregate validator",
    rollbackEvidence: "home/join/mypage runtime evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for home-experience; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for home-experience; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for home-experience; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for home-experience; common definition, project binding, and project executor lines are separately traceable."
});
