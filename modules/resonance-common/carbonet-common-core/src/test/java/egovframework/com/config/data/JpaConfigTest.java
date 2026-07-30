package egovframework.com.config.data;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class JpaConfigTest {

    @Test
    void defaultEntityPackagesRemainExplicitAndBounded() throws Exception {
        Field field = JpaConfig.class.getDeclaredField("DEFAULT_ENTITY_PACKAGES");
        field.setAccessible(true);
        String[] packages = (String[]) field.get(null);

        assertEquals(Set.of(
                "egovframework.com.feature.auth.domain.entity",
                "egovframework.com.feature.emission.domain.entity"), Set.of(packages));
    }
}
