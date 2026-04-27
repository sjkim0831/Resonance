package egovframework.com.feature.auth.external.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExternalAuthMethodResponse {

    private String providerCode;
    private String methodCode;
    private String displayName;
    private String description;
    private String icon;
    private boolean available;
    private String status;
    private String statusMessage;
    private String publicKeyJwk;
}
