package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.framework.builder.support.FrameworkBuilderRequestContextPort;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

public class CarbonetFrameworkBuilderRequestContextAdapter implements FrameworkBuilderRequestContextPort {

    @Override
    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        String requestUri = request == null ? "" : safe(request.getRequestURI());
        if (requestUri.startsWith("/en/")) {
            return true;
        }
        return locale != null && "en".equalsIgnoreCase(locale.getLanguage());
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
