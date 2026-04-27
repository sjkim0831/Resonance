package egovframework.com.common.mapper;

import egovframework.com.common.help.HelpItemVO;
import egovframework.com.common.help.HelpPageVO;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("helpContentMapper")
public class HelpContentMapper extends BaseMapperSupport {

    public HelpPageVO selectHelpPage(String pageId) {
        return selectOne("HelpContentMapper.selectHelpPage", pageId);
    }

    public List<HelpItemVO> selectHelpItems(String pageId) {
        return selectList("HelpContentMapper.selectHelpItems", pageId);
    }

    public int countHelpPage(String pageId) {
        Integer count = selectOne("HelpContentMapper.countHelpPage", pageId);
        return count == null ? 0 : count;
    }

    public void insertHelpPage(HelpPageVO page) {
        insert("HelpContentMapper.insertHelpPage", page);
    }

    public void updateHelpPage(HelpPageVO page) {
        update("HelpContentMapper.updateHelpPage", page);
    }

    public void deleteHelpItems(String pageId) {
        delete("HelpContentMapper.deleteHelpItems", pageId);
    }

    public void insertHelpItem(HelpItemVO item) {
        insert("HelpContentMapper.insertHelpItem", item);
    }
}
