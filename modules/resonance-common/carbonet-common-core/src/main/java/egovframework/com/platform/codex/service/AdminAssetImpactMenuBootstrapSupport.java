package egovframework.com.platform.codex.service;

import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminAssetImpactMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00601";
    private static final String GROUP_NAME = "환경";
    private static final String GROUP_NAME_EN = "Environment";
    private static final String MENU_CODE = "A0060125";
    private static final String MENU_NAME_KO = "자산 영향도";
    private static final String MENU_NAME_EN = "Asset Impact";
    private static final String MENU_URL = "/admin/system/asset-impact";
    private static final String MENU_ICON = "rule";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final PlatformMenuProvisionSupport platformMenuProvisionSupport;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureAssetImpactMenu() {
        platformMenuProvisionSupport.provisionAdminMenu(
                "Asset impact menu",
                buildRequest(),
                MENU_CODE,
                MENU_NAME_KO,
                MENU_NAME_EN,
                MENU_URL,
                MENU_ICON,
                ACTOR_ID);
    }

    private CodexProvisionRequest buildRequest() {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-ASSET-IMPACT",
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
                                MENU_NAME_KO + " 조회",
                                "View Asset Impact",
                                "System asset impact page access")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", MENU_CODE + "_VIEW"),
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", MENU_CODE + "_VIEW"),
                        PlatformMenuProvisionSupport.authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", MENU_CODE + "_VIEW")
                }
        );
    }
}
