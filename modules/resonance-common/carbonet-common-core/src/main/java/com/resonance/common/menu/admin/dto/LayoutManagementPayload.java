package com.resonance.common.menu.admin.dto;

import java.util.ArrayList;
import java.util.List;

public class LayoutManagementPayload {
    public String pageId;
    public String routePath;
    public String menuCode;
    public String domainCode;
    public String layoutVersion;
    public String designTokenVersion;
    public String status;
    public Integer version;
    public String createdAt;
    public String updatedAt;
    public String createdBy;
    public String updatedBy;
    public List<LayoutSectionPayload> sections;
    public String themeId;

    public LayoutManagementPayload() {
        this.sections = new ArrayList<>();
    }

    public static class LayoutSectionPayload {
        public String sectionId;
        public String sectionName;
        public String sectionNameEn;
        public String description;
        public List<LayoutComponentPayload> components;
        public GridConfigPayload gridConfig;
        public SpacingConfigPayload spacingConfig;
        public ResponsiveConfigPayload responsiveConfig;

        public LayoutSectionPayload() {
            this.components = new ArrayList<>();
        }
    }

    public static class LayoutComponentPayload {
        public String componentId;
        public String instanceKey;
        public String layoutZone;
        public String componentType;
        public String[] propsSummary;
        public String conditionalRuleSummary;
        public String customClassName;
        public ResponsiveConfigPayload responsiveConfig;
    }

    public static class GridConfigPayload {
        public Integer columns;
        public String gap;
        public Integer mobileColumns;
        public Integer tabletColumns;
    }

    public static class SpacingConfigPayload {
        public String padding;
        public String margin;
        public String mobilePadding;
        public String tabletPadding;
    }

    public static class ResponsiveConfigPayload {
        public ResponsiveItem mobile;
        public ResponsiveItem tablet;
        public ResponsiveItem desktop;

        public static class ResponsiveItem {
            public Boolean hidden;
            public Integer order;
        }
    }
}