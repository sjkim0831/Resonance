package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

@Getter
@Setter
@ToString
public class SystemAssetCompositionVO {
    private String compositionId;
    private String parentAssetId;
    private String childAssetId;
    private String relationType;
    private String mappingNotes;
    private LocalDateTime createdAt;
}
