package com.resonance.common.auth.controller;
import com.resonance.common.auth.entity.Author;
import com.resonance.common.auth.service.AuthService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    
    private final AuthService authService;
    
    public AuthController(AuthService authService) {
        this.authService = authService;
    }
    
    @GetMapping("/roles")
    public List<Author> getAllAuthors() {
        return authService.getAllAuthors();
    }
    
    @GetMapping("/roles/{authorCode}")
    public Author getAuthor(@PathVariable String authorCode) {
        return authService.getAuthor(authorCode);
    }
    
    @PostMapping("/roles")
    public Author createAuthor(@RequestBody Author author) {
        return authService.createAuthor(author);
    }
    
    @PutMapping("/roles/{authorCode}")
    public Author updateAuthor(@PathVariable String authorCode, @RequestBody Author author) {
        return authService.updateAuthor(authorCode, author);
    }
    
    @DeleteMapping("/roles/{authorCode}")
    public void deleteAuthor(@PathVariable String authorCode) {
        authService.deleteAuthor(authorCode);
    }
    
    @GetMapping("/roles/{authorCode}/menus")
    public Set<String> getAuthorMenus(@PathVariable String authorCode) {
        return authService.getAuthorMenus(authorCode);
    }
    
    @PostMapping("/roles/{authorCode}/menus/{menuId}")
    public void addMenuToAuthor(@PathVariable String authorCode, @PathVariable String menuId) {
        authService.addMenuToAuthor(authorCode, menuId);
    }
    
    @DeleteMapping("/roles/{authorCode}/menus/{menuId}")
    public void removeMenuFromAuthor(@PathVariable String authorCode, @PathVariable String menuId) {
        authService.removeMenuFromAuthor(authorCode, menuId);
    }
    
    @PutMapping("/roles/{authorCode}/menus")
    public void setAuthorMenus(@PathVariable String authorCode, @RequestBody Set<String> menuIds) {
        authService.setAuthorMenus(authorCode, menuIds);
    }
    
    @GetMapping("/users/{userId}/roles")
    public Set<String> getUserRoles(@PathVariable String userId) {
        return authService.getUserRoles(userId);
    }
    
    @PostMapping("/users/{userId}/roles/{authorCode}")
    public void assignRole(@PathVariable String userId, @PathVariable String authorCode) {
        authService.assignRoleToUser(userId, authorCode);
    }
    
    @DeleteMapping("/users/{userId}/roles/{authorCode}")
    public void removeRole(@PathVariable String userId, @PathVariable String authorCode) {
        authService.removeRoleFromUser(userId, authorCode);
    }
    
    @GetMapping("/check")
    public boolean hasMenuAccess(@RequestParam String authorCode, @RequestParam String menuId) {
        return authService.hasMenuAccess(authorCode, menuId);
    }
}