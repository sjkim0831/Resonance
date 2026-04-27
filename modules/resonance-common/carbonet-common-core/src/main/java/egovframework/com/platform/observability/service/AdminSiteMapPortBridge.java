package egovframework.com.platform.observability.service;

import egovframework.com.common.menu.model.SiteMapNode;
import egovframework.com.common.menu.service.SiteMapService;
import egovframework.com.platform.service.observability.AdminSiteMapPort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Service
public class AdminSiteMapPortBridge implements AdminSiteMapPort {

    private final SiteMapService delegate;

    public AdminSiteMapPortBridge(SiteMapService delegate) {
        this.delegate = delegate;
    }

    @Override
    public List<SiteMapNode> getAdminSiteMap(boolean includeHidden, HttpServletRequest request) {
        return delegate.getAdminSiteMap(includeHidden, request);
    }
}
