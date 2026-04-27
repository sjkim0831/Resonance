package egovframework.com.platform.service.observability;

import egovframework.com.common.menu.model.SiteMapNode;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

public interface AdminSiteMapPort {

    List<SiteMapNode> getAdminSiteMap(boolean includeHidden, HttpServletRequest request);
}
