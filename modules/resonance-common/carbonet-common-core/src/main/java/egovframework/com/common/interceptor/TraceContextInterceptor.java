package egovframework.com.common.interceptor;

import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.common.trace.TraceHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class TraceContextInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        TraceContext traceContext = TraceContextHolder.get();
        if (traceContext == null) {
            return true;
        }
        request.setAttribute("traceId", traceContext.getTraceId());
        request.setAttribute("requestId", traceContext.getRequestId());
        request.setAttribute("pageId", traceContext.getPageId());
        request.setAttribute("actionId", traceContext.getActionId());
        request.setAttribute("apiId", traceContext.getApiId());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TraceContext traceContext = TraceContextHolder.get();
        if (traceContext == null) {
            return;
        }
        response.setHeader(TraceHeaders.TRACE_ID, traceContext.getTraceId());
        response.setHeader(TraceHeaders.REQUEST_ID, traceContext.getRequestId());
    }
}
