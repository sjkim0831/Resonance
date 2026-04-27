package egovframework.com.feature.member.mapper;

import java.util.List;

import org.springframework.stereotype.Component;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.member.model.vo.DeptManageVO;

@Component("deptManageMapper")
public class DeptManageMapper extends BaseMapperSupport {

	/**
	 * 부서를 관리하기 위해 등록된 부서목록을 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return List - 부서 목록
	 * @exception Exception
	 */
	public List<DeptManageVO> selectDeptManageList(DeptManageVO deptManageVO) throws Exception {
		return selectList("deptManageMapper.selectDeptManageList", deptManageVO);
	}

    /**
	 * 부서목록 총 개수를 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return int - 부서 카운트 수
	 * @exception Exception
	 */
    public int selectDeptManageListTotCnt(DeptManageVO deptManageVO) throws Exception {
        return (Integer)selectOne("deptManageMapper.selectDeptManageListTotCnt", deptManageVO);
    }

	/**
	 * 등록된 부서의 상세정보를 조회한다.
	 * @param deptManageVO - 부서 Vo
	 * @return deptManageVO - 부서 Vo
	 * 
	 * @param bannerVO
	 */
	public DeptManageVO selectDeptManage(DeptManageVO deptManageVO) throws Exception {
		return (DeptManageVO) selectOne("deptManageMapper.selectDeptManage", deptManageVO);
	}

	/**
	 * 부서정보를 신규로 등록한다.
	 * @param deptManageVO - 부서 model
	 */
	public void insertDeptManage(DeptManageVO deptManageVO) throws Exception {
		insert("deptManageMapper.insertDeptManage", deptManageVO);
	}

	/**
	 * 기 등록된 부서정보를 수정한다.
	 * @param deptManageVO - 부서 model
	 */
	public void updateDeptManage(DeptManageVO deptManageVO) throws Exception {
        update("deptManageMapper.updateDeptManage", deptManageVO);
	}

	/**
	 * 기 등록된 부서정보를 삭제한다.
	 * @param deptManageVO - 부서 model
	 * 
	 * @param banner
	 */
	public void deleteDeptManage(DeptManageVO deptManageVO) throws Exception {
		delete("deptManageMapper.deleteDeptManage", deptManageVO);
	}

}
