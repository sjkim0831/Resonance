package egovframework.com.platform.screenbuilder.support;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Normalizes artifact payloads so legacy adapter aliases do not remain as a
 * second source of truth across builder/platform services.
 */
public final class ScreenBuilderArtifactSetNormalizer {

    private ScreenBuilderArtifactSetNormalizer() {
    }

    public static Map<String, Object> canonicalizeArtifactRecord(String projectId, Map<String, Object> source) {
        Map<String, Object> normalized = new LinkedHashMap<String, Object>();
        if (source != null) {
            normalized.putAll(source);
        }
        String artifactId = stringValue(normalized.get("artifactId"));
        if (!artifactId.isEmpty()) {
            normalized.put("artifactId", ScreenBuilderPlatformFamilyRegistry.canonicalArtifactId(projectId, artifactId));
        }
        return normalized;
    }

    public static List<Map<String, Object>> normalizeArtifactSet(String projectId, List<Map<String, Object>> source) {
        if (source == null || source.isEmpty()) {
            return new ArrayList<Map<String, Object>>();
        }
        List<Map<String, Object>> normalized = new ArrayList<Map<String, Object>>();
        Set<String> seenArtifactIds = new LinkedHashSet<String>();
        for (Map<String, Object> item : source) {
            if (item == null || item.isEmpty()) {
                continue;
            }
            Map<String, Object> canonicalItem = canonicalizeArtifactRecord(projectId, item);
            String artifactId = stringValue(canonicalItem.get("artifactId"));
            if (artifactId.isEmpty() || seenArtifactIds.contains(artifactId)) {
                continue;
            }
            seenArtifactIds.add(artifactId);
            normalized.add(canonicalItem);
        }
        return normalized;
    }

    public static List<Map<String, Object>> parseLegacyArtifactSet(String projectId, String raw) {
        List<Map<String, Object>> artifactSet = new ArrayList<Map<String, Object>>();
        String normalizedRaw = stringValue(raw);
        if (normalizedRaw.isEmpty()) {
            return artifactSet;
        }
        String[] chunks = normalizedRaw.split("artifactId=");
        for (int index = 1; index < chunks.length; index++) {
            String chunk = chunks[index];
            int artifactVersionMarker = chunk.indexOf(", artifactVersion=");
            if (artifactVersionMarker < 0) {
                continue;
            }
            String artifactId = chunk.substring(0, artifactVersionMarker).trim();
            String versionChunk = chunk.substring(artifactVersionMarker + ", artifactVersion=".length());
            int endMarker = versionChunk.indexOf('}');
            String artifactVersion = (endMarker >= 0 ? versionChunk.substring(0, endMarker) : versionChunk).trim();
            if (artifactId.isEmpty() || artifactVersion.isEmpty()) {
                continue;
            }
            artifactSet.add(canonicalizeArtifactRecord(projectId, orderedMap(
                    "artifactId", artifactId,
                    "artifactVersion", artifactVersion)));
        }
        return artifactSet;
    }

    private static Map<String, Object> orderedMap(Object... pairs) {
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        if (pairs == null) {
            return values;
        }
        for (int index = 0; index + 1 < pairs.length; index += 2) {
            values.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return values;
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
