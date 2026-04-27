package egovframework.com.feature.home.service;

import egovframework.com.feature.home.model.vo.HomeMenuNode;

import java.util.List;

public interface HomeMenuService {

    List<HomeMenuNode> getHomeMenu(boolean isEn);
}
