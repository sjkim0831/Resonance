package egovframework.com.platform.observability.service;

import egovframework.com.platform.observability.model.LoginHistoryVO;
import egovframework.com.feature.admin.web.AdminListPageModelAssembler;
import egovframework.com.platform.service.observability.history.LoginHistoryDatasetSnapshot;
import egovframework.com.platform.service.observability.history.LoginHistoryRowSnapshot;
import egovframework.com.platform.service.observability.history.PlatformObservabilityHistoryDataPort;
import org.springframework.stereotype.Service;
import org.springframework.ui.ExtendedModelMap;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PlatformObservabilityHistoryDataPortBridge implements PlatformObservabilityHistoryDataPort {

    private final AdminListPageModelAssembler adminListPageModelAssembler;

    public PlatformObservabilityHistoryDataPortBridge(AdminListPageModelAssembler adminListPageModelAssembler) {
        this.adminListPageModelAssembler = adminListPageModelAssembler;
    }

    @Override
    public LoginHistoryDatasetSnapshot loadBlockedLoginHistoryDataset(String searchKeyword, String userSe, String requestedInsttId,
                                                                     HttpServletRequest request) {
        AdminListPageModelAssembler.LoginHistoryDataset dataset =
                adminListPageModelAssembler.loadBlockedLoginHistoryDataset(searchKeyword, userSe, requestedInsttId, request);
        LoginHistoryDatasetSnapshot snapshot = new LoginHistoryDatasetSnapshot();
        snapshot.setRows(toRows(dataset == null ? null : dataset.getRows()));
        snapshot.setTotalCount(dataset == null ? 0 : dataset.getTotalCount());
        snapshot.setKeyword(dataset == null ? "" : dataset.getKeyword());
        snapshot.setNormalizedUserSe(dataset == null ? "" : dataset.getNormalizedUserSe());
        snapshot.setNormalizedLoginResult(dataset == null ? "" : dataset.getNormalizedLoginResult());
        snapshot.setCompanyOptions(dataset == null ? List.of() : dataset.getCompanyOptions());
        snapshot.setSelectedInsttId(dataset == null ? "" : dataset.getSelectedInsttId());
        snapshot.setMasterAccess(dataset != null && dataset.isMasterAccess());
        return snapshot;
    }

    @Override
    public Map<String, Object> buildLoginHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                            String loginResult, String insttId, HttpServletRequest request,
                                                            boolean isEn) {
        ExtendedModelMap model = new ExtendedModelMap();
        adminListPageModelAssembler.populateLoginHistory(pageIndexParam, searchKeyword, userSe, loginResult, insttId, model, request);
        model.addAttribute("isEn", isEn);
        return new LinkedHashMap<>(model);
    }

    private List<LoginHistoryRowSnapshot> toRows(List<LoginHistoryVO> rows) {
        List<LoginHistoryRowSnapshot> snapshots = new ArrayList<>();
        if (rows == null) {
            return snapshots;
        }
        for (LoginHistoryVO row : rows) {
            LoginHistoryRowSnapshot snapshot = new LoginHistoryRowSnapshot();
            snapshot.setHistId(row == null ? "" : row.getHistId());
            snapshot.setUserId(row == null ? "" : row.getUserId());
            snapshot.setUserNm(row == null ? "" : row.getUserNm());
            snapshot.setUserSe(row == null ? "" : row.getUserSe());
            snapshot.setLoginResult(row == null ? "" : row.getLoginResult());
            snapshot.setLoginIp(row == null ? "" : row.getLoginIp());
            snapshot.setLoginMessage(row == null ? "" : row.getLoginMessage());
            snapshot.setLoginPnttm(row == null ? "" : row.getLoginPnttm());
            snapshot.setInsttId(row == null ? "" : row.getInsttId());
            snapshot.setCompanyName(row == null ? "" : row.getCompanyName());
            snapshots.add(snapshot);
        }
        return snapshots;
    }
}
