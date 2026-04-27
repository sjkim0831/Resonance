package egovframework.com.platform.observability.service;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;
import egovframework.com.platform.service.observability.AdminAuthoritySelectionPort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class AdminAuthoritySelectionPortBridge implements AdminAuthoritySelectionPort {

    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    public AdminAuthoritySelectionPortBridge(AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport) {
        this.adminAuthorityPagePayloadSupport = adminAuthorityPagePayloadSupport;
    }

    @Override
    public String resolveSelectedInsttId(String insttId, List<Map<String, String>> companyOptions, boolean allowEmptySelection) {
        return adminAuthorityPagePayloadSupport.resolveSelectedInsttId(insttId, companyOptions, allowEmptySelection);
    }
}
