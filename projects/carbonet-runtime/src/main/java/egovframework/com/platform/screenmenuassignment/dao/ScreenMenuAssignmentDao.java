package egovframework.com.platform.screenmenuassignment.dao;

import egovframework.com.platform.screenmenuassignment.vo.ScreenMenuAssignmentVO;
import java.util.List;

public interface ScreenMenuAssignmentDao {
    List<ScreenMenuAssignmentVO> selectAssignmentList(ScreenMenuAssignmentVO searchVO) throws Exception;
    ScreenMenuAssignmentVO selectAssignmentById(String id) throws Exception;
    void insertAssignment(ScreenMenuAssignmentVO assignmentVO) throws Exception;
    void updateAssignment(ScreenMenuAssignmentVO assignmentVO) throws Exception;
    void deleteAssignment(String id) throws Exception;
}
