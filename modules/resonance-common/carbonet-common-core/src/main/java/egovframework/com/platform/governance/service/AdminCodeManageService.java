package egovframework.com.platform.governance.service;

import egovframework.com.platform.governance.model.vo.ClassCodeVO;
import egovframework.com.platform.governance.model.vo.CommonCodeVO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.model.vo.PageManagementVO;

import java.util.List;

public interface AdminCodeManageService {

    List<ClassCodeVO> selectClassCodeList() throws Exception;

    ClassCodeVO selectClassCode(String clCode) throws Exception;

    List<CommonCodeVO> selectCodeList() throws Exception;

    CommonCodeVO selectCommonCode(String codeId) throws Exception;

    List<DetailCodeVO> selectDetailCodeList(String codeId) throws Exception;

    int countCodesByClass(String clCode) throws Exception;

    int countDetailCodesByCodeId(String codeId) throws Exception;

    void insertClassCode(String clCode, String clCodeNm, String clCodeDc, String useAt, String registerId) throws Exception;

    void updateClassCode(String clCode, String clCodeNm, String clCodeDc, String useAt, String updaterId) throws Exception;

    void deleteClassCode(String clCode) throws Exception;

    void insertCommonCode(String codeId, String codeIdNm, String codeIdDc, String useAt, String clCode, String registerId) throws Exception;

    void updateCommonCode(String codeId, String codeIdNm, String codeIdDc, String useAt, String clCode, String updaterId) throws Exception;

    void deleteCommonCode(String codeId) throws Exception;

    void insertDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt, String registerId) throws Exception;

    void updateDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt, String updaterId) throws Exception;

    void deleteDetailCode(String codeId, String code) throws Exception;

    List<PageManagementVO> selectPageManagementList(String codeId, String searchKeyword, String searchUrl) throws Exception;
 
     int countPageManagementByCode(String codeId, String code) throws Exception;
 
     void insertPageManagement(String codeId, String code, String codeNm, String codeDc, String menuUrl, String menuIcon, String useAt, String registerId) throws Exception;
 
     void updatePageManagement(String code, String codeNm, String codeDc, String menuUrl, String menuIcon, String useAt, String updaterId) throws Exception;
 
     void deletePageManagement(String codeId, String code) throws Exception;
}
