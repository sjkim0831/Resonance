package egovframework.com.feature.home.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmissionProjectCreationPolicyTest {
    @Test
    void acceptsCompleteSeparatedActorContract() {
        var contract = EmissionProjectCreationPolicy.validate(valid());
        assertEquals(List.of("Scope 1", "Scope 2"), contract.scopes());
        assertEquals(2026, contract.reportingYear());
        assertEquals("OPERATIONAL_CONTROL", contract.organizationBoundary());
    }

    @Test
    void rejectsMissingActorInsteadOfFallingBackToOwner() {
        var request = valid();
        request.remove("verifier");
        assertCode("PROJECT_VERIFIER_REQUIRED", request);
    }

    @Test
    void rejectsCalculatorVerifierOrApproverConflict() {
        var request = valid();
        request.put("verifier", "calculator-a");
        assertCode("PROJECT_SEGREGATION_OF_DUTIES_REQUIRED", request);
    }

    @Test
    void rejectsPeriodOutsideReportingYear() {
        var request = valid();
        request.put("periodEnd", "2027-01-01");
        assertCode("PROJECT_PERIOD_OUTSIDE_REPORTING_YEAR", request);
    }

    @Test
    void rejectsDeadlineBeforeInventoryPeriodEnds() {
        var request = valid();
        request.put("dueDate", "2026-06-01");
        assertCode("PROJECT_DUE_DATE_BEFORE_PERIOD_END", request);
    }

    @Test
    void rejectsUnsupportedMethodologyStandard() {
        var request = valid();
        request.put("emissionStandard", "UNKNOWN");
        assertCode("PROJECT_EMISSIONSTANDARD_INVALID", request);
    }

    @Test
    void rejectsMaterialityOutsidePercentRange() {
        var request = valid();
        request.put("materialityThreshold", "101");
        assertCode("PROJECT_MATERIALITY_THRESHOLD_INVALID", request);
    }

    private void assertCode(String code, Map<String, Object> request) {
        var exception = assertThrows(IllegalArgumentException.class,
                () -> EmissionProjectCreationPolicy.validate(request));
        assertEquals(code, exception.getMessage());
    }

    private Map<String, Object> valid() {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("name", "2026 inventory"); request.put("site", "Ulsan site");
        request.put("owner", "owner-a"); request.put("dataOwner", "data-a");
        request.put("calculator", "calculator-a"); request.put("verifier", "verifier-a");
        request.put("approver", "approver-a"); request.put("reportingYear", "2026");
        request.put("periodStart", "2026-01-01"); request.put("periodEnd", "2026-12-31");
        request.put("dueDate", "2027-01-31"); request.put("scopes", List.of("Scope 1", "Scope 2"));
        request.put("organizationBoundary", "OPERATIONAL_CONTROL");
        request.put("emissionStandard", "ISO_14064_1");
        request.put("methodologyVersion", "2018");
        request.put("verificationLevel", "LIMITED");
        request.put("collectionCycle", "MONTHLY");
        request.put("materialityThreshold", "5");
        return request;
    }
}
