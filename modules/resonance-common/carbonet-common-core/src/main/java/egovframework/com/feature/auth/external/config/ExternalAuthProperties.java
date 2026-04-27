package egovframework.com.feature.auth.external.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "security.external-auth")
@Getter
@Setter
public class ExternalAuthProperties {

    private boolean enabled = true;
    private boolean mockSuccessEnabled = false;
    private List<String> methodOrder = Arrays.asList("SIMPLE", "JOINT", "FINANCIAL");
    private Kisa kisa = new Kisa();

    @Getter
    @Setter
    public static class Kisa {
        private boolean enabled = true;
        private String adapterVersion = "v1";
        private String sdkJarPath;
        private String decryptToolPath;
        private String clientId;
        private String serviceCode;
        private String caCode;
        private String publicKeyJwk;
        private String requestTitle = "탄소중립 CCUS 통합관리본부";
        private String prepareEndpoint;
        private String resultEndpoint;
        private String callbackScheme;
    }
}
