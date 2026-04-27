package egovframework.com.framework.builder.support;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

public interface FrameworkBuilderRequestContextPort {

    boolean isEnglishRequest(HttpServletRequest request, Locale locale);
}
