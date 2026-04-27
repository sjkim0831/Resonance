package egovframework.com.feature.home.web;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "carbonet.react-bootstrap-adapter")
@Getter
@Setter
public class ReactBootstrapAdapterProperties {

    private List<Binding> bindings = new ArrayList<>();

    @Getter
    @Setter
    public static class Binding {
        private String bootstrapEndpoint;
        private String requestedPath;
        private String defaultRoute;
        private boolean admin;
    }
}
