package egovframework.com.common.policy;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
public class DefaultGovernancePolicyEngine implements GovernancePolicyEngine {

    @Override
    public GovernancePolicyModels.Decision evaluate(GovernancePolicyModels.DecisionRequest request) {
        if (request == null || request.getActor() == null) {
            return deny("ACTOR_REQUIRED");
        }
        GovernancePolicyModels.ActorContext actor = request.getActor();
        GovernancePolicyModels.TargetContext target = request.getTarget();
        GovernancePolicyModels.RuntimeContext runtime = request.getRuntime();
        GovernancePolicyModels.ComponentRule rule = request.getRule() == null
                ? new GovernancePolicyModels.ComponentRule(false, true, Collections.emptyList(), Collections.emptyList(), true, false, false, Collections.emptyList())
                : request.getRule();

        if (!rule.getAllowedActorKinds().isEmpty()
                && !rule.getAllowedActorKinds().contains(actor.getUserKind().name())) {
            return deny("ACTOR_KIND_NOT_ALLOWED");
        }
        if (!rule.getAllowedMemberTypes().isEmpty()
                && !actor.isMaster()
                && !rule.getAllowedMemberTypes().contains(safe(actor.getMemberType()).toUpperCase(Locale.ROOT))) {
            return deny("ACTOR_MEMBER_TYPE_NOT_ALLOWED");
        }
        if (rule.isRequireActorInsttId() && !actor.isMaster() && safe(actor.getInsttId()).isEmpty()) {
            return deny("ACTOR_INSTT_ID_REQUIRED");
        }
        if (rule.isEnforceTargetCompanyMatch()
                && !actor.isMaster()
                && !safe(target == null ? null : target.getTargetInsttId()).isEmpty()
                && !safe(actor.getInsttId()).isEmpty()
                && !safe(target.getTargetInsttId()).equals(safe(actor.getInsttId()))) {
            return deny("TARGET_COMPANY_MISMATCH");
        }

        String resolvedInsttId = actor.isMaster()
                ? firstNonBlank(runtime == null ? null : runtime.getRequestedInsttId(), target == null ? null : target.getTargetInsttId())
                : safe(actor.getInsttId());
        if (rule.isEnforceOwnCompanyScope() && !actor.isMaster() && resolvedInsttId.isEmpty()) {
            return deny("SCOPED_INSTT_ID_REQUIRED");
        }
        if (rule.isRestrictTargetCompanyOutput()
                && !actor.isMaster()
                && !safe(target == null ? null : target.getTargetInsttId()).isEmpty()
                && !resolvedInsttId.isEmpty()
                && !safe(target.getTargetInsttId()).equals(resolvedInsttId)) {
            return deny("TARGET_OUTPUT_COMPANY_NOT_VISIBLE");
        }

        List<String> resolvedMemberTypes = new ArrayList<>();
        if (!rule.getAllowedMemberTypes().isEmpty()) {
            resolvedMemberTypes.addAll(rule.getAllowedMemberTypes());
        } else if (!safe(actor.getMemberType()).isEmpty()) {
            resolvedMemberTypes.add(safe(actor.getMemberType()).toUpperCase(Locale.ROOT));
        }

        List<String> reasons = new ArrayList<>();
        reasons.add(actor.isMaster() || rule.isAllowAllScope() ? "GLOBAL_ALLOWED" : "OWN_COMPANY_SCOPED");
        return new GovernancePolicyModels.Decision(
                true,
                GovernancePolicyModels.Visibility.VISIBLE,
                GovernancePolicyModels.Interaction.ENABLED,
                actor.isMaster() || rule.isAllowAllScope()
                        ? GovernancePolicyModels.Scope.GLOBAL
                        : GovernancePolicyModels.Scope.OWN_COMPANY,
                resolvedInsttId,
                "",
                resolvedMemberTypes,
                rule.getRequiredFeatureCodes(),
                Collections.emptyList(),
                reasons);
    }

    private GovernancePolicyModels.Decision deny(String reasonCode) {
        return new GovernancePolicyModels.Decision(
                false,
                GovernancePolicyModels.Visibility.HIDDEN,
                GovernancePolicyModels.Interaction.DISABLED,
                GovernancePolicyModels.Scope.SELF,
                "",
                "",
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.emptyList(),
                Collections.singletonList(reasonCode));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String normalized = safe(value);
            if (!normalized.isEmpty()) {
                return normalized;
            }
        }
        return "";
    }
}
