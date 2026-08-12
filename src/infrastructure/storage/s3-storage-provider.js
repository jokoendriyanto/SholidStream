'use strict';

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { StorageProvider, normalizeStorageKey } = require('./storage-provider');

class S3StorageProvider extends StorageProvider {
  constructor({ client, bucket, signer = getSignedUrl } = {}) {
    super();
    if (!client || typeof client.send !== 'function') throw new TypeError('S3 client is required');
    if (!bucket) throw new TypeError('S3 bucket is required');
    this.client = client;
    this.bucket = bucket;
    this.signer = signer;
  }

  async putObject(key, body, { contentType, metadata } = {}) {
    const safeKey = normalizeStorageKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: safeKey, Body: body, ContentType: contentType, Metadata: metadata }));
    return { key: safeKey, driver: 's3' };
  }

  async getObject(key) {
    const safeKey = normalizeStorageKey(key);
    return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: safeKey }));
  }

  async deleteObject(key) {
    const safeKey = normalizeStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }));
    return true;
  }

  async exists(key) {
    const safeKey = normalizeStorageKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: safeKey }));
      return true;
    } catch (error) {
      const status = error.$metadata && error.$metadata.httpStatusCode;
      if (status === 404 || error.name === 'NotFound' || error.Code === 'NotFound') return false;
      throw error;
    }
  }

  async signedGetUrl(key, { expiresIn = 900 } = {}) {
    const safeKey = normalizeStorageKey(key);
    return this.signer(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: safeKey }), { expiresIn });
  }
}

function createS3Client(config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

module.exports = { S3StorageProvider, createS3Client };
