package egovframework.com.projects.p003;

import egovframework.com.common.adapter.ProjectMenuPort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Custom Menu bindings injected specifically when P003 is booting.
 */
@Component
public class P003MenuAdapter implements ProjectMenuPort {

    @Override
    public String getProfileId() {
        return "p003-admin-v1";
    }

    @Override
    public List<Map<String, Object>> getCustomMenuItems() {
        List<Map<String, Object>> customMenus = new ArrayList<>();
        
        Map<String, Object> customItem1 = new HashMap<>();
        customItem1.put("menuId", "p003.special-report");
        customItem1.put("menuName", "P003 특화 리포트");
        customItem1.put("menuUrl", "/admin/p003/report");
        customItem1.put("parentId", "ROOT");
        
        customMenus.add(customItem1);
        return customMenus;
    }

    @Override
    public boolean isMenuHidden(String standardMenuId) {
        // Hide the standard common-payment menu for this project
        return "menu.payment.management".equals(standardMenuId);
    }
}
