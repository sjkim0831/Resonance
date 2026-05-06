package egovframework.com.feature.emission.web;

import egovframework.com.feature.emission.service.EcoinventIntegrationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/api/emission/ecoinvent")
@RequiredArgsConstructor
public class EcoinventManagementApiController {

    private final EcoinventIntegrationService ecoinventIntegrationService;

    @PostMapping("/sync")
    public ResponseEntity<String> syncData(@RequestParam String query) {
        ecoinventIntegrationService.syncEcoinventData(query);
        return ResponseEntity.ok("Sync completed for: " + query);
    }
}
