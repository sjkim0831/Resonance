package egovframework.com.feature.member.mapper;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.model.vo.StplatVO;
import egovframework.com.feature.member.model.vo.UserDefaultVO;

/**
 * 기업회원관리에 관한 데이터 접근 클래스를 정의한다.
 * 
 * @author 공통서비스 개발팀 조재영
 * @since 2009.04.10
 * @version 1.0
 * @see
 *
 *      <pre>
 * << 개정이력(Modification Information) >>
 *
 *   수정일      수정자           수정내용
 *  -------    --------    ---------------------------
 *   2009.04.10  조재영          최초 생성
 *   2017.07.21  장동한 			로그인인증제한 작업
 *
 *      </pre>
 */
@Component("entrprsManageMapper")
public class EntrprsManageMapper extends BaseMapperSupport {

    private final ProjectRuntimeContext projectRuntimeContext;

    public EntrprsManageMapper(ProjectRuntimeContext projectRuntimeContext) {
        this.projectRuntimeContext = projectRuntimeContext;
    }

    /**
     * 화면에 조회된 기업회원의 정보를 데이터베이스에서 삭제
     * 
     * @param delId
     */
    public void deleteEntrprsmber(String delId) {
        delete("entrprsManageMapper.deleteEntrprs_S", delId);
    }

    /**
     * 기업회원의 기본정보를 화면에서 입력하여 항목의 정합성을 체크하고 데이터베이스에 저장
     * 
     * @param entrprsManageVO 기업회원 등록정보
     * @return String 등록결과
     */
    public String insertEntrprsmber(EntrprsManageVO entrprsManageVO) {
        return String.valueOf((int) insert("entrprsManageMapper.insertEntrprs_S", entrprsManageVO));
    }

    public void insertEntrprsMberFile(EntrprsMberFileVO fileVO) {
        insert("entrprsManageMapper.insertEntrprsMberFile", fileVO);
    }

    public List<EntrprsMberFileVO> selectEntrprsMberFiles(String entrprsmberId) {
        return selectList("entrprsManageMapper.selectEntrprsMberFiles", scopedSingleValue("entrprsmberId", entrprsmberId));
    }

    public EntrprsMberFileVO selectEntrprsMberFileByFileId(String fileId) {
        return (EntrprsMberFileVO) selectOne("entrprsManageMapper.selectEntrprsMberFileByFileId", scopedSingleValue("fileId", fileId));
    }

    /**
     * 기 등록된 사용자 중 검색조건에 맞는 기업회원의 정보를 데이터베이스에서 읽어와 화면에 출력
     * 
     * @param entrprsmberId 상세조회대상 기업회원아이디
     * @return EntrprsManageVO 기업회원 상세정보
     */
    public EntrprsManageVO selectEntrprsmber(String entrprsmberId) {
        return (EntrprsManageVO) selectOne("entrprsManageMapper.selectEntrprs_S", scopedSingleValue("uniqId", entrprsmberId));
    }

    /**
     * 기업회원 ID(ENTRPRS_MBER_ID)로 기업회원 상세정보를 조회한다.
     *
     * @param entrprsmberId 기업회원ID
     * @return EntrprsManageVO 기업회원 상세정보
     */
    public EntrprsManageVO selectEntrprsmberByMberId(String entrprsmberId) {
        return (EntrprsManageVO) selectOne("entrprsManageMapper.selectEntrprsByMberId_S", scopedSingleValue("entrprsmberId", entrprsmberId));
    }

    public List<CompanyListItemVO> searchCompanyList(String searchKeyword) {
        return selectList("entrprsManageMapper.searchCompanyList", scopedSingleValue("searchKeyword", searchKeyword));
    }

    public List<CompanyListItemVO> searchCompanyListPaged(java.util.Map<String, Object> params) {
        return selectList("entrprsManageMapper.searchCompanyListPaged", params);
    }

    public int searchCompanyListTotCnt(java.util.Map<String, Object> params) {
        Object result = selectOne("entrprsManageMapper.searchCompanyListTotCnt", params);
        return result == null ? 0 : ((Number) result).intValue();
    }

    /**
     * 화면에 조회된 사용자의 기본정보를 수정하여 항목의 정합성을 체크하고 수정된 데이터를 데이터베이스에 반영
     * 
     * @param entrprsManageVO 기업회원 수정정보
     */
    public void updateEntrprsmber(EntrprsManageVO entrprsManageVO) {
        update("entrprsManageMapper.updateEntrprs_S", entrprsManageVO);
    }

    /**
     * 약관정보를 조회
     * 
     * @param stplatId 기업회원 약관아이디
     * @return List 기업회원약관정보
     */
    public List<StplatVO> selectStplat(String stplatId) {
        return selectList("entrprsManageMapper.selectStplat_S", stplatId);
    }

    /**
     * 기업회원 암호수정
     * 
     * @param passVO 기업회원수정정보(비밀번호)
     */
    public void updatePassword(EntrprsManageVO passVO) {
        update("entrprsManageMapper.updatePassword_S", passVO);
    }

    /**
     * 기업회원이 비밀번호를 기억하지 못할 때 비밀번호를 찾을 수 있도록 함
     * 
     * @param entrprsManageVO 기업회원암호 조회조건정보
     * @return EntrprsManageVO 기업회원암호정보
     */
    public EntrprsManageVO selectPassword(EntrprsManageVO entrprsManageVO) {
        return (EntrprsManageVO) selectOne("entrprsManageMapper.selectPassword_S", entrprsManageVO);
    }

