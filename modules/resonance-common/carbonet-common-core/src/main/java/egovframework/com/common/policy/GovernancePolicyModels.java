package egovframework.com.common.policy;

import java.util.List;
import java.util.Map;

public final class GovernancePolicyModels {

    private GovernancePolicyModels() {
    }

    public enum UserKind {
        ADMIN,
        MEMBER,
        ANONYMOUS
    }

    public enum PageType {
        LIST,
        DETAIL,
        EDIT,
        CREATE,
        APPROVE,
        WORKSPACE
    }

    public enum ComponentType {
        LIST,
        FORM_FIELD,
        COMBO,
        POPUP,
        TAB,
        ACTION_BAR,
        BUTTON,
        SUMMARY
    }

    public enum TargetType {
        SELF,
        MEMBER,
        ADMIN_ACCOUNT,
        COMPANY,
        DEPARTMENT,
        ROLE,
        COMMON_CODE,
        LIST
    }

    public enum Cardinality {
        SINGLE,
        MULTI
    }

    public enum ActionType {
        VIEW,
        SEARCH,
        CREATE,
        UPDATE,
        DELETE,
        EXECUTE,
        APPROVE,
        EXPORT
    }

    public enum Visibility {
        VISIBLE,
        HIDDEN
    }

    public enum Interaction {
        ENABLED,
        DISABLED,
        READONLY
    }

    public enum Scope {
        GLOBAL,
        OWN_COMPANY,
        OWN_DEPT,
        SELF,
        TARGET_COMPANY_MATCH
    }

    public enum RoleLayer {
        BASE,
        GENERAL,
        DEPARTMENT,
        USER_OVERRIDE
    }

    public static final class ActorContext {
        private final boolean authenticated;
        private final String userId;
        private final String actualUserId;
        private final UserKind userKind;
        private final String memberType;
        private final String authorCode;
        private final String insttId;
        private final String deptId;
        private final boolean master;
        private final List<String> baseRoleCodes;
        private final List<String> generalRoleCodes;
        private final List<String> departmentRoleCodes;
        private final List<String> userOverrideFeatureCodes;

        public ActorContext(boolean authenticated, String userId, String actualUserId, UserKind userKind,
                            String memberType, String authorCode, String insttId, String deptId, boolean master,
                            List<String> baseRoleCodes, List<String> generalRoleCodes,
                            List<String> departmentRoleCodes, List<String> userOverrideFeatureCodes) {
            this.authenticated = authenticated;
            this.userId = safe(userId);
            this.actualUserId = safe(actualUserId);
            this.userKind = userKind == null ? UserKind.ANONYMOUS : userKind;
            this.memberType = safe(memberType);
            this.authorCode = safe(authorCode);
            this.insttId = safe(insttId);
            this.deptId = safe(deptId);
            this.master = master;
            this.baseRoleCodes = baseRoleCodes;
            this.generalRoleCodes = generalRoleCodes;
            this.departmentRoleCodes = departmentRoleCodes;
            this.userOverrideFeatureCodes = userOverrideFeatureCodes;
        }

        public boolean isAuthenticated() { return authenticated; }
        public String getUserId() { return userId; }
        public String getActualUserId() { return actualUserId; }
        public UserKind getUserKind() { return userKind; }
        public String getMemberType() { return memberType; }
        public String getAuthorCode() { return authorCode; }
        public String getInsttId() { return insttId; }
        public String getDeptId() { return deptId; }
        public boolean isMaster() { return master; }
        public List<String> getBaseRoleCodes() { return baseRoleCodes; }
        public List<String> getGeneralRoleCodes() { return generalRoleCodes; }
        public List<String> getDepartmentRoleCodes() { return departmentRoleCodes; }
        public List<String> getUserOverrideFeatureCodes() { return userOverrideFeatureCodes; }
    }

    public static final class PageContext {
        private final String pageId;
        private final String menuCode;
        private final String routePath;
        private final String domainCode;
        private final PageType pageType;

        public PageContext(String pageId, String menuCode, String routePath, String domainCode, PageType pageType) {
            this.pageId = safe(pageId);
            this.menuCode = safe(menuCode);
            this.routePath = safe(routePath);
            this.domainCode = safe(domainCode);
            this.pageType = pageType == null ? PageType.WORKSPACE : pageType;
        }

