'use strict';

const { Pool } = require('pg');
const { loadPlatformEnv, assertPlatformEnv } = require('../../config/env');

let sharedPool = null;

function createPostgresPool(options = {}) {
  const env = assertPlatformEnv(options.env || loadPlatformEnv(), { requireDatabase: true });
  const PoolClass = options.PoolClass || Pool;
  return new PoolClass({
    connectionString: env.database.url,
    max: env.database.poolMax,
    ssl: env.database.ssl ? { rejectUnauthorized: false } : false,
    application_name: 'sholidstream-control-plane'
  });
}

function getPostgresPool(options = {}) {
  if (!sharedPool) sharedPool = createPostgresPool(options);
  return sharedPool;
}

async function closePostgresPool() {
  if (!sharedPool) return;
  const pool = sharedPool;
  sharedPool = null;
  await pool.end();
}

module.exports = { createPostgresPool, getPostgresPool, closePostgresPool };
