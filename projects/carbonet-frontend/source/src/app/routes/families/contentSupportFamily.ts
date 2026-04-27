import { createRouteFamily, type PageUnitsOf, type RouteDefinitionsOf } from "../../../framework/registry/routeFamilyTypes";
import { buildManifestBackedRoutePageContracts } from "./manifestBackedPageContracts";

const CONTENT_SUPPORT_ROUTE_DEFINITIONS = [
  { id: "board-list", label: "게시판 관리", group: "admin", koPath: "/admin/content/board_list", enPath: "/en/admin/content/board_list" },
  { id: "board-add", label: "공지 배포", group: "admin", koPath: "/admin/content/board_add", enPath: "/en/admin/content/board_add" },
  { id: "post-list", label: "게시글 목록", group: "admin", koPath: "/admin/content/post_list", enPath: "/en/admin/content/post_list" },
  { id: "banner-list", label: "배너 목록", group: "admin", koPath: "/admin/content/banner_list", enPath: "/en/admin/content/banner_list" },
  { id: "popup-list", label: "팝업 목록", group: "admin", koPath: "/admin/content/popup_list", enPath: "/en/admin/content/popup_list" },
  { id: "banner-edit", label: "배너 편집", group: "admin", koPath: "/admin/content/banner_edit", enPath: "/en/admin/content/banner_edit" },
  { id: "popup-edit", label: "팝업 스케줄", group: "admin", koPath: "/admin/content/popup_edit", enPath: "/en/admin/content/popup_edit" },
  { id: "qna-category", label: "Q&A 분류", group: "admin", koPath: "/admin/content/qna", enPath: "/en/admin/content/qna" },
  { id: "faq-management", label: "FAQ 관리", group: "admin", koPath: "/admin/content/faq_list", enPath: "/en/admin/content/faq_list" },
  { id: "file-management", label: "파일 관리", group: "admin", koPath: "/admin/content/file", enPath: "/en/admin/content/file" },
  { id: "admin-sitemap", label: "관리자 사이트맵", group: "admin", koPath: "/admin/content/sitemap", enPath: "/en/admin/content/sitemap" },
  { id: "tag-management", label: "태그 관리", group: "admin", koPath: "/admin/content/tag", enPath: "/en/admin/content/tag" },
  { id: "admin-menu-placeholder", label: "관리자 메뉴 플레이스홀더", group: "admin", koPath: "/admin/placeholder", enPath: "/en/admin/placeholder" },
  { id: "download-list", label: "자료실", group: "home", koPath: "/support/download_list", enPath: "/en/support/download_list" },
  { id: "notice-list", label: "공지사항", group: "home", koPath: "/support/notice_list", enPath: "/en/support/notice_list" },
  { id: "qna-list", label: "Q&A", group: "home", koPath: "/support/qna_list", enPath: "/en/support/qna_list" },
  { id: "sitemap", label: "사이트맵", group: "home", koPath: "/sitemap", enPath: "/en/sitemap" },
  { id: "home-menu-placeholder", label: "사용자 메뉴 플레이스홀더", group: "home", koPath: "/placeholder", enPath: "/en/placeholder" }
] as const satisfies RouteDefinitionsOf;

const CONTENT_SUPPORT_PAGE_UNITS = [
  { id: "board-list", exportName: "BoardListMigrationPage", loader: () => import("../../../features/board-list/BoardListMigrationPage") },
  { id: "board-add", exportName: "BoardAddMigrationPage", loader: () => import("../../../features/board-add/BoardAddMigrationPage") },
  { id: "post-list", exportName: "PostListMigrationPage", loader: () => import("../../../features/post-list/PostListMigrationPage") },
  { id: "banner-list", exportName: "BannerListMigrationPage", loader: () => import("../../../features/banner-list/BannerListMigrationPage") },
  { id: "popup-list", exportName: "PopupListMigrationPage", loader: () => import("../../../features/popup-list/PopupListMigrationPage") },
  { id: "banner-edit", exportName: "BannerEditMigrationPage", loader: () => import("../../../features/banner-edit/BannerEditMigrationPage") },
  { id: "popup-edit", exportName: "PopupEditMigrationPage", loader: () => import("../../../features/popup-edit/PopupEditMigrationPage") },
  { id: "qna-category", exportName: "QnaCategoryMigrationPage", loader: () => import("../../../features/qna-category/QnaCategoryMigrationPage") },
  { id: "faq-management", exportName: "FaqManagementMigrationPage", loader: () => import("../../../features/faq-management/FaqManagementMigrationPage") },
  { id: "file-management", exportName: "FileManagementMigrationPage", loader: () => import("../../../features/file-management/FileManagementMigrationPage") },
  { id: "admin-sitemap", exportName: "AdminSitemapMigrationPage", loader: () => import("../../../features/admin-sitemap/AdminSitemapMigrationPage") },
  { id: "tag-management", exportName: "TagManagementMigrationPage", loader: () => import("../../../features/tag-management/TagManagementMigrationPage") },
  { id: "admin-menu-placeholder", exportName: "AdminMenuPlaceholderPage", loader: () => import("../../../features/admin-placeholder/AdminMenuPlaceholderPage") },
  { id: "download-list", exportName: "DownloadListMigrationPage", loader: () => import("../../../features/download-list") },
  { id: "notice-list", exportName: "NoticeListMigrationPage", loader: () => import("../../../features/notice-list") },
  { id: "qna-list", exportName: "QnaListMigrationPage", loader: () => import("../../../features/qna-list") },
  { id: "sitemap", exportName: "SitemapMigrationPage", loader: () => import("../../../features/sitemap/SitemapMigrationPage") },
  { id: "home-menu-placeholder", exportName: "HomeMenuPlaceholderPage", loader: () => import("../../../features/home-placeholder/HomeMenuPlaceholderPage") }
] as const satisfies PageUnitsOf<typeof CONTENT_SUPPORT_ROUTE_DEFINITIONS>;

