package egovframework.com.platform.module.dao;

import egovframework.com.platform.module.vo.ModuleVO;
import java.util.List;

public interface ModuleDao {
    List<ModuleVO> selectModuleList(ModuleVO searchVO) throws Exception;
    ModuleVO selectModuleById(String id) throws Exception;
    void insertModule(ModuleVO moduleVO) throws Exception;
    void updateModule(ModuleVO moduleVO) throws Exception;
    void deleteModule(String id) throws Exception;
}
