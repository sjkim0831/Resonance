package com.resonance.common.menu.controller;

import com.resonance.common.menu.entity.MenuGroup;
import com.resonance.common.menu.entity.MenuInfo;
import com.resonance.common.menu.service.MenuService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Menu Management REST Controller
 */
@RestController
@RequestMapping("/api/menu")
@CrossOrigin(origins = "*")
public class MenuController {
    
    private final MenuService menuService;
    
    public MenuController(MenuService menuService) {
        this.menuService = menuService;
    }
    
    // === Menu Group APIs ===
    
    @GetMapping("/groups")
    public List<MenuGroup> getAllMenuGroups() {
        return menuService.getAllMenuGroups();
    }
    
    @GetMapping("/groups/{menuGroupId}")
    public MenuGroup getMenuGroup(@PathVariable String menuGroupId) {
        return menuService.getMenuGroup(menuGroupId);
    }
    
    @PostMapping("/groups")
    public MenuGroup createMenuGroup(@RequestBody MenuGroup group) {
        return menuService.createMenuGroup(group);
    }
    
    @PutMapping("/groups/{menuGroupId}")
    public MenuGroup updateMenuGroup(@PathVariable String menuGroupId, @RequestBody MenuGroup group) {
        return menuService.updateMenuGroup(menuGroupId, group);
    }
    
    @DeleteMapping("/groups/{menuGroupId}")
    public void deleteMenuGroup(@PathVariable String menuGroupId) {
        menuService.deleteMenuGroup(menuGroupId);
    }
    
    // === Menu APIs ===
    
    @GetMapping
    public List<MenuInfo> getAllMenus() {
        return menuService.getAllMenus();
    }
    
    @GetMapping("/tree")
    public List<MenuInfo> getMenuTree() {
        return menuService.getMenuTree();
    }
    
    @GetMapping("/{menuId}")
    public MenuInfo getMenu(@PathVariable String menuId) {
        return menuService.getMenu(menuId);
    }
    
    @PostMapping
    public MenuInfo createMenu(@RequestBody MenuInfo menu) {
        return menuService.createMenu(menu);
    }
    
    @PutMapping("/{menuId}")
    public MenuInfo updateMenu(@PathVariable String menuId, @RequestBody MenuInfo menu) {
        return menuService.updateMenu(menuId, menu);
    }
    
    @DeleteMapping("/{menuId}")
    public void deleteMenu(@PathVariable String menuId) {
        menuService.deleteMenu(menuId);
    }
    
    @GetMapping("/group/{menuGroupId}")
    public List<MenuInfo> getMenusByGroup(@PathVariable String menuGroupId) {
        return menuService.getMenusByGroup(menuGroupId);
    }
    
    // === Authority APIs ===
    
    @GetMapping("/{menuId}/access")
    public boolean hasMenuAccess(@PathVariable String menuId, @RequestParam String roleCode) {
        return menuService.hasMenuAccess(menuId, roleCode);
    }
    
    @GetMapping("/authorized")
    public List<MenuInfo> getAuthorizedMenus(@RequestParam String roleCode) {
        return menuService.getAuthorizedMenus(roleCode);
    }

    // === Screen Builder Integration APIs ===

    @GetMapping("/screens")
    public List<MenuService.ScreenInfo> getAllScreens() {
        return menuService.getAllScreens();
    }

    @GetMapping("/screens/{menuCode}")
    public MenuService.ScreenInfo getScreen(@PathVariable String menuCode) {
        return menuService.getScreenByMenuCode(menuCode);
    }

    @PutMapping("/screens/{menuCode}")
    public MenuService.ScreenInfo updateScreen(@PathVariable String menuCode, @RequestBody MenuService.ScreenInfo screen) {
        MenuService.ScreenInfo existing = menuService.getScreenByMenuCode(menuCode);
        if (existing != null) {
            existing.setNodes(screen.getNodes());
            existing.setEvents(screen.getEvents());
            return existing;
        }
        return null;
    }
}
