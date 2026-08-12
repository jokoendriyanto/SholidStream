'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadPlatformEnv, assertPlatformEnv } = require('../../src/config/env');
const { createPostgresPool } = require('../../src/infrastructure/database/postgres');

const sql = fs.readFileSync(path.join(__dirname, '../../src/infrastructure/database/migrations/001_saas_core.sql'), 'utf8');

test('phase 3 schema declares PostgreSQL users and audit logs', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit_logs/i);
  assert.doesNotMatch(sql, /AUTOINCREMENT/i);
});

test('platform env parses database configuration', () => {
  const config = loadPlatformEnv({ DATABASE_URL: 'postgres://db/test', DATABASE_SSL: 'true', DATABASE_POOL_MAX: '7' });
  assert.equal(config.database.url, 'postgres://db/test');
  assert.equal(config.database.ssl, true);
  assert.equal(config.database.poolMax, 7);
  assert.equal(assertPlatformEnv(config, { requireDatabase: true }), config);
});

test('postgres pool factory is dependency injectable and does not connect eagerly', () => {
  let received;
  class FakePool { constructor(options) { received = options; } }
  const env = loadPlatformEnv({ DATABASE_URL: 'postgres://db/test', DATABASE_POOL_MAX: '9' });
  const pool = createPostgresPool({ env, PoolClass: FakePool });
  assert.ok(pool instanceof FakePool);
  assert.equal(received.connectionString, 'postgres://db/test');
  assert.equal(received.max, 9);
});
