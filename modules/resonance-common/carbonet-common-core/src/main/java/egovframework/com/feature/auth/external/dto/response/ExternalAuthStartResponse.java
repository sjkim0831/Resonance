package egovframework.com.feature.auth.external.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExternalAuthStartResponse {

    private String status;
    private String providerCode;
    private String methodCode;
    private String txId;
    private String storeId;
    private String channelKey;
    private String nextAction;
    private String appScheme;
    private String qrScheme;
    private String urlScheme;
    private String message;
    private boolean mock;
}
