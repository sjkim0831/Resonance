package egovframework.com.platform.screenmenuassignment.service.impl;

import egovframework.com.platform.screenmenuassignment.service.ScreenMenuAssignmentService;
import egovframework.com.platform.screenmenuassignment.dao.ScreenMenuAssignmentDao;
import egovframework.com.platform.screenmenuassignment.vo.ScreenMenuAssignmentVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ScreenMenuAssignmentServiceImpl implements ScreenMenuAssignmentService {

    @Autowired
    private ScreenMenuAssignmentDao screenMenuAssignmentDao;

    @Override
    public List<ScreenMenuAssignmentVO> selectAssignmentList(ScreenMenuAssignmentVO searchVO) throws Exception {
        return screenMenuAssignmentDao.selectAssignmentList(searchVO);
    }

    @Override
    public ScreenMenuAssignmentVO selectAssignmentById(String id) throws Exception {
        return screenMenuAssignmentDao.selectAssignmentById(id);
    }

    @Override
    public void insertAssignment(ScreenMenuAssignmentVO assignmentVO) throws Exception {
        screenMenuAssignmentDao.insertAssignment(assignmentVO);
    }

    @Override
    public void updateAssignment(ScreenMenuAssignmentVO assignmentVO) throws Exception {
        screenMenuAssignmentDao.updateAssignment(assignmentVO);
    }

    @Override
    public void deleteAssignment(String id) throws Exception {
        screenMenuAssignmentDao.deleteAssignment(id);
    }
}
