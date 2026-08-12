'use strict';

class WorkspaceRepository {
  constructor(pool) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('PostgreSQL pool is required');
    this.pool = pool;
  }

  async findMembership(userId, workspaceId) {
    const result = await this.pool.query(
      `SELECT workspace_id, user_id, role, status
         FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
        LIMIT 1`,
      [workspaceId, userId]
    );
    return result.rows[0] || null;
  }

  async listForUser(userId) {
    const result = await this.pool.query(
      `SELECT w.id, w.name, w.slug, w.status, wm.role
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = $1 AND wm.status = 'active' AND w.status = 'active'
        ORDER BY w.created_at ASC`,
      [userId]
    );
    return result.rows;
  }

  async createPersonalWorkspace({ userId, name, slug }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const workspaceResult = await client.query(
        `INSERT INTO workspaces(name, slug, owner_user_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, slug, userId]
      );
      const workspace = workspaceResult.rows[0];
      await client.query(
        `INSERT INTO workspace_members(workspace_id, user_id, role, status)
         VALUES ($1, $2, 'owner', 'active')`,
        [workspace.id, userId]
      );
      await client.query('COMMIT');
      return workspace;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { WorkspaceRepository };
