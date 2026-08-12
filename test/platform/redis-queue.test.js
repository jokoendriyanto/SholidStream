'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DistributedLock } = require('../../src/infrastructure/redis/distributed-lock');
const { QueueRegistry } = require('../../src/platform/jobs/queue-registry');
const { QUEUE_NAMES } = require('../../src/platform/jobs/queue-names');
const { createJobEnvelope } = require('../../src/platform/jobs/job-envelope');

class FakeQueue {
  constructor(name, options) { this.name = name; this.options = options; this.closed = false; }
  async close() { this.closed = true; }
}

test('queue registry lazily creates known queues and reuses instances', () => {
  const registry = new QueueRegistry({ connection: { fake: true }, prefix: 'test', QueueClass: FakeQueue });
  const first = registry.get(QUEUE_NAMES.STREAM_START);
  const second = registry.get(QUEUE_NAMES.STREAM_START);
  assert.equal(first, second);
  assert.equal(first.options.prefix, 'test');
  assert.throws(() => registry.get('unknown.queue'), /Unknown queue/);
});

test('job envelope requires an idempotency key and tenant', () => {
  const envelope = createJobEnvelope({ type: QUEUE_NAMES.STREAM_START, workspaceId: 'w1', idempotencyKey: 'stream:s1:g1', payload: { streamId: 's1' } });
  assert.equal(envelope.workspaceId, 'w1');
  assert.equal(envelope.idempotencyKey, 'stream:s1:g1');
  assert.equal(envelope.version, 1);
});

test('distributed lock uses NX/PX and token-safe release', async () => {
  let setArgs;
  let evalArgs;
  const redis = {
    async set(...args) { setArgs = args; return 'OK'; },
    async eval(...args) { evalArgs = args; return 1; }
  };
  const locks = new DistributedLock(redis, { namespace: 'test' });
  const lock = await locks.acquire('scheduler', 5000);
  assert.equal(setArgs[0], 'test:scheduler');
  assert.equal(setArgs[2], 'PX');
  assert.equal(setArgs[3], 5000);
  assert.equal(setArgs[4], 'NX');
  assert.equal(await locks.release(lock), true);
  assert.equal(evalArgs[2], lock.key);
  assert.equal(evalArgs[3], lock.token);
});
