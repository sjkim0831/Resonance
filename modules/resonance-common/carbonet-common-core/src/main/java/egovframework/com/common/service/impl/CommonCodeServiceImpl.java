package egovframework.com.common.service.impl;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import jakarta.annotation.Resource;

import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import egovframework.com.common.mapper.CmmUseMapper;
import egovframework.com.common.model.ComDefaultCodeVO;
import egovframework.com.common.service.CmmnDetailCode;
import egovframework.com.common.service.CommonCodeService;

/**
 * @Class Name : CommonCodeServiceImpl.java
 * @Description : 공통코드등 전체 업무에서 공용해서 사용해야 하는 서비스를 정의하기위한 서비스 구현 클래스
 * @Modification Information
 *
 *    수정일       수정자         수정내용
 *    -------        -------     -------------------
 *    2009. 3. 11.     이삼섭
 *    2024.10.29.	LeeBaekHaeng	@Override 표기
 *
 * @author 공통 서비스 개발팀 이삼섭
 * @since 2009. 3. 11.
 * @version
 * @see
 *
 */
@Service("CommonCodeService")
public class CommonCodeServiceImpl extends EgovAbstractServiceImpl implements CommonCodeService {

    @Resource(name = "cmmUseMapper")
    private CmmUseMapper cmmUseMapper;

    /**
     * 공통코드를 조회한다.
     *
     * @param vo
     * @return
     * @throws Exception
     */
	@Override
    public List<CmmnDetailCode> selectCmmCodeDetail(ComDefaultCodeVO vo) throws Exception {
    	return cmmUseMapper.selectCmmCodeDetail(vo);
    }

    /**
     * ComDefaultCodeVO의 리스트를 받아서 여러개의 코드 리스트를 맵에 담아서 리턴한다.
     *
     * @param voList
     * @return
     * @throws Exception
     */
	@Override
    public Map<String, List<CmmnDetailCode>> selectCmmCodeDetails(List<ComDefaultCodeVO> voList) throws Exception {
		ComDefaultCodeVO vo;
		Map<String, List<CmmnDetailCode>> map = new HashMap<String, List<CmmnDetailCode>>();

		Iterator<ComDefaultCodeVO> iter = voList.iterator();
		while (iter.hasNext()) {
			vo = iter.next();
		    map.put(vo.getCodeId(), cmmUseMapper.selectCmmCodeDetail(vo));
		}

		return map;
    }

    /**
     * 조직정보를 코드형태로 리턴한다.
     *
     * @param 조회조건정보 vo
     * @return 조직정보 List
     * @throws Exception
     */
	@Override
    public List<CmmnDetailCode> selectOgrnztIdDetail(ComDefaultCodeVO vo) throws Exception {
    	return cmmUseMapper.selectOgrnztIdDetail(vo);
    }

    /**
     * 그룹정보를 코드형태로 리턴한다.
     *
     * @param 조회조건정보 vo
     * @return 그룹정보 List
     * @throws Exception
     */
	@Override
    public List<CmmnDetailCode> selectGroupIdDetail(ComDefaultCodeVO vo) throws Exception {
    	return cmmUseMapper.selectGroupIdDetail(vo);
    }
}
