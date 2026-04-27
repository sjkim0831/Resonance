package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.model.vo.AuthorRoleProfileVO;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AuthorRoleProfileService {

    private static final TypeReference<List<AuthorRoleProfileVO>> PROFILE_LIST_TYPE = new TypeReference<List<AuthorRoleProfileVO>>() {};
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ObjectMapper objectMapper;
    private final Path profilePath = Paths.get("data", "author-role-profiles", "profiles.json");

    public AuthorRoleProfileService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public synchronized AuthorRoleProfileVO getProfile(String authorCode) {
        String normalizedAuthorCode = normalize(authorCode).toUpperCase(Locale.ROOT);
        if (normalizedAuthorCode.isEmpty()) {
            return null;
        }
        return loadProfiles().stream()
                .filter(item -> normalizedAuthorCode.equalsIgnoreCase(normalize(item.getAuthorCode())))
                .findFirst()
                .map(this::normalizeProfile)
                .orElse(null);
    }

    public synchronized Map<String, AuthorRoleProfileVO> getProfiles(Collection<String> authorCodes) {
        if (authorCodes == null || authorCodes.isEmpty()) {
            return Collections.emptyMap();
        }
        LinkedHashSet<String> normalizedCodes = new LinkedHashSet<>();
        for (String authorCode : authorCodes) {
            String normalized = normalize(authorCode).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                normalizedCodes.add(normalized);
            }
        }
        if (normalizedCodes.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, AuthorRoleProfileVO> result = new LinkedHashMap<>();
        for (AuthorRoleProfileVO profile : loadProfiles()) {
            String authorCode = normalize(profile.getAuthorCode()).toUpperCase(Locale.ROOT);
            if (normalizedCodes.contains(authorCode)) {
                result.put(authorCode, normalizeProfile(profile));
            }
        }
        return result;
    }

    public synchronized AuthorRoleProfileVO saveProfile(AuthorRoleProfileVO profile) {
        AuthorRoleProfileVO normalized = normalizeProfile(profile);
        if (normalize(normalized.getAuthorCode()).isEmpty()) {
            throw new IllegalArgumentException("authorCode is required.");
        }
        if (normalize(normalized.getDisplayTitle()).isEmpty()) {
            throw new IllegalArgumentException("displayTitle is required.");
        }
        List<AuthorRoleProfileVO> profiles = new ArrayList<>(loadProfiles());
        profiles.removeIf(item -> normalize(item.getAuthorCode()).equalsIgnoreCase(normalize(normalized.getAuthorCode())));
        normalized.setUpdatedAt(LocalDateTime.now().format(TIME_FORMAT));
        profiles.add(normalized);
        writeProfiles(profiles);
        return normalized;
    }

    private List<AuthorRoleProfileVO> loadProfiles() {
        if (!Files.exists(profilePath)) {
            return Collections.emptyList();
        }
        try (InputStream inputStream = Files.newInputStream(profilePath)) {
            List<AuthorRoleProfileVO> profiles = objectMapper.readValue(inputStream, PROFILE_LIST_TYPE);
            return profiles == null ? Collections.emptyList() : profiles;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private void writeProfiles(List<AuthorRoleProfileVO> profiles) {
        try {
            Files.createDirectories(profilePath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(profilePath.toFile(), profiles);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to write author role profiles.", e);
        }
    }

    private AuthorRoleProfileVO normalizeProfile(AuthorRoleProfileVO profile) {
        AuthorRoleProfileVO normalized = new AuthorRoleProfileVO();
        normalized.setAuthorCode(normalize(profile == null ? null : profile.getAuthorCode()).toUpperCase(Locale.ROOT));
        normalized.setDisplayTitle(normalize(profile == null ? null : profile.getDisplayTitle()));
        normalized.setDescription(normalize(profile == null ? null : profile.getDescription()));
        normalized.setMemberEditVisibleYn("N".equalsIgnoreCase(normalize(profile == null ? null : profile.getMemberEditVisibleYn())) ? "N" : "Y");
        normalized.setRoleType(normalize(profile == null ? null : profile.getRoleType()).toUpperCase(Locale.ROOT));
        normalized.setBaseRoleYn("Y".equalsIgnoreCase(normalize(profile == null ? null : profile.getBaseRoleYn())) ? "Y" : "N");
        normalized.setParentAuthorCode(normalize(profile == null ? null : profile.getParentAuthorCode()).toUpperCase(Locale.ROOT));
        normalized.setAssignmentScope(normalize(profile == null ? null : profile.getAssignmentScope()).toUpperCase(Locale.ROOT));
        normalized.setUpdatedAt(normalize(profile == null ? null : profile.getUpdatedAt()));
        LinkedHashSet<String> uniqueWorks = new LinkedHashSet<>();
        if (profile != null && profile.getPriorityWorks() != null) {
            for (String item : profile.getPriorityWorks()) {
                String normalizedItem = normalize(item);
                if (!normalizedItem.isEmpty()) {
                    uniqueWorks.add(normalizedItem);
                }
            }
        }
        normalized.setPriorityWorks(new ArrayList<>(uniqueWorks));
        LinkedHashSet<String> uniqueMemberTypes = new LinkedHashSet<>();
        if (profile != null && profile.getDefaultMemberTypes() != null) {
            for (String item : profile.getDefaultMemberTypes()) {
                String normalizedItem = normalize(item).toUpperCase(Locale.ROOT);
                if (!normalizedItem.isEmpty()) {
                    uniqueMemberTypes.add(normalizedItem);
                }
            }
        }
        normalized.setDefaultMemberTypes(new ArrayList<>(uniqueMemberTypes));
        return normalized;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
