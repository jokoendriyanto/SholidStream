'use strict';

const crypto = require('crypto');

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

class DistributedLock {
  constructor(redis, { namespace = 'sholidstream:lock' } = {}) {
    if (!redis || typeof redis.set !== 'function' || typeof redis.eval !== 'function') {
      throw new TypeError('Redis client with set() and eval() is required');
    }
    this.redis = redis;
    this.namespace = namespace;
  }

  key(name) {
    if (!name || typeof name !== 'string') throw new TypeError('Lock name is required');
    return `${this.namespace}:${name}`;
  }

  async acquire(name, ttlMs = 30000) {
    if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be a positive integer');
    const token = crypto.randomUUID();
    const key = this.key(name);
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return null;
    return Object.freeze({ key, token, ttlMs });
  }

  async release(lock) {
    if (!lock || !lock.key || !lock.token) return false;
    const result = await this.redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
    return Number(result) === 1;
  }
}

module.exports = { DistributedLock, RELEASE_SCRIPT };
