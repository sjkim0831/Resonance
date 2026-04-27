package egovframework.com.feature.admin.model.vo;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmissionFactorVO {

    private Long factorId;
    private Long categoryId;
    private Integer tier;
    private String factorCode;
    private String factorName;
    private Double factorValue;
    private String unit;
    private String defaultYn;
    private String remark;
}
