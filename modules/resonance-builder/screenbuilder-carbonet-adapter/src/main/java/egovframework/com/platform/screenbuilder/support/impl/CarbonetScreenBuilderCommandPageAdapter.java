package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;
import lombok.RequiredArgsConstructor;

import java.util.Map;

@RequiredArgsConstructor
public class CarbonetScreenBuilderCommandPageAdapter implements ScreenBuilderCommandPagePort {

    private final CarbonetScreenBuilderCommandPageSource carbonetScreenBuilderCommandPageSource;

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        return carbonetScreenBuilderCommandPageSource.getScreenCommandPage(pageId);
    }
}
