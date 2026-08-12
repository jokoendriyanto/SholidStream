# Baseline Characterization Test Matrix

This matrix is the acceptance contract for the StreamFlow → SholidStream SaaS migration.

| Area | Scenario | Required before replacement |
|---|---|---|
| Auth | Login success/failure | Yes |
| Auth | Protected route rejects anonymous user | Yes |
| Media | Upload video | Yes |
| Media | Upload audio | Yes |
| Media | Media metadata/probe | Yes |
| Stream | Create manual RTMP definition | Yes |
| Stream | Start FFmpeg stream | Yes |
| Stream | Stop FFmpeg stream | Yes |
| Stream | Startup failure is surfaced | Yes |
| Stream | Unexpected FFmpeg exit triggers bounded retry | Yes |
| Stream | Graceful stop does not auto-retry | Yes |
| Stream | Copy-mode compatibility validation | Yes |
| Playlist | Ordered playback | Yes |
| Playlist | Shuffle behavior | Yes |
| Playlist | Audio playlist behavior | Yes |
| Scheduler | Scheduled start | Yes |
| Scheduler | Scheduled stop | Yes |
| Scheduler | Expired schedule does not restart | Yes |
| Rotation | Activate/pause/stop | Yes |
| YouTube | OAuth callback | Yes |
| YouTube | Refresh access token | Yes |
| YouTube | Create `liveBroadcast` | Yes |
| YouTube | Create `liveStream` | Yes |
| YouTube | Bind broadcast to stream | Yes |
| Upload | Chunk/resumable upload | Yes |
| History | Save valid stream history | Yes |
| Isolation | User A cannot read User B playlist/stream/media | Yes |

## Migration gate rules

- A component may be replaced only after equivalent tests exist for its observable behavior.
- New distributed behavior must add idempotency and duplicate-execution tests.
- Every multi-tenant repository/service must add cross-workspace isolation tests.
- Worker extraction must add process crash, worker loss, stale heartbeat and fencing tests before multi-node production use.
