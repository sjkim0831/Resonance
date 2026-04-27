package egovframework.com.platform.service.observability;

import jakarta.servlet.http.HttpServletRequest;

public interface CurrentUserContextReadPort {

    CurrentUserContextSnapshot resolve(HttpServletRequest request);
}
