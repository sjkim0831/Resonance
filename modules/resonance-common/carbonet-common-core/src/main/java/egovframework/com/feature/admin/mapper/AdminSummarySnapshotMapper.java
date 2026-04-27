package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.admin.model.vo.AdminSummarySnapshotVO;
import org.springframework.stereotype.Component;

@Component("adminSummarySnapshotMapper")
public class AdminSummarySnapshotMapper extends BaseMapperSupport {

    public AdminSummarySnapshotVO selectSnapshotByKey(String snapshotKey) {
        return selectOne("AdminSummarySnapshotMapper.selectSnapshotByKey", snapshotKey);
    }

    public int countSnapshotByKey(String snapshotKey) {
        Integer count = selectOne("AdminSummarySnapshotMapper.countSnapshotByKey", snapshotKey);
        return count == null ? 0 : count;
    }

    public void insertSnapshot(AdminSummarySnapshotVO snapshot) {
        insert("AdminSummarySnapshotMapper.insertSnapshot", snapshot);
    }

    public void updateSnapshot(AdminSummarySnapshotVO snapshot) {
        update("AdminSummarySnapshotMapper.updateSnapshot", snapshot);
    }
}
