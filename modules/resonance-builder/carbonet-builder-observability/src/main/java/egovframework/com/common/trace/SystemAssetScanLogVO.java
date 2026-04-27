package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

@Getter
@Setter
@ToString
public class SystemAssetScanLogVO {
    private String scanId;
    private String assetId;
    private String previousHash;
    private String currentHash;
    private String scanResult;
    private String scanDetails;
    private LocalDateTime createdAt;
}
