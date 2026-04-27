package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;

import java.util.List;
import java.util.Map;

public interface ScreenBuilderDraftStoragePort {

    ScreenBuilderDraftDocumentVO loadDraft(String menuCode) throws Exception;

    void saveDraft(ScreenBuilderDraftDocumentVO draft) throws Exception;

    ScreenBuilderDraftDocumentVO loadHistoryVersion(String menuCode, String versionId) throws Exception;

    List<ScreenBuilderDraftDocumentVO> listHistoryVersions(String menuCode) throws Exception;

    void saveHistorySnapshot(ScreenBuilderDraftDocumentVO draft, boolean preferDraftCopy) throws Exception;

    List<ScreenBuilderDraftDocumentVO> listAllDrafts() throws Exception;

    List<String> listHistoryMenuCodes() throws Exception;

    Map<String, Object> loadStatusSummaryProjection(String menuCode, boolean isEn) throws Exception;

    void saveStatusSummaryProjection(String menuCode, boolean isEn, Map<String, Object> projection) throws Exception;

    void deleteStatusSummaryProjection(String menuCode, boolean isEn) throws Exception;

    void deleteAllStatusSummaryProjections() throws Exception;
}
