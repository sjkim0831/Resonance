package egovframework.com.platform.codex.service;

import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminAssetInventoryMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00601";
    private static final String GROUP_NAME = "환경";
    private static final String GROUP_NAME_EN = "Environment";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final PlatformMenuProvisionSupport platformMenuProvisionSupport;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureAssetManagementMenus() {
        provisionMenu("A0060123", "자산 인벤토리", "Asset Inventory", "/admin/system/asset-inventory", "inventory_2");
        provisionMenu("A0060124", "자산 상세", "Asset Detail", "/admin/system/asset-detail", "info");
        provisionMenu("A0060125", "자산 영향도", "Asset Impact", "/admin/system/asset-impact", "query_stats");
        provisionMenu("A0060126", "자산 생명주기", "Asset Lifecycle", "/admin/system/asset-lifecycle", "published_with_changes");
        provisionMenu("A0060127", "자산 미흡 큐", "Asset Gap", "/admin/system/asset-gap", "running_with_errors");
    }

    private void provisionMenu(String menuCode, String nameKo, String nameEn, String url, String icon) {
        platformMenuProvisionSupport.provisionAdminMenu(
                nameEn + " menu",
                buildRequest(menuCode, nameKo, nameEn, url, icon),
                menuCode,
                nameKo,
                nameEn,
                url,
                icon,
                ACTOR_ID);
    }

    private CodexProvisionRequest buildRequest(String menuCode, String nameKo, String nameEn, String url, String icon) {
        return PlatformMenuProvisionSupport.adminMenuRequest(
                "BOOTSTRAP-" + menuCode,
                ACTOR_ID,
                url,
                PlatformMenuProvisionSupport.pageRequest(
                        DOMAIN_CODE,
                        DOMAIN_NAME,
                        DOMAIN_NAME_EN,
                        GROUP_CODE,
                        GROUP_NAME,
                        GROUP_NAME_EN,
                        menuCode,
                        nameKo,
                        nameEn,
                        url,
                        icon
                ),
                new CodexProvisionRequest.FeatureRequest[]{
                        PlatformMenuProvisionSupport.featureRequest(
                                menuCode,
                                menuCode + "_VIEW",
                                nameKo + " 조회",
                                "View " + nameEn,
                                nameEn + " page access")
                },
                new CodexProvisionRequest.AuthorRequest[]{
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_MASTER", "시스템 마스터", "System Master", menuCode + "_VIEW"),
                        PlatformMenuProvisionSupport.authorRequest("ROLE_SYSTEM_ADMIN", "시스템 관리자", "System Administrator", menuCode + "_VIEW"),
                        PlatformMenuProvisionSupport.authorRequest("ROLE_ADMIN", "일반 관리자", "General Administrator", menuCode + "_VIEW")
                }
        );
    }
}
