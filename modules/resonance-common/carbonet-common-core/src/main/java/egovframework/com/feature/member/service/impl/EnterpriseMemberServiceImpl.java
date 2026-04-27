package egovframework.com.feature.member.service.impl;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import jakarta.annotation.Resource;

import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.egovframe.rte.fdl.idgnr.EgovIdGnrService;
import org.springframework.stereotype.Service;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.util.FileSecurityUtil;
import egovframework.com.common.util.StringUtil;
import egovframework.com.feature.member.mapper.EntrprsManageMapper;
import egovframework.com.feature.member.mapper.MberManageMapper;
import egovframework.com.feature.member.mapper.UserManageMapper;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.model.vo.StplatVO;
import egovframework.com.feature.member.model.vo.UserDefaultVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;

/**
 * 기업회원관리에 관한 비지니스클래스를 정의한다.
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
 *   2014.12.08	 이기하			암호화방식 변경(FileSecurityUtil.encryptPassword)
 *   2017.07.21  장동한 			로그인인증제한 작업
 *
 *      </pre>
 */
@Service("entrprsManageService")
public class EnterpriseMemberServiceImpl extends EgovAbstractServiceImpl implements EnterpriseMemberService {

	/** userManageMapper */
	@Resource(name = "userManageMapper")
	private UserManageMapper userManageMapper;

	/** mberManageMapper */
	@Resource(name = "mberManageMapper")
	private MberManageMapper mberManageMapper;

	/** entrprsManageMapper */
	@Resource(name = "entrprsManageMapper")
	private EntrprsManageMapper entrprsManageMapper;

	/** egovUsrCnfrmIdGnrService */
	@Resource(name = "egovUsrCnfrmIdGnrService")
	private EgovIdGnrService idgenService;

	private final ProjectRuntimeContext projectRuntimeContext;

	public EnterpriseMemberServiceImpl(ProjectRuntimeContext projectRuntimeContext) {
		this.projectRuntimeContext = projectRuntimeContext;
	}

	/**
	 * 기업회원의 기본정보를 화면에서 입력하여 항목의 정합성을 체크하고 데이터베이스에 저장
	 * 
	 * @param entrprsManageVO 기업회원등록정보
	 * @return result 등록결과
	 * @throws Exception
	 */
	@Override
	public String insertEntrprsmber(EntrprsManageVO entrprsManageVO) throws Exception {
		applyDefaultProjectId(entrprsManageVO);
		// 고유아이디 셋팅
		String uniqId = idgenService.getNextStringId();
		entrprsManageVO.setUniqId(uniqId);
		// 패스워드 암호화
		String pass = FileSecurityUtil.encryptPassword(entrprsManageVO.getEntrprsMberPassword(),
				StringUtil.isNullToString(entrprsManageVO.getEntrprsmberId()));// KISA 보안약점 조치 (2018-10-29, 윤창원)
		entrprsManageVO.setEntrprsMberPassword(pass);

		String result = entrprsManageMapper.insertEntrprsmber(entrprsManageVO);
		return result;
	}

	@Override
	public void insertEntrprsMberFiles(List<EntrprsMberFileVO> fileList) throws Exception {
		if (fileList == null || fileList.isEmpty()) {
			return;
		}
		for (EntrprsMberFileVO fileVO : fileList) {
			if (fileVO == null) {
				continue;
			}
			entrprsManageMapper.insertEntrprsMberFile(fileVO);
		}
	}

	@Override
	public List<EntrprsMberFileVO> selectEntrprsMberFiles(String entrprsmberId) throws Exception {
		return entrprsManageMapper.selectEntrprsMberFiles(entrprsmberId);
	}

	@Override
	public EntrprsMberFileVO selectEntrprsMberFileByFileId(String fileId) throws Exception {
		return entrprsManageMapper.selectEntrprsMberFileByFileId(fileId);
	}

	/**
	 * 기 등록된 사용자 중 검색조건에 맞는기업회원의 정보를 데이터베이스에서 읽어와 화면에 출력
	 * 
	 * @param uniqId 조회대상 기업회원아이디
	 * @return entrprsManageVO 기업회원정보
	 * @throws Exception
	 */
	@Override
	public EntrprsManageVO selectEntrprsmber(String uniqId) {
		EntrprsManageVO entrprsManageVO = entrprsManageMapper.selectEntrprsmber(uniqId);
		return entrprsManageVO;
	}

	@Override
	public EntrprsManageVO selectEntrprsmberByMberId(String entrprsmberId) {
		EntrprsManageVO entrprsManageVO = entrprsManageMapper.selectEntrprsmberByMberId(entrprsmberId);
		return entrprsManageVO;
	}

	@Override
	public String selectEntrprsMberIdByNameAndEmail(EntrprsManageVO entrprsManageVO) {
		applyDefaultProjectId(entrprsManageVO);
		return entrprsManageMapper.selectEntrprsMberIdByNameAndEmail(entrprsManageVO);
	}

