'use strict';

const fs = require('fs/promises');
const path = require('path');
const { StorageProvider, normalizeStorageKey } = require('./storage-provider');

class LocalStorageProvider extends StorageProvider {
  constructor({ root, publicBaseUrl = null } = {}) {
    super();
    if (!root) throw new TypeError('Local storage root is required');
    this.root = path.resolve(root);
    this.publicBaseUrl = publicBaseUrl;
  }

  resolve(key) {
    const safeKey = normalizeStorageKey(key);
    const resolved = path.resolve(this.root, safeKey);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`)) {
      throw new Error('Storage key escapes root');
    }
    return { safeKey, resolved };
  }

  async putObject(key, body) {
    const { safeKey, resolved } = this.resolve(key);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, body);
    const stat = await fs.stat(resolved);
    return { key: safeKey, size: stat.size, driver: 'local' };
  }

  async getObject(key) {
    const { resolved } = this.resolve(key);
    return fs.readFile(resolved);
  }

  async deleteObject(key) {
    const { resolved } = this.resolve(key);
    try {
      await fs.unlink(resolved);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async exists(key) {
    const { resolved } = this.resolve(key);
    try {
      await fs.access(resolved);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async signedGetUrl(key) {
    const { safeKey, resolved } = this.resolve(key);
    if (this.publicBaseUrl) {
      const encoded = safeKey.split('/').map(encodeURIComponent).join('/');
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${encoded}`;
    }
    return `file://${resolved}`;
  }
}

module.exports = { LocalStorageProvider };
