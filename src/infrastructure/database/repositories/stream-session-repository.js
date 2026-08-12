'use strict';

const { STREAM_STATE } = require('../../../domain/streaming/stream-state');
const { assertTransition } = require('../../../domain/streaming/stream-state-machine');

class StreamSessionRepository {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async findById(workspaceId, sessionId) {
    const result = await this.pool.query(
      'SELECT * FROM stream_sessions WHERE workspace_id = $1 AND id = $2 LIMIT 1',
      [workspaceId, sessionId]
    );
    return result.rows[0] || null;
  }

  async createQueued({ workspaceId, definitionId, idempotencyKey }) {
    const inserted = await this.pool.query(
      `INSERT INTO stream_sessions(
         workspace_id, stream_definition_id, idempotency_key, state, desired_state, queued_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [workspaceId, definitionId, idempotencyKey, STREAM_STATE.QUEUED, STREAM_STATE.LIVE]
    );
    if (inserted.rows[0]) return { session: inserted.rows[0], created: true };

    const existing = await this.pool.query(
      'SELECT * FROM stream_sessions WHERE workspace_id = $1 AND idempotency_key = $2 LIMIT 1',
      [workspaceId, idempotencyKey]
    );
    return { session: existing.rows[0] || null, created: false };
  }

  async transition({ workspaceId, sessionId, expectedState, expectedVersion, toState, failureCode = null, failureMessage = null }) {
    assertTransition(expectedState, toState);
    const result = await this.pool.query(
      `UPDATE stream_sessions
          SET state = $5,
              version = version + 1,
              failure_code = $6,
              failure_message = $7,
              started_at = CASE WHEN $5 = 'LIVE' AND started_at IS NULL THEN NOW() ELSE started_at END,
              stopped_at = CASE WHEN $5 IN ('STOPPED','FAILED','CANCELLED') THEN NOW() ELSE stopped_at END,
              updated_at = NOW()
        WHERE workspace_id = $1 AND id = $2 AND state = $3 AND version = $4
        RETURNING *`,
      [workspaceId, sessionId, expectedState, expectedVersion, toState, failureCode, failureMessage]
    );
    if (!result.rows[0]) {
      const error = new Error('Stream session changed concurrently');
      error.code = 'STREAM_SESSION_CONFLICT';
      throw error;
    }
    return result.rows[0];
  }
}

module.exports = { StreamSessionRepository };
