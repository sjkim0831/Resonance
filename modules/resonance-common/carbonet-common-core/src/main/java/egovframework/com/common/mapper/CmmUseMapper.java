package egovframework.com.common.mapper;

import java.util.List;

import org.springframework.stereotype.Component;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.model.ComDefaultCodeVO;
import egovframework.com.common.service.CmmnDetailCode;

/**
 * @Class Name : CmmUseMapper.java
 * @Description : 공통코드등 전체 업무에서 공용해서 사용해야 하는 서비스를 정의하기위한 데이터 접근 클래스
 * @Modification Information
 *
 *    수정일       수정자         수정내용
 *    -------        -------     -------------------
 *    2009. 3. 11.     이삼섭
 *
 * @author 공통 서비스 개발팀 이삼섭
 * @since 2009. 3. 11.
 * @version
 * @see
 *
 */
@Component("cmmUseMapper")
public class CmmUseMapper extends BaseMapperSupport {

    /**
     * 주어진 조건에 따른 공통코드를 불러온다.
     * 
     * @param vo
     * @return
     * @throws Exception
     */
    public List<CmmnDetailCode> selectCmmCodeDetail(ComDefaultCodeVO vo) throws Exception {
	return selectList("CmmUseMapper.selectCmmCodeDetail", vo);
    }

    /**
     * 공통코드로 사용할 조직정보를 를 불러온다.
     * 
     * @param vo
     * @return
     * @throws Exception
     */
    public List<CmmnDetailCode> selectOgrnztIdDetail(ComDefaultCodeVO vo) throws Exception {
	return selectList("CmmUseMapper.selectOgrnztIdDetail", vo);
    }

    /**
     * 공통코드로 사용할그룹정보를 를 불러온다.
     * @param vo
     * @return
     * @throws Exception
     */
    public List<CmmnDetailCode> selectGroupIdDetail(ComDefaultCodeVO vo) throws Exception {
	return selectList("CmmUseMapper.selectGroupIdDetail", vo);
    }
}
