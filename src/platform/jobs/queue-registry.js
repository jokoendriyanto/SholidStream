'use strict';

const { Queue } = require('bullmq');
const { loadPlatformEnv } = require('../../config/env');
const { createRedisClient } = require('../../infrastructure/redis/client');
const { QUEUE_NAMES } = require('./queue-names');
const { isWorkerQueueName } = require('../streaming/worker-routing');

class QueueRegistry {
  constructor({ connection, prefix = 'sholidstream', QueueClass = Queue } = {}) {
    if (!connection) throw new TypeError('BullMQ connection is required');
    this.connection = connection;
    this.prefix = prefix;
    this.QueueClass = QueueClass;
    this.queues = new Map();
  }

  get(name) {
    if (!Object.values(QUEUE_NAMES).includes(name) && !isWorkerQueueName(name)) throw new TypeError(`Unknown queue: ${name}`);
    if (!this.queues.has(name)) {
      this.queues.set(name, new this.QueueClass(name, {
        connection: this.connection,
        prefix: this.prefix,
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 }
        }
      }));
    }
    return this.queues.get(name);
  }

  async close() {
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));
    this.queues.clear();
  }
}

function createDefaultQueueRegistry({ env = loadPlatformEnv() } = {}) {
  const connection = createRedisClient({ env, bullmq: true });
  return new QueueRegistry({ connection, prefix: env.redis.queuePrefix });
}

module.exports = { QueueRegistry, createDefaultQueueRegistry };
