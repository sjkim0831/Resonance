package egovframework.com.platform.screenbuilder.support;

import java.util.Map;

public interface ScreenBuilderCommandPagePort {

    Map<String, Object> getScreenCommandPage(String pageId) throws Exception;
}
