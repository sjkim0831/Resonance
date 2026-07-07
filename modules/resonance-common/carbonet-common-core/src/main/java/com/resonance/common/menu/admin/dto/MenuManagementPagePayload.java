package com.resonance.common.menu.admin.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class MenuManagementPagePayload {
    private List<Map<String, Object>> menuRows;
    private List<Map<String, String>> menuTypes;
    private List<Map<String, String>> groupMenuOptions;
    private List<String> iconOptions;
    private List<String> useAtOptions;
    private String menuMgmtMessage;
    private String menuMgmtError;
}