'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('worker runtime migration adds lease fencing and heartbeat persistence', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../src/infrastructure/database/migrations/005_worker_runtime.sql'), 'utf8');
  assert.match(sql, /lease_token_hash/);
  assert.match(sql, /last_heartbeat_at/);
  assert.match(sql, /worker_runtime JSONB/);
  assert.match(sql, /stream_sessions_lease_idx/);
});
