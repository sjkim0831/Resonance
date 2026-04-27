package egovframework.com.common.filter;

import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.common.trace.TraceEventService;
import egovframework.com.common.trace.TraceHeaders;
import egovframework.com.common.trace.TraceIdGenerator;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

public class TraceContextFilter extends OncePerRequestFilter {

    private final TraceEventService traceEventService;

    public TraceContextFilter(TraceEventService traceEventService) {
        this.traceEventService = traceEventService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startedAt = System.currentTimeMillis();
        TraceContext traceContext = TraceContext.builder()
                .traceId(resolveOrGenerate(request.getHeader(TraceHeaders.TRACE_ID), "TR"))
                .requestId(resolveOrGenerate(request.getHeader(TraceHeaders.REQUEST_ID), "REQ"))
                .pageId(request.getHeader(TraceHeaders.PAGE_ID))
                .actionId(request.getHeader(TraceHeaders.ACTION_ID))
                .apiId(request.getHeader(TraceHeaders.API_ID))
                .requestUri(request.getRequestURI())
                .httpMethod(request.getMethod())
                .build();
        TraceContextHolder.set(traceContext);
        try {
            response.setHeader(TraceHeaders.TRACE_ID, traceContext.getTraceId());
            response.setHeader(TraceHeaders.REQUEST_ID, traceContext.getRequestId());
            filterChain.doFilter(request, response);
            traceEventService.recordRequestEvent(traceContext,
                    response.getStatus() >= 200 && response.getStatus() < 400 ? "SUCCESS" : "HTTP_ERROR",
                    (int) Math.max(System.currentTimeMillis() - startedAt, 0),
                    response.getStatus());
        } finally {
            TraceContextHolder.clear();
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI() == null ? "" : request.getRequestURI().trim().toLowerCase();
        return path.isEmpty()
                || path.startsWith("/css/")
                || path.startsWith("/js/")
                || path.startsWith("/images/")
                || path.startsWith("/webjars/")
                || path.startsWith("/error")
                || path.startsWith("/actuator")
                || path.matches(".*\\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|eot|ico|html)$");
    }

    private String resolveOrGenerate(String value, String prefix) {
        if (StringUtils.hasText(value)) {
            return value.trim();
        }
        return TraceIdGenerator.next(prefix);
    }
}
