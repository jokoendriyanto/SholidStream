'use strict';

const { createWorkspaceContext } = require('../../domain/tenancy/workspace-context');

function createWorkspaceMiddleware({ workspaceRepository }) {
  if (!workspaceRepository || typeof workspaceRepository.findMembership !== 'function') {
    throw new TypeError('workspaceRepository.findMembership() is required');
  }

  return async function workspaceContext(req, res, next) {
    const userId = req.session && req.session.userId;
    if (!userId) return res.redirect('/login');

    const workspaceId = req.get?.('x-workspace-id') || req.session.activeWorkspaceId;
    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace is required' });
    }

    try {
      const membership = await workspaceRepository.findMembership(userId, workspaceId);
      if (!membership || membership.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Workspace access denied' });
      }

      req.workspace = createWorkspaceContext({ workspaceId, userId, role: membership.role });
      req.session.activeWorkspaceId = workspaceId;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createWorkspaceMiddleware };
