'use strict';

class WorkerReservationRepository {
  constructor(pool) {
    if (!pool || typeof pool.connect !== 'function') throw new TypeError('PostgreSQL pool with connect() is required');
    this.pool = pool;
  }

  async reserve({ workerId, sessionId, generation, ttlMs = 30000 }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const workerResult = await client.query('SELECT * FROM worker_nodes WHERE id = $1 FOR UPDATE', [workerId]);
      const worker = workerResult.rows[0];
      if (!worker || worker.status !== 'HEALTHY' || Number(worker.active_streams) + Number(worker.reserved_streams) >= Number(worker.max_streams)) {
        const error = new Error('Worker has no capacity');
        error.code = 'WORKER_CAPACITY_UNAVAILABLE';
        throw error;
      }
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const inserted = await client.query(
        `INSERT INTO worker_capacity_reservations(worker_id, session_id, generation, expires_at)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [workerId, sessionId, generation, expiresAt]
      );
      await client.query('UPDATE worker_nodes SET reserved_streams = reserved_streams + 1, updated_at = NOW() WHERE id = $1', [workerId]);
      await client.query('COMMIT');
      return inserted.rows[0];
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async activate(reservationId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE worker_capacity_reservations SET status='ACTIVE', updated_at=NOW()
         WHERE id=$1 AND status='RESERVED' RETURNING *`, [reservationId]
      );
      const reservation = result.rows[0];
      if (reservation) {
        await client.query(
          `UPDATE worker_nodes SET reserved_streams=GREATEST(0,reserved_streams-1), active_streams=active_streams+1, updated_at=NOW()
           WHERE id=$1`, [reservation.worker_id]
        );
      }
      await client.query('COMMIT');
      return reservation || null;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async release(reservationId, status = 'RELEASED') {
    if (!['RELEASED','EXPIRED'].includes(status)) throw new TypeError('Invalid reservation release status');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE worker_capacity_reservations SET status=$2, updated_at=NOW()
         WHERE id=$1 AND status IN ('RESERVED','ACTIVE') RETURNING *`, [reservationId, status]
      );
      const reservation = result.rows[0];
      if (reservation) {
        await client.query(
          `UPDATE worker_nodes SET
             reserved_streams=GREATEST(0,reserved_streams-CASE WHEN $2='RESERVED' THEN 1 ELSE 0 END),
             active_streams=GREATEST(0,active_streams-CASE WHEN $2='ACTIVE' THEN 1 ELSE 0 END),
             updated_at=NOW()
           WHERE id=$1`, [reservation.worker_id, reservation.status]
        );
      }
      await client.query('COMMIT');
      return reservation || null;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
}

module.exports = { WorkerReservationRepository };
