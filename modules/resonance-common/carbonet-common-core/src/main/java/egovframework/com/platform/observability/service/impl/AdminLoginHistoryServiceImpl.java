package egovframework.com.platform.observability.service.impl;

import egovframework.com.platform.observability.mapper.AdminLoginHistoryMapper;
import egovframework.com.platform.observability.model.LoginHistorySearchVO;
import egovframework.com.platform.observability.model.LoginHistoryVO;
import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import egovframework.com.common.context.ProjectRuntimeContext;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service("adminLoginHistoryService")
public class AdminLoginHistoryServiceImpl extends EgovAbstractServiceImpl implements AdminLoginHistoryService {

    private final AdminLoginHistoryMapper adminLoginHistoryMapper;
    private final ProjectRuntimeContext projectRuntimeContext;

    public AdminLoginHistoryServiceImpl(AdminLoginHistoryMapper adminLoginHistoryMapper,
                                        ProjectRuntimeContext projectRuntimeContext) {
        this.adminLoginHistoryMapper = adminLoginHistoryMapper;
        this.projectRuntimeContext = projectRuntimeContext;
    }

    @Override
    public void insertLoginHistory(String userId, String userNm, String userSe, String loginResult, String loginIp, String loginMessage) {
        LoginHistoryVO loginHistoryVO = new LoginHistoryVO();
        loginHistoryVO.setHistId(UUID.randomUUID().toString().replace("-", ""));
        loginHistoryVO.setUserId(safeString(userId));
        loginHistoryVO.setUserNm(safeString(userNm));
        loginHistoryVO.setUserSe(safeString(userSe).toUpperCase());
        loginHistoryVO.setLoginResult(safeString(loginResult).toUpperCase());
        loginHistoryVO.setLoginIp(safeString(loginIp));
        loginHistoryVO.setLoginMessage(safeString(loginMessage));
        adminLoginHistoryMapper.insertLoginHistory(loginHistoryVO);
    }

    @Override
    public int selectLoginHistoryListTotCnt(LoginHistorySearchVO searchVO) {
        applyDefaultProjectId(searchVO);
        return adminLoginHistoryMapper.selectLoginHistoryListTotCnt(searchVO);
    }

    @Override
    public List<LoginHistoryVO> selectLoginHistoryList(LoginHistorySearchVO searchVO) {
        applyDefaultProjectId(searchVO);
        return adminLoginHistoryMapper.selectLoginHistoryList(searchVO);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private void applyDefaultProjectId(LoginHistorySearchVO searchVO) {
        if (searchVO == null || hasText(searchVO.getProjectId())) {
            return;
        }
        searchVO.setProjectId(safeString(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId()));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
