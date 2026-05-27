package egovframework.com.platform.module.service.impl;

import egovframework.com.platform.module.service.ModuleService;
import egovframework.com.platform.module.dao.ModuleDao;
import egovframework.com.platform.module.vo.ModuleVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ModuleServiceImpl implements ModuleService {

    @Autowired
    private ModuleDao moduleDao;

    @Override
    public List<ModuleVO> selectModuleList(ModuleVO searchVO) throws Exception {
        return moduleDao.selectModuleList(searchVO);
    }

    @Override
    public ModuleVO selectModuleById(String id) throws Exception {
        return moduleDao.selectModuleById(id);
    }

    @Override
    public void insertModule(ModuleVO moduleVO) throws Exception {
        moduleDao.insertModule(moduleVO);
    }

    @Override
    public void updateModule(ModuleVO moduleVO) throws Exception {
        moduleDao.updateModule(moduleVO);
    }

    @Override
    public void deleteModule(String id) throws Exception {
        moduleDao.deleteModule(id);
    }
}