    /**
     * 성명/이메일로 기업회원 아이디를 조회한다.
     *
     * @param entrprsManageVO 조회조건(신청자명, 이메일)
     * @return String 기업회원아이디
     */
    public String selectEntrprsMberIdByNameAndEmail(EntrprsManageVO entrprsManageVO) {
        return (String) selectOne("entrprsManageMapper.selectEntrprsMberIdByNameAndEmail_S", entrprsManageVO);
    }

    /**
     * 기 등록된 특정 기업회원의 정보를 데이터베이스에서 읽어와 화면에 출력
     * 
     * @param userSearchVO 검색조건
     * @return List<EntrprsManageVO>
     */
    public List<EntrprsManageVO> selectEntrprsMberList(UserDefaultVO userSearchVO) {
        return selectList("entrprsManageMapper.selectEntrprsMberList", userSearchVO);
    }

    /**
     * 기업회원 총 개수를 조회한다.
     * 
     * @param userSearchVO 검색조건
     * @return int 기업회원총개수
     */
    public int selectEntrprsMberListTotCnt(UserDefaultVO userSearchVO) {
        return (Integer) selectOne("entrprsManageMapper.selectEntrprsMberListTotCnt", userSearchVO);
    }

    /**
     * 로그인인증제한 해제
     * 
     * @param entrprsManageVO 기업회원정보
     */
    public void updateLockIncorrect(EntrprsManageVO entrprsManageVO) {
        update("entrprsManageMapper.updateLockIncorrect", entrprsManageVO);
    }

    /**
     * 입력한 사용자아이디의 중복여부를 체크하여 사용가능여부를 확인
     * 
     * @param checkId 중복체크대상 아이디
     * @return int 사용가능여부(아이디 사용회수 )
     */
    public int checkIdDplct(String checkId) {
        Object result = selectOne("entrprsManageMapper.checkIdDplct_S", scopedSingleValue("value", checkId));
        return result == null ? 0 : ((Number) result).intValue();
    }

    /**
     * 입력한 이메일의 중복여부를 체크하여 사용가능여부를 확인
     * 
     * @param checkEmail 중복체크대상 이메일
     * @return int 중복횟수(0이면 사용가능)
     */
    public int checkEmailDplct(String checkEmail) {
        Object result = selectOne("entrprsManageMapper.checkEmailDplct_S", scopedSingleValue("value", checkEmail));
        return result == null ? 0 : ((Number) result).intValue();
    }

    /**
     * 회원사(기관) 정보를 등록한다.
     * 
     * @param insttInfoVO 회원사정보
     */
    public void insertInsttInfo(InsttInfoVO insttInfoVO) {
        insert("entrprsManageMapper.insertInsttInfo", insttInfoVO);
    }

    public void insertInsttFile(InsttFileVO fileVO) {
        insert("entrprsManageMapper.insertInsttFile", fileVO);
    }

    public List<InsttFileVO> selectInsttFiles(String insttId) {
        return selectList("entrprsManageMapper.selectInsttFiles", scopedSingleValue("insttId", insttId));
    }

    public InsttFileVO selectInsttFileByFileId(String fileId) {
        return (InsttFileVO) selectOne("entrprsManageMapper.selectInsttFileByFileId", scopedSingleValue("fileId", fileId));
    }

    /**
     * 입력한 회사명(기관명)의 중복여부를 체크하여 사용가능여부를 확인
     * 
     * @param checkNm 중복체크대상 회사명
     * @return int 중복횟수(0이면 사용가능)
     */
    public int checkCompanyNameDplct(String checkNm) {
        return (Integer) selectOne("entrprsManageMapper.checkCompanyNameDplct", scopedSingleValue("checkNm", checkNm));
    }

    /**
     * 회원사(기관) 가입 현황을 조회한다.
     * 
     * @param insttInfoVO 조회조건
     * @return Map 회원사정보
     */
    public InstitutionStatusVO selectInsttInfoForStatus(InsttInfoVO insttInfoVO) {
        return (InstitutionStatusVO) selectOne("entrprsManageMapper.selectInsttInfoForStatus", insttInfoVO);
    }

    public String selectLatestInsttStatusByBizrno(String bizrno) {
        Object result = selectOne("entrprsManageMapper.selectLatestInsttStatusByBizrno", scopedSingleValue("bizrno", bizrno));
        return result == null ? null : String.valueOf(result);
    }

    public void insertEnterpriseSecurityMappingIfAbsent(String esntlId) {
        insert("entrprsManageMapper.insertEnterpriseSecurityMappingComtn", esntlId);
        insert("entrprsManageMapper.insertEnterpriseSecurityMappingMsatn", esntlId);
    }

    /**
     * 회원사(기관) 정보를 수정한다. (재신청 시 사용)
     * 
     * @param insttInfoVO 회원사정보
     */
    public void updateInsttInfo(InsttInfoVO insttInfoVO) {
        update("entrprsManageMapper.updateInsttInfo", insttInfoVO);
    }

    private Map<String, Object> scopedSingleValue(String key, String value) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put(key, value);
        String projectId = currentProjectId();
        if (!projectId.isEmpty()) {
            params.put("projectId", projectId);
        }
        return params;
    }

    private String currentProjectId() {
        return projectRuntimeContext == null || projectRuntimeContext.getProjectId() == null
                ? ""
                : projectRuntimeContext.getProjectId().trim();
    }
}
