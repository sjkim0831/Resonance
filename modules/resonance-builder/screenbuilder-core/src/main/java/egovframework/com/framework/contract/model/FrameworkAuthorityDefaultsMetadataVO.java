package egovframework.com.framework.contract.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkAuthorityDefaultsMetadataVO {

    private List<String> allowedScopePolicies = new ArrayList<>();
    private List<String> tierOrder = new ArrayList<>();
}
