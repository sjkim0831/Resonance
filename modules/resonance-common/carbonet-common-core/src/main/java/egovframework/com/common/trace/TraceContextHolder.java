package egovframework.com.common.trace;

public final class TraceContextHolder {

    private static final ThreadLocal<TraceContext> HOLDER = new ThreadLocal<>();

    private TraceContextHolder() {
    }

    public static void set(TraceContext traceContext) {
        HOLDER.set(traceContext);
    }

    public static TraceContext get() {
        return HOLDER.get();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
