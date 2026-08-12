# SholidStream SaaS Transformation Roadmap

## Phase 0 — Baseline freeze
- Freeze upstream baseline/version.
- Record architecture and known debt.
- Keep MIT license notices.
- Establish migration branch and rollback point.

Exit: baseline documented and reproducible.

## Phase 1 — Characterization safety net
- Add test runner and HTTP test tooling.
- Add characterization tests around auth, stream lifecycle, scheduler, playlist, YouTube and uploads.
- Add CI test job.

Exit: critical behaviors have automated regression coverage.

## Phase 2 — Modularize application root
- Move routes/controllers out of `app.js`.
- Introduce application/services/repositories boundaries.
- Keep behavior parity.

Exit: `app.js` is bootstrap/composition only.

## Phase 3 — PostgreSQL
- Introduce explicit migrations.
- Add repositories that support PostgreSQL.
- Build SQLite → PostgreSQL importer.
- Remove runtime schema mutation as the production strategy.

Exit: production can run entirely on PostgreSQL with migrated legacy data.

## Phase 4 — Workspace multi-tenancy
- Add workspaces and memberships.
- Move resource ownership from user-centric to workspace-centric.
- Add RBAC and cross-workspace isolation tests.

Exit: all business resources are workspace scoped.

## Phase 5 — Redis + durable queue
- Move sessions to Redis.
- Introduce distributed locks, cache and BullMQ.
- Convert long-running/background work to durable jobs.

Exit: API instances can scale horizontally without local session/job truth.

## Phase 6 — Object storage
- Add StorageProvider abstraction.
- Add S3-compatible provider and local development provider.
- Move media source-of-truth out of web node filesystem.

Exit: any worker can obtain authorized media independently.

## Phase 7 — Stream runtime model
- Split StreamDefinition / Destination / Schedule / Session / Event.
- Introduce validated state machine and stream event journal.

Exit: runtime execution state is durable and auditable.

## Phase 8 — Worker extraction
- Extract FFmpeg supervision into dedicated Node Worker V1.
- Define versioned worker protocol.
- Control plane no longer directly owns FFmpeg processes.

Exit: manual RTMP streams run through external worker with parity.

## Phase 9 — Worker registry + allocator
- Add heartbeat/health registry.
- Add capacity reservations and worker scoring.
- Add drain/maintenance lifecycle.

Exit: a stream can be safely allocated across multiple workers.

## Phase 10 — Distributed scheduler
- Replace process-local schedule execution with durable jobs.
- Add idempotency keys and distributed locking.

Exit: multiple scheduler/API instances cannot duplicate a scheduled start.

## Phase 11 — Watchdog, recovery and failover
- Classify failures.
- Add bounded retry budgets.
- Add worker/session leases, generations and fencing tokens.
- Implement failover to another worker.

Exit: worker loss can recover without duplicate publishers.

## Phase 12 — YouTube integration V2
- Split OAuth, channels, broadcasts, streams, metadata, tokens and quota services.
- Centralize SaaS OAuth app config.
- Encrypt tokens/secrets independently of session secret.

Exit: tenant-safe YouTube API flows with observable quota usage.

## Phase 13 — SaaS entitlement and billing
- Plans, features, subscriptions, usage counters, invoices/payments.
- Enforce entitlements server-side before resource allocation.

Exit: plan limits cannot be bypassed client-side.

## Phase 14 — Automation platform
- Durable rotations.
- Metadata rotation.
- Auto-upload campaigns and resumable upload jobs.
- Notification engine.

Exit: automation survives process restarts and provides execution history.

## Phase 15 — SaaS frontend/admin
- New dashboard and create-stream wizard.
- Admin infrastructure control center.
- Realtime status over SSE/WebSocket.

Exit: all supported APIs exposed through production UX.

## Phase 16 — Security/observability/production hardening
- Structured logs, metrics and tracing.
- `/live`, `/ready`, `/metrics`.
- Audit logs, secret redaction, upload validation, rate limits and security headers.
- Load and chaos tests.
- CI/CD deployment with worker draining.

Exit: production launch checklist and SLO gates pass.

## Non-negotiable migration rules
1. No big-bang rewrite.
2. Do not redesign FFmpeg behavior and distributed architecture in the same untested step.
3. No production multi-node mode while active stream truth is process-local.
4. No SaaS launch without tenant isolation tests.
5. No worker failover without leases/generation/fencing.
6. No billing limit enforced only in the frontend.
7. No plaintext destination secrets in persistent storage.
