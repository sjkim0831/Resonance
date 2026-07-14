package egovframework.com.feature.home.web;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequiredArgsConstructor
public class PublicReportCertificateController {
  private final EmissionProjectRegistryService service;
  @GetMapping({"/api/public/report-certificates/{certificateId}","/en/api/public/report-certificates/{certificateId}"})
  public Map<String,Object> verify(@PathVariable String certificateId){return service.verifyReportCertificate(certificateId);}
}
