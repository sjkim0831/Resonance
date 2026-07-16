package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.ScreenDevelopmentNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/admin/api/system/screen-development-note","/en/admin/api/system/screen-development-note"})
public class ScreenDevelopmentNoteApiController {
    private final ScreenDevelopmentNoteService service;

    @GetMapping public ResponseEntity<?> find(@RequestParam String routePath,Principal principal){
        if(principal==null)return ResponseEntity.status(401).body(Map.of("success",false,"message","로그인이 필요합니다."));
        try{return ResponseEntity.ok(service.find(routePath));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @PutMapping public ResponseEntity<?> save(@RequestBody Map<String,Object> body,Principal principal){
        if(principal==null)return ResponseEntity.status(401).body(Map.of("success",false,"message","로그인이 필요합니다."));
        try{return ResponseEntity.ok(service.save(body,principal.getName()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }
}
