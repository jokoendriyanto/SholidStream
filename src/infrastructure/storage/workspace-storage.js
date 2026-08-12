'use strict';

const { normalizeStorageKey } = require('./storage-provider');

class WorkspaceStorage {
  constructor(provider) {
    if (!provider || typeof provider.putObject !== 'function') throw new TypeError('Storage provider is required');
    this.provider = provider;
  }

  key(workspaceId, key) {
    if (!workspaceId || !/^[A-Za-z0-9_-]+$/.test(String(workspaceId))) {
      throw new TypeError('Safe workspaceId is required');
    }
    return `workspaces/${workspaceId}/${normalizeStorageKey(key)}`;
  }

  putObject(workspaceId, key, body, options) { return this.provider.putObject(this.key(workspaceId, key), body, options); }
  getObject(workspaceId, key) { return this.provider.getObject(this.key(workspaceId, key)); }
  deleteObject(workspaceId, key) { return this.provider.deleteObject(this.key(workspaceId, key)); }
  exists(workspaceId, key) { return this.provider.exists(this.key(workspaceId, key)); }
  signedGetUrl(workspaceId, key, options) { return this.provider.signedGetUrl(this.key(workspaceId, key), options); }
}

module.exports = { WorkspaceStorage };
