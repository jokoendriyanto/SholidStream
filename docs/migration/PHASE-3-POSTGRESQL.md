# Phase 3 — PostgreSQL Foundation

## Objective

Introduce PostgreSQL as the authoritative database for the future SaaS control plane without deleting the legacy SQLite runtime yet.

## Implemented

- `pg` connection pool with explicit environment contract.
- Ordered SQL migration runner with transaction-per-migration semantics.
- Initial PostgreSQL `users` and `audit_logs` tables.
- `schema_migrations` tracking managed by the migration runner.
- SaaS development sidecars for PostgreSQL, Redis, and MinIO.
- CI upgraded from baseline-only tests to the complete Node test suite.

## Migration rule

SQLite remains the runtime source for the legacy application until repositories are ported. New SaaS modules must use PostgreSQL abstractions. No new business table may be added to the SQLite schema.

## Production gate

Before PostgreSQL becomes authoritative:

1. Run migrations against staging.
2. Build and verify the SQLite → PostgreSQL importer.
3. Compare row counts and content checksums.
4. Run dual-read validation where practical.
5. Cut over one bounded domain at a time.

## Rollback

Because the legacy SQLite path is not removed by this phase, rollback is simply disabling the new control-plane path and retaining the old runtime until the next cutover milestone.