export const CONTENT_SUPPORT_FAMILY = createRouteFamily(CONTENT_SUPPORT_ROUTE_DEFINITIONS, CONTENT_SUPPORT_PAGE_UNITS, {
  familyId: "content-support",
  pageFamily: "registry",
  ownershipLane: "SYSTEM",
  installScope: "COMMON_DEF_PROJECT_BIND",
  systemization: {
    manifestOwner: "contentSupportFamily",
    templateProfile: "content-support-suite",
    frameProfile: "content-admin-and-home-layout",
    helpBinding: "content-support.help",
    accessibilityBinding: "content-support-accessibility",
    securityBinding: "content-support-route-guard"
  },
  authorityScope: {
    actorFamily: "ADMIN_AND_MEMBER",
    dataScope: "INSTT_SCOPED",
    actionScopes: ["view", "create", "update", "delete", "export"],
    menuPolicy: "content/support menus follow admin/member visibility policy",
    entryPolicy: "content-admin-or-home-route",
    queryPolicy: "content/support queries stay scoped to actor and institution visibility",
    actionPolicy: "content publish and support mutations require the same governed authority scope",
    approvalPolicy: "publication and moderation approvals stay inside content governance flow",
    auditPolicy: "content deny and publish paths emit audit evidence",
    tracePolicy: "content/support traces stay correlated by pageId and menu placement",
    denyState: "content-support-denied-state"
  },
  commonDefinition: {
    owner: "app/routes/families/contentSupportFamily",
    artifacts: ["route family definition", "content support page manifests", "content support validator", "content support trace baseline"]
  },
  projectBinding: {
    owner: "content menu and route binding",
    menuBinding: "content/support menu binding",
    routeBinding: "content/support route binding",
    authorityBinding: "content authority narrowing and visibility binding",
    themeBinding: "content presentation binding"
  },
  projectExecutor: {
    owner: "content publishing and support project executor",
    responsibilities: ["content publish execution", "support workflow execution", "project-specific content mutation"]
  },
  installDeploy: {
    packagingOwnerPath: "frontend/src/app/routes/families",
    assemblyOwnerPath: "frontend/src/app/routes/families/allRouteFamilies.ts",
    bootstrapPayloadTarget: "/admin/content/board_list",
    bindingInputs: ["content menu binding", "support menu binding", "authority narrowing", "presentation binding"],
    validatorChecks: ["content manifest linked", "authority scope aligned", "runtime target known", "support evidence linked"],
    runtimeVerificationTarget: "/admin/content/board_list",
    compareTarget: "/support/notice_list",
    deploySequence: "frontend build -> package -> restart-18000 -> content/support route verify",
    freshnessVerificationSequence: "npm run build -> package -> restart-18000 -> codex freshness verify -> content/support route verify",
    validator: "content-support route family aggregate validator",
    rollbackEvidence: "content publish and support evidence",
    auditTrace: "content action and support route trace linkage"
  },
  pageContracts: buildManifestBackedRoutePageContracts(CONTENT_SUPPORT_ROUTE_DEFINITIONS, {
    familyId: "content-support",
    manifestRoot: "contentSupportFamily.manifest",
    menuCodePrefix: "CONTENT_SUPPORT",
    validator: "content-support route family aggregate validator",
    rollbackEvidence: "content publish and support evidence"
  }),
  pageSystemizationCloseout:
    "CLOSED: page systemization is complete for content-support; identity, authority scope, contracts, project binding, validator checks, and runtime verification target are explicit.",
  authorityScopeApplicationCloseout:
    "CLOSED: authority scope is consistently applied for content-support; menu, entry, query, action, approval, audit, and trace surfaces follow the same governed policy.",
  builderInstallDeployCloseout:
    "CLOSED: builder install and deploy closeout is complete for content-support; install inputs, project bindings, packaging source of truth, runtime target, and evidence surfaces are explicit.",
  projectBindingPatternsCloseout:
    "CLOSED: project binding is explicit for content-support; common definition, project binding, and project executor lines are separately traceable."
});
