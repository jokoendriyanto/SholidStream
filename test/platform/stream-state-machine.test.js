'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STREAM_STATE } = require('../../src/domain/streaming/stream-state');
const { canTransition, assertTransition, isTerminal } = require('../../src/domain/streaming/stream-state-machine');
const { createDraftSession, transitionSession } = require('../../src/domain/streaming/stream-session');

const sql = fs.readFileSync(path.join(__dirname, '../../src/infrastructure/database/migrations/004_stream_runtime.sql'), 'utf8');

test('stream runtime schema stores durable state, generation, version and idempotency', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS stream_sessions/i);
  assert.match(sql, /generation INTEGER NOT NULL/i);
  assert.match(sql, /version INTEGER NOT NULL/i);
  assert.match(sql, /UNIQUE \(workspace_id, idempotency_key\)/i);
});

test('state machine allows normal startup path', () => {
  const path = ['DRAFT','QUEUED','ALLOCATING','PREPARING','STARTING','CONNECTING','LIVE','STOPPING','STOPPED'];
  for (let i = 0; i < path.length - 1; i += 1) assert.equal(canTransition(path[i], path[i + 1]), true);
  assert.equal(isTerminal(STREAM_STATE.STOPPED), true);
});

test('state machine rejects impossible jumps', () => {
  assert.equal(canTransition(STREAM_STATE.DRAFT, STREAM_STATE.LIVE), false);
  assert.throws(() => assertTransition(STREAM_STATE.STOPPED, STREAM_STATE.LIVE), /Invalid stream transition/);
});

test('pure session transition increments optimistic version', () => {
  const draft = createDraftSession({ workspaceId: 'w1', definitionId: 'd1', idempotencyKey: 'key1' });
  const queued = transitionSession(draft, STREAM_STATE.QUEUED);
  assert.equal(queued.state, STREAM_STATE.QUEUED);
  assert.equal(queued.version, 2);
  assert.equal(draft.state, STREAM_STATE.DRAFT);
});
