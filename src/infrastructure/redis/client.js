'use strict';

const IORedis = require('ioredis');
const { loadPlatformEnv } = require('../../config/env');

let sharedClient = null;

function createRedisClient({ env = loadPlatformEnv(), RedisClass = IORedis, bullmq = false } = {}) {
  const options = {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: bullmq ? null : 3
  };
  return new RedisClass(env.redis.url, options);
}

function getRedisClient(options = {}) {
  if (!sharedClient) sharedClient = createRedisClient(options);
  return sharedClient;
}

async function closeRedisClient() {
  if (!sharedClient) return;
  const client = sharedClient;
  sharedClient = null;
  if (client.status === 'wait') return;
  await client.quit();
}

module.exports = { createRedisClient, getRedisClient, closeRedisClient };
