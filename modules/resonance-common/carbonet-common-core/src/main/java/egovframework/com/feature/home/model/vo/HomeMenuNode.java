package egovframework.com.feature.home.model.vo;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class HomeMenuNode {

    private String code;
    private String label;
    private String url;
    private List<HomeMenuNode> sections = new ArrayList<>();
    private List<HomeMenuNode> items = new ArrayList<>();
}