        public String getPageId() { return pageId; }
        public String getMenuCode() { return menuCode; }
        public String getRoutePath() { return routePath; }
        public String getDomainCode() { return domainCode; }
        public PageType getPageType() { return pageType; }
    }

    public static final class ComponentContext {
        private final String componentId;
        private final String instanceKey;
        private final ComponentType componentType;
        private final String policyKey;
        private final String dataSourceKey;
        private final String designVariantId;
        private final String helpId;

        public ComponentContext(String componentId, String instanceKey, ComponentType componentType, String policyKey,
                                String dataSourceKey, String designVariantId, String helpId) {
            this.componentId = safe(componentId);
            this.instanceKey = safe(instanceKey);
            this.componentType = componentType == null ? ComponentType.SUMMARY : componentType;
            this.policyKey = safe(policyKey);
            this.dataSourceKey = safe(dataSourceKey);
            this.designVariantId = safe(designVariantId);
            this.helpId = safe(helpId);
        }

        public String getComponentId() { return componentId; }
        public String getInstanceKey() { return instanceKey; }
        public ComponentType getComponentType() { return componentType; }
        public String getPolicyKey() { return policyKey; }
        public String getDataSourceKey() { return dataSourceKey; }
        public String getDesignVariantId() { return designVariantId; }
        public String getHelpId() { return helpId; }
    }

    public static final class ComponentRule {
        private final boolean allowAllScope;
        private final boolean requireActorInsttId;
        private final List<String> allowedActorKinds;
        private final List<String> allowedMemberTypes;
        private final boolean enforceOwnCompanyScope;
        private final boolean enforceTargetCompanyMatch;
        private final boolean restrictTargetCompanyOutput;
        private final List<String> requiredFeatureCodes;

        public ComponentRule(
                boolean allowAllScope,
                boolean requireActorInsttId,
                List<String> allowedActorKinds,
                List<String> allowedMemberTypes,
                boolean enforceOwnCompanyScope,
                boolean enforceTargetCompanyMatch,
                boolean restrictTargetCompanyOutput,
                List<String> requiredFeatureCodes) {
            this.allowAllScope = allowAllScope;
            this.requireActorInsttId = requireActorInsttId;
            this.allowedActorKinds = allowedActorKinds;
            this.allowedMemberTypes = allowedMemberTypes;
            this.enforceOwnCompanyScope = enforceOwnCompanyScope;
            this.enforceTargetCompanyMatch = enforceTargetCompanyMatch;
            this.restrictTargetCompanyOutput = restrictTargetCompanyOutput;
            this.requiredFeatureCodes = requiredFeatureCodes;
        }

        public boolean isAllowAllScope() { return allowAllScope; }
        public boolean isRequireActorInsttId() { return requireActorInsttId; }
        public List<String> getAllowedActorKinds() { return allowedActorKinds; }
        public List<String> getAllowedMemberTypes() { return allowedMemberTypes; }
        public boolean isEnforceOwnCompanyScope() { return enforceOwnCompanyScope; }
        public boolean isEnforceTargetCompanyMatch() { return enforceTargetCompanyMatch; }
        public boolean isRestrictTargetCompanyOutput() { return restrictTargetCompanyOutput; }
        public List<String> getRequiredFeatureCodes() { return requiredFeatureCodes; }
    }

    public static final class TargetContext {
        private final TargetType targetType;
        private final Cardinality cardinality;
        private final String targetId;
        private final String targetInsttId;
        private final String targetDeptId;
        private final String targetMemberType;
        private final String targetState;

        public TargetContext(TargetType targetType, Cardinality cardinality, String targetId, String targetInsttId,
                             String targetDeptId, String targetMemberType, String targetState) {
            this.targetType = targetType == null ? TargetType.LIST : targetType;
            this.cardinality = cardinality == null ? Cardinality.SINGLE : cardinality;
            this.targetId = safe(targetId);
            this.targetInsttId = safe(targetInsttId);
            this.targetDeptId = safe(targetDeptId);
            this.targetMemberType = safe(targetMemberType);
            this.targetState = safe(targetState);
        }

        public TargetType getTargetType() { return targetType; }
        public Cardinality getCardinality() { return cardinality; }
        public String getTargetId() { return targetId; }
        public String getTargetInsttId() { return targetInsttId; }
        public String getTargetDeptId() { return targetDeptId; }
        public String getTargetMemberType() { return targetMemberType; }
        public String getTargetState() { return targetState; }
    }

