'use strict';

class WorkerNodeRepository {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async register({ workerKey, region = 'default', maxStreams = 2, capabilities = {}, metadata = {} }) {
    const result = await this.pool.query(
      `INSERT INTO worker_nodes(worker_key, region, status, max_streams, capabilities, metadata, last_heartbeat_at)
       VALUES ($1,$2,'HEALTHY',$3,$4::jsonb,$5::jsonb,NOW())
       ON CONFLICT (worker_key) DO UPDATE SET
         region = EXCLUDED.region,
         max_streams = EXCLUDED.max_streams,
         capabilities = EXCLUDED.capabilities,
         metadata = EXCLUDED.metadata,
         status = CASE WHEN worker_nodes.status = 'MAINTENANCE' THEN 'MAINTENANCE' ELSE 'HEALTHY' END,
         last_heartbeat_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [workerKey, region, maxStreams, JSON.stringify(capabilities), JSON.stringify(metadata)]
    );
    return result.rows[0];
  }

  async heartbeat({ workerId, cpuPercent = null, memoryPercent = null, activeStreams = 0, capabilities = null }) {
    const result = await this.pool.query(
      `UPDATE worker_nodes SET
         cpu_percent = $2,
         memory_percent = $3,
         active_streams = GREATEST(0, $4),
         capabilities = COALESCE($5::jsonb, capabilities),
         status = CASE WHEN status IN ('DRAINING','MAINTENANCE') THEN status ELSE 'HEALTHY' END,
         last_heartbeat_at = NOW(),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [workerId, cpuPercent, memoryPercent, activeStreams, capabilities ? JSON.stringify(capabilities) : null]
    );
    return result.rows[0] || null;
  }

  async markStatus(workerId, status) {
    const allowed = new Set(['REGISTERING','HEALTHY','DEGRADED','DRAINING','OFFLINE','MAINTENANCE']);
    if (!allowed.has(status)) throw new TypeError(`Invalid worker status: ${status}`);
    const result = await this.pool.query(
      'UPDATE worker_nodes SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [workerId, status]
    );
    return result.rows[0] || null;
  }

  async findById(workerId) {
    const result = await this.pool.query('SELECT * FROM worker_nodes WHERE id = $1 LIMIT 1', [workerId]);
    return result.rows[0] || null;
  }

  async listCandidates({ heartbeatAfter, region = null } = {}) {
    const result = await this.pool.query(
      `SELECT * FROM worker_nodes
       WHERE status = 'HEALTHY'
         AND last_heartbeat_at >= $1
         AND (active_streams + reserved_streams) < max_streams
       ORDER BY CASE WHEN $2::text IS NOT NULL AND region = $2 THEN 0 ELSE 1 END,
                reliability_score DESC,
                updated_at DESC`,
      [heartbeatAfter || new Date(Date.now() - 60000).toISOString(), region]
    );
    return result.rows;
  }
}

module.exports = { WorkerNodeRepository };
