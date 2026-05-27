package egovframework.com.platform.codex.service;

import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminPlatformFoundationMenuBootstrapSupport {

    private static final String DOMAIN_CODE = "A006";
    private static final String DOMAIN_NAME = "시스템";
    private static final String DOMAIN_NAME_EN = "System";
    private static final String GROUP_CODE = "A00601";
    private static final String GROUP_NAME = "환경";
    private static final String GROUP_NAME_EN = "Environment";
    private static final String ACTOR_ID = "SYSTEM_BOOTSTRAP";

    private final PlatformMenuProvisionSupport platformMenuProvisionSupport;

    @EventListener(ApplicationReadyEvent.class)
    public void ensurePlatformFoundationMenus() {
        provisionMenu("A0060108", "풀스택 관리", "Full Stack Management", "/admin/system/full-stack-management", "hub");
        provisionMenu("A0060109", "플랫폼 스튜디오", "Platform Studio", "/admin/system/platform-studio", "dashboard_customize");
        provisionMenu("A0060110", "화면 요소 관리", "Screen Elements Management", "/admin/system/screen-elements-management", "crop_landscape");
        provisionMenu("A0060111", "이벤트 관리", "Event Management", "/admin/system/event-management", "bolt");
        provisionMenu("A0060112", "함수 콘솔", "Function Console", "/admin/system/function-console", "functions");
        provisionMenu("A0060113", "API 관리", "API Management", "/admin/system/api-management", "api");
        provisionMenu("A0060114", "컨트롤러 관리", "Controller Management", "/admin/system/controller-management", "account_tree");
        provisionMenu("A0060115", "DB 테이블 관리", "DB Table Management", "/admin/system/db-table-management", "database");
        provisionMenu("A0060116", "컬럼 관리", "Column Management", "/admin/system/column-management", "view_column");
        provisionMenu("A0060117", "자동화 스튜디오", "Automation Studio", "/admin/system/automation-studio", "smart_toy");
        provisionMenu("A0060130", "테마 관리", "Theme Management", "/admin/system/theme", "palette");
        provisionMenu("A0060131", "모듈 관리", "Module Management", "/admin/system/module", "view_module");
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
