package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderCommandPagePort;
import java.util.Map;

public class CarbonetScreenBuilderCommandPageAdapter implements ScreenBuilderCommandPagePort {

    private final CarbonetScreenBuilderCommandPageSource carbonetScreenBuilderCommandPageSource;

    public CarbonetScreenBuilderCommandPageAdapter(CarbonetScreenBuilderCommandPageSource carbonetScreenBuilderCommandPageSource) {
        this.carbonetScreenBuilderCommandPageSource = carbonetScreenBuilderCommandPageSource;
    }

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        return carbonetScreenBuilderCommandPageSource.getScreenCommandPage(pageId);
    }
}
