'use strict';

function createStartSessionCommand({ sessionId, workspaceId, definitionId, generation, leaseToken, sources, outputs, encodingProfile, runtimePolicy }) {
  if (!sessionId || !workspaceId || !definitionId) throw new TypeError('sessionId, workspaceId and definitionId are required');
  if (!Number.isInteger(generation) || generation < 1) throw new TypeError('generation must be a positive integer');
  if (!leaseToken) throw new TypeError('leaseToken is required');
  return Object.freeze({
    command: 'START_SESSION',
    version: 1,
    sessionId,
    workspaceId,
    definitionId,
    generation,
    leaseToken,
    sources: sources || [],
    outputs: outputs || [],
    encodingProfile: encodingProfile || {},
    runtimePolicy: runtimePolicy || {}
  });
}

module.exports = { createStartSessionCommand };
