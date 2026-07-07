# Build Error Fix & Deployment Optimization Plan

## Context

Maven build fails with:
```
cannot find symbol: class LayoutTemplatesPayload
cannot find symbol: class LayoutThemesPayload
```

**Root Cause:** `LayoutManagementService` (producer) returns types defined as inner classes in `LayoutManagementController` (consumer). Circular dependency.

**Scope:** Only `modules/resonance-common/web-support/` module affected.

---

## Tasks

### 1. Fix Build Error

**File A:** `modules/resonance-common/web-support/src/main/java/com/resonance/common/menu/admin/service/LayoutManagementService.java`

**Add after existing `LayoutThemePayload` inner class (around line 410):**

```java
public static class LayoutTemplatesPayload {
    public List<LayoutTemplatePayload> templates;
}

public static class LayoutThemesPayload {
    public List<LayoutThemePayload> themes;
}
```

**File B:** `modules/resonance-common/web-support/src/main/java/com/resonance/common/menu/admin/controller/LayoutManagementController.java`

**Remove lines 99-105 (the inner class definitions):**
```java
public static class LayoutTemplatesPayload {
    public java.util.List<com.resonance.common.menu.admin.dto.LayoutTemplatePayload> templates;
}

public static class LayoutThemesPayload {
    public java.util.List<LayoutManagementService.LayoutThemePayload> themes;
}
```

**Update imports/return types in Controller:**
- Change `LayoutTemplatesPayload` → `LayoutManagementService.LayoutTemplatesPayload`
- Change `LayoutThemesPayload` → `LayoutManagementService.LayoutThemesPayload`

### 2. Unify Build Paths

```bash
rm -rf /opt/Resonance/var/releases/P003/image-context
```

Keep `var/releases/P003/image-context-sdui/` as sole release path.

### 3. Verify Build

```bash
cd /opt/Resonance
mvn -pl modules/resonance-common/carbonet-common-core -am -Dmaven.test.skip=true package
```

---

## Validation

1. `mvn package` completes without errors
2. Check `target/carbonet-common-core-*.jar` exists

---

## Verified

- `LayoutTemplatesPayload`/`LayoutThemesPayload` used ONLY in this Controller-Service pair
- No external consumers depend on these types