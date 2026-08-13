'use strict';

require('dotenv').config();

const fs = require('fs');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const { createRedisClient } = require('./src/infrastructure/redis/client');
const { getPostgresPool, closePostgresPool } = require('./src/infrastructure/database/postgres');
const { StreamSessionRepository } = require('./src/infrastructure/database/repositories/stream-session-repository');
const { StreamEventRepository } = require('./src/infrastructure/database/repositories/stream-event-repository');
const { FfmpegProcessSupervisor } = require('./src/worker/ffmpeg/process-supervisor');
const { buildFfmpegCommand } = require('./src/worker/ffmpeg/command-builder');
const { StreamSessionRuntime } = require('./src/worker/stream-session-runtime');
const { createWorkerService } = require('./src/worker/worker-service');

const ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : ffmpegInstaller.path);
const concurrency = Math.max(1, Number.parseInt(process.env.STREAM_WORKER_CONCURRENCY || '2', 10) || 2);
const heartbeatIntervalMs = Math.max(5000, Number.parseInt(process.env.STREAM_WORKER_HEARTBEAT_MS || '15000', 10) || 15000);
const leaseDurationMs = Math.max(heartbeatIntervalMs * 2, Number.parseInt(process.env.STREAM_WORKER_LEASE_MS || '45000', 10) || 45000);

const pool = getPostgresPool();
const redis = createRedisClient({ bullmq: true });
const sessionRepository = new StreamSessionRepository(pool);
const eventRepository = new StreamEventRepository(pool);
const processSupervisor = new FfmpegProcessSupervisor();
const runtime = new StreamSessionRuntime({
  sessionRepository,
  eventRepository,
  processSupervisor,
  heartbeatIntervalMs,
  leaseDurationMs,
  commandBuilder: (command) => buildFfmpegCommand(command, { executable: ffmpegPath })
});
const service = createWorkerService({ connection: redis, runtime, concurrency });

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down stream worker...`);
  try {
    await service.close();
  } finally {
    try {
      if (redis.status !== 'wait' && redis.status !== 'end') await redis.quit();
    } catch (_) {}
    await closePostgresPool().catch(() => {});
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM').finally(() => process.exit(0)));
process.once('SIGINT', () => shutdown('SIGINT').finally(() => process.exit(0)));

console.log(`SholidStream worker started (concurrency=${concurrency}, ffmpeg=${ffmpegPath})`);
