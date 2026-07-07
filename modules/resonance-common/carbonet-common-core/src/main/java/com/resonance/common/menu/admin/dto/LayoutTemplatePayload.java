package com.resonance.common.menu.admin.dto;

import java.util.ArrayList;
import java.util.List;

public class LayoutTemplatePayload {
    public String templateId;
    public String templateName;
    public String templateNameEn;
    public String description;
    public String thumbnail;
    public List<LayoutManagementPayload.LayoutSectionPayload> sections;
    public String category;
    public String[] tags;
    public Boolean isPublic;
    public String createdAt;
    public String updatedAt;

    public LayoutTemplatePayload() {
        this.sections = new ArrayList<>();
        this.tags = new String[0];
    }
}