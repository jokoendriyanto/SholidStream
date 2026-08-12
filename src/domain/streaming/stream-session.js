'use strict';

const crypto = require('crypto');
const { STREAM_STATE } = require('./stream-state');
const { assertTransition } = require('./stream-state-machine');

function createDraftSession({ workspaceId, definitionId, idempotencyKey }) {
  if (!workspaceId || !definitionId || !idempotencyKey) throw new TypeError('workspaceId, definitionId and idempotencyKey are required');
  return Object.freeze({
    id: crypto.randomUUID(),
    workspaceId,
    definitionId,
    idempotencyKey,
    state: STREAM_STATE.DRAFT,
    desiredState: STREAM_STATE.LIVE,
    generation: 1,
    version: 1
  });
}

function transitionSession(session, toState) {
  assertTransition(session.state, toState);
  return Object.freeze({ ...session, state: toState, version: session.version + 1 });
}

module.exports = { createDraftSession, transitionSession };
