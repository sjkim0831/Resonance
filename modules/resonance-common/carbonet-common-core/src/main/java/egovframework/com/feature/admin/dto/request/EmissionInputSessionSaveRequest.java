package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class EmissionInputSessionSaveRequest {

    private Long categoryId;
    private Integer tier;
    private String createdBy;
    private List<EmissionInputValueRequest> values;
}
