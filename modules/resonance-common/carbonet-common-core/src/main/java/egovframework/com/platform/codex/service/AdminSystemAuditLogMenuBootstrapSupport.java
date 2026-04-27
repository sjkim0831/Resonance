package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSystemAuditLogMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00603";
    private static final String GROUP_NAME = "로그";
    private static final String GROUP_NAME_EN = "Logs";
    private static final String MENU_CODE = "A0060303";
    private static final String MENU_NAME_KO = "감사 로그";
    private static final String MENU_NAME_EN = "System Audit Log";
    private static final String MENU_URL = "/admin/system/observability";
    private static final String MENU_ICON = "receipt_long";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";
    private static final String LEGACY_MENU_CODE = "A1900105";

    private final PlatformMenuProvisionSupport platformMenuProvisionSupport;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureSystemAuditLogMenu() {
        platformMenuProvisionSupport.provisionAdminMenu(
                "System audit log menu",
                buildRequest(),
                MENU_CODE,
                MENU_NAME_KO,
                MENU_NAME_EN,
                MENU_URL,
                MENU_ICON,
                ACTOR_ID,
                this::hideLegacyMenu);
    }

    private void hideLegacyMenu(AdminCodeManageService adminCodeManageService) {
        try {
            adminCodeManageService.updatePageManagement(
                    LEGACY_MENU_CODE,
                    "감사 로그(레거시)",
                    "Legacy Audit Log",
                    "/admin/system/observability",
                    "monitoring",
                    "N",
                    ACTOR_ID
            );
        } catch (Exception e) {
            log.warn("Failed to hide legacy observability menu. menuCode={}", LEGACY_MENU_CODE, e);
        }
    }

    private CodexProvisionRequest buildRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-SYSTEM-AUDIT-LOG",
                ACTOR_ID,
                MENU_URL,
                PlatformMenuProvisionSupport.pageRequest(
                        DOMAIN_CODE,
                        DOMAIN_NAME,
                        DOMAIN_NAME_EN,
                        GROUP_CODE,
                        GROUP_NAME,
                        GROUP_NAME_EN,
                        MENU_CODE,
                        MENU_NAME_KO,
                        MENU_NAME_EN,
                        MENU_URL,
                        MENU_ICON
                ),
                new CodexProvisionRequest.FeatureRequest[]{
                        PlatformMenuProvisionSupport.featureRequest(
                                MENU_CODE,
                                MENU_CODE + "_VIEW",
                                "감사 로그 조회",
                                "View System Audit Log",
                                "System audit log page access")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", MENU_CODE + "_VIEW"),
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", MENU_CODE + "_VIEW")
                }
        );
    }
}
