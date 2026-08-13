'use strict';

const os = require('os');

class WorkerNodeAgent {
  constructor({ repository, workerKey, region = 'default', maxStreams = 2, capabilities = {}, heartbeatIntervalMs = 15000, activeStreams = () => 0 } = {}) {
    if (!repository || !workerKey) throw new TypeError('WorkerNodeAgent repository and workerKey are required');
    this.repository = repository;
    this.workerKey = workerKey;
    this.region = region;
    this.maxStreams = maxStreams;
    this.capabilities = capabilities;
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.activeStreams = activeStreams;
    this.node = null;
    this.timer = null;
  }

  metrics() {
    const total = os.totalmem();
    const used = total - os.freemem();
    return {
      cpuPercent: Math.min(100, Math.max(0, (os.loadavg()[0] / Math.max(1, os.cpus().length)) * 100)),
      memoryPercent: total > 0 ? (used / total) * 100 : 0,
      activeStreams: this.activeStreams()
    };
  }

  async start() {
    this.node = await this.repository.register({
      workerKey: this.workerKey,
      region: this.region,
      maxStreams: this.maxStreams,
      capabilities: this.capabilities,
      metadata: { hostname: os.hostname(), platform: process.platform, arch: process.arch }
    });
    const beat = async () => {
      if (!this.node) return;
      await this.repository.heartbeat({ workerId: this.node.id, ...this.metrics(), capabilities: this.capabilities });
    };
    await beat();
    this.timer = setInterval(() => beat().catch(() => {}), this.heartbeatIntervalMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    return this.node;
  }

  async drain() {
    if (this.node) await this.repository.markStatus(this.node.id, 'DRAINING');
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.node) await this.repository.markStatus(this.node.id, 'OFFLINE').catch(() => {});
  }
}

module.exports = { WorkerNodeAgent };
