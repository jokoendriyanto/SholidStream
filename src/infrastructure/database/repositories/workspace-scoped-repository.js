'use strict';

class WorkspaceScopedRepository {
  constructor(pool, tableName) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) throw new TypeError('Unsafe table name');
    this.pool = pool;
    this.tableName = tableName;
  }

  async findById(workspaceId, id) {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE workspace_id = $1 AND id = $2 LIMIT 1`,
      [workspaceId, id]
    );
    return result.rows[0] || null;
  }

  async deleteById(workspaceId, id) {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE workspace_id = $1 AND id = $2 RETURNING id`,
      [workspaceId, id]
    );
    return result.rowCount === 1;
  }
}

module.exports = { WorkspaceScopedRepository };
