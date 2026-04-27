package egovframework.com.platform.observability.service;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.service.observability.CurrentUserContextReadPort;
import egovframework.com.platform.service.observability.CurrentUserContextSnapshot;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;

@Service
public class CurrentUserContextReadPortBridge implements CurrentUserContextReadPort {

    private final CurrentUserContextService currentUserContextService;

    public CurrentUserContextReadPortBridge(CurrentUserContextService currentUserContextService) {
        this.currentUserContextService = currentUserContextService;
    }

    @Override
    public CurrentUserContextSnapshot resolve(HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        CurrentUserContextSnapshot snapshot = new CurrentUserContextSnapshot();
        snapshot.setUserId(context == null ? "" : context.getUserId());
        snapshot.setAuthorCode(context == null ? "" : context.getAuthorCode());
        snapshot.setInsttId(context == null ? "" : context.getInsttId());
        return snapshot;
    }
}
