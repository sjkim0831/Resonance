package egovframework.com.config.security;

import lombok.extern.slf4j.Slf4j;
import org.egovframe.boot.security.EgovSecurityProperties;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;

import jakarta.servlet.http.HttpServletRequest;

@Slf4j
public class CarbonetAdminAwareLoginUrlAuthenticationEntryPoint extends LoginUrlAuthenticationEntryPoint {

    private static final String ADMIN_LOGIN_URL = "/admin/login/loginView";
    private static final String EN_ADMIN_LOGIN_URL = "/en/admin/login/loginView";
    private static final String EN_SIGNIN_LOGIN_URL = "/en/signin/loginView";

    private final String defaultLoginUrl;

    public CarbonetAdminAwareLoginUrlAuthenticationEntryPoint(EgovSecurityProperties properties) {
        this(properties == null ? "" : properties.getLoginUrl());
    }

    public CarbonetAdminAwareLoginUrlAuthenticationEntryPoint(String defaultLoginUrl) {
        super(defaultLoginUrl);
        this.defaultLoginUrl = safe(defaultLoginUrl);
    }

    @Override
    protected String determineUrlToUseForThisRequest(HttpServletRequest request,
                                                     jakarta.servlet.http.HttpServletResponse response,
                                                     org.springframework.security.core.AuthenticationException exception) {
        String uri = safe(request == null ? null : request.getRequestURI());
        String target;
        if (uri.startsWith("/en/admin")) {
            target = EN_ADMIN_LOGIN_URL;
        } else if (uri.startsWith("/admin")) {
            target = ADMIN_LOGIN_URL;
        } else if (uri.startsWith("/en/")) {
            target = EN_SIGNIN_LOGIN_URL;
        } else {
            target = defaultLoginUrl;
        }
        log.warn("security.authentication-entry-point uri={} method={} target={} session={} requestedWith={} accept={} referer={} exception={}: {}",
                uri,
                safe(request == null ? null : request.getMethod()),
                target,
                safe(request == null || request.getSession(false) == null ? null : request.getSession(false).getId()),
                safe(request == null ? null : request.getHeader("X-Requested-With")),
                safe(request == null ? null : request.getHeader("Accept")),
                safe(request == null ? null : request.getHeader("Referer")),
                exception == null ? "" : exception.getClass().getSimpleName(),
                safe(exception == null ? null : exception.getMessage()));
        return target;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
