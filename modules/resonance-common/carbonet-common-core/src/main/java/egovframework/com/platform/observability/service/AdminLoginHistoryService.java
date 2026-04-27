package egovframework.com.platform.observability.service;

import egovframework.com.platform.observability.model.LoginHistorySearchVO;
import egovframework.com.platform.observability.model.LoginHistoryVO;

import java.util.List;

public interface AdminLoginHistoryService {

    void insertLoginHistory(String userId, String userNm, String userSe, String loginResult, String loginIp, String loginMessage) throws Exception;

    int selectLoginHistoryListTotCnt(LoginHistorySearchVO searchVO) throws Exception;

    List<LoginHistoryVO> selectLoginHistoryList(LoginHistorySearchVO searchVO) throws Exception;
}
