package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderPageContractVO {

    private String pageId;
    private String label;
    private String routePath;
    private String menuCode;
    private String domainCode;
    private String layoutVersion;
    private String designTokenVersion;
    private Integer componentCount;
    private List<FrameworkBuilderSurfaceContractVO> components = new ArrayList<>();
}

