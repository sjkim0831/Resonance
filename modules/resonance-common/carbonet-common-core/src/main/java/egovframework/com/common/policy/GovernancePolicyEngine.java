package egovframework.com.common.policy;

public interface GovernancePolicyEngine {

    GovernancePolicyModels.Decision evaluate(GovernancePolicyModels.DecisionRequest request);
}
