import type { PageManifest } from "./types";

export const PAGE_MANIFESTS: Record<string, PageManifest> = {
  "home": {
    pageId: "home",
    routePath: "/home",
    menuCode: "HMENU_HOME",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "HomeHeroSection", instanceKey: "home-hero", layoutZone: "header" },
      { componentId: "HomeSearchSection", instanceKey: "home-search", layoutZone: "actions", propsSummary: ["searchKeyword"] },
      { componentId: "HomeServiceGrid", instanceKey: "home-services", layoutZone: "content", propsSummary: ["serviceCount"] },
      { componentId: "HomeSummarySection", instanceKey: "home-summary", layoutZone: "content", propsSummary: ["summaryCards"] }
    ]
  },
  "admin-home": {
    pageId: "admin-home",
    routePath: "/admin/",
    menuCode: "AMENU_ADMIN_HOME",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminHomeCards", instanceKey: "admin-home-cards", layoutZone: "content", propsSummary: ["cardCount"] },
      { componentId: "AdminHomeApprovals", instanceKey: "admin-home-approvals", layoutZone: "content", propsSummary: ["approvalCount"] },
      { componentId: "AdminHomeProgress", instanceKey: "admin-home-progress", layoutZone: "content", propsSummary: ["reviewSteps"] }
    ]
  },
  "popup-edit": {
    pageId: "popup-edit",
    routePath: "/admin/content/popup_edit",
    menuCode: "A0040204",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PopupEditSummary", instanceKey: "popup-edit-summary", layoutZone: "content", propsSummary: ["popupId", "exposureStatus", "dirtyCount"] },
      { componentId: "PopupEditBasicForm", instanceKey: "popup-edit-basic", layoutZone: "content", propsSummary: ["popupTitle", "popupType", "priority", "useAt"] },
      { componentId: "PopupEditScheduleForm", instanceKey: "popup-edit-schedule", layoutZone: "content", propsSummary: ["startDate", "endDate", "targetAudience", "displayScope"] },
      { componentId: "PopupEditContentForm", instanceKey: "popup-edit-content", layoutZone: "content", propsSummary: ["headline", "body", "ctaLabel", "ctaUrl"] },
      { componentId: "PopupEditActions", instanceKey: "popup-edit-actions", layoutZone: "actions", propsSummary: ["popupId", "canSave"] }
    ]
  },
  "popup-list": {
    pageId: "popup-list",
    routePath: "/admin/content/popup_list",
    menuCode: "A0040203",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PopupListSummary", instanceKey: "popup-list-summary", layoutZone: "actions", propsSummary: ["summaryCards"] },
      { componentId: "PopupListFilters", instanceKey: "popup-list-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "targetAudience"] },
      { componentId: "PopupListTable", instanceKey: "popup-list-table", layoutZone: "content", propsSummary: ["popupRows", "pageIndex", "totalPages"] },
      { componentId: "PopupListPreview", instanceKey: "popup-list-preview", layoutZone: "content", propsSummary: ["selectedPopup", "governanceNotes"] }
    ]
  },
  "admin-login": {
    pageId: "admin-login",
    routePath: "/admin/login/loginView",
    menuCode: "AMENU_ADMIN_LOGIN",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminLoginWarning", instanceKey: "admin-login-warning", layoutZone: "header" },
      { componentId: "AdminLoginForm", instanceKey: "admin-login-form", layoutZone: "content", propsSummary: ["userId", "rememberId"] },
      { componentId: "AdminLoginMfa", instanceKey: "admin-login-mfa", layoutZone: "content", propsSummary: ["mfaMethods"] }
    ]
  },
  "auth-group": {
    pageId: "auth-group",
    routePath: "/admin/auth/group",
    menuCode: "AMENU_AUTH_GROUP",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AuthGroupFilters", instanceKey: "auth-group-filters", layoutZone: "actions", propsSummary: ["roleCategory", "insttId", "authorCode"] },
      { componentId: "AuthGroupCreateForm", instanceKey: "auth-group-create", layoutZone: "content", propsSummary: ["authorCode", "authorNm", "authorDc"] },
      { componentId: "AuthGroupRoleProfile", instanceKey: "auth-group-profile", layoutZone: "content", propsSummary: ["selectedAuthorProfile", "displayTitle", "priorityWorks", "memberEditVisibleYn"] },
      { componentId: "AuthGroupFeatureMatrix", instanceKey: "auth-group-features", layoutZone: "content", propsSummary: ["selectedFeatures", "featureCount"] }
    ]
  },
  "auth-change": {
    pageId: "auth-change",
    routePath: "/admin/member/auth-change",
    menuCode: "AMENU_AUTH_CHANGE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AuthChangeSummary", instanceKey: "auth-change-summary", layoutZone: "actions", propsSummary: ["currentUserId", "assignmentCount"] },
      { componentId: "AuthChangeTable", instanceKey: "auth-change-table", layoutZone: "content", propsSummary: ["roleAssignments", "authorGroups"] }
    ]
  },
  "dept-role": {
    pageId: "dept-role",
    routePath: "/admin/member/dept-role-mapping",
    menuCode: "AMENU_DEPT_ROLE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "DeptRoleCompanySelector", instanceKey: "dept-role-company", layoutZone: "actions", propsSummary: ["insttId", "departmentCompanyOptions"] },
      { componentId: "DeptRoleDepartmentTable", instanceKey: "dept-role-departments", layoutZone: "content", propsSummary: ["departmentMappings", "departmentAuthorGroups", "roleProfilesByAuthorCode"] },
      { componentId: "DeptRoleMemberTable", instanceKey: "dept-role-members", layoutZone: "content", propsSummary: ["companyMembers", "memberAssignableAuthorGroups", "roleProfilesByAuthorCode"] },
      { componentId: "DeptRoleRoleProfilePreview", instanceKey: "dept-role-role-profile", layoutZone: "content", propsSummary: ["roleProfilesByAuthorCode", "selectedAuthorCode"] }
    ]
  },
  "admin-list": {
    pageId: "admin-list",
    routePath: "/admin/member/admin_list",
    menuCode: "AMENU_ADMIN_LIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminListSearchForm", instanceKey: "admin-list-search", layoutZone: "actions", propsSummary: ["searchKeyword", "sbscrbSttus"] },
      { componentId: "AdminListTable", instanceKey: "admin-list-table", layoutZone: "content", propsSummary: ["member_list", "totalCount", "pageIndex"] }
    ]
  },
  "signin-login": {
    pageId: "signin-login",
    routePath: "/signin/loginView",
    menuCode: "HMENU_SIGNIN_LOGIN",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninLoginNotice", instanceKey: "signin-login-notice", layoutZone: "header" },
      { componentId: "SigninLoginTabs", instanceKey: "signin-login-tabs", layoutZone: "actions", propsSummary: ["tab", "memberScope"] },
      { componentId: "SigninLoginForm", instanceKey: "signin-login-form", layoutZone: "content", propsSummary: ["userId", "saveId", "autoLogin"] },
      { componentId: "SigninSimpleAuthActions", instanceKey: "signin-login-simple-auth", layoutZone: "content", propsSummary: ["simpleAuthEnabled"] }
    ]
  },
  "signin-auth-choice": {
    pageId: "signin-auth-choice",
    routePath: "/signin/authChoice",
    menuCode: "HMENU_SIGNIN_AUTH_CHOICE",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninAuthChoiceOptions", instanceKey: "signin-auth-choice-options", layoutZone: "content", propsSummary: ["availableMethods"] }
    ]
  },
  "signin-find-id": {
    pageId: "signin-find-id",
    routePath: "/signin/findId",
    menuCode: "HMENU_SIGNIN_FIND_ID",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninFindIdForm", instanceKey: "signin-find-id-form", layoutZone: "content", propsSummary: ["applcntNm", "email", "code", "tab"] },
      { componentId: "SigninFindIdMethods", instanceKey: "signin-find-id-methods", layoutZone: "content", propsSummary: ["tab", "availableMethods"] },
      { componentId: "SigninFindIdResultCard", instanceKey: "signin-find-id-result-card", layoutZone: "content", propsSummary: ["maskedId", "found", "tab"] },
      { componentId: "SigninFindIdResultActions", instanceKey: "signin-find-id-result-actions", layoutZone: "actions", propsSummary: ["passwordResetUrl"] }
    ]
  },
  "signin-find-id-result": {
    pageId: "signin-find-id-result",
    routePath: "/signin/findId/result",
    menuCode: "HMENU_SIGNIN_FIND_ID_RESULT",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninFindIdResultCard", instanceKey: "signin-find-id-result-card", layoutZone: "content", propsSummary: ["maskedId", "found", "tab"] },
      { componentId: "SigninFindIdResultActions", instanceKey: "signin-find-id-result-actions", layoutZone: "actions", propsSummary: ["passwordResetUrl"] }
    ]
  },
  "signin-find-password": {
    pageId: "signin-find-password",
    routePath: "/signin/findPassword",
    menuCode: "HMENU_SIGNIN_FIND_PASSWORD",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninFindPasswordVerify", instanceKey: "signin-find-password-verify", layoutZone: "content", propsSummary: ["userId", "email", "verificationCode", "verified"] },
      { componentId: "SigninFindPasswordReset", instanceKey: "signin-find-password-reset", layoutZone: "content", propsSummary: ["password", "passwordConfirm"] },
      { componentId: "SigninFindPasswordActions", instanceKey: "signin-find-password-actions", layoutZone: "actions", propsSummary: ["verified", "submitting"] },
      { componentId: "SigninFindPasswordResultCard", instanceKey: "signin-find-password-result-card", layoutZone: "content", propsSummary: ["resetComplete"] },
      { componentId: "SigninFindPasswordResultAction", instanceKey: "signin-find-password-result-action", layoutZone: "actions", propsSummary: ["loginPath"] }
    ]
  },
  "signin-find-password-result": {
    pageId: "signin-find-password-result",
    routePath: "/signin/findPassword/result",
    menuCode: "HMENU_SIGNIN_FINDPW_RESULT",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninFindPasswordResultCard", instanceKey: "signin-find-password-result-card", layoutZone: "content", propsSummary: ["resetComplete"] },
      { componentId: "SigninFindPasswordResultAction", instanceKey: "signin-find-password-result-action", layoutZone: "actions", propsSummary: ["loginPath"] }
    ]
  },
  "signin-forbidden": {
    pageId: "signin-forbidden",
    routePath: "/signin/loginForbidden",
    menuCode: "HMENU_SIGNIN_FORBIDDEN",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SigninForbiddenCard", instanceKey: "signin-forbidden-card", layoutZone: "content", propsSummary: ["pathCode", "sectionLabel"] }
    ]
  },
  "member-list": {
    pageId: "member-list",
    routePath: "/admin/member/list",
    menuCode: "AMENU_MEMBER_LIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberSearchForm", instanceKey: "member-list-search", layoutZone: "actions", propsSummary: ["searchKeyword", "membershipType", "status"] },
      { componentId: "MemberTable", instanceKey: "member-list-table", layoutZone: "content", propsSummary: ["rows", "pagination"] }
    ]
  },
  "member-withdrawn": {
    pageId: "member-withdrawn",
    routePath: "/admin/member/withdrawn",
    menuCode: "A0010106",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberSearchForm", instanceKey: "member-withdrawn-search", layoutZone: "actions", propsSummary: ["searchKeyword", "membershipType", "status"] },
      { componentId: "MemberTable", instanceKey: "member-withdrawn-table", layoutZone: "content", propsSummary: ["rows", "pagination"] }
    ]
  },
  "member-activate": {
    pageId: "member-activate",
    routePath: "/admin/member/activate",
    menuCode: "A0010107",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberSearchForm", instanceKey: "member-activate-search", layoutZone: "actions", propsSummary: ["searchKeyword", "membershipType", "status"] },
      { componentId: "MemberTable", instanceKey: "member-activate-table", layoutZone: "content", propsSummary: ["rows", "pagination"] }
    ]
  },
  "member-detail": {
    pageId: "member-detail",
    routePath: "/admin/member/detail",
    menuCode: "AMENU_MEMBER_DETAIL",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberLookup", instanceKey: "member-detail-lookup", layoutZone: "actions", propsSummary: ["memberId"] },
      { componentId: "MemberProfileCard", instanceKey: "member-detail-summary", layoutZone: "content", propsSummary: ["memberStatus", "memberType"] },
      { componentId: "PasswordResetHistory", instanceKey: "member-detail-history", layoutZone: "content", propsSummary: ["historyRows"] }
    ]
  },
  "member-edit": {
    pageId: "member-edit",
    routePath: "/admin/member/edit",
    menuCode: "AMENU_MEMBER_EDIT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberEditSummaryCard", instanceKey: "member-edit-summary", layoutZone: "content", propsSummary: ["memberId", "membershipTypeLabel", "statusLabel", "businessRoleLabel"] },
      { componentId: "MemberEditRoleProfileSummary", instanceKey: "member-edit-role-profile", layoutZone: "content", propsSummary: ["assignedRoleProfile", "businessRoleLabel", "accessScopes"] },
      { componentId: "MemberEditForm", instanceKey: "member-edit-form", layoutZone: "content", propsSummary: ["applcntNm", "applcntEmailAdres", "phoneNumber", "deptNm", "entrprsSeCode", "entrprsMberSttus"] },
      { componentId: "MemberEditPermissionMatrix", instanceKey: "member-edit-permissions", layoutZone: "content", propsSummary: ["authorCode", "featureCodes", "permissionFeatureCount", "permissionPageCount"] },
      { componentId: "MemberEditAddressForm", instanceKey: "member-edit-address", layoutZone: "content", propsSummary: ["zip", "adres", "detailAdres"] },
      { componentId: "MemberEditEvidenceList", instanceKey: "member-edit-evidence", layoutZone: "content", propsSummary: ["memberEvidenceFiles"] },
      { componentId: "MemberEditActions", instanceKey: "member-edit-actions", layoutZone: "actions", propsSummary: ["memberId", "canUseMemberSave"] }
    ]
  },
  "external-keys": {
    pageId: "external-keys",
    routePath: "/admin/external/keys",
    menuCode: "A0050201",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalKeyCloseoutGate", instanceKey: "external-keys-closeout-gate", layoutZone: "content", propsSummary: ["maskedReference", "targetRoute", "expiresAt", "rotationStatus"] },
      { componentId: "ExternalKeyActionContract", instanceKey: "external-keys-action-contract", layoutZone: "actions", propsSummary: ["issueKey", "rotateSelected", "revokeSelected", "auditExport"] },
      { componentId: "ExternalKeySummaryCards", instanceKey: "external-keys-summary", layoutZone: "content", propsSummary: ["externalKeySummary"] },
      { componentId: "ExternalKeyFilters", instanceKey: "external-keys-filters", layoutZone: "actions", propsSummary: ["keyword", "authMethod", "rotationStatus"] },
      { componentId: "ExternalKeyInventoryTable", instanceKey: "external-keys-inventory", layoutZone: "content", propsSummary: ["externalKeyRows", "filteredRows", "refreshedAt"] },
      { componentId: "ExternalKeyRotationQueue", instanceKey: "external-keys-rotation-queue", layoutZone: "content", propsSummary: ["externalKeyRotationRows"] },
      { componentId: "ExternalKeyAuthBreakdown", instanceKey: "external-keys-auth-breakdown", layoutZone: "content", propsSummary: ["authMethodRows", "urgentRows"] },
      { componentId: "ExternalKeyQuickLinks", instanceKey: "external-keys-quick-links", layoutZone: "content", propsSummary: ["externalKeyQuickLinks"] },
      { componentId: "ExternalKeyGuidance", instanceKey: "external-keys-guidance", layoutZone: "content", propsSummary: ["externalKeyGuidance"] }
    ]
  },
  "certificate-review": {
    pageId: "certificate-review",
    routePath: "/admin/certificate/review",
    menuCode: "A0020201",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateReviewSummary", instanceKey: "certificate-review-summary", layoutZone: "content", propsSummary: ["requestedCount", "underReviewCount", "readyCount"] },
      { componentId: "CertificateReviewFilters", instanceKey: "certificate-review-search", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "certificateType"] },
      { componentId: "CertificateReviewTable", instanceKey: "certificate-review-table", layoutZone: "content", propsSummary: ["rows", "pageIndex", "totalCount"] }
    ]
  },
  "external-connection-list": {
    pageId: "external-connection-list",
    routePath: "/admin/external/connection_list",
    menuCode: "A0050101",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalConnectionListSummaryCards", instanceKey: "external-connection-list-summary", layoutZone: "content", propsSummary: ["profileRegisteredCount", "profileMissingCount", "attentionCount"] },
      { componentId: "ExternalConnectionListFilters", instanceKey: "external-connection-list-filters", layoutZone: "actions", propsSummary: ["keyword", "status", "protocol", "source"] },
      { componentId: "ExternalConnectionListTable", instanceKey: "external-connection-list-table", layoutZone: "content", propsSummary: ["externalConnectionRows", "filteredCount", "pageNumber", "totalPages"] },
      { componentId: "ExternalConnectionIssueTable", instanceKey: "external-connection-list-issues", layoutZone: "content", propsSummary: ["externalConnectionIssueRows"] },
      { componentId: "ExternalConnectionGuidancePanel", instanceKey: "external-connection-list-guidance", layoutZone: "content", propsSummary: ["externalConnectionQuickLinks", "externalConnectionGuidance"] }
    ]
  },
  "external-connection-add": {
    pageId: "external-connection-add",
    routePath: "/admin/external/connection_add",
    menuCode: "A0050102",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalConnectionAddSummaryCards", instanceKey: "external-connection-add-summary", layoutZone: "content", propsSummary: ["completionRatio", "syncMode", "dirtyCount", "operationStatus"] },
      { componentId: "ExternalConnectionProfileForm", instanceKey: "external-connection-add-profile", layoutZone: "content", propsSummary: ["connectionName", "connectionId", "partnerName", "endpointUrl", "protocol", "authMethod"] },
      { componentId: "ExternalConnectionPolicyForm", instanceKey: "external-connection-add-sync-policy", layoutZone: "content", propsSummary: ["syncMode", "retryPolicy", "timeoutSeconds", "maintenanceWindow"] },
      { componentId: "ExternalConnectionOwnershipForm", instanceKey: "external-connection-add-ownership", layoutZone: "content", propsSummary: ["ownerName", "ownerContact", "operationStatus", "notes"] },
      { componentId: "ExternalConnectionAddActionBar", instanceKey: "external-connection-add-actions", layoutZone: "actions", propsSummary: ["saving", "mode=add"] }
    ]
  },
  "external-connection-edit": {
    pageId: "external-connection-edit",
    routePath: "/admin/external/connection_edit",
    menuCode: "A0050103",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalConnectionEditSummaryCards", instanceKey: "external-connection-edit-summary", layoutZone: "content", propsSummary: ["completionRatio", "syncMode", "dirtyCount", "operationStatus"] },
      { componentId: "ExternalConnectionProfileForm", instanceKey: "external-connection-edit-profile", layoutZone: "content", propsSummary: ["connectionName", "connectionId", "partnerName", "endpointUrl", "protocol", "authMethod"] },
      { componentId: "ExternalConnectionPolicyForm", instanceKey: "external-connection-edit-sync-policy", layoutZone: "content", propsSummary: ["syncMode", "retryPolicy", "timeoutSeconds", "maintenanceWindow"] },
      { componentId: "ExternalConnectionOwnershipForm", instanceKey: "external-connection-edit-ownership", layoutZone: "content", propsSummary: ["ownerName", "ownerContact", "operationStatus", "notes"] },
      { componentId: "ExternalConnectionEditActionBar", instanceKey: "external-connection-edit-actions", layoutZone: "actions", propsSummary: ["saving", "mode=edit", "connectionId"] }
    ]
  },
  "external-usage": {
    pageId: "external-usage",
    routePath: "/admin/external/usage",
    menuCode: "A0050108",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalUsageFilters", instanceKey: "external-usage-filters", layoutZone: "actions", propsSummary: ["keyword", "authMethod", "status"] },
      { componentId: "ExternalUsageSummaryCards", instanceKey: "external-usage-summary", layoutZone: "content", propsSummary: ["externalUsageSummary"] },
      { componentId: "ExternalUsageTable", instanceKey: "external-usage-table", layoutZone: "content", propsSummary: ["externalUsageRows", "filteredCount"] },
      { componentId: "ExternalUsageAuthBreakdown", instanceKey: "external-usage-auth", layoutZone: "content", propsSummary: ["externalUsageKeyRows"] },
      { componentId: "ExternalUsageTrendTable", instanceKey: "external-usage-trend", layoutZone: "content", propsSummary: ["externalUsageTrendRows"] },
      { componentId: "ExternalUsageQuickLinks", instanceKey: "external-usage-links", layoutZone: "content", propsSummary: ["externalUsageQuickLinks"] },
      { componentId: "ExternalUsageGuidance", instanceKey: "external-usage-guidance", layoutZone: "content", propsSummary: ["externalUsageGuidance"] }
    ]
  },
  "external-webhooks": {
    pageId: "external-webhooks",
    routePath: "/admin/external/webhooks",
    menuCode: "A0050203",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalWebhookSummaryCards", instanceKey: "external-webhooks-summary", layoutZone: "content", propsSummary: ["externalWebhookSummary"] },
      { componentId: "ExternalWebhookCloseoutGate", instanceKey: "external-webhooks-closeout-gate", layoutZone: "content", propsSummary: ["endpointCrud", "secretRotation", "testDelivery", "replay", "failurePolicy"] },
      { componentId: "ExternalWebhookActionContract", instanceKey: "external-webhooks-action-contract", layoutZone: "actions", propsSummary: ["addEndpoint", "rotateSecret", "testDelivery", "replayFailed"] },
      { componentId: "ExternalWebhookFilters", instanceKey: "external-webhooks-filters", layoutZone: "actions", propsSummary: ["keyword", "syncMode", "status"] },
      { componentId: "ExternalWebhookRegistryTable", instanceKey: "external-webhooks-targets", layoutZone: "content", propsSummary: ["externalWebhookRows", "refreshedAt"] },
      { componentId: "ExternalWebhookPolicyTable", instanceKey: "external-webhooks-deliveries", layoutZone: "content", propsSummary: ["externalWebhookDeliveryRows"] },
      { componentId: "ExternalWebhookQuickLinks", instanceKey: "external-webhooks-links", layoutZone: "content", propsSummary: ["externalWebhookQuickLinks"] },
      { componentId: "ExternalWebhookGuidance", instanceKey: "external-webhooks-guidance", layoutZone: "content", propsSummary: ["externalWebhookGuidance"] }
    ]
  },
  "external-sync": {
    pageId: "external-sync",
    routePath: "/admin/external/sync",
    menuCode: "A0050104",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalSyncFilters", instanceKey: "external-sync-filters", layoutZone: "actions", propsSummary: ["keyword", "syncMode", "status"] },
      { componentId: "ExternalSyncSummaryCards", instanceKey: "external-sync-summary", layoutZone: "content", propsSummary: ["externalSyncSummary"] },
      { componentId: "ExternalSyncRegistryTable", instanceKey: "external-sync-registry", layoutZone: "content", propsSummary: ["externalSyncRows", "filteredCount", "refreshedAt"] },
      { componentId: "ExternalSyncQueueTable", instanceKey: "external-sync-queue", layoutZone: "content", propsSummary: ["externalSyncQueueRows"] },
      { componentId: "ExternalSyncQuickLinks", instanceKey: "external-sync-links", layoutZone: "content", propsSummary: ["externalSyncQuickLinks"] },
      { componentId: "ExternalSyncGuidance", instanceKey: "external-sync-guidance", layoutZone: "content", propsSummary: ["externalSyncGuidance"] },
      { componentId: "ExternalSyncExecutionTable", instanceKey: "external-sync-executions", layoutZone: "content", propsSummary: ["externalSyncExecutionRows"] }
    ]
  },
  "external-logs": {
    pageId: "external-logs",
    routePath: "/admin/external/logs",
    menuCode: "A0050303",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalLogsFilters", instanceKey: "external-logs-filters", layoutZone: "actions", propsSummary: ["keyword", "logType", "severity"] },
      { componentId: "ExternalLogsSummaryCards", instanceKey: "external-logs-summary", layoutZone: "content", propsSummary: ["externalLogSummary"] },
      { componentId: "ExternalLogsTable", instanceKey: "external-logs-queue", layoutZone: "content", propsSummary: ["externalLogRows", "filteredCount"] },
      { componentId: "ExternalLogsIssueTable", instanceKey: "external-logs-issues", layoutZone: "content", propsSummary: ["externalLogIssueRows"] },
      { componentId: "ExternalLogsWatchList", instanceKey: "external-logs-watchlist", layoutZone: "content", propsSummary: ["externalLogConnectionRows"] },
      { componentId: "ExternalLogsQuickLinks", instanceKey: "external-logs-links", layoutZone: "content", propsSummary: ["externalLogQuickLinks"] },
      { componentId: "ExternalLogsGuidance", instanceKey: "external-logs-guidance", layoutZone: "content", propsSummary: ["externalLogGuidance"] }
    ]
  },
  "external-maintenance": {
    pageId: "external-maintenance",
    routePath: "/admin/external/maintenance",
    menuCode: "A0050107",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalMaintenanceSummaryCards", instanceKey: "external-maintenance-summary", layoutZone: "content", propsSummary: ["externalMaintenanceSummary"] },
      { componentId: "ExternalMaintenanceCloseoutGate", instanceKey: "external-maintenance-closeout-gate", layoutZone: "content", propsSummary: ["windowCrud", "approvalRelease", "affectedScope", "noticePlan", "backlogReplay", "incidentLinkage"] },
      { componentId: "ExternalMaintenanceActionContract", instanceKey: "external-maintenance-action-contract", layoutZone: "actions", propsSummary: ["createWindow", "requestApproval", "noticePlan", "replayBacklog", "openIncident"] },
      { componentId: "ExternalMaintenanceFilters", instanceKey: "external-maintenance-filters", layoutZone: "actions", propsSummary: ["keyword", "syncMode", "status"] },
      { componentId: "ExternalMaintenanceInventoryTable", instanceKey: "external-maintenance-inventory", layoutZone: "content", propsSummary: ["externalMaintenanceRows", "filteredCount", "refreshedAt"] },
      { componentId: "ExternalMaintenanceImpactTable", instanceKey: "external-maintenance-impact", layoutZone: "content", propsSummary: ["externalMaintenanceImpactRows"] },
      { componentId: "ExternalMaintenanceRunbook", instanceKey: "external-maintenance-runbook", layoutZone: "content", propsSummary: ["externalMaintenanceRunbooks"] },
      { componentId: "ExternalMaintenanceQuickLinks", instanceKey: "external-maintenance-links", layoutZone: "content", propsSummary: ["externalMaintenanceQuickLinks"] },
      { componentId: "ExternalMaintenanceGuidance", instanceKey: "external-maintenance-guidance", layoutZone: "content", propsSummary: ["externalMaintenanceGuidance"] }
    ]
  },
  "external-schema": {
    pageId: "external-schema",
    routePath: "/admin/external/schema",
    menuCode: "A0050202",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalSchemaSummaryCards", instanceKey: "external-schema-summary", layoutZone: "content", propsSummary: ["externalSchemaSummary"] },
      { componentId: "ExternalSchemaCloseoutGate", instanceKey: "external-schema-closeout-gate", layoutZone: "content", propsSummary: ["registryReview", "contractSnapshot", "reviewQueue", "versionPublish", "compatibilityTest", "rollback", "endpointBinding", "changeAudit"] },
      { componentId: "ExternalSchemaActionContract", instanceKey: "external-schema-action-contract", layoutZone: "actions", propsSummary: ["publishVersion", "runCompatibility", "rollback", "bindEndpoint", "recordAudit"] },
      { componentId: "ExternalSchemaFilters", instanceKey: "external-schema-filters", layoutZone: "actions", propsSummary: ["keyword", "domain", "status"] },
      { componentId: "ExternalSchemaRegistryTable", instanceKey: "external-schema-registry", layoutZone: "content", propsSummary: ["externalSchemaRows", "filteredCount", "selectedSchemaId"] },
      { componentId: "ExternalSchemaReviewPanel", instanceKey: "external-schema-review", layoutZone: "content", propsSummary: ["activeSchemaId", "contractPreview", "reviewChecklist"] },
      { componentId: "ExternalSchemaReviewQueue", instanceKey: "external-schema-review-queue", layoutZone: "content", propsSummary: ["externalSchemaReviewRows", "compatibility", "masking", "governanceOwner"] },
      { componentId: "ExternalSchemaQuickLinks", instanceKey: "external-schema-links", layoutZone: "content", propsSummary: ["externalSchemaQuickLinks"] },
      { componentId: "ExternalSchemaGuidance", instanceKey: "external-schema-guidance", layoutZone: "content", propsSummary: ["externalSchemaGuidance"] }
    ]
  },
  "external-monitoring": {
    pageId: "external-monitoring",
    routePath: "/admin/external/monitoring",
    menuCode: "A0050106",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalMonitoringFilters", instanceKey: "external-monitoring-filters", layoutZone: "actions", propsSummary: ["keyword", "healthStatus", "alertLevel"] },
      { componentId: "ExternalMonitoringSummaryCards", instanceKey: "external-monitoring-summary", layoutZone: "content", propsSummary: ["externalMonitoringSummary", "overallStatus"] },
      { componentId: "ExternalMonitoringOverviewTable", instanceKey: "external-monitoring-overview", layoutZone: "content", propsSummary: ["externalMonitoringRows", "filteredCount", "refreshedAt"] },
      { componentId: "ExternalMonitoringAlertTable", instanceKey: "external-monitoring-alerts", layoutZone: "content", propsSummary: ["externalMonitoringAlertRows"] },
      { componentId: "ExternalMonitoringTimelineTable", instanceKey: "external-monitoring-timeline", layoutZone: "content", propsSummary: ["externalMonitoringTimelineRows"] },
      { componentId: "ExternalMonitoringQuickLinks", instanceKey: "external-monitoring-links", layoutZone: "content", propsSummary: ["externalMonitoringQuickLinks"] },
      { componentId: "ExternalMonitoringGuidance", instanceKey: "external-monitoring-guidance", layoutZone: "content", propsSummary: ["externalMonitoringGuidance"] }
    ]
  },
  "company-detail": {
    pageId: "company-detail",
    routePath: "/admin/member/company_detail",
    menuCode: "AMENU_COMPANY_DETAIL",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CompanyLookup", instanceKey: "company-detail-lookup", layoutZone: "actions", propsSummary: ["insttId"] },
      { componentId: "CompanySummaryCard", instanceKey: "company-detail-summary", layoutZone: "content", propsSummary: ["insttNm", "companyTypeLabel", "companyStatusLabel"] },
      { componentId: "CompanyFilesTable", instanceKey: "company-detail-files", layoutZone: "content", propsSummary: ["companyFiles", "fileCount"] }
    ]
  },
  "member-approve": {
    pageId: "member-approve",
    routePath: "/admin/member/approve",
    menuCode: "A0010103",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberApprovalFilter", instanceKey: "member-approve-search", layoutZone: "actions", propsSummary: ["status", "membershipType", "searchKeyword"] },
      { componentId: "MemberApprovalBatchActions", instanceKey: "member-approve-batch-actions", layoutZone: "actions", propsSummary: ["selectedIds", "canUseMemberApproveAction"] },
      { componentId: "MemberApprovalTable", instanceKey: "member-approve-table", layoutZone: "content", propsSummary: ["rows", "pageIndex"] }
    ]
  },
  "company-approve": {
    pageId: "company-approve",
    routePath: "/admin/member/company-approve",
    menuCode: "A0010202",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CompanyApprovalFilter", instanceKey: "company-approve-search", layoutZone: "actions", propsSummary: ["status", "result", "searchKeyword"] },
      { componentId: "CompanyApprovalBatchActions", instanceKey: "company-approve-batch-actions", layoutZone: "actions", propsSummary: ["selectedIds", "canUseCompanyApproveAction"] },
      { componentId: "CompanyApprovalTable", instanceKey: "company-approve-table", layoutZone: "content", propsSummary: ["rows", "pageIndex"] }
    ]
  },
  "certificate-pending": {
    pageId: "certificate-pending",
    routePath: "/admin/certificate/pending_list",
    menuCode: "AMENU_CERTIFICATE_PENDING",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificatePendingSummary", instanceKey: "certificate-pending-summary", layoutZone: "actions", propsSummary: ["certificatePendingSummary"] },
      { componentId: "CertificatePendingFilter", instanceKey: "certificate-pending-search", layoutZone: "actions", propsSummary: ["certificateType", "processStatus", "searchKeyword"] },
      { componentId: "CertificatePendingTable", instanceKey: "certificate-pending-table", layoutZone: "content", propsSummary: ["certificatePendingRows", "pageIndex"] }
    ]
  },
  "virtual-issue": {
    pageId: "virtual-issue",
    routePath: "/admin/payment/virtual_issue",
    menuCode: "A0030303",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RefundAccountReviewSummary", instanceKey: "virtual-issue-summary", layoutZone: "actions", propsSummary: ["refundAccountSummary"] },
      { componentId: "RefundAccountReviewFilter", instanceKey: "virtual-issue-search", layoutZone: "actions", propsSummary: ["verificationStatus", "payoutStatus", "searchKeyword"] },
      { componentId: "RefundAccountReviewTable", instanceKey: "virtual-issue-table", layoutZone: "content", propsSummary: ["refundAccountRows", "pageIndex"] },
      { componentId: "RefundAccountReviewDetail", instanceKey: "virtual-issue-detail", layoutZone: "content", propsSummary: ["activeRequestId", "refundRequestId", "requestedAmount"] },
      { componentId: "RefundAccountReviewChecklist", instanceKey: "virtual-issue-checklist", layoutZone: "content", propsSummary: ["checklist"] },
      { componentId: "RefundAccountReviewGuidance", instanceKey: "virtual-issue-guidance", layoutZone: "content", propsSummary: ["refundAccountGuidance"] }
    ]
  },
  "certificate-rec-check": {
    pageId: "certificate-rec-check",
    routePath: "/admin/certificate/rec_check",
    menuCode: "A0020204",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateRecCheckSummary", instanceKey: "certificate-rec-check-summary", layoutZone: "content", propsSummary: ["totalCount", "blockedCount", "reviewCount", "highestRisk"] },
      { componentId: "CertificateRecCheckFilters", instanceKey: "certificate-rec-check-filters", layoutZone: "actions", propsSummary: ["keyword", "status", "basis"] },
      { componentId: "CertificateRecCheckTable", instanceKey: "certificate-rec-check-table", layoutZone: "content", propsSummary: ["filteredGroups", "selectedGroupId"] },
      { componentId: "CertificateRecCheckDetail", instanceKey: "certificate-rec-check-detail", layoutZone: "content", propsSummary: ["selectedGroup"] },
      { componentId: "CertificateRecCheckGuidance", instanceKey: "certificate-rec-check-guidance", layoutZone: "content", propsSummary: ["guidance"] },
      { componentId: "CertificateRecCheckLinks", instanceKey: "certificate-rec-check-links", layoutZone: "content", propsSummary: ["quickLinks"] }
    ]
  },
  "certificate-objection-list": {
    pageId: "certificate-objection-list",
    routePath: "/admin/certificate/objection_list",
    menuCode: "A0020202",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateObjectionSummary", instanceKey: "certificate-objection-list-summary", layoutZone: "actions", propsSummary: ["certificateObjectionSummary"] },
      { componentId: "CertificateObjectionFilter", instanceKey: "certificate-objection-list-search", layoutZone: "actions", propsSummary: ["status", "priority", "searchKeyword"] },
      { componentId: "CertificateObjectionTable", instanceKey: "certificate-objection-list-table", layoutZone: "content", propsSummary: ["certificateObjectionRows", "pageIndex"] },
      { componentId: "CertificateObjectionGuidance", instanceKey: "certificate-objection-list-guidance", layoutZone: "content", propsSummary: ["certificateObjectionGuidance"] }
    ]
  },
  "certificate-statistics": {
    pageId: "certificate-statistics",
    routePath: "/admin/certificate/statistics",
    menuCode: "A0020203",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateStatisticsSummary", instanceKey: "certificate-statistics-summary", layoutZone: "actions", propsSummary: ["totalIssuedCount", "pendingCount", "rejectedCount", "reissuedCount", "issuanceRate"] },
      { componentId: "CertificateStatisticsFilter", instanceKey: "certificate-statistics-filter", layoutZone: "actions", propsSummary: ["periodFilter", "certificateType", "issuanceStatus", "searchKeyword"] },
      { componentId: "CertificateStatisticsTrend", instanceKey: "certificate-statistics-trend", layoutZone: "content", propsSummary: ["monthlyRows", "periodFilter"] },
      { componentId: "CertificateStatisticsAlerts", instanceKey: "certificate-statistics-alerts", layoutZone: "content", propsSummary: ["alertRows"] },
      { componentId: "CertificateStatisticsTypeTable", instanceKey: "certificate-statistics-type-table", layoutZone: "content", propsSummary: ["certificateTypeRows"] },
      { componentId: "CertificateStatisticsInstitutionTable", instanceKey: "certificate-statistics-institution-table", layoutZone: "content", propsSummary: ["institutionRows", "pageIndex", "totalPages"] }
    ]
  },
  "company-list": {
    pageId: "company-list",
    routePath: "/admin/member/company_list",
    menuCode: "AMENU_COMPANY_LIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CompanyListSearchForm", instanceKey: "company-list-search", layoutZone: "actions", propsSummary: ["searchKeyword", "sbscrbSttus", "pageIndex"] },
      { componentId: "CompanyListTable", instanceKey: "company-list-table", layoutZone: "content", propsSummary: ["company_list", "totalCount", "pageIndex"] },
      { componentId: "CompanyListPagination", instanceKey: "company-list-pagination", layoutZone: "actions", propsSummary: ["currentPage", "totalPages"] }
    ]
  },
  "company-account": {
    pageId: "company-account",
    routePath: "/admin/member/company_account",
    menuCode: "AMENU_COMPANY_ACCOUNT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CompanyAccountLookup", instanceKey: "company-account-lookup", layoutZone: "actions", propsSummary: ["lookupInsttId"] },
      { componentId: "CompanyAccountMembershipCards", instanceKey: "company-account-membership", layoutZone: "content", propsSummary: ["membershipType"] },
      { componentId: "CompanyAccountBusinessForm", instanceKey: "company-account-business", layoutZone: "content", propsSummary: ["agencyName", "representativeName", "bizRegistrationNumber", "zipCode", "companyAddress"] },
      { componentId: "CompanyAccountContactForm", instanceKey: "company-account-contact", layoutZone: "content", propsSummary: ["chargerName", "chargerEmail", "chargerTel"] },
      { componentId: "CompanyAccountFileUpload", instanceKey: "company-account-files", layoutZone: "content", propsSummary: ["fileUploads", "fileCount"] },
      { componentId: "CompanyAccountFileTable", instanceKey: "company-account-file-table", layoutZone: "content", propsSummary: ["companyAccountFiles"] },
      { componentId: "CompanyAccountActions", instanceKey: "company-account-actions", layoutZone: "actions", propsSummary: ["insttId", "isEditMode"] }
    ]
  },
  "join-wizard": {
    pageId: "join-wizard",
    routePath: "/join/step1",
    menuCode: "HMENU_JOIN_STEP1",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinHero", instanceKey: "join-hero", layoutZone: "header" },
      { componentId: "MembershipTypeCardGroup", instanceKey: "membership-type-card-group", layoutZone: "content", propsSummary: ["membershipType"] },
      { componentId: "JoinWizardActions", instanceKey: "join-wizard-actions", layoutZone: "actions", propsSummary: ["nextEnabled"] }
    ]
  },
  "join-company-register": {
    pageId: "join-company-register",
    routePath: "/join/companyRegister",
    menuCode: "HMENU_JOIN_COMPANY_REGISTER",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyContactForm", instanceKey: "join-company-register-contact", layoutZone: "content", propsSummary: ["chargerName", "chargerEmail", "chargerTel"] },
      { componentId: "JoinCompanyBusinessForm", instanceKey: "join-company-register-business", layoutZone: "content", propsSummary: ["membershipType", "agencyName", "representativeName", "bizRegistrationNumber"] },
      { componentId: "JoinCompanyFileUpload", instanceKey: "join-company-register-files", layoutZone: "content", propsSummary: ["uploadRows", "fileCount"] }
    ]
  },
  "join-company-register-complete": {
    pageId: "join-company-register-complete",
    routePath: "/join/companyRegisterComplete",
    menuCode: "HMENU_JOIN_COMP_REG_DONE",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyRegisterCompleteSummary", instanceKey: "join-company-register-complete-summary", layoutZone: "content", propsSummary: ["insttNm", "bizrno", "regDate"] },
      { componentId: "JoinCompanyRegisterCompleteActions", instanceKey: "join-company-register-complete-actions", layoutZone: "actions", propsSummary: ["homePath", "statusGuidePath"] }
    ]
  },
  "join-company-status": {
    pageId: "join-company-status",
    routePath: "/join/companyJoinStatusSearch",
    menuCode: "HMENU_JOIN_COMPANY_STATUS",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyStatusSearchForm", instanceKey: "join-company-status-search", layoutZone: "content", propsSummary: ["mode", "bizNo", "appNo", "repName", "agreed"] }
    ]
  },
  "join-company-status-guide": {
    pageId: "join-company-status-guide",
    routePath: "/join/companyJoinStatusGuide",
    menuCode: "HMENU_JOIN_COMP_STAT_GUIDE",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyStatusGuide", instanceKey: "join-company-status-guide", layoutZone: "content", propsSummary: ["guideVisible"] }
    ]
  },
  "join-company-status-detail": {
    pageId: "join-company-status-detail",
    routePath: "/join/companyJoinStatusDetail",
    menuCode: "HMENU_JOIN_COMP_STAT_DETAIL",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyStatusDetailSummary", instanceKey: "join-company-status-detail-summary", layoutZone: "content", propsSummary: ["insttId", "insttNm", "bizrno", "reprsntNm", "frstRegistPnttm"] },
      { componentId: "JoinCompanyStatusTimeline", instanceKey: "join-company-status-detail-timeline", layoutZone: "content", propsSummary: ["insttSttus", "rejectReason", "lastUpdated"] },
      { componentId: "JoinCompanyStatusFiles", instanceKey: "join-company-status-detail-files", layoutZone: "content", propsSummary: ["insttFiles", "fileCount"] },
      { componentId: "JoinCompanyStatusActions", instanceKey: "join-company-status-detail-actions", layoutZone: "actions", propsSummary: ["canReapply", "homePath"] }
    ]
  },
  "join-company-reapply": {
    pageId: "join-company-reapply",
    routePath: "/join/companyReapply",
    menuCode: "HMENU_JOIN_COMPANY_REAPPLY",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompanyReapplyLookup", instanceKey: "join-company-reapply-lookup", layoutZone: "actions", propsSummary: ["bizNo", "repName"] },
      { componentId: "JoinCompanyReapplyForm", instanceKey: "join-company-reapply-form", layoutZone: "content", propsSummary: ["agencyName", "representativeName", "chargerName", "chargerEmail", "chargerTel"] },
      { componentId: "JoinCompanyReapplyFiles", instanceKey: "join-company-reapply-files", layoutZone: "content", propsSummary: ["uploadRows", "fileCount"] }
    ]
  },
  "my-inquiry": {
    pageId: "my-inquiry",
    routePath: "/mtn/my_inquiry",
    menuCode: "HMENU_MY_INQUIRY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MyInquiryHero", instanceKey: "my-inquiry-hero", layoutZone: "header", propsSummary: ["supportMode", "managerName"] },
      { componentId: "MyInquiryChat", instanceKey: "my-inquiry-chat", layoutZone: "content", propsSummary: ["chatCount", "suggestionCount", "assistantState"] },
      { componentId: "MyInquiryForm", instanceKey: "my-inquiry-form", layoutZone: "content", propsSummary: ["inquiryType", "emissionSite", "attachmentCount"] }
    ]
  },
  "mtn-status": {
    pageId: "mtn-status",
    routePath: "/mtn/status",
    menuCode: "HMENU_MTN_STATUS",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MtnStatusHero", instanceKey: "mtn-status-hero", layoutZone: "header", propsSummary: ["queueCount", "searchPlaceholder", "primaryAction"] },
      { componentId: "MtnStatusPinnedSites", instanceKey: "mtn-status-pinned-sites", layoutZone: "content", propsSummary: ["siteCount", "priorityAlertCount"] },
      { componentId: "MtnStatusTimeline", instanceKey: "mtn-status-timeline", layoutZone: "sidebar", propsSummary: ["timelineCount", "reportUpdatedAt"] }
    ]
  },
  "mtn-version": {
    pageId: "mtn-version",
    routePath: "/mtn/version",
    menuCode: "H0090204",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MtnVersionHero", instanceKey: "mtn-version-hero", layoutZone: "header", propsSummary: ["heroEyebrow", "heroTitle", "heroButton"] },
      { componentId: "MtnVersionSummary", instanceKey: "mtn-version-summary", layoutZone: "header", propsSummary: ["currentVersion", "latestVersion", "currentStatus"] },
      { componentId: "MtnVersionQueue", instanceKey: "mtn-version-queue", layoutZone: "content", propsSummary: ["queueCount", "relatedInquiryLabel"] },
      { componentId: "MtnVersionReleaseNotes", instanceKey: "mtn-version-release-notes", layoutZone: "content", propsSummary: ["releaseCount", "latestReleaseVersion"] },
      { componentId: "MtnVersionActions", instanceKey: "mtn-version-actions", layoutZone: "sidebar", propsSummary: ["actionCount", "referenceNoteTitle"] }
    ]
  },
  "support-faq": {
    pageId: "support-faq",
    routePath: "/support/faq",
    menuCode: "H0050101",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SupportFaqHero", instanceKey: "support-faq-hero", layoutZone: "header", propsSummary: ["searchValue", "keywordCount"] },
      { componentId: "SupportFaqAccordion", instanceKey: "support-faq-accordion", layoutZone: "content", propsSummary: ["faqCount", "selectedCategory"] },
      { componentId: "SupportFaqAnnouncements", instanceKey: "support-faq-announcements", layoutZone: "content", propsSummary: ["noticeCount", "urgentCount"] },
      { componentId: "SupportFaqQuickSupport", instanceKey: "support-faq-quick-support", layoutZone: "sidebar", propsSummary: ["contactSummary", "responseWindow"] }
    ]
  },
  "support-inquiry": {
    pageId: "support-inquiry",
    routePath: "/support/inquiry",
    menuCode: "H0050102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SupportInquiryHero", instanceKey: "support-inquiry-hero", layoutZone: "header", propsSummary: ["draftValue", "keywordCount", "summaryMetrics"] },
      { componentId: "SupportInquiryFilters", instanceKey: "support-inquiry-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "statusFilter", "resultCount"] },
      { componentId: "SupportInquiryThreadList", instanceKey: "support-inquiry-thread-list", layoutZone: "content", propsSummary: ["threadCount", "selectedInquiryId"] },
      { componentId: "SupportInquiryChat", instanceKey: "support-inquiry-chat", layoutZone: "content", propsSummary: ["selectedInquiryId", "messageCount", "agentName"] }
    ]
  },
  "download-list": {
    pageId: "download-list",
    routePath: "/support/download_list",
    menuCode: "H0050102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "DownloadListHero", instanceKey: "download-list-hero", layoutZone: "header", propsSummary: ["keyword", "selectedCategory"] },
      { componentId: "DownloadListCards", instanceKey: "download-list-cards", layoutZone: "content", propsSummary: ["resourceCount", "featuredCount"] },
      { componentId: "DownloadListSupportDesk", instanceKey: "download-list-support-desk", layoutZone: "sidebar", propsSummary: ["phoneNumber", "liveChannelCount"] },
      { componentId: "DownloadListUrgentNotices", instanceKey: "download-list-urgent-notices", layoutZone: "sidebar", propsSummary: ["noticeCount", "relatedNoticePath"] }
    ]
  },
  "qna-list": {
    pageId: "qna-list",
    routePath: "/support/qna_list",
    menuCode: "H0050103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "QnaListHero", instanceKey: "qna-list-hero", layoutZone: "header", propsSummary: ["keyword", "keywordCount"] },
      { componentId: "QnaFeaturedCards", instanceKey: "qna-list-featured-cards", layoutZone: "content", propsSummary: ["cardCount", "criticalCount"] },
      { componentId: "QnaListSidebar", instanceKey: "qna-list-sidebar", layoutZone: "sidebar", propsSummary: ["categoryCount", "supportContact"] },
      { componentId: "QnaListFeed", instanceKey: "qna-list-feed", layoutZone: "content", propsSummary: ["entryCount", "sortBy", "activeFilter"] }
    ]
  },
  "join-terms": {
    pageId: "join-terms",
    routePath: "/join/step2",
    menuCode: "HMENU_JOIN_STEP2",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinTermsAllAgree", instanceKey: "join-step2-all-agree", layoutZone: "content", propsSummary: ["agreeTerms", "agreePrivacy"] },
      { componentId: "JoinRequiredTerms", instanceKey: "join-step2-required-terms", layoutZone: "content", propsSummary: ["requiredTermsAccepted"] },
      { componentId: "JoinMarketingConsent", instanceKey: "join-step2-marketing", layoutZone: "content", propsSummary: ["marketingAgree"] }
    ]
  },
  "join-auth": {
    pageId: "join-auth",
    routePath: "/join/step3",
    menuCode: "HMENU_JOIN_STEP3",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinAuthMethodGrid", instanceKey: "join-step3-methods", layoutZone: "content", propsSummary: ["authMethods", "submittingMethod"] }
    ]
  },
  "join-info": {
    pageId: "join-info",
    routePath: "/join/step4",
    menuCode: "HMENU_JOIN_STEP4",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinUserInfoForm", instanceKey: "join-step4-user", layoutZone: "content", propsSummary: ["mberId", "mberNm", "phone", "email", "zip"] },
      { componentId: "JoinOrganizationForm", instanceKey: "join-step4-org", layoutZone: "content", propsSummary: ["insttId", "insttNm", "bizrno", "deptNm"] },
      { componentId: "JoinFileUploadSection", instanceKey: "join-step4-files", layoutZone: "content", propsSummary: ["uploadRows", "fileCount"] }
    ]
  },
  "join-complete": {
    pageId: "join-complete",
    routePath: "/join/step5",
    menuCode: "HMENU_JOIN_STEP5",
    domainCode: "join",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "JoinCompleteSummary", instanceKey: "join-step5-summary", layoutZone: "content", propsSummary: ["mberId", "mberNm", "insttNm"] },
      { componentId: "JoinCompleteActions", instanceKey: "join-step5-actions", layoutZone: "actions", propsSummary: ["homePath"] }
    ]
  },
  "mypage": {
    pageId: "mypage",
    routePath: "/mypage/profile",
    menuCode: "HMENU_MYPAGE",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageBasicInfoForm", instanceKey: "mypage-basic-info", layoutZone: "content", propsSummary: ["fullName", "userId", "email", "phone"] },
      { componentId: "MypageOrgInfoForm", instanceKey: "mypage-org-info", layoutZone: "content", propsSummary: ["companyName", "businessNumber", "jobTitle"] },
      { componentId: "MypageActions", instanceKey: "mypage-actions", layoutZone: "actions", propsSummary: ["submitting", "canSubmit"] }
    ]
  },
  "mypage-notification": {
    pageId: "mypage-notification",
    routePath: "/mypage/notification",
    menuCode: "H0080104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageNotificationHero", instanceKey: "mypage-notification-hero", layoutZone: "header", propsSummary: ["displayName", "email"] },
      { componentId: "MypageNotificationSummary", instanceKey: "mypage-notification-summary", layoutZone: "actions", propsSummary: ["criticalCount", "responseSpeed", "unreadCount"] },
      { componentId: "MypageNotificationSettings", instanceKey: "mypage-notification-settings", layoutZone: "content", propsSummary: ["emailEnabled", "smsReadonly", "appReadonly"] },
      { componentId: "MypageNotificationMarketing", instanceKey: "mypage-notification-marketing", layoutZone: "content", propsSummary: ["marketingEnabled", "submitting"] }
    ]
  },
  "mypage-marketing": {
    pageId: "mypage-marketing",
    routePath: "/mypage/marketing",
    menuCode: "H0080204",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageMarketingHero", instanceKey: "mypage-marketing-hero", layoutZone: "header", propsSummary: ["displayName", "marketingEnabled"] },
      { componentId: "MypageMarketingConsent", instanceKey: "mypage-marketing-consent", layoutZone: "content", propsSummary: ["marketingEnabled", "submitting"] },
      { componentId: "MypageMarketingPrivacy", instanceKey: "mypage-marketing-privacy", layoutZone: "sidebar", propsSummary: ["privacySummary", "faqSummary"] }
    ]
  },
  "mypage-company": {
    pageId: "mypage-company",
    routePath: "/mypage/company",
    menuCode: "HMENU_MYPAGE_COMPANY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageCompanyHero", instanceKey: "mypage-company-hero", layoutZone: "header", propsSummary: ["companyName", "siteCount", "searchKeyword"] },
      { componentId: "MypageCompanyProfile", instanceKey: "mypage-company-profile", layoutZone: "content", propsSummary: ["companyName", "representative", "businessNumber"] },
      { componentId: "MypageCompanySites", instanceKey: "mypage-company-sites", layoutZone: "content", propsSummary: ["siteCode", "siteStatus", "lastUpdated"] },
      { componentId: "MypageCompanyContacts", instanceKey: "mypage-company-contacts", layoutZone: "sidebar", propsSummary: ["contactName", "role", "accessScope"] }
    ]
  },
  "mypage-password": {
    pageId: "mypage-password",
    routePath: "/mypage/password",
    menuCode: "HMENU_MYPAGE_PASSWORD",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypagePasswordHero", instanceKey: "mypage-password-hero", layoutZone: "header", propsSummary: ["securityStatus", "userName"] },
      { componentId: "MypagePasswordMenu", instanceKey: "mypage-password-menu", layoutZone: "sidebar", propsSummary: ["activeMenu", "helpText"] },
      { componentId: "MypagePasswordForm", instanceKey: "mypage-password-form", layoutZone: "content", propsSummary: ["currentPassword", "newPassword", "confirmPassword"] }
    ]
  },
  "edu-my-course": {
    pageId: "edu-my-course",
    routePath: "/edu/my_course",
    menuCode: "H0070104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduMyCourseHero", instanceKey: "edu-my-course-hero", layoutZone: "header", propsSummary: ["pageTitle", "pageStatus", "learningGoalValue"] },
      { componentId: "EduMyCourseSummary", instanceKey: "edu-my-course-summary", layoutZone: "actions", propsSummary: ["milestones", "completionValue", "learningGoalValue"] },
      { componentId: "EduMyCourseFilters", instanceKey: "edu-my-course-filters", layoutZone: "actions", propsSummary: ["query", "status", "track"] },
      { componentId: "EduMyCourseBoard", instanceKey: "edu-my-course-board", layoutZone: "content", propsSummary: ["courseCount", "status", "track"] },
      { componentId: "EduMyCourseActivity", instanceKey: "edu-my-course-activity", layoutZone: "content", propsSummary: ["activityCount", "latestEvent"] },
      { componentId: "EduMyCourseRecommend", instanceKey: "edu-my-course-recommend", layoutZone: "content", propsSummary: ["recommendationCount"] },
      { componentId: "EduMyCourseTimeline", instanceKey: "edu-my-course-timeline", layoutZone: "content", propsSummary: ["timelineCount"] }
    ]
  },
  "edu-progress": {
    pageId: "edu-progress",
    routePath: "/edu/progress",
    menuCode: "H0070105",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduProgressHero", instanceKey: "edu-progress-hero", layoutZone: "header", propsSummary: ["heroTitle", "heroBody", "summaryCards"] },
      { componentId: "EduProgressFilters", instanceKey: "edu-progress-filters", layoutZone: "actions", propsSummary: ["query", "status", "track"] },
      { componentId: "EduProgressJourney", instanceKey: "edu-progress-journey", layoutZone: "content", propsSummary: ["journeyCount", "focusTrack"] },
      { componentId: "EduProgressBoard", instanceKey: "edu-progress-board", layoutZone: "content", propsSummary: ["courseCount", "completionRate"] },
      { componentId: "EduProgressCompetency", instanceKey: "edu-progress-competency", layoutZone: "content", propsSummary: ["competencyCount", "skillBadgeCount"] },
      { componentId: "EduProgressActivity", instanceKey: "edu-progress-activity", layoutZone: "content", propsSummary: ["activityCount", "latestEvent"] },
      { componentId: "EduProgressGuidance", instanceKey: "edu-progress-guidance", layoutZone: "actions", propsSummary: ["nextActionCount", "managerName"] }
    ]
  },
  "edu-content": {
    pageId: "edu-content",
    routePath: "/edu/content",
    menuCode: "HMENU_EDU_CONTENT",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduContentHero", instanceKey: "edu-content-hero", layoutZone: "header", propsSummary: ["heroTitle", "renewalCount", "query"] },
      { componentId: "EduContentRenewalCards", instanceKey: "edu-content-renewal", layoutZone: "content", propsSummary: ["renewalCount", "urgentCount"] },
      { componentId: "EduContentLinkedCourses", instanceKey: "edu-content-linked-courses", layoutZone: "content", propsSummary: ["courseCount", "completionRate"] },
      { componentId: "EduContentLedger", instanceKey: "edu-content-ledger", layoutZone: "content", propsSummary: ["certificationCount", "renewalRiskCount"] },
      { componentId: "EduContentRoadmap", instanceKey: "edu-content-roadmap", layoutZone: "actions", propsSummary: ["roadmapCount", "nextMilestone"] },
      { componentId: "EduContentCompliance", instanceKey: "edu-content-compliance", layoutZone: "actions", propsSummary: ["complianceRate", "recommendation"] }
    ]
  },
  "emission-project-list": {
    pageId: "emission-project-list",
    routePath: "/emission/project_list",
    menuCode: "H0010101",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionProjectHero", instanceKey: "emission-project-hero", layoutZone: "header", propsSummary: ["queueItems", "searchKeyword"] },
      { componentId: "EmissionProjectQueue", instanceKey: "emission-project-queue", layoutZone: "content", propsSummary: ["queueItems", "level", "due"] },
      { componentId: "EmissionProjectSiteCards", instanceKey: "emission-project-site-cards", layoutZone: "content", propsSummary: ["siteCards", "status", "value"] },
      { componentId: "EmissionProjectAdminLinkage", instanceKey: "emission-project-admin-linkage", layoutZone: "actions", propsSummary: ["adminSiteManagementHref", "session", "homeMenu"] }
    ]
  },
  "emission-reduction": {
    pageId: "emission-reduction",
    routePath: "/emission/reduction",
    menuCode: "H0010106",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionReductionHero", instanceKey: "emission-reduction-hero", layoutZone: "header", propsSummary: ["insights", "fuelSwitch", "efficiency", "renewable"] },
      { componentId: "EmissionReductionInsights", instanceKey: "emission-reduction-insights", layoutZone: "content", propsSummary: ["optimalPath", "riskScenario"] },
      { componentId: "EmissionReductionPlanner", instanceKey: "emission-reduction-planner", layoutZone: "content", propsSummary: ["trajectoryBars", "expectedImpact", "scenarioVariables"] },
      { componentId: "EmissionReductionSites", instanceKey: "emission-reduction-sites", layoutZone: "content", propsSummary: ["siteCards", "scenarioEfficiency", "targetGap"] },
      { componentId: "EmissionReductionReport", instanceKey: "emission-reduction-report", layoutZone: "content", propsSummary: ["verificationRate", "reportBars"] },
      { componentId: "EmissionReductionFooter", instanceKey: "emission-reduction-footer", layoutZone: "footer", propsSummary: ["myPageUrl", "guideUrl"] }
    ]
  },
  "emission-lci": {
    pageId: "emission-lci",
    routePath: "/emission/lci",
    menuCode: "H0010202",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionLciHero", instanceKey: "emission-lci-hero", layoutZone: "header", propsSummary: ["materialKeyword", "processFilter", "regionFilter", "impactFilter"] },
      { componentId: "EmissionLciResults", instanceKey: "emission-lci-results", layoutZone: "content", propsSummary: ["filteredRecords", "selectedCodes", "pageIndex"] },
      { componentId: "EmissionLciSites", instanceKey: "emission-lci-sites", layoutZone: "content", propsSummary: ["siteCards", "progress"] },
      { componentId: "EmissionLciQuality", instanceKey: "emission-lci-quality", layoutZone: "content", propsSummary: ["datasetShare", "integrityScore", "analysisCount"] }
    ]
  },
  "emission-data-input": {
    pageId: "emission-data-input",
    routePath: "/emission/data_input",
    menuCode: "H0010102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionDataInputHero", instanceKey: "emission-data-input-hero", layoutZone: "header", propsSummary: ["queueCards", "goalProgress"] },
      { componentId: "EmissionDataInputQueue", instanceKey: "emission-data-input-queue", layoutZone: "content", propsSummary: ["queueCards", "variant", "badge"] },
      { componentId: "EmissionDataInputSearch", instanceKey: "emission-data-input-search", layoutZone: "actions", propsSummary: ["searchKeyword"] },
      { componentId: "EmissionDataInputSites", instanceKey: "emission-data-input-sites", layoutZone: "content", propsSummary: ["dedicatedSites", "generalSites"] },
      { componentId: "EmissionDataInputReport", instanceKey: "emission-data-input-report", layoutZone: "content", propsSummary: ["annualEmission", "verificationRate"] }
    ]
  },
  "emission-report-submit": {
    pageId: "emission-report-submit",
    routePath: "/emission/report_submit",
    menuCode: "H0010104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionReportSubmitHero", instanceKey: "emission-report-submit-hero", layoutZone: "header", propsSummary: ["pageTitle", "draftSavedAt"] },
      { componentId: "EmissionReportSubmitSteps", instanceKey: "emission-report-submit-steps", layoutZone: "content", propsSummary: ["stepItems", "currentStep"] },
      { componentId: "EmissionReportSubmitScope1", instanceKey: "emission-report-submit-scope1", layoutZone: "content", propsSummary: ["facilityOptions", "periodStart", "periodEnd", "fuelUsage"] },
      { componentId: "EmissionReportSubmitScope2", instanceKey: "emission-report-submit-scope2", layoutZone: "content", propsSummary: ["electricityUsage", "fileTypes", "fileLimitMb"] },
      { componentId: "EmissionReportSubmitGuide", instanceKey: "emission-report-submit-guide", layoutZone: "actions", propsSummary: ["guideTitle", "cautionMessage", "factorLookupUrl"] },
      { componentId: "EmissionReportSubmitActions", instanceKey: "emission-report-submit-actions", layoutZone: "actions", propsSummary: ["prevStepUrl", "saveDraftAction", "nextStepUrl"] }
    ]
  },
  "emission-lca": {
    pageId: "emission-lca",
    routePath: "/emission/lca",
    menuCode: "H0010201",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionLcaQueue", instanceKey: "emission-lca-queue", layoutZone: "header", propsSummary: ["queueAlerts", "regulatoryNotice"] },
      { componentId: "EmissionLcaComplianceStatus", instanceKey: "emission-lca-status", layoutZone: "content", propsSummary: ["complianceRows", "appliedStandards", "emissionIntensity"] },
      { componentId: "EmissionLcaMilestones", instanceKey: "emission-lca-milestones", layoutZone: "actions", propsSummary: ["milestones", "progress"] },
      { componentId: "EmissionLcaWatch", instanceKey: "emission-lca-watch", layoutZone: "actions", propsSummary: ["watchHeadline", "watchButton"] },
      { componentId: "EmissionLcaSiteHub", instanceKey: "emission-lca-site-hub", layoutZone: "content", propsSummary: ["siteCards", "gwpTotal", "dataQuality"] }
    ]
  },
  "emission-simulate": {
    pageId: "emission-simulate",
    routePath: "/emission/simulate",
    menuCode: "H0010204",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionSimulateHero", instanceKey: "emission-simulate-hero", layoutZone: "header", propsSummary: ["engineStatus", "recommendationCount"] },
      { componentId: "EmissionSimulateRecommendations", instanceKey: "emission-simulate-recommendations", layoutZone: "content", propsSummary: ["recommendations", "category", "title"] },
      { componentId: "EmissionSimulateChart", instanceKey: "emission-simulate-chart", layoutZone: "content", propsSummary: ["scenarioId", "forecastCurve", "capLine"] },
      { componentId: "EmissionSimulateBuilder", instanceKey: "emission-simulate-builder", layoutZone: "actions", propsSummary: ["techInvestment", "efficiencyGain", "renewableRate", "ccusScale"] }
    ]
  },
  "emission-home-validate": {
    pageId: "emission-home-validate",
    routePath: "/emission/validate",
    menuCode: "H0010103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionHomeValidateHero", instanceKey: "emission-home-validate-hero", layoutZone: "header", propsSummary: ["activeModuleCount", "selectedSite"] },
      { componentId: "EmissionHomeValidateModules", instanceKey: "emission-home-validate-modules", layoutZone: "content", propsSummary: ["modules", "searchKeyword"] },
      { componentId: "EmissionHomeValidateFineTuning", instanceKey: "emission-home-validate-fine-tuning", layoutZone: "content", propsSummary: ["calorificValue", "emissionFactor", "uncertainty"] },
      { componentId: "EmissionHomeValidateActions", instanceKey: "emission-home-validate-actions", layoutZone: "content", propsSummary: ["recalculationAction", "verificationAction"] }
    ]
  },
  "certificate-list": {
    pageId: "certificate-list",
    routePath: "/certificate/list",
    menuCode: "H0020202",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateListSummary", instanceKey: "certificate-list-summary", layoutZone: "header", propsSummary: ["expiringCount", "renewalCount", "validCount", "verificationPendingCount"] },
      { componentId: "CertificateListFilters", instanceKey: "certificate-list-filters", layoutZone: "actions", propsSummary: ["keyword", "statusFilter"] },
      { componentId: "CertificateListToolbar", instanceKey: "certificate-list-toolbar", layoutZone: "actions", propsSummary: ["filteredCount", "workspaceHref"] },
      { componentId: "CertificateListGrid", instanceKey: "certificate-list-grid", layoutZone: "content", propsSummary: ["certificateCards", "filteredCards"] }
    ]
  },
  "certificate-apply": {
    pageId: "certificate-apply",
    routePath: "/certificate/apply",
    menuCode: "H0020201",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateApplyHero", instanceKey: "certificate-apply-hero", layoutZone: "header", propsSummary: ["breadcrumbCurrent", "heroHeading", "heroBadge"] },
      { componentId: "CertificateApplySteps", instanceKey: "certificate-apply-steps", layoutZone: "actions", propsSummary: ["steps", "stepCounter"] },
      { componentId: "CertificateApplyForm", instanceKey: "certificate-apply-form", layoutZone: "content", propsSummary: ["selectedSiteId", "managerName", "managerContact", "periodStart", "periodEnd"] },
      { componentId: "CertificateApplySites", instanceKey: "certificate-apply-sites", layoutZone: "content", propsSummary: ["sites", "selectedSiteId"] },
      { componentId: "CertificateApplyTip", instanceKey: "certificate-apply-tip", layoutZone: "content", propsSummary: ["selectedSiteName", "tipTitle"] },
      { componentId: "CertificateApplyActions", instanceKey: "certificate-apply-actions", layoutZone: "actions", propsSummary: ["previousStepAction", "nextStepAction"] },
      { componentId: "CertificateApplyAssistant", instanceKey: "certificate-apply-assistant", layoutZone: "actions", propsSummary: ["assistantTitle", "assistantBody"] }
    ]
  },
  "certificate-report-list": {
    pageId: "certificate-report-list",
    routePath: "/certificate/report_list",
    menuCode: "H0020101",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateReportHero", instanceKey: "certificate-report-list-hero", layoutZone: "header", propsSummary: ["draftingCount", "reviewCount", "issuedCount", "urgentCount"] },
      { componentId: "CertificateReportSummary", instanceKey: "certificate-report-list-summary", layoutZone: "actions", propsSummary: ["draftingCount", "reviewCount", "issuedCount", "urgentCount"] },
      { componentId: "CertificateReportWorkflow", instanceKey: "certificate-report-list-workflow", layoutZone: "content", propsSummary: ["workflowCards", "stages"] },
      { componentId: "CertificateReportFilters", instanceKey: "certificate-report-list-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "stageFilter", "priorityFilter"] },
      { componentId: "CertificateReportTable", instanceKey: "certificate-report-list-table", layoutZone: "content", propsSummary: ["documentRows", "filteredRows"] }
    ]
  },
  "certificate-report-form": {
    pageId: "certificate-report-form",
    routePath: "/certificate/report_form",
    menuCode: "H0020102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateReportFormHero", instanceKey: "certificate-report-form-hero", layoutZone: "header", propsSummary: ["draftSaved", "completedPercent", "estimatedEmission"] },
      { componentId: "CertificateReportFormSteps", instanceKey: "certificate-report-form-steps", layoutZone: "actions", propsSummary: ["steps", "completedPercent"] },
      { componentId: "CertificateReportFormBasic", instanceKey: "certificate-report-form-basic", layoutZone: "content", propsSummary: ["reportType", "title", "company", "site", "assignee"] },
      { componentId: "CertificateReportFormScope1", instanceKey: "certificate-report-form-scope1", layoutZone: "content", propsSummary: ["facility", "periodStart", "periodEnd", "fuelUsage", "estimatedEmission"] },
      { componentId: "CertificateReportFormScope2", instanceKey: "certificate-report-form-scope2", layoutZone: "content", propsSummary: ["electricityUsage", "attachmentCount"] },
      { componentId: "CertificateReportFormGuide", instanceKey: "certificate-report-form-guide", layoutZone: "content", propsSummary: ["guideTitle", "cautionTitle", "supportTitle"] },
      { componentId: "CertificateReportFormActions", instanceKey: "certificate-report-form-actions", layoutZone: "actions", propsSummary: ["saveDraftAction", "nextStepAction"] }
    ]
  },
  "certificate-report-edit": {
    pageId: "certificate-report-edit",
    routePath: "/certificate/report_edit",
    menuCode: "H0020103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateReportEditHero", instanceKey: "certificate-report-edit-hero", layoutZone: "header", propsSummary: ["documentId", "status", "deadline", "completionPercent"] },
      { componentId: "CertificateReportEditSteps", instanceKey: "certificate-report-edit-steps", layoutZone: "actions", propsSummary: ["steps", "completionPercent"] },
      { componentId: "CertificateReportEditTimeline", instanceKey: "certificate-report-edit-timeline", layoutZone: "content", propsSummary: ["timelineItems"] },
      { componentId: "CertificateReportEditIssues", instanceKey: "certificate-report-edit-issues", layoutZone: "content", propsSummary: ["issueItems"] },
      { componentId: "CertificateReportEditContext", instanceKey: "certificate-report-edit-context", layoutZone: "content", propsSummary: ["documentId", "company", "site", "revisionReason"] },
      { componentId: "CertificateReportEditCorrections", instanceKey: "certificate-report-edit-corrections", layoutZone: "content", propsSummary: ["fuelUsage", "electricityUsage", "estimatedEmission"] },
      { componentId: "CertificateReportEditRevalidation", instanceKey: "certificate-report-edit-revalidation", layoutZone: "content", propsSummary: ["attachmentCount", "checklistCompleted"] },
      { componentId: "CertificateReportEditActions", instanceKey: "certificate-report-edit-actions", layoutZone: "actions", propsSummary: ["saveAction", "validateAction", "submitAction"] }
    ]
  },
  "co2-production-list": {
    pageId: "co2-production-list",
    routePath: "/co2/production_list",
    menuCode: "H0030101",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2ProductionHero", instanceKey: "co2-production-hero", layoutZone: "header", propsSummary: ["assistantSuggestions", "managerName"] },
      { componentId: "Co2ProductionSummaryCards", instanceKey: "co2-production-summary-cards", layoutZone: "content", propsSummary: ["totalProduction", "energyConsumption", "carbonEmission", "carbonIntensity"] },
      { componentId: "Co2ProductionTrendCharts", instanceKey: "co2-production-trend-charts", layoutZone: "content", propsSummary: ["productionTrend", "energyTrend", "intensityTrend"] },
      { componentId: "Co2ProductionFacilityCards", instanceKey: "co2-production-facilities", layoutZone: "content", propsSummary: ["facilityCount", "aiRecommendations"] },
      { componentId: "Co2ProductionEventTable", instanceKey: "co2-production-events", layoutZone: "content", propsSummary: ["eventRows"] }
    ]
  },
  "monitoring-dashboard": {
    pageId: "monitoring-dashboard",
    routePath: "/monitoring/dashboard",
    menuCode: "H0050101",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringDashboardHero", instanceKey: "monitoring-dashboard-hero", layoutZone: "header", propsSummary: ["pageTitle", "heroStatus", "navItems"] },
      { componentId: "MonitoringDashboardSummary", instanceKey: "monitoring-dashboard-summary", layoutZone: "actions", propsSummary: ["insights", "assistantCount"] },
      { componentId: "MonitoringDashboardWorkflow", instanceKey: "monitoring-dashboard-workflow", layoutZone: "content", propsSummary: ["sites", "legendActual", "legendForecast"] },
      { componentId: "MonitoringDashboardQueue", instanceKey: "monitoring-dashboard-queue", layoutZone: "content", propsSummary: ["regionFilter", "visibleRegionCount"] },
      { componentId: "MonitoringDashboardBoard", instanceKey: "monitoring-dashboard-board", layoutZone: "content", propsSummary: ["yearlyProjection", "progressWidth"] },
      { componentId: "MonitoringDashboardStatus", instanceKey: "monitoring-dashboard-status", layoutZone: "content", propsSummary: ["comparisonBars", "reportUpdated"] },
      { componentId: "MonitoringDashboardGuidance", instanceKey: "monitoring-dashboard-guidance", layoutZone: "content", propsSummary: ["accuracyCard", "modelValue"] }
    ]
  },
  "monitoring-realtime": {
    pageId: "monitoring-realtime",
    routePath: "/monitoring/realtime",
    menuCode: "H0050102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringRealtimeHero", instanceKey: "monitoring-dashboard-hero", layoutZone: "header", propsSummary: ["pageTitle", "heroStatus", "navItems"] },
      { componentId: "MonitoringRealtimeSignals", instanceKey: "monitoring-dashboard-summary", layoutZone: "actions", propsSummary: ["queueItems", "assistantCount"] },
      { componentId: "MonitoringRealtimeWorkflow", instanceKey: "monitoring-dashboard-workflow", layoutZone: "content", propsSummary: ["workflowSteps", "activeStep"] },
      { componentId: "MonitoringRealtimeBoard", instanceKey: "monitoring-dashboard-queue", layoutZone: "content", propsSummary: ["guidanceCards", "linkedActions"] },
      { componentId: "MonitoringRealtimeTimeline", instanceKey: "monitoring-dashboard-board", layoutZone: "content", propsSummary: ["timelineItems", "nextMilestone"] },
      { componentId: "MonitoringRealtimeMetrics", instanceKey: "monitoring-dashboard-status", layoutZone: "content", propsSummary: ["heroPrimaryMetricValue", "heroSecondaryMetricValue"] },
      { componentId: "MonitoringRealtimeContext", instanceKey: "monitoring-dashboard-guidance", layoutZone: "content", propsSummary: ["supervisorName", "systemButton"] }
    ]
  },
  "monitoring-alerts": {
    pageId: "monitoring-alerts",
    routePath: "/monitoring/alerts",
    menuCode: "H0050104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringAlertsHero", instanceKey: "monitoring-alerts-hero", layoutZone: "header", propsSummary: ["heroTitle", "heroPrimaryMetricValue", "heroSecondaryMetricValue"] },
      { componentId: "MonitoringAlertsQueue", instanceKey: "monitoring-alerts-summary", layoutZone: "actions", propsSummary: ["alerts", "filterLabel", "visibleAlertCount"] },
      { componentId: "MonitoringAlertsStatusLegend", instanceKey: "monitoring-alerts-workflow", layoutZone: "content", propsSummary: ["statusLegend", "statusLabels"] },
      { componentId: "MonitoringAlertsMatrix", instanceKey: "monitoring-alerts-matrix", layoutZone: "content", propsSummary: ["responseSteps", "guidanceItems"] },
      { componentId: "MonitoringAlertsRunbook", instanceKey: "monitoring-alerts-runbook", layoutZone: "content", propsSummary: ["guidanceItems", "responseTitle"] },
      { componentId: "MonitoringAlertsCoverage", instanceKey: "monitoring-alerts-coverage", layoutZone: "content", propsSummary: ["coverageCards"] },
      { componentId: "MonitoringAlertsLinks", instanceKey: "monitoring-alerts-links", layoutZone: "content", propsSummary: ["quickLinks"] },
      { componentId: "MonitoringAlertsGuidance", instanceKey: "monitoring-alerts-guidance", layoutZone: "content", propsSummary: ["guidanceTitle", "guidanceItems"] }
    ]
  },
  "payment-history": {
    pageId: "payment-history",
    routePath: "/payment/history",
    menuCode: "HMENU_PAYMENT_HISTORY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentHistoryHero", instanceKey: "payment-history-hero", layoutZone: "header", propsSummary: ["pageTitle", "periodLabel", "summaryCards"] },
      { componentId: "PaymentHistoryFilters", instanceKey: "payment-history-filters", layoutZone: "actions", propsSummary: ["query", "category", "status", "selectedCount"] },
      { componentId: "PaymentHistoryTable", instanceKey: "payment-history-table", layoutZone: "content", propsSummary: ["rowCount", "selectedCount", "statusLabels"] },
      { componentId: "PaymentHistoryGuidance", instanceKey: "payment-history-guidance", layoutZone: "content", propsSummary: ["guidanceItems", "connectedFlowActions"] }
    ]
  },
  "edu-course-detail": {
    pageId: "edu-course-detail",
    routePath: "/edu/course_detail",
    menuCode: "H0070102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduCourseDetailPrimaryNav", instanceKey: "edu-course-detail-primary-nav", layoutZone: "header", propsSummary: ["activeMenu", "managerName"] },
      { componentId: "EduCourseDetailSummaryBar", instanceKey: "edu-course-detail-summary-bar", layoutZone: "header", propsSummary: ["courseTitle", "rating", "price"] },
      { componentId: "EduCourseDetailSectionNav", instanceKey: "edu-course-detail-section-nav", layoutZone: "actions", propsSummary: ["anchorCount"] },
      { componentId: "EduCourseDetailHero", instanceKey: "edu-course-detail-hero", layoutZone: "content", propsSummary: ["heroBadge", "heroTitle"] },
      { componentId: "EduCourseDetailMethodology", instanceKey: "edu-course-detail-methodology", layoutZone: "content", propsSummary: ["methodologyCount"] },
      { componentId: "EduCourseDetailCurriculum", instanceKey: "edu-course-detail-curriculum", layoutZone: "content", propsSummary: ["moduleCount", "expandedModule"] },
      { componentId: "EduCourseDetailAudience", instanceKey: "edu-course-detail-prerequisites", layoutZone: "content", propsSummary: ["audienceCount", "prerequisiteCount"] },
      { componentId: "EduCourseDetailInstructors", instanceKey: "edu-course-detail-instructors", layoutZone: "content", propsSummary: ["instructorCount"] },
      { componentId: "EduCourseDetailTestimonials", instanceKey: "edu-course-detail-testimonials", layoutZone: "content", propsSummary: ["reviewCount"] },
      { componentId: "EduCourseDetailPurchaseCard", instanceKey: "edu-course-detail-purchase", layoutZone: "actions", propsSummary: ["price", "discount", "benefitCount"] },
      { componentId: "EduCourseDetailGroupBenefit", instanceKey: "edu-course-detail-group-benefit", layoutZone: "actions", propsSummary: ["groupDiscount"] }
    ]
  },
  "edu-apply": {
    pageId: "edu-apply",
    routePath: "/edu/apply",
    menuCode: "HMENU_EDU_APPLY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduApplyHero", instanceKey: "edu-apply-hero", layoutZone: "header", propsSummary: ["heroHeading", "heroBadge", "summaryCards"] },
      { componentId: "EduApplySteps", instanceKey: "edu-apply-steps", layoutZone: "actions", propsSummary: ["steps", "stepCounter"] },
      { componentId: "EduApplyCourseSelection", instanceKey: "edu-apply-courses", layoutZone: "content", propsSummary: ["selectedCourseId", "courseCount"] },
      { componentId: "EduApplyForm", instanceKey: "edu-apply-form", layoutZone: "content", propsSummary: ["applicantName", "organizationName", "contactNumber", "deliveryMode"] },
      { componentId: "EduApplySidebar", instanceKey: "edu-apply-sidebar", layoutZone: "content", propsSummary: ["selectedSessionId", "guidanceItems", "supportWindow"] },
      { componentId: "EduApplyActions", instanceKey: "edu-apply-actions", layoutZone: "actions", propsSummary: ["draftAction", "submitAction", "cancelAction"] }
    ]
  },
  "monitoring-statistics": {
    pageId: "monitoring-statistics",
    routePath: "/monitoring/statistics",
    menuCode: "H0050105",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringStatisticsHero", instanceKey: "monitoring-statistics-hero", layoutZone: "header", propsSummary: ["heroTitle", "overviewMetricCount", "overviewActionCount"] },
      { componentId: "MonitoringStatisticsFilters", instanceKey: "monitoring-statistics-filters", layoutZone: "actions", propsSummary: ["reportFilter", "kpiCount", "exportAction"] },
      { componentId: "MonitoringStatisticsAnalysis", instanceKey: "monitoring-statistics-analysis", layoutZone: "content", propsSummary: ["trendBarCount", "trendCaption", "detailAction"] },
      { componentId: "MonitoringStatisticsContributions", instanceKey: "monitoring-statistics-contributions", layoutZone: "content", propsSummary: ["complianceMetricCount", "certificationCount", "complianceAction"] },
      { componentId: "MonitoringStatisticsInsights", instanceKey: "monitoring-statistics-insights", layoutZone: "content", propsSummary: ["insightCount", "linkedReportActions"] }
    ]
  },
  "monitoring-share": {
    pageId: "monitoring-share",
    routePath: "/monitoring/share",
    menuCode: "H0050106",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringShareHero", instanceKey: "monitoring-share-hero", layoutZone: "header", propsSummary: ["heroTitle", "metricCount", "heroActionCount"] },
      { componentId: "MonitoringShareBriefing", instanceKey: "monitoring-share-briefing", layoutZone: "content", propsSummary: ["summaryMetricCount", "tableRowCount", "milestoneCount"] },
      { componentId: "MonitoringShareQueue", instanceKey: "monitoring-share-queue", layoutZone: "actions", propsSummary: ["audience", "queueCount", "assistantCount"] },
      { componentId: "MonitoringShareSites", instanceKey: "monitoring-share-sites", layoutZone: "content", propsSummary: ["siteCardCount", "pinnedSiteCount", "linkedActions"] }
    ]
  },
  "monitoring-track": {
    pageId: "monitoring-track",
    routePath: "/monitoring/track",
    menuCode: "H0030204",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringTrackHero", instanceKey: "monitoring-track-hero", layoutZone: "header", propsSummary: ["selectedNode", "integrityScore"] },
      { componentId: "MonitoringTrackGraph", instanceKey: "monitoring-track-graph", layoutZone: "content", propsSummary: ["nodeCount", "selectedNodeId"] },
      { componentId: "MonitoringTrackQueue", instanceKey: "monitoring-track-queue", layoutZone: "content", propsSummary: ["queueCount", "priorityItems"] },
      { componentId: "MonitoringTrackSites", instanceKey: "monitoring-track-sites", layoutZone: "content", propsSummary: ["siteCards"] }
    ]
  },
  "monitoring-reduction-trend": {
    pageId: "monitoring-reduction-trend",
    routePath: "/monitoring/reduction_trend",
    menuCode: "H0050103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringReductionTrendHero", instanceKey: "monitoring-reduction-trend-hero", layoutZone: "header", propsSummary: ["heroTitle", "heroLabel", "heroAlerts"] },
      { componentId: "MonitoringReductionTrendTimeline", instanceKey: "monitoring-reduction-trend-timeline", layoutZone: "content", propsSummary: ["range", "timelineTitle", "chartAlertTitle"] },
      { componentId: "MonitoringReductionTrendStats", instanceKey: "monitoring-reduction-trend-stats", layoutZone: "actions", propsSummary: ["statCount", "status", "resultCount"] },
      { componentId: "MonitoringReductionTrendFilters", instanceKey: "monitoring-reduction-trend-filters", layoutZone: "actions", propsSummary: ["keyword", "status", "siteCount"] },
      { componentId: "MonitoringReductionTrendSiteCards", instanceKey: "monitoring-reduction-trend-site-cards", layoutZone: "content", propsSummary: ["filteredSiteCount", "pinnedSiteCount"] }
    ]
  },
  "monitoring-export": {
    pageId: "monitoring-export",
    routePath: "/monitoring/export",
    menuCode: "H0050106",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MonitoringExportHero", instanceKey: "monitoring-export-hero", layoutZone: "header", propsSummary: ["heroTitle", "queueCount", "navItems"] },
      { componentId: "MonitoringExportControls", instanceKey: "monitoring-export-controls", layoutZone: "actions", propsSummary: ["reportType", "period", "format", "exportActions"] },
      { componentId: "MonitoringExportSummaryCards", instanceKey: "monitoring-export-summary-cards", layoutZone: "content", propsSummary: ["metricCount", "siteCount"] },
      { componentId: "MonitoringExportTrend", instanceKey: "monitoring-export-trend", layoutZone: "content", propsSummary: ["monthCount", "currentValue", "targetValue"] },
      { componentId: "MonitoringExportMix", instanceKey: "monitoring-export-mix", layoutZone: "content", propsSummary: ["processCount", "insightMessage"] },
      { componentId: "MonitoringExportSites", instanceKey: "monitoring-export-sites", layoutZone: "content", propsSummary: ["siteCardCount", "prioritySiteCount"] }
    ]
  },
  "co2-demand-list": {
    pageId: "co2-demand-list",
    routePath: "/co2/demand_list",
    menuCode: "H0030201",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2DemandAssistantHero", instanceKey: "co2-demand-assistant-hero", layoutZone: "header", propsSummary: ["assistantTitle", "queueCards"] },
      { componentId: "Co2DemandDataMatrix", instanceKey: "co2-demand-data-matrix", layoutZone: "content", propsSummary: ["tableHeaders", "tableRows", "fulfillmentStats"] },
      { componentId: "Co2DemandStatsCards", instanceKey: "co2-demand-stats-cards", layoutZone: "content", propsSummary: ["statsCard", "auditCard", "pendingCard"] }
    ]
  },
  "co2-search": {
    pageId: "co2-search",
    routePath: "/co2/search",
    menuCode: "H0030302",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2SearchFilterPanel", instanceKey: "co2-search-filter", layoutZone: "actions", propsSummary: ["platformType", "status", "searchKeyword"] },
      { componentId: "Co2SearchResultTable", instanceKey: "co2-search-results", layoutZone: "content", propsSummary: ["rows", "totalCount"] }
    ]
  },
  "trade-buy-request": {
    pageId: "trade-buy-request",
    routePath: "/trade/buy_request",
    menuCode: "H0040102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeBuyRequestHero", instanceKey: "trade-buy-request-hero", layoutZone: "header", propsSummary: ["currentLabel", "heroTitle", "heroBody"] },
      { componentId: "TradeBuyRequestSteps", instanceKey: "trade-buy-request-steps", layoutZone: "actions", propsSummary: ["steps", "stepCounter", "wizardTitle"] },
      { componentId: "TradeBuyRequestForm", instanceKey: "trade-buy-request-form", layoutZone: "content", propsSummary: ["category", "itemName", "quantity", "unit"] },
      { componentId: "TradeBuyRequestGuide", instanceKey: "trade-buy-request-guide", layoutZone: "content", propsSummary: ["guides", "guideHint"] },
      { componentId: "TradeBuyRequestActions", instanceKey: "trade-buy-request-actions", layoutZone: "actions", propsSummary: ["draftLabel", "nextLabel"] },
      { componentId: "TradeBuyRequestPending", instanceKey: "trade-buy-request-pending", layoutZone: "content", propsSummary: ["requestCards", "searchKeyword"] }
    ]
  },
  "trade-complete": {
    pageId: "trade-complete",
    routePath: "/trade/complete",
    menuCode: "H0040104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeCompleteHero", instanceKey: "trade-complete-hero", layoutZone: "header", propsSummary: ["pageTitle", "managerName", "syncLabel"] },
      { componentId: "TradeCompleteIntelligenceQueue", instanceKey: "trade-complete-alerts", layoutZone: "actions", propsSummary: ["insightCards"] },
      { componentId: "TradeCompleteFilters", instanceKey: "trade-complete-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "riskFilter"] },
      { componentId: "TradeCompleteStrategyCards", instanceKey: "trade-complete-strategies", layoutZone: "content", propsSummary: ["strategyCards", "visibleStrategyCount"] },
      { componentId: "TradeCompleteReport", instanceKey: "trade-complete-report", layoutZone: "content", propsSummary: ["reportCards"] }
    ]
  },
  "trade-auto-order": {
    pageId: "trade-auto-order",
    routePath: "/trade/auto_order",
    menuCode: "H0040105",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeAutoOrderHero", instanceKey: "trade-auto-order-hero", layoutZone: "header", propsSummary: ["pageTitle", "portfolioValue", "analystName"] },
      { componentId: "TradeAutoOrderOpportunities", instanceKey: "trade-auto-order-opportunities", layoutZone: "actions", propsSummary: ["opportunities"] },
      { componentId: "TradeAutoOrderMarketPanel", instanceKey: "trade-auto-order-market", layoutZone: "content", propsSummary: ["tickers", "allocations"] },
      { componentId: "TradeAutoOrderWorkspace", instanceKey: "trade-auto-order-workspace", layoutZone: "content", propsSummary: ["searchKeyword", "selectedOrderId", "visibleRows"] },
      { componentId: "TradeAutoOrderSettings", instanceKey: "trade-auto-order-settings", layoutZone: "content", propsSummary: ["selectedAsset", "mode", "spreadThreshold", "maxQuantity", "approvalPolicy"] },
      { componentId: "TradeAutoOrderActivity", instanceKey: "trade-auto-order-activity", layoutZone: "content", propsSummary: ["activityItems"] }
    ]
  },
  "payment-pay": {
    pageId: "payment-pay",
    routePath: "/payment/pay",
    menuCode: "H0060102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentPayHero", instanceKey: "payment-pay-hero", layoutZone: "header", propsSummary: ["heroTitle", "urgentCount", "navItemCount"] },
      { componentId: "PaymentPaySearch", instanceKey: "payment-pay-search", layoutZone: "actions", propsSummary: ["searchKeyword", "requestAccountAction"] },
      { componentId: "PaymentPayManagedAccounts", instanceKey: "payment-pay-managed-accounts", layoutZone: "content", propsSummary: ["accountCount", "copiedAccount", "delayedAccountCount"] },
      { componentId: "PaymentPaySites", instanceKey: "payment-pay-sites", layoutZone: "content", propsSummary: ["siteCardCount", "pendingSiteCount"] },
      { componentId: "PaymentPayReport", instanceKey: "payment-pay-report", layoutZone: "content", propsSummary: ["reportCardCount", "portfolioBalance", "complianceScore"] }
    ]
  },
  "payment-virtual-account": {
    pageId: "payment-virtual-account",
    routePath: "/payment/virtual_account",
    menuCode: "H0060105",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentVirtualAccountHero", instanceKey: "payment-virtual-account-hero", layoutZone: "header", propsSummary: ["heroType", "navItemCount", "alertOrTimelineCount"] },
      { componentId: "PaymentVirtualAccountSearch", instanceKey: "payment-virtual-account-search", layoutZone: "actions", propsSummary: ["searchKeyword", "issueButtonLabel"] },
      { componentId: "PaymentVirtualAccountManagedAccounts", instanceKey: "payment-virtual-account-managed", layoutZone: "content", propsSummary: ["accountCount", "copiedAccount", "query"] },
      { componentId: "PaymentVirtualAccountSites", instanceKey: "payment-virtual-account-sites", layoutZone: "content", propsSummary: ["siteCardCount", "addAccountShortcut"] },
      { componentId: "PaymentVirtualAccountReport", instanceKey: "payment-virtual-account-report", layoutZone: "content", propsSummary: ["metricCount", "portfolioBalance", "score"] }
    ]
  },
  "payment-refund": {
    pageId: "payment-refund",
    routePath: "/payment/refund",
    menuCode: "H0060103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentRefundPriorityQueue", instanceKey: "payment-refund-priority", layoutZone: "header", propsSummary: ["queueCardCount", "operatorRole", "highRiskCount"] },
      { componentId: "PaymentRefundFilters", instanceKey: "payment-refund-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "visibleRowCount"] },
      { componentId: "PaymentRefundRequestsTable", instanceKey: "payment-refund-table", layoutZone: "content", propsSummary: ["rowCount", "statusLabels", "pageSummary"] },
      { componentId: "PaymentRefundMonitoring", instanceKey: "payment-refund-monitoring", layoutZone: "content", propsSummary: ["monthlyTotal", "reasonDistribution", "slaComplianceRate"] }
    ]
  },
  "payment-refund-account": {
    pageId: "payment-refund-account",
    routePath: "/payment/refund_account",
    menuCode: "H0060104",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentRefundAccountHero", instanceKey: "payment-refund-account-hero", layoutZone: "header", propsSummary: ["heroTitle", "urgentCount", "operatorName"] },
      { componentId: "PaymentRefundAccountSearch", instanceKey: "payment-refund-account-search", layoutZone: "actions", propsSummary: ["searchKeyword", "requestAccountAction"] },
      { componentId: "PaymentRefundAccountManagedAccounts", instanceKey: "payment-refund-account-managed", layoutZone: "content", propsSummary: ["accountCount", "copiedAccount", "delayedAccountCount"] },
      { componentId: "PaymentRefundAccountSites", instanceKey: "payment-refund-account-sites", layoutZone: "content", propsSummary: ["siteCardCount", "pendingSiteCount"] },
      { componentId: "PaymentRefundAccountReport", instanceKey: "payment-refund-account-report", layoutZone: "content", propsSummary: ["reportCardCount", "portfolioBalance", "complianceScore"] }
    ]
  },
  "payment-notify": {
    pageId: "payment-notify",
    routePath: "/payment/notify",
    menuCode: "HMENU_PAYMENT_NOTIFY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentNotifyHero", instanceKey: "payment-notify-hero", layoutZone: "header", propsSummary: ["pageTitle", "summaryCardCount", "linkedProject"] },
      { componentId: "PaymentNotifySearch", instanceKey: "payment-notify-search", layoutZone: "actions", propsSummary: ["query", "visibleItemCount", "historyAction"] },
      { componentId: "PaymentNotifyAuditTools", instanceKey: "payment-notify-tools", layoutZone: "content", propsSummary: ["toolCount", "trailCount", "selectedMode"] },
      { componentId: "PaymentNotifyDocument", instanceKey: "payment-notify-document", layoutZone: "content", propsSummary: ["invoiceLineCount", "approvalNumber", "amountMode"] },
      { componentId: "PaymentNotifyRelatedPanel", instanceKey: "payment-notify-related", layoutZone: "content", propsSummary: ["recordCount", "allocationAmount", "commentDraft"] }
    ]
  },
  "trade-sell": {
    pageId: "trade-sell",
    routePath: "/trade/sell",
    menuCode: "H0040103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeSellHero", instanceKey: "trade-sell-hero", layoutZone: "header", propsSummary: ["pageTitle", "summaryLabel", "operatorName"] },
      { componentId: "TradeSellPriorityAlerts", instanceKey: "trade-sell-alerts", layoutZone: "actions", propsSummary: ["alertCards"] },
      { componentId: "TradeSellOrderTable", instanceKey: "trade-sell-table", layoutZone: "content", propsSummary: ["searchKeyword", "selectedOrderId", "visibleRows"] },
      { componentId: "TradeSellQuickEntry", instanceKey: "trade-sell-quick-entry", layoutZone: "content", propsSummary: ["customer", "itemCode", "quantity", "shipDate"] },
      { componentId: "TradeSellActivityLog", instanceKey: "trade-sell-activity-log", layoutZone: "content", propsSummary: ["activityItems"] }
    ]
  },
  "trade-price-alert": {
    pageId: "trade-price-alert",
    routePath: "/trade/price_alert",
    menuCode: "H0040202",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradePriceAlertHero", instanceKey: "trade-price-alert-hero", layoutZone: "header", propsSummary: ["pageTitle", "heroBody", "navItems"] },
      { componentId: "TradePriceAlertSummary", instanceKey: "trade-price-alert-summary", layoutZone: "actions", propsSummary: ["summaryCards"] },
      { componentId: "TradePriceAlertFeed", instanceKey: "trade-price-alert-alerts", layoutZone: "content", propsSummary: ["filter", "alerts", "alertCount"] },
      { componentId: "TradePriceAlertWatchlist", instanceKey: "trade-price-alert-watch", layoutZone: "content", propsSummary: ["watchItems"] },
      { componentId: "TradePriceAlertConfig", instanceKey: "trade-price-alert-config", layoutZone: "content", propsSummary: ["asset", "threshold", "channel"] },
      { componentId: "TradePriceAlertInsight", instanceKey: "trade-price-alert-insight", layoutZone: "content", propsSummary: ["assistantBody", "insights"] }
    ]
  },
  "observability": {
    pageId: "observability",
    routePath: "/admin/system/observability",
    menuCode: "A0060303",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ObservabilitySearchPanel", instanceKey: "observability-search-panel", layoutZone: "actions", propsSummary: ["traceId", "pageId", "actorId", "apiId"] },
      { componentId: "AuditEventTable", instanceKey: "audit-event-table", layoutZone: "content", propsSummary: ["items", "totalCount"] },
      { componentId: "TraceEventTable", instanceKey: "trace-event-table", layoutZone: "content", propsSummary: ["items", "totalCount"], conditionalRuleSummary: "Shown when trace tab is active" }
    ]
  },
  "help-management": {
    pageId: "help-management",
    routePath: "/admin/system/help-management",
    menuCode: "A1900101",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "HelpPageSelector", instanceKey: "help-management-select", layoutZone: "actions", propsSummary: ["pageId", "source", "menuCode"] },
      { componentId: "HelpMetadataForm", instanceKey: "help-management-page-form", layoutZone: "content", propsSummary: ["title", "summary", "helpVersion", "activeYn"] },
      { componentId: "HelpItemsEditor", instanceKey: "help-management-items", layoutZone: "content", propsSummary: ["items", "anchorSelector", "displayOrder"] }
    ]
  },
  "codex-request": {
    pageId: "codex-request",
    routePath: "/admin/system/codex-request",
    menuCode: "A1900103",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CodexRuntimeConfigPanel", instanceKey: "codex-request-runtime", layoutZone: "actions", propsSummary: ["runnerEnabled", "repoRoot", "workspaceRoot", "planCommandConfigured", "buildCommandConfigured"] },
      { componentId: "CodexResponsePanel", instanceKey: "codex-response-panel", layoutZone: "actions", propsSummary: ["httpStatus", "createdCount", "existingCount", "skippedCount"] },
      { componentId: "CodexQueueTable", instanceKey: "codex-history-table", layoutZone: "content", propsSummary: ["tickets", "selectedTicketId", "ticketCount"] },
      { componentId: "CodexTicketDetailPanel", instanceKey: "codex-request-ticket-detail", layoutZone: "content", propsSummary: ["ticketId", "executionStatus", "summary", "instruction"] },
      { componentId: "CodexPlanArtifactPanel", instanceKey: "codex-request-plan-result", layoutZone: "content", propsSummary: ["artifactType", "filePath", "content"] },
      { componentId: "CodexBuildArtifactPanel", instanceKey: "codex-request-build-result", layoutZone: "content", propsSummary: ["artifactType", "filePath", "content"] },
      { componentId: "CodexRequestSetup", instanceKey: "codex-request-setup", layoutZone: "content", propsSummary: ["payload", "proxyMode"] },
      { componentId: "CodexHistoryTable", instanceKey: "codex-request-history-review", layoutZone: "content", propsSummary: ["items", "totalCount"] }
    ]
  },
  "full-stack-management": {
    pageId: "full-stack-management",
    routePath: "/admin/system/full-stack-management",
    menuCode: "A0060108",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "FullStackMenuScope", instanceKey: "full-stack-management-scope", layoutZone: "actions", propsSummary: ["menuType"] },
      { componentId: "FullStackMenuTree", instanceKey: "full-stack-management-tree", layoutZone: "content", propsSummary: ["selectedMenuCode", "menuTree"] },
      { componentId: "FullStackGovernancePanel", instanceKey: "menu-management-governance-panel", layoutZone: "content", propsSummary: ["governancePageId", "surfaceCount", "apiCount"] }
    ]
  },
  "platform-studio": {
    pageId: "platform-studio",
    routePath: "/admin/system/platform-studio",
    menuCode: "A0060109",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus"] },
      { componentId: "PlatformStudioMenuList", instanceKey: "platform-studio-menus", layoutZone: "content", propsSummary: ["selectedMenuCode", "coverageScore"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["ownerScope", "resourceCounts"] },
      { componentId: "PlatformStudioAutomation", instanceKey: "platform-studio-automation", layoutZone: "content", propsSummary: ["summary", "instruction", "ticketCount"] }
    ]
  },
  "screen-elements-management": {
    pageId: "screen-elements-management",
    routePath: "/admin/system/screen-elements-management",
    menuCode: "A0060110",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=surfaces"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["componentIds", "frontendSources"] }
    ]
  },
  "event-management-console": {
    pageId: "event-management-console",
    routePath: "/admin/system/event-management-console",
    menuCode: "A0060111",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=events"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["eventIds"] }
    ]
  },
  "function-management-console": {
    pageId: "function-management-console",
    routePath: "/admin/system/function-management-console",
    menuCode: "A0060112",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=functions"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["functionIds", "parameterSpecs", "resultSpecs"] }
    ]
  },
  "api-management-console": {
    pageId: "api-management-console",
    routePath: "/admin/system/api-management-console",
    menuCode: "A0060113",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=apis"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["apiIds", "schemaIds"] }
    ]
  },
  "controller-management-console": {
    pageId: "controller-management-console",
    routePath: "/admin/system/controller-management-console",
    menuCode: "A0060114",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=controllers"] },
      { componentId: "PlatformStudioMetadataTable", instanceKey: "platform-studio-controllers", layoutZone: "content", propsSummary: ["controllerActions", "serviceMethods", "mapperQueries"] }
    ]
  },
  "db-table-management": {
    pageId: "db-table-management",
    routePath: "/admin/system/db-table-management",
    menuCode: "A0060115",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=db"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["tableNames"] }
    ]
  },
  "column-management-console": {
    pageId: "column-management-console",
    routePath: "/admin/system/column-management-console",
    menuCode: "A0060116",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=columns"] },
      { componentId: "PlatformStudioRegistry", instanceKey: "platform-studio-registry", layoutZone: "content", propsSummary: ["columnNames"] }
    ]
  },
  "automation-studio": {
    pageId: "automation-studio",
    routePath: "/admin/system/automation-studio",
    menuCode: "A0060117",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PlatformStudioTabs", instanceKey: "platform-studio-tabs", layoutZone: "actions", propsSummary: ["focus=automation"] },
      { componentId: "PlatformStudioAutomation", instanceKey: "platform-studio-automation", layoutZone: "content", propsSummary: ["summary", "instruction", "ticketCount"] }
    ]
  },
  "password-reset": {
    pageId: "password-reset",
    routePath: "/admin/member/reset_password",
    menuCode: "AMENU_PASSWORD_RESET",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PasswordResetSearch", instanceKey: "password-reset-search", layoutZone: "actions", propsSummary: ["memberId", "searchKeyword", "resetSource"] },
      { componentId: "PasswordResetHistory", instanceKey: "password-reset-history", layoutZone: "content", propsSummary: ["passwordResetHistoryList", "pageIndex"] }
    ]
  },
  "admin-permission": {
    pageId: "admin-permission",
    routePath: "/admin/member/admin_account/permissions",
    menuCode: "AMENU_ADMIN_PERMISSION",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminPermissionSummary", instanceKey: "admin-permission-summary", layoutZone: "actions", propsSummary: ["emplyrId", "statusLabel"] },
      { componentId: "AdminPermissionFeatures", instanceKey: "admin-permission-features", layoutZone: "content", propsSummary: ["authorCode", "featureCodes"] }
    ]
  },
  "admin-create": {
    pageId: "admin-create",
    routePath: "/admin/member/admin_account",
    menuCode: "AMENU_ADMIN_CREATE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminCreateRolePreset", instanceKey: "admin-create-role", layoutZone: "actions", propsSummary: ["rolePreset"] },
      { componentId: "AdminCreateAccountForm", instanceKey: "admin-create-account", layoutZone: "content", propsSummary: ["adminId", "adminName", "adminEmail"] },
      { componentId: "AdminCreatePermissions", instanceKey: "admin-create-permissions", layoutZone: "content", propsSummary: ["featureCodes", "insttId"] }
    ]
  },
  "member-stats": {
    pageId: "member-stats",
    routePath: "/admin/member/stats",
    menuCode: "AMENU_MEMBER_STATS",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberStatsSummary", instanceKey: "member-stats-summary", layoutZone: "actions", propsSummary: ["totalMembers", "memberTypeStats"] },
      { componentId: "MemberStatsTrend", instanceKey: "member-stats-trend", layoutZone: "content", propsSummary: ["monthlySignupStats"] },
      { componentId: "MemberStatsRegion", instanceKey: "member-stats-region", layoutZone: "content", propsSummary: ["regionalDistribution"] }
    ]
  },
  "member-register": {
    pageId: "member-register",
    routePath: "/admin/member/register",
    menuCode: "AMENU_MEMBER_REGISTER",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MemberRegisterBasic", instanceKey: "member-register-basic", layoutZone: "content", propsSummary: ["userName", "userId", "userType"] },
      { componentId: "MemberRegisterAffiliation", instanceKey: "member-register-affiliation", layoutZone: "content", propsSummary: ["orgName", "permissions"] },
      { componentId: "MemberRegisterActions", instanceKey: "member-register-actions", layoutZone: "actions", propsSummary: ["canUseMemberRegisterSave"] },
      { componentId: "MemberRegisterOrgSearch", instanceKey: "member-register-org-search-title", layoutZone: "actions", propsSummary: ["canUseMemberRegisterOrgSearch", "insttId"] }
    ]
  },
  "trade-list": {
    pageId: "trade-list",
    routePath: "/trade/list",
    menuCode: "AMENU_TRADE_LIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeListPendingQueue", instanceKey: "trade-list-pending-queue", layoutZone: "header", propsSummary: ["tradeRows", "pendingActionCount"] },
      { componentId: "TradeListSummary", instanceKey: "trade-list-summary", layoutZone: "actions", propsSummary: ["totalCount", "matchingCount", "settlementPendingCount", "completedCount"] },
      { componentId: "TradeListFilter", instanceKey: "trade-list-filter", layoutZone: "actions", propsSummary: ["searchKeyword", "tradeStatus", "settlementStatus"] },
      { componentId: "TradeListTable", instanceKey: "trade-list-table", layoutZone: "content", propsSummary: ["tradeRows", "pageIndex", "totalPages"] },
      { componentId: "TradeListAlerts", instanceKey: "trade-list-alerts", layoutZone: "content", propsSummary: ["settlementAlerts"] },
      { componentId: "TradeListStatusGuide", instanceKey: "trade-list-status-guide", layoutZone: "content", propsSummary: ["tradeStatus", "settlementStatus"] }
    ]
  },
  "trade-market": {
    pageId: "trade-market",
    routePath: "/trade/market",
    menuCode: "HMENU_TRADE_MARKET",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeMarketHero", instanceKey: "trade-market-hero", layoutZone: "header", propsSummary: ["heroTitle", "heroBody"] },
      { componentId: "TradeMarketTrending", instanceKey: "trade-market-trending", layoutZone: "content", propsSummary: ["assets"] },
      { componentId: "TradeMarketOverview", instanceKey: "trade-market-overview", layoutZone: "actions", propsSummary: ["cards"] },
      { componentId: "TradeMarketFilter", instanceKey: "trade-market-filter", layoutZone: "actions", propsSummary: ["keyword", "status", "category", "region"] },
      { componentId: "TradeMarketTable", instanceKey: "trade-market-table", layoutZone: "content", propsSummary: ["filteredAssets"] },
      { componentId: "TradeMarketWatchlist", instanceKey: "trade-market-watchlist", layoutZone: "content", propsSummary: ["watchItems"] },
      { componentId: "TradeMarketPulse", instanceKey: "trade-market-pulse", layoutZone: "content", propsSummary: ["pulseItems"] }
    ]
  },
  "trade-report": {
    pageId: "trade-report",
    routePath: "/trade/report",
    menuCode: "H0040204",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeReportHero", instanceKey: "trade-report-hero", layoutZone: "header", propsSummary: ["heroTitle", "heroBody"] },
      { componentId: "TradeReportTasks", instanceKey: "trade-report-tasks", layoutZone: "content", propsSummary: ["tasks"] },
      { componentId: "TradeReportSearch", instanceKey: "trade-report-search", layoutZone: "actions", propsSummary: ["keyword", "reportStatus", "deadline"] },
      { componentId: "TradeReportAccounts", instanceKey: "trade-report-accounts", layoutZone: "content", propsSummary: ["accounts"] },
      { componentId: "TradeReportTable", instanceKey: "trade-report-table", layoutZone: "content", propsSummary: ["reports"] },
      { componentId: "TradeReportWatch", instanceKey: "trade-report-watch", layoutZone: "content", propsSummary: ["watchSignals"] }
    ]
  },
  "trade-statistics": {
    pageId: "trade-statistics",
    routePath: "/admin/trade/statistics",
    menuCode: "A0030202",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeStatisticsSummary", instanceKey: "trade-statistics-summary", layoutZone: "actions", propsSummary: ["totalTradeVolume", "totalSettlementAmount", "pendingSettlementCount", "exceptionCount", "settlementCompletionRate"] },
      { componentId: "TradeStatisticsFilter", instanceKey: "trade-statistics-filter", layoutZone: "actions", propsSummary: ["periodFilter", "tradeType", "settlementStatus", "searchKeyword"] },
      { componentId: "TradeStatisticsTrend", instanceKey: "trade-statistics-trend", layoutZone: "content", propsSummary: ["monthlyRows", "periodFilter"] },
      { componentId: "TradeStatisticsAlerts", instanceKey: "trade-statistics-alerts", layoutZone: "content", propsSummary: ["alertRows"] },
      { componentId: "TradeStatisticsTypeTable", instanceKey: "trade-statistics-type-table", layoutZone: "content", propsSummary: ["tradeTypeRows"] },
      { componentId: "TradeStatisticsInstitutionTable", instanceKey: "trade-statistics-institution-table", layoutZone: "content", propsSummary: ["institutionRows", "pageIndex", "totalPages"] }
    ]
  },
  "refund-list": {
    pageId: "refund-list",
    routePath: "/admin/payment/refund_list",
    menuCode: "A0030301",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RefundListSummary", instanceKey: "refund-list-summary", layoutZone: "actions", propsSummary: ["totalCount", "pendingCount", "inReviewCount", "transferScheduledCount", "completedCount"] },
      { componentId: "RefundListFilter", instanceKey: "refund-list-filter", layoutZone: "content", propsSummary: ["searchKeyword", "status", "riskLevel"] },
      { componentId: "RefundListTable", instanceKey: "refund-list-table", layoutZone: "content", propsSummary: ["refundRows", "pageIndex", "totalPages"] }
    ]
  },
  "refund-process": {
    pageId: "refund-process",
    routePath: "/admin/payment/refund_process",
    menuCode: "A0030302",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RefundProcessSummary", instanceKey: "refund-process-summary", layoutZone: "actions", propsSummary: ["refundSummary"] },
      { componentId: "RefundProcessFilter", instanceKey: "refund-process-search", layoutZone: "actions", propsSummary: ["searchKeyword", "refundStatus", "refundChannel", "priority"] },
      { componentId: "RefundProcessTable", instanceKey: "refund-process-table", layoutZone: "content", propsSummary: ["refundRows", "pageIndex", "totalPages"] },
      { componentId: "RefundProcessGuidance", instanceKey: "refund-process-guidance", layoutZone: "content", propsSummary: ["refundGuidance"] }
    ]
  },
  "settlement-calendar": {
    pageId: "settlement-calendar",
    routePath: "/admin/payment/settlement",
    menuCode: "A0030203",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SettlementCalendarSummary", instanceKey: "settlement-calendar-summary", layoutZone: "actions", propsSummary: ["totalScheduledCount", "dueTodayCount", "highRiskCount", "completedCount"] },
      { componentId: "SettlementCalendarFilter", instanceKey: "settlement-calendar-filter", layoutZone: "content", propsSummary: ["selectedMonth", "searchKeyword", "settlementStatus", "riskLevel"] },
      { componentId: "SettlementCalendarBoard", instanceKey: "settlement-calendar-board", layoutZone: "content", propsSummary: ["calendarDays", "selectedMonth"] },
      { componentId: "SettlementCalendarTable", instanceKey: "settlement-calendar-table", layoutZone: "content", propsSummary: ["scheduleRows", "pageIndex", "totalPages"] }
    ]
  },
  "trade-duplicate": {
    pageId: "trade-duplicate",
    routePath: "/admin/trade/duplicate",
    menuCode: "A0030104",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeDuplicateSummary", instanceKey: "trade-duplicate-summary", layoutZone: "actions", propsSummary: ["totalCount", "criticalCount", "reviewCount", "settlementBlockedCount"] },
      { componentId: "TradeDuplicateAlerts", instanceKey: "trade-duplicate-alerts", layoutZone: "content", propsSummary: ["escalationAlerts"] },
      { componentId: "TradeDuplicateFilters", instanceKey: "trade-duplicate-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "detectionType", "reviewStatus", "riskLevel"] },
      { componentId: "TradeDuplicateTable", instanceKey: "trade-duplicate-table", layoutZone: "content", propsSummary: ["abnormalTradeRows", "pageIndex", "totalPages"] },
      { componentId: "TradeDuplicateDetail", instanceKey: "trade-duplicate-detail", layoutZone: "content", propsSummary: ["selectedReviewId", "recommendedAction", "settlementActionLabel"] },
      { componentId: "TradeDuplicateGuidance", instanceKey: "trade-duplicate-guidance", layoutZone: "content", propsSummary: ["operatorGuidance"] }
    ]
  },
  "trade-approve": {
    pageId: "trade-approve",
    routePath: "/admin/trade/approve",
    menuCode: "A0030102",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeApproveSummary", instanceKey: "trade-approve-summary", layoutZone: "actions", propsSummary: ["pendingCount", "approvedCount", "rejectedCount", "holdCount"] },
      { componentId: "TradeApproveFilter", instanceKey: "trade-approve-search", layoutZone: "content", propsSummary: ["searchKeyword", "approvalStatus", "tradeType"] },
      { componentId: "TradeApproveBatchActions", instanceKey: "trade-approve-batch-actions", layoutZone: "actions", propsSummary: ["selectedIds", "canUseTradeApproveAction"] },
      { componentId: "TradeApproveTable", instanceKey: "trade-approve-table", layoutZone: "content", propsSummary: ["approvalRows", "pageIndex", "totalPages"] }
    ]
  },
  "trade-reject": {
    pageId: "trade-reject",
    routePath: "/admin/trade/reject",
    menuCode: "AMENU_TRADE_REJECT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TradeRejectSummary", instanceKey: "trade-reject-summary", layoutZone: "actions", propsSummary: ["tradeId", "blockerCount", "evidenceCount", "historyCount"] },
      { componentId: "TradeRejectOverview", instanceKey: "trade-reject-overview", layoutZone: "content", propsSummary: ["contractName", "sellerName", "buyerName", "tradeStatusLabel"] },
      { componentId: "TradeRejectChecklist", instanceKey: "trade-reject-checklist", layoutZone: "content", propsSummary: ["rejectionChecklist"] },
      { componentId: "TradeRejectForm", instanceKey: "trade-reject-form", layoutZone: "content", propsSummary: ["suggestedReason"] },
      { componentId: "TradeRejectEvidence", instanceKey: "trade-reject-evidence", layoutZone: "content", propsSummary: ["evidenceRows"] },
      { componentId: "TradeRejectHistory", instanceKey: "trade-reject-history", layoutZone: "content", propsSummary: ["historyRows"] },
      { componentId: "TradeRejectNotification", instanceKey: "trade-reject-notification", layoutZone: "content", propsSummary: ["notificationPlan"] },
      { componentId: "TradeRejectActions", instanceKey: "trade-reject-actions", layoutZone: "actions", propsSummary: ["returnUrl"] }
    ]
  },
  "emission-result-list": {
    pageId: "emission-result-list",
    routePath: "/admin/emission/result_list",
    menuCode: "AMENU_EMISSION_RESULT_LIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionResultSummary", instanceKey: "emission-result-summary", layoutZone: "actions", propsSummary: ["totalCount", "reviewCount", "verifiedCount"] },
      { componentId: "EmissionResultSearch", instanceKey: "emission-result-search", layoutZone: "actions", propsSummary: ["searchKeyword", "resultStatus", "verificationStatus"] },
      { componentId: "EmissionResultTable", instanceKey: "emission-result-table", layoutZone: "content", propsSummary: ["emissionResultList", "pageIndex"] }
    ]
  },
  "emission-result-detail": {
    pageId: "emission-result-detail",
    routePath: "/admin/emission/result_detail",
    menuCode: "AMENU_EMISSION_RESULT_DETAIL",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionResultDetailSummary", instanceKey: "emission-result-detail-summary", layoutZone: "actions", propsSummary: ["resultId", "totalEmission", "siteCount", "evidenceCount"] },
      { componentId: "EmissionResultDetailOverview", instanceKey: "emission-result-detail-overview", layoutZone: "content", propsSummary: ["projectName", "companyName", "reportPeriod", "formulaVersion"] },
      { componentId: "EmissionResultDetailReview", instanceKey: "emission-result-detail-review", layoutZone: "content", propsSummary: ["reviewChecklist", "reviewMessage"] },
      { componentId: "EmissionResultDetailSites", instanceKey: "emission-result-detail-sites", layoutZone: "content", propsSummary: ["siteRows"] },
      { componentId: "EmissionResultDetailEvidence", instanceKey: "emission-result-detail-evidence", layoutZone: "content", propsSummary: ["evidenceRows"] },
      { componentId: "EmissionResultDetailHistory", instanceKey: "emission-result-detail-history", layoutZone: "content", propsSummary: ["historyRows"] },
      { componentId: "EmissionResultDetailActions", instanceKey: "emission-result-detail-actions", layoutZone: "actions", propsSummary: ["verificationActionUrl", "listUrl", "historyUrl"] }
    ]
  },
  "emission-validate": {
    pageId: "emission-validate",
    routePath: "/admin/emission/validate",
    menuCode: "A0020104",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionValidateContext", instanceKey: "emission-validate-context", layoutZone: "actions", propsSummary: ["resultId", "selectedResult"] },
      { componentId: "EmissionValidateSummary", instanceKey: "emission-validate-summary", layoutZone: "actions", propsSummary: ["totalCount", "pendingCount", "failedCount"] },
      { componentId: "EmissionValidateSearch", instanceKey: "emission-validate-search", layoutZone: "actions", propsSummary: ["searchKeyword", "verificationStatus", "priorityFilter"] },
      { componentId: "EmissionValidateLinks", instanceKey: "emission-validate-links", layoutZone: "content", propsSummary: ["actionLinks"] },
      { componentId: "EmissionValidateQueue", instanceKey: "emission-validate-table", layoutZone: "content", propsSummary: ["queueRows", "pageIndex"] },
      { componentId: "EmissionValidatePolicy", instanceKey: "emission-validate-policy", layoutZone: "content", propsSummary: ["priorityLegend", "policyRows"] }
    ]
  },
  "emission-data-history": {
    pageId: "emission-data-history",
    routePath: "/admin/emission/data_history",
    menuCode: "A0020106",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionDataHistorySummary", instanceKey: "emission-data-history-summary", layoutZone: "actions", propsSummary: ["totalCount", "correctionCount", "approvalCount"] },
      { componentId: "EmissionDataHistorySearch", instanceKey: "emission-data-history-search", layoutZone: "actions", propsSummary: ["searchKeyword", "changeType", "changeTarget"] },
      { componentId: "EmissionDataHistoryTable", instanceKey: "emission-data-history-table", layoutZone: "content", propsSummary: ["historyRows", "pageIndex"] }
    ]
  },
  "emission-site-management": {
    pageId: "emission-site-management",
    routePath: "/admin/emission/site-management",
    menuCode: "A0020105",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionSiteSummary", instanceKey: "emission-site-summary", layoutZone: "actions", propsSummary: ["summaryCards", "menuCode"] },
      { componentId: "EmissionSiteQuickLinks", instanceKey: "emission-site-quick-links", layoutZone: "content", propsSummary: ["quickLinks", "menuCode"] },
      { componentId: "EmissionSiteOperations", instanceKey: "emission-site-operation-cards", layoutZone: "content", propsSummary: ["operationCards", "statusLabel"] },
      { componentId: "EmissionSiteFeatureCatalog", instanceKey: "emission-site-feature-catalog", layoutZone: "content", propsSummary: ["featureRows", "featureCode", "manageUrl"] }
    ]
  },
  "emission-definition-studio": {
    pageId: "emission-definition-studio",
    routePath: "/admin/emission/definition-studio",
    menuCode: "A0020108",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionDefinitionSummary", instanceKey: "emission-definition-summary", layoutZone: "actions", propsSummary: ["summaryCards", "menuCode"] },
      { componentId: "EmissionDefinitionQuickLinks", instanceKey: "emission-definition-quick-links", layoutZone: "content", propsSummary: ["quickLinks", "menuCode"] },
      { componentId: "EmissionDefinitionDraftBuilder", instanceKey: "emission-definition-draft-builder", layoutZone: "content", propsSummary: ["seedCategories", "seedTiers", "policyOptions"] },
      { componentId: "EmissionDefinitionChecklist", instanceKey: "emission-definition-checklist", layoutZone: "content", propsSummary: ["saveChecklist", "governanceNotes"] }
    ]
  },
  "emission-gwp-values": {
    pageId: "emission-gwp-values",
    routePath: "/admin/emission/gwp-values",
    menuCode: "A0020109",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionGwpSummary", instanceKey: "emission-gwp-summary", layoutZone: "actions", propsSummary: ["summaryCards", "documentName"] },
      { componentId: "EmissionGwpSearch", instanceKey: "emission-gwp-search", layoutZone: "actions", propsSummary: ["searchKeyword", "sectionCode"] },
      { componentId: "EmissionGwpTable", instanceKey: "emission-gwp-table", layoutZone: "content", propsSummary: ["gwpRows", "selectedRowId"] },
      { componentId: "EmissionGwpDetail", instanceKey: "emission-gwp-detail", layoutZone: "content", propsSummary: ["selectedRow", "governanceNotes", "methaneGuidance"] }
    ]
  },
  "system-code": {
    pageId: "system-code",
    routePath: "/admin/system/code",
    menuCode: "AMENU_SYSTEM_CODE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SystemCodeClass", instanceKey: "system-code-class", layoutZone: "content", propsSummary: ["clCodeList"] },
      { componentId: "SystemCodeGroup", instanceKey: "system-code-group", layoutZone: "content", propsSummary: ["codeList"] },
      { componentId: "SystemCodeDetail", instanceKey: "system-code-detail", layoutZone: "content", propsSummary: ["detailCodeList", "detailCodeId"] }
    ]
  },
  "page-management": {
    pageId: "page-management",
    routePath: "/admin/system/page-management",
    menuCode: "AMENU_PAGE_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PageManagementRegister", instanceKey: "page-management-register", layoutZone: "actions", propsSummary: ["domainCode", "code", "menuUrl"] },
      { componentId: "PageManagementList", instanceKey: "page-management-list", layoutZone: "content", propsSummary: ["pageRows", "searchKeyword", "searchUrl"] }
    ]
  },
  "function-management": {
    pageId: "function-management",
    routePath: "/admin/system/feature-management",
    menuCode: "AMENU_FUNCTION_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "FunctionManagementRegister", instanceKey: "function-management-register", layoutZone: "actions", propsSummary: ["menuCode", "featureCode", "featureNm"] },
      { componentId: "FunctionManagementList", instanceKey: "function-management-list", layoutZone: "content", propsSummary: ["featureRows", "searchMenuCode", "searchKeyword"] }
    ]
  },
  "menu-management": {
    pageId: "menu-management",
    routePath: "/admin/system/menu",
    menuCode: "AMENU_MENU_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MenuManagementScope", instanceKey: "menu-management-scope", layoutZone: "actions", propsSummary: ["menuType"] },
      { componentId: "MenuManagementRegister", instanceKey: "menu-management-register", layoutZone: "content", propsSummary: ["parentCode", "menuUrl", "menuIcon"] },
      { componentId: "MenuManagementTree", instanceKey: "menu-management-tree", layoutZone: "content", propsSummary: ["treeData"] }
    ]
  },
  "ip-whitelist": {
    pageId: "ip-whitelist",
    routePath: "/admin/system/ip_whitelist",
    menuCode: "AMENU_IP_WHITELIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "IpWhitelistSummary", instanceKey: "ip-whitelist-summary", layoutZone: "actions", propsSummary: ["ipWhitelistSummary"] },
      { componentId: "IpWhitelistSearch", instanceKey: "ip-whitelist-search", layoutZone: "actions", propsSummary: ["searchIp", "accessScope", "status"] },
      { componentId: "IpWhitelistTable", instanceKey: "ip-whitelist-table", layoutZone: "content", propsSummary: ["ipWhitelistRows"] },
      { componentId: "IpWhitelistRequests", instanceKey: "ip-whitelist-requests", layoutZone: "content", propsSummary: ["ipWhitelistRequestRows"] }
    ]
  },
  "access-history": {
    pageId: "access-history",
    routePath: "/admin/system/access_history",
    menuCode: "A0060301",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AccessHistorySearch", instanceKey: "access-history-search", layoutZone: "actions", propsSummary: ["searchKeyword", "insttId"] },
      { componentId: "AccessHistoryTable", instanceKey: "access-history-table", layoutZone: "content", propsSummary: ["accessHistoryList", "pageIndex"] }
    ]
  },
  "error-log": {
    pageId: "error-log",
    routePath: "/admin/system/error-log",
    menuCode: "A0060302",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ErrorLogSearch", instanceKey: "error-log-search", layoutZone: "actions", propsSummary: ["searchKeyword", "insttId", "sourceType", "errorType"] },
      { componentId: "ErrorLogTable", instanceKey: "error-log-table", layoutZone: "content", propsSummary: ["errorLogList", "pageIndex"] }
    ]
  },
  "login-history": {
    pageId: "login-history",
    routePath: "/admin/member/login_history",
    menuCode: "AMENU_LOGIN_HISTORY",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "LoginHistorySearch", instanceKey: "login-history-search", layoutZone: "actions", propsSummary: ["searchKeyword", "userSe", "loginResult"] },
      { componentId: "LoginHistoryTable", instanceKey: "login-history-table", layoutZone: "content", propsSummary: ["loginHistoryList", "pageIndex"] }
    ]
  },
  "member-security-history": {
    pageId: "member-security-history",
    routePath: "/admin/member/security",
    menuCode: "A0010502",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SecurityHistorySearch", instanceKey: "login-history-search", layoutZone: "actions", propsSummary: ["searchKeyword", "userSe", "loginResult=FAIL"] },
      { componentId: "SecurityHistoryTable", instanceKey: "login-history-table", layoutZone: "content", propsSummary: ["loginHistoryList", "pageIndex"] }
    ]
  },
  "security-history": {
    pageId: "security-history",
    routePath: "/admin/system/security",
    menuCode: "A0060205",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SecurityHistoryGuidance", instanceKey: "member-security-guidance", layoutZone: "header", propsSummary: ["routeScope=system", "fixedLoginResult=FAIL", "sharedConsole"] },
      { componentId: "SecurityHistoryCloseoutGate", instanceKey: "security-history-closeout-gate", layoutZone: "content", propsSummary: ["sharedBlockedHistoryConsole", "queryFilters", "detailContext", "operatorActionRecording", "enforcementBlocked", "auditExportBlocked"] },
      { componentId: "SecurityHistoryActionContract", instanceKey: "security-history-action-contract", layoutZone: "actions", propsSummary: ["enforceAccountUnblock", "applyPolicyException", "createIncidentCase", "exportAuditEvidence"] },
      { componentId: "SecurityHistorySearch", instanceKey: "login-history-search", layoutZone: "actions", propsSummary: ["searchKeyword", "userSe", "insttId", "actionStatus", "loginResult=FAIL"] },
      { componentId: "SecurityHistoryTable", instanceKey: "login-history-table", layoutZone: "content", propsSummary: ["loginHistoryList", "pageIndex", "securityHistoryActionRows", "securityHistoryAggregate"] }
    ]
  },
  "security-policy": {
    pageId: "security-policy",
    routePath: "/admin/system/security-policy",
    menuCode: "AMENU_SECURITY_POLICY",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SecurityPolicySummary", instanceKey: "security-policy-summary", layoutZone: "actions", propsSummary: ["securityPolicySummary"] },
      { componentId: "SecurityPolicyTable", instanceKey: "security-policy-table", layoutZone: "content", propsSummary: ["securityPolicyRows"] },
      { componentId: "SecurityPolicyPlaybooks", instanceKey: "security-policy-playbooks", layoutZone: "content", propsSummary: ["securityPolicyPlaybooks"] }
    ]
  },
  "security-monitoring": {
    pageId: "security-monitoring",
    routePath: "/admin/system/security-monitoring",
    menuCode: "AMENU_SECURITY_MONITORING",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SecurityMonitoringSummary", instanceKey: "security-monitoring-summary", layoutZone: "actions", propsSummary: ["securityMonitoringCards"] },
      { componentId: "SecurityMonitoringTargets", instanceKey: "security-monitoring-targets", layoutZone: "content", propsSummary: ["securityMonitoringTargets", "securityMonitoringIps"] },
      { componentId: "SecurityMonitoringEvents", instanceKey: "security-monitoring-events", layoutZone: "content", propsSummary: ["securityMonitoringEvents"] }
    ]
  },
  "blocklist": {
    pageId: "blocklist",
    routePath: "/admin/system/blocklist",
    menuCode: "AMENU_BLOCKLIST",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BlocklistSearch", instanceKey: "blocklist-search", layoutZone: "actions", propsSummary: ["searchKeyword", "blockType", "status"] },
      { componentId: "BlocklistTable", instanceKey: "blocklist-table", layoutZone: "content", propsSummary: ["blocklistRows"] },
      { componentId: "BlocklistReleaseQueue", instanceKey: "blocklist-release-queue", layoutZone: "content", propsSummary: ["blocklistReleaseQueue"] }
    ]
  },
  "security-audit": {
    pageId: "security-audit",
    routePath: "/admin/system/security-audit",
    menuCode: "A0060206",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SecurityAuditSummary", instanceKey: "security-audit-summary", layoutZone: "actions", propsSummary: ["securityAuditSummary"] },
      { componentId: "SecurityAuditTable", instanceKey: "security-audit-table", layoutZone: "content", propsSummary: ["securityAuditRows"] }
    ]
  },
  "certificate-audit-log": {
    pageId: "certificate-audit-log",
    routePath: "/admin/certificate/audit-log",
    menuCode: "AMENU_CERTIFICATE_AUDIT_LOG",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateAuditFilters", instanceKey: "certificate-audit-log-filters", layoutZone: "actions", propsSummary: ["auditType", "status", "certificateType"] },
      { componentId: "CertificateAuditSummary", instanceKey: "certificate-audit-log-summary", layoutZone: "actions", propsSummary: ["certificateAuditSummary", "certificateAuditAlerts"] },
      { componentId: "CertificateAuditTable", instanceKey: "certificate-audit-log-table", layoutZone: "content", propsSummary: ["certificateAuditRows"] }
    ]
  },
  "scheduler-management": {
    pageId: "scheduler-management",
    routePath: "/admin/system/scheduler",
    menuCode: "AMENU_SCHEDULER_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SchedulerManagementSearch", instanceKey: "scheduler-management-search", layoutZone: "actions", propsSummary: ["jobStatus", "executionType"] },
      { componentId: "SchedulerManagementJobs", instanceKey: "scheduler-management-jobs", layoutZone: "content", propsSummary: ["schedulerJobRows", "schedulerNodeRows"] },
      { componentId: "SchedulerManagementExecutions", instanceKey: "scheduler-management-executions", layoutZone: "content", propsSummary: ["schedulerExecutionRows"] }
    ]
  },
  "batch-management": {
    pageId: "batch-management",
    routePath: "/admin/system/batch",
    menuCode: "A0060304",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BatchCloseoutGate", instanceKey: "batch-management-closeout-gate", layoutZone: "content", propsSummary: ["batchJobRows", "batchQueueRows", "batchNodeRows", "batchExecutionRows"] },
      { componentId: "BatchActionContract", instanceKey: "batch-management-action-contract", layoutZone: "actions", propsSummary: ["pauseJob", "resumeJob", "retryFailedRun", "drainQueue"] },
      { componentId: "BatchManagementFilters", instanceKey: "batch-management-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "jobStatus", "nodeStatus"] },
      { componentId: "BatchManagementSummary", instanceKey: "batch-management-summary", layoutZone: "content", propsSummary: ["filteredJobs", "filteredQueues", "filteredNodes", "filteredExecutions"] },
      { componentId: "BatchManagementJobs", instanceKey: "batch-management-jobs", layoutZone: "content", propsSummary: ["batchJobRows"] },
      { componentId: "BatchManagementQueues", instanceKey: "batch-management-queues", layoutZone: "content", propsSummary: ["batchQueueRows"] },
      { componentId: "BatchManagementNodes", instanceKey: "batch-management-nodes", layoutZone: "content", propsSummary: ["batchNodeRows"] },
      { componentId: "BatchManagementExecutions", instanceKey: "batch-management-executions", layoutZone: "content", propsSummary: ["batchExecutionRows"] }
    ]
  },
  "monitoring-center": {
    pageId: "monitoring-center",
    routePath: "/admin/monitoring/center",
    menuCode: "ADMIN_MONITORING_CENTER",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "OperationsCenterStatus", instanceKey: "operations-center-status", layoutZone: "header", propsSummary: ["overallStatus", "refreshedAt"] },
      { componentId: "OperationsCenterCloseoutGate", instanceKey: "operations-center-closeout-gate", layoutZone: "content", propsSummary: ["metricSource", "acknowledgement", "escalation", "assignment", "closeoutHistory"] },
      { componentId: "OperationsCenterActionContract", instanceKey: "operations-center-action-contract", layoutZone: "actions", propsSummary: ["acknowledge", "assignOwner", "escalate", "closeout"] },
      { componentId: "OperationsCenterCoreSummary", instanceKey: "operations-center-core-summary", layoutZone: "content", propsSummary: ["summaryCards", "coreDomains"] },
      { componentId: "OperationsCenterSupportSummary", instanceKey: "operations-center-support-summary", layoutZone: "content", propsSummary: ["summaryCards", "supportDomains"] },
      { componentId: "OperationsCenterNavigation", instanceKey: "operations-center-navigation", layoutZone: "content", propsSummary: ["navigationSections"] },
      { componentId: "OperationsCenterPriorityQueue", instanceKey: "operations-center-priority-queue", layoutZone: "content", propsSummary: ["priorityItems", "selectedQueueDomain"] },
      { componentId: "OperationsCenterPlaybooks", instanceKey: "operations-center-playbooks", layoutZone: "content", propsSummary: ["playbooks"] },
      { componentId: "OperationsCenterCoreWidgets", instanceKey: "operations-center-core-widgets", layoutZone: "content", propsSummary: ["widgetGroups", "primaryDomains"] },
      { componentId: "OperationsCenterExtendedWidgets", instanceKey: "operations-center-extended-widgets", layoutZone: "content", propsSummary: ["widgetGroups", "secondaryDomains"] },
      { componentId: "OperationsCenterRecentActions", instanceKey: "operations-center-recent-actions", layoutZone: "content", propsSummary: ["recentActions"] }
    ]
  },
  "sensor-list": {
    pageId: "sensor-list",
    routePath: "/admin/monitoring/sensor_list",
    menuCode: "A0070201",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SensorListSummaryCards", instanceKey: "sensor-list-summary", layoutZone: "header", propsSummary: ["sensorSummary"] },
      { componentId: "SensorListOperatingRule", instanceKey: "sensor-list-operating-rule", layoutZone: "content", propsSummary: ["triagePolicy"] },
      { componentId: "SensorListCloseoutGate", instanceKey: "sensor-list-closeout-gate", layoutZone: "content", propsSummary: ["liveInventorySource", "statusRefresh", "export", "bulkEnableDisable", "detailNavigation"] },
      { componentId: "SensorListActionContract", instanceKey: "sensor-list-action-contract", layoutZone: "actions", propsSummary: ["refreshStatus", "exportList", "bulkEnable", "bulkDisable"] },
      { componentId: "SensorListFilters", instanceKey: "sensor-list-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "statusFilter", "typeFilter", "severityFilter"] },
      { componentId: "SensorListTable", instanceKey: "sensor-list-table", layoutZone: "content", propsSummary: ["sensorRows", "pagedRows", "selectedSensorId"] },
      { componentId: "SensorListFocusPanel", instanceKey: "sensor-list-focus", layoutZone: "content", propsSummary: ["selectedRow", "targetRoute", "sensorEditHref"] },
      { componentId: "SensorListActivityFeed", instanceKey: "sensor-list-activity", layoutZone: "content", propsSummary: ["sensorActivityRows"] }
    ]
  },
  "infra": {
    pageId: "infra",
    routePath: "/admin/system/infra",
    menuCode: "ADMIN_SYSTEM_INFRA",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "InfraCloseoutGate", instanceKey: "infra-closeout-gate", layoutZone: "content", propsSummary: ["topologyRegistry", "liveHealthSource", "capacityThresholds", "incidentHandoff"] },
      { componentId: "InfraActionContract", instanceKey: "infra-action-contract", layoutZone: "actions", propsSummary: ["refreshHealth", "openIncident", "drainNode", "remediationHandoff"] },
      { componentId: "InfraSummary", instanceKey: "infra-summary", layoutZone: "content", propsSummary: ["filteredRows", "warningCount", "avgCpu", "avgMemory"] },
      { componentId: "InfraFilters", instanceKey: "infra-filters", layoutZone: "actions", propsSummary: ["roleFilter", "zoneFilter"] },
      { componentId: "InfraNodeGrid", instanceKey: "infra-node-grid", layoutZone: "content", propsSummary: ["INFRA_ROWS"] },
      { componentId: "InfraIncidents", instanceKey: "infra-incidents", layoutZone: "content", propsSummary: ["INCIDENT_ROWS"] },
      { componentId: "InfraConnectedConsoles", instanceKey: "infra-connected-consoles", layoutZone: "content", propsSummary: ["operationsCenter", "observability", "scheduler"] }
    ]
  },
  "performance": {
    pageId: "performance",
    routePath: "/admin/system/performance",
    menuCode: "ADMIN_SYSTEM_PERFORMANCE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PerformanceStatus", instanceKey: "performance-status", layoutZone: "header", propsSummary: ["overallStatus", "refreshedAt", "slowThresholdMs", "requestWindowSize"] },
      { componentId: "PerformanceCloseoutGate", instanceKey: "performance-closeout-gate", layoutZone: "content", propsSummary: ["thresholdManagement", "alertRules", "exportRetention", "trendComparison", "incidentLinkage"] },
      { componentId: "PerformanceActionContract", instanceKey: "performance-action-contract", layoutZone: "actions", propsSummary: ["saveThresholds", "linkAlertRule", "exportReport", "openIncident"] },
      { componentId: "PerformanceRuntimeSummary", instanceKey: "performance-runtime", layoutZone: "content", propsSummary: ["runtimeSummary"] },
      { componentId: "PerformanceRequestSummary", instanceKey: "performance-request-summary", layoutZone: "content", propsSummary: ["requestSummary"] },
      { componentId: "PerformanceHotspotRoutes", instanceKey: "performance-hotspot-routes", layoutZone: "content", propsSummary: ["hotspotRoutes"] },
      { componentId: "PerformanceResponseDistribution", instanceKey: "performance-response-distribution", layoutZone: "content", propsSummary: ["responseStatusSummary"] },
      { componentId: "PerformanceSlowRequests", instanceKey: "performance-slow-requests", layoutZone: "content", propsSummary: ["recentSlowRequests"] },
      { componentId: "PerformanceQuickLinks", instanceKey: "performance-quick-links", layoutZone: "content", propsSummary: ["quickLinks"] },
      { componentId: "PerformanceGuidance", instanceKey: "performance-guidance", layoutZone: "content", propsSummary: ["guidance"] }
    ]
  },
  "notification": {
    pageId: "notification",
    routePath: "/admin/system/notification",
    menuCode: "ADMIN_SYSTEM_NOTIFICATION",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "NotificationSnapshot", instanceKey: "notification-snapshot", layoutZone: "header", propsSummary: ["notificationCenterQuickLinks"] },
      { componentId: "NotificationSummary", instanceKey: "notification-summary", layoutZone: "content", propsSummary: ["notificationCenterSummary", "notificationCenterMeta"] },
      { componentId: "NotificationCloseoutGate", instanceKey: "notification-closeout-gate", layoutZone: "content", propsSummary: ["ruleCrud", "recipientScope", "testDispatch", "retryAudit"] },
      { componentId: "NotificationActionContract", instanceKey: "notification-action-contract", layoutZone: "actions", propsSummary: ["createRule", "previewRecipients", "testDispatch", "retryFailed"] },
      { componentId: "NotificationRouting", instanceKey: "notification-routing", layoutZone: "content", propsSummary: ["securityInsightNotificationConfig", "saveNotificationRouting", "dispatchNotificationRouting"] },
      { componentId: "NotificationHistory", instanceKey: "notification-history", layoutZone: "content", propsSummary: ["securityInsightDeliveryRows", "securityInsightActivityRows", "notificationCenterFilterOptions"] },
      { componentId: "NotificationGuidance", instanceKey: "notification-guidance", layoutZone: "content", propsSummary: ["notificationCenterGuidance"] }
    ]
  },
  "db-sync-deploy": {
    pageId: "db-sync-deploy",
    routePath: "/admin/system/db-sync-deploy",
    menuCode: "A0060406",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "DbSyncDeployScopeSummary", instanceKey: "db-sync-deploy-scope", layoutZone: "actions", propsSummary: ["dbSyncDeploySummary", "dbSyncDeployScriptPath"] },
      { componentId: "DbSyncDeployPolicyGuardrail", instanceKey: "db-sync-deploy-policy", layoutZone: "content", propsSummary: ["dbSyncDeployGuardrailRows", "analyze", "validatePolicy", "serverUpTest"] },
      { componentId: "DbSyncDeployBreakglass", instanceKey: "db-sync-deploy-breakglass", layoutZone: "content", propsSummary: ["EXECUTION_SOURCE", "BREAKGLASS_REASON", "BREAKGLASS_APPROVER"] },
      { componentId: "DbSyncDeployPermissionContract", instanceKey: "db-sync-deploy-permission-contract", layoutZone: "content", propsSummary: ["A0060406_VIEW", "A0060406_ANALYZE", "A0060406_VALIDATE", "A0060406_EXECUTE", "A0060406_BREAKGLASS"] },
      { componentId: "DbSyncDeployScriptChain", instanceKey: "db-sync-deploy-script-chain", layoutZone: "content", propsSummary: ["dbSyncDeployScriptChainRows"] },
      { componentId: "DbSyncDeployEvidence", instanceKey: "db-sync-deploy-evidence", layoutZone: "content", propsSummary: ["dbSyncDeployExecutionRows", "dbSyncDeployPolicyValidationRows"] },
      { componentId: "DbSyncDeployPolicyValidation", instanceKey: "db-sync-deploy-policy-validation", layoutZone: "content", propsSummary: ["dbSyncDeployPolicyValidationRows"] },
      { componentId: "DbSyncDeployHistory", instanceKey: "db-sync-deploy-history", layoutZone: "content", propsSummary: ["dbSyncDeployHistoryRows"] }
    ]
  },
  "board-list": {
    pageId: "board-list",
    routePath: "/admin/content/board_list",
    menuCode: "A0040101",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminMenuPlaceholderCard", instanceKey: "admin-menu-placeholder-card", layoutZone: "content", propsSummary: ["placeholderTitle", "placeholderUrl"] }
    ]
  },
  "board-add": {
    pageId: "board-add",
    routePath: "/admin/content/board_add",
    menuCode: "A0040103",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BoardAddScope", instanceKey: "board-add-scope", layoutZone: "actions", propsSummary: ["audience", "channels", "urgent"] },
      { componentId: "BoardAddForm", instanceKey: "board-add-form", layoutZone: "content", propsSummary: ["title", "summary", "publishAt", "expireAt"] },
      { componentId: "BoardAddOptions", instanceKey: "board-add-options", layoutZone: "content", propsSummary: ["pinned", "urgent", "allowComments"] },
      { componentId: "BoardAddPreview", instanceKey: "board-add-preview", layoutZone: "content", propsSummary: ["title", "summary", "body", "tags"] },
      { componentId: "BoardAddAudience", instanceKey: "board-add-audience", layoutZone: "content", propsSummary: ["recipientEstimate", "audience", "channels"] }
    ]
  },
  "post-list": {
    pageId: "post-list",
    routePath: "/admin/content/post_list",
    menuCode: "A0040102",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PostListSummary", instanceKey: "post-list-summary", layoutZone: "actions", propsSummary: ["summaryCards"] },
      { componentId: "PostListFilters", instanceKey: "post-list-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "category"] },
      { componentId: "PostListTable", instanceKey: "post-list-table", layoutZone: "content", propsSummary: ["postRows", "pageIndex", "totalPages"] },
      { componentId: "PostListPreview", instanceKey: "post-list-preview", layoutZone: "content", propsSummary: ["selectedPost"] }
    ]
  },
  "banner-list": {
    pageId: "banner-list",
    routePath: "/admin/content/banner_list",
    menuCode: "A0040201",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BannerListFilters", instanceKey: "banner-list-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "placement"] },
      { componentId: "BannerListSummary", instanceKey: "banner-list-summary", layoutZone: "actions", propsSummary: ["summaryCards"] },
      { componentId: "BannerListTable", instanceKey: "banner-list-table", layoutZone: "content", propsSummary: ["bannerRows"] },
      { componentId: "BannerListPreview", instanceKey: "banner-list-preview", layoutZone: "content", propsSummary: ["selectedBanner"] }
    ]
  },
  "banner-edit": {
    pageId: "banner-edit",
    routePath: "/admin/content/banner_edit",
    menuCode: "A0040202",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BannerEditScopeNotice", instanceKey: "banner-edit-scope", layoutZone: "content", propsSummary: ["bannerId", "message"] },
      { componentId: "BannerEditSummaryCards", instanceKey: "banner-edit-summary", layoutZone: "content", propsSummary: ["summaryCards"] },
      { componentId: "BannerEditForm", instanceKey: "banner-edit-form", layoutZone: "content", propsSummary: ["title", "targetUrl", "status", "placement", "startAt", "endAt"] },
      { componentId: "BannerEditPreview", instanceKey: "banner-edit-preview", layoutZone: "content", propsSummary: ["bannerId", "title", "targetUrl", "status", "startAt", "endAt"] },
      { componentId: "BannerEditActions", instanceKey: "banner-edit-actions", layoutZone: "actions", propsSummary: ["bannerId", "canSave"] }
    ]
  },
  "qna-category": {
    pageId: "qna-category",
    routePath: "/admin/content/qna",
    menuCode: "A0040302",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "QnaCategorySummary", instanceKey: "qna-category-summary", layoutZone: "content", propsSummary: ["categoryCount", "activeCount", "pendingCount", "totalQuestions"] },
      { componentId: "QnaCategorySearch", instanceKey: "qna-category-search", layoutZone: "actions", propsSummary: ["searchKeyword", "useAt", "channel"] },
      { componentId: "QnaCategoryTable", instanceKey: "qna-category-table", layoutZone: "content", propsSummary: ["code", "categoryName", "channel", "qnaCount", "pendingCount", "useAt"] },
      { componentId: "QnaCategoryDetail", instanceKey: "qna-category-detail", layoutZone: "content", propsSummary: ["selectedCategoryId", "owner", "sortOrder", "lastChangedAt"] }
    ]
  },
  "faq-menu-management": {
    pageId: "faq-menu-management",
    routePath: "/admin/content/menu",
    menuCode: "A0040304",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminMenuPlaceholderCard", instanceKey: "admin-menu-placeholder-card", layoutZone: "content", propsSummary: ["placeholderTitle", "placeholderUrl"] }
    ]
  },
  "faq-management": {
    pageId: "faq-management",
    routePath: "/admin/content/faq_list",
    menuCode: "A0040301",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "FaqManagementSummary", instanceKey: "faq-management-summary", layoutZone: "content", propsSummary: ["faqCount", "publishedCount", "reviewCount", "publicCount"] },
      { componentId: "FaqManagementSearch", instanceKey: "faq-management-search", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "exposure", "category"] },
      { componentId: "FaqManagementTable", instanceKey: "faq-management-table", layoutZone: "content", propsSummary: ["faqRows", "pageIndex", "totalPages"] },
      { componentId: "FaqManagementDetail", instanceKey: "faq-management-detail", layoutZone: "content", propsSummary: ["selectedFaqId", "owner", "displayOrder", "lastChangedAt"] }
    ]
  },
  "file-management": {
    pageId: "file-management",
    routePath: "/admin/content/file",
    menuCode: "A0040104",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "FileManagementSummary", instanceKey: "file-management-summary", layoutZone: "actions", propsSummary: ["fileCount", "activeCount", "reviewCount", "archiveCount"] },
      { componentId: "FileManagementFilters", instanceKey: "file-management-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "visibility"] },
      { componentId: "FileManagementTable", instanceKey: "file-management-table", layoutZone: "content", propsSummary: ["fileRows", "extension", "linkedScreens", "visibility", "status"] },
      { componentId: "FileManagementDetail", instanceKey: "file-management-detail", layoutZone: "content", propsSummary: ["selectedFileId", "owner", "retention", "securityGrade", "downloadCount"] }
    ]
  },
  "admin-sitemap": {
    pageId: "admin-sitemap",
    routePath: "/admin/content/sitemap",
    menuCode: "AMENU_ADMIN_SITEMAP",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminSitemapHero", instanceKey: "admin-sitemap-hero", layoutZone: "header" },
      { componentId: "AdminSitemapTree", instanceKey: "admin-sitemap-tree", layoutZone: "content", propsSummary: ["siteMapSections"] }
    ]
  },
  "tag-management": {
    pageId: "tag-management",
    routePath: "/admin/content/tag",
    menuCode: "A0040303",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "TagManagementFilters", instanceKey: "tag-management-filters", layoutZone: "actions", propsSummary: ["searchKeyword", "status"] },
      { componentId: "TagManagementSummary", instanceKey: "tag-management-summary", layoutZone: "actions", propsSummary: ["summaryCards"] },
      { componentId: "TagManagementTable", instanceKey: "tag-management-table", layoutZone: "content", propsSummary: ["tagRows"] },
      { componentId: "TagManagementUsage", instanceKey: "tag-management-usage", layoutZone: "content", propsSummary: ["usageRows"] }
    ]
  },
  "admin-menu-placeholder": {
    pageId: "admin-menu-placeholder",
    routePath: "/admin/placeholder",
    menuCode: "AMENU_ADMIN_PLACEHOLDER",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AdminMenuPlaceholderCard", instanceKey: "admin-menu-placeholder-card", layoutZone: "content", propsSummary: ["placeholderTitle", "placeholderUrl"] }
    ]
  },
  "sitemap": {
    pageId: "sitemap",
    routePath: "/sitemap",
    menuCode: "HMENU_SITEMAP",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SitemapHero", instanceKey: "sitemap-hero", layoutZone: "header" },
      { componentId: "SitemapTree", instanceKey: "sitemap-tree", layoutZone: "content", propsSummary: ["siteMapSections"] }
    ]
  },
  "home-menu-placeholder": {
    pageId: "home-menu-placeholder",
    routePath: "/placeholder",
    menuCode: "HMENU_PLACEHOLDER",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "HomeMenuPlaceholderCard", instanceKey: "home-menu-placeholder-card", layoutZone: "content", propsSummary: ["placeholderTitle", "placeholderUrl"] }
    ]
  },
  "environment-management": {
    pageId: "environment-management",
    routePath: "/admin/system/environment-management",
    menuCode: "A0060118",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EnvironmentManagementSummary", instanceKey: "environment-management-summary", layoutZone: "actions", propsSummary: ["menuCode", "featureCode"] },
      { componentId: "EnvironmentManagementEngines", instanceKey: "environment-management-engines", layoutZone: "content", propsSummary: ["allowAllScope", "allowedMemberTypes", "scope-policy-engine", "audit-diagnostic-engine"] },
      { componentId: "EnvironmentManagementCards", instanceKey: "environment-management-cards", layoutZone: "content", propsSummary: ["system-code", "page-management", "function-management", "menu-management"] }
    ]
  },
  "asset-inventory": {
    pageId: "asset-inventory",
    routePath: "/admin/system/asset-inventory",
    menuCode: "A0060123",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AssetInventorySummary", instanceKey: "asset-inventory-summary", layoutZone: "actions", propsSummary: ["totalCurrent", "totalTarget", "partialCount", "plannedCount"] },
      { componentId: "AssetInventoryOverview", instanceKey: "asset-inventory-overview", layoutZone: "content", propsSummary: ["readyCount", "partialCount", "plannedCount"] },
      { componentId: "AssetInventoryLanes", instanceKey: "asset-inventory-lanes", layoutZone: "content", propsSummary: ["laneCount", "service-registry", "runtime-operations", "integration-assets"] },
      { componentId: "AssetInventoryPriority", instanceKey: "asset-inventory-priority", layoutZone: "content", propsSummary: ["priorityCount"] }
    ]
  },
  "asset-detail": {
    pageId: "asset-detail",
    routePath: "/admin/system/asset-detail",
    menuCode: "A0060124",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AssetDetailSummary", instanceKey: "asset-detail-summary", layoutZone: "actions", propsSummary: ["assetType", "riskCount", "linkedConsoleCount"] },
      { componentId: "AssetDetailOverview", instanceKey: "asset-detail-overview", layoutZone: "content", propsSummary: ["currentState", "assetType"] },
      { componentId: "AssetDetailTabs", instanceKey: "asset-detail-tabs", layoutZone: "content", propsSummary: ["activeTab", "assetType"] },
      { componentId: "AssetDetailSupport", instanceKey: "asset-detail-support", layoutZone: "content", propsSummary: ["riskCount", "linkedConsoleCount"] }
    ]
  },
  "asset-impact": {
    pageId: "asset-impact",
    routePath: "/admin/system/asset-impact",
    menuCode: "A0060125",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AssetImpactSummary", instanceKey: "asset-impact-summary", layoutZone: "actions", propsSummary: ["modeCount", "linkedConsoleCount", "checkCount", "activeMode"] },
      { componentId: "AssetImpactModes", instanceKey: "asset-impact-modes", layoutZone: "content", propsSummary: ["activeMode"] },
      { componentId: "AssetImpactOverview", instanceKey: "asset-impact-overview", layoutZone: "content", propsSummary: ["activeMode", "linkedConsoleCount"] },
      { componentId: "AssetImpactDetails", instanceKey: "asset-impact-details", layoutZone: "content", propsSummary: ["activeMode", "checkCount"] },
      { componentId: "AssetImpactLinks", instanceKey: "asset-impact-links", layoutZone: "content", propsSummary: ["linkedConsoleCount"] }
    ]
  },
  "asset-lifecycle": {
    pageId: "asset-lifecycle",
    routePath: "/admin/system/asset-lifecycle",
    menuCode: "A0060126",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AssetLifecycleSummary", instanceKey: "asset-lifecycle-summary", layoutZone: "actions", propsSummary: ["stageCount", "linkedConsoleCount", "checkCount", "activeStage"] },
      { componentId: "AssetLifecycleStages", instanceKey: "asset-lifecycle-stages", layoutZone: "content", propsSummary: ["activeStage"] },
      { componentId: "AssetLifecycleOverview", instanceKey: "asset-lifecycle-overview", layoutZone: "content", propsSummary: ["activeStage"] },
      { componentId: "AssetLifecycleChecklist", instanceKey: "asset-lifecycle-checklist", layoutZone: "content", propsSummary: ["activeStage", "checkCount"] },
      { componentId: "AssetLifecycleLinks", instanceKey: "asset-lifecycle-links", layoutZone: "content", propsSummary: ["linkedConsoleCount"] }
    ]
  },
  "asset-gap": {
    pageId: "asset-gap",
    routePath: "/admin/system/asset-gap",
    menuCode: "A0060127",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "AssetGapSummary", instanceKey: "asset-gap-summary", layoutZone: "actions", propsSummary: ["queueTypeCount", "sourceConsoleCount"] },
      { componentId: "AssetGapOverview", instanceKey: "asset-gap-overview", layoutZone: "content", propsSummary: ["status"] },
      { componentId: "AssetGapQueues", instanceKey: "asset-gap-queues", layoutZone: "content", propsSummary: ["queueTypeCount"] },
      { componentId: "AssetGapSupport", instanceKey: "asset-gap-support", layoutZone: "content", propsSummary: ["signalSourceCount"] }
    ]
  },
  "verification-center": {
    pageId: "verification-center",
    routePath: "/admin/system/verification-center",
    menuCode: "A0060128",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "VerificationCenterSummary", instanceKey: "verification-center-summary", layoutZone: "actions", propsSummary: ["baselinePackCount", "managedPageCount", "scheduledSweepCount", "stalePendingCount"] },
      { componentId: "VerificationCenterOverview", instanceKey: "verification-center-overview", layoutZone: "content", propsSummary: ["baselinePolicyState", "currentRisk", "backupPathLink"] },
      { componentId: "VerificationCenterCatalog", instanceKey: "verification-center-catalog", layoutZone: "content", propsSummary: ["baselinePacks", "ownerScope", "linkedConsoleCount"] },
      { componentId: "VerificationCenterRuns", instanceKey: "verification-center-runs", layoutZone: "content", propsSummary: ["runCadenceCount", "failureRouting", "testAccountPolicy"] },
      { componentId: "VerificationCenterRunHistory", instanceKey: "verification-center-run-history", layoutZone: "content", propsSummary: ["runCount", "actionQueueCount", "failingRunCount"] },
      { componentId: "VerificationCenterManagedVault", instanceKey: "verification-center-managed-vault", layoutZone: "content", propsSummary: ["vaultPolicy", "scannerBoardCount"] },
      { componentId: "VerificationCenterBaselineRegistry", instanceKey: "verification-center-baseline-registry", layoutZone: "content", propsSummary: ["baselineRegistryCount", "vaultAccountCount", "vaultDatasetCount"] },
      { componentId: "VerificationCenterInventoryScope", instanceKey: "verification-center-inventory-scope", layoutZone: "content", propsSummary: ["pageCount", "apiCount", "functionCount", "testCaseCount"] },
      { componentId: "VerificationCenterFullLists", instanceKey: "verification-center-full-lists", layoutZone: "content", propsSummary: ["pages", "apis", "functions", "tests"] },
      { componentId: "VerificationCenterLogPolicy", instanceKey: "verification-center-log-policy", layoutZone: "content", propsSummary: ["nextBuildStepCount"] }
    ]
  },
  "verification-assets": {
    pageId: "verification-assets",
    routePath: "/admin/system/verification-assets",
    menuCode: "A0060129",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "VerificationAssetBaselineForm", instanceKey: "verification-assets-baseline-form", layoutZone: "content", propsSummary: ["pageId", "routePath", "baselineId", "snapshotPath"] },
      { componentId: "VerificationAssetAccountForm", instanceKey: "verification-assets-account-form", layoutZone: "content", propsSummary: ["profileId", "role", "status", "expiresAt"] },
      { componentId: "VerificationAssetDatasetForm", instanceKey: "verification-assets-dataset-form", layoutZone: "content", propsSummary: ["datasetId", "type", "status", "lastRefreshedAt"] },
      { componentId: "VerificationAssetActionQueue", instanceKey: "verification-assets-action-queue", layoutZone: "content", propsSummary: ["actionQueueCount", "resolveAction"] }
    ]
  },
  "screen-builder": {
    pageId: "screen-builder",
    routePath: "/admin/system/screen-builder",
    menuCode: "A1900106",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ScreenBuilderSummaryCard", instanceKey: "screen-builder-summary", layoutZone: "actions", propsSummary: ["menuCode", "pageId", "templateType", "publishIssueCount"] },
      { componentId: "ScreenBuilderOverviewPanels", instanceKey: "screen-builder-overview", layoutZone: "content", propsSummary: ["publishReady", "versionHistory", "registryDiagnostics"] },
      { componentId: "ScreenBuilderEditorPanels", instanceKey: "screen-builder-editor", layoutZone: "content", propsSummary: ["selectedNodeId", "selectedTemplateType", "previewMode"] },
      { componentId: "ScreenBuilderGovernancePanels", instanceKey: "screen-builder-governance", layoutZone: "content", propsSummary: ["authorityProfile", "registryUsageRows", "registryIssueCount"] }
    ]
  },
  "screen-runtime": {
    pageId: "screen-runtime",
    routePath: "/admin/system/screen-runtime",
    menuCode: "A1900107",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ScreenRuntimeSummaryCard", instanceKey: "screen-runtime-summary", layoutZone: "actions", propsSummary: ["menuCode", "pageId", "publishedVersionId", "snapshotCount"] },
      { componentId: "ScreenRuntimePublishAudit", instanceKey: "screen-runtime-publish-audit", layoutZone: "content", propsSummary: ["actionCode", "actorId", "createdAt"] },
      { componentId: "ScreenRuntimePreview", instanceKey: "screen-runtime-preview", layoutZone: "content", propsSummary: ["menuUrl", "templateType", "runtimeBlocked", "nodeCount"] },
      { componentId: "ScreenRuntimeBuilderActivity", instanceKey: "screen-runtime-builder-activity", layoutZone: "content", propsSummary: ["recentActivityCount", "traceId"] }
    ]
  },
  "current-runtime-compare": {
    pageId: "current-runtime-compare",
    routePath: "/admin/system/current-runtime-compare",
    menuCode: "A1900108",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RuntimeCompareSummaryMetrics", instanceKey: "runtime-compare-metrics", layoutZone: "actions", propsSummary: ["compareRowCount", "mismatchCount", "gapCount", "recentAuditCount"] },
      { componentId: "RuntimeCompareScopePanel", instanceKey: "runtime-compare-scope", layoutZone: "content", propsSummary: ["menuCode", "pageId", "publishedVersionId", "draftVersionId"] },
      { componentId: "RuntimeCompareMatrix", instanceKey: "runtime-compare-matrix", layoutZone: "content", propsSummary: ["templateLineId", "screenFamilyRuleId", "currentNodeCount", "generatedNodeCount"] },
      { componentId: "RuntimeCompareRecentEvents", instanceKey: "runtime-compare-events", layoutZone: "content", propsSummary: ["latestPublishAt", "traceId", "actionCode"] }
    ]
  },
  "repair-workbench": {
    pageId: "repair-workbench",
    routePath: "/admin/system/repair-workbench",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RepairWorkbenchScope", instanceKey: "repair-workbench-scope", layoutZone: "content", propsSummary: ["menuCode", "pageId", "releaseUnitId", "traceId"] },
      { componentId: "RepairWorkbenchLinkage", instanceKey: "repair-workbench-linkage", layoutZone: "content", propsSummary: ["builderId", "draftVersionId", "publishedVersionId", "selectedElementSet"] }
    ]
  },
  "screen-flow-management": {
    pageId: "screen-flow-management",
    routePath: "/admin/system/screen-flow-management",
    menuCode: "A1900109",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ScreenFlowSummaryCards", instanceKey: "screen-flow-summary", layoutZone: "actions", propsSummary: ["registeredScreenCount", "surfaceCount", "eventCount", "apiSchemaCount"] },
      { componentId: "ScreenFlowCloseoutGate", instanceKey: "screen-flow-closeout-gate", layoutZone: "content", propsSummary: ["catalogInspection", "metadataChain", "flowCrud", "transitionEditing", "versioning", "impactPreview", "audit"] },
      { componentId: "ScreenFlowActionContract", instanceKey: "screen-flow-action-contract", layoutZone: "actions", propsSummary: ["createFlow", "editTransitions", "validateFlow", "publishVersion", "saveImpactPreview"] },
      { componentId: "ScreenFlowCatalog", instanceKey: "screen-flow-catalog", layoutZone: "content", propsSummary: ["selectedPageId", "pageFilter", "filteredPageCount"] },
      { componentId: "ScreenFlowSurfaceChain", instanceKey: "screen-flow-surface-chain", layoutZone: "content", propsSummary: ["surfaceCount", "eventIds", "selector"] },
      { componentId: "ScreenFlowEventApiChain", instanceKey: "screen-flow-event-chain", layoutZone: "content", propsSummary: ["eventCount", "frontendFunction", "apiIds"] },
      { componentId: "ScreenFlowSchemaAndPermission", instanceKey: "screen-flow-schema-permission", layoutZone: "content", propsSummary: ["schemaCount", "requiredViewFeatureCode", "changeTargetCount"] }
    ]
  },
  "screen-menu-assignment-management": {
    pageId: "screen-menu-assignment-management",
    routePath: "/admin/system/screen-menu-assignment-management",
    menuCode: "A1900110",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ScreenMenuAssignmentSummaryCards", instanceKey: "screen-menu-assignment-summary", layoutZone: "actions", propsSummary: ["pageMenuCount", "assignedCount", "unassignedCount", "orphanedScreenCount"] },
      { componentId: "ScreenMenuAssignmentCloseoutGate", instanceKey: "screen-menu-assignment-closeout-gate", layoutZone: "content", propsSummary: ["menuInventory", "assignmentList", "singleMappingSave", "conflictDetection", "authorityImpact", "rollback", "auditEvidence"] },
      { componentId: "ScreenMenuAssignmentActionContract", instanceKey: "screen-menu-assignment-action-contract", layoutZone: "actions", propsSummary: ["checkConflicts", "previewAuthorityImpact", "bulkMapping", "rollback", "exportAuditEvidence"] },
      { componentId: "ScreenMenuAssignmentCatalog", instanceKey: "screen-menu-assignment-catalog", layoutZone: "content", propsSummary: ["selectedMenuCode", "filter", "filteredAssignmentCount"] },
      { componentId: "ScreenMenuAssignmentDetail", instanceKey: "screen-menu-assignment-detail", layoutZone: "content", propsSummary: ["menuCode", "pageId", "layoutVersion", "requiredViewFeatureCode"] },
      { componentId: "ScreenMenuAssignmentOrphanPages", instanceKey: "screen-menu-assignment-orphans", layoutZone: "content", propsSummary: ["orphanPageCount", "pageId", "routePath", "menuCode"] }
    ]
  },
  "wbs-management": {
    pageId: "wbs-management",
    routePath: "/admin/system/wbs-management",
    menuCode: "A1900104",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "WbsSummaryCards", instanceKey: "wbs-summary-cards", layoutZone: "actions", propsSummary: ["scope", "pageMenus", "overdue", "onTimeCompletionRate", "averageVarianceDays", "noPlannedDate"] },
      { componentId: "WbsCloseoutGate", instanceKey: "wbs-closeout-gate", layoutZone: "content", propsSummary: ["menuInventory", "planSave", "scheduleMetrics", "codexInstruction", "saveAudit", "srTicketLinkage", "bulkUpdate", "auditExport"] },
      { componentId: "WbsActionContract", instanceKey: "wbs-action-contract", layoutZone: "actions", propsSummary: ["createSrTicket", "syncSrLink", "bulkScheduleUpdate", "exportAuditEvidence"] },
      { componentId: "WbsMenuTree", instanceKey: "wbs-menu-tree", layoutZone: "content", propsSummary: ["menuType", "selectedMenuCode"] },
      { componentId: "WbsExecutionTable", instanceKey: "wbs-execution-table", layoutZone: "content", propsSummary: ["wbsRows", "waveSummary"] },
      { componentId: "WbsEditorPanel", instanceKey: "wbs-editor-panel", layoutZone: "content", propsSummary: ["owner", "status", "progress", "plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate", "notes", "codexInstruction"] },
      { componentId: "WbsCodexPrompt", instanceKey: "wbs-codex-prompt", layoutZone: "content", propsSummary: ["codexPrompt", "codexInstruction"] }
    ]
  },
  "new-page": {
    pageId: "new-page",
    routePath: "/admin/system/new-page",
    menuCode: "AMENU_SYSTEM_NEW_PAGE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "NewPageStatusNotice", instanceKey: "new-page-status", layoutZone: "header", propsSummary: ["route", "scope", "status"] },
      { componentId: "NewPageSummaryCards", instanceKey: "new-page-summary", layoutZone: "actions", propsSummary: ["defaultRoute", "localeScope", "draftStatus"] },
      { componentId: "NewPageStarterChecklist", instanceKey: "new-page-checklist", layoutZone: "content", propsSummary: ["nextStepCount", "assumptionCount"] }
    ]
  },
  "external-retry": {
    pageId: "external-retry",
    routePath: "/admin/external/retry",
    menuCode: "A0050105",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "ExternalRetrySummaryCards", instanceKey: "external-retry-summary", layoutZone: "content", propsSummary: ["externalRetrySummary"] },
      { componentId: "ExternalRetryFilters", instanceKey: "external-retry-filters", layoutZone: "actions", propsSummary: ["keyword", "retryClass", "status"] },
      { componentId: "ExternalRetryQueue", instanceKey: "external-retry-queue", layoutZone: "content", propsSummary: ["rows", "filteredRows", "refreshedAt"] },
      { componentId: "ExternalRetryPolicy", instanceKey: "external-retry-policy", layoutZone: "content", propsSummary: ["policyRows", "ownerName", "status"] },
      { componentId: "ExternalRetryHistory", instanceKey: "external-retry-history", layoutZone: "content", propsSummary: ["executionRows", "result", "duration"] },
      { componentId: "ExternalRetryQuickLinks", instanceKey: "external-retry-links", layoutZone: "content", propsSummary: ["quickLinks"] },
      { componentId: "ExternalRetryGuidance", instanceKey: "external-retry-guidance", layoutZone: "content", propsSummary: ["guidance"] }
    ]
  },
  "sr-workbench": {
    pageId: "sr-workbench",
    routePath: "/admin/system/sr-workbench",
    menuCode: "A1900102",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SrTicketDraftForm", instanceKey: "sr-ticket-draft", layoutZone: "actions", propsSummary: ["pageId", "surfaceId", "eventId", "targetId"] },
      { componentId: "SrDirectionPreview", instanceKey: "sr-direction-preview", layoutZone: "content", propsSummary: ["generatedDirection", "commandPrompt"] },
      { componentId: "SrTicketTable", instanceKey: "sr-ticket-table", layoutZone: "content", propsSummary: ["tickets", "approvalComment", "executionStatus"] }
    ]
  },
  "certificate-approve": {
    pageId: "certificate-approve",
    routePath: "/admin/certificate/approve",
    menuCode: "AMENU_CERTIFICATE_APPROVE",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "CertificateApproveSearch", instanceKey: "certificate-approve-search", layoutZone: "actions", propsSummary: ["searchKeyword", "status", "companyName"] },
      { componentId: "CertificateApproveTable", instanceKey: "certificate-approve-table", layoutZone: "content", propsSummary: ["rows", "selectedRowId", "pageIndex"] },
      { componentId: "CertificateApproveBatchActions", instanceKey: "certificate-approve-batch-actions", layoutZone: "actions", propsSummary: ["checkedCount", "approvalStatus"] }
    ]
  },
  "sensor-add": {
    pageId: "sensor-add",
    routePath: "/admin/monitoring/sensor_add",
    menuCode: "AMENU_SENSOR_ADD",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SensorAddBasicProfile", instanceKey: "sensor-add-basic-profile", layoutZone: "content", propsSummary: ["sensorName", "sensorType", "siteCode"] },
      { componentId: "SensorAddPolicy", instanceKey: "sensor-add-policy", layoutZone: "content", propsSummary: ["collectionCycle", "threshold", "alertUseAt"] },
      { componentId: "SensorAddOpsNotes", instanceKey: "sensor-add-ops-notes", layoutZone: "content", propsSummary: ["ownerTeam", "ownerUser", "notes"] }
    ]
  },
  "sensor-edit": {
    pageId: "sensor-edit",
    routePath: "/admin/monitoring/sensor_edit",
    menuCode: "AMENU_SENSOR_EDIT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "SensorEditContext", instanceKey: "sensor-edit-context", layoutZone: "content", propsSummary: ["sensorId", "siteCode", "monitoringCode"] },
      { componentId: "SensorEditProfile", instanceKey: "sensor-edit-profile", layoutZone: "content", propsSummary: ["sensorName", "sensorType", "status"] },
      { componentId: "SensorEditThreshold", instanceKey: "sensor-edit-threshold", layoutZone: "content", propsSummary: ["collectionCycle", "warningThreshold", "criticalThreshold"] },
      { componentId: "SensorEditOwnership", instanceKey: "sensor-edit-ownership", layoutZone: "content", propsSummary: ["ownerTeam", "ownerUser", "maintenanceCycle"] }
    ]
  },
  "db-promotion-policy": {
    pageId: "db-promotion-policy",
    routePath: "/admin/system/db-promotion-policy",
    menuCode: "AMENU_DB_PROMOTION_POLICY",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "DbPromotionPolicyTable", instanceKey: "db-promotion-policy-table-list", layoutZone: "content", propsSummary: ["rows", "selectedTableName", "policyType"] },
      { componentId: "DbPromotionPolicyComment", instanceKey: "db-promotion-policy-comment", layoutZone: "content", propsSummary: ["selectedPolicy", "generatedComment"] },
      { componentId: "DbPromotionPolicyRecentChanges", instanceKey: "db-promotion-policy-recent-changes", layoutZone: "content", propsSummary: ["changeRows", "tableName", "actionType"] }
    ]
  },
  "backup-config": {
    pageId: "backup-config",
    routePath: "/admin/system/backup_config",
    menuCode: "AMENU_BACKUP_CONFIG",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BackupConfigSummary", instanceKey: "backup-config-summary", layoutZone: "actions", propsSummary: ["summaryCards", "backupRootPath", "retentionDays"] },
      { componentId: "BackupConfigStorage", instanceKey: "backup-config-storage", layoutZone: "content", propsSummary: ["storageType", "backupRootPath", "snapshotCount"] },
      { componentId: "BackupConfigExecutions", instanceKey: "backup-config-executions", layoutZone: "content", propsSummary: ["executionRows", "lastRunAt"] },
      { componentId: "BackupConfigVersions", instanceKey: "backup-config-versions", layoutZone: "content", propsSummary: ["versionRows", "selectedVersion"] }
    ]
  },
  "backup-execution": {
    pageId: "backup-execution",
    routePath: "/admin/system/backup",
    menuCode: "AMENU_BACKUP_EXECUTION",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "BackupExecutionSummary", instanceKey: "backup-config-summary", layoutZone: "actions", propsSummary: ["pageKey", "summaryCards", "runType"] },
      { componentId: "BackupExecutionRunActions", instanceKey: "backup-config-run-actions", layoutZone: "content", propsSummary: ["dbEnabled", "gitEnabled", "freshnessRequired"] },
      { componentId: "BackupExecutionPlaybooks", instanceKey: "backup-config-playbooks", layoutZone: "content", propsSummary: ["playbookCount", "targetSystem"] }
    ]
  },
  "restore-execution": {
    pageId: "restore-execution",
    routePath: "/admin/system/restore",
    menuCode: "AMENU_RESTORE_EXECUTION",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "RestoreExecutionSummary", instanceKey: "backup-config-summary", layoutZone: "actions", propsSummary: ["pageKey", "summaryCards", "restoreTarget"] },
      { componentId: "RestoreExecutionActions", instanceKey: "backup-restore-actions", layoutZone: "content", propsSummary: ["snapshotId", "restoreMode", "confirmationRequired"] },
      { componentId: "RestoreExecutionPlaybooks", instanceKey: "backup-config-playbooks", layoutZone: "content", propsSummary: ["playbookCount", "restoreTarget"] }
    ]
  },
  "notice-list": {
    pageId: "notice-list",
    routePath: "/support/notice_list",
    menuCode: "HMENU_NOTICE_LIST",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "NoticeListHero", instanceKey: "notice-list-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "headline"] },
      { componentId: "NoticeListFilters", instanceKey: "notice-list-filters", layoutZone: "actions", propsSummary: ["keyword", "category", "pageIndex"] },
      { componentId: "NoticeListTable", instanceKey: "notice-list-table", layoutZone: "content", propsSummary: ["rows", "selectedNoticeId", "totalCount"] }
    ]
  },
  "emission-management": {
    pageId: "emission-management",
    routePath: "/admin/emission/management",
    menuCode: "AMENU_EMISSION_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionManagementSummary", instanceKey: "emission-management-summary", layoutZone: "actions", propsSummary: ["categoryCode", "tier", "summaryMetrics"] },
      { componentId: "EmissionManagementScope", instanceKey: "emission-management-scope", layoutZone: "content", propsSummary: ["searchKeyword", "categoryCode", "tier"] },
      { componentId: "EmissionManagementDefinition", instanceKey: "emission-management-definition", layoutZone: "content", propsSummary: ["variableCount", "factorReferenceCount", "formulaText"] },
      { componentId: "EmissionManagementInput", instanceKey: "emission-management-input", layoutZone: "content", propsSummary: ["sessionId", "rowCount", "validationState"] },
      { componentId: "EmissionManagementActions", instanceKey: "emission-management-actions", layoutZone: "actions", propsSummary: ["sessionId", "canSave", "canCalculate"] },
      { componentId: "EmissionManagementResult", instanceKey: "emission-management-result", layoutZone: "content", propsSummary: ["calculatedTotal", "factorSnapshotCount", "usedFallback"] }
    ]
  },
  "emission-lci-classification": {
    pageId: "emission-lci-classification",
    routePath: "/admin/emission/lci-classification",
    menuCode: "AMENU_EMISSION_LCI_CLASSIFICATION",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionLciClassificationSummary", instanceKey: "emission-lci-classification-summary", layoutZone: "actions", propsSummary: ["summaryCards", "classificationCount"] },
      { componentId: "EmissionLciClassificationTable", instanceKey: "emission-lci-classification-table", layoutZone: "content", propsSummary: ["rows", "selectedClassificationId"] },
      { componentId: "EmissionLciClassificationDetail", instanceKey: "emission-lci-classification-detail", layoutZone: "content", propsSummary: ["classificationCode", "majorCategory", "minorCategory"] }
    ]
  },
  "emission-survey-admin": {
    pageId: "emission-survey-admin",
    routePath: "/admin/emission/survey-admin",
    menuCode: "AMENU_EMISSION_SURVEY_ADMIN",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionSurveyAdminClassification", instanceKey: "emission-survey-admin-classification", layoutZone: "actions", propsSummary: ["classificationId", "surveyType", "draftSetId"] },
      { componentId: "EmissionSurveyAdminWorkbookGrid", instanceKey: "emission-survey-admin-grid", layoutZone: "content", propsSummary: ["columnCount", "rowCount", "selectedCell"] },
      { componentId: "EmissionSurveyAdminBottomActions", instanceKey: "emission-survey-admin-bottom-actions", layoutZone: "actions", propsSummary: ["canSave", "canPublish", "draftState"] }
    ]
  },
  "emission-survey-report": {
    pageId: "emission-survey-report",
    routePath: "/admin/emission/survey-report",
    menuCode: "AMENU_EMISSION_SURVEY_ADMIN",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionSurveyReportHero", instanceKey: "emission-survey-report-hero", layoutZone: "header", propsSummary: ["productName", "totalEmission", "dataConfidence"] },
      { componentId: "EmissionSurveyReportContributionChart", instanceKey: "emission-survey-report-contribution-chart", layoutZone: "content", propsSummary: ["sectionCount", "topContributorLabel", "warningCount"] },
      { componentId: "EmissionSurveyReportInventory", instanceKey: "emission-survey-report-inventory", layoutZone: "content", propsSummary: ["rowCount", "sectionCount", "scenarioCount"] }
    ]
  },
  "emission-survey-admin-data": {
    pageId: "emission-survey-admin-data",
    routePath: "/admin/emission/survey-admin-data",
    menuCode: "AMENU_EMISSION_SURVEY_ADMIN_DATA",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EmissionSurveyAdminDataUpload", instanceKey: "emission-survey-admin-data-upload", layoutZone: "actions", propsSummary: ["uploadedFileName", "sheetCount", "replaceMode"] },
      { componentId: "EmissionSurveyAdminDataDataset", instanceKey: "emission-survey-admin-data-dataset", layoutZone: "content", propsSummary: ["datasetCount", "sectionCount", "selectedDatasetId"] },
      { componentId: "EmissionSurveyAdminDataPreview", instanceKey: "emission-survey-admin-data-preview", layoutZone: "content", propsSummary: ["previewRowCount", "selectedSheetName"] }
    ]
  },
  "co2-integrity": {
    pageId: "co2-integrity",
    routePath: "/co2/integrity",
    menuCode: "H0030102",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2IntegrityHero", instanceKey: "co2-integrity-hero", layoutZone: "header", propsSummary: ["routePath", "menuCode", "headline"] },
      { componentId: "Co2IntegrityTraceMap", instanceKey: "co2-integrity-trace-map", layoutZone: "content", propsSummary: ["nodeCount", "integrityScore", "alertCount"] },
      { componentId: "Co2IntegrityEvidence", instanceKey: "co2-integrity-evidence", layoutZone: "content", propsSummary: ["evidenceCount", "selectedEvidenceId"] }
    ]
  },
  "co2-credit": {
    pageId: "co2-credit",
    routePath: "/co2/credit",
    menuCode: "H0030301",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2CreditHero", instanceKey: "co2-credit-hero", layoutZone: "header", propsSummary: ["routePath", "menuCode", "headline"] },
      { componentId: "Co2CreditPortfolio", instanceKey: "co2-credit-portfolio", layoutZone: "content", propsSummary: ["creditCount", "availableBalance", "retiredBalance"] },
      { componentId: "Co2CreditActions", instanceKey: "co2-credit-actions", layoutZone: "actions", propsSummary: ["portfolioValue", "buyEnabled"] }
    ]
  },
  "co2-analysis": {
    pageId: "co2-analysis",
    routePath: "/co2/analysis",
    menuCode: "H0030103",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "Co2AnalysisHero", instanceKey: "co2-analysis-hero", layoutZone: "header", propsSummary: ["routePath", "menuCode", "headline"] },
      { componentId: "Co2AnalysisCharts", instanceKey: "co2-analysis-charts", layoutZone: "content", propsSummary: ["chartCount", "selectedRange", "trendDirection"] },
      { componentId: "Co2AnalysisRecommendations", instanceKey: "co2-analysis-recommendations", layoutZone: "content", propsSummary: ["recommendationCount", "selectedSiteId"] }
    ]
  },
  "edu-course-list": {
    pageId: "edu-course-list",
    routePath: "/edu/course_list",
    menuCode: "HMENU_EDU_COURSE_LIST",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduCourseListHero", instanceKey: "edu-course-list-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "categoryCount"] },
      { componentId: "EduCourseListCatalog", instanceKey: "edu-course-list-catalog", layoutZone: "content", propsSummary: ["courseCount", "selectedCategory", "pageIndex"] }
    ]
  },
  "edu-survey": {
    pageId: "edu-survey",
    routePath: "/edu/survey",
    menuCode: "HMENU_EDU_SURVEY",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduSurveyHero", instanceKey: "edu-survey-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "surveyTitle"] },
      { componentId: "EduSurveyForm", instanceKey: "edu-survey-form", layoutZone: "content", propsSummary: ["questionCount", "responseCount", "submitState"] }
    ]
  },
  "edu-certificate": {
    pageId: "edu-certificate",
    routePath: "/edu/certificate",
    menuCode: "HMENU_EDU_CERTIFICATE",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "EduCertificateHero", instanceKey: "edu-certificate-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "userName"] },
      { componentId: "EduCertificateDetail", instanceKey: "edu-certificate-detail", layoutZone: "content", propsSummary: ["learnerName", "courseName", "issuedAt"] }
    ]
  },
  "mypage-email": {
    pageId: "mypage-email",
    routePath: "/mypage/email",
    menuCode: "HMENU_MYPAGE_EMAIL",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageEmailHero", instanceKey: "mypage-email-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "memberId"] },
      { componentId: "MypageEmailForm", instanceKey: "mypage-email-form", layoutZone: "content", propsSummary: ["email", "phoneNumber", "verificationState"] }
    ]
  },
  "mypage-staff": {
    pageId: "mypage-staff",
    routePath: "/mypage/staff",
    menuCode: "HMENU_MYPAGE_STAFF",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "MypageStaffHero", instanceKey: "mypage-staff-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "staffCount"] },
      { componentId: "MypageStaffTable", instanceKey: "mypage-staff-table", layoutZone: "content", propsSummary: ["rows", "selectedStaffId", "roleCount"] }
    ]
  },
  "payment-receipt": {
    pageId: "payment-receipt",
    routePath: "/payment/receipt",
    menuCode: "HMENU_PAYMENT_RECEIPT",
    domainCode: "home",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "PaymentReceiptHero", instanceKey: "payment-receipt-hero", layoutZone: "header", propsSummary: ["brandSubtitle", "receiptId"] },
      { componentId: "PaymentReceiptDetail", instanceKey: "payment-receipt-detail", layoutZone: "content", propsSummary: ["paymentAmount", "paymentMethod", "approvedAt"] }
    ]
  },
  "version-management": {
    pageId: "version-management",
    routePath: "/admin/system/version",
    menuCode: "AMENU_VERSION_MANAGEMENT",
    domainCode: "admin",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "VersionManagementSummary", instanceKey: "version-management-summary", layoutZone: "header", propsSummary: ["summaryCards"] },
      { componentId: "VersionManagementGovernance", instanceKey: "version-management-governance", layoutZone: "content", propsSummary: ["compatibilityRuns", "artifactLocks", "fleetGovernanceNextSteps"] },
      { componentId: "VersionManagementDbGit", instanceKey: "version-management-db-git", layoutZone: "content", propsSummary: ["backupSettingsForm", "backupProfiles", "recentRemoteJobs"] },
      { componentId: "VersionManagementOverview", instanceKey: "version-management-overview", layoutZone: "content", propsSummary: ["overview", "installedPackages"] },
      { componentId: "VersionManagementControlPlane", instanceKey: "version-management-control-plane", layoutZone: "content", propsSummary: ["projectPipeline", "pipelineArtifactLineage", "pipelineRollbackPlan"] },
      { componentId: "VersionManagementReleaseDetail", instanceKey: "version-management-release-detail", layoutZone: "content", propsSummary: ["selectedReleaseUnit", "selectedReleaseCommonArtifacts", "selectedReleasePackages"] },
      { componentId: "VersionManagementUpgradePlanner", instanceKey: "version-management-upgrade-planner", layoutZone: "footer", propsSummary: ["artifactDraft", "targetArtifactSet"] }
    ]
  },
  "unified-log": {
    pageId: "unified-log",
    routePath: "/admin/system/unified_log",
    menuCode: "AMENU_UNIFIED_LOG",
    domainCode: "platform",
    layoutVersion: "v1",
    designTokenVersion: "krds-current",
    components: [
      { componentId: "UnifiedLogSummary", instanceKey: "unified-trace-summary", layoutZone: "actions", propsSummary: ["traceCount", "pageCount", "errorLikeCount"] },
      { componentId: "UnifiedLogFilters", instanceKey: "observability-filters", layoutZone: "actions", propsSummary: ["traceId", "pageId", "actionCode", "tab"] },
      { componentId: "UnifiedLogOps", instanceKey: "unified-trace-ops", layoutZone: "content", propsSummary: ["selectedUnifiedItem", "uniqueTraceCount"] },
      { componentId: "UnifiedLogTable", instanceKey: "unified-log-table", layoutZone: "content", propsSummary: ["rows", "pageIndex", "totalCount"] }
    ]
  },
};

export function getPageManifest(pageId: string) {
  return PAGE_MANIFESTS[pageId];
}
