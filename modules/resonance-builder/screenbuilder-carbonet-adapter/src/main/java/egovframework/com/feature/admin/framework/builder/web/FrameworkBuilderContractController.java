package egovframework.com.feature.admin.framework.builder.web;

import egovframework.com.framework.builder.model.FrameworkBuilderContractVO;
import egovframework.com.framework.builder.service.FrameworkBuilderContractService;
import egovframework.com.framework.builder.support.FrameworkBuilderRequestContextPort;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkApiResponseSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
@Slf4j
public class FrameworkBuilderContractController {

    private final FrameworkBuilderContractService frameworkBuilderContractService;
    private final FrameworkBuilderRequestContextPort frameworkBuilderRequestContextPort;
    private final CarbonetFrameworkApiResponseSource carbonetFrameworkApiResponseSource;

    @GetMapping("/api/admin/framework/builder-contract")
    @ResponseBody
    public ResponseEntity<?> getFrameworkBuilderContract(HttpServletRequest request,
                                                         Locale locale) {
        return carbonetFrameworkApiResponseSource.execute(
                () -> frameworkBuilderContractService.getBuilderContract(
                        frameworkBuilderRequestContextPort.isEnglishRequest(request, locale)),
                "Framework builder contract API failed.",
                log);
    }
}
