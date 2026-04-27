package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMemberRegisterSupportService {

    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public Map<String, Object> buildMemberRegisterPageData(boolean isEn) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("isEn", isEn);
        response.put("memberTypeOptions", List.of(
                buildOptionRow("enterprise", isEn ? "Enterprise (Emitter)" : "기업 (배출사업자)"),
                buildOptionRow("center", isEn ? "Promotion Center" : "진흥센터"),
                buildOptionRow("authority", isEn ? "Competent Authority" : "주무관청")));
        response.put("permissionOptions", List.of(
                buildOptionRow("READ", isEn ? "Data Inquiry" : "데이터 조회 권한"),
                buildOptionRow("WRITE", isEn ? "Data Entry / Edit" : "데이터 입력/수정 권한"),
                buildOptionRow("AUDIT", isEn ? "Certification Audit" : "인증 심사 권한"),
                buildOptionRow("REPORT", isEn ? "Report Download" : "통계 리포트 다운로드")));
        response.put("defaultOrganizationName", "");
        return response;
    }

    public List<AuthorInfoVO> loadGrantableMemberAuthorGroups(String currentUserId, String currentUserAuthorCode) throws Exception {
        return adminAuthorityPagePayloadSupport.filterAuthorGroups(
                authGroupManageService.selectAuthorList(),
                "USER",
                currentUserId,
                currentUserAuthorCode);
    }

    private Map<String, String> buildOptionRow(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }
}
