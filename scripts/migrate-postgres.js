#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { getPostgresPool, closePostgresPool } = require('../src/infrastructure/database/postgres');

const migrationsDir = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'migrations');

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrate() {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
    const appliedResult = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map((row) => row.version));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await closePostgresPool();
  }
}

migrate().catch((error) => {
  console.error('PostgreSQL migration failed:', error);
  process.exitCode = 1;
});
