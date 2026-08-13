'use strict';

const { validateStartSessionCommand } = require('../commands/command-validator');

const ALLOWED_VIDEO_CODECS = new Set(['libx264']);
const ALLOWED_AUDIO_CODECS = new Set(['aac']);
const ALLOWED_PRESETS = new Set(['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow']);

function positiveInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function normalizeResolution(value) {
  if (typeof value !== 'string' || !/^\d{2,5}x\d{2,5}$/.test(value)) return '1280x720';
  return value;
}

function buildFfmpegCommand(command, { executable = 'ffmpeg' } = {}) {
  validateStartSessionCommand(command);
  if (command.sources.length !== 1) throw new TypeError('Worker V1 supports exactly one source per session');
  if (command.outputs.length !== 1) throw new TypeError('Worker V1 supports exactly one output per session');

  const source = command.sources[0];
  const output = command.outputs[0];
  const profile = command.encodingProfile || {};
  const runtime = command.runtimePolicy || {};
  const videoCodec = ALLOWED_VIDEO_CODECS.has(profile.videoCodec) ? profile.videoCodec : 'libx264';
  const audioCodec = ALLOWED_AUDIO_CODECS.has(profile.audioCodec) ? profile.audioCodec : 'aac';
  const preset = ALLOWED_PRESETS.has(profile.preset) ? profile.preset : 'veryfast';
  const videoBitrate = positiveInteger(profile.videoBitrateKbps, 2500, 300, 50000);
  const audioBitrate = positiveInteger(profile.audioBitrateKbps, 128, 32, 512);
  const fps = positiveInteger(profile.fps, 30, 1, 120);
  const resolution = normalizeResolution(profile.resolution);
  const [width, height] = resolution.split('x');

  const args = ['-hide_banner', '-nostdin'];
  if (runtime.realtimeInput !== false) args.push('-re');
  if (runtime.loop === true && source.kind === 'file') args.push('-stream_loop', '-1');
  args.push('-i', source.uri);
  args.push('-c:v', videoCodec, '-preset', preset, '-b:v', `${videoBitrate}k`);
  args.push('-maxrate', `${Math.round(videoBitrate * 1.08)}k`, '-bufsize', `${videoBitrate * 2}k`);
  args.push('-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:ow-iw:oh-ih`);
  args.push('-r', String(fps), '-pix_fmt', 'yuv420p');
  args.push('-c:a', audioCodec, '-b:a', `${audioBitrate}k`, '-ar', '44100');
  args.push('-f', 'flv', output.url);

  const redactedArgs = args.map((arg, index) => {
    if (index > 0 && args[index - 1] === '-i') return '<redacted-input>';
    if (arg === output.url) return '<redacted-output>';
    return arg;
  });

  return Object.freeze({ executable, args: Object.freeze(args), redactedArgs: Object.freeze(redactedArgs) });
}

module.exports = { buildFfmpegCommand };
