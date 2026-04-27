package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminQnaCategorySaveRequestDTO {

    private String categoryId;
    private String code;
    private String nameKo;
    private String nameEn;
    private String descriptionKo;
    private String descriptionEn;
    private String channel;
    private String useAt;
    private Integer sortOrder;
    private String ownerKo;
    private String ownerEn;
}
