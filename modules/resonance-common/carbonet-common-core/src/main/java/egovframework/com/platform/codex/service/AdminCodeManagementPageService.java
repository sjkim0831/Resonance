package egovframework.com.platform.codex.service;

import egovframework.com.platform.governance.model.vo.ClassCodeVO;
import egovframework.com.platform.governance.model.vo.CommonCodeVO;
import egovframework.com.platform.governance.model.vo.DetailCodeVO;
import egovframework.com.platform.governance.service.AdminCodeManageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCodeManagementPageService {

    private final AdminCodeManageService adminCodeManageService;

    public Map<String, Object> buildCodeManagementPageData(
            String detailCodeId,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> model = new LinkedHashMap<>();
        List<ClassCodeVO> classCodeList = Collections.emptyList();
        List<CommonCodeVO> codeList = Collections.emptyList();
        try {
            classCodeList = adminCodeManageService.selectClassCodeList();
            codeList = adminCodeManageService.selectCodeList();
        } catch (Exception e) {
            log.error("Failed to load code management lists.", e);
        }

        String selectedCodeId = safeString(detailCodeId).toUpperCase(Locale.ROOT);
        if (selectedCodeId.isEmpty() && !codeList.isEmpty()) {
            selectedCodeId = safeString(codeList.get(0).getCodeId()).toUpperCase(Locale.ROOT);
        }

        List<DetailCodeVO> detailCodeList;
        try {
            detailCodeList = adminCodeManageService.selectDetailCodeList(
                    selectedCodeId.isEmpty() ? null : selectedCodeId);
        } catch (Exception e) {
            log.error("Failed to load detail code list.", e);
            detailCodeList = Collections.emptyList();
        }

        Map<String, Integer> classCodeRefCounts = new LinkedHashMap<>();
        for (ClassCodeVO classCode : classCodeList) {
            String classCodeValue = safeString(classCode == null ? null : classCode.getClCode()).toUpperCase(Locale.ROOT);
            if (classCodeValue.isEmpty()) {
                continue;
            }
            try {
                classCodeRefCounts.put(classCodeValue, adminCodeManageService.countCodesByClass(classCodeValue));
            } catch (Exception e) {
                log.warn("Failed to count linked code groups. clCode={}", classCodeValue, e);
                classCodeRefCounts.put(classCodeValue, 0);
            }
        }

        Map<String, Integer> codeDetailRefCounts = new LinkedHashMap<>();
        for (CommonCodeVO commonCode : codeList) {
            String codeIdValue = safeString(commonCode == null ? null : commonCode.getCodeId()).toUpperCase(Locale.ROOT);
            if (codeIdValue.isEmpty()) {
                continue;
            }
            try {
                codeDetailRefCounts.put(codeIdValue, adminCodeManageService.countDetailCodesByCodeId(codeIdValue));
            } catch (Exception e) {
                log.warn("Failed to count linked detail codes. codeId={}", codeIdValue, e);
                codeDetailRefCounts.put(codeIdValue, 0);
            }
        }

        model.put("clCodeList", classCodeList);
        model.put("codeList", codeList);
        model.put("detailCodeList", detailCodeList);
        model.put("detailCodeId", selectedCodeId);
        model.put("classCodeRefCounts", classCodeRefCounts);
        model.put("codeDetailRefCounts", codeDetailRefCounts);
        model.put("useAtOptions", List.of("Y", "N"));

        String message = safeString(request == null ? null : request.getParameter("message"));
        if (!message.isEmpty()) {
            model.put("codeMgmtMessage", message);
        }
        String errorMessage = safeString(request == null ? null : request.getParameter("errorMessage"));
        if (!errorMessage.isEmpty()) {
            model.put("codeMgmtError", errorMessage);
        }
        return model;
    }

    private String safeString(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
