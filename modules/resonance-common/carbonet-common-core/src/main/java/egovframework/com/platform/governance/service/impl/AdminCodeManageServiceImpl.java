package egovframework.com.platform.governance.service.impl;

import egovframework.com.platform.governance.mapper.AdminCodeManageMapper;
import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.platform.governance.model.vo.ClassCodeVO;
import egovframework.com.platform.governance.model.vo.CommonCodeVO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.model.vo.PageManagementVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import java.util.List;

@Service("adminCodeManageService")
public class AdminCodeManageServiceImpl extends EgovAbstractServiceImpl implements AdminCodeManageService {

    private final AdminCodeManageMapper adminCodeManageMapper;

    public AdminCodeManageServiceImpl(AdminCodeManageMapper adminCodeManageMapper) {
        this.adminCodeManageMapper = adminCodeManageMapper;
    }

    @Override
    public List<ClassCodeVO> selectClassCodeList() {
        return adminCodeManageMapper.selectClassCodeList();
    }

    @Override
    public ClassCodeVO selectClassCode(String clCode) {
        return adminCodeManageMapper.selectClassCode(clCode);
    }

    @Override
    public List<CommonCodeVO> selectCodeList() {
        return adminCodeManageMapper.selectCodeList();
    }

    @Override
    public CommonCodeVO selectCommonCode(String codeId) {
        return adminCodeManageMapper.selectCommonCode(codeId);
    }

    @Override
    public List<DetailCodeVO> selectDetailCodeList(String codeId) {
        return adminCodeManageMapper.selectDetailCodeList(codeId);
    }

    @Override
    public int countCodesByClass(String clCode) {
        return adminCodeManageMapper.countCodesByClass(clCode);
    }

    @Override
    public int countDetailCodesByCodeId(String codeId) {
        return adminCodeManageMapper.countDetailCodesByCodeId(codeId);
    }

    @Override
    public void insertClassCode(String clCode, String clCodeNm, String clCodeDc, String useAt, String registerId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setClCode(clCode);
        params.setClCodeNm(clCodeNm);
        params.setClCodeDc(clCodeDc);
        params.setUseAt(useAt);
        params.setRegisterId(registerId);
        adminCodeManageMapper.insertClassCode(params);
    }

    @Override
    public void updateClassCode(String clCode, String clCodeNm, String clCodeDc, String useAt, String updaterId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setClCode(clCode);
        params.setClCodeNm(clCodeNm);
        params.setClCodeDc(clCodeDc);
        params.setUseAt(useAt);
        params.setUpdaterId(updaterId);
        adminCodeManageMapper.updateClassCode(params);
    }

    @Override
    public void deleteClassCode(String clCode) {
        adminCodeManageMapper.deleteClassCode(clCode);
    }

    @Override
    public void insertCommonCode(String codeId, String codeIdNm, String codeIdDc, String useAt, String clCode, String registerId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCodeIdNm(codeIdNm);
        params.setCodeIdDc(codeIdDc);
        params.setUseAt(useAt);
        params.setClCode(clCode);
        params.setRegisterId(registerId);
        adminCodeManageMapper.insertCommonCode(params);
    }

    @Override
    public void updateCommonCode(String codeId, String codeIdNm, String codeIdDc, String useAt, String clCode, String updaterId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCodeIdNm(codeIdNm);
        params.setCodeIdDc(codeIdDc);
        params.setUseAt(useAt);
        params.setClCode(clCode);
        params.setUpdaterId(updaterId);
        adminCodeManageMapper.updateCommonCode(params);
    }

    @Override
    public void deleteCommonCode(String codeId) {
        adminCodeManageMapper.deleteCommonCode(codeId);
    }

    @Override
    public void insertDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt, String registerId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        params.setCodeNm(codeNm);
        params.setCodeDc(codeDc);
        params.setUseAt(useAt);
        params.setRegisterId(registerId);
        adminCodeManageMapper.insertDetailCode(params);
    }

    @Override
    public void updateDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt, String updaterId) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        params.setCodeNm(codeNm);
        params.setCodeDc(codeDc);
        params.setUseAt(useAt);
        params.setUpdaterId(updaterId);
        adminCodeManageMapper.updateDetailCode(params);
    }

    @Override
    public void deleteDetailCode(String codeId, String code) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setCode(code);
        adminCodeManageMapper.deleteDetailCode(params);
    }

    @Override
    public List<PageManagementVO> selectPageManagementList(String codeId, String searchKeyword, String searchUrl) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCodeId(codeId);
        params.setSearchKeyword(searchKeyword);
        params.setSearchUrl(searchUrl);
        return adminCodeManageMapper.selectPageManagementList(params);
    }
 
     @Override
     public int countPageManagementByCode(String codeId, String code) {
         AdminCodeCommandDTO params = new AdminCodeCommandDTO();
         params.setCodeId(codeId);
         params.setCode(code);
         return adminCodeManageMapper.countPageManagementByCode(params);
     }
 
     @Override
     public void insertPageManagement(String codeId, String code, String codeNm, String codeDc, String menuUrl, String menuIcon, String useAt, String registerId) {
         AdminCodeCommandDTO params = new AdminCodeCommandDTO();
         params.setCodeId(codeId);
         params.setCode(code);
         params.setCodeNm(codeNm);
         params.setCodeDc(codeDc);
         params.setMenuUrl(menuUrl);
         params.setMenuIcon(menuIcon);
         params.setUseAt(useAt);
         params.setRegisterId(registerId);
         adminCodeManageMapper.insertPageManagementDetail(params);
         adminCodeManageMapper.insertPageManagementMenu(params);
     }
 
     @Override
     public void updatePageManagement(String code, String codeNm, String codeDc, String menuUrl, String menuIcon, String useAt, String updaterId) {
         AdminCodeCommandDTO params = new AdminCodeCommandDTO();
         params.setCode(code);
         params.setCodeNm(codeNm);
         params.setCodeDc(codeDc);
         params.setMenuUrl(menuUrl);
         params.setMenuIcon(menuIcon);
         params.setUseAt(useAt);
         params.setUpdaterId(updaterId);
         adminCodeManageMapper.updatePageManagementNames(params);
         adminCodeManageMapper.updatePageManagementUseAt(params);
         adminCodeManageMapper.updatePageManagementMenu(params);
     }
 
     @Override
     public void deletePageManagement(String codeId, String code) {
         AdminCodeCommandDTO params = new AdminCodeCommandDTO();
         params.setCodeId(codeId);
         params.setCode(code);
         adminCodeManageMapper.deletePageManagementMenu(code);
         adminCodeManageMapper.deleteDetailCode(params);
     }
}
