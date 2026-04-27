package egovframework.com.platform.observability.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.platform.observability.model.LoginHistorySearchVO;
import egovframework.com.platform.observability.model.LoginHistoryVO;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("adminLoginHistoryMapper")
public class AdminLoginHistoryMapper extends BaseMapperSupport {

    public void insertLoginHistory(LoginHistoryVO loginHistoryVO) {
        insert("AdminLoginHistoryMapper.insertLoginHistory", loginHistoryVO);
    }

    public int selectLoginHistoryListTotCnt(LoginHistorySearchVO searchVO) {
        Integer count = selectOne("AdminLoginHistoryMapper.selectLoginHistoryListTotCnt", searchVO);
        return count == null ? 0 : count;
    }

    public List<LoginHistoryVO> selectLoginHistoryList(LoginHistorySearchVO searchVO) {
        return selectList("AdminLoginHistoryMapper.selectLoginHistoryList", searchVO);
    }
}
