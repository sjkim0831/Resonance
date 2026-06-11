package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class BuilderThemeVO {
    private String themeId;
    private String themeName;
    private String description;
    private String themeType;
    private Boolean isDefault;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}