'use strict';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function integer(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadPlatformEnv(source = process.env) {
  return Object.freeze({
    database: {
      url: source.DATABASE_URL || '',
      ssl: bool(source.DATABASE_SSL, false),
      poolMax: integer(source.DATABASE_POOL_MAX, 20)
    },
    redis: {
      url: source.REDIS_URL || 'redis://127.0.0.1:6379',
      queuePrefix: source.QUEUE_PREFIX || 'sholidstream'
    },
    storage: {
      driver: source.STORAGE_DRIVER || 'local',
      localRoot: source.LOCAL_STORAGE_ROOT || './data/storage',
      s3: {
        endpoint: source.S3_ENDPOINT || undefined,
        region: source.S3_REGION || 'us-east-1',
        bucket: source.S3_BUCKET || '',
        accessKeyId: source.S3_ACCESS_KEY_ID || '',
        secretAccessKey: source.S3_SECRET_ACCESS_KEY || '',
        forcePathStyle: bool(source.S3_FORCE_PATH_STYLE, false)
      }
    }
  });
}

function assertPlatformEnv(config, { requireDatabase = false, requireS3 = false } = {}) {
  if (requireDatabase && !config.database.url) {
    throw new Error('DATABASE_URL is required');
  }
  if (requireS3) {
    const { bucket, accessKeyId, secretAccessKey } = config.storage.s3;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required for S3 storage');
    }
  }
  return config;
}

module.exports = { loadPlatformEnv, assertPlatformEnv };
