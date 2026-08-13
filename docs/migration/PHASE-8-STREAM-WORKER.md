# Phase 8 — Stream Worker V1

## Objective

Extract FFmpeg process ownership from the web/control-plane process into a standalone BullMQ worker without removing the legacy StreamFlow runtime yet.

## What Phase 8 adds

- Dedicated `stream.worker.command` queue.
- Versioned `START_SESSION` and `STOP_SESSION` worker commands.
- Strict command validation; arbitrary FFmpeg flags are not accepted from queue payloads.
- Structured FFmpeg argument builder using `spawn()` argument arrays with `shell: false`.
- FFmpeg process supervisor with progress parsing, graceful SIGTERM and bounded SIGKILL fallback.
- Durable worker lease hash, lease expiry and heartbeat persistence on `stream_sessions`.
- Stream event persistence for worker lifecycle transitions.
- Standalone `worker.js` entrypoint and Docker Compose `stream-worker` service.
- Worker tests that do not require an external RTMP endpoint or real FFmpeg process.

## State ownership

Worker V1 owns these runtime transitions once it receives a command:

```text
QUEUED (compatibility only)
  -> ALLOCATING
  -> PREPARING
  -> STARTING
  -> CONNECTING
  -> LIVE
  -> STOPPING
  -> STOPPED
```

Unexpected process exit transitions a non-terminal session to `FAILED`.

`QUEUED -> ALLOCATING` inside Worker V1 is a temporary single-worker compatibility mode. Phase 9 introduces the worker registry/allocator and will make allocation a control-plane responsibility before a worker command is emitted.

## Lease and fencing

The raw lease token exists only in the command and worker memory. PostgreSQL stores a SHA-256 hash. Heartbeats must match:

- workspace
- session id
- generation
- lease token hash

A different token cannot overwrite an active lease in the same generation. Phase 9 will combine this with generation increments during reassignment/failover.

## Security boundaries

- No queue payload can provide raw arbitrary FFmpeg CLI arguments.
- Only RTMP/RTMPS outputs are accepted by Worker V1.
- Source/output values are redacted from lifecycle metadata/log argument snapshots.
- Child processes are launched without a shell.
- Worker V1 supports exactly one source and one output while behavior is stabilized.

## Deployment

Run migrations first:

```bash
npm run db:migrate
```

Then the worker can be started independently:

```bash
npm run worker:start
```

For local SaaS infrastructure:

```bash
docker compose -f docker-compose.saas.yml up -d postgres redis minio stream-worker
```

The legacy `app.js` and `services/streamingService.js` remain available and are not automatically redirected to Worker V1 in Phase 8.

## Exit criteria

Phase 8 is complete when:

- Worker command validation is versioned and tested.
- FFmpeg process lifecycle is isolated behind the worker supervisor.
- Worker start/live/stop/failure transitions persist through PostgreSQL.
- Lease heartbeat/fencing data is durable.
- BullMQ worker service supports graceful shutdown.
- CI passes all baseline, platform and worker tests.
- The Docker worker image builds successfully.

## Next phase

Phase 9 introduces worker registry, capacity reservation, allocator scoring and worker-specific assignment. It will remove Worker V1 self-allocation and route durable commands only to the selected worker.
