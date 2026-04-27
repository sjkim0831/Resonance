package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AdminBoardDistributionSaveRequestDTO {

    private String draftId;
    private String boardType;
    private String audience;
    private String title;
    private String summary;
    private String body;
    private String publishAt;
    private String expireAt;
    private List<String> channels;
    private List<String> tags;
    private Boolean pinned;
    private Boolean urgent;
    private Boolean allowComments;
}
