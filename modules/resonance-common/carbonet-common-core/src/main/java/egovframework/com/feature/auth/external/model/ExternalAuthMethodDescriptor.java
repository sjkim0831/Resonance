package egovframework.com.feature.auth.external.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExternalAuthMethodDescriptor {

    private String providerCode;
    private String methodCode;
    private String displayName;
    private String displayNameEn;
    private String description;
    private String descriptionEn;
    private String icon;
    private boolean available;
    private String status;
    private String statusMessage;
    private String publicKeyJwk;
}