	@Override
	public List<CompanyListItemVO> searchCompanyList(String searchKeyword) throws Exception {
		return entrprsManageMapper.searchCompanyList(searchKeyword);
	}

	@Override
	public List<CompanyListItemVO> searchCompanyListPaged(java.util.Map<String, Object> params) throws Exception {
		applyDefaultProjectId(params);
		return entrprsManageMapper.searchCompanyListPaged(params);
	}

	@Override
	public int searchCompanyListTotCnt(java.util.Map<String, Object> params) throws Exception {
		applyDefaultProjectId(params);
		return entrprsManageMapper.searchCompanyListTotCnt(params);
	}

	@Override
	public List<CompanyListItemVO> searchCompanyListPaged(String keyword, String status, int offset, int pageSize) throws Exception {
		Map<String, Object> params = new HashMap<>();
		params.put("keyword", keyword == null ? "" : keyword.trim());
		params.put("status", status == null ? "" : status.trim());
		params.put("offset", offset);
		params.put("pageSize", pageSize);
		applyDefaultProjectId(params);
		return entrprsManageMapper.searchCompanyListPaged(params);
	}

	@Override
	public int searchCompanyListTotCnt(String keyword, String status) throws Exception {
		Map<String, Object> params = new HashMap<>();
		params.put("keyword", keyword == null ? "" : keyword.trim());
		params.put("status", status == null ? "" : status.trim());
		applyDefaultProjectId(params);
		return entrprsManageMapper.searchCompanyListTotCnt(params);
	}

	/**
	 * 화면에 조회된 기업회원의 기본정보를 수정하여 항목의 정합성을 체크하고 수정된 데이터를 데이터베이스에 반영
	 * 
	 * @param entrprsManageVO 기업회원수정정보
	 * @throws Exception
	 */
	@Override
	public void updateEntrprsmber(EntrprsManageVO entrprsManageVO) throws Exception {
		applyDefaultProjectId(entrprsManageVO);
		// 패스워드 암호화
		String pass = FileSecurityUtil.encryptPassword(entrprsManageVO.getEntrprsMberPassword(),
				StringUtil.isNullToString(entrprsManageVO.getEntrprsmberId()));// KISA 보안약점 조치 (2018-10-29, 윤창원)
		entrprsManageVO.setEntrprsMberPassword(pass);
		entrprsManageMapper.updateEntrprsmber(entrprsManageVO);
	}

	/**
	 * 화면에 조회된 기업회원의 정보를 데이터베이스에서 삭제
	 * 
	 * @param checkedIdForDel 삭제대상기업회원아이디
	 * @throws Exception
	 */
	@Override
	public void deleteEntrprsmber(String checkedIdForDel) {
		// log.debug("jjyser_delete-->"+checkedIdForDel);
		String[] delId = checkedIdForDel.split(",");
		for (int i = 0; i < delId.length; i++) {
			String[] id = delId[i].split(":");
			// log.debug("id[0]:"+id[0]);
			if (id[0].equals("USR03")) {
				// 업무사용자(직원)삭제
				userManageMapper.deleteUser(id[1]);
			} else if (id[0].equals("USR01")) {
				// 일반회원삭제
				mberManageMapper.deleteMber(id[1]);
			} else if (id[0].equals("USR02")) {
				// 기업회원삭제
				entrprsManageMapper.deleteEntrprsmber(id[1]);
			}
		}
	}

	/**
	 * 기업회원용 약관정보 조회
	 * 
	 * @param stplatId 기업회원약관아이디
	 * @return stplatList 기업회원약관정보
	 * @throws Exception
	 */
	@Override
	public List<StplatVO> selectStplat(String stplatId) {
		List<StplatVO> stplatList = entrprsManageMapper.selectStplat(stplatId);
		return stplatList;
	}

	/**
	 * 기업회원 암호 수정
	 * 
	 * @param passVO 기업회원수정정보(비밀번호)
	 * @throws Exception
	 */
	@Override
	public void updatePassword(EntrprsManageVO passVO) {
		entrprsManageMapper.updatePassword(passVO);
	}

	/**
	 * 기업회원이 비밀번호를 기억하지 못할 때 비밀번호를 찾을 수 있도록 함
	 * 
	 * @param passVO 기업회원암호 조회조건정보
	 * @return entrprsManageVO 기업회원암호정보
	 * @throws Exception
	 */
	@Override
	public EntrprsManageVO selectPassword(EntrprsManageVO passVO) {
		EntrprsManageVO entrprsManageVO = entrprsManageMapper.selectPassword(passVO);
		return entrprsManageVO;
	}

	/**
	 * 기 등록된기업 회원 중 검색조건에 맞는 회원들의 정보를 데이터베이스에서 읽어와 화면에 출력
	 * 
	 * @param userSearchVO 검색조건
	 * @return List<EntrprsManageVO> 기업회원목록정보
	 * @throws Exception
	 */
	@Override
	public List<EntrprsManageVO> selectEntrprsMberList(UserDefaultVO userSearchVO) {
		applyDefaultProjectId(userSearchVO);
		return entrprsManageMapper.selectEntrprsMberList(userSearchVO);
	}

