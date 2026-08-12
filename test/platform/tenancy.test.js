'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createWorkspaceContext } = require('../../src/domain/tenancy/workspace-context');
const { createWorkspaceMiddleware } = require('../../src/http/middleware/workspace-context');
const { WorkspaceScopedRepository } = require('../../src/infrastructure/database/repositories/workspace-scoped-repository');

const sql = fs.readFileSync(path.join(__dirname, '../../src/infrastructure/database/migrations/002_tenancy.sql'), 'utf8');

test('tenancy schema enforces one membership per user and workspace', () => {
  assert.match(sql, /PRIMARY KEY \(workspace_id, user_id\)/i);
  assert.match(sql, /owner','admin','operator','viewer/i);
});

test('workspace role hierarchy is monotonic', () => {
  const operator = createWorkspaceContext({ workspaceId: 'w1', userId: 'u1', role: 'operator' });
  assert.equal(operator.can('viewer'), true);
  assert.equal(operator.can('operator'), true);
  assert.equal(operator.can('admin'), false);
  assert.throws(() => operator.assert('admin'), /admin/);
});

test('workspace middleware rejects cross-tenant membership absence', async () => {
  const middleware = createWorkspaceMiddleware({ workspaceRepository: { findMembership: async () => null } });
  const req = { session: { userId: 'u1', activeWorkspaceId: 'w2' }, get: () => undefined };
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, redirect() { throw new Error('unexpected redirect'); } };
  await middleware(req, res, () => assert.fail('next must not run'));
  assert.equal(res.statusCode, 403);
});

test('workspace-scoped repository always includes workspace id in queries', async () => {
  let captured;
  const repo = new WorkspaceScopedRepository({ query: async (text, values) => { captured = { text, values }; return { rows: [] }; } }, 'stream_definitions');
  await repo.findById('workspace-A', 'stream-B');
  assert.match(captured.text, /workspace_id = \$1/);
  assert.deepEqual(captured.values, ['workspace-A', 'stream-B']);
});
