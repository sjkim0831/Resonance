package egovframework.com.feature.auth.external.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExternalAuthIdentity {

    private String providerCode;
    private String methodCode;
    private String txId;
    private String authTy;
    private String authCi;
    private String authDi;
    private String authDn;
    private String userName;
    private String phoneNumber;
}
