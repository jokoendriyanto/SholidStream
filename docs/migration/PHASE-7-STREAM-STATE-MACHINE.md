# Phase 7 — Durable Stream State Machine

## Objective

Replace the conceptual `offline/live/scheduled` runtime model with a durable, validated stream-session state machine suitable for distributed workers and recovery.

## Implemented

- PostgreSQL `stream_definitions`, `stream_destinations`, `stream_sessions` and append-oriented `stream_events` schema.
- Session `generation` for future fencing/failover and `version` for optimistic concurrency.
- Workspace-scoped idempotency key so duplicate start requests converge on one session.
- Explicit states: DRAFT, QUEUED, ALLOCATING, PREPARING, STARTING, CONNECTING, LIVE, DEGRADED, RECOVERING, STOPPING, STOPPED, FAILED, CANCELLED.
- Validated transition graph; impossible jumps fail before persistence.
- Session repository with optimistic compare-and-swap transition semantics.
- Stream orchestrator that requires operator-level workspace permission and enqueues one durable start command.
- Versioned worker `START_SESSION` command contract carrying generation and lease token for the next worker-extraction phase.

## Source-of-truth rule

For the new control plane, PostgreSQL session state is authoritative. Redis/BullMQ carries commands/events but is not the canonical record. A process-local map may be used by a worker to track child processes but may never be the global truth for whether a stream session exists.

## Legacy coexistence

The existing `streamingService.js` remains operational for the legacy path. Phase 8 will extract its FFmpeg/process lifecycle behind the new worker command contract rather than rewriting FFmpeg behavior during this phase.

## Exit criteria

- startup and shutdown paths are representable as validated transitions;
- duplicate start requests are idempotent;
- session transitions support optimistic concurrency;
- worker command contract contains generation/lease fields needed for fencing;
- all platform and baseline tests pass.
