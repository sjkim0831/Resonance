package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminBackupOperationsMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00604";
    private static final String GROUP_NAME = "백업";
    private static final String GROUP_NAME_EN = "Backup";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";
    private static final String VERSION_MANAGEMENT_MENU_CODE = "A0060404";
    private static final String VERSION_VIEW_FEATURE_CODE = "A0060404_VIEW";
    private static final String VERSION_ANALYZE_FEATURE_CODE = "A0060404_ANALYZE";
    private static final String VERSION_APPLY_FEATURE_CODE = "A0060404_APPLY";
    private static final String VERSION_ROLLBACK_FEATURE_CODE = "A0060404_ROLLBACK";
    private static final String DB_POLICY_MENU_CODE = "A0060405";
    private static final String DB_SYNC_DEPLOY_MENU_CODE = "A0060406";
    private static final String DB_SYNC_DEPLOY_VIEW_FEATURE_CODE = "A0060406_VIEW";
    private static final String DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE = "A0060406_ANALYZE";
    private static final String DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE = "A0060406_VALIDATE";
    private static final String DB_SYNC_DEPLOY_EXECUTE_FEATURE_CODE = "A0060406_EXECUTE";
    private static final String DB_SYNC_DEPLOY_BREAKGLASS_FEATURE_CODE = "A0060406_BREAKGLASS";

    private final CodexProvisioningService codexProvisioningService;
    private final AdminCodeManageService adminCodeManageService;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureBackupMenus() {
        hideLegacyMenu();
        for (MenuDefinition menu : menuDefinitions()) {
            try {
                CodexProvisionResponse response = codexProvisioningService.provision(buildRequest(menu));
                adminCodeManageService.updatePageManagement(
                        menu.menuCode,
                        menu.menuNameKo,
                        menu.menuNameEn,
                        menu.menuUrl,
                        menu.menuIcon,
                        "Y",
                        ACTOR_ID
                );
                log.info("Backup menu provisioned. menuCode={}, created={}, existing={}, skipped={}",
                        menu.menuCode, response.getCreatedCount(), response.getExistingCount(), response.getSkippedCount());
            } catch (Exception e) {
                log.error("Failed to provision backup menu. menuCode={}", menu.menuCode, e);
            }
        }
    }

    private void hideLegacyMenu() {
        try {
            adminCodeManageService.updatePageManagement(
                    "A0060122",
                    "백업 설정",
                    "Backup Settings",
                    "/admin/system/backup_config",
                    "backup",
                    "N",
                    ACTOR_ID
            );
        } catch (Exception ignored) {
        }
    }

    private List<MenuDefinition> menuDefinitions() {
        return Arrays.asList(
                new MenuDefinition("A0060401", "백업 설정", "Backup Settings", "/admin/system/backup_config", "backup"),
                new MenuDefinition("A0060402", "백업 실행", "Backup Execution", "/admin/system/backup", "play_circle"),
                new MenuDefinition("A0060403", "복구 실행", "Restore Execution", "/admin/system/restore", "restore"),
                new MenuDefinition("A0060404", "버전 관리", "Version Management", "/admin/system/version", "history"),
                new MenuDefinition("A0060405", "DB 반영 정책 카탈로그", "DB Promotion Policy Catalog", "/admin/system/db-promotion-policy", "schema"),
                new MenuDefinition("A0060406", "DB 동기화 배포", "DB Sync Deploy", "/admin/system/db-sync-deploy", "published_with_changes")
        );
    }

    private CodexProvisionRequest buildRequest(MenuDefinition menu) {
        CodexProvisionRequest request = new CodexProvisionRequest();
        request.setRequestId("BOOTSTRAP-" + menu.menuCode);
        request.setActorId(ACTOR_ID);
        request.setTargetApiPath(menu.menuUrl);
        request.setMenuType("ADMIN");
        request.setReloadSecurityMetadata(true);
        request.setPage(pageRequest(menu));
        if (versionManagementMenu(menu)) {
            request.setFeatures(Arrays.asList(
                    featureRequest(VERSION_VIEW_FEATURE_CODE, "버전 관리 조회", "View Version Management", menu.menuNameEn + " page access"),
                    featureRequest(VERSION_ANALYZE_FEATURE_CODE, "버전 영향 분석", "Analyze Version Impact", "Analyze project upgrade impact"),
                    featureRequest(VERSION_APPLY_FEATURE_CODE, "버전 업그레이드 적용", "Apply Version Upgrade", "Apply project artifact upgrade"),
                    featureRequest(VERSION_ROLLBACK_FEATURE_CODE, "버전 롤백", "Rollback Version Release", "Rollback project release unit")));
            request.setAuthors(Arrays.asList(
                    authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                            VERSION_VIEW_FEATURE_CODE,
                            VERSION_ANALYZE_FEATURE_CODE,
                            VERSION_APPLY_FEATURE_CODE,
                            VERSION_ROLLBACK_FEATURE_CODE),
                    authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                            VERSION_VIEW_FEATURE_CODE,
                            VERSION_ANALYZE_FEATURE_CODE,
                            VERSION_APPLY_FEATURE_CODE,
                            VERSION_ROLLBACK_FEATURE_CODE),
                    authorRequest("ROLE_OPERATION_ADMIN", "운영 관리자", "Operation Administrator",
                            VERSION_VIEW_FEATURE_CODE,
                            VERSION_ANALYZE_FEATURE_CODE,
                            VERSION_APPLY_FEATURE_CODE,
                            VERSION_ROLLBACK_FEATURE_CODE),
                    authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                            VERSION_VIEW_FEATURE_CODE,
                            VERSION_ANALYZE_FEATURE_CODE,
                            VERSION_APPLY_FEATURE_CODE,
                            VERSION_ROLLBACK_FEATURE_CODE)));
        } else if (dbPolicyMenu(menu)) {
            request.setFeatures(Arrays.asList(
                    featureRequest(menu.menuCode + "_VIEW", menu.menuNameKo + " 조회", "View " + menu.menuNameEn, menu.menuNameEn + " page access"),
                    featureRequest(menu.menuCode + "_UPDATE", menu.menuNameKo + " 수정", "Update " + menu.menuNameEn, "Save table-level DB promotion policy")));
            request.setAuthors(Arrays.asList(
                    authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", menu.menuCode + "_VIEW", menu.menuCode + "_UPDATE"),
                    authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", menu.menuCode + "_VIEW", menu.menuCode + "_UPDATE"),
                    authorRequest("ROLE_OPERATION_ADMIN", "운영 관리자", "Operation Administrator", menu.menuCode + "_VIEW", menu.menuCode + "_UPDATE"),
                    authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", menu.menuCode + "_VIEW")));
        } else if (dbSyncDeployMenu(menu)) {
            request.setFeatures(Arrays.asList(
                    featureRequest(DB_SYNC_DEPLOY_VIEW_FEATURE_CODE, "DB 동기화 배포 조회", "View DB Sync Deploy", "DB sync and fresh deploy console page access"),
                    featureRequest(DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE, "DB 반영 사전 점검", "Analyze DB Sync Deploy", "Run preflight policy and diff checks"),
                    featureRequest(DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE, "DB 반영 정책 검증", "Validate DB Sync Deploy Policy", "Validate policy, execution-source, and evidence preconditions"),
                    featureRequest(DB_SYNC_DEPLOY_EXECUTE_FEATURE_CODE, "DB 동기화 배포 실행", "Execute DB Sync Deploy", "Run approved DB sync and fresh deploy"),
                    featureRequest(DB_SYNC_DEPLOY_BREAKGLASS_FEATURE_CODE, "긴급 우회 실행", "Run Breakglass DB Sync Deploy", "Execute breakglass-only DB sync and fresh deploy")));
            request.setAuthors(Arrays.asList(
                    authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master",
                            DB_SYNC_DEPLOY_VIEW_FEATURE_CODE,
                            DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_EXECUTE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_BREAKGLASS_FEATURE_CODE),
                    authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator",
                            DB_SYNC_DEPLOY_VIEW_FEATURE_CODE,
                            DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_EXECUTE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_BREAKGLASS_FEATURE_CODE),
                    authorRequest("ROLE_OPERATION_ADMIN", "운영 관리자", "Operation Administrator",
                            DB_SYNC_DEPLOY_VIEW_FEATURE_CODE,
                            DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_EXECUTE_FEATURE_CODE),
                    authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator",
                            DB_SYNC_DEPLOY_VIEW_FEATURE_CODE,
                            DB_SYNC_DEPLOY_ANALYZE_FEATURE_CODE,
                            DB_SYNC_DEPLOY_VALIDATE_FEATURE_CODE)));
        } else {
            request.setFeatures(Arrays.asList(
                    featureRequest(menu.menuCode + "_VIEW", menu.menuNameKo + " 조회", "View " + menu.menuNameEn, menu.menuNameEn + " page access")));
            request.setAuthors(Arrays.asList(
                    authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", menu.menuCode + "_VIEW"),
                    authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", menu.menuCode + "_VIEW"),
                    authorRequest("ROLE_OPERATION_ADMIN", "운영 관리자", "Operation Administrator", menu.menuCode + "_VIEW"),
                    authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", menu.menuCode + "_VIEW")));
        }
        return request;
    }

    private boolean versionManagementMenu(MenuDefinition menu) {
        return menu != null && VERSION_MANAGEMENT_MENU_CODE.equals(menu.menuCode);
    }

    private boolean dbPolicyMenu(MenuDefinition menu) {
        return menu != null && DB_POLICY_MENU_CODE.equals(menu.menuCode);
    }

    private boolean dbSyncDeployMenu(MenuDefinition menu) {
        return menu != null && DB_SYNC_DEPLOY_MENU_CODE.equals(menu.menuCode);
    }

    private CodexProvisionRequest.PageRequest pageRequest(MenuDefinition menu) {
        CodexProvisionRequest.PageRequest page = new CodexProvisionRequest.PageRequest();
        page.setDomainCode(DOMAIN_CODE);
        page.setDomainName(DOMAIN_NAME);
        page.setDomainNameEn(DOMAIN_NAME_EN);
        page.setGroupCode(GROUP_CODE);
        page.setGroupName(GROUP_NAME);
        page.setGroupNameEn(GROUP_NAME_EN);
        page.setCode(menu.menuCode);
        page.setCodeNm(menu.menuNameKo);
        page.setCodeDc(menu.menuNameEn);
        page.setMenuUrl(menu.menuUrl);
        page.setMenuIcon(menu.menuIcon);
        page.setUseAt("Y");
        return page;
    }

    private CodexProvisionRequest.FeatureRequest featureRequest(String featureCode, String nameKo, String nameEn, String description) {
        CodexProvisionRequest.FeatureRequest feature = new CodexProvisionRequest.FeatureRequest();
        feature.setMenuCode(featureCode.substring(0, 8));
        feature.setFeatureCode(featureCode);
        feature.setFeatureNm(nameKo);
        feature.setFeatureNmEn(nameEn);
        feature.setFeatureDc(description);
        feature.setUseAt("Y");
        return feature;
    }

    private CodexProvisionRequest.AuthorRequest authorRequest(String authorCode, String authorNm, String authorDc, String... featureCodes) {
        CodexProvisionRequest.AuthorRequest author = new CodexProvisionRequest.AuthorRequest();
        author.setAuthorCode(authorCode);
        author.setAuthorNm(authorNm);
        author.setAuthorDc(authorDc);
        author.setFeatureCodes(Arrays.asList(featureCodes));
        return author;
    }

    private static final class MenuDefinition {
        private final String menuCode;
        private final String menuNameKo;
        private final String menuNameEn;
        private final String menuUrl;
        private final String menuIcon;

        private MenuDefinition(String menuCode, String menuNameKo, String menuNameEn, String menuUrl, String menuIcon) {
            this.menuCode = menuCode;
            this.menuNameKo = menuNameKo;
            this.menuNameEn = menuNameEn;
            this.menuUrl = menuUrl;
            this.menuIcon = menuIcon;
        }
    }
}
