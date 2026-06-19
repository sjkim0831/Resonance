package com.resonance.common.menu.admin.controller;

import com.resonance.common.menu.admin.dto.*;
import com.resonance.common.menu.admin.service.AdminMenuService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/system/menu")
@CrossOrigin(origins = "*")
public class AdminMenuController {

    private final AdminMenuService adminMenuService;

    public AdminMenuController(AdminMenuService adminMenuService) {
        this.adminMenuService = adminMenuService;
    }

    @GetMapping("/page")
    public ResponseEntity<MenuManagementPagePayload> getMenuManagementPage(
            @RequestParam(defaultValue = "ADMIN") String menuType) {
        MenuManagementPagePayload payload = adminMenuService.getMenuManagementPage(menuType);
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/order")
    public ResponseEntity<Map<String, Object>> saveMenuOrder(
            @RequestParam String menuType,
            @RequestParam String orderPayload) {
        boolean success = adminMenuService.saveMenuOrder(menuType, orderPayload);
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        response.put("message", success ? "Menu order saved successfully" : "Failed to save menu order");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/toggle-exposure")
    public ResponseEntity<Map<String, Object>> toggleMenuExposure(
            @RequestParam String menuType,
            @RequestParam String menuCode,
            @RequestParam String expsrAt) {
        boolean success = adminMenuService.toggleMenuExposure(menuType, menuCode, expsrAt);
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        response.put("message", success ? "Menu exposure toggled" : "Failed to toggle menu exposure");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/create-page")
    public ResponseEntity<Map<String, Object>> createPageMenu(
            @RequestParam String menuType,
            @RequestParam String parentCode,
            @RequestParam String codeNm,
            @RequestParam(required = false) String codeDc,
            @RequestParam String menuUrl,
            @RequestParam(defaultValue = "web") String menuIcon,
            @RequestParam(defaultValue = "Y") String useAt) {
        CreatePageMenuResult result = adminMenuService.createPageMenu(
                menuType, parentCode, codeNm, codeDc, menuUrl, menuIcon, useAt);
        Map<String, Object> response = new HashMap<>();
        response.put("success", result.isSuccess());
        response.put("message", result.getMessage());
        response.put("createdCode", result.getCreatedCode());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/update-page")
    public ResponseEntity<Map<String, Object>> updatePageMenu(
            @RequestParam String menuCode,
            @RequestParam String codeNm,
            @RequestParam(required = false) String codeDc,
            @RequestParam String menuUrl,
            @RequestParam(defaultValue = "web") String menuIcon,
            @RequestParam(defaultValue = "Y") String useAt) {
        boolean success = adminMenuService.updatePageMenu(menuCode, codeNm, codeDc, menuUrl, menuIcon, useAt);
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        response.put("message", success ? "Menu updated successfully" : "Failed to update menu");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{menuCode}")
    public ResponseEntity<Map<String, Object>> deleteMenu(
            @PathVariable String menuCode) {
        boolean success = adminMenuService.deleteMenu(menuCode);
        Map<String, Object> response = new HashMap<>();
        response.put("success", success);
        response.put("message", success ? "Menu deleted successfully" : "Failed to delete menu");
        return ResponseEntity.ok(response);
    }
}