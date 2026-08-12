'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { normalizeStorageKey } = require('../../src/infrastructure/storage/storage-provider');
const { LocalStorageProvider } = require('../../src/infrastructure/storage/local-storage-provider');
const { WorkspaceStorage } = require('../../src/infrastructure/storage/workspace-storage');

test('storage keys reject traversal', () => {
  assert.equal(normalizeStorageKey('folder/video.mp4'), 'folder/video.mp4');
  assert.throws(() => normalizeStorageKey('../secret'), /Unsafe/);
  assert.throws(() => normalizeStorageKey('folder/../secret'), /Unsafe/);
});

test('local provider supports put/read/exists/delete lifecycle', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sholidstream-storage-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const provider = new LocalStorageProvider({ root });
  await provider.putObject('a/b.txt', Buffer.from('hello'));
  assert.equal(await provider.exists('a/b.txt'), true);
  assert.equal((await provider.getObject('a/b.txt')).toString(), 'hello');
  assert.equal(await provider.deleteObject('a/b.txt'), true);
  assert.equal(await provider.exists('a/b.txt'), false);
});

test('workspace storage always prefixes tenant namespace', async () => {
  let captured;
  const provider = { async putObject(key) { captured = key; return { key }; } };
  const storage = new WorkspaceStorage(provider);
  await storage.putObject('workspace_123', 'videos/demo.mp4', Buffer.alloc(0));
  assert.equal(captured, 'workspaces/workspace_123/videos/demo.mp4');
});
