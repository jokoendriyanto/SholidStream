'use strict';

function normalizeStorageKey(key) {
  if (!key || typeof key !== 'string') throw new TypeError('Storage key is required');
  const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  const parts = normalized.split('/');
  if (parts.some((part) => part === '..' || part === '.' || part === '')) {
    throw new Error('Unsafe storage key');
  }
  return parts.join('/');
}

class StorageProvider {
  async putObject() { throw new Error('putObject() not implemented'); }
  async getObject() { throw new Error('getObject() not implemented'); }
  async deleteObject() { throw new Error('deleteObject() not implemented'); }
  async exists() { throw new Error('exists() not implemented'); }
  async signedGetUrl() { throw new Error('signedGetUrl() not implemented'); }
}

module.exports = { StorageProvider, normalizeStorageKey };
