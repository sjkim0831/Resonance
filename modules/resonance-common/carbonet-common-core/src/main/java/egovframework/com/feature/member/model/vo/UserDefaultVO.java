package egovframework.com.feature.member.model.vo;

import egovframework.com.common.model.ComDefaultVO;

/**
 * 사용자정보 VO클래스로서 일반회원, 기업회원, 업무사용자의 비지니스로직 처리시 기타조건성 항을 구성한다.
 */
public class UserDefaultVO extends ComDefaultVO {

    private static final long serialVersionUID = 4829684178121022508L;

    /** 검색조건-회원상태 (0, A, D, P) */
    private String sbscrbSttus = "0";

    public String getSbscrbSttus() {
        return sbscrbSttus;
    }

    public void setSbscrbSttus(String sbscrbSttus) {
        this.sbscrbSttus = sbscrbSttus;
    }
}
