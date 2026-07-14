package egovframework.com.feature.home.web;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController @RequiredArgsConstructor
public class PublicReportCertificateController {
  private final EmissionProjectRegistryService service;
  @GetMapping({"/public/api/report-certificates/{certificateId}","/en/public/api/report-certificates/{certificateId}"})
  public Map<String,Object> verify(@PathVariable String certificateId){return service.verifyReportCertificate(certificateId);}
}
