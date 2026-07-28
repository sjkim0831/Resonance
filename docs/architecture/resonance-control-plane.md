# Resonance control-plane architecture

## Separation

| Plane | Responsibility | Data |
|---|---|---|
| Design | actor, process, archetype, screen, field, API and test contracts | design metadata only |
| Development | generated previews, synthetic test data and build evidence | disposable |
| Staging | integration, migration, security and customer-journey validation | masked |
| Production | customer workloads and approved immutable releases | production |
| Management | catalog, GitOps, telemetry, audit and recovery | operational metadata |

Production never compiles source and never reads mutable design tables directly. An approved design package moves through:

`design approval -> immutable artifact -> development -> staging gates -> production promotion`.

## Portal model

Backstage is the outer portal and catalog. Resonance remains the design and generation engine. Argo CD is the only production deployment reconciler after cutover. Kubernetes provides environment isolation. OpenTelemetry supplies common traces, metrics and logs.

## Safety gates

1. No production credentials in design or development namespaces.
2. Development uses synthetic data; staging uses masked data.
3. A deployment references an immutable image digest and design package hash.
4. Database migrations are validated and backed up before promotion.
5. Health, route, actor-process, contract and rollback tests must pass.
6. Production drift is reconciled from Git, not repaired by compiling on the host.

## Bootstrap

```bash
bash ops/scripts/resonance-control-plane.sh validate
bash ops/scripts/resonance-control-plane.sh apply-foundation
bash ops/scripts/resonance-control-plane.sh status
```

The Argo CD project declarations are intentionally not applied by the bootstrap script. Install Argo CD with SSO/RBAC first, then review and apply `deploy/k8s/control-plane/argocd-boundaries.yaml`.
