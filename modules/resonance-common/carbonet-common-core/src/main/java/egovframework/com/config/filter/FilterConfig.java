package egovframework.com.config.filter;

import egovframework.com.common.filter.HtmlTagFilter;
import egovframework.com.common.filter.MaintenanceModeFilter;
import egovframework.com.common.filter.PublicLogoutFilter;
import egovframework.com.common.filter.RequestExecutionLoggingFilter;
import egovframework.com.common.filter.TraceContextFilter;
import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.logging.AccessEventService;
import egovframework.com.common.logging.RequestExecutionLogService;
import egovframework.com.common.service.MaintenanceModeService;
import egovframework.com.common.trace.TraceEventService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@RequiredArgsConstructor
public class FilterConfig {

    private final RequestExecutionLogService requestExecutionLogService;
    private final AccessEventService accessEventService;
    private final TraceEventService traceEventService;
    private final MaintenanceModeService maintenanceModeService;
    private final AuditTrailService auditTrailService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final ProjectRuntimeContext projectRuntimeContext;

    @Bean
    public FilterRegistrationBean<PublicLogoutFilter> publicLogoutFilter() {
        FilterRegistrationBean<PublicLogoutFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new PublicLogoutFilter());
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registrationBean;
    }

    @Bean
    public FilterRegistrationBean<HtmlTagFilter> egovHtmlTagFilter() {
        FilterRegistrationBean<HtmlTagFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new HtmlTagFilter());
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(1);
        return registrationBean;
    }

    @Bean
    public FilterRegistrationBean<TraceContextFilter> traceContextFilter() {
        FilterRegistrationBean<TraceContextFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new TraceContextFilter(traceEventService));
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(2);
        return registrationBean;
    }

    @Bean
    public FilterRegistrationBean<RequestExecutionLoggingFilter> requestExecutionLoggingFilter() {
        FilterRegistrationBean<RequestExecutionLoggingFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new RequestExecutionLoggingFilter(
                requestExecutionLogService,
                accessEventService,
                auditTrailService,
                jwtTokenProvider,
                authGroupManageService,
                employeeMemberRepository,
                enterpriseMemberRepository,
                projectRuntimeContext
        ));
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(3);
        return registrationBean;
    }

    @Bean
    public FilterRegistrationBean<MaintenanceModeFilter> maintenanceModeFilter() {
        FilterRegistrationBean<MaintenanceModeFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new MaintenanceModeFilter(maintenanceModeService));
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(4);
        return registrationBean;
    }
}
