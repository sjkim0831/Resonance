package egovframework.com.config.security;

import org.egovframe.boot.security.EgovSecurityProperties;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;

import jakarta.servlet.http.HttpServletRequest;

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
        if (uri.startsWith("/en/admin")) {
            return EN_ADMIN_LOGIN_URL;
        }
        if (uri.startsWith("/admin")) {
            return ADMIN_LOGIN_URL;
        }
        if (uri.startsWith("/en/")) {
            return EN_SIGNIN_LOGIN_URL;
        }
        return defaultLoginUrl;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
