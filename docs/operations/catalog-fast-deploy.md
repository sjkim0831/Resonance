# Catalog fast deployment contract

Catalog-only changes reuse a successful platform preflight for at most five
minutes. The cached evidence contains the verification epoch and the elected
Patroni leader. Runtime or database changes never use this cache.

The fast path remains fail-closed:

- a missing, expired, or malformed cache runs the complete capacity,
  Kubernetes storage, Patroni quorum, data-directory, and writable-leader
  checks;
- a runtime-affecting change always runs the complete platform preflight;
- resource-guard or control-plane contract changes are validated immediately;
- catalog synchronization and its mapped contract tests must still pass before
  the deployment success marker is written.

The deployment telemetry records `incremental_plan`, `platform_preflight`,
`catalog_validation`, and `catalog_sync` separately so a cached check cannot be
mistaken for an unverified deployment.

Documentation-only deltas still update and validate their source-asset rows,
but reuse the unchanged E4B graph invariant. Source, screen, configuration,
design, automation, and database deltas continue to run the global E4B audit.

A deployment worktree that advanced to the target revision is clean by
construction, so generated-artifact restoration is skipped for that run.
Retries against an existing worktree retain the complete restore and dirty-file
verification path.

An authenticated webhook target already present in the local Git object store
is promoted without a second remote fetch. Missing objects always fall back to
the target-branch fetch, and the ten-minute timer remains the recovery path for
missed webhook deliveries.

The webhook performs this prefetch as the unprivileged repository owner before
dispatching the deployment service. A failed prefetch does not suppress the
deployment; it falls back to the service-owned target-branch fetch.
The fetched remote-tracking ref must exactly equal the signed webhook SHA.

Database credential discovery runs concurrently with Git delta analysis and
SQL assembly. The credential remains process-local, uses a mode-0600 temporary
file, is removed before database execution, and falls back to the shared
PostgreSQL adapter when prefetching is unavailable.

The catalog transaction performs its writable-primary assertion inside the
same database session as the mutation. Only connection failures and the
explicit replica guard may retry through the elected Patroni leader; catalog
or integrity failures remain fail-closed and are never replayed.
