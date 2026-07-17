package egovframework.com.feature.home.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Server-side contract for starting a professional emission workflow. */
final class EmissionProjectCreationPolicy {
    private static final Set<String> ALLOWED_SCOPES = Set.of("Scope 1", "Scope 2", "Scope 3");
    private static final Set<String> ALLOWED_BOUNDARIES = Set.of("OPERATIONAL_CONTROL", "FINANCIAL_CONTROL", "EQUITY_SHARE");
    private static final Set<String> ALLOWED_STANDARDS = Set.of("ISO_14064_1", "GHG_PROTOCOL", "K_ETS");
    private static final Set<String> ALLOWED_VERIFICATION_LEVELS = Set.of("LIMITED", "REASONABLE");
    private static final Set<String> ALLOWED_COLLECTION_CYCLES = Set.of("MONTHLY", "QUARTERLY", "ANNUAL");

    private EmissionProjectCreationPolicy() {}

    static Contract validate(Map<String, Object> body) {
        String name = required(body, "name", 240);
        String site = required(body, "site", 160);
        String owner = required(body, "owner", 100);
        String dataOwner = required(body, "dataOwner", 100);
        String calculator = required(body, "calculator", 100);
        String verifier = required(body, "verifier", 100);
        String approver = required(body, "approver", 100);
        int reportingYear = integer(body, "reportingYear", 2000, 2100);
        LocalDate periodStart = date(body, "periodStart");
        LocalDate periodEnd = date(body, "periodEnd");
        LocalDate dueDate = date(body, "dueDate");
        String organizationBoundary = allowed(body, "organizationBoundary", ALLOWED_BOUNDARIES);
        String emissionStandard = allowed(body, "emissionStandard", ALLOWED_STANDARDS);
        String methodologyVersion = required(body, "methodologyVersion", 40);
        String verificationLevel = allowed(body, "verificationLevel", ALLOWED_VERIFICATION_LEVELS);
        String collectionCycle = allowed(body, "collectionCycle", ALLOWED_COLLECTION_CYCLES);
        int materialityThreshold = integer(body, "materialityThreshold", 0, 100,
                "PROJECT_MATERIALITY_THRESHOLD_INVALID");

        if (periodEnd.isBefore(periodStart)) throw new IllegalArgumentException("PROJECT_PERIOD_END_BEFORE_START");
        if (periodStart.getYear() != reportingYear || periodEnd.getYear() != reportingYear) {
            throw new IllegalArgumentException("PROJECT_PERIOD_OUTSIDE_REPORTING_YEAR");
        }
        if (dueDate.isBefore(periodEnd)) throw new IllegalArgumentException("PROJECT_DUE_DATE_BEFORE_PERIOD_END");
        if (same(calculator, verifier) || same(calculator, approver) || same(verifier, approver)) {
            throw new IllegalArgumentException("PROJECT_SEGREGATION_OF_DUTIES_REQUIRED");
        }

        Object rawScopes = body.get("scopes");
        if (!(rawScopes instanceof List<?> values) || values.isEmpty()) {
            throw new IllegalArgumentException("PROJECT_SCOPE_REQUIRED");
        }
        LinkedHashSet<String> scopes = new LinkedHashSet<>();
        for (Object value : values) {
            String scope = String.valueOf(value).trim();
            if (!ALLOWED_SCOPES.contains(scope)) throw new IllegalArgumentException("PROJECT_SCOPE_INVALID");
            scopes.add(scope);
        }
        if (scopes.isEmpty()) throw new IllegalArgumentException("PROJECT_SCOPE_REQUIRED");
        return new Contract(name, site, owner, dataOwner, calculator, verifier, approver,
                reportingYear, periodStart, periodEnd, dueDate, List.copyOf(scopes),
                organizationBoundary, emissionStandard, methodologyVersion, verificationLevel,
                collectionCycle, materialityThreshold);
    }

    private static String required(Map<String, Object> body, String key, int maxLength) {
        String value = body.get(key) == null ? "" : String.valueOf(body.get(key)).trim();
        if (value.isEmpty()) throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_REQUIRED");
        if (value.length() > maxLength) throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_TOO_LONG");
        return value;
    }

    private static int integer(Map<String, Object> body, String key, int minimum, int maximum) {
        return integer(body, key, minimum, maximum, "PROJECT_REPORTING_YEAR_INVALID");
    }

    private static int integer(Map<String, Object> body, String key, int minimum, int maximum, String errorCode) {
        try {
            int value = Integer.parseInt(required(body, key, 4));
            if (value < minimum || value > maximum) throw new IllegalArgumentException(errorCode);
            return value;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private static String allowed(Map<String, Object> body, String key, Set<String> allowed) {
        String value = required(body, key, 40);
        if (!allowed.contains(value)) throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_INVALID");
        return value;
    }

    private static LocalDate date(Map<String, Object> body, String key) {
        try {
            return LocalDate.parse(required(body, key, 10));
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_INVALID");
        }
    }

    private static boolean same(String left, String right) {
        return left.equalsIgnoreCase(right);
    }

    record Contract(String name, String site, String owner, String dataOwner, String calculator,
                    String verifier, String approver, int reportingYear, LocalDate periodStart,
                    LocalDate periodEnd, LocalDate dueDate, List<String> scopes,
                    String organizationBoundary, String emissionStandard, String methodologyVersion,
                    String verificationLevel, String collectionCycle, int materialityThreshold) {}
}
