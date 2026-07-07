package com.resonance.common.menu.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class CreatePageMenuResult {
    private boolean success;
    private String message;
    private String createdCode;

    public static CreatePageMenuResult success(String createdCode) {
        return new CreatePageMenuResult(true, "Menu created successfully", createdCode);
    }

    public static CreatePageMenuResult failure(String message) {
        return new CreatePageMenuResult(false, message, null);
    }
}