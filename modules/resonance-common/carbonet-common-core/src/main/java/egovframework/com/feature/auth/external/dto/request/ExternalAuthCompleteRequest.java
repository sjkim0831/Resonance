package egovframework.com.feature.auth.external.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExternalAuthCompleteRequest {

    private String methodCode;
    private String txId;
    private String userId;
    private String userSe;
}
