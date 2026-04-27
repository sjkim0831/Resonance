package egovframework.com.feature.admin.service;

import egovframework.com.feature.admin.dto.request.EmissionSurveyCaseSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDatasetReplaceRequest;
import egovframework.com.feature.admin.dto.request.EmissionSurveyDraftSetSaveRequest;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

public interface AdminEmissionSurveyWorkbookService {

    Map<String, Object> getPagePayload(String actorId, String productName, boolean isEn);

    Map<String, Object> parseWorkbook(MultipartFile uploadFile,
                                      String actorId,
                                      String lciMajorCode,
                                      String lciMajorLabel,
                                      String lciMiddleCode,
                                      String lciMiddleLabel,
                                      String lciSmallCode,
                                      String lciSmallLabel,
                                      boolean isEn);

    Map<String, Object> previewSharedDatasetWorkbook(MultipartFile uploadFile, boolean isEn);

    Map<String, Object> replaceSharedDatasetWorkbook(MultipartFile uploadFile, boolean isEn);

    Map<String, Object> replaceSharedDatasetSections(EmissionSurveyDatasetReplaceRequest request, boolean isEn);

    Map<String, Object> getDataPagePayload(String actorId,
                                           String lciMajorCode,
                                           String lciMiddleCode,
                                           String lciSmallCode,
                                           String status,
                                           String datasetId,
                                           String logId,
                                           int pageIndex,
                                           int pageSize,
                                           boolean isEn);

    Map<String, Object> loadClassificationCaseDrafts(String lciMajorCode,
                                                     String lciMiddleCode,
                                                     String lciSmallCode,
                                                     String caseCode,
                                                     String productName,
                                                     String actorId,
                                                     boolean isEn);

    Map<String, Object> saveCaseDraft(EmissionSurveyCaseSaveRequest request, String actorId, boolean isEn);

    Map<String, Object> deleteCaseDraft(String sectionCode, String caseCode, String productName, String actorId, boolean isEn);

    Map<String, Object> saveDraftSet(EmissionSurveyDraftSetSaveRequest request, String actorId, boolean isEn);

    Map<String, Object> deleteDraftSet(String setId, boolean isEn);

    byte[] buildBlankTemplateBytes();

    byte[] buildAdminUploadBlankTemplateBytes();
}
