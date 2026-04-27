package egovframework.com.common.trace;

import java.util.Locale;
import java.util.UUID;

public final class TraceIdGenerator {

    private TraceIdGenerator() {
    }

    public static String next(String prefix) {
        String base = UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return prefix + "-" + base.substring(0, 16);
    }
}
