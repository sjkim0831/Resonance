package egovframework.com.framework.contract.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderProfilesMetadataVO {

    private List<String> pageFrameProfileIds = new ArrayList<>();
    private List<String> layoutZoneIds = new ArrayList<>();
    private List<String> componentTypeIds = new ArrayList<>();
    private List<String> artifactUnitIds = new ArrayList<>();
}
