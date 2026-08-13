'use strict';

const { spawn } = require('child_process');

function isProgressLine(line) {
  return /(?:^|\s)(?:frame=|time=|speed=)/.test(line);
}

class FfmpegProcessSupervisor {
  constructor({ spawnImpl = spawn, killTimeoutMs = 5000, now = () => Date.now() } = {}) {
    this.spawnImpl = spawnImpl;
    this.killTimeoutMs = killTimeoutMs;
    this.now = now;
    this.processes = new Map();
  }

  has(sessionId) {
    return this.processes.has(sessionId);
  }

  get(sessionId) {
    const entry = this.processes.get(sessionId);
    if (!entry) return null;
    return {
      sessionId,
      pid: entry.child.pid || null,
      startedAt: entry.startedAt,
      lastActivityAt: entry.lastActivityAt,
      stopping: entry.stopping
    };
  }

  list() {
    return Array.from(this.processes.keys());
  }

  start({ sessionId, executable, args, onProgress = () => {}, onLog = () => {}, onExit = () => {} }) {
    if (!sessionId) throw new TypeError('sessionId is required');
    if (this.processes.has(sessionId)) {
      const error = new Error(`Session ${sessionId} already has a running process`);
      error.code = 'WORKER_PROCESS_EXISTS';
      throw error;
    }
    if (!executable || !Array.isArray(args)) throw new TypeError('executable and args are required');

    const child = this.spawnImpl(executable, args, {
      shell: false,
      detached: false,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    const entry = {
      child,
      startedAt: this.now(),
      lastActivityAt: this.now(),
      stopping: false,
      settled: false,
      stderrBuffer: ''
    };
    this.processes.set(sessionId, entry);

    const settle = (result) => {
      if (entry.settled) return;
      entry.settled = true;
      this.processes.delete(sessionId);
      Promise.resolve(onExit(result)).catch(() => {});
    };

    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.on('data', (chunk) => {
        entry.lastActivityAt = this.now();
        entry.stderrBuffer += chunk.toString();
        const lines = entry.stderrBuffer.split(/\r?\n/);
        entry.stderrBuffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (isProgressLine(line)) Promise.resolve(onProgress(line)).catch(() => {});
          else Promise.resolve(onLog(line)).catch(() => {});
        }
      });
    }

    child.once('error', (error) => settle({ code: null, signal: null, error, stopping: entry.stopping }));
    child.once('exit', (code, signal) => settle({ code, signal, error: null, stopping: entry.stopping }));

    return this.get(sessionId);
  }

  async stop(sessionId) {
    const entry = this.processes.get(sessionId);
    if (!entry) return false;
    entry.stopping = true;

    await new Promise((resolve) => {
      let finished = false;
      let forceTimer = null;
      const done = () => {
        if (finished) return;
        finished = true;
        if (forceTimer) clearTimeout(forceTimer);
        resolve();
      };

      entry.child.once('exit', done);
      try {
        entry.child.kill('SIGTERM');
      } catch (_) {
        done();
        return;
      }

      forceTimer = setTimeout(() => {
        if (entry.child.exitCode === null) {
          try { entry.child.kill('SIGKILL'); } catch (_) {}
        }
        done();
      }, this.killTimeoutMs);
    });

    return true;
  }

  async shutdown() {
    const sessions = this.list();
    await Promise.all(sessions.map((sessionId) => this.stop(sessionId)));
  }
}

module.exports = { FfmpegProcessSupervisor, isProgressLine };
