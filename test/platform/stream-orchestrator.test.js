'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkspaceContext } = require('../../src/domain/tenancy/workspace-context');
const { StreamOrchestrator } = require('../../src/platform/streaming/stream-orchestrator');

function fixtures({ created = true } = {}) {
  const added = [];
  const definitionRepository = { findById: async (workspaceId, id) => ({ id, workspace_id: workspaceId, status: 'active' }) };
  const session = { id: 'session-1', generation: 1, state: 'QUEUED' };
  const sessionRepository = { createQueued: async () => ({ session, created }) };
  const queue = { add: async (...args) => { added.push(args); } };
  const queueRegistry = { get: () => queue };
  return { definitionRepository, sessionRepository, queueRegistry, added, session };
}

test('operator start request creates one durable queue job', async () => {
  const f = fixtures();
  const orchestrator = new StreamOrchestrator(f);
  const workspace = createWorkspaceContext({ workspaceId: 'w1', userId: 'u1', role: 'operator' });
  const result = await orchestrator.requestStart({ workspace, definitionId: 'd1', idempotencyKey: 'start:d1:20260812' });
  assert.equal(result.created, true);
  assert.equal(f.added.length, 1);
  assert.equal(f.added[0][2].jobId, 'start-session-1');
  assert.equal(f.added[0][1].workspaceId, 'w1');
});

test('replayed idempotent start does not enqueue a second job', async () => {
  const f = fixtures({ created: false });
  const orchestrator = new StreamOrchestrator(f);
  const workspace = createWorkspaceContext({ workspaceId: 'w1', userId: 'u1', role: 'owner' });
  const result = await orchestrator.requestStart({ workspace, definitionId: 'd1', idempotencyKey: 'same-key' });
  assert.equal(result.created, false);
  assert.equal(f.added.length, 0);
});

test('viewer cannot start a stream', async () => {
  const f = fixtures();
  const orchestrator = new StreamOrchestrator(f);
  const workspace = createWorkspaceContext({ workspaceId: 'w1', userId: 'u1', role: 'viewer' });
  await assert.rejects(orchestrator.requestStart({ workspace, definitionId: 'd1', idempotencyKey: 'key' }), /operator/);
  assert.equal(f.added.length, 0);
});
