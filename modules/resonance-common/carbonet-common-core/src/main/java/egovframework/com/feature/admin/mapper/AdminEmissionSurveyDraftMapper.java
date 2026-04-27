package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminEmissionSurveyDraftMapper")
public class AdminEmissionSurveyDraftMapper extends BaseMapperSupport {

    public int countCaseTable() {
        Integer count = selectOne("AdminEmissionSurveyDraftMapper.countCaseTable");
        return count == null ? 0 : count;
    }

    public int countUploadLogTable() {
        Integer count = selectOne("AdminEmissionSurveyDraftMapper.countUploadLogTable");
        return count == null ? 0 : count;
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectCaseHeaders() {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectCaseHeaders");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectCaseHeadersByClassification(Map<String, Object> params) {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectCaseHeadersByClassification", params);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectDatasetSummaries(Map<String, Object> params) {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectDatasetSummaries", params);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectDatasetSections(Map<String, Object> params) {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectDatasetSections", params);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectUploadLogs(Map<String, Object> params) {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectUploadLogs", params);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectCaseRows(String caseId) {
        return (List<Map<String, Object>>) (List<?>) selectList("AdminEmissionSurveyDraftMapper.selectCaseRows", caseId);
    }

    public void insertCaseHeader(Map<String, Object> params) {
        insert("AdminEmissionSurveyDraftMapper.insertCaseHeader", params);
    }

    public int updateCaseHeaderByCaseId(Map<String, Object> params) {
        return update("AdminEmissionSurveyDraftMapper.updateCaseHeaderByCaseId", params);
    }

    public void deleteCaseRows(String caseId) {
        delete("AdminEmissionSurveyDraftMapper.deleteCaseRows", caseId);
    }

    public void deleteCaseHeader(String caseId) {
        delete("AdminEmissionSurveyDraftMapper.deleteCaseHeader", caseId);
    }

    public void insertCaseRow(Map<String, Object> params) {
        insert("AdminEmissionSurveyDraftMapper.insertCaseRow", params);
    }

    public void insertUploadLog(Map<String, Object> params) {
        insert("AdminEmissionSurveyDraftMapper.insertUploadLog", params);
    }

    public void deleteUploadLogsByOwnerActorId(String ownerActorId) {
        delete("AdminEmissionSurveyDraftMapper.deleteUploadLogsByOwnerActorId", ownerActorId);
    }
}
