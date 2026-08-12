'use strict';

const { QUEUE_NAMES } = require('../jobs/queue-names');
const { createJobEnvelope } = require('../jobs/job-envelope');

class StreamOrchestrator {
  constructor({ definitionRepository, sessionRepository, queueRegistry }) {
    if (!definitionRepository || !sessionRepository || !queueRegistry) throw new TypeError('StreamOrchestrator dependencies are required');
    this.definitionRepository = definitionRepository;
    this.sessionRepository = sessionRepository;
    this.queueRegistry = queueRegistry;
  }

  async requestStart({ workspace, definitionId, idempotencyKey, correlationId }) {
    workspace.assert('operator');
    const definition = await this.definitionRepository.findById(workspace.workspaceId, definitionId);
    if (!definition || definition.status !== 'active') {
      const error = new Error('Stream definition not found');
      error.code = 'STREAM_DEFINITION_NOT_FOUND';
      throw error;
    }

    const { session, created } = await this.sessionRepository.createQueued({
      workspaceId: workspace.workspaceId,
      definitionId,
      idempotencyKey
    });
    if (!session) throw new Error('Unable to create or recover stream session');

    if (created) {
      const envelope = createJobEnvelope({
        type: QUEUE_NAMES.STREAM_START,
        workspaceId: workspace.workspaceId,
        correlationId,
        idempotencyKey,
        payload: { sessionId: session.id, definitionId, generation: session.generation }
      });
      await this.queueRegistry.get(QUEUE_NAMES.STREAM_START).add('start', envelope, {
        jobId: `start-${session.id}`
      });
    }

    return { session, created };
  }
}

module.exports = { StreamOrchestrator };
