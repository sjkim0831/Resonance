package egovframework.com.platform.codex.service.impl;

import egovframework.com.platform.governance.service.WbsManagementService;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.download.BinaryDownloadGate;
import egovframework.com.platform.executiongate.download.BinaryDownloadGateRequest;
import egovframework.com.platform.executiongate.download.BinaryDownloadGateResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class WbsBinaryDownloadGateService implements BinaryDownloadGate {

    private static final String XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final DateTimeFormatter FILE_TS = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final WbsManagementService wbsManagementService;

    public WbsBinaryDownloadGateService(WbsManagementService wbsManagementService) {
        this.wbsManagementService = wbsManagementService;
    }

    @Override
    public BinaryDownloadGateResponse download(BinaryDownloadGateRequest request) {
        if (!"wbs.excel.download".equals(safe(request.downloadKey()))) {
            throw new IllegalArgumentException("Unsupported binary download: " + request.downloadKey());
        }
        String menuType = stringParam(request, "menuType");
        String statusFilter = stringParam(request, "statusFilter");
        String searchKeyword = stringParam(request, "searchKeyword");
        byte[] content = wbsManagementService.buildExcel(menuType, statusFilter, searchKeyword);
        String scope = "USER".equalsIgnoreCase(menuType) ? "home" : "admin";
        String fileName = "wbs_" + scope + "_" + LocalDateTime.now().format(FILE_TS) + ".xlsx";
        return new BinaryDownloadGateResponse(
                request.context() == null ? ExecutionGateVersion.CURRENT : request.context().executionGateVersion(),
                request.downloadKey(),
                XLSX_CONTENT_TYPE,
                fileName,
                content
        );
    }

    private String stringParam(BinaryDownloadGateRequest request, String key) {
        Object value = request.parameters().get(key);
        return value == null ? "" : safe(String.valueOf(value));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
