package egovframework.com.feature.auth.external.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "security.portone-v2")
@Getter
@Setter
public class PortOneV2Properties {
    private boolean enabled;
    private String storeId;
    private String channelKey;
    private String apiSecret;

    public boolean isReady() {
        return enabled && present(storeId) && present(channelKey) && present(apiSecret);
    }

    private boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
