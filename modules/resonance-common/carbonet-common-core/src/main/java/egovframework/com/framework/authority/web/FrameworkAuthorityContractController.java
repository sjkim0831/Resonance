package egovframework.com.framework.authority.web;

import egovframework.com.framework.authority.model.FrameworkAuthorityContractVO;
import egovframework.com.framework.authority.service.FrameworkAuthorityContractService;
import egovframework.com.framework.web.FrameworkApiResponseSupport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
@Slf4j
public class FrameworkAuthorityContractController {

    private final FrameworkAuthorityContractService frameworkAuthorityContractService;

    @GetMapping("/api/admin/framework/authority-contract")
    @ResponseBody
    public ResponseEntity<?> getFrameworkAuthorityContract() {
        return FrameworkApiResponseSupport.execute(
                frameworkAuthorityContractService::getAuthorityContract,
                "Framework authority contract API failed.",
                log);
    }
}
