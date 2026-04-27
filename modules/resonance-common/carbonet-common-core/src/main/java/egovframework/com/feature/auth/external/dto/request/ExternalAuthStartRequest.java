package egovframework.com.feature.auth.external.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExternalAuthStartRequest {

    private String methodCode;
    private String userId;
    private String userSe;
    private String returnUrl;
}
