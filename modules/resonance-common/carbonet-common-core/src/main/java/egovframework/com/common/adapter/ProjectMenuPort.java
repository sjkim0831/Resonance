package egovframework.com.common.adapter;

import java.util.List;
import java.util.Map;

/**
 * Port for providing project-specific menu structures and overrides.
 * The Project Adapter implements this to inject custom menus into the common-core UI.
 */
public interface ProjectMenuPort {
    
    /**
     * @return A unique identifier for this project's menu profile.
     */
    String getProfileId();

    /**
     * @return List of custom menu items specific to this project.
     */
    List<Map<String, Object>> getCustomMenuItems();

    /**
     * Allows the project to hide or disable common-core standard menus.
     * @param standardMenuId The ID of the common menu.
     * @return true if the menu should be hidden.
     */
    boolean isMenuHidden(String standardMenuId);
}
