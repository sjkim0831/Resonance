package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ScreenDevelopmentNoteService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/admin/api/system/screen-development-note","/en/admin/api/system/screen-development-note"})
public class ScreenDevelopmentNoteApiController {
    private final ScreenDevelopmentNoteService service;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping public ResponseEntity<?> find(@RequestParam String routePath,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return unauthorized();
        try{return ResponseEntity.ok(service.find(routePath));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @PutMapping public ResponseEntity<?> save(@RequestBody Map<String,Object> body,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return unauthorized();
        try{return ResponseEntity.ok(service.save(body,context.getUserId()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @PutMapping("/mockups/{slotNo}") public ResponseEntity<?> saveMockup(@PathVariable int slotNo,@RequestBody Map<String,Object> body,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return unauthorized();
        try{return ResponseEntity.ok(service.saveMockup(slotNo,body,context.getUserId()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @PostMapping("/mockups/{slotNo}/select") public ResponseEntity<?> selectMockup(@PathVariable int slotNo,@RequestBody Map<String,Object> body,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return unauthorized();
        try{return ResponseEntity.ok(service.selectMockup(slotNo,body,context.getUserId()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    private ResponseEntity<?> unauthorized(){
        return ResponseEntity.status(401).body(Map.of("success",false,"message","로그인이 필요합니다."));
    }
}
