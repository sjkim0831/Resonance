package egovframework.com.platform.governance.service;

import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.feature.admin.model.vo.EmissionResultFilterSnapshot;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSummarySnapshot;
import egovframework.com.feature.admin.model.vo.SecurityAuditSnapshot;
import egovframework.com.platform.read.AdminSummaryReadPort;

import java.util.List;
import java.util.Map;

public interface AdminSummaryService extends AdminSummaryReadPort, AdminSummaryCommandService {

    FeatureCatalogSummarySnapshot summarizeFeatureCatalog(List<FeatureCatalogSectionVO> featureSections);
}