	/**
	 * 기업회원 총 개수를 조회한다.
	 * 
	 * @param userSearchVO 검색조건
	 * @return 사용자 총 개수(int)
	 * @throws Exception
	 */
	@Override
	public int selectEntrprsMberListTotCnt(UserDefaultVO userSearchVO) {
		applyDefaultProjectId(userSearchVO);
		return entrprsManageMapper.selectEntrprsMberListTotCnt(userSearchVO);
	}

	/**
	 * 로그인인증제한 해제
	 * 
	 * @param entrprsManageVO 기업회원정보
	 * @return void
	 * @throws Exception
	 */
	@Override
	public void updateLockIncorrect(EntrprsManageVO entrprsManageVO) throws Exception {
		entrprsManageMapper.updateLockIncorrect(entrprsManageVO);
	}

	/**
	 * 아이디 중복 여부를 체크한다.
	 * 
	 * @param checkId 중복체크대상 아이디
	 * @return int 중복횟수(0이면 사용가능)
	 * @throws Exception
	 */
	@Override
	public int checkIdDplct(String checkId) throws Exception {
		return entrprsManageMapper.checkIdDplct(checkId);
	}

	/**
	 * 이메일 중복 여부를 체크한다.
	 * 
	 * @param checkEmail 중복체크대상 이메일
	 * @return int 중복횟수(0이면 사용가능)
	 * @throws Exception
	 */
	@Override
	public int checkEmailDplct(String checkEmail) throws Exception {
		return entrprsManageMapper.checkEmailDplct(checkEmail);
	}

	@Override
	public void insertInsttInfo(InsttInfoVO insttInfoVO) throws Exception {
		applyDefaultProjectId(insttInfoVO);
		entrprsManageMapper.insertInsttInfo(insttInfoVO);
	}

	@Override
	public void insertInsttFiles(List<InsttFileVO> fileList) throws Exception {
		if (fileList == null || fileList.isEmpty()) {
			return;
		}
		for (InsttFileVO fileVO : fileList) {
			if (fileVO == null) {
				continue;
			}
			entrprsManageMapper.insertInsttFile(fileVO);
		}
	}

	@Override
	public List<InsttFileVO> selectInsttFiles(String insttId) throws Exception {
		return entrprsManageMapper.selectInsttFiles(insttId);
	}

	@Override
	public InsttFileVO selectInsttFileByFileId(String fileId) throws Exception {
		return entrprsManageMapper.selectInsttFileByFileId(fileId);
	}

	@Override
	public int checkCompanyNameDplct(String checkNm) throws Exception {
		return entrprsManageMapper.checkCompanyNameDplct(checkNm);
	}

	@Override
	public InstitutionStatusVO selectInsttInfoForStatus(InsttInfoVO insttInfoVO) throws Exception {
		applyDefaultProjectId(insttInfoVO);
		return entrprsManageMapper.selectInsttInfoForStatus(insttInfoVO);
	}

	@Override
	public String selectLatestInsttStatusByBizrno(String bizrno) throws Exception {
		return entrprsManageMapper.selectLatestInsttStatusByBizrno(bizrno);
	}

	@Override
	public void ensureEnterpriseSecurityMapping(String esntlId) throws Exception {
		if (esntlId == null || esntlId.trim().isEmpty()) {
			return;
		}
		entrprsManageMapper.insertEnterpriseSecurityMappingIfAbsent(esntlId);
	}

	@Override
	public void updateInsttInfo(InsttInfoVO insttInfoVO) throws Exception {
		applyDefaultProjectId(insttInfoVO);
		entrprsManageMapper.updateInsttInfo(insttInfoVO);
	}

	private void applyDefaultProjectId(UserDefaultVO vo) {
		if (vo == null || hasText(vo.getProjectId())) {
			return;
		}
		vo.setProjectId(currentProjectId());
	}

	private void applyDefaultProjectId(EntrprsManageVO vo) {
		if (vo == null || hasText(vo.getProjectId())) {
			return;
		}
		vo.setProjectId(currentProjectId());
	}

	private void applyDefaultProjectId(InsttInfoVO vo) {
		if (vo == null || hasText(vo.getProjectId())) {
			return;
		}
		vo.setProjectId(currentProjectId());
	}

	private void applyDefaultProjectId(Map<String, Object> params) {
		if (params == null || hasText(stringValue(params.get("projectId")))) {
			return;
		}
		String projectId = currentProjectId();
		if (hasText(projectId)) {
			params.put("projectId", projectId);
		}
	}

	private String currentProjectId() {
		return projectRuntimeContext == null ? "" : stringValue(projectRuntimeContext.getProjectId()).trim();
	}

	private boolean hasText(String value) {
		return value != null && !value.trim().isEmpty();
	}

	private String stringValue(Object value) {
		return value == null ? "" : String.valueOf(value);
	}
}
