package egovframework.com.platform.executiongate.template;

public final class GateActionNamingRules {

    private GateActionNamingRules() {
    }

    public static String actionKey(String surface, String module, String resource, String verb) {
        return join(surface, module, resource, verb);
    }

    public static String actionPrefix(String surface, String module) {
        return join(surface, module);
    }

    private static String join(String... parts) {
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            String normalized = normalize(part);
            if (normalized == null) {
                continue;
            }
            if (!builder.isEmpty()) {
                builder.append('.');
            }
            builder.append(normalized);
        }
        return builder.toString();
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim().toLowerCase().replace('_', '-');
        return trimmed.isEmpty() ? null : trimmed;
    }
}
