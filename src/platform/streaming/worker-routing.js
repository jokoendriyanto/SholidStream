'use strict';

const WORKER_QUEUE_PREFIX = 'stream.worker.';

function workerQueueName(workerId) {
  if (typeof workerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workerId)) throw new TypeError('Valid worker UUID is required');
  return `${WORKER_QUEUE_PREFIX}${workerId}`;
}

function isWorkerQueueName(name) {
  return typeof name === 'string' && name.startsWith(WORKER_QUEUE_PREFIX) && name.length > WORKER_QUEUE_PREFIX.length;
}

module.exports = { WORKER_QUEUE_PREFIX, workerQueueName, isWorkerQueueName };
