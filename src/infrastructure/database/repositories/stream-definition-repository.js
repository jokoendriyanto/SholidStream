'use strict';

const { WorkspaceScopedRepository } = require('./workspace-scoped-repository');

class StreamDefinitionRepository extends WorkspaceScopedRepository {
  constructor(pool) { super(pool, 'stream_definitions'); }
}

module.exports = { StreamDefinitionRepository };
