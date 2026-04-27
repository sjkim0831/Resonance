package egovframework.com.common.util;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class FeatureCodeBitmap {

    private FeatureCodeBitmap() {
    }

    public static Index index(Collection<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return new Index(Collections.emptyMap(), Collections.emptyList());
        }
        Map<String, Integer> positions = new LinkedHashMap<>();
        List<String> codesByPosition = new ArrayList<>();
        for (String featureCode : featureCodes) {
            String normalized = normalize(featureCode);
            if (normalized.isEmpty() || positions.containsKey(normalized)) {
                continue;
            }
            positions.put(normalized, codesByPosition.size());
            codesByPosition.add(normalized);
        }
        return new Index(positions, codesByPosition);
    }

    public static String normalize(String featureCode) {
        return featureCode == null ? "" : featureCode.trim().toUpperCase(Locale.ROOT);
    }

    public static final class Index {

        private final Map<String, Integer> positions;
        private final List<String> codesByPosition;

        private Index(Map<String, Integer> positions, List<String> codesByPosition) {
            this.positions = positions;
            this.codesByPosition = codesByPosition;
        }

        public BitSet encode(Collection<String> featureCodes) {
            BitSet bits = new BitSet(codesByPosition.size());
            if (featureCodes == null || featureCodes.isEmpty()) {
                return bits;
            }
            for (String featureCode : featureCodes) {
                Integer index = positions.get(normalize(featureCode));
                if (index != null) {
                    bits.set(index);
                }
            }
            return bits;
        }

        public LinkedHashSet<String> decode(BitSet bits) {
            LinkedHashSet<String> decoded = new LinkedHashSet<>();
            if (bits == null || bits.isEmpty()) {
                return decoded;
            }
            for (int index = bits.nextSetBit(0); index >= 0; index = bits.nextSetBit(index + 1)) {
                if (index < codesByPosition.size()) {
                    decoded.add(codesByPosition.get(index));
                }
            }
            return decoded;
        }

        public BitSet difference(BitSet source, BitSet subtract) {
            BitSet result = copy(source);
            if (subtract != null) {
                result.andNot(subtract);
            }
            return result;
        }

        public BitSet intersect(BitSet left, BitSet right) {
            BitSet result = copy(left);
            if (right == null) {
                result.clear();
                return result;
            }
            result.and(right);
            return result;
        }

        public boolean intersects(BitSet left, BitSet right) {
            if (left == null || right == null) {
                return false;
            }
            return left.intersects(right);
        }

        public BitSet copy(BitSet source) {
            return source == null ? new BitSet(codesByPosition.size()) : (BitSet) source.clone();
        }

        public Set<String> codes() {
            return new LinkedHashSet<>(codesByPosition);
        }
    }
}
