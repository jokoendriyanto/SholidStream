'use strict';

const ROLE_ORDER = Object.freeze({ viewer: 10, operator: 20, admin: 30, owner: 40 });

function createWorkspaceContext({ workspaceId, userId, role }) {
  if (!workspaceId) throw new TypeError('workspaceId is required');
  if (!userId) throw new TypeError('userId is required');
  if (!Object.prototype.hasOwnProperty.call(ROLE_ORDER, role)) {
    throw new TypeError(`Unsupported workspace role: ${role}`);
  }

  const context = {
    workspaceId,
    userId,
    role,
    can(requiredRole) {
      if (!Object.prototype.hasOwnProperty.call(ROLE_ORDER, requiredRole)) return false;
      return ROLE_ORDER[role] >= ROLE_ORDER[requiredRole];
    },
    assert(requiredRole) {
      if (!this.can(requiredRole)) {
        const error = new Error(`Workspace role ${requiredRole} required`);
        error.code = 'WORKSPACE_FORBIDDEN';
        throw error;
      }
      return true;
    }
  };

  return Object.freeze(context);
}

module.exports = { ROLE_ORDER, createWorkspaceContext };
