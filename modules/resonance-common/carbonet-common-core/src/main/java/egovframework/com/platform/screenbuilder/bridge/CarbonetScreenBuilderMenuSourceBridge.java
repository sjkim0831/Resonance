package egovframework.com.platform.screenbuilder.bridge;

import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderMenuSource;
import egovframework.com.platform.screenbuilder.support.model.CarbonetScreenBuilderMenuItem;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class CarbonetScreenBuilderMenuSourceBridge implements CarbonetScreenBuilderMenuSource {

    private final MenuInfoService menuInfoService;

    public CarbonetScreenBuilderMenuSourceBridge(MenuInfoService menuInfoService) {
        this.menuInfoService = menuInfoService;
    }

    @Override
    public List<CarbonetScreenBuilderMenuItem> selectMenuTreeList(String codeId) throws Exception {
        List<CarbonetScreenBuilderMenuItem> items = new ArrayList<>();
        for (MenuInfoDTO row : menuInfoService.selectMenuTreeList(codeId)) {
            CarbonetScreenBuilderMenuItem item = new CarbonetScreenBuilderMenuItem();
            item.setMenuCode(safe(row == null ? null : row.getMenuCode()));
            item.setCode(safe(row == null ? null : row.getCode()));
            item.setMenuTitle(safe(row == null ? null : row.getCodeNm()));
            item.setMenuUrl(safe(row == null ? null : row.getMenuUrl()));
            items.add(item);
        }
        return items;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
