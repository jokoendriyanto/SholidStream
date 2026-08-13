'use strict';

class StreamEventRepository {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async append({ workspaceId, sessionId, eventType, fromState = null, toState = null, generation, correlationId = null, metadata = {} }) {
    const result = await this.pool.query(
      `INSERT INTO stream_events(
         workspace_id, session_id, event_type, from_state, to_state, generation, correlation_id, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING *`,
      [workspaceId, sessionId, eventType, fromState, toState, generation, correlationId, JSON.stringify(metadata)]
    );
    return result.rows[0];
  }
}

module.exports = { StreamEventRepository };
