package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminAuthChangeSaveRequestDTO;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/authority-change")
@RequiredArgsConstructor
public class UserAuthorityRelayController {
    private final AdminAuthorityCommandService service;

    @PostMapping("/request")
    public ResponseEntity<Map<String,Object>> request(@RequestBody AdminAuthChangeSaveRequestDTO payload, HttpServletRequest request, Locale locale) {
        AdminAuthorityCommandService.CommandResult result=service.saveAuthChange(payload,request,locale);
        return ResponseEntity.status(result.getStatus()).body(result.getBody());
    }
    @GetMapping("/relay")
    public ResponseEntity<Map<String,Object>> queue(HttpServletRequest request, Locale locale) {
        AdminAuthorityCommandService.CommandResult result=service.authChangeRelayQueue(request,locale);
        return ResponseEntity.status(result.getStatus()).body(result.getBody());
    }
    @PostMapping("/relay/action")
    public ResponseEntity<Map<String,Object>> action(@RequestBody Map<String,String> payload,HttpServletRequest request,Locale locale) {
        AdminAuthorityCommandService.CommandResult result=service.authChangeRelayAction(payload,request,locale);
        return ResponseEntity.status(result.getStatus()).body(result.getBody());
    }
}
