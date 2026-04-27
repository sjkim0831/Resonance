package egovframework.com.feature.auth.mapper;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;

@Component("authLoginMapper")
public class AuthLoginMapper extends BaseMapperSupport {

    private final ProjectRuntimeContext projectRuntimeContext;

    public AuthLoginMapper(ProjectRuntimeContext projectRuntimeContext) {
        this.projectRuntimeContext = projectRuntimeContext;
    }

    public LoginResponseDTO selectGeneralLoginUser(String userId) {
        return selectOne("authLoginMapper.selectGeneralLoginUser", userId);
    }

    public LoginResponseDTO selectEnterpriseLoginUser(String userId) {
        return selectOne("authLoginMapper.selectEnterpriseLoginUser", loginParams(userId));
    }

    public LoginResponseDTO selectEmployeeLoginUser(String userId) {
        return selectOne("authLoginMapper.selectEmployeeLoginUser", userId);
    }

    public LoginResponseDTO selectLoginUser(String userSe, String userId) {
        Map<String, Object> params = loginParams(userId);
        params.put("userSe", userSe);
        return selectOne("authLoginMapper.selectLoginUser", params);
    }

    public Map<String, Object> selectActiveAuthToken(String userId) {
        return selectOne("authLoginMapper.selectActiveAuthToken", userId);
    }

    public int insertAuthToken(Map<String, Object> params) {
        return insert("authLoginMapper.insertAuthToken", params);
    }

    public int deleteAuthTokenByUserId(String userId) {
        return delete("authLoginMapper.deleteAuthTokenByUserId", userId);
    }

    public int deleteAuthTokenByTokenKey(String tokenKey) {
        return delete("authLoginMapper.deleteAuthTokenByTokenKey", tokenKey);
    }

    public int touchAuthToken(String tokenKey) {
        return update("authLoginMapper.touchAuthToken", tokenKey);
    }

    private Map<String, Object> loginParams(String userId) {
        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        params.put("value", userId);
        String projectId = projectRuntimeContext == null ? "" : safe(projectRuntimeContext.getProjectId());
        if (!projectId.isEmpty()) {
            params.put("projectId", projectId);
        }
        return params;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