    public static final class RuntimeContext {
        private final String requestedInsttId;
        private final String requestedDeptId;
        private final String requestedMemberType;
        private final String requestedStatus;
        private final String searchKeyword;
        private final List<String> selectedIds;
        private final Map<String, Object> queryParams;

        public RuntimeContext(String requestedInsttId, String requestedDeptId, String requestedMemberType,
                              String requestedStatus, String searchKeyword, List<String> selectedIds,
                              Map<String, Object> queryParams) {
            this.requestedInsttId = safe(requestedInsttId);
            this.requestedDeptId = safe(requestedDeptId);
            this.requestedMemberType = safe(requestedMemberType);
            this.requestedStatus = safe(requestedStatus);
            this.searchKeyword = safe(searchKeyword);
            this.selectedIds = selectedIds;
            this.queryParams = queryParams;
        }

        public String getRequestedInsttId() { return requestedInsttId; }
        public String getRequestedDeptId() { return requestedDeptId; }
        public String getRequestedMemberType() { return requestedMemberType; }
        public String getRequestedStatus() { return requestedStatus; }
        public String getSearchKeyword() { return searchKeyword; }
        public List<String> getSelectedIds() { return selectedIds; }
        public Map<String, Object> getQueryParams() { return queryParams; }
    }

    public static final class Decision {
        private final boolean allowed;
        private final Visibility visibility;
        private final Interaction interaction;
        private final Scope scope;
        private final String resolvedInsttId;
        private final String resolvedDeptId;
        private final List<String> resolvedMemberTypes;
        private final List<String> requiredFeatureCodes;
        private final List<RoleLayer> contributingRoleLayers;
        private final List<String> reasonCodes;

        public Decision(boolean allowed, Visibility visibility, Interaction interaction, Scope scope,
                        String resolvedInsttId, String resolvedDeptId, List<String> resolvedMemberTypes,
                        List<String> requiredFeatureCodes, List<RoleLayer> contributingRoleLayers, List<String> reasonCodes) {
            this.allowed = allowed;
            this.visibility = visibility == null ? Visibility.HIDDEN : visibility;
            this.interaction = interaction == null ? Interaction.DISABLED : interaction;
            this.scope = scope == null ? Scope.SELF : scope;
            this.resolvedInsttId = safe(resolvedInsttId);
            this.resolvedDeptId = safe(resolvedDeptId);
            this.resolvedMemberTypes = resolvedMemberTypes;
            this.requiredFeatureCodes = requiredFeatureCodes;
            this.contributingRoleLayers = contributingRoleLayers;
            this.reasonCodes = reasonCodes;
        }

        public boolean isAllowed() { return allowed; }
        public Visibility getVisibility() { return visibility; }
        public Interaction getInteraction() { return interaction; }
        public Scope getScope() { return scope; }
        public String getResolvedInsttId() { return resolvedInsttId; }
        public String getResolvedDeptId() { return resolvedDeptId; }
        public List<String> getResolvedMemberTypes() { return resolvedMemberTypes; }
        public List<String> getRequiredFeatureCodes() { return requiredFeatureCodes; }
        public List<RoleLayer> getContributingRoleLayers() { return contributingRoleLayers; }
        public List<String> getReasonCodes() { return reasonCodes; }
    }

    public static final class DecisionRequest {
        private final ActorContext actor;
        private final PageContext page;
        private final ComponentContext component;
        private final ComponentRule rule;
        private final TargetContext target;
        private final ActionType actionType;
        private final RuntimeContext runtime;

        public DecisionRequest(ActorContext actor, PageContext page, ComponentContext component, ComponentRule rule,
                               TargetContext target, ActionType actionType, RuntimeContext runtime) {
            this.actor = actor;
            this.page = page;
            this.component = component;
            this.rule = rule;
            this.target = target;
            this.actionType = actionType == null ? ActionType.VIEW : actionType;
            this.runtime = runtime;
        }

        public ActorContext getActor() { return actor; }
        public PageContext getPage() { return page; }
        public ComponentContext getComponent() { return component; }
        public ComponentRule getRule() { return rule; }
        public TargetContext getTarget() { return target; }
        public ActionType getActionType() { return actionType; }
        public RuntimeContext getRuntime() { return runtime; }
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
