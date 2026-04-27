package egovframework.com.feature.admin.model.vo;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodexAdminActorContextVO {

    private String actorUserId;
    private String actorAuthorCode;
    private String actorInsttId;
    private boolean master;
}
