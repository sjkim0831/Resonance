package egovframework.com.common.adapter;

import java.util.List;
import java.util.Map;

/**
 * Common contract for project-specific menu structures and overrides.
 *
 * Project adapter JARs implement this port; Resonance common/runtime modules
 * consume only this contract so project code stays outside the common layer.
 */
public interface ProjectMenuPort {

    String getProfileId();

    List<Map<String, Object>> getCustomMenuItems();

    boolean isMenuHidden(String standardMenuId);
}
