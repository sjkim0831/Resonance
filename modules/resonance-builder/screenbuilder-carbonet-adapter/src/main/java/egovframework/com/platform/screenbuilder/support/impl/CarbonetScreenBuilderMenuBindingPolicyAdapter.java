package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

public class CarbonetScreenBuilderMenuBindingPolicyAdapter implements ScreenBuilderMenuBindingPolicyPort {

    @Override
    public List<String> getMenuCatalogRoots() {
        return Collections.singletonList("AMENU1");
    }

    @Override
    public String resolveMenuScope() {
        return "PROJECT_RUNTIME";
    }

    @Override
    public String resolveRuntimeClass() {
        return "ADMIN";
    }

    @Override
    public String derivePageId(String menuCode, ScreenBuilderMenuDescriptor menu) {
        String url = menu == null ? "" : ScreenBuilderAdapterSupport.safe(menu.getMenuUrl());
        if (url.startsWith("/admin/system/")) {
            return url.substring("/admin/system/".length()).replace('_', '-').replace('/', '-');
        }
        if (url.startsWith("/admin/member/")) {
            return url.substring("/admin/member/".length()).replace('_', '-').replace('/', '-');
        }
        if (ScreenBuilderAdapterSupport.safe(menuCode).isEmpty()) {
            return "";
        }
        return "builder-" + ScreenBuilderAdapterSupport.lowerCaseSafe(menuCode);
    }
}
