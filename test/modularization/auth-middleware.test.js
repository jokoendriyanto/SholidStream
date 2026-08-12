'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAuthenticated, createAdminMiddleware } = require('../../src/http/middleware/auth');

function createResponseRecorder() {
  return {
    redirectedTo: null,
    redirect(path) {
      this.redirectedTo = path;
      return this;
    }
  };
}

test('isAuthenticated calls next for an authenticated session', () => {
  let called = false;
  const req = { session: { userId: 'user-1' } };
  const res = createResponseRecorder();

  isAuthenticated(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(res.redirectedTo, null);
});

test('isAuthenticated redirects anonymous requests to login', () => {
  const req = { session: {} };
  const res = createResponseRecorder();

  isAuthenticated(req, res, () => assert.fail('next must not be called'));

  assert.equal(res.redirectedTo, '/login');
});

test('admin middleware attaches admin user and calls next', async () => {
  const admin = { id: 'admin-1', user_role: 'admin' };
  const isAdmin = createAdminMiddleware({
    User: { findById: async () => admin }
  });
  const req = { session: { userId: admin.id } };
  const res = createResponseRecorder();
  let called = false;

  await isAdmin(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(req.user, admin);
  assert.equal(res.redirectedTo, null);
});

test('admin middleware redirects non-admin users to dashboard', async () => {
  const isAdmin = createAdminMiddleware({
    User: { findById: async () => ({ id: 'user-1', user_role: 'user' }) }
  });
  const req = { session: { userId: 'user-1' } };
  const res = createResponseRecorder();

  await isAdmin(req, res, () => assert.fail('next must not be called'));

  assert.equal(res.redirectedTo, '/dashboard');
});
