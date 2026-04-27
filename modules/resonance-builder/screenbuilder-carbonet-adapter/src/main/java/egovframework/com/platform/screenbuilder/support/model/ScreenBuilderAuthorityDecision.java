package egovframework.com.platform.screenbuilder.support.model;

public class ScreenBuilderAuthorityDecision {

    private final boolean allowed;
    private final String actionScope;
    private final String message;
    private final String reasonCode;
    private final String requiredFeatureCode;
    private final String menuCode;
    private final String menuUrl;
    private final String actorId;
    private final String actorRole;

    private ScreenBuilderAuthorityDecision(boolean allowed,
                                           String actionScope,
                                           String message,
                                           String reasonCode,
                                           String requiredFeatureCode,
                                           String menuCode,
                                           String menuUrl,
                                           String actorId,
                                           String actorRole) {
        this.allowed = allowed;
        this.actionScope = actionScope;
        this.message = message;
        this.reasonCode = reasonCode;
        this.requiredFeatureCode = requiredFeatureCode;
        this.menuCode = menuCode;
        this.menuUrl = menuUrl;
        this.actorId = actorId;
        this.actorRole = actorRole;
    }

    public static ScreenBuilderAuthorityDecision allow(String actionScope,
                                                       String requiredFeatureCode,
                                                       String menuCode,
                                                       String menuUrl,
                                                       String actorId,
                                                       String actorRole) {
        return new ScreenBuilderAuthorityDecision(
                true,
                actionScope,
                "",
                "",
                requiredFeatureCode,
                menuCode,
                menuUrl,
                actorId,
                actorRole);
    }

    public static ScreenBuilderAuthorityDecision deny(String actionScope,
                                                      String message,
                                                      String reasonCode,
                                                      String requiredFeatureCode,
                                                      String menuCode,
                                                      String menuUrl,
                                                      String actorId,
                                                      String actorRole) {
        return new ScreenBuilderAuthorityDecision(
                false,
                actionScope,
                message,
                reasonCode,
                requiredFeatureCode,
                menuCode,
                menuUrl,
                actorId,
                actorRole);
    }

    public boolean isAllowed() {
        return allowed;
    }

    public String getActionScope() {
        return actionScope;
    }

    public String getMessage() {
        return message;
    }

    public String getReasonCode() {
        return reasonCode;
    }

    public String getRequiredFeatureCode() {
        return requiredFeatureCode;
    }

    public String getMenuCode() {
        return menuCode;
    }

    public String getMenuUrl() {
        return menuUrl;
    }

    public String getActorId() {
        return actorId;
    }

    public String getActorRole() {
        return actorRole;
    }
}
