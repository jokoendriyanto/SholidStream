'use strict';

const { STREAM_STATE } = require('../../../domain/streaming/stream-state');
const { assertTransition } = require('../../../domain/streaming/stream-state-machine');

class StreamSessionRepository {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async findById(workspaceId, sessionId) {
    const result = await this.pool.query('SELECT * FROM stream_sessions WHERE workspace_id = $1 AND id = $2 LIMIT 1', [workspaceId, sessionId]);
    return result.rows[0] || null;
  }

  async createQueued({ workspaceId, definitionId, idempotencyKey }) {
    const inserted = await this.pool.query(
      `INSERT INTO stream_sessions(workspace_id, stream_definition_id, idempotency_key, state, desired_state, queued_at)
       VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (workspace_id, idempotency_key) DO NOTHING RETURNING *`,
      [workspaceId, definitionId, idempotencyKey, STREAM_STATE.QUEUED, STREAM_STATE.LIVE]
    );
    if (inserted.rows[0]) return { session: inserted.rows[0], created: true };
    const existing = await this.pool.query('SELECT * FROM stream_sessions WHERE workspace_id=$1 AND idempotency_key=$2 LIMIT 1', [workspaceId, idempotencyKey]);
    return { session: existing.rows[0] || null, created: false };
  }

  async transition({ workspaceId, sessionId, expectedState, expectedVersion, toState, failureCode = null, failureMessage = null }) {
    assertTransition(expectedState, toState);
    const result = await this.pool.query(
      `UPDATE stream_sessions SET state=$5, version=version+1, failure_code=$6, failure_message=$7,
         started_at=CASE WHEN $5='LIVE' AND started_at IS NULL THEN NOW() ELSE started_at END,
         stopped_at=CASE WHEN $5 IN ('STOPPED','FAILED','CANCELLED') THEN NOW() ELSE stopped_at END,
         lease_token_hash=CASE WHEN $5 IN ('STOPPED','FAILED','CANCELLED') THEN NULL ELSE lease_token_hash END,
         lease_expires_at=CASE WHEN $5 IN ('STOPPED','FAILED','CANCELLED') THEN NULL ELSE lease_expires_at END,
         updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 AND state=$3 AND version=$4 RETURNING *`,
      [workspaceId, sessionId, expectedState, expectedVersion, toState, failureCode, failureMessage]
    );
    if (!result.rows[0]) { const error = new Error('Stream session changed concurrently'); error.code='STREAM_SESSION_CONFLICT'; throw error; }
    return result.rows[0];
  }

  async assignWorker({ workspaceId, sessionId, expectedVersion, workerId, reservationId }) {
    const result = await this.pool.query(
      `UPDATE stream_sessions SET assigned_worker_id=$4, worker_reservation_id=$5, version=version+1, updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 AND state='ALLOCATING' AND version=$3 RETURNING *`,
      [workspaceId, sessionId, expectedVersion, workerId, reservationId]
    );
    if (!result.rows[0]) { const error=new Error('Unable to assign worker due to concurrent session change'); error.code='STREAM_SESSION_CONFLICT'; throw error; }
    return result.rows[0];
  }

  async claimLease({ workspaceId, sessionId, generation, leaseTokenHash, leaseExpiresAt, workerRuntime = {} }) {
    const result = await this.pool.query(
      `UPDATE stream_sessions SET lease_token_hash=$4, lease_expires_at=$5, last_heartbeat_at=NOW(), worker_runtime=$6::jsonb, version=version+1, updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 AND generation=$3 AND state='ALLOCATING'
         AND (lease_expires_at IS NULL OR lease_expires_at < NOW() OR lease_token_hash=$4) RETURNING *`,
      [workspaceId, sessionId, generation, leaseTokenHash, leaseExpiresAt, JSON.stringify(workerRuntime)]
    );
    if (!result.rows[0]) { const error=new Error('Stream session lease is already owned or stale'); error.code='STREAM_SESSION_LEASE_CONFLICT'; throw error; }
    return result.rows[0];
  }

  async heartbeat({ workspaceId, sessionId, generation, leaseTokenHash, leaseExpiresAt, workerRuntime = {} }) {
    const result = await this.pool.query(
      `UPDATE stream_sessions SET lease_expires_at=$5,last_heartbeat_at=NOW(),worker_runtime=$6::jsonb,updated_at=NOW()
       WHERE workspace_id=$1 AND id=$2 AND generation=$3 AND lease_token_hash=$4 AND state NOT IN ('STOPPED','FAILED','CANCELLED') RETURNING id,state,generation,version`,
      [workspaceId, sessionId, generation, leaseTokenHash, leaseExpiresAt, JSON.stringify(workerRuntime)]
    );
    if (!result.rows[0]) { const error=new Error('Stream session lease was lost'); error.code='STREAM_SESSION_LEASE_LOST'; throw error; }
    return result.rows[0];
  }
}

module.exports = { StreamSessionRepository };
