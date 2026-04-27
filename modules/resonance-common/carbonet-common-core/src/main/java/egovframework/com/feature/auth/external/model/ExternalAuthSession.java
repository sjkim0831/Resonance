package egovframework.com.feature.auth.external.model;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ExternalAuthSession {

    private String providerCode;
    private String methodCode;
    private String txId;
    private String linkedUserId;
    private String linkedUserSe;
    private String requestClientIp;
    private String message;
    private String appScheme;
    private String qrScheme;
    private String urlScheme;
    private LocalDateTime requestedAt;
}
