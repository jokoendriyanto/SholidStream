'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkerService } = require('../../src/worker/worker-service');
const { QUEUE_NAMES } = require('../../src/platform/jobs/queue-names');

class FakeWorker {
  constructor(queueName, processor, options) {
    this.queueName = queueName;
    this.processor = processor;
    this.options = options;
    this.listeners = new Map();
    this.closed = false;
  }
  on(name, handler) { this.listeners.set(name, handler); return this; }
  async close() { this.closed = true; }
}

test('worker service consumes the dedicated command queue and shuts down cleanly', async () => {
  const handled = [];
  let runtimeShutdown = false;
  const runtime = {
    async handle(command) { handled.push(command); return { ok: true }; },
    async shutdown() { runtimeShutdown = true; }
  };
  const connection = { kind: 'redis' };
  const service = createWorkerService({
    connection,
    runtime,
    WorkerClass: FakeWorker,
    concurrency: 3,
    logger: { error() {} }
  });

  assert.equal(service.worker.queueName, QUEUE_NAMES.STREAM_WORKER_COMMAND);
  assert.equal(service.worker.options.connection, connection);
  assert.equal(service.worker.options.concurrency, 3);

  const command = { command: 'STOP_SESSION' };
  const result = await service.worker.processor({ data: command });
  assert.deepEqual(result, { ok: true });
  assert.equal(handled[0], command);

  await service.close();
  assert.equal(service.worker.closed, true);
  assert.equal(runtimeShutdown, true);
});
