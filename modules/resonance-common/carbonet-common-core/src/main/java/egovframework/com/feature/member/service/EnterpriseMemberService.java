package egovframework.com.feature.member.service;

import java.util.List;

import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.model.vo.StplatVO;
import egovframework.com.feature.member.model.vo.UserDefaultVO;

/**
 * 기업회원관리에 관한 인터페이스클래스를 정의한다.
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
public interface EnterpriseMemberService {

	/**
	 * 기업회원의 기본정보를 화면에서 입력하여 항목의 정합성을 체크하고 데이터베이스에 저장
	 * 
	 * @param entrprsManageVO 기업회원등록정보
	 * @return result 등록결과
	 * @throws Exception
	 */
	public String insertEntrprsmber(EntrprsManageVO entrprsManageVO) throws Exception;

	public void insertEntrprsMberFiles(List<EntrprsMberFileVO> fileList) throws Exception;

	public List<EntrprsMberFileVO> selectEntrprsMberFiles(String entrprsmberId) throws Exception;

	public EntrprsMberFileVO selectEntrprsMberFileByFileId(String fileId) throws Exception;

	/**
	 * 기 등록된 사용자 중 검색조건에 맞는기업회원의 정보를 데이터베이스에서 읽어와 화면에 출력
	 * 
	 * @param entrprsmberId 조회대상 기업회원아이디
	 * @return entrprsManageVO 기업회원정보
	 * @throws Exception
	 */
	public EntrprsManageVO selectEntrprsmber(String entrprsmberId) throws Exception;

	/**
	 * 기업회원 ID(ENTRPRS_MBER_ID) 기준으로 기업회원 상세정보를 조회한다.
	 *
	 * @param entrprsmberId 조회대상 기업회원ID
	 * @return entrprsManageVO 기업회원정보
	 * @throws Exception
	 */
	public EntrprsManageVO selectEntrprsmberByMberId(String entrprsmberId) throws Exception;

	/**
	 * 신청자명/이메일 기준으로 기업회원 아이디를 조회한다.
	 *
	 * @param entrprsManageVO 조회조건(신청자명, 이메일)
	 * @return 기업회원 아이디
	 * @throws Exception
	 */
	public String selectEntrprsMberIdByNameAndEmail(EntrprsManageVO entrprsManageVO) throws Exception;

	public List<CompanyListItemVO> searchCompanyList(String searchKeyword) throws Exception;

	public List<CompanyListItemVO> searchCompanyListPaged(java.util.Map<String, Object> params) throws Exception;

	public int searchCompanyListTotCnt(java.util.Map<String, Object> params) throws Exception;

	/**
	 * 화면에 조회된 기업회원의 기본정보를 수정하여 항목의 정합성을 체크하고 수정된 데이터를 데이터베이스에 반영
	 * 
	 * @param entrprsManageVO 기업회원수정정보
	 * @throws Exception
	 */
	public void updateEntrprsmber(EntrprsManageVO entrprsManageVO) throws Exception;

	/**
	 * 화면에 조회된 기업회원의 정보를 데이터베이스에서 삭제
	 * 
	 * @param checkedIdForDel 삭제대상기업회원아이디
	 * @throws Exception
	 */
	public void deleteEntrprsmber(String checkedIdForDel) throws Exception;

	/**
	 * 기업회원용 약관정보 조회
	 * 
	 * @param stplatId 기업회원약관아이디
	 * @return stplatList 기업회원약관정보
	 * @throws Exception
	 */
	public List<StplatVO> selectStplat(String stplatId) throws Exception;

	/**
	 * 기업회원암호수정
	 * 
	 * @param entrprsManageVO 기업회원수정정보(비밀번호)
	 * @throws Exception
	 */
	public void updatePassword(EntrprsManageVO entrprsManageVO) throws Exception;

	/**
	 * 기업회원이 비밀번호를 기억하지 못할 때 비밀번호를 찾을 수 있도록 함
	 * 
	 * @param passVO 기업회원암호 조회조건정보
	 * @return entrprsManageVO 기업회원암호정보
	 * @throws Exception
	 */
	public EntrprsManageVO selectPassword(EntrprsManageVO passVO) throws Exception;

	/**
	 * 기 등록된기업 회원 중 검색조건에 맞는 회원들의 정보를 데이터베이스에서 읽어와 화면에 출력
	 * 
	 * @param userSearchVO 검색조건
	 * @return List<EntrprsManageVO> 기업회원목록정보
	 * @throws Exception
	 */
	public List<EntrprsManageVO> selectEntrprsMberList(UserDefaultVO userSearchVO) throws Exception;

	/**
	 * 기업회원 총 개수를 조회한다.
	 * 
	 * @param userSearchVO 검색조건
	 * @return 사용자 총 개수(int)
	 * @throws Exception
	 */
	public int selectEntrprsMberListTotCnt(UserDefaultVO userSearchVO) throws Exception;

	/**
	 * 로그인인증제한 해제
	 * 
	 * @param entrprsManageVO 기업회원정보
	 * @return void
	 * @throws Exception
	 */
	public void updateLockIncorrect(EntrprsManageVO entrprsManageVO) throws Exception;

	/**
	 * 아이디 중복 여부를 체크한다.
	 * 
	 * @param checkId 중복체크대상 아이디
	 * @return int 중복횟수(0이면 사용가능)
	 * @throws Exception
	 */
	public int checkIdDplct(String checkId) throws Exception;

	/**
	 * 이메일 중복 여부를 체크한다.
	 * 
	 * @param checkEmail 중복체크대상 이메일
	 * @return int 중복횟수(0이면 사용가능)
	 * @throws Exception
	 */
	public int checkEmailDplct(String checkEmail) throws Exception;

	/**
	 * 회원사(기관) 정보를 등록한다.
	 * 
	 * @param insttInfoVO 회원사정보
	 * @throws Exception
	 */
	public void insertInsttInfo(InsttInfoVO insttInfoVO) throws Exception;

	public void insertInsttFiles(List<InsttFileVO> fileList) throws Exception;

	public List<InsttFileVO> selectInsttFiles(String insttId) throws Exception;

	public InsttFileVO selectInsttFileByFileId(String fileId) throws Exception;

	/**
	 * 회사명(기관명) 중복 여부를 체크한다.
	 * 
	 * @param checkNm 중복체크대상 회사명
	 * @return int 중복횟수(0이면 사용가능)
	 * @throws Exception
	 */
	public int checkCompanyNameDplct(String checkNm) throws Exception;

	/**
	 * 회원사(기관) 가입 현황을 조회한다.
	 * 
	 * @param insttInfoVO 조회조건(bizrno 또는 insttId, reprsntNm)
	 * @return InsttInfoVO 회원사정보
	 * @throws Exception
	 */
	public InstitutionStatusVO selectInsttInfoForStatus(InsttInfoVO insttInfoVO) throws Exception;

	public java.util.List<CompanyListItemVO> searchCompanyListPaged(String keyword, String status, int offset, int pageSize) throws Exception;

	public int searchCompanyListTotCnt(String keyword, String status) throws Exception;

	/**
	 * 사업자번호 기준 최신 기관(회원사) 가입 상태를 조회한다.
	 *
	 * @param bizrno 사업자번호
	 * @return 기관 상태코드(P/A/X 등)
	 * @throws Exception
	 */
	public String selectLatestInsttStatusByBizrno(String bizrno) throws Exception;

	/**
	 * 기업회원의 권한 매핑(COMTN/MSATN 보안테이블)을 보장한다.
	 *
	 * @param esntlId 고유 식별자
	 * @throws Exception
	 */
	public void ensureEnterpriseSecurityMapping(String esntlId) throws Exception;

	/**
	 * 회원사(기관) 정보를 수정한다. (재신청 시 사용)
	 * 
	 * @param insttInfoVO 회원사정보
	 * @throws Exception
	 */
	public void updateInsttInfo(InsttInfoVO insttInfoVO) throws Exception;

}
