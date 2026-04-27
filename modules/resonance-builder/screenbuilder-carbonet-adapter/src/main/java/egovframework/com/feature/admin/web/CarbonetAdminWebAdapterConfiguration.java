package egovframework.com.feature.admin.web;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CarbonetAdminWebAdapterConfiguration {

    @Bean
    @ConditionalOnMissingBean(CarbonetAdminRouteSource.class)
    public CarbonetAdminRouteSource carbonetAdminRouteSource(AdminReactRouteSupport adminReactRouteSupport) {
        return new CarbonetAdminRouteSourceAdapter(adminReactRouteSupport);
    }
}
