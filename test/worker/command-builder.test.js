'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFfmpegCommand } = require('../../src/worker/ffmpeg/command-builder');

function command(overrides = {}) {
  return {
    command: 'START_SESSION',
    version: 1,
    sessionId: 'session-1',
    workspaceId: 'workspace-1',
    definitionId: 'definition-1',
    generation: 1,
    leaseToken: 'lease-secret',
    sources: [{ kind: 'file', uri: 'file:///data/video.mp4' }],
    outputs: [{ url: 'rtmps://example.invalid/live/secret-key' }],
    encodingProfile: { resolution: '1920x1080', fps: 30, videoBitrateKbps: 4000 },
    runtimePolicy: { loop: true },
    ...overrides
  };
}

test('buildFfmpegCommand creates a structured argument array and redacts endpoints', () => {
  const result = buildFfmpegCommand(command(), { executable: '/usr/bin/ffmpeg' });
  assert.equal(result.executable, '/usr/bin/ffmpeg');
  assert.equal(Array.isArray(result.args), true);
  assert.equal(result.args.includes('-i'), true);
  assert.equal(result.args.includes('rtmps://example.invalid/live/secret-key'), true);
  assert.equal(result.redactedArgs.includes('rtmps://example.invalid/live/secret-key'), false);
  assert.equal(result.redactedArgs.includes('file:///data/video.mp4'), false);
});

test('worker v1 rejects multiple sources or outputs', () => {
  assert.throws(() => buildFfmpegCommand(command({ sources: [
    { kind: 'file', uri: 'file:///a.mp4' },
    { kind: 'file', uri: 'file:///b.mp4' }
  ] })), /exactly one source/);
  assert.throws(() => buildFfmpegCommand(command({ outputs: [
    { url: 'rtmps://example.invalid/live/a' },
    { url: 'rtmps://example.invalid/live/b' }
  ] })), /exactly one output/);
});

test('worker command rejects non RTMP destinations', () => {
  assert.throws(() => buildFfmpegCommand(command({ outputs: [{ url: 'https://example.invalid/upload' }] })), /RTMP\/RTMPS/);
});
