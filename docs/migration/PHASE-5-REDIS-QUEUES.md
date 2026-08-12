# Phase 5 — Redis, BullMQ and Distributed Coordination

## Objective

Introduce the coordination substrate required to remove process-local scheduling and commands from the final SaaS architecture.

## Implemented

- Lazy Redis client factory; module import never opens a socket.
- BullMQ-compatible connection mode (`maxRetriesPerRequest: null`).
- Central queue-name registry for stream, schedule, media, YouTube and notification jobs.
- Lazy queue registry with bounded retry/backoff defaults.
- Versioned job envelope carrying workspace, correlation and idempotency identifiers.
- Token-safe Redis distributed lock using `SET NX PX` plus compare-and-delete Lua release.
- Unit tests with injected fake Redis/Queue implementations; CI does not require external Redis.

## Runtime rule

HTTP controllers must enqueue durable commands instead of spawning FFmpeg or performing long-running media work once their domain is cut over.

## Scheduler rule

The future scheduler must acquire a distributed leadership/dispatch lock and enqueue idempotent `schedule.execute` jobs. It must never rely on one process-local `setInterval` as the sole source of truth.
