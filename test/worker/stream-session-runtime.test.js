'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StreamSessionRuntime, hashLeaseToken } = require('../../src/worker/stream-session-runtime');

function createSessionRepository() {
  const session = {
    id: 'session-1',
    workspace_id: 'workspace-1',
    stream_definition_id: 'definition-1',
    state: 'QUEUED',
    generation: 1,
    version: 1,
    lease_token_hash: null
  };
  return {
    session,
    async findById() { return { ...session }; },
    async claimLease({ leaseTokenHash }) {
      session.lease_token_hash = leaseTokenHash;
      session.version += 1;
      return { ...session };
    },
    async heartbeat() { return { id: session.id, state: session.state, generation: session.generation, version: session.version }; },
    async transition({ expectedState, expectedVersion, toState, failureCode = null, failureMessage = null }) {
      assert.equal(session.state, expectedState);
      assert.equal(session.version, expectedVersion);
      session.state = toState;
      session.version += 1;
      session.failure_code = failureCode;
      session.failure_message = failureMessage;
      if (['STOPPED', 'FAILED', 'CANCELLED'].includes(toState)) session.lease_token_hash = null;
      return { ...session };
    }
  };
}

function createSupervisor() {
  const state = { callbacks: null, running: false };
  return {
    state,
    start(options) {
      state.callbacks = options;
      state.running = true;
      return { sessionId: options.sessionId, pid: 222, startedAt: Date.now(), lastActivityAt: Date.now(), stopping: false };
    },
    get() { return state.running ? { pid: 222, lastActivityAt: Date.now() } : null; },
    async stop() {
      if (!state.running) return false;
      state.running = false;
      if (state.callbacks) await state.callbacks.onExit({ code: 0, signal: 'SIGTERM', error: null, stopping: true });
      return true;
    },
    async shutdown() { state.running = false; }
  };
}

function startCommand() {
  return {
    command: 'START_SESSION',
    version: 1,
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    definitionId: 'definition-1',
    generation: 1,
    leaseToken: 'lease-secret',
    sources: [{ kind: 'file', uri: 'file:///video.mp4' }],
    outputs: [{ url: 'rtmps://example.invalid/live/key' }],
    encodingProfile: {},
    runtimePolicy: {}
  };
}

test('runtime moves a session QUEUED -> CONNECTING -> LIVE and stops it', async () => {
  const sessionRepository = createSessionRepository();
  const events = [];
  const supervisor = createSupervisor();
  const runtime = new StreamSessionRuntime({
    sessionRepository,
    eventRepository: { append: async (event) => { events.push(event); return event; } },
    processSupervisor: supervisor,
    commandBuilder: () => ({ executable: 'ffmpeg', args: [], redactedArgs: [] }),
    heartbeatIntervalMs: 60_000,
    leaseDurationMs: 120_000,
    workerIdentity: 'worker-test'
  });

  const started = await runtime.handle(startCommand());
  assert.equal(started.state, 'CONNECTING');
  assert.equal(sessionRepository.session.lease_token_hash, hashLeaseToken('lease-secret'));

  await supervisor.state.callbacks.onProgress('frame=1');
  assert.equal(sessionRepository.session.state, 'LIVE');

  const stopped = await runtime.handle({
    command: 'STOP_SESSION',
    version: 1,
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    generation: 1,
    leaseToken: 'lease-secret',
    reason: 'test'
  });
  assert.equal(stopped.state, 'STOPPED');
  assert.equal(sessionRepository.session.state, 'STOPPED');
  assert.equal(events.some((event) => event.eventType === 'WORKER_MEDIA_FLOWING'), true);
});

test('runtime rejects a stale generation before spawning FFmpeg', async () => {
  const sessionRepository = createSessionRepository();
  const supervisor = createSupervisor();
  const runtime = new StreamSessionRuntime({
    sessionRepository,
    eventRepository: { append: async () => {} },
    processSupervisor: supervisor,
    commandBuilder: () => ({ executable: 'ffmpeg', args: [], redactedArgs: [] })
  });

  await assert.rejects(() => runtime.handle({ ...startCommand(), generation: 2 }), (error) => error.code === 'STALE_WORKER_GENERATION');
  assert.equal(supervisor.state.running, false);
});
