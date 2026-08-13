'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { FfmpegProcessSupervisor } = require('../../src/worker/ffmpeg/process-supervisor');

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.pid = 1234;
    this.exitCode = null;
    this.stderr = new PassThrough();
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    if (signal === 'SIGTERM') {
      this.exitCode = 0;
      queueMicrotask(() => this.emit('exit', 0, signal));
    }
    return true;
  }
}

test('supervisor parses progress and stops process gracefully', async () => {
  const child = new FakeChild();
  let spawnOptions;
  const progress = [];
  const supervisor = new FfmpegProcessSupervisor({
    spawnImpl: (executable, args, options) => {
      assert.equal(executable, '/usr/bin/ffmpeg');
      assert.deepEqual(args, ['-i', 'input']);
      spawnOptions = options;
      return child;
    },
    killTimeoutMs: 20
  });

  const info = supervisor.start({
    sessionId: 'session-1',
    executable: '/usr/bin/ffmpeg',
    args: ['-i', 'input'],
    onProgress: (line) => progress.push(line)
  });

  assert.equal(info.pid, 1234);
  assert.equal(spawnOptions.shell, false);
  child.stderr.write('frame=1 time=00:00:01 speed=1.0x\n');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(progress.length, 1);

  const stopped = await supervisor.stop('session-1');
  assert.equal(stopped, true);
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(supervisor.has('session-1'), false);
});

test('supervisor rejects duplicate process ownership', () => {
  const child = new FakeChild();
  const supervisor = new FfmpegProcessSupervisor({ spawnImpl: () => child });
  supervisor.start({ sessionId: 'same', executable: 'ffmpeg', args: [] });
  assert.throws(() => supervisor.start({ sessionId: 'same', executable: 'ffmpeg', args: [] }), /already has a running process/);
});
