package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthorInfoVO {

    private String authorCode;
    private String authorNm;
    private String authorDc;
    private String authorCreatDe;

    public String getAuthorCode() {
        return authorCode;
    }

    public String getAuthorNm() {
        return authorNm;
    }
}
