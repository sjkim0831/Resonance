package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodexAdminActorContext {

    private String actorUserId;
    private String actorAuthorCode;
    private String actorInsttId;
    private boolean master;
}
