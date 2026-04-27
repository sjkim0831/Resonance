package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderCommandPageSource;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Map;

@Component
public class CarbonetScreenBuilderCommandPageSourceImpl implements CarbonetScreenBuilderCommandPageSource {

    private final ApplicationContext applicationContext;

    public CarbonetScreenBuilderCommandPageSourceImpl(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    @Override
    public Map<String, Object> getScreenCommandPage(String pageId) throws Exception {
        Class<?> serviceType = Class.forName("egovframework.com.platform.codex.service.ScreenCommandCenterService");
        Object service = applicationContext.getBean(serviceType);
        Method method = serviceType.getMethod("getScreenCommandPage", String.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) method.invoke(service, pageId);
        return result;
    }
}
