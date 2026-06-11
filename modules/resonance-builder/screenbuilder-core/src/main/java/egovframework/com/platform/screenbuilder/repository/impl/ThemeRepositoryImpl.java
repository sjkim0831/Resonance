package egovframework.com.platform.screenbuilder.repository.impl;

import egovframework.com.platform.screenbuilder.model.BuilderThemeVO;
import egovframework.com.platform.screenbuilder.repository.ThemeRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Repository
public class ThemeRepositoryImpl implements ThemeRepository {

    private final Map<String, BuilderThemeVO> store = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        createSampleThemes();
    }

    private void createSampleThemes() {
        BuilderThemeVO defaultLight = new BuilderThemeVO();
        defaultLight.setThemeId("THEME001");
        defaultLight.setThemeName("Default Light");
        defaultLight.setDescription("기본 라이트 테마");
        defaultLight.setThemeType("SYSTEM");
        defaultLight.setIsDefault(true);
        defaultLight.setCreatedAt(LocalDateTime.now());
        defaultLight.setUpdatedAt(LocalDateTime.now());
        store.put(defaultLight.getThemeId(), defaultLight);

        BuilderThemeVO defaultDark = new BuilderThemeVO();
        defaultDark.setThemeId("THEME002");
        defaultDark.setThemeName("Default Dark");
        defaultDark.setDescription("기본 다크 테마");
        defaultDark.setThemeType("SYSTEM");
        defaultDark.setIsDefault(false);
        defaultDark.setCreatedAt(LocalDateTime.now());
        defaultDark.setUpdatedAt(LocalDateTime.now());
        store.put(defaultDark.getThemeId(), defaultDark);

        BuilderThemeVO dashboard = new BuilderThemeVO();
        dashboard.setThemeId("THEME003");
        dashboard.setThemeName("Dashboard");
        dashboard.setDescription("대시보드용 다크 테마");
        dashboard.setThemeType("CUSTOM");
        dashboard.setIsDefault(false);
        dashboard.setCreatedAt(LocalDateTime.now());
        dashboard.setUpdatedAt(LocalDateTime.now());
        store.put(dashboard.getThemeId(), dashboard);
    }

    @Override
    public BuilderThemeVO save(BuilderThemeVO theme) {
        if (theme.getCreatedAt() == null) {
            theme.setCreatedAt(LocalDateTime.now());
        }
        theme.setUpdatedAt(LocalDateTime.now());
        store.put(theme.getThemeId(), theme);
        return theme;
    }

    @Override
    public Optional<BuilderThemeVO> findById(String themeId) {
        return Optional.ofNullable(store.get(themeId));
    }

    @Override
    public List<BuilderThemeVO> findAll() {
        return store.values().stream()
                .sorted(Comparator.comparing(BuilderThemeVO::getThemeName))
                .collect(Collectors.toList());
    }

    @Override
    public List<BuilderThemeVO> findByThemeType(String themeType) {
        return store.values().stream()
                .filter(t -> themeType.equals(t.getThemeType()))
                .collect(Collectors.toList());
    }

    @Override
    public List<BuilderThemeVO> findByIsActive(Boolean isActive) {
        return store.values().stream()
                .filter(t -> "SYSTEM".equals(t.getThemeType()) == isActive)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<BuilderThemeVO> findDefaultTheme() {
        return store.values().stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsDefault()))
                .findFirst();
    }

    @Override
    public boolean existsById(String themeId) {
        return store.containsKey(themeId);
    }

    @Override
    public void deleteById(String themeId) {
        store.remove(themeId);
    }

    @Override
    public int count() {
        return store.size();
    }
}