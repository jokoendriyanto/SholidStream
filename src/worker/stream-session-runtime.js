'use strict';

const crypto = require('crypto');
const os = require('os');
const { STREAM_STATE, TERMINAL_STATES } = require('../domain/streaming/stream-state');
const { validateWorkerCommand } = require('./commands/command-validator');
const { buildFfmpegCommand } = require('./ffmpeg/command-builder');

function hashLeaseToken(token) { return crypto.createHash('sha256').update(token, 'utf8').digest('hex'); }

class StreamSessionRuntime {
  constructor({ sessionRepository, eventRepository, processSupervisor, commandBuilder = buildFfmpegCommand, heartbeatIntervalMs = 15000, leaseDurationMs = 45000, workerIdentity } = {}) {
    if (!sessionRepository || !eventRepository || !processSupervisor) throw new TypeError('StreamSessionRuntime dependencies are required');
    Object.assign(this, { sessionRepository, eventRepository, processSupervisor, commandBuilder, heartbeatIntervalMs, leaseDurationMs });
    this.workerIdentity = workerIdentity || `${os.hostname()}:${process.pid}`;
    this.active = new Map();
  }

  async handle(command) {
    validateWorkerCommand(command);
    if (command.command === 'START_SESSION') return this.start(command);
    if (command.command === 'STOP_SESSION') return this.stop(command);
    throw new TypeError(`Unsupported command ${command.command}`);
  }

  async transition(session, toState, eventType, metadata = {}, failure = {}) {
    const updated = await this.sessionRepository.transition({ workspaceId: session.workspace_id, sessionId: session.id, expectedState: session.state, expectedVersion: session.version, toState, failureCode: failure.code || null, failureMessage: failure.message || null });
    await this.eventRepository.append({ workspaceId: updated.workspace_id, sessionId: updated.id, eventType, fromState: session.state, toState: updated.state, generation: updated.generation, metadata });
    return updated;
  }

  assertGeneration(session, command) {
    if (session.generation !== command.generation) { const error=new Error('Worker command generation is stale'); error.code='STALE_WORKER_GENERATION'; throw error; }
  }

  async start(command) {
    let session = await this.sessionRepository.findById(command.workspaceId, command.sessionId);
    if (!session) { const error=new Error('Stream session not found'); error.code='STREAM_SESSION_NOT_FOUND'; throw error; }
    this.assertGeneration(session, command);
    const existing = this.active.get(command.sessionId);
    const leaseTokenHash = hashLeaseToken(command.leaseToken);
    if (existing) {
      if (existing.leaseTokenHash !== leaseTokenHash || existing.generation !== command.generation) { const error=new Error('Another lease already owns this local session'); error.code='LOCAL_WORKER_LEASE_CONFLICT'; throw error; }
      return { accepted:true, duplicate:true, sessionId:session.id, state:session.state };
    }
    if (TERMINAL_STATES.has(session.state)) { const error=new Error(`Cannot start terminal stream session ${session.state}`); error.code='STREAM_SESSION_TERMINAL'; throw error; }
    if (session.state !== STREAM_STATE.ALLOCATING) { const error=new Error(`START_SESSION requires ALLOCATING state, received ${session.state}`); error.code='STREAM_SESSION_NOT_ALLOCATING'; throw error; }

    const leaseExpiresAt = new Date(Date.now() + this.leaseDurationMs).toISOString();
    session = await this.sessionRepository.claimLease({ workspaceId:command.workspaceId, sessionId:command.sessionId, generation:command.generation, leaseTokenHash, leaseExpiresAt, workerRuntime:{ workerIdentity:this.workerIdentity, pid:process.pid, phase:'claimed' } });
    session = await this.transition(session, STREAM_STATE.PREPARING, 'WORKER_PREPARING', { workerIdentity:this.workerIdentity });
    const mediaCommand = this.commandBuilder(command);
    session = await this.transition(session, STREAM_STATE.STARTING, 'WORKER_STARTING', { workerIdentity:this.workerIdentity, executable:mediaCommand.executable, args:mediaCommand.redactedArgs });
    const runtimeEntry = { workspaceId:command.workspaceId, sessionId:command.sessionId, generation:command.generation, leaseTokenHash, heartbeatTimer:null, liveMarked:false };
    this.active.set(command.sessionId, runtimeEntry);
    try {
      const processInfo = this.processSupervisor.start({ sessionId:command.sessionId, executable:mediaCommand.executable, args:mediaCommand.args, onProgress:()=>this.markLive(command.sessionId), onLog:()=>{}, onExit:(result)=>this.handleProcessExit(command.sessionId,result) });
      session = await this.transition(session, STREAM_STATE.CONNECTING, 'WORKER_PROCESS_STARTED', { workerIdentity:this.workerIdentity, pid:processInfo?.pid || null });
      this.startHeartbeat(runtimeEntry);
      return { accepted:true, duplicate:false, sessionId:session.id, state:session.state, process:processInfo };
    } catch (error) {
      this.clearActive(command.sessionId);
      const current = await this.sessionRepository.findById(command.workspaceId, command.sessionId);
      if (current && !TERMINAL_STATES.has(current.state)) { try { await this.transition(current, STREAM_STATE.FAILED, 'WORKER_START_FAILED', {}, { code:error.code || 'WORKER_START_FAILED', message:error.message }); } catch (_) {} }
      throw error;
    }
  }

