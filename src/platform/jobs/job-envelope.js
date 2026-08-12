'use strict';

const crypto = require('crypto');

function createJobEnvelope({ type, workspaceId, payload, correlationId, idempotencyKey }) {
  if (!type) throw new TypeError('Job type is required');
  if (!workspaceId) throw new TypeError('workspaceId is required');
  if (!idempotencyKey) throw new TypeError('idempotencyKey is required');

  return Object.freeze({
    jobId: crypto.randomUUID(),
    type,
    workspaceId,
    correlationId: correlationId || crypto.randomUUID(),
    idempotencyKey,
    payload: payload || {},
    createdAt: new Date().toISOString(),
    version: 1
  });
}

module.exports = { createJobEnvelope };
