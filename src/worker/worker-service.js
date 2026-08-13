'use strict';

const { Worker } = require('bullmq');
const { QUEUE_NAMES } = require('../platform/jobs/queue-names');

function createWorkerService({ connection, runtime, WorkerClass = Worker, queueName = QUEUE_NAMES.STREAM_WORKER_COMMAND, concurrency = 2, logger = console } = {}) {
  if (!connection) throw new TypeError('Redis connection is required');
  if (!runtime || typeof runtime.handle !== 'function') throw new TypeError('Stream worker runtime is required');

  const worker = new WorkerClass(
    queueName,
    async (job) => {
      const command = job && job.data && job.data.command && typeof job.data.command === 'object'
        ? job.data.command
        : job.data;
      return runtime.handle(command);
    },
    { connection, concurrency }
  );

  if (typeof worker.on === 'function') {
    worker.on('failed', (job, error) => {
      logger.error('Stream worker job failed', {
        jobId: job && job.id ? job.id : null,
        error: error && error.message ? error.message : String(error)
      });
    });
    worker.on('error', (error) => {
      logger.error('Stream worker error', error);
    });
  }

  return {
    worker,
    async close() {
      await worker.close();
      await runtime.shutdown();
    }
  };
}

module.exports = { createWorkerService };
