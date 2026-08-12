'use strict';

const { loadPlatformEnv, assertPlatformEnv } = require('../../config/env');
const { LocalStorageProvider } = require('./local-storage-provider');
const { S3StorageProvider, createS3Client } = require('./s3-storage-provider');
const { WorkspaceStorage } = require('./workspace-storage');

function createStorage({ env = loadPlatformEnv(), s3Client } = {}) {
  let provider;
  if (env.storage.driver === 'local') {
    provider = new LocalStorageProvider({ root: env.storage.localRoot });
  } else if (env.storage.driver === 's3') {
    assertPlatformEnv(env, { requireS3: true });
    provider = new S3StorageProvider({ client: s3Client || createS3Client(env.storage.s3), bucket: env.storage.s3.bucket });
  } else {
    throw new Error(`Unsupported STORAGE_DRIVER: ${env.storage.driver}`);
  }
  return new WorkspaceStorage(provider);
}

module.exports = { createStorage };
