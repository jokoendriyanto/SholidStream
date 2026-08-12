const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('baseline stays on Node 20 compatible built-ins', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /FROM node:20-bookworm/);
});

test('baseline package version remains StreamFlow 2.2.2 during phase 0-1', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.2.2');
  assert.equal(pkg.main, 'app.js');
});

test('streaming runtime is still process-local before worker extraction', () => {
  const service = read('services/streamingService.js');
  assert.match(service, /const activeStreams = new Map\(\)/);
  assert.match(service, /const streamRetryCount = new Map\(\)/);
  assert.match(service, /function healthCheckStreams\(/);
  assert.match(service, /function gracefulShutdown\(/);
});

test('app bootstrap still initializes legacy scheduler and rotation services', () => {
  const app = read('app.js');
  assert.match(app, /schedulerService\.init\(streamingService\)/);
  assert.match(app, /rotationService\.init\(\)/);
  assert.match(app, /streamingService\.syncStreamStatuses\(\)/);
});

test('SQLite remains an explicit baseline dependency until PostgreSQL migration phase', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies.sqlite3);
  assert.ok(pkg.dependencies['connect-sqlite3']);
});
