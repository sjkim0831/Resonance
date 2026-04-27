# Resonance Wave 14 Runtimecontrol Support Ports

## Goal

Make `resonance-runtimecontrol-core` less dependent on Carbonet-specific services by introducing thin support ports instead of directly using:

- `egovframework.com.common.audit.AuditTrailService`
- `egovframework.com.feature.auth.service.CurrentUserContextService`

## Why ports are better here

Both blockers are not simple shared utility classes.

### `AuditTrailService`

Depends on:

- trace context
- project runtime context
- logging/persisting writers
- payload masking

### `CurrentUserContextService`

Depends on:

- auth repositories
- JWT provider
- environment/profile checks
- codex/auth group logic
- project runtime context

These are not good direct promotion candidates for the current wave.

## Recommended approach

### 1. Keep Carbonet implementations where they are for now

- do not move them blindly

### 2. Define thin runtimecontrol-facing ports in Resonance

Suggested ports:

- `RuntimeAuditPort`
- `RuntimeActorContextPort`

### 3. Retarget runtimecontrol-core to those ports

Replace direct imports in:

- `AdminIpWhitelistCommandService`
- `RuntimeControlPlaneApiController`

### 4. Add adapter implementations later

Carbonet-side adapters can implement those ports until the shared ownership is clearer.

## Success criteria

- runtimecontrol-core no longer imports Carbonet auth/audit concrete classes directly
- only thin port contracts remain as dependencies
- next compile blockers become explicit and narrower
