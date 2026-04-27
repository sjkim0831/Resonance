package egovframework.com.common.adapter;

/**
 * Port for project-specific authorization and access control logic.
 * Overrides or extends the common-auth baseline.
 */
public interface ProjectAuthorityPort {

    /**
     * Checks if the given user has access to a specific project feature.
     * @param userId The ID of the current user.
     * @param featureCode The feature being accessed.
     * @return true if access is granted.
     */
    boolean hasFeatureAccess(String userId, String featureCode);

    /**
     * @return The default role ID assigned to new users in this project.
     */
    String getDefaultProjectRole();
}
