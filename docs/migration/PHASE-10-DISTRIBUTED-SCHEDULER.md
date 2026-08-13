# Phase 10 — Distributed Scheduler

Schedules are durable PostgreSQL records. Scheduler replicas claim due rows with `FOR UPDATE SKIP LOCKED`, enqueue idempotent execution jobs, then release/advance the claim. Stale claims can be reclaimed after a TTL.

V1 supports `once` and bounded `interval` schedules; richer recurrence is intentionally delegated to the later automation layer rather than embedding process-local timers.
