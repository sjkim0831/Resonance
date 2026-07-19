package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.OpsCapabilityBridgeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping({"/admin/api/system/ops-bridge","/en/admin/api/system/ops-bridge"})
public class OpsCapabilityBridgeController {
    private final OpsCapabilityBridgeService service;
    public OpsCapabilityBridgeController(OpsCapabilityBridgeService service) { this.service = service; }

    @GetMapping public Map<String,Object> catalog() { return service.catalog(); }
    @GetMapping("/read/{capability}") public ResponseEntity<?> read(@PathVariable String capability) {
        try { return ResponseEntity.ok(service.read(capability)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage())); }
    }
    @PostMapping("/action/{capability}") public ResponseEntity<?> execute(@PathVariable String capability, @RequestBody(required=false) Map<String,Object> body) {
        try { return ResponseEntity.ok(service.execute(capability,body)); }
        catch (Exception e) { return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage())); }
    }
}
