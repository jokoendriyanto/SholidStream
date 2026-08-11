# SholidStream SaaS Migration Baseline

## Source baseline

- Repository: `jokoendriyanto/SholidStream`
- Upstream lineage: `bangtutorial/streamflow`
- Baseline application version: `2.2.2`
- Baseline branch: `main`
- Migration branch: `streamcloud/migration-phase-0-1`
- Migration strategy: Strangler Migration; preserve working streaming behavior while replacing infrastructure incrementally.

## Current architecture snapshot

The baseline is a single Node.js/Express application that combines HTTP/UI, scheduling, stream orchestration and FFmpeg process supervision in one runtime.

Current persistence/runtime assumptions:

- SQLite is the application database.
- `connect-sqlite3` stores web sessions.
- Media is primarily local filesystem based.
- `services/streamingService.js` owns process-local `activeStreams`, logs, retry counters and health checks.
- `services/schedulerService.js` is process-local.
- `app.js` bootstraps DB, scheduler, rotation service and stream status synchronization.

## Critical behavior to preserve during migration

1. Authentication and session login.
2. Video/audio upload and gallery behavior.
3. Manual RTMP stream creation/start/stop.
4. FFmpeg copy/transcode behavior.
5. Playlist playback and shuffle semantics.
6. Scheduled start/stop.
7. Rotation lifecycle.
8. YouTube OAuth/channel integration.
9. YouTube `liveBroadcast` + `liveStream` creation/binding.
10. OAuth token refresh behavior.
11. Large/chunk upload behavior.
12. Stream history.
13. Graceful stream process termination.
14. Existing FFmpeg retry behavior.

## Known architectural debt accepted at baseline

These are baseline facts, not final-state design decisions:

- `app.js` is a large composition/root routing file.
- Streaming runtime truth is partially kept in process memory.
- Running stream state is not durable across process/node failure.
- Scheduler execution is not distributed/idempotent.
- SQLite limits horizontal scaling.
- Local media paths couple workers to a single host.
- Web/control runtime directly supervises FFmpeg.
- Resource ownership is primarily `user_id` based rather than workspace tenancy.
- Runtime stream state is represented with coarse statuses compared with the target state machine.

## Target invariant

At every migration phase, existing working streaming behavior must remain available unless an intentional breaking change is documented with a migration and rollback path.
