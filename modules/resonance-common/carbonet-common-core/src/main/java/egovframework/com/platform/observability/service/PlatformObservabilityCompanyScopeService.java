package egovframework.com.platform.observability.service;

import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformObservabilityCompanyScopeService {

    private final EnterpriseMemberService enterpriseMemberService;

    public List<Map<String, String>> loadAccessHistoryCompanyOptions() {
        try {
            Map<String, Object> searchParams = new LinkedHashMap<>();
            searchParams.put("keyword", "");
            searchParams.put("status", "");
            searchParams.put("offset", 0);
            searchParams.put("pageSize", 500);
            List<?> companies = enterpriseMemberService.searchCompanyListPaged(searchParams);
            Map<String, String> dedup = new LinkedHashMap<>();
            for (Object item : companies) {
                String insttId = "";
                String cmpnyNm = "";
                if (item instanceof CompanyListItemVO) {
                    CompanyListItemVO company = (CompanyListItemVO) item;
                    insttId = safeString(company.getInsttId());
                    cmpnyNm = safeString(company.getCmpnyNm());
                } else if (item instanceof Map<?, ?>) {
                    Map<?, ?> row = (Map<?, ?>) item;
                    insttId = stringValue(row.get("insttId"));
                    if (insttId.isEmpty()) {
                        insttId = stringValue(row.get("INSTT_ID"));
                    }
                    cmpnyNm = stringValue(row.get("cmpnyNm"));
                    if (cmpnyNm.isEmpty()) {
                        cmpnyNm = stringValue(row.get("CMPNY_NM"));
                    }
                }
                if (!insttId.isEmpty() && !dedup.containsKey(insttId)) {
                    dedup.put(insttId, cmpnyNm);
                }
            }
            List<Map<String, String>> options = new ArrayList<>();
            for (Map.Entry<String, String> entry : dedup.entrySet()) {
                Map<String, String> option = new LinkedHashMap<>();
                option.put("insttId", entry.getKey());
                option.put("cmpnyNm", entry.getValue());
                options.add(option);
            }
            return options;
        } catch (Exception e) {
            log.warn("Failed to load access history company options.", e);
            return Collections.emptyList();
        }
    }

    public List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, String>> masterOptions = loadAccessHistoryCompanyOptions();
        if (masterOptions.isEmpty()) {
            Map<String, String> fallback = new LinkedHashMap<>();
            fallback.put("insttId", normalizedInsttId);
            fallback.put("cmpnyNm", normalizedInsttId);
            return Collections.singletonList(fallback);
        }
        return masterOptions.stream()
                .filter(option -> normalizedInsttId.equals(option.get("insttId")))
                .collect(Collectors.toList());
    }

    public String resolveCompanyNameByInsttId(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return "";
        }
        try {
            egovframework.com.feature.member.model.vo.InsttInfoVO searchVO = new egovframework.com.feature.member.model.vo.InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            egovframework.com.feature.member.model.vo.InstitutionStatusVO institution = enterpriseMemberService.selectInsttInfoForStatus(searchVO);
            String companyName = institution == null ? "" : safeString(institution.getInsttNm());
            return companyName.isEmpty() ? normalizedInsttId : companyName;
        } catch (Exception e) {
            log.warn("Failed to resolve company name. insttId={}", normalizedInsttId, e);
            return normalizedInsttId;
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
