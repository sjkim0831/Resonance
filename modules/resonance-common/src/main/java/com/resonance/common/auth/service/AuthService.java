package com.resonance.common.auth.service;
import com.resonance.common.auth.entity.Author;
import com.resonance.common.auth.entity.AuthorMenuMapping;
import com.resonance.common.auth.entity.UserAuthorMapping;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AuthService {
    
    private final Map<String, Author> authors = new LinkedHashMap<>();
    private final Map<String, Set<String>> authorMenuMap = new HashMap<>();
    private final Map<String, Set<String>> userAuthorMap = new HashMap<>();
    
    public AuthService() {
        initDefaultData();
    }
    
    private void initDefaultData() {
        addAuthor(new Author("ROLE_ADMIN", "관리자", "전체 시스템 접근 가능", "SYSTEM", 1));
        addAuthor(new Author("ROLE_MANAGER", "매니저", "부서 관리 및 모니터링", "BUSINESS", 2));
        addAuthor(new Author("ROLE_USER", "일반사용자", "기본 기능만 접근", "USER", 3));
        addAuthor(new Author("ROLE_GUEST", "게스트", "읽기 전용", "GUEST", 4));
        
        authorMenuMap.put("ROLE_ADMIN", new HashSet<>(Arrays.asList(
            "MENU001", "MENU002", "MENU0021", "MENU0022", "MENU0023", "MENU0024", "MENU003"
        )));
        authorMenuMap.put("ROLE_MANAGER", new HashSet<>(Arrays.asList(
            "MENU001", "MENU0021", "MENU003"
        )));
        authorMenuMap.put("ROLE_USER", new HashSet<>(Arrays.asList(
            "MENU001", "MENU003"
        )));
        authorMenuMap.put("ROLE_GUEST", new HashSet<>(Arrays.asList(
            "MENU001"
        )));
    }
    
    private void addAuthor(Author author) {
        author.setUseAt("Y");
        author.setCreatPnttm(LocalDateTime.now());
        authors.put(author.getAuthorCode(), author);
    }
    
    public List<Author> getAllAuthors() {
        return authors.values().stream()
            .filter(a -> "Y".equals(a.getUseAt()))
            .sorted(Comparator.comparing(Author::getSortOrder))
            .collect(Collectors.toList());
    }
    
    public Author getAuthor(String authorCode) {
        return authors.get(authorCode);
    }
    
    public Author createAuthor(Author author) {
        author.setCreatPnttm(LocalDateTime.now());
        authors.put(author.getAuthorCode(), author);
        authorMenuMap.put(author.getAuthorCode(), new HashSet<>());
        return author;
    }
    
    public Author updateAuthor(String authorCode, Author author) {
        author.setAuthorCode(authorCode);
        authors.put(authorCode, author);
        return author;
    }
    
    public void deleteAuthor(String authorCode) {
        Author author = authors.get(authorCode);
        if (author != null) {
            author.setUseAt("N");
        }
        authorMenuMap.remove(authorCode);
    }
    
    public Set<String> getAuthorMenus(String authorCode) {
        return authorMenuMap.getOrDefault(authorCode, new HashSet<>());
    }
    
    public void addMenuToAuthor(String authorCode, String menuId) {
        authorMenuMap.computeIfAbsent(authorCode, k -> new HashSet<>()).add(menuId);
    }
    
    public void removeMenuFromAuthor(String authorCode, String menuId) {
        Set<String> menus = authorMenuMap.get(authorCode);
        if (menus != null) {
            menus.remove(menuId);
        }
    }
    
    public void setAuthorMenus(String authorCode, Set<String> menuIds) {
        authorMenuMap.put(authorCode, menuIds);
    }
    
    public Set<String> getUserRoles(String userId) {
        return userAuthorMap.getOrDefault(userId, new HashSet<>());
    }
    
    public void assignRoleToUser(String userId, String authorCode) {
        userAuthorMap.computeIfAbsent(userId, k -> new HashSet<>()).add(authorCode);
    }
    
    public void removeRoleFromUser(String userId, String authorCode) {
        Set<String> roles = userAuthorMap.get(userId);
        if (roles != null) {
            roles.remove(authorCode);
        }
    }
    
    public boolean hasMenuAccess(String authorCode, String menuId) {
        Set<String> menus = authorMenuMap.get(authorCode);
        return menus != null && menus.contains(menuId);
    }
    
    public boolean hasRole(String userId, String authorCode) {
        Set<String> roles = userAuthorMap.get(userId);
        return roles != null && roles.contains(authorCode);
    }
    
    public List<Author> getAuthorsByUser(String userId) {
        Set<String> roleCodes = getUserRoles(userId);
        return roleCodes.stream()
            .map(authors::get)
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
    }
}