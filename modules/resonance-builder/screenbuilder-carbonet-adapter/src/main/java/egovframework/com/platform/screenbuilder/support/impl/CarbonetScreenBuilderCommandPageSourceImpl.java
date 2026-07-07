package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class CarbonetScreenBuilderCommandPageSourceImpl implements CarbonetScreenBuilderCommandPageSource {

    @Autowired
    private ApplicationContext applicationContext;

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        Object service = applicationContext.getBean("screenCommandCenterService");
        java.lang.reflect.Method method = service.getClass().getMethod("getScreenCommandPage", String.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) method.invoke(service, pageId);
        return result;
    }
}
