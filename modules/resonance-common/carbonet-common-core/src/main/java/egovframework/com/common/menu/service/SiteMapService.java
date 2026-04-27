package egovframework.com.common.menu.service;

import egovframework.com.common.menu.model.SiteMapNode;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

public interface SiteMapService {

    List<SiteMapNode> getUserSiteMap(boolean isEn);

    List<SiteMapNode> getAdminSiteMap(boolean isEn, HttpServletRequest request);
}
