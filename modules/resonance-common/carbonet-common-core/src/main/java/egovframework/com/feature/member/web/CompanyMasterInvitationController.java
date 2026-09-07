package egovframework.com.feature.member.web;

import egovframework.com.feature.home.web.ReactAppViewSupport;
import egovframework.com.feature.member.service.CompanyMasterInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@Controller
@RequestMapping("/join")
@RequiredArgsConstructor
public class CompanyMasterInvitationController {
    private final CompanyMasterInvitationService invitationService;
    private final ReactAppViewSupport reactAppViewSupport;

    @GetMapping({"/companyMasterInvite", "/en/companyMasterInvite"})
    public String page(Model model, jakarta.servlet.http.HttpServletRequest request) {
        return reactAppViewSupport.render(model, "join-company-master-invite", request.getRequestURI().contains("/en/"), false);
    }

    @GetMapping("/api/company-master-invitation")
    @ResponseBody
    public ResponseEntity<Map<String,Object>> inspect(@RequestParam String token) {
        Map<String,Object> body=invitationService.inspect(token);
        return ResponseEntity.status(Boolean.TRUE.equals(body.get("success"))?200:400).body(body);
    }

    @PostMapping("/api/company-master-invitation/activate")
    @ResponseBody
    public ResponseEntity<Map<String,Object>> activate(@RequestBody Map<String,Object> payload) {
        try {
            return ResponseEntity.ok(invitationService.activate(text(payload,"token"),text(payload,"insttId"),text(payload,"accountId"),text(payload,"password"),text(payload,"userName")));
        } catch (SecurityException e) { return error(403,e.getMessage()); }
        catch (org.springframework.dao.DuplicateKeyException e) { return error(409,e.getMessage()); }
        catch (IllegalArgumentException e) { return error(400,e.getMessage()); }
        catch (IllegalStateException e) { return error(410,e.getMessage()); }
    }
    private ResponseEntity<Map<String,Object>> error(int status,String message){Map<String,Object> b=new LinkedHashMap<>();b.put("success",false);b.put("message",message);return ResponseEntity.status(status).body(b);}
    private String text(Map<String,Object> p,String k){Object v=p==null?null:p.get(k);return v==null?"":String.valueOf(v).trim();}
}
