package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;

@Getter
@Setter
@ToString
public class SystemAssetInventoryVO {
    private String assetId;
    private String assetType;
    private String assetName;
    private String assetVersion;
    private String sourcePath;
    private String sourceSymbol;
    private String contentHash;
    private String assetFamily;
    private String ownerDomain;
    private String ownerScope;
    private String operatorOwner;
    private String serviceOwner;
    private String criticality;
    private String healthStatus;
    private LocalDateTime lastScanAt;
    private String activeYn;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
