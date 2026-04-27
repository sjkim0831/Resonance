package egovframework.com.platform.governance.mapper;

import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.platform.governance.model.vo.ClassCodeVO;
import egovframework.com.platform.governance.model.vo.CommonCodeVO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.model.vo.PageManagementVO;

import java.util.List;

import org.springframework.stereotype.Component;

import egovframework.com.common.mapper.support.BaseMapperSupport;

@Component("adminCodeManageMapper")
public class AdminCodeManageMapper extends BaseMapperSupport {

    public List<ClassCodeVO> selectClassCodeList() {
        return selectList("AdminCodeManageMapper.selectClassCodeList");
    }

    public ClassCodeVO selectClassCode(String clCode) {
        return selectOne("AdminCodeManageMapper.selectClassCode", clCode);
    }

    public List<CommonCodeVO> selectCodeList() {
        return selectList("AdminCodeManageMapper.selectCodeList");
    }

    public CommonCodeVO selectCommonCode(String codeId) {
        return selectOne("AdminCodeManageMapper.selectCommonCode", codeId);
    }

    public List<DetailCodeVO> selectDetailCodeList(String codeId) {
        return selectList("AdminCodeManageMapper.selectDetailCodeList", codeId);
    }

    public int countCodesByClass(String clCode) {
        Integer count = selectOne("AdminCodeManageMapper.countCodesByClass", clCode);
        return count == null ? 0 : count;
    }

    public int countClassCode(String clCode) {
        Integer count = selectOne("AdminCodeManageMapper.countClassCode", clCode);
        return count == null ? 0 : count;
    }

    public int countCommonCode(String codeId) {
        Integer count = selectOne("AdminCodeManageMapper.countCommonCode", codeId);
        return count == null ? 0 : count;
    }

    public int countDetailCodesByCodeId(String codeId) {
        Integer count = selectOne("AdminCodeManageMapper.countDetailCodesByCodeId", codeId);
        return count == null ? 0 : count;
    }

    public int countDetailCode(AdminCodeCommandDTO params) {
        Integer count = selectOne("AdminCodeManageMapper.countDetailCode", params);
        return count == null ? 0 : count;
    }

    public void insertClassCode(AdminCodeCommandDTO params) {
        insert("AdminCodeManageMapper.insertClassCode", params);
    }

    public void updateClassCode(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updateClassCode", params);
    }

    public void deleteClassCode(String clCode) {
        delete("AdminCodeManageMapper.deleteClassCode", clCode);
    }

    public void insertCommonCode(AdminCodeCommandDTO params) {
        insert("AdminCodeManageMapper.insertCommonCode", params);
    }

    public void updateCommonCode(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updateCommonCode", params);
    }

    public void deleteCommonCode(String codeId) {
        delete("AdminCodeManageMapper.deleteCommonCode", codeId);
    }

    public void insertDetailCode(AdminCodeCommandDTO params) {
        insert("AdminCodeManageMapper.insertDetailCode", params);
    }

    public void updateDetailCode(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updateDetailCode", params);
    }

    public void deleteDetailCode(AdminCodeCommandDTO params) {
        delete("AdminCodeManageMapper.deleteDetailCode", params);
    }

    public List<PageManagementVO> selectPageManagementList(AdminCodeCommandDTO params) {
        return selectList("AdminCodeManageMapper.selectPageManagementList", params);
    }

    public int countPageManagementByCode(AdminCodeCommandDTO params) {
        Integer count = selectOne("AdminCodeManageMapper.countPageManagementByCode", params);
        return count == null ? 0 : count;
    }

    public void insertPageManagementDetail(AdminCodeCommandDTO params) {
        insert("AdminCodeManageMapper.insertPageManagementDetail", params);
    }

    public void insertPageManagementMenu(AdminCodeCommandDTO params) {
        insert("AdminCodeManageMapper.insertPageManagementMenu", params);
    }

    public void updatePageManagementMenu(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updatePageManagementMenu", params);
    }

    public void updatePageManagementNames(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updatePageManagementNames", params);
    }

    public void updatePageManagementUseAt(AdminCodeCommandDTO params) {
        update("AdminCodeManageMapper.updatePageManagementUseAt", params);
    }

    public void deletePageManagementMenu(String code) {
        delete("AdminCodeManageMapper.deletePageManagementMenu", code);
    }
}