  startHeartbeat(entry) {
    const tick = async () => {
      try {
        const processInfo = this.processSupervisor.get(entry.sessionId) || {};
        await this.sessionRepository.heartbeat({ workspaceId:entry.workspaceId, sessionId:entry.sessionId, generation:entry.generation, leaseTokenHash:entry.leaseTokenHash, leaseExpiresAt:new Date(Date.now()+this.leaseDurationMs).toISOString(), workerRuntime:{ workerIdentity:this.workerIdentity, pid:processInfo.pid || null, lastActivityAt:processInfo.lastActivityAt || null } });
      } catch (error) { if (error?.code === 'STREAM_SESSION_LEASE_LOST') await this.processSupervisor.stop(entry.sessionId).catch(()=>{}); }
    };
    entry.heartbeatTimer=setInterval(()=>tick().catch(()=>{}), this.heartbeatIntervalMs); if (typeof entry.heartbeatTimer.unref==='function') entry.heartbeatTimer.unref();
  }

  async markLive(sessionId) {
    const entry=this.active.get(sessionId); if (!entry || entry.liveMarked) return; entry.liveMarked=true;
    const session=await this.sessionRepository.findById(entry.workspaceId,sessionId); if (!session || session.generation!==entry.generation || session.state!==STREAM_STATE.CONNECTING) return;
    await this.transition(session,STREAM_STATE.LIVE,'WORKER_MEDIA_FLOWING',{workerIdentity:this.workerIdentity});
  }

  async stop(command) {
    const session=await this.sessionRepository.findById(command.workspaceId,command.sessionId); if (!session) return {stopped:false,reason:'not_found'}; this.assertGeneration(session,command);
    const expectedHash=hashLeaseToken(command.leaseToken); if (session.lease_token_hash && session.lease_token_hash!==expectedHash) { const error=new Error('STOP_SESSION lease token does not own this session'); error.code='STREAM_SESSION_LEASE_CONFLICT'; throw error; }
    return this.stopSession(session,command.reason || 'requested');
  }

  async stopSession(session,reason) {
    let current=session; if (TERMINAL_STATES.has(current.state)) return {stopped:true,state:current.state};
    if (current.state!==STREAM_STATE.STOPPING) current=await this.transition(current,STREAM_STATE.STOPPING,'WORKER_STOPPING',{reason,workerIdentity:this.workerIdentity});
    await this.processSupervisor.stop(current.id);
    const refreshed=await this.sessionRepository.findById(current.workspace_id,current.id);
    if (refreshed?.state===STREAM_STATE.STOPPING) { try { current=await this.transition(refreshed,STREAM_STATE.STOPPED,'WORKER_STOPPED',{reason,workerIdentity:this.workerIdentity}); } catch (error) { if (error.code!=='STREAM_SESSION_CONFLICT') throw error; current=await this.sessionRepository.findById(current.workspace_id,current.id); } }
    else if (refreshed) current=refreshed;
    this.clearActive(current.id); return {stopped:true,state:current.state};
  }

  async handleProcessExit(sessionId,result) {
    const entry=this.active.get(sessionId); if (!entry) return; this.clearActive(sessionId);
    const session=await this.sessionRepository.findById(entry.workspaceId,sessionId); if (!session || TERMINAL_STATES.has(session.state)) return;
    if (session.state===STREAM_STATE.STOPPING || result.stopping) { if (session.state===STREAM_STATE.STOPPING) { try { await this.transition(session,STREAM_STATE.STOPPED,'WORKER_PROCESS_STOPPED',{code:result.code,signal:result.signal}); } catch (error) { if (error.code!=='STREAM_SESSION_CONFLICT') throw error; } } return; }
    await this.transition(session,STREAM_STATE.FAILED,'WORKER_PROCESS_EXITED',{code:result.code,signal:result.signal},{code:result.error?'FFMPEG_PROCESS_ERROR':'FFMPEG_PROCESS_EXIT',message:result.error?result.error.message:`FFmpeg exited with code ${result.code}`});
  }

  clearActive(sessionId) { const entry=this.active.get(sessionId); if (entry?.heartbeatTimer) clearInterval(entry.heartbeatTimer); this.active.delete(sessionId); }
  async shutdown() { for (const entry of Array.from(this.active.values())) { const session=await this.sessionRepository.findById(entry.workspaceId,entry.sessionId).catch(()=>null); if (session && !TERMINAL_STATES.has(session.state)) await this.stopSession(session,'worker_shutdown').catch(()=>{}); } await this.processSupervisor.shutdown(); }
}

module.exports={StreamSessionRuntime,hashLeaseToken};
