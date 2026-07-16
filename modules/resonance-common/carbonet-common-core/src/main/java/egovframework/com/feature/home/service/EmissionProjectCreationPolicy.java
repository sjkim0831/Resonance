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
                reportingYear, periodStart, periodEnd, dueDate, List.copyOf(scopes));
    }

    private static String required(Map<String, Object> body, String key, int maxLength) {
        String value = body.get(key) == null ? "" : String.valueOf(body.get(key)).trim();
        if (value.isEmpty()) throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_REQUIRED");
        if (value.length() > maxLength) throw new IllegalArgumentException("PROJECT_" + key.toUpperCase() + "_TOO_LONG");
        return value;
    }

    private static int integer(Map<String, Object> body, String key, int minimum, int maximum) {
        try {
            int value = Integer.parseInt(required(body, key, 4));
            if (value < minimum || value > maximum) throw new IllegalArgumentException("PROJECT_REPORTING_YEAR_INVALID");
            return value;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("PROJECT_REPORTING_YEAR_INVALID");
        }
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
                    LocalDate periodEnd, LocalDate dueDate, List<String> scopes) {}
}
