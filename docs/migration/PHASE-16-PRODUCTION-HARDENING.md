# Phase 16 — Production Hardening

## Security
- Dedicated DATA_ENCRYPTION_KEY with versioned AES-256-GCM ciphertext.
- No default encryption-secret fallback.
- Legacy ciphertext migration requires an explicit LEGACY_SESSION_SECRET.
- API tokens are one-way SHA-256 hashes and plaintext is returned only at creation.
- Security headers, request IDs, tenant-scoped APIs and scope checks.

## Reliability
- `/live`, `/ready`, `/metrics` on the standalone control plane.
- PostgreSQL and Redis readiness checks.
- Durable scheduler claims, worker leases, bounded recovery budgets and generation fencing.
- Graceful shutdown for queue consumers, scheduler/watchdog loops and worker processes.

## Deployment
`docker-compose.saas.yml` now runs PostgreSQL, Redis, MinIO, the control plane and independent stream workers. The legacy `app.js` is still intentionally available as a rollback/cutover bridge; production migration can move routes incrementally rather than forcing a big-bang switch.

## Initial SLO targets
- control-plane availability >= 99.9%
- cross-tenant data leakage: 0
- duplicate live ownership for one session generation: 0
- expired worker lease detection within two watchdog intervals
- all production changes gated by full Node test suite and Docker image build
