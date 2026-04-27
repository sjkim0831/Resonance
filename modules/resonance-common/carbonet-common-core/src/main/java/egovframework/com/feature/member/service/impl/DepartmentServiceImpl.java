package egovframework.com.feature.member.service.impl;

import java.util.List;

import jakarta.annotation.Resource;

import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import egovframework.com.feature.member.mapper.DeptManageMapper;
import egovframework.com.feature.member.model.vo.DeptManageVO;
import egovframework.com.feature.member.service.DepartmentService;

@Service("egovDeptManageService")
public class DepartmentServiceImpl extends EgovAbstractServiceImpl implements DepartmentService {
	
	@Resource(name="deptManageMapper")
    private DeptManageMapper deptManageMapper;

	/**
	 * 부서를 관리하기 위해 등록된 부서목록을 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return List - 부서 목록
	 * 
	 * @param deptManageVO
	 */
	public List<DeptManageVO> selectDeptManageList(DeptManageVO deptManageVO) throws Exception {
		return deptManageMapper.selectDeptManageList(deptManageVO);
	}

	/**
	 * 부서목록 총 개수를 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return int - 부서 카운트 수
	 * 
	 * @param deptManageVO
	 */
	public int selectDeptManageListTotCnt(DeptManageVO deptManageVO) throws Exception {
		return deptManageMapper.selectDeptManageListTotCnt(deptManageVO);
	}

	/**
	 * 등록된 부서의 상세정보를 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return deptManageVO - 부서 Vo
	 * 
	 * @param deptManageVO
	 */
	public DeptManageVO selectDeptManage(DeptManageVO deptManageVO) throws Exception {
		return deptManageMapper.selectDeptManage(deptManageVO);
	}

	/**
	 * 부서정보를 신규로 등록한다.
	 * @param deptManageVO - 부서 model
	 * 
	 * @param deptManageVO
	 */
	public void insertDeptManage(DeptManageVO deptManageVO) throws Exception {
		deptManageMapper.insertDeptManage(deptManageVO);
	}

	/**
	 * 기 등록된 부서정보를 수정한다.
	 * @param deptManageVO - 부서 model
	 * 
	 * @param deptManageVO
	 */
	public void updateDeptManage(DeptManageVO deptManageVO) throws Exception {
		deptManageMapper.updateDeptManage(deptManageVO);
	}

	/**
	 * 기 등록된 부서정보를 삭제한다.
	 * @param deptManageVO - 부서 model
	 * 
	 * @param deptManageVO
	 */
	public void deleteDeptManage(DeptManageVO deptManageVO) throws Exception {
		deptManageMapper.deleteDeptManage(deptManageVO);
	}
}
