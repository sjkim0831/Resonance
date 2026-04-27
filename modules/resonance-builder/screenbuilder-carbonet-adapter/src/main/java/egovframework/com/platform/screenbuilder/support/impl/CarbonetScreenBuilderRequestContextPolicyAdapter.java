package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderRequestContextPolicyPort;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

public class CarbonetScreenBuilderRequestContextPolicyAdapter implements ScreenBuilderRequestContextPolicyPort {

    @Override
    public boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String uri = ScreenBuilderAdapterSupport.safe(request.getRequestURI());
            if (uri.startsWith("/en/admin") || uri.startsWith("/en/api")) {
                return true;
            }
        }
        return locale != null && "en".equalsIgnoreCase(locale.getLanguage());
    }
}
